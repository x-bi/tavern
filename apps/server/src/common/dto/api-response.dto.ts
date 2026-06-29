export type ApiErrorDto = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccessResponseDto<T> = {
  success: true;
  data: T;
  message: string | null;
  error: null;
};

export type ApiErrorResponseDto = {
  success: false;
  data: null;
  message: string;
  error: ApiErrorDto;
};

export type ApiResponseDto<T> = ApiSuccessResponseDto<T> | ApiErrorResponseDto;

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

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponseDto {
  const error: ApiErrorDto = {
    code,
    message
  };

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
