import { Module } from '@nestjs/common';

import { ModelGatewayModule } from '../../services/model-gateway';
import { PromptBuilderModule } from '../../services/prompt-builder/prompt-builder.module';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { SettingsModule } from '../settings/settings.module';
import { WorldBooksModule } from '../world-books/world-books.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/**
 * 聊天模块。
 *
 * imports 各依赖服务模块：鉴权、模型配置、模型网关、prompt 构建、世界书。
 */
@Module({
  imports: [
    AuthModule,
    ModelsModule,
    ModelGatewayModule,
    PromptBuilderModule,
    SettingsModule,
    WorldBooksModule
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService]
})
export class ChatModule {}
