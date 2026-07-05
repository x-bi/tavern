import { Module } from '@nestjs/common';

import { PromptBuilderModule } from '../../services/prompt-builder/prompt-builder.module';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { WorldBooksModule } from '../world-books/world-books.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

/**
 * Prompt 预览模块。
 *
 * imports PromptBuilderModule（构建 prompt）和 WorldBooksModule（取世界书上下文）。
 */
@Module({
  imports: [AuthModule, PromptBuilderModule, SettingsModule, WorldBooksModule],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService]
})
export class PromptsModule {}
