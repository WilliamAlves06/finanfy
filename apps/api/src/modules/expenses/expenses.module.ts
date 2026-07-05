import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { ReserveModule } from '../reserve/reserve.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [ReserveModule, CardsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
