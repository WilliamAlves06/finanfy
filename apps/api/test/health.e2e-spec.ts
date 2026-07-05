import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HealthModule } from '../src/modules/health/health.module';

// controller de apoio p/ testar o filtro global
@Controller('boom')
class BoomController {
  @Get('http')
  http(): never {
    throw new HttpException('Não encontrado', HttpStatus.NOT_FOUND);
  }

  @Get('domain')
  domain(): never {
    const err = new Error('Receitas só podem ser registradas no dia de hoje.');
    (err as Error & { code: string }).code = 'RETROACTIVE_NOT_ALLOWED';
    throw err;
  }
}

@Module({ imports: [HealthModule], controllers: [BoomController] })
class TestAppModule {}

describe('API base (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('HttpException vira formato de erro padrão', async () => {
    const res = await request(app.getHttpServer()).get('/boom/http').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.traceId).toBeDefined();
  });

  it('erro de domínio vira 422 com código próprio', async () => {
    const res = await request(app.getHttpServer()).get('/boom/domain').expect(422);
    expect(res.body.error.code).toBe('RETROACTIVE_NOT_ALLOWED');
    expect(res.body.error.message).toContain('hoje');
  });
});
