import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() userId: string) {
    return this.reports.summary(userId);
  }

  @Get('can-spend')
  canSpend(@CurrentUser() userId: string) {
    return this.reports.canSpend(userId);
  }

  @Get('monthly')
  monthly(@CurrentUser() userId: string, @Query('month') month?: string) {
    return this.reports.monthly(userId, month);
  }

  @Get('overdue')
  overdue(@CurrentUser() userId: string) {
    return this.reports.overdue(userId);
  }

  @Get('savings')
  savings(@CurrentUser() userId: string, @Query('year') year?: string) {
    return this.reports.savings(userId, year ? Number(year) : undefined);
  }
}
