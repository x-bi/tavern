import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Companion 流式聊天；新消息和重新生成二选一。 */
export class StreamCompanionChatDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(12000)
  userMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  regenerateMessageId?: string;
}

/** Companion Prompt 预览。 */
export class PreviewCompanionPromptDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(12000)
  userMessage!: string;
}
