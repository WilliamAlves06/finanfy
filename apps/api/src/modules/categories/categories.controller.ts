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
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';

class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['INCOME', 'EXPENSE', 'BOTH'])
  kind: 'INCOME' | 'EXPENSE' | 'BOTH';
}

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.categories.list(userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body() dto: { name: string }) {
    return this.categories.update(userId, id, { name: dto.name });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.categories.remove(userId, id);
  }
}
