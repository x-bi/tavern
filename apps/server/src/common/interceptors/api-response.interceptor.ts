import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';

import { createSuccessResponse, isApiResponseDto } from '../dto/api-response.dto';

export const SKIP_RESPONSE_WRAP = 'tavern:skip-response-wrap';

export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);

type RequestWithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.shouldSkipWrap(context)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) =>
        isApiResponseDto(data) ? data : createSuccessResponse(data ?? null)
      )
    );
  }

  private shouldSkipWrap(context: ExecutionContext): boolean {
    const skipByMetadata = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP, [
      context.getHandler(),
      context.getClass()
    ]);

    if (skipByMetadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const acceptHeader = request.headers.accept;
    const accept = Array.isArray(acceptHeader) ? acceptHeader.join(',') : acceptHeader;

    return typeof accept === 'string' && accept.includes('text/event-stream');
  }
}
