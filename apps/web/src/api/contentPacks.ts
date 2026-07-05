/**
 * 内容包导入 API 封装（路由前缀 /content-packs）。
 *
 * 内容包导入是增量创建，不复用备份恢复的全量覆盖接口。
 */
import type { ContentPackDuplicateStrategy, ContentPackImportResponse } from '@tavern/shared';

import { requestJson } from './http';

/** 内容包导入失败时抛出的前端错误。 */
export class ContentPackClientError extends Error {
  constructor(
    message: string,
    /** 业务错误码。 */
    readonly code: string,
    /** 可选错误详情。 */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ContentPackClientError';
  }
}

/**
 * 导入内容包。POST /content-packs/import
 * @param rawJson 内容包原始 JSON 字符串。
 * @param options 导入选项：commit=false 预览，commit=true 正式落库。
 * @returns 内容包导入响应。
 * @throws ContentPackClientError 后端返回业务失败时抛出。
 */
export async function importContentPack(
  rawJson: string,
  options: {
    commit?: boolean;
    duplicateStrategy?: ContentPackDuplicateStrategy;
  } = {}
): Promise<ContentPackImportResponse> {
  const response = await requestJson<ContentPackImportResponse>('/content-packs/import', {
    method: 'POST',
    body: {
      rawJson,
      commit: options.commit ?? false,
      duplicateStrategy: options.duplicateStrategy ?? 'reject'
    }
  });

  if (!response.success) {
    throw new ContentPackClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}
