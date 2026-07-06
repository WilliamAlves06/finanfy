import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const CODE_TTL_MINUTES = 10;

export interface TelegramProfile {
  firstName?: string;
  username?: string;
}

export interface TelegramConnection {
  connected: boolean;
  displayName?: string;
  username?: string;
  externalId?: string;
  connectedAt?: string;
}

/**
 * Canal Telegram (docs/06) — 100% grátis via Bot API.
 * Vínculo: código persistido (sobrevive a restart), expira em 10 min e é de
 * uso único. Cada usuário só pode ter UM Telegram conectado.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  isConfigured(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  }

  /** Estado da conexão do usuário (para o painel). */
  async getConnection(userId: string): Promise<TelegramConnection> {
    const identity = await this.prisma.channelIdentity.findFirst({
      where: { userId, provider: 'TELEGRAM', deletedAt: null },
    });
    if (!identity) return { connected: false };
    return {
      connected: true,
      displayName: identity.displayName ?? undefined,
      username: identity.username ?? undefined,
      externalId: identity.externalId,
      connectedAt: (identity.connectedAt ?? identity.createdAt).toISOString(),
    };
  }

  /**
   * Gera um código de vínculo. Bloqueia se já houver Telegram conectado.
   * Regenera (upsert) — o código anterior deixa de valer imediatamente.
   */
  async generateLinkCode(userId: string): Promise<{ code: string; expiresInMinutes: number }> {
    const existing = await this.getConnection(userId);
    if (existing.connected) {
      throw new ConflictException('Esta conta já possui um Telegram conectado.');
    }

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
    await this.prisma.telegramLinkCode.upsert({
      where: { userId },
      create: { userId, code, expiresAt },
      update: { code, expiresAt, usedAt: null },
    });
    return { code, expiresInMinutes: CODE_TTL_MINUTES };
  }

  /** Tenta vincular um chat do Telegram usando o código. */
  async tryLink(code: string, externalId: string, profile: TelegramProfile = {}): Promise<boolean> {
    const entry = await this.prisma.telegramLinkCode.findUnique({ where: { code } });
    if (!entry || entry.usedAt || entry.expiresAt < new Date()) return false;

    await this.prisma.$transaction(async (tx) => {
      // marca o código como usado (uso único)
      await tx.telegramLinkCode.update({ where: { id: entry.id }, data: { usedAt: new Date() } });
      // vincula o chat ao usuário (troca de dono se o chat já era de outra conta)
      await tx.channelIdentity.upsert({
        where: { provider_externalId: { provider: 'TELEGRAM', externalId } },
        create: {
          provider: 'TELEGRAM',
          externalId,
          userId: entry.userId,
          displayName: profile.firstName,
          username: profile.username,
          connectedAt: new Date(),
        },
        update: {
          userId: entry.userId,
          deletedAt: null,
          displayName: profile.firstName,
          username: profile.username,
          connectedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      userId: entry.userId,
      action: 'telegram.link',
      entity: 'ChannelIdentity',
      entityId: externalId,
      channel: 'TELEGRAM',
    });
    return true;
  }

  /** Desvincula o Telegram do usuário. */
  async unlink(userId: string): Promise<void> {
    await this.prisma.channelIdentity.updateMany({
      where: { userId, provider: 'TELEGRAM', deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await this.prisma.telegramLinkCode.deleteMany({ where: { userId } });
    await this.audit.log({
      userId,
      action: 'telegram.unlink',
      entity: 'ChannelIdentity',
      channel: 'TELEGRAM',
    });
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
