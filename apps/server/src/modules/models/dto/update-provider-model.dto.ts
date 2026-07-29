import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

/** 更新供应商模型入参。所有字段可选。 */
export class UpdateProviderModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  providerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  modelName?: string;

  @IsOptional()
  @IsIn(['chat', 'image'])
  capability?: 'chat' | 'image';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeout?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000000)
  contextLength?: number | null;

  @IsOptional() @IsBoolean() supportsDeveloperRole?: boolean;
  @IsOptional() @IsString() systemPlacement?: 'initial_only' | 'midstream_allowed';
  @IsOptional() @IsBoolean() supportsMultipleSystemMessages?: boolean;
  @IsOptional() @IsBoolean() requiresAlternatingRoles?: boolean;
  @IsOptional() @IsString() @MaxLength(80) tokenizerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
