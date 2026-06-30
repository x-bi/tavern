import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(128)
  characterId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  promptPresetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  personaId?: string | null;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
