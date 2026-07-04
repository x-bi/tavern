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

/** 创建角色入参。除 name 外均为可选，不传时落库为默认值（空串 / false / 不设头像）。 */
export class CreateCharacterDto {
  /** 头像素材 ID；可传 null 表示显式清空头像，不传则不设。 */
  @IsOptional()
  @IsString()
  avatarAssetId?: string | null;

  /** 角色名，必填，最长 120 字符。 */
  @IsString()
  @MaxLength(120)
  name!: string;

  /** 角色描述，可选，最长 10000。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  /** 性格设定，可选。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  personality?: string;

  /** 场景设定，可选。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scenario?: string;

  /** 开场白，可选。 */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  firstMessage?: string;

  /** 示例对话数组，可选；每项经 ExampleMessageDto 嵌套校验。 */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleMessageDto)
  exampleMessages?: ExampleMessageDto[];

  /** 扩展元数据，可选任意对象。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** 是否归档，可选，默认 false。 */
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
