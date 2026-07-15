import { Module } from '@nestjs/common';
import { CompanionPromptBuilderModule } from '../../services/companion-prompt-builder/companion-prompt-builder.module';
import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { CompanionMemoryModule } from '../companion-memory/companion-memory.module';
import { ModelsModule } from '../models/models.module';
import { CompanionChatController } from './companion-chat.controller';
import { CompanionChatService } from './companion-chat.service';

@Module({
  imports: [
    AuthModule,
    ModelsModule,
    ModelGatewayModule,
    CompanionPromptBuilderModule,
    CompanionMemoryModule
  ],
  controllers: [CompanionChatController],
  providers: [CompanionChatService]
})
export class CompanionChatModule {}
