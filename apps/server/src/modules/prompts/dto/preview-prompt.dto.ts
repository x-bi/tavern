import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Prompt 预览入参。 */
export class PreviewPromptDto {
  /** 目标会话 ID，必填。 */
  @IsString()
  @MaxLength(128)
  conversationId!: string;

  /** 模拟的用户输入，必填，最长 12000。 */
  @IsString()
  @MaxLength(12000)
  userInput!: string;

  /** 历史消息条数上限，0~100，不传用默认值。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  historyLimit?: number;

  /** 历史消息总字符上限，0~50000，不传用默认值。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000)
  maxHistoryCharacters?: number;

  /** 模型是否支持 developer 角色，可选。 */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  supportsDeveloperRole?: boolean;
}
