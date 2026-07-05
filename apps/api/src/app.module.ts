import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // pino-pretty apenas em dev; em prod: JSON puro p/ agregadores
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'], // nunca logar tokens — docs/09
      },
    }),
    // rate limit global (100 req/min); rotas sensíveis têm limites próprios — docs/09
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
