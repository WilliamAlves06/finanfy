import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  AuthUser,
  RefreshTokenRepositoryPort,
  StoredRefreshToken,
  UserRepositoryPort,
} from '../domain/auth.repositories';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, passwordHash: true, name: true },
    });
  }

  create(data: { email: string; passwordHash: string; name?: string }): Promise<AuthUser> {
    return this.prisma.user.create({
      data,
      select: { id: true, email: true, passwordHash: true, name: true },
    });
  }
}

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<StoredRefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findFirst({ where: { tokenHash } });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
