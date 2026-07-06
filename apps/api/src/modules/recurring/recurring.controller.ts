import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RecurringService } from './recurring.service';

class CreateBillDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay: number;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

class PayChargeDto {
  @IsIn(['DINHEIRO', 'SALDO', 'CAIXINHA', 'CARTAO', 'PIX'])
  method: 'DINHEIRO' | 'SALDO' | 'CAIXINHA' | 'CARTAO' | 'PIX';

  @IsOptional()
  @IsString()
  cardId?: string;
}

@ApiTags('recurring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Post('recurring-bills')
  createBill(@CurrentUser() userId: string, @Body() dto: CreateBillDto) {
    return this.recurring.createBill(userId, dto);
  }

  @Get('recurring-bills')
  listBills(@CurrentUser() userId: string) {
    return this.recurring.listBills(userId);
  }

  @Get('recurring-charges')
  listCharges(
    @CurrentUser() userId: string,
    @Query('status') status?: 'PENDING' | 'PAID' | 'OVERDUE',
  ) {
    return this.recurring.listCharges(userId, status);
  }

  @Post('recurring-charges/:id/pay')
  @HttpCode(200)
  pay(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: PayChargeDto) {
    return this.recurring.payCharge(userId, id, dto.method, dto.cardId);
  }
}
