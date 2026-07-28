import { IsIn, IsOptional } from 'class-validator';

import { AI_IMPORT_MODES, AI_IMPORT_TARGETS } from '../ai-import.types';

export class QueryAiImportOptionsDto {
  @IsOptional()
  @IsIn(AI_IMPORT_TARGETS)
  target?: (typeof AI_IMPORT_TARGETS)[number];

  @IsOptional()
  @IsIn(AI_IMPORT_MODES)
  mode?: (typeof AI_IMPORT_MODES)[number];
}
