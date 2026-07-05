import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 更新应用设置入参。 */
export class UpdateApplicationSettingsDto {
  /** 工作台名称。 */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  workspaceName?: string;

  /** 是否自动打开上次会话。 */
  @IsOptional()
  @IsBoolean()
  autoOpenLastConversation?: boolean;

  /** 是否启用紧凑列表模式。 */
  @IsOptional()
  @IsBoolean()
  compactListMode?: boolean;

  /** 默认历史消息条数上限。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  defaultHistoryLimit?: number;

  /** 是否显示并允许使用敏感资源。 */
  @IsOptional()
  @IsBoolean()
  showSensitiveContent?: boolean;
}
