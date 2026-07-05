import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Matches } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';

class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  targetCents: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string;
}

class ContributeDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountCents: number;
}

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateGoalDto) {
    return this.goals.create(userId, dto);
  }

  @Get()
  list(@CurrentUser() userId: string) {
    return this.goals.list(userId);
  }

  @Post(':id/contributions')
  @HttpCode(200)
  contribute(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: ContributeDto) {
    return this.goals.contribute(userId, id, dto.amountCents);
  }
}
