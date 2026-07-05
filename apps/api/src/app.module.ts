import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './common/audit/audit.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { ChatModule } from './modules/chat/chat.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { GoalsModule } from './modules/goals/goals.module';
import { HealthModule } from './modules/health/health.module';
import { IncomesModule } from './modules/incomes/incomes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RecurringModule } from './modules/recurring/recurring.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReserveModule } from './modules/reserve/reserve.module';

@Module({
  imports: [
    // .env da raiz do monorepo (dev) ou local; em prod usa env do host
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
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
    ScheduleModule.forRoot(), // crons: 18h receita, 8h vencimentos, mensal recorrentes
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    CategoriesModule,
    ClientsModule,
    IncomesModule,
    ExpensesModule,
    ReserveModule,
    CardsModule,
    RecurringModule,
    GoalsModule,
    ReportsModule,
    ChatModule,
    ChannelsModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
