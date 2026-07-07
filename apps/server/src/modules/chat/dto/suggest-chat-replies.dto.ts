import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 聊天候选用户发言入参。不会创建消息或写入会话历史。 */
export class SuggestChatRepliesDto {
  /** 目标会话 ID，必填。 */
  @IsString()
  @MaxLength(128)
  conversationId!: string;

  /** 指定模型链 ID，覆盖会话绑定的；传 null 用会话默认。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelFallbackGroupId?: string | null;

  /** 指定预设 ID；传 null 表示不绑定预设。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  presetId?: string | null;

  /** 历史消息条数上限，1~100。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  historyLimit?: number;

  /** 历史消息总字符上限，0~50000。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000)
  maxHistoryCharacters?: number;

  /** 候选条数，默认 3，最多 5。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  count?: number;
}
