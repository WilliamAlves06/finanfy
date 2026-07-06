import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { formatCents, todayAsDate } from '../../common/utils/dates';
import { TelegramService } from '../channels/telegram.service';
import { RecurringService } from '../recurring/recurring.service';

const TZ = 'America/Sao_Paulo';

/**
 * UC-09 — Notificações (docs/10). Crons no próprio api (MVP sem Redis;
 * mover para apps/workers + BullMQ quando escalar).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly recurring: RecurringService,
  ) {}

  /** 18:00 todo dia — "Você ainda não registrou quanto ganhou hoje." */
  @Cron('0 18 * * *', { timeZone: TZ })
  async dailyNoIncomeCheck(): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, email: { not: 'system@finanfy.local' } },
      select: { id: true },
    });

    let sent = 0;
    for (const user of users) {
      const hasIncome = await this.prisma.income.count({
        where: { userId: user.id, date: todayAsDate(), deletedAt: null },
      });
      if (hasIncome > 0) continue;

      await this.notify(
        user.id,
        'NO_INCOME_TODAY',
        'Você ainda não registrou quanto ganhou hoje. 🙂 Me conta: quanto foi?',
      );
      sent++;
    }
    this.logger.log(`18h: ${sent} lembretes de receita enviados`);
    return sent;
  }

  /** 08:00 — marca vencidas e lembra contas que vencem em até 2 dias. */
  @Cron('0 8 * * *', { timeZone: TZ })
  async dailyBillReminders(): Promise<number> {
    await this.recurring.markOverdue();

    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const charges = await this.prisma.recurringCharge.findMany({
      where: { status: 'PENDING', dueDate: { lte: soon }, deletedAt: null },
      include: { recurringBill: { select: { name: true, userId: true } } },
    });

    for (const charge of charges) {
      await this.notify(
        charge.recurringBill.userId,
        'BILL_DUE',
        `Lembrete: a conta "${charge.recurringBill.name}" de ${formatCents(charge.amountCents)} vence dia ${charge.dueDate.toISOString().slice(8, 10)}. 📅`,
        { chargeId: charge.id },
      );
    }
    return charges.length;
  }

  /** Dia 1 de cada mês, 06:00 — gera as cobranças recorrentes (idempotente). */
  @Cron('0 6 1 * *', { timeZone: TZ })
  async monthlyGenerateCharges(): Promise<number> {
    const created = await this.recurring.generateChargesForMonth();
    this.logger.log(`Mensal: ${created} cobranças geradas`);
    return created;
  }

  /** Cria a Notification, tenta entregar no Telegram e marca o status. */
  private async notify(
    userId: string,
    type: 'NO_INCOME_TODAY' | 'BILL_DUE' | 'INVOICE_DUE' | 'NEGATIVE_BALANCE' | 'GOAL_REACHED',
    text: string,
    payload?: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, payload: { text, ...payload } },
    });

    const chatId = await this.telegram.chatIdFor(userId);
    if (chatId && this.telegram.isConfigured()) {
      await this.telegram.send(chatId, text);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }
    // sem canal externo: fica PENDING e aparece no painel web
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
