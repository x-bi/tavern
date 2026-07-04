/**
 * 统一 API 响应相关结构的桶文件。
 *
 * 把 dto/api-response.dto.ts 里的工具函数（ok/fail）和类型（ApiResponse 等）
 * 重新导出，供业务代码从 `common/api-response` 简短路径引入。
 */
export {
  createErrorResponse as fail,
  createSuccessResponse as ok,
  isApiResponseDto
} from './dto/api-response.dto';
export type {
  ApiErrorDto as ApiError,
  ApiErrorResponseDto,
  ApiResponseDto as ApiResponse,
  ApiSuccessResponseDto
} from './dto/api-response.dto';
