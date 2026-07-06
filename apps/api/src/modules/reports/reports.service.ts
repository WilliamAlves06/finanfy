import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { formatCents, todayISO } from '../../common/utils/dates';

/**
 * UC-10 — Relatórios (CQRS: só leitura, sem efeito colateral).
 * Responde: quanto tenho, quanto posso gastar, quanto gastei/recebi,
 * reserva, contas vencidas, cartão com mais limite, sobra do mês, economia do ano.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private monthRange(month?: string) {
    const [y, m] = (month ?? todayISO().slice(0, 7)).split('-').map(Number) as [number, number];
    return {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)),
    };
  }

  /** Resumo geral: saldo, reserva, pendências, faturas abertas. */
  async summary(userId: string) {
    const [user, reserve, pendingCharges, openInvoices] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.reserve.findUnique({ where: { userId } }),
      this.prisma.recurringCharge.aggregate({
        where: {
          recurringBill: { userId },
          status: { in: ['PENDING', 'OVERDUE'] },
          deletedAt: null,
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { card: { userId }, status: 'OPEN', deletedAt: null },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      balanceCents: user.balanceCents,
      balanceFormatted: formatCents(user.balanceCents),
      reserveCents: reserve?.balanceCents ?? 0,
      reserveFormatted: formatCents(reserve?.balanceCents ?? 0),
      pendingBillsCents: pendingCharges._sum.amountCents ?? 0,
      pendingBillsCount: pendingCharges._count,
      openInvoicesCents: openInvoices._sum.totalCents ?? 0,
    };
  }

  /** "Quanto posso gastar?" = saldo − contas pendentes do mês − faturas abertas. */
  async canSpend(userId: string) {
    const s = await this.summary(userId);
    const canSpendCents = Math.max(0, s.balanceCents - s.pendingBillsCents - s.openInvoicesCents);
    return {
      canSpendCents,
      canSpendFormatted: formatCents(canSpendCents),
      explain: {
        saldo: s.balanceFormatted,
        contasPendentes: formatCents(s.pendingBillsCents),
        faturasAbertas: formatCents(s.openInvoicesCents),
      },
    };
  }

  /** Recebido, gasto e sobra do mês (YYYY-MM; padrão: mês atual). */
  async monthly(userId: string, month?: string) {
    const date = this.monthRange(month);
    const [incomes, expenses] = await Promise.all([
      this.prisma.income.aggregate({
        where: { userId, deletedAt: null, date },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { userId, deletedAt: null, date },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);
    const incomeCents = incomes._sum.amountCents ?? 0;
    const expenseCents = expenses._sum.amountCents ?? 0;
    return {
      month: month ?? todayISO().slice(0, 7),
      incomeCents,
      incomeFormatted: formatCents(incomeCents),
      incomeCount: incomes._count,
      expenseCents,
      expenseFormatted: formatCents(expenseCents),
      expenseCount: expenses._count,
      leftCents: incomeCents - expenseCents,
      leftFormatted: formatCents(incomeCents - expenseCents),
    };
  }

  /** Contas vencidas (OVERDUE) — nunca apagadas. */
  overdue(userId: string) {
    return this.prisma.recurringCharge.findMany({
      where: { recurringBill: { userId }, status: 'OVERDUE', deletedAt: null },
      orderBy: { dueDate: 'asc' },
      include: { recurringBill: { select: { name: true } } },
    });
  }

  /** "Quanto economizei este ano?" = total guardado na caixinha no ano. */
  async savings(userId: string, year?: number) {
    const y = year ?? Number(todayISO().slice(0, 4));
    const range = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
    const [deposits, withdrawals] = await Promise.all([
      this.prisma.reserveMovement.aggregate({
        where: { reserve: { userId }, type: 'IN', createdAt: range, deletedAt: null },
        _sum: { amountCents: true },
      }),
      this.prisma.reserveMovement.aggregate({
        where: { reserve: { userId }, type: 'OUT', createdAt: range, deletedAt: null },
        _sum: { amountCents: true },
      }),
    ]);
    const savedCents = (deposits._sum.amountCents ?? 0) - (withdrawals._sum.amountCents ?? 0);
    return { year: y, savedCents, savedFormatted: formatCents(savedCents) };
  }
}
