import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { formatCents } from '../../common/utils/dates';

export type WithdrawDestination = 'APENAS' | 'PAGAR_CONTA';

/**
 * UC-03/UC-04 — Caixinha (reserva).
 * Regras inegociáveis (docs/01):
 * - nunca recebe dinheiro automático, só por ordem explícita;
 * - retirada exige destino; "pagar conta" NÃO cria despesa;
 * - sempre informar o saldo atualizado.
 */
@Injectable()
export class ReserveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getBalance(userId: string) {
    const reserve = await this.prisma.reserve.findUnique({ where: { userId } });
    const balanceCents = reserve?.balanceCents ?? 0;
    return { balanceCents, balanceFormatted: formatCents(balanceCents) };
  }

  /** "Guardei 300" — cria a reserva se não existir. */
  async deposit(userId: string, amountCents: number, channel?: 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API') {
    const reserve = await this.prisma.$transaction(async (tx) => {
      const r = await tx.reserve.upsert({
        where: { userId },
        create: { userId, balanceCents: amountCents },
        update: { balanceCents: { increment: amountCents } },
      });
      await tx.reserveMovement.create({
        data: { reserveId: r.id, type: 'IN', amountCents },
      });
      await this.audit.log(
        { userId, action: 'reserve.deposit', entity: 'Reserve', entityId: r.id, after: { amountCents }, channel },
        tx,
      );
      return r;
    });
    return { balanceCents: reserve.balanceCents, balanceFormatted: formatCents(reserve.balanceCents) };
  }

  /**
   * "Tirei 100" — destino obrigatório:
   * - APENAS: só diminui o saldo;
   * - PAGAR_CONTA: diminui SÓ da caixinha e NUNCA lança despesa (docs/01).
   */
  async withdraw(
    userId: string,
    amountCents: number,
    destination: WithdrawDestination,
    channel?: 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'ANDROID' | 'API',
  ) {
    const reserve = await this.prisma.$transaction(async (tx) => {
      const r = await tx.reserve.findUnique({ where: { userId } });
      if (!r || r.balanceCents < amountCents) {
        throw new UnprocessableEntityException({
          message: 'A caixinha não tem saldo suficiente.',
          error: 'INSUFFICIENT_RESERVE',
        });
      }
      const updated = await tx.reserve.update({
        where: { userId },
        data: { balanceCents: { decrement: amountCents } },
      });
      await tx.reserveMovement.create({
        data: {
          reserveId: r.id,
          type: 'OUT',
          amountCents,
          reason: destination === 'PAGAR_CONTA' ? 'pagar conta' : 'retirada',
        },
      });
      // ⚠️ intencionalmente NÃO cria Expense aqui — regra do briefing (UC-04)
      await this.audit.log(
        { userId, action: 'reserve.withdraw', entity: 'Reserve', entityId: r.id, after: { amountCents, destination }, channel },
        tx,
      );
      return updated;
    });
    return { balanceCents: reserve.balanceCents, balanceFormatted: formatCents(reserve.balanceCents) };
  }

  /** Débito interno usado pela despesa paga com CAIXINHA (UC-02). */
  async debitForExpense(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    amountCents: number,
  ) {
    const r = await tx.reserve.findUnique({ where: { userId } });
    if (!r || r.balanceCents < amountCents) {
      throw new UnprocessableEntityException({
        message: 'A caixinha não tem saldo suficiente.',
        error: 'INSUFFICIENT_RESERVE',
      });
    }
    await tx.reserve.update({
      where: { userId },
      data: { balanceCents: { decrement: amountCents } },
    });
    await tx.reserveMovement.create({
      data: { reserveId: r.id, type: 'OUT', amountCents, reason: 'despesa' },
    });
  }

  listMovements(userId: string) {
    return this.prisma.reserveMovement.findMany({
      where: { reserve: { userId }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
