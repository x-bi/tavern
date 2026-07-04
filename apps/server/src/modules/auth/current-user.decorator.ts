import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthRequest } from './auth.types';

/**
 * 自定义参数装饰器 `@CurrentUser()`。
 *
 * 从 `request.currentUser` 取出当前登录用户。该字段由 `AuthGuard` 在守卫阶段写入，
 * 因此本装饰器必须配合 `@UseGuards(AuthGuard)` 使用，否则拿到的是 `undefined`。
 *
 * 用法：`me(@CurrentUser() currentUser: CurrentUserType) { ... }`
 */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthRequest>();

  return request.currentUser;
});
