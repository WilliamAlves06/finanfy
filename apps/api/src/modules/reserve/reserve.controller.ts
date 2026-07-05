import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsPositive } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReserveService } from './reserve.service';

class DepositDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents: number;
}

class WithdrawDto extends DepositDto {
  @IsIn(['APENAS', 'PAGAR_CONTA'], { message: 'Informe o destino: APENAS ou PAGAR_CONTA.' })
  destination: 'APENAS' | 'PAGAR_CONTA';
}

@ApiTags('reserve')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reserve')
export class ReserveController {
  constructor(private readonly reserve: ReserveService) {}

  @Get()
  balance(@CurrentUser() userId: string) {
    return this.reserve.getBalance(userId);
  }

  @Post('deposit')
  @HttpCode(200)
  deposit(@CurrentUser() userId: string, @Body() dto: DepositDto) {
    return this.reserve.deposit(userId, dto.amountCents);
  }

  @Post('withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() userId: string, @Body() dto: WithdrawDto) {
    return this.reserve.withdraw(userId, dto.amountCents, dto.destination);
  }

  @Get('movements')
  movements(@CurrentUser() userId: string) {
    return this.reserve.listMovements(userId);
  }
}
