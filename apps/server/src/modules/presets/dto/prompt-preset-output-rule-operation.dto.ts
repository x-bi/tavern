import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

import { PROMPT_PRESET_OUTPUT_RULE_OPERATIONS } from '../preset-constants';

/**
 * 单条 outputRuleOperations 元素的嵌套校验 DTO（见清理方案 §5.6）。
 *
 * 与导入侧 validatePresetOutputRuleOperations 校验口径一致：key/content 非空、
 * operation 取自 shared 白名单、sortOrder 为整数。
 */
export class PromptPresetOutputRuleOperationDto {
  /** 规则键，最长 120。 */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/, { message: 'key must contain non-whitespace characters.' })
  @MaxLength(120)
  key!: string;

  /** 规则正文，最长 4000。 */
  @IsString()
  @MaxLength(4000)
  content!: string;

  /** 操作类型，取自 shared 白名单。 */
  @IsIn([...PROMPT_PRESET_OUTPUT_RULE_OPERATIONS])
  operation!: (typeof PROMPT_PRESET_OUTPUT_RULE_OPERATIONS)[number];

  /** 排序序号，>=0。 */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
