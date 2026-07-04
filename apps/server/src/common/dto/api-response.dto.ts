/** 错误信息体，包裹在失败响应的 error 字段里。 */
export type ApiErrorDto = {
  /** 业务错误码，见 ERROR_CODES。 */
  code: string;
  /** 给人看的错误描述。 */
  message: string;
  /** 可选的补充详情（如校验失败的字段列表）。 */
  details?: unknown;
};

/** 成功响应体。 */
export type ApiSuccessResponseDto<T> = {
  success: true;
  data: T;
  message: string | null;
  error: null;
};

/** 失败响应体。 */
export type ApiErrorResponseDto = {
  success: false;
  data: null;
  message: string;
  error: ApiErrorDto;
};

/** 统一 API 响应体：成功或失败二选一。 */
export type ApiResponseDto<T> = ApiSuccessResponseDto<T> | ApiErrorResponseDto;

/**
 * 构造成功响应。
 * @param data 业务数据。
 * @param message 可选提示信息，默认 null。
 */
export function createSuccessResponse<T>(
  data: T,
  message: string | null = null
): ApiSuccessResponseDto<T> {
  return {
    success: true,
    data,
    message,
    error: null
  };
}

/**
 * 构造失败响应。
 * @param code 业务错误码。
 * @param message 错误描述。
 * @param details 可选补充详情；提供时写入 error.details。
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponseDto {
  const error: ApiErrorDto = {
    code,
    message
  };

  // 仅当传入了 details 才写入字段，避免出现 details: undefined
  if (details !== undefined) {
    error.details = details;
  }

  return {
    success: false,
    data: null,
    message,
    error
  };
}

/**
 * 类型守卫：判断一个值是否已经是统一响应体结构。
 *
 * 拦截器用它区分"业务返回的是裸数据（需包装）"还是"已是响应体（原样返回）"。
 *
 * @param value 任意值。
 * @returns 是统一响应体结构则收窄类型为 ApiResponseDto，否则 false。
 */
export function isApiResponseDto(value: unknown): value is ApiResponseDto<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ApiResponseDto<unknown>>;

  return (
    typeof candidate.success === 'boolean' &&
    'data' in candidate &&
    'message' in candidate &&
    'error' in candidate
  );
}
