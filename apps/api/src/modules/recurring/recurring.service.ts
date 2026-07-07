import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/repository/tenant-scope';
import { todayISO } from '../../common/utils/dates';
import { ExpensesService, PaymentMethod } from '../expenses/expenses.service';

/**
 * UC-05/UC-06 — Contas recorrentes (docs/10).
 * Regras: todo mês gera cobrança automaticamente; não paga → continua PENDENTE;
 * mês seguinte cria NOVA cobrança; pendência NUNCA é apagada.
 */
@Injectable()
export class RecurringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly expenses: ExpensesService,
  ) {}

  async createBill(
    userId: string,
    data: { name: string; amountCents: number; dueDay: number; categoryId?: string },
  ) {
    const bill = await this.prisma.recurringBill.create({ data: { ...data, userId } });
    await this.audit.log({
      userId,
      action: 'recurringBill.create',
      entity: 'RecurringBill',
      entityId: bill.id,
      after: bill,
    });
    // já gera a cobrança do mês corrente
    await this.generateChargesForMonth(userId);
    return bill;
  }

  listBills(userId: string) {
    return this.prisma.recurringBill.findMany({ where: tenantWhere(userId, { active: true }) });
  }

  async updateBill(
    userId: string,
    id: string,
    data: Partial<{ name: string; amountCents: number; dueDay: number; categoryId: string }>,
  ) {
    const existing = await this.prisma.recurringBill.findFirst({
      where: tenantWhere(userId, { id }),
    });
    if (!existing) throw new NotFoundException('Conta não encontrada.');
    const bill = await this.prisma.recurringBill.update({ where: { id }, data });
    await this.audit.log({
      userId,
      action: 'recurringBill.update',
      entity: 'RecurringBill',
      entityId: id,
      before: existing,
      after: bill,
    });
    return bill;
  }

  async removeBill(userId: string, id: string) {
    const existing = await this.prisma.recurringBill.findFirst({
      where: tenantWhere(userId, { id }),
    });
    if (!existing) throw new NotFoundException('Conta não encontrada.');
    // desativa e some da lista; cobranças já geradas continuam (histórico)
    await this.prisma.recurringBill.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    await this.audit.log({
      userId,
      action: 'recurringBill.delete',
      entity: 'RecurringBill',
      entityId: id,
    });
  }

  listCharges(userId: string, status?: 'PENDING' | 'PAID' | 'OVERDUE') {
    return this.prisma.recurringCharge.findMany({
      where: {
        recurringBill: { userId },
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: { recurringBill: { select: { name: true } } },
    });
  }

  /**
   * Gera as cobranças do mês corrente (idempotente pelo unique
   * recurringBillId+year+month). Chamado pelo cron mensal e ao criar conta.
   * Se userId for omitido, roda para todos (worker).
   */
  async generateChargesForMonth(userId?: string): Promise<number> {
    const [yearStr, monthStr] = todayISO().split('-') as [string, string];
    const year = Number(yearStr);
    const month = Number(monthStr);

    const bills = await this.prisma.recurringBill.findMany({
      where: { active: true, deletedAt: null, ...(userId ? { userId } : {}) },
    });

    let created = 0;
    for (const bill of bills) {
      const dueDate = new Date(Date.UTC(year, month - 1, Math.min(bill.dueDay, 28)));
      try {
        await this.prisma.recurringCharge.create({
          data: { recurringBillId: bill.id, year, month, amountCents: bill.amountCents, dueDate },
        });
        created++;
      } catch {
        // unique violation = cobrança do mês já existe → idempotente, segue
      }
    }
    return created;
  }

  /** Marca cobranças vencidas como OVERDUE (nunca apaga — docs/01). */
  async markOverdue(): Promise<number> {
    const res = await this.prisma.recurringCharge.updateMany({
      where: { status: 'PENDING', dueDate: { lt: new Date() }, deletedAt: null },
      data: { status: 'OVERDUE' },
    });
    return res.count;
  }

  /** UC-06 — pagar cobrança: cria a Expense vinculada (forma obrigatória) e marca PAID. */
  async payCharge(userId: string, chargeId: string, method: PaymentMethod, cardId?: string) {
    const charge = await this.prisma.recurringCharge.findFirst({
      where: { id: chargeId, recurringBill: { userId }, deletedAt: null, status: { not: 'PAID' } },
      include: { recurringBill: true },
    });
    if (!charge) throw new NotFoundException('Cobrança não encontrada ou já paga.');

    const result = await this.expenses.create(userId, {
      amountCents: charge.amountCents,
      method,
      cardId,
      note: `Conta: ${charge.recurringBill.name}`,
      categoryId: charge.recurringBill.categoryId ?? undefined,
      recurringChargeId: charge.id,
    });

    await this.prisma.recurringCharge.update({
      where: { id: charge.id },
      data: { status: 'PAID' },
    });
    await this.audit.log({
      userId,
      action: 'recurringCharge.pay',
      entity: 'RecurringCharge',
      entityId: charge.id,
      after: { method },
    });

    return result;
  }
}
