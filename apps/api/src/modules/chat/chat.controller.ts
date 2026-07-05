import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('messages')
  @HttpCode(200)
  send(@CurrentUser() userId: string, @Body() dto: SendMessageDto) {
    return this.chat.handleMessage(userId, dto.text, 'WEB');
  }

  @Get('messages')
  history(@CurrentUser() userId: string) {
    return this.chat.history(userId, 'WEB');
  }
}
