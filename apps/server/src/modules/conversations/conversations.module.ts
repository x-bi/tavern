import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/** 会话模块。imports AuthModule 鉴权。 */
@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService]
})
export class ConversationsModule {}
