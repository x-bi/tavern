import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/** 内容包导入入参，支持预览和正式提交两阶段。 */
export class ImportContentPackDto {
  /** 原始内容包 JSON 文本；大小上限由 REQUEST_BODY_LIMIT 统一控制。 */
  @IsString()
  rawJson!: string;

  /** 是否正式提交导入；不传默认 false，仅返回预览。 */
  @IsOptional()
  @IsBoolean()
  commit?: boolean;

  /**
   * 同名冲突处理策略。
   * - `reject`：发现同名资源即拒绝正式导入；
   * - `rename`：自动追加序号生成可用名称；
   * - `skip`：跳过冲突资源及其依赖资源。
   */
  @IsOptional()
  @IsIn(['reject', 'rename', 'skip'])
  duplicateStrategy?: 'reject' | 'rename' | 'skip';
}
