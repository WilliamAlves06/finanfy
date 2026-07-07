import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExpensesService } from './expenses.service';

const METHODS = ['DINHEIRO', 'SALDO', 'CAIXINHA', 'CARTAO', 'PIX'] as const;

class CreateExpenseDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents: number;

  @IsIn(METHODS, { message: 'Como foi pago? DINHEIRO, SALDO, CAIXINHA, CARTAO ou PIX.' })
  method: (typeof METHODS)[number];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  cardId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  installments?: number;
}

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() userId: string, @Param('id') id: string) {
    const removed = await this.expenses.remove(userId, id);
    if (!removed) throw new NotFoundException('Despesa não encontrada.');
  }

  @Get()
  list(
    @CurrentUser() userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.expenses.list(userId, {
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
