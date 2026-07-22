import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

/** 创建世界书入参。除 name 外可选。 */
export class CreateWorldBookDto {
  /** 世界书名，必填，最长 120。 */
  @IsString()
  @MaxLength(120)
  name!: string;

  /** 关联角色 ID 列表；传空数组或省略表示全局世界书。 */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  characterIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  personaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  conversationIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  companionIds?: string[];

  /** 描述，可选，最长 4000。 */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  /** 是否启用，可选，默认 true。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** 是否标记为敏感内容，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  /** 扫描深度 1~200，可选，默认 6。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  scanDepth?: number;

  /** token 预算 1~200000，可选，默认 1000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  tokenBudget?: number;

  /** 扩展元数据，可选。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
