import { Module } from '@nestjs/common';
import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { CompanionMemoryModule } from '../companion-memory/companion-memory.module';
import { ModelsModule } from '../models/models.module';
import { SettingsModule } from '../settings/settings.module';
import { WorldBooksModule } from '../world-books/world-books.module';
import { CompanionChatController } from './companion-chat.controller';
import { CompanionChatService } from './companion-chat.service';

@Module({
  imports: [
    AuthModule,
    ModelsModule,
    ModelGatewayModule,
    CompanionMemoryModule,
    SettingsModule,
    WorldBooksModule
  ],
  controllers: [CompanionChatController],
  providers: [CompanionChatService],
  exports: [CompanionChatService]
})
export class CompanionChatModule {}
