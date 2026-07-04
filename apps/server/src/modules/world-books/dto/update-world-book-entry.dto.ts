import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

import { WORLD_BOOK_ENTRY_INSERTION_ORDERS } from '../world-books.constants';

/** 更新世界书条目入参，全部可选（部分更新）。 */
export class UpdateWorldBookEntryDto {
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

  /** 优先级 -10000~10000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-10000)
  @Max(10000)
  priority?: number;

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

  /** 关键词是否区分大小写。 */
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  /** 扩展元数据，传入则整体替换。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
