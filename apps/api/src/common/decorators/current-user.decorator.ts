import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/** Entrega o userId (tenant) autenticado ao controller. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user.userId;
});
