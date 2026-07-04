import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

import { ExampleMessageDto } from './example-message.dto';

/**
 * 更新角色入参。
 *
 * 全部字段可选 —— 部分更新语义：只有传入的字段才会被更新，未传的字段保持不变。
 * （服务端用 `field === undefined ? {} : { field }` 模式按需展开写入。）
 */
export class UpdateCharacterDto {
  /** 头像素材 ID；传 null 清空头像，不传保持原值。 */
  @IsOptional()
  @IsString()
  avatarAssetId?: string | null;

  /** 角色名。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** 角色描述。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /** 性格设定。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  personality?: string;

  /** 场景设定。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scenario?: string;

  /** 开场白。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  firstMessage?: string;

  /** 示例对话数组，传入则整体替换。 */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleMessageDto)
  exampleMessages?: ExampleMessageDto[];

  /** 扩展元数据，传入则整体替换。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** 是否归档。 */
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
