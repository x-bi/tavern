import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 更新消息入参，全部可选（部分更新）。 */
export class UpdateMessageDto {
  /** 消息内容，最长 50000；仅 user 消息可编辑。 */
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  /** 状态 complete/edited/failed/stopped；未传且 content 变化时自动标 edited。 */
  @IsOptional()
  @IsIn(['complete', 'edited', 'failed', 'stopped'])
  status?: string;

  /** 扩展元数据，传入则整体替换。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  /** token 数，0~2000000；传 null 清空。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000000)
  tokenCount?: number | null;
}
