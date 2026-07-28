import { IsIn, IsString } from 'class-validator';

import { AI_IMPORT_TARGETS } from '../ai-import.types';

export class ValidateAiImportDto {
  @IsIn(AI_IMPORT_TARGETS)
  target!: (typeof AI_IMPORT_TARGETS)[number];

  @IsString()
  rawJson!: string;
}
