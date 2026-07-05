/**
 * 应用设置 API 封装（路由前缀 /settings）。
 *
 * 注意：设置接口是可选功能，后端未启用时 GET /settings 返回 404，
 * 由本模块转成 SettingsApiUnsupportedError 供上层降级处理。
 * 因需要区分 404 与普通失败，这里用原生 fetch 而非 requestJson。
 */
import type { ApiResponse, ApplicationSettings, ApplicationSettingsPayload } from '@tavern/shared';

import { toApiUrl } from './http';

export type { ApplicationSettings, ApplicationSettingsPayload };

/**
 * 后端未启用设置 API 时抛出（GET /settings 返回 404）。
 * 上层据此隐藏设置入口或降级为本地默认值。
 */
export class SettingsApiUnsupportedError extends Error {
  constructor() {
    super('当前后端未启用设置 API。');
    this.name = 'SettingsApiUnsupportedError';
  }
}

/**
 * 设置请求失败错误：响应非 404 但请求未成功时抛出。
 * 携带业务错误码与可选详情。
 */
export class SettingsClientError extends Error {
  constructor(
    message: string,
    /** 业务错误码；响应体不可解析时用 HTTP_<状态码>。 */
    readonly code: string,
    /** 可选补充详情。 */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'SettingsClientError';
  }
}

/**
 * 读取应用设置。GET /settings
 * @returns 应用设置。
 * @throws SettingsApiUnsupportedError 后端未启用设置 API（404）。
 * @throws SettingsClientError 请求失败时抛出。
 */
export async function fetchApplicationSettings(): Promise<ApplicationSettings> {
  const response = await fetch(toApiUrl('/settings'), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  return parseSettingsResponse(response);
}

/**
 * 更新应用设置。PUT /settings
 * @param payload 新的设置值。
 * @returns 更新后的应用设置。
 * @throws SettingsApiUnsupportedError 后端未启用设置 API（404）。
 * @throws SettingsClientError 请求失败时抛出。
 */
export async function updateApplicationSettings(
  payload: ApplicationSettingsPayload
): Promise<ApplicationSettings> {
  const response = await fetch(toApiUrl('/settings'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseSettingsResponse(response);
}

/**
 * 统一解析设置响应：404 降级为 unsupported，其余按成功/失败分流。
 *
 * 流程：404 → SettingsApiUnsupportedError →
 * 其余情况解析为 ApiResponse → 非 ok 或 success=false → SettingsClientError →
 * 成功返回 data。
 *
 * @param settings 模块发出的 fetch Response。
 * @returns 应用设置。
 */
async function parseSettingsResponse(response: Response): Promise<ApplicationSettings> {
  // 404：后端未启用设置 API，转成专用错误供上层降级
  if (response.status === 404) {
    throw new SettingsApiUnsupportedError();
  }

  const payload = (await response.json()) as ApiResponse<ApplicationSettings>;

  // 非 ok（HTTP 层失败）或 success=false（业务层失败）都视为请求失败
  if (!response.ok || !payload.success) {
    throw new SettingsClientError(
      payload.success ? '设置 API 请求失败。' : payload.error.message,
      payload.success ? `HTTP_${response.status}` : payload.error.code,
      payload.success ? undefined : payload.error.details
    );
  }

  return payload.data;
}
