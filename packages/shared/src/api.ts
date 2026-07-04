/** 失败响应里 error 字段的错误信息体。 */
export type ApiError = {
  /** 业务错误码，稳定字符串（见后端 ERROR_CODES）。 */
  code: string;
  /** 给人看的错误描述。 */
  message: string;
  /** 可选补充详情，如校验失败的字段列表。 */
  details?: unknown;
};

/**
 * 统一 API 响应体：成功或失败二选一。
 *
 * 成功：`success: true`，`data` 有值，`error: null`。
 * 失败：`success: false`，`data: null`，`error` 为错误信息体。
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: ApiError;
    };
