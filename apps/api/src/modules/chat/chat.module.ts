import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CardsModule } from '../cards/cards.module';
import { ClientsModule } from '../clients/clients.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { IncomesModule } from '../incomes/incomes.module';
import { RecurringModule } from '../recurring/recurring.module';
import { ReportsModule } from '../reports/reports.module';
import { ReserveModule } from '../reserve/reserve.module';
import { ActionExecutorService } from './action-executor.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    AiModule,
    IncomesModule,
    ExpensesModule,
    ReserveModule,
    ReportsModule,
    ClientsModule,
    CardsModule,
    RecurringModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ActionExecutorService],
  exports: [ChatService],
})
export class ChatModule {}
