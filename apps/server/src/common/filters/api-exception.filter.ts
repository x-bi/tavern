import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';

import { createErrorResponse } from '../dto/api-response.dto';
import { ERROR_CODES } from '../dto/error-codes';

type HttpResponse = {
  status(status: number): {
    json(body: unknown): void;
  };
};

type HttpExceptionBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = this.getStatus(exception);
    const body = this.getHttpExceptionBody(exception);
    const validationDetails = this.getValidationDetails(body);
    const message = this.getMessage(exception, status, body);
    const code = this.getCode(status, body, validationDetails);
    const details = body?.details ?? validationDetails;

    response.status(status).json(createErrorResponse(code, message, details));
  }

  private getStatus(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getHttpExceptionBody(exception: unknown): HttpExceptionBody | null {
    if (!(exception instanceof HttpException)) {
      return null;
    }

    const response = exception.getResponse();

    return typeof response === 'object' && response !== null
      ? (response as HttpExceptionBody)
      : { message: response };
  }

  private getCode(
    status: number,
    body: HttpExceptionBody | null,
    validationDetails: string[] | undefined
  ): string {
    if (typeof body?.code === 'string' && body.code) {
      return body.code;
    }

    if (validationDetails) {
      return ERROR_CODES.VALIDATION_ERROR;
    }

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

  private getMessage(
    exception: unknown,
    status: number,
    body: HttpExceptionBody | null
  ): string {
    if (!(exception instanceof HttpException)) {
      return 'Internal server error.';
    }

    if (Array.isArray(body?.message)) {
      return 'Request validation failed.';
    }

    if (typeof body?.message === 'string' && body.message) {
      return body.message;
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error.'
      : exception.message;
  }

  private getValidationDetails(body: HttpExceptionBody | null): string[] | undefined {
    return Array.isArray(body?.message) && body.message.every((item) => typeof item === 'string')
      ? body.message
      : undefined;
  }
}
