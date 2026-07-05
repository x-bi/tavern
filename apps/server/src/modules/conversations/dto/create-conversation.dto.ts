import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** 创建会话入参。title 和 characterId 必填，关联 ID 可选。 */
export class CreateConversationDto {
  /** 会话标题，必填，最长 160。 */
  @IsString()
  @MaxLength(160)
  title!: string;

  /** 关联角色 ID，必填。 */
  @IsString()
  @MaxLength(128)
  characterId!: string;

  /** 关联模型配置 ID，可选；传 null 表示不绑定。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string | null;

  /** 关联模型链 ID，可选；传 null 表示不绑定。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelFallbackGroupId?: string | null;

  /** 关联预设 ID，可选。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  promptPresetId?: string | null;

  /** 关联人设 ID，可选。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  personaId?: string | null;

  /** 状态，可选 active/archived，默认 active。 */
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;

  /** 扩展元数据，可选。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
