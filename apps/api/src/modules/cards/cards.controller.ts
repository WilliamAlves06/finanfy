import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CardsService } from './cards.service';

class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limitCents: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  closingDay: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay: number;
}

class UpdateCardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limitCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  closingDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;
}

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateCardDto) {
    return this.cards.create(userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: UpdateCardDto) {
    return this.cards.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.cards.remove(userId, id);
  }

  @Get()
  list(@CurrentUser() userId: string) {
    return this.cards.list(userId);
  }

  @Get(':id')
  get(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.cards.getById(userId, id);
  }

  @Get(':id/invoices')
  invoices(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.cards.listInvoices(userId, id);
  }
}
