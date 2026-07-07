import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/repository/tenant-scope';
import { formatCents, todayAsDate, todayISO } from '../../common/utils/dates';

export type IncomeSource = 'DIARIA' | 'PIX' | 'SALARIO' | 'VENDA' | 'OUTRO';
export type Channel = 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API';

export interface CreateIncomeInput {
  amountCents: number;
  source: IncomeSource; // sempre obrigatória (UC-01)
  date?: string; // YYYY-MM-DD — se vier, TEM que ser hoje (sem retroativo)
  note?: string;
  clientId?: string;
  categoryId?: string;
  channel?: Channel;
}

/** UC-01 — Registrar receita. Regras: origem obrigatória, sem retroativo, várias por dia. */
@Injectable()
export class IncomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, input: CreateIncomeInput) {
    // ⚠️ regra inegociável: sem retroativo — dia esquecido é dia perdido (docs/01)
    if (input.date && input.date !== todayISO()) {
      throw new UnprocessableEntityException({
        message: 'Receitas só podem ser registradas no dia de hoje. Dia esquecido é dia perdido.',
        error: 'RETROACTIVE_NOT_ALLOWED',
      });
    }

    const [income, user] = await this.prisma.$transaction(async (tx) => {
      const created = await tx.income.create({
        data: {
          userId,
          amountCents: input.amountCents,
          source: input.source,
          date: todayAsDate(),
          note: input.note,
          clientId: input.clientId,
          categoryId: input.categoryId,
          channel: input.channel ?? 'WEB',
        },
      });
      // saldo materializado atualizado na MESMA transação (docs/04)
      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { increment: input.amountCents } },
      });
      await this.audit.log(
        {
          userId,
          action: 'income.create',
          entity: 'Income',
          entityId: created.id,
          after: created,
          channel: input.channel,
        },
        tx,
      );
      return [created, updated] as const;
    });

    return {
      income,
      balanceCents: user.balanceCents,
      balanceFormatted: formatCents(user.balanceCents),
    };
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
        tx.income.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { client: { select: { name: true } }, category: { select: { name: true } } },
        }),
        tx.income.count({ where }),
      ]);
      return { data, page, pageSize, total };
    });
  }

  /** Última receita registrada (para o "desfazer" do chat). */
  findLast(userId: string) {
    return this.prisma.income.findFirst({
      where: tenantWhere(userId),
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Desfaz uma receita: soft delete + reverte o saldo. */
  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.findFirst({ where: tenantWhere(userId, { id }) });
      if (!income) return null;
      await tx.income.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { decrement: income.amountCents } },
      });
      await this.audit.log(
        { userId, action: 'income.delete', entity: 'Income', entityId: id, before: income },
        tx,
      );
      return income;
    });
  }

  /** True se o usuário registrou alguma receita hoje (usado pela notificação 18h). */
  async hasIncomeToday(userId: string): Promise<boolean> {
    const count = await this.prisma.income.count({
      where: tenantWhere(userId, { date: todayAsDate() }),
    });
    return count > 0;
  }
}
