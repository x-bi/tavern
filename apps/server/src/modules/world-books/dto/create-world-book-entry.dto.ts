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

/** 创建世界书条目入参。title/content/keywords 必填，其余可选。 */
export class CreateWorldBookEntryDto {
  /** 条目标题，必填，最长 160。 */
  @IsString()
  @MaxLength(160)
  title!: string;

  /** 条目内容，必填，最长 20000。 */
  @IsString()
  @MaxLength(20000)
  content!: string;

  /** 触发关键词，必填，1~50 个，每个最长 120。 */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  keywords!: string[];

  /** 次要关键词，可选，最多 50 个。 */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  secondaryKeywords?: string[];

  /** 是否启用，可选，默认 true。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** 优先级 -10000~10000，可选，默认 0。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-10000)
  @Max(10000)
  priority?: number;

  /** 插入位置，可选，默认 before_history。 */
  @IsOptional()
  @IsIn(WORLD_BOOK_ENTRY_INSERTION_ORDERS)
  insertionOrder?: string;

  /** 条目独立 token 预算，可选；传 null 用世界书的。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  tokenBudget?: number | null;

  /** 关键词是否区分大小写，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  /** 扩展元数据，可选。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
