import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class ConversationImageGenerationConfigDto {
  @IsIn(['auto', 'anime', 'realistic', 'cinematic', 'illustration', 'fantasy'])
  stylePreset!: 'auto' | 'anime' | 'realistic' | 'cinematic' | 'illustration' | 'fantasy';

  @IsInt()
  @Min(1)
  @Max(4)
  imageCount!: 1 | 2 | 3 | 4;

  @IsIn(['1:1', '3:4', '4:3', '9:16', '16:9'])
  aspectRatio!: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}

export class UpdateConversationImageGenerationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  imageModelFallbackGroupId!: string | null;

  @ValidateNested()
  @Type(() => ConversationImageGenerationConfigDto)
  config!: ConversationImageGenerationConfigDto;
}
