import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/** 单模块 JSON 导入入参，支持预览和正式提交两阶段。 */
export class ImportModuleJsonDto {
  /** 原始 JSON 文本；大小上限由 REQUEST_BODY_LIMIT 统一控制。 */
  @IsString()
  rawJson!: string;

  /** 是否正式提交导入；不传默认 false（仅预览）。 */
  @IsOptional()
  @IsBoolean()
  commit?: boolean;

  /**
   * 同名冲突策略：
   * - `reject`：冲突时报错；
   * - `rename`：冲突时自动使用 suggestedName。
   */
  @IsOptional()
  @IsIn(['reject', 'rename'])
  duplicateNameStrategy?: 'reject' | 'rename';
}
