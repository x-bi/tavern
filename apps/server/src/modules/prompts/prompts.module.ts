import { Module } from '@nestjs/common';

import { PromptBuilderModule } from '../../services/prompt-builder/prompt-builder.module';
import { AuthModule } from '../auth/auth.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

@Module({
  imports: [AuthModule, PromptBuilderModule],
  controllers: [PromptsController],
  providers: [PromptsService],
  exports: [PromptsService]
})
export class PromptsModule {}
