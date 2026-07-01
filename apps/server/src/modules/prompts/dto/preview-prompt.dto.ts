import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PreviewPromptDto {
  @IsString()
  @MaxLength(128)
  conversationId!: string;

  @IsString()
  @MaxLength(12000)
  userInput!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  historyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000)
  maxHistoryCharacters?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  supportsDeveloperRole?: boolean;
}
