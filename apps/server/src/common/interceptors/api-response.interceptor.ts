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

/** 元数据 key：标记某处理器跳过响应包装。 */
export const SKIP_RESPONSE_WRAP = 'tavern:skip-response-wrap';

/**
 * 装饰器：标记该方法/控制器不经过 ApiResponseInterceptor 包装，原样返回。
 * 典型用途是 SSE 流式接口（如 chat/stream），不能被包成 JSON。
 */
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);

type RequestWithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};

/**
 * 全局响应拦截器：把 controller 返回的裸数据包成统一成功响应体。
 *
 * 流程：判断是否应跳过包装 → 不跳过则用 RxJS map 把数据转成
 * `{ success: true, data }`；已是响应体结构的原样透传。
 * 在 main.ts 用 `app.useGlobalInterceptors(...)` 注册。
 */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 流式接口等场景标记了跳过，直接放行不包装
    if (this.shouldSkipWrap(context)) {
      return next.handle();
    }

    return next.handle().pipe(
      // 已是统一响应体的原样返回；裸数据用 null 兜底后包装成成功响应
      map((data: unknown) =>
        isApiResponseDto(data) ? data : createSuccessResponse(data ?? null)
      )
    );
  }

  /**
   * 判断当前请求是否应跳过响应包装，两种情况任一命中即跳过。
   * @returns true 表示跳过包装。
   */
  private shouldSkipWrap(context: ExecutionContext): boolean {
    // 情况 1：方法或类上标注了 @SkipResponseWrap()
    const skipByMetadata = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP, [
      context.getHandler(),
      context.getClass()
    ]);

    if (skipByMetadata) {
      return true;
    }

    // 情况 2：请求头 Accept 含 text/event-stream（SSE 客户端），不能包成 JSON
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const acceptHeader = request.headers.accept;
    const accept = Array.isArray(acceptHeader) ? acceptHeader.join(',') : acceptHeader;

    return typeof accept === 'string' && accept.includes('text/event-stream');
  }
}
