/**
 * Isolamento multi-tenant (docs/02, docs/09) — TODA query de dados de negócio
 * passa por aqui. Nenhum repositório monta `where` de tenant à mão.
 */

export class MissingTenantError extends Error {
  readonly code = 'MISSING_TENANT';
  constructor() {
    super('Operação sem tenant: userId é obrigatório em toda query.');
  }
}

/**
 * Monta o `where` padrão de tenant: filtra por userId E exclui soft-deletados.
 * Lança se userId estiver vazio — impossível consultar sem tenant.
 */
export function tenantWhere<T extends object>(
  userId: string,
  extra?: T,
): T & { userId: string; deletedAt: null } {
  if (!userId || typeof userId !== 'string') throw new MissingTenantError();
  return { ...(extra as T), userId, deletedAt: null };
}

/** Dados de soft delete — nunca apagar de verdade (docs/04). */
export function softDeleteData(): { deletedAt: Date } {
  return { deletedAt: new Date() };
}
