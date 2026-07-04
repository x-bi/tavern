import { Module } from '@nestjs/common';

import { PromptBuilderService } from './prompt-builder.service';

/** Prompt Builder 模块：提供并导出 PromptBuilderService。 */
@Module({
  providers: [PromptBuilderService],
  exports: [PromptBuilderService]
})
export class PromptBuilderModule {}
