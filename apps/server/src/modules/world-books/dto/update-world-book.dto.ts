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

/** 更新世界书入参，全部可选（部分更新）。 */
export class UpdateWorldBookDto {
  /** 世界书名。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** 关联角色 ID 列表；传空数组表示全局。 */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  characterIds?: string[];

  /** 描述。 */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  /** 是否启用。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** 是否标记为敏感内容。 */
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  /** 扫描深度 1~200。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  scanDepth?: number;

  /** token 预算 1~200000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  tokenBudget?: number;

  /** 扩展元数据，传入则整体替换。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
