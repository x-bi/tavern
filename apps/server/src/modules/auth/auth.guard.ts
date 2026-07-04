import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';

import { AuthService } from './auth.service';
import type { AuthRequest } from './auth.types';

/**
 * 认证守卫。
 *
 * 实现 NestJS 的 `CanActivate`：从请求头解析 Bearer token → 调用 AuthService
 * 解析出当前用户 → 写入 `request.currentUser`（供 `@CurrentUser()` 装饰器使用）。
 *
 * 解析失败（token 缺失 / 格式错误 / 无效 / 用户不存在）一律抛 `UnauthorizedException`，
 * 即 HTTP 401。配合 `@UseGuards(AuthGuard)` 使用。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  /**
   * 守卫入口：校验当前请求是否已认证。
   * @param context NestJS 执行上下文。
   * @returns 通过校验返回 `true`（放行）。
   * @throws UnauthorizedException token 缺失 / 无效或用户不存在时抛出（→ 401）。
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const currentUser = await this.authService.getCurrentUserFromRequestToken(
      this.extractBearerToken(request)
    );

    request.currentUser = currentUser;

    return true;
  }

  /**
   * 从 Authorization 头解析 Bearer token。
   * @param request HTTP 请求。
   * @returns 解析出的 token；若未携带 Authorization 头则返回 `null`
   *   （免密模式下可接受，交由 AuthService 兜底返回默认 admin 用户）。
   * @throws UnauthorizedException Authorization 头存在但格式不是 `Bearer <token>` 时抛出（→ 401）。
   */
  private extractBearerToken(request: AuthRequest): string | null {
    const header = request.headers.authorization;
    // header 可能是数组（Express 允许同名头多次出现），取第一个
    const value = Array.isArray(header) ? header[0] : header;

    // 没有携带 Authorization 头：返回 null，交由 AuthService 在免密模式下兜底
    // 鉴权模式下 null 会触发后续抛 401
    if (!value) {
      return null;
    }

    // 标准 Authorization 头形如 "Bearer <token>"，按空格拆出认证方案和 token
    const [type, token] = value.split(' ');

    // 方案不是 Bearer 或没有 token：格式非法，直接拒绝
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header.');
    }

    return token;
  }
}
