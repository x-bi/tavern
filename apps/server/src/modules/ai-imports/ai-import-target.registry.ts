import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { CharactersService } from '../characters/characters.service';
import { CompanionsService } from '../companions/companions.service';
import { PersonasService } from '../personas/personas.service';
import { PresetsService } from '../presets/presets.service';
import { WorldBooksService } from '../world-books/world-books.service';
import type { CurrentUser } from '../users/user.types';
import type {
  AiImportPromptSpecification,
  AiImportTarget,
  AiImportTargetAdapter
} from './ai-import.types';

type ImportService = {
  getImportTemplate(): { template: object };
  getImportSpecification(): AiImportPromptSpecification;
  importJson(
    currentUser: CurrentUser,
    dto: { rawJson: string; commit?: boolean; duplicateNameStrategy?: 'reject' | 'rename' }
  ): Promise<{ preview: unknown }>;
};

@Injectable()
export class AiImportTargetRegistry {
  private readonly adapters: Map<AiImportTarget, AiImportTargetAdapter>;

  constructor(
    @Inject(CharactersService) characters: CharactersService,
    @Inject(PersonasService) personas: PersonasService,
    @Inject(PresetsService) presets: PresetsService,
    @Inject(WorldBooksService) worldBooks: WorldBooksService,
    @Inject(CompanionsService) companions: CompanionsService
  ) {
    this.adapters = new Map([
      this.createAdapter('character', characters),
      this.createAdapter('persona', personas),
      this.createAdapter('prompt_preset', presets),
      this.createAdapter('world_book', worldBooks),
      this.createAdapter('companion', companions)
    ]);
  }

  get(target: AiImportTarget): AiImportTargetAdapter {
    const adapter = this.adapters.get(target);
    if (!adapter) {
      throw new BadRequestException({
        code: ERROR_CODES.AI_IMPORT_TARGET_UNSUPPORTED,
        message: `Unsupported AI import target: ${target}.`
      });
    }
    return adapter;
  }

  private createAdapter(
    target: AiImportTarget,
    service: ImportService
  ): [AiImportTarget, AiImportTargetAdapter] {
    return [
      target,
      {
        target,
        getImportTemplate: () => service.getImportTemplate().template as Record<string, unknown>,
        getImportSpecification: () => service.getImportSpecification(),
        previewImport: async (currentUser, rawJson) =>
          (await service.importJson(currentUser, { rawJson, commit: false })).preview
      }
    ];
  }
}
