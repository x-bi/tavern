import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** 创建独立 AI 角色。 */
export class CreateCompanionDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  identityPrompt?: string;
  @IsOptional() @IsString() @MaxLength(12000) coreIdentity?: string;
  @IsOptional() @IsString() @MaxLength(12000) personality?: string;
  @IsOptional() @IsString() @MaxLength(12000) speechStyle?: string;
  @IsOptional() @IsString() @MaxLength(12000) relationshipDefaults?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  avatarAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelFallbackGroupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  promptPresetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  personaId?: string | null;

  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
