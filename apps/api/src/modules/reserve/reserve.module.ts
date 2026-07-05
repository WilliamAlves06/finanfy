import { Module } from '@nestjs/common';
import { ReserveController } from './reserve.controller';
import { ReserveService } from './reserve.service';

@Module({
  controllers: [ReserveController],
  providers: [ReserveService],
  exports: [ReserveService],
})
export class ReserveModule {}
