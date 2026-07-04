import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 导入角色卡 JSON 入参。
 *
 * 支持两阶段导入：
 * - commit=false（或不传）：仅解析返回预览，不落库；
 * - commit=true：正式落库，若名称冲突按 duplicateNameStrategy 处理。
 */
export class ImportCharacterDto {
  /** 原始角色卡 JSON 文本，最长 100 万字符。 */
  @IsString()
  @MaxLength(1_000_000)
  rawJson!: string;

  /** 是否正式提交导入；不传默认 false（仅预览）。 */
  @IsOptional()
  @IsBoolean()
  commit?: boolean;

  /**
   * 名称冲突策略：
   * - 'reject'（默认）：冲突时报错，返回建议名；
   * - 'rename'：冲突时改用 suggestedName 继续导入。
   */
  @IsOptional()
  @IsIn(['reject', 'rename'])
  duplicateNameStrategy?: 'reject' | 'rename';
}
