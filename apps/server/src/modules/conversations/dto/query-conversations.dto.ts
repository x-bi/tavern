import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryConversationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  characterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  promptPresetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  personaId?: string;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;
}
