import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import { WORLD_BOOK_ENTRY_INSERTION_ORDERS } from '../world-books.constants';
const CONTENT_TYPES = ['lore', 'state', 'behavior_rule', 'reference'] as const;
const TRUST_LEVELS = [
  'system',
  'user_authored',
  'imported_untrusted',
  'user_confirmed_import'
] as const;
const ACTIVATION_MODES = ['constant', 'keyword', 'manual'] as const;
const MATCH_MODES = ['contains', 'normalized_phrase'] as const;
const SCAN_SOURCES = ['current_user', 'user_history', 'assistant_latest'] as const;
const GENERATION_PURPOSES = [
  'chat_reply',
  'regenerate',
  'continue',
  'user_suggestions',
  'memory_summary'
] as const;

/** 更新世界书条目入参，全部可选（部分更新）。 */
export class UpdateWorldBookEntryDto {
  @IsOptional() @IsIn(CONTENT_TYPES) contentType?: string;
  @IsOptional() @IsIn(TRUST_LEVELS) trustLevel?: string;
  @IsOptional() @IsIn(ACTIVATION_MODES) activationMode?: string;
  @IsOptional() @IsIn(MATCH_MODES) matchMode?: string;
  @IsOptional() @IsIn(['any', 'all']) primaryLogic?: string;
  @IsOptional() @IsIn(['and_any', 'and_all', 'not_any', 'not_all']) secondaryLogic?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) excludeKeywords?: string[];
  @IsOptional() @IsBoolean() sameMessageOnly?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SCAN_SOURCES, { each: true })
  scanSources?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) userHistoryScanDepth?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) stickyTurns?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) continuationTurns?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) cooldownTurns?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) delayTurns?: number;
  @IsOptional() @IsIn(['strict', 'current_user_override']) cooldownPolicy?: string;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(GENERATION_PURPOSES, { each: true })
  generationPurposes?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(-10000) @Max(10000) budgetPriority?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-10000) @Max(10000) sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(20000) compactContent?: string;
  /** 条目标题。 */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  /** 条目内容。 */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  /** 触发关键词，传入则整体替换。 */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  keywords?: string[];

  /** 次要关键词，传入则整体替换。 */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  secondaryKeywords?: string[];

  /** 是否启用。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** 插入位置。 */
  @IsOptional()
  @IsIn(WORLD_BOOK_ENTRY_INSERTION_ORDERS)
  insertionOrder?: string;

  /** 条目独立 token 预算。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  tokenBudget?: number | null;
}
