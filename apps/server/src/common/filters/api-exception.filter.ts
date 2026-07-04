import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';

import { createErrorResponse } from '../dto/api-response.dto';
import { ERROR_CODES } from '../dto/error-codes';

/** Express 响应对象的最小形状（只需 status + json）。 */
type HttpResponse = {
  status(status: number): {
    json(body: unknown): void;
  };
};

/** HttpException 响应体的可能字段（NestJS 允许是对象、字符串或数组）。 */
type HttpExceptionBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

/**
 * 全局异常过滤器：把任意异常转成统一失败响应体。
 *
 * 在 main.ts 用 `app.useGlobalFilters(new ApiExceptionFilter())` 注册。
 * 它会捕获所有未处理的异常，按异常类型提取状态码、错误码、消息和详情，
 * 最终用 createErrorResponse 包成 `{ success: false, error: {...} }` 返回。
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  /**
   * 捕获异常并写入统一失败响应。
   * @param exception 抛出的异常（类型未知）。
   * @param host NestJS 参数宿主，用于取出 HTTP 响应对象。
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    // HTTP 状态码：HttpException 取其自带状态，其余视为 500
    const status = this.getStatus(exception);
    // 异常响应体：HttpException 可能有结构化 body，否则为 null
    const body = this.getHttpExceptionBody(exception);
    // 校验详情：若 body.message 是字符串数组，提取出来作为详情
    const validationDetails = this.getValidationDetails(body);
    // 错误消息：优先用异常自带消息，再按状态码兜底
    const message = this.getMessage(exception, status, body);
    // 错误码：优先异常自带 code，其次校验失败，最后按状态码映射默认码
    const code = this.getCode(status, body, validationDetails);
    // 详情：优先异常自带 details，否则用校验详情
    const details = body?.details ?? validationDetails;

    response.status(status).json(createErrorResponse(code, message, details));
  }

  /**
   * 提取 HTTP 状态码。
   * @returns HttpException 取其状态码，其它异常返回 500。
   */
  private getStatus(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * 提取 HttpException 的响应体。
   *
   * NestJS 的 getResponse 可能是对象（含 code/message）也可能是字符串，
   * 这里统一成 HttpExceptionBody 形态，非 HttpException 返回 null。
   *
   * @returns 结构化 body，或包装成 `{ message }`，或 null。
   */
  private getHttpExceptionBody(exception: unknown): HttpExceptionBody | null {
    if (!(exception instanceof HttpException)) {
      return null;
    }

    const response = exception.getResponse();

    return typeof response === 'object' && response !== null
      ? (response as HttpExceptionBody)
      : { message: response };
  }

  /**
   * 决定错误码，优先级从高到低。
   *
   * @param status HTTP 状态码。
   * @param body 异常响应体。
   * @param validationDetails 校验详情（存在说明是 DTO 校验失败）。
   * @returns 业务错误码字符串。
   */
  private getCode(
    status: number,
    body: HttpExceptionBody | null,
    validationDetails: string[] | undefined
  ): string {
    // 优先级 1：异常自带了 code 字段（如 service 主动抛的带 code 的异常），直接用
    if (typeof body?.code === 'string' && body.code) {
      return body.code;
    }

    // 优先级 2：有校验详情 → 归类为校验错误
    if (validationDetails) {
      return ERROR_CODES.VALIDATION_ERROR;
    }

    // 优先级 3：按 HTTP 状态码映射到通用错误码
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ERROR_CODES.PAYLOAD_TOO_LARGE;
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return ERROR_CODES.UNSUPPORTED_MEDIA_TYPE;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * 决定错误消息，按异常类型和 body 内容逐级取。
   *
   * @param exception 原始异常。
   * @param status HTTP 状态码（用于判断是否 500）。
   * @param body 异常响应体。
   * @returns 给人看的错误描述。
   */
  private getMessage(
    exception: unknown,
    status: number,
    body: HttpExceptionBody | null
  ): string {
    // 非 HttpException：统一返回内部错误提示，不暴露原始堆栈信息
    if (!(exception instanceof HttpException)) {
      return 'Internal server error.';
    }

    // body.message 是数组（即校验错误列表）→ 给统一的校验失败提示
    if (Array.isArray(body?.message)) {
      return 'Request validation failed.';
    }

    // body.message 是字符串 → 直接用异常带的消息
    if (typeof body?.message === 'string' && body.message) {
      return body.message;
    }

    // 都没有：500 用固定提示，其它状态用异常的 message
    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error.'
      : exception.message;
  }

  /**
   * 从 body 中提取校验详情（仅当 message 是纯字符串数组时）。
   * @returns 字符串数组，或 undefined（非校验错误时）。
   */
  private getValidationDetails(body: HttpExceptionBody | null): string[] | undefined {
    return Array.isArray(body?.message) && body.message.every((item) => typeof item === 'string')
      ? body.message
      : undefined;
  }
}
