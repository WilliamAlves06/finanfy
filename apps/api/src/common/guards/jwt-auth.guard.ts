import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

/** Valida o access token e injeta req.user.userId (tenant) — docs/09. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) throw new UnauthorizedException('Faça login para continuar.');

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      request.user = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
  }
}
