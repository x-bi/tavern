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

export class StreamChatDto {
  @IsString()
  @MaxLength(128)
  conversationId!: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(12000)
  userMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  regenerateMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  presetId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  historyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000)
  maxHistoryCharacters?: number;
}
