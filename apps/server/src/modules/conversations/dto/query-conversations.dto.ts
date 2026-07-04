import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 会话列表查询入参（query string）。 */
export class QueryConversationsDto {
  /** 页码，从 1 开始，默认 1。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 每页条数，1~100，默认 20。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /** 搜索关键字，匹配 title 或关联角色 name 包含。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** 按角色 ID 过滤。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  characterId?: string;

  /** 按模型配置 ID 过滤。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  modelConfigId?: string;

  /** 按预设 ID 过滤。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  promptPresetId?: string;

  /** 按人设 ID 过滤。 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  personaId?: string;

  /** 按状态过滤 active/archived。 */
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;
}
