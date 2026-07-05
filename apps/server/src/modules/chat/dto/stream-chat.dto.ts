import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

/** 流式聊天入参。userMessage 和 regenerateMessageId 二选一。 */
export class StreamChatDto {
  /** 目标会话 ID，必填。 */
  @IsString()
  @MaxLength(128)
  conversationId!: string;

  /**
   * 用户消息内容，可选（重新生成模式下可不传）。
   * 非空时必须含非空白字符（@Matches(/\S/)）。
   */
  @IsString()
  @IsOptional()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(12000)
  userMessage?: string;

  /** 重新生成的目标消息 ID；传此字段则走重新生成流程，不传 userMessage。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  regenerateMessageId?: string;

  /** 指定模型链 ID，覆盖会话绑定的；传 null 用会话默认。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelFallbackGroupId?: string | null;

  /** 指定模型配置 ID，覆盖会话绑定的；传 null 用会话默认。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string | null;

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
}
