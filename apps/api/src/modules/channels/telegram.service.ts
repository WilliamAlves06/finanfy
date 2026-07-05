import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Canal Telegram (docs/06) — 100% grátis via Bot API.
 * Vínculo: o usuário gera um código no painel e manda "vincular CODIGO" pro bot.
 * Códigos em memória com TTL (MVP single-instance).
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly linkCodes = new Map<string, { userId: string; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  isConfigured(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  }

  /** Gera código de vínculo de 6 dígitos (15 min de validade). */
  generateLinkCode(userId: string): { code: string; expiresInMinutes: number } {
    const code = String(randomInt(100000, 999999));
    this.linkCodes.set(code, { userId, expiresAt: Date.now() + 15 * 60_000 });
    return { code, expiresInMinutes: 15 };
  }

  /** Tenta vincular um chat do Telegram usando o código. */
  async tryLink(code: string, externalId: string): Promise<boolean> {
    const entry = this.linkCodes.get(code);
    if (!entry || entry.expiresAt < Date.now()) return false;
    this.linkCodes.delete(code);

    await this.prisma.channelIdentity.upsert({
      where: { provider_externalId: { provider: 'TELEGRAM', externalId } },
      create: { provider: 'TELEGRAM', externalId, userId: entry.userId },
      update: { userId: entry.userId, deletedAt: null },
    });
    return true;
  }

  /** Resolve o tenant a partir do chat id (docs/06). */
  async resolveUser(externalId: string): Promise<string | null> {
    const identity = await this.prisma.channelIdentity.findUnique({
      where: { provider_externalId: { provider: 'TELEGRAM', externalId } },
    });
    return identity && !identity.deletedAt ? identity.userId : null;
  }

  /** Envia mensagem; quickReplies viram reply keyboard (botões). */
  async send(chatId: string, text: string, quickReplies?: string[]): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const body: Record<string, unknown> = { chat_id: chatId, text };
    body.reply_markup = quickReplies?.length
      ? {
          keyboard: quickReplies.map((label) => [{ text: label }]),
          one_time_keyboard: true,
          resize_keyboard: true,
        }
      : { remove_keyboard: true };

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) this.logger.warn(`Telegram sendMessage ${res.status}: ${await res.text()}`);
    } catch (e) {
      this.logger.warn(`Telegram send falhou: ${(e as Error).message}`);
    }
  }

  /** Busca o chat id do usuário (para notificações proativas). */
  async chatIdFor(userId: string): Promise<string | null> {
    const identity = await this.prisma.channelIdentity.findFirst({
      where: { userId, provider: 'TELEGRAM', deletedAt: null },
    });
    return identity?.externalId ?? null;
  }
}
