import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

/** 消息模块。imports AuthModule 鉴权。 */
@Module({
  imports: [AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService]
})
export class MessagesModule {}
