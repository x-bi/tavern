import type { ApiResponse } from '@tavern/shared';

/** 支持的 HTTP 方法。 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** requestJson 的请求选项。 */
export type HttpRequestOptions = {
  /** HTTP 方法，默认 GET。 */
  method?: HttpMethod;
  /** 附加请求头；会与默认的 Content-Type 合并。 */
  headers?: HeadersInit;
  /** 请求体，会被 JSON.stringify；undefined 时不发送 body。 */
  body?: unknown;
  /** 中止信号，用于取消请求（如聊天流被手动中止）。 */
  signal?: AbortSignal;
};

/** API 基础路径，取自环境变量 VITE_API_BASE_URL，默认 /api。 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * 把业务路径拼成完整 API URL。
 * @param path 业务路径，如 /characters；返回如 /api/characters。
 */
export function toApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * 发起 JSON 请求并解析为统一响应体。
 *
 * 默认带 Content-Type: application/json；body 为 undefined 时不发送请求体（用于 GET）。
 * 注意：本方法不处理 success/error 分支，由各业务封装函数检查 response.success 后决定返回 data 或抛错。
 *
 * @param path 业务路径，如 /characters。
 * @param options 请求选项。
 * @returns 后端统一响应体 ApiResponse<T>（含 success/data/error）。
 */
export async function requestJson<T>(
  path: string,
  options: HttpRequestOptions = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(toApiUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal
  });

  return response.json() as Promise<ApiResponse<T>>;
}
