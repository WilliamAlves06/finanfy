import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { RecurringModule } from '../recurring/recurring.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [ChannelsModule, RecurringModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
