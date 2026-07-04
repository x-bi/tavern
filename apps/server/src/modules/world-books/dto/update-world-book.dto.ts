import { Type } from 'class-transformer';
import {
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

  /** 关联角色 ID；传 null 表示全局。 */
  @IsOptional()
  @IsString()
  characterId?: string | null;

  /** 描述。 */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  /** 是否启用。 */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

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
