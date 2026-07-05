import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Filtro global — todo erro vira o formato único do docs/12:
 * { "error": { "code", "message", "traceId" } }
 * Erros de domínio (DomainError do @finanfy/shared) carregam `code` próprio.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = (request.headers['x-request-id'] as string) ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Algo deu errado. Tente novamente.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = Array.isArray(b.message) ? b.message.join('; ') : String(b.message ?? message);
      }
      code = this.codeFromStatus(status);
    } else if (this.isDomainError(exception)) {
      // erros de regra de negócio → 422 com código próprio (docs/12)
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = exception.code;
      message = exception.message;
    }

    response.status(status).json({ error: { code, message, traceId } });
  }

  private isDomainError(e: unknown): e is Error & { code: string } {
    return e instanceof Error && typeof (e as { code?: unknown }).code === 'string';
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
