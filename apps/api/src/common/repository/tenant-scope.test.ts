import { describe, expect, it } from 'vitest';
import { MissingTenantError, softDeleteData, tenantWhere } from './tenant-scope';

describe('tenantWhere (isolamento multi-tenant — docs/09)', () => {
  it('injeta userId e exclui soft-deletados', () => {
    expect(tenantWhere('u1')).toEqual({ userId: 'u1', deletedAt: null });
  });

  it('mescla filtros extras sem perder o tenant', () => {
    const where = tenantWhere('u1', { source: 'PIX' });
    expect(where).toEqual({ userId: 'u1', deletedAt: null, source: 'PIX' });
  });

  it('extra NUNCA sobrescreve o tenant', () => {
    const malicioso = { userId: 'u2', deletedAt: new Date() } as object;
    const where = tenantWhere('u1', malicioso);
    expect(where.userId).toBe('u1'); // tenant vence
    expect(where.deletedAt).toBeNull();
  });

  it.each(['', undefined, null])('lança MissingTenantError com userId inválido (%s)', (bad) => {
    expect(() => tenantWhere(bad as unknown as string)).toThrow(MissingTenantError);
  });
});

describe('softDeleteData', () => {
  it('marca deletedAt com a data atual (nunca apaga de verdade)', () => {
    const before = Date.now();
    const data = softDeleteData();
    expect(data.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
