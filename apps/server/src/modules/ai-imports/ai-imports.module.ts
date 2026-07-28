import { Module } from '@nestjs/common';

import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { CharactersModule } from '../characters/characters.module';
import { CompanionsModule } from '../companions/companions.module';
import { ModelsModule } from '../models/models.module';
import { PersonasModule } from '../personas/personas.module';
import { PresetsModule } from '../presets/presets.module';
import { WorldBooksModule } from '../world-books/world-books.module';
import { AiImportPromptFactory } from './ai-import-prompt.factory';
import { AiImportFileInterceptor } from './ai-import-file.interceptor';
import { AiImportRepairPromptFactory } from './ai-import-repair-prompt.factory';
import { AiImportStrategyRegistry } from './ai-import-strategy.registry';
import { AiImportTargetRegistry } from './ai-import-target.registry';
import { AiImportsController } from './ai-imports.controller';
import { AiImportsService } from './ai-imports.service';

@Module({
  imports: [
    AuthModule,
    ModelsModule,
    ModelGatewayModule,
    CharactersModule,
    PersonasModule,
    PresetsModule,
    WorldBooksModule,
    CompanionsModule
  ],
  controllers: [AiImportsController],
  providers: [
    AiImportsService,
    AiImportFileInterceptor,
    AiImportStrategyRegistry,
    AiImportTargetRegistry,
    AiImportPromptFactory,
    AiImportRepairPromptFactory
  ]
})
export class AiImportsModule {}
