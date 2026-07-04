import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/** 会话模块。imports AuthModule 鉴权。 */
@Module({
  imports: [AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService]
})
export class ConversationsModule {}
