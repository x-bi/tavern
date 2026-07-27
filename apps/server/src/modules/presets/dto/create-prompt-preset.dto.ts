import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

import { PROMPT_PRESET_GENERATION_PURPOSES } from '../preset-constants';

import { PromptPresetOutputRuleOperationDto } from './prompt-preset-output-rule-operation.dto';

/** 创建预设入参。V2 的三个数组字段必须显式提交，空数组表示明确禁用。 */
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

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
      : value
  )
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/\S/, { each: true, message: 'instructions must not contain blank items.' })
  @MaxLength(2000, { each: true })
  instructions!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((item: PromptPresetOutputRuleOperationDto) =>
    typeof item?.key === 'string' ? item.key.trim() : item?.key
  )
  @ValidateNested({ each: true })
  @Type(() => PromptPresetOutputRuleOperationDto)
  outputRuleOperations!: PromptPresetOutputRuleOperationDto[];

  @IsArray()
  @ArrayMaxSize(PROMPT_PRESET_GENERATION_PURPOSES.length)
  @ArrayUnique()
  @IsIn([...PROMPT_PRESET_GENERATION_PURPOSES], { each: true })
  generationPurposes!: string[];

  /** 采样温度 0~2，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number | null;

  /** topP（核采样）0~1，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number | null;

  /** 最大 token 数 1~200000，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number | null;

  /** 单次模型请求超时（毫秒）1000~600000，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeout?: number | null;

  /** 频率惩罚 -2~2，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number | null;

  /** 存在惩罚 -2~2，可选。 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number | null;

  /** 是否设为默认，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** 是否标记为敏感内容，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
