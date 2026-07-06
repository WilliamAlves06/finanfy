import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/repository/tenant-scope';
import { formatCents, todayISO } from '../../common/utils/dates';

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * UC-07 — Cartões, faturas e parcelas (docs/10).
 * Compra no cartão NÃO mexe no saldo disponível; vira parcela(s) em fatura(s).
 * Disponível = limite − parcelas não pagas (faturas OPEN/CLOSED).
 */
@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    data: { name: string; limitCents: number; closingDay: number; dueDay: number },
  ) {
    const card = await this.prisma.card.create({ data: { ...data, userId } });
    await this.audit.log({
      userId,
      action: 'card.create',
      entity: 'Card',
      entityId: card.id,
      after: card,
    });
    return card;
  }

  async list(userId: string) {
    const cards = await this.prisma.card.findMany({ where: tenantWhere(userId) });
    return Promise.all(cards.map(async (c) => this.withAvailable(c)));
  }

  /** Busca cartão por nome aproximado (case/acentos-insensitive) — usado pelo chat. */
  async findByName(userId: string, name: string) {
    const cards = await this.prisma.card.findMany({ where: tenantWhere(userId) });
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim();
    const target = norm(name);
    return (
      cards.find((c) => norm(c.name) === target) ??
      cards.find((c) => norm(c.name).includes(target) || target.includes(norm(c.name))) ??
      null
    );
  }

  /** Nomes dos cartões do usuário (para o teclado do chat). */
  async listNames(userId: string): Promise<string[]> {
    const cards = await this.prisma.card.findMany({
      where: tenantWhere(userId),
      select: { name: true },
    });
    return cards.map((c) => c.name);
  }

  async getById(userId: string, id: string) {
    const card = await this.prisma.card.findFirst({ where: tenantWhere(userId, { id }) });
    if (!card) throw new NotFoundException('Cartão não encontrado.');
    return this.withAvailable(card);
  }

  private async withAvailable(card: { id: string; limitCents: number } & Record<string, unknown>) {
    const used = await this.prisma.installment.aggregate({
      where: {
        cardId: card.id,
        deletedAt: null,
        OR: [{ invoiceId: null }, { invoice: { status: { in: ['OPEN', 'CLOSED'] } } }],
      },
      _sum: { amountCents: true },
    });
    const usedCents = used._sum.amountCents ?? 0;
    const availableCents = card.limitCents - usedCents;
    return {
      ...card,
      usedCents,
      availableCents,
      availableFormatted: formatCents(availableCents),
    };
  }

  /**
   * Registra uma compra parcelada dentro de uma transação existente.
   * Cada parcela cai na fatura do mês correto conforme o dia de fechamento:
   * compra após o fechamento → 1ª parcela vai para o mês seguinte.
   */
  async addPurchase(
    tx: Tx,
    userId: string,
    cardId: string,
    totalCents: number,
    installments = 1,
  ): Promise<{ firstInstallmentId: string }> {
    const card = await tx.card.findFirst({ where: tenantWhere(userId, { id: cardId }) });
    if (!card) throw new NotFoundException('Cartão não encontrado.');

    const [yearStr, monthStr, dayStr] = todayISO().split('-') as [string, string, string];
    let year = Number(yearStr);
    let month = Number(monthStr);
    if (Number(dayStr) > card.closingDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    const per = Math.floor(totalCents / installments);
    const remainder = totalCents - per * installments; // centavos extras na 1ª parcela
    let firstInstallmentId = '';

    for (let n = 1; n <= installments; n++) {
      const dueDate = new Date(Date.UTC(year, month - 1, Math.min(card.dueDay, 28)));
      const invoice = await tx.invoice.upsert({
        where: { cardId_year_month: { cardId, year, month } },
        create: { cardId, year, month, dueDate, totalCents: 0 },
        update: {},
      });
      const inst = await tx.installment.create({
        data: {
          cardId,
          invoiceId: invoice.id,
          amountCents: per + (n === 1 ? remainder : 0),
          number: n,
          total: installments,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { totalCents: { increment: inst.amountCents } },
      });
      if (n === 1) firstInstallmentId = inst.id;

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return { firstInstallmentId };
  }

  listInvoices(userId: string, cardId: string) {
    return this.prisma.invoice.findMany({
      where: { cardId, card: { userId }, deletedAt: null },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { installments: { where: { deletedAt: null } } },
    });
  }
}
