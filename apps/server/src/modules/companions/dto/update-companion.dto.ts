import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** 更新独立 AI 角色；关联字段可传 null 解绑。 */
export class UpdateCompanionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  identityPrompt?: string;

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
