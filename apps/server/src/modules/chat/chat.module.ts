import { Module } from '@nestjs/common';

import { ModelGatewayModule } from '../../services/model-gateway';
import { PromptBuilderModule } from '../../services/prompt-builder/prompt-builder.module';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, ModelsModule, ModelGatewayModule, PromptBuilderModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService]
})
export class ChatModule {}
