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

/** 创建预设入参。除 name 外可选。 */
export class CreatePromptPresetDto {
  /** 预设名，必填，最长 120。 */
  @IsString()
  @MaxLength(120)
  name!: string;

  /** 描述，可选，最长 500。 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 输出规则，可选，最长 4000。 */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outputRules?: string;

  /** 采样温度 0~2，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /** top_p 0~1，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  /** 最大 token 数 1~200000，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  /** 是否设为默认，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
