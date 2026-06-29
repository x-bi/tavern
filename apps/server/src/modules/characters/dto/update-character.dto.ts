import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

import { ExampleMessageDto } from './example-message.dto';

export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  avatarAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  personality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scenario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  firstMessage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleMessageDto)
  exampleMessages?: ExampleMessageDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
