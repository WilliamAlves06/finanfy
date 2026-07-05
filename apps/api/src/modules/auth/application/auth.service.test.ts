import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuthUser,
  RefreshTokenRepositoryPort,
  StoredRefreshToken,
  UserRepositoryPort,
} from '../domain/auth.repositories';
import { AuthService } from './auth.service';

// ── fakes em memória (Repository Pattern permite testar sem banco) ──

class FakeUserRepo implements UserRepositoryPort {
  users: AuthUser[] = [];

  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async create(data: { email: string; passwordHash: string; name?: string }) {
    const user: AuthUser = {
      id: `u${this.users.length + 1}`,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name ?? null,
    };
    this.users.push(user);
    return user;
  }
}

class FakeRefreshRepo implements RefreshTokenRepositoryPort {
  tokens: StoredRefreshToken[] = [];

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    const t: StoredRefreshToken = {
      id: `t${this.tokens.length + 1}`,
      revokedAt: null,
      ...data,
    };
    this.tokens.push(t);
    return t;
  }

  async findByHash(tokenHash: string) {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async revoke(id: string) {
    const t = this.tokens.find((x) => x.id === id);
    if (t) t.revokedAt = new Date();
  }

  async revokeAllForUser(userId: string) {
    for (const t of this.tokens) if (t.userId === userId && !t.revokedAt) t.revokedAt = new Date();
  }
}

describe('AuthService', () => {
  let service: AuthService;
  let users: FakeUserRepo;
  let refresh: FakeRefreshRepo;

  beforeEach(() => {
    users = new FakeUserRepo();
    refresh = new FakeRefreshRepo();
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } });
    service = new AuthService(users, refresh, jwt);
  });

  it('register: guarda hash bcrypt, nunca a senha', async () => {
    const tokens = await service.register('maria@email.com', 'senha12345');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    const saved = users.users[0]!;
    expect(saved.passwordHash).not.toContain('senha12345');
    expect(saved.passwordHash.startsWith('$2')).toBe(true); // formato bcrypt
  });

  it('register: e-mail duplicado → conflito', async () => {
    await service.register('maria@email.com', 'senha12345');
    await expect(service.register('maria@email.com', 'outra1234')).rejects.toThrow(
      ConflictException,
    );
  });

  it('login: senha errada → 401 com mensagem genérica', async () => {
    await service.register('maria@email.com', 'senha12345');
    await expect(service.login('maria@email.com', 'errada123')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('naoexiste@email.com', 'x')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh: rotaciona (antigo é revogado, novo emitido)', async () => {
    const first = await service.register('maria@email.com', 'senha12345');
    const second = await service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(refresh.tokens[0]!.revokedAt).not.toBeNull(); // antigo revogado
    expect(refresh.tokens[1]!.revokedAt).toBeNull(); // novo ativo
  });

  it('refresh: reuso de token revogado revoga a família inteira', async () => {
    const first = await service.register('maria@email.com', 'senha12345');
    await service.refresh(first.refreshToken); // rotaciona (revoga o 1º)

    // atacante tenta reusar o 1º
    await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    // TODOS os tokens do usuário foram revogados
    expect(refresh.tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('refresh: token expirado → 401', async () => {
    const t = await service.register('maria@email.com', 'senha12345');
    refresh.tokens[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.refresh(t.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('logout: revoga o refresh token', async () => {
    const t = await service.register('maria@email.com', 'senha12345');
    await service.logout(t.refreshToken);
    expect(refresh.tokens[0]!.revokedAt).not.toBeNull();
  });
});
