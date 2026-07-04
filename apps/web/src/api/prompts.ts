/**
 * Prompt 预览 API 封装（路由前缀 /prompts）。
 *
 * 类型直接复用 shared 包的 PromptPreviewPayload / PromptPreviewResponse，
 * 这里只做请求与错误转换。
 */
import { requestJson } from './http';
import type { PromptPreviewPayload, PromptPreviewResponse } from '@tavern/shared';

/** Prompt 预览请求入参（shared 类型别名）。 */
export type PromptPreviewRequest = PromptPreviewPayload;
/** Prompt 预览响应（shared 类型别名）。 */
export type PromptPreview = PromptPreviewResponse;

/**
 * API 客户端错误：后端返回失败响应（success=false）时抛出。
 *
 * 携带业务错误码与可选详情，供调用方（store / 组件）转成用户可见提示。
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    /** 业务错误码。 */
    readonly code: string,
    /** 可选补充详情。 */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * 生成 Prompt 预览。POST /prompts/preview
 * @param payload 预览入参（会话 ID + 模拟用户输入）。
 * @returns Prompt 预览响应（含段落、最终消息、世界书调试等）。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function previewPrompt(payload: PromptPreviewRequest): Promise<PromptPreview> {
  const response = await requestJson<PromptPreviewResponse>('/prompts/preview', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}
