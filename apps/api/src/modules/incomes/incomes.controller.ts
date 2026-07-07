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
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Matches } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IncomesService } from './incomes.service';

const SOURCES = ['DIARIA', 'PIX', 'SALARIO', 'VENDA', 'OUTRO'] as const;

class CreateIncomeDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents: number;

  @IsIn(SOURCES, { message: 'Informe de onde veio: DIARIA, PIX, SALARIO, VENDA ou OUTRO.' })
  source: (typeof SOURCES)[number];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

@ApiTags('incomes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incomes')
export class IncomesController {
  constructor(private readonly incomes: IncomesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateIncomeDto) {
    return this.incomes.create(userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() userId: string, @Param('id') id: string) {
    const removed = await this.incomes.remove(userId, id);
    if (!removed) throw new NotFoundException('Receita não encontrada.');
  }

  @Get()
  list(
    @CurrentUser() userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.incomes.list(userId, {
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
