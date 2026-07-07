import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/repository/tenant-scope';
import { formatCents, todayAsDate } from '../../common/utils/dates';
import { CardsService } from '../cards/cards.service';
import { ReserveService } from '../reserve/reserve.service';

export type PaymentMethod = 'DINHEIRO' | 'SALDO' | 'CAIXINHA' | 'CARTAO' | 'PIX';
export type Channel = 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API';

export interface CreateExpenseInput {
  amountCents: number;
  method?: PaymentMethod; // ⚠️ sempre perguntada — sem ela, erro pedindo a forma
  note?: string;
  categoryId?: string;
  cardId?: string;
  installments?: number;
  recurringChargeId?: string;
  channel?: Channel;
}

/**
 * UC-02 — Registrar despesa. Regra inegociável: forma de pagamento NUNCA é
 * assumida. Efeito por método (docs/10):
 * SALDO/PIX/DINHEIRO → abate saldo disponível · CAIXINHA → abate reserva ·
 * CARTAO → parcela em fatura, não mexe no saldo.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reserve: ReserveService,
    private readonly cards: CardsService,
  ) {}

  async create(userId: string, input: CreateExpenseInput) {
    if (!input.method) {
      throw new BadRequestException({
        message: 'Como foi pago? DINHEIRO, SALDO, CAIXINHA, CARTAO ou PIX.',
        error: 'PAYMENT_METHOD_REQUIRED',
      });
    }
    if (input.method === 'CARTAO' && !input.cardId) {
      throw new BadRequestException({
        message: 'Informe qual cartão foi usado.',
        error: 'CARD_REQUIRED',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let installmentId: string | undefined;

      switch (input.method) {
        case 'SALDO':
        case 'PIX':
        case 'DINHEIRO':
          // dinheiro/PIX saem do bolso do usuário → abatem o saldo disponível
          await tx.user.update({
            where: { id: userId },
            data: { balanceCents: { decrement: input.amountCents } },
          });
          break;
        case 'CAIXINHA':
          await this.reserve.debitForExpense(tx, userId, input.amountCents);
          break;
        case 'CARTAO': {
          const { firstInstallmentId } = await this.cards.addPurchase(
            tx,
            userId,
            input.cardId!,
            input.amountCents,
            input.installments ?? 1,
          );
          installmentId = firstInstallmentId;
          break;
        }
      }

      const expense = await tx.expense.create({
        data: {
          userId,
          amountCents: input.amountCents,
          method: input.method!,
          date: todayAsDate(),
          note: input.note,
          categoryId: input.categoryId,
          cardId: input.method === 'CARTAO' ? input.cardId : undefined,
          installmentId,
          recurringChargeId: input.recurringChargeId,
          channel: input.channel ?? 'WEB',
        },
      });

      await this.audit.log(
        {
          userId,
          action: 'expense.create',
          entity: 'Expense',
          entityId: expense.id,
          after: expense,
          channel: input.channel,
        },
        tx,
      );

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return { expense, balanceCents: user.balanceCents };
    });

    return { ...result, balanceFormatted: formatCents(result.balanceCents) };
  }

  /** Última despesa registrada (para o "desfazer" do chat). */
  findLast(userId: string) {
    return this.prisma.expense.findFirst({
      where: tenantWhere(userId),
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Desfaz uma despesa: reverte o efeito conforme o método + soft delete. */
  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: tenantWhere(userId, { id }) });
      if (!expense) return null;

      switch (expense.method) {
        case 'SALDO':
        case 'PIX':
        case 'DINHEIRO':
          await tx.user.update({
            where: { id: userId },
            data: { balanceCents: { increment: expense.amountCents } },
          });
          break;
        case 'CAIXINHA': {
          const reserve = await tx.reserve.findUnique({ where: { userId } });
          if (reserve) {
            await tx.reserve.update({
              where: { userId },
              data: { balanceCents: { increment: expense.amountCents } },
            });
            await tx.reserveMovement.create({
              data: {
                reserveId: reserve.id,
                type: 'IN',
                amountCents: expense.amountCents,
                reason: 'estorno de despesa',
              },
            });
          }
          break;
        }
        case 'CARTAO':
          if (expense.installmentId) {
            const inst = await tx.installment.findUnique({ where: { id: expense.installmentId } });
            if (inst?.invoiceId) {
              await tx.invoice.update({
                where: { id: inst.invoiceId },
                data: { totalCents: { decrement: inst.amountCents } },
              });
            }
            if (inst) {
              await tx.installment.update({
                where: { id: inst.id },
                data: { deletedAt: new Date() },
              });
            }
          }
          break;
      }

      await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.log(
        { userId, action: 'expense.delete', entity: 'Expense', entityId: id, before: expense },
        tx,
      );
      return expense;
    });
  }

  list(
    userId: string,
    opts: { from?: string; to?: string; page?: number; pageSize?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 20);
    const dateFilter =
      opts.from || opts.to
        ? {
            date: {
              ...(opts.from ? { gte: new Date(`${opts.from}T00:00:00.000Z`) } : {}),
              ...(opts.to ? { lte: new Date(`${opts.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {};
    return this.prisma.$transaction(async (tx) => {
      const where = tenantWhere(userId, dateFilter);
      const [data, total] = await Promise.all([
        tx.expense.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { category: { select: { name: true } }, card: { select: { name: true } } },
        }),
        tx.expense.count({ where }),
      ]);
      return { data, page, pageSize, total };
    });
  }
}
