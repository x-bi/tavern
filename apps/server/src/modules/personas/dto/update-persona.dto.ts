import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** 更新人设入参，全部可选（部分更新）。metadata 传则整体替换。 */
export class UpdatePersonaDto {
  /** 人设名。 */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** 人设内容。 */
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;

  /** 扩展元数据，传入则整体替换。 */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** 是否设为默认。 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
