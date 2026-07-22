import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { SettingsModule } from '../settings/settings.module';
import { WorldBooksModule } from '../world-books/world-books.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

/**
 * Prompt 预览模块。
 *
 * 使用 Context Engine V2 构建并编译 prompt；ModelsModule 解析真实模型预算，
 * WorldBooksModule 提供世界书上下文。
 */
@Module({
  imports: [AuthModule, ModelsModule, SettingsModule, WorldBooksModule],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService]
})
export class PromptsModule {}
