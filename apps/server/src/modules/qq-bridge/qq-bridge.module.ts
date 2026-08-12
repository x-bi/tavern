import { Module } from '@nestjs/common';
import { TargetEventsModule } from '../../services/target-events/target-events.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { CompanionChatModule } from '../companion-chat/companion-chat.module';
import { QqBridgeController, QqEventController } from './qq-bridge.controller';
import { QqBridgeService } from './qq-bridge.service';
import { QqNapcatClient } from './qq-napcat.client';

@Module({
  imports: [AuthModule, ChatModule, CompanionChatModule, TargetEventsModule],
  controllers: [QqBridgeController, QqEventController],
  providers: [QqBridgeService, QqNapcatClient],
  exports: [QqBridgeService]
})
export class QqBridgeModule {}
