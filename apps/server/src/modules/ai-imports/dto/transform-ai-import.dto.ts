import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { AI_IMPORT_MODES, AI_IMPORT_TARGETS } from '../ai-import.types';

export class TransformAiImportDto {
  @IsIn(AI_IMPORT_TARGETS)
  target!: (typeof AI_IMPORT_TARGETS)[number];

  @IsString()
  modelFallbackGroupId!: string;

  @IsString()
  sourceText!: string;

  @IsIn(AI_IMPORT_MODES)
  mode!: (typeof AI_IMPORT_MODES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  generalStrategyIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  moduleStrategyIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customInstructions?: string;
}
