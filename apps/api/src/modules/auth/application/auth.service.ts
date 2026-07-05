import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepositoryPort,
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../domain/auth.repositories';

const BCRYPT_ROUNDS = 12; // docs/09

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Regras (docs/09):
 * - senha bcrypt >= 12 rounds, nunca em texto;
 * - refresh token opaco: só o hash sha256 vai ao banco;
 * - rotação: cada refresh revoga o anterior e emite novo;
 * - reuso de token revogado = possível roubo → revoga TODOS os tokens do usuário.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepositoryPort,
    private readonly jwt: JwtService,
  ) {}

  private get refreshTtlDays(): number {
    return Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  }

  async register(email: string, password: string, name?: string): Promise<AuthTokens> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Este e-mail já está cadastrado.');

    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create({ email, passwordHash, name });
    return this.issueTokens(user.id);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.users.findByEmail(email);
    // mesma mensagem p/ email e senha errados (não vazar quem existe)
    if (!user) throw new UnauthorizedException('E-mail ou senha inválidos.');

    const ok = await compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('E-mail ou senha inválidos.');

    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokens.findByHash(tokenHash);

    if (!stored) throw new UnauthorizedException('Sessão inválida. Entre novamente.');

    if (stored.revokedAt) {
      // reuso de token já rotacionado → revoga a família inteira (docs/09)
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }

    await this.refreshTokens.revoke(stored.id); // rotação
    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(this.hashToken(refreshToken));
    if (stored && !stored.revokedAt) await this.refreshTokens.revoke(stored.id);
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync({ sub: userId });

    const refreshToken = randomBytes(48).toString('hex'); // opaco
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.refreshTokens.create({ userId, tokenHash: this.hashToken(refreshToken), expiresAt });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
