import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ChatModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class ChannelsModule {}
