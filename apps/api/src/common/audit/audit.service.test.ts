import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

function makeFakePrisma() {
  const create = vi.fn().mockResolvedValue({});
  return { prisma: { auditLog: { create } } as unknown as PrismaService, create };
}

describe('AuditService (trilha imutável — docs/03)', () => {
  it('registra quem/o quê/antes/depois/canal', async () => {
    const { prisma, create } = makeFakePrisma();
    const audit = new AuditService(prisma);

    await audit.log({
      userId: 'u1',
      action: 'income.create',
      entity: 'Income',
      entityId: 'i1',
      after: { amountCents: 18000, source: 'DIARIA' },
      channel: 'TELEGRAM',
    });

    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]![0].data;
    expect(data.userId).toBe('u1');
    expect(data.action).toBe('income.create');
    expect(data.after).toEqual({ amountCents: 18000, source: 'DIARIA' });
    expect(data.channel).toBe('TELEGRAM');
  });

  it('usa o cliente transacional quando fornecido (auditoria dentro de $transaction)', async () => {
    const { prisma, create } = makeFakePrisma();
    const txCreate = vi.fn().mockResolvedValue({});
    const tx = { auditLog: { create: txCreate } } as unknown as Pick<PrismaService, 'auditLog'>;

    const audit = new AuditService(prisma);
    await audit.log({ userId: 'u1', action: 'expense.create', entity: 'Expense' }, tx);

    expect(txCreate).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled(); // não usou o cliente global
  });

  it('serializa before/after como JSON puro (sem classes/Datas cruas)', async () => {
    const { prisma, create } = makeFakePrisma();
    const audit = new AuditService(prisma);

    await audit.log({
      userId: 'u1',
      action: 'card.update',
      entity: 'Card',
      before: { limitCents: 100000, updatedAt: new Date('2026-07-04T12:00:00Z') },
    });

    const data = create.mock.calls[0]![0].data;
    expect(typeof data.before.updatedAt).toBe('string'); // Date virou ISO string
  });
});
