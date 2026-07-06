import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../common/audit/audit.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramService } from './telegram.service';

/** Prisma falso em memória cobrindo o que o TelegramService usa. */
function makePrisma() {
  const identities: Record<string, unknown>[] = [];
  const codes: Record<string, unknown>[] = [];

  const prisma = {
    channelIdentity: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          identities.find(
            (i) => i.userId === where.userId && i.provider === 'TELEGRAM' && i.deletedAt == null,
          ) ?? null,
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { provider_externalId: { externalId: string } } }) =>
          identities.find((i) => i.externalId === where.provider_externalId.externalId) ?? null,
      ),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = identities.find(
          (i) => i.externalId === where.provider_externalId.externalId,
        );
        if (existing) Object.assign(existing, update);
        else identities.push({ ...create });
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        identities
          .filter((i) => i.userId === where.userId && i.deletedAt == null)
          .forEach((i) => Object.assign(i, data));
      }),
    },
    telegramLinkCode: {
      findUnique: vi.fn(
        async ({ where }: { where: { code?: string; userId?: string } }) =>
          codes.find((c) => (where.code ? c.code === where.code : c.userId === where.userId)) ??
          null,
      ),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = codes.find((c) => c.userId === where.userId);
        if (existing) Object.assign(existing, update);
        else codes.push({ id: `c${codes.length + 1}`, userId: where.userId, ...create });
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const c = codes.find((x) => x.id === where.id);
        if (c) Object.assign(c, data);
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        for (let i = codes.length - 1; i >= 0; i--)
          if (codes[i]!.userId === where.userId) codes.splice(i, 1);
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  return { prisma, identities, codes };
}

const audit = { log: vi.fn() } as unknown as AuditService;

describe('TelegramService — conexão e códigos', () => {
  let service: TelegramService;
  let store: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    store = makePrisma();
    service = new TelegramService(store.prisma, audit);
  });

  it('gera código de 6 dígitos e persiste', async () => {
    const { code } = await service.generateLinkCode('u1');
    expect(code).toMatch(/^\d{6}$/);
    expect(store.codes).toHaveLength(1);
  });

  it('bloqueia gerar código quando já conectado', async () => {
    store.identities.push({
      userId: 'u1',
      provider: 'TELEGRAM',
      externalId: '999',
      deletedAt: null,
      createdAt: new Date(),
    });
    await expect(service.generateLinkCode('u1')).rejects.toThrow(ConflictException);
  });

  it('vincula com código válido e guarda nome/username', async () => {
    const { code } = await service.generateLinkCode('u1');
    const ok = await service.tryLink(code, '12345', { firstName: 'Will', username: 'will_t' });
    expect(ok).toBe(true);
    const conn = await service.getConnection('u1');
    expect(conn).toMatchObject({
      connected: true,
      displayName: 'Will',
      username: 'will_t',
      externalId: '12345',
    });
  });

  it('código é de uso único (não vincula duas vezes)', async () => {
    const { code } = await service.generateLinkCode('u1');
    expect(await service.tryLink(code, '12345')).toBe(true);
    expect(await service.tryLink(code, '67890')).toBe(false);
  });

  it('código expirado não vincula', async () => {
    const { code } = await service.generateLinkCode('u1');
    store.codes[0]!.expiresAt = new Date(Date.now() - 1000);
    expect(await service.tryLink(code, '12345')).toBe(false);
  });

  it('desvincular remove a conexão e permite gerar novo código', async () => {
    const { code } = await service.generateLinkCode('u1');
    await service.tryLink(code, '12345');
    await service.unlink('u1');
    expect((await service.getConnection('u1')).connected).toBe(false);
    await expect(service.generateLinkCode('u1')).resolves.toBeDefined();
  });
});
