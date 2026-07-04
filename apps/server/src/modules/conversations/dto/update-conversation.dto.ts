import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** 更新会话入参，全部可选（部分更新）。关联 ID 传 null 表示解绑。 */
export class UpdateConversationDto {
  /** 会话标题。 */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  /** 关联角色 ID。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  characterId?: string;

  /** 关联模型配置 ID；传 null 解绑。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string | null;

  /** 关联预设 ID；传 null 解绑。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  promptPresetId?: string | null;

  /** 关联人设 ID；传 null 解绑。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  personaId?: string | null;

  /** 状态 active/archived。 */
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;

  /** 扩展元数据，传入则整体替换。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
