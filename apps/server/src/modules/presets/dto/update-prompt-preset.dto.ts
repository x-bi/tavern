import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

/** 更新预设入参，全部可选（部分更新）。 */
export class UpdatePromptPresetDto {
  /** 预设名。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** 描述。 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 输出规则。 */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outputRules?: string;

  /** 采样温度 0~2。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /** top_p 0~1。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  /** 最大 token 数 1~200000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  /** 是否设为默认。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** 是否标记为敏感内容。 */
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}
