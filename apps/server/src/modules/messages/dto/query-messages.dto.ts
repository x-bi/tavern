import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 消息列表查询入参（query string）。 */
export class QueryMessagesDto {
  /** 页码，从 1 开始，默认 1。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 每页条数，1~200，默认 50（消息通常比角色等多）。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;

  /** 排序方向，默认 asc（时间正序，对话顺序）。 */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';

  /** 按角色过滤 system/user/assistant/tool。 */
  @IsOptional()
  @IsIn(['system', 'user', 'assistant', 'tool'])
  role?: string;

  /** 按状态过滤（如 complete/failed）。 */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  /** 搜索关键字，匹配 content 包含。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
