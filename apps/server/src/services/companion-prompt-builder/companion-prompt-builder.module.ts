import { Module } from '@nestjs/common';
import { CompanionPromptBuilderService } from './companion-prompt-builder.service';
@Module({ providers: [CompanionPromptBuilderService], exports: [CompanionPromptBuilderService] })
export class CompanionPromptBuilderModule {}
