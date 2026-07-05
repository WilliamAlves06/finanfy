// Portas do domínio de auth (Repository Pattern — docs/02).
// O domínio não conhece Prisma; infrastructure implementa.

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<AuthUser | null>;
  create(data: { email: string; passwordHash: string; name?: string }): Promise<AuthUser>;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RefreshTokenRepositoryPort {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<StoredRefreshToken>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
