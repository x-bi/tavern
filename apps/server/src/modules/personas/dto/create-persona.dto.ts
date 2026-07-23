import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** 创建人设入参。除 name 外可选。 */
export class CreatePersonaDto {
  /** 人设名，必填，最长 120。 */
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(8000) coreIdentity?: string;
  @IsOptional() @IsString() @MaxLength(12000) background?: string;
  @IsOptional() @IsString() @MaxLength(8000) interactionPreferences?: string;

  /** 扩展元数据，可选任意对象。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** 是否设为默认，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** 是否标记为敏感内容，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
