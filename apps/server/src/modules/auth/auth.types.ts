import type { CurrentUser } from '../users/user.types';

/**
 * 认证模式。
 * - `single_user`：单用户模式，系统里只有一个 admin 用户，登录即获得该身份。
 *   （当前仅支持此模式，见 env.validation.ts 对 AUTH_MODE 的校验。）
 */
export type AuthMode = 'single_user';

/**
 * 认证相关的请求对象（AuthGuard 读写时用到的 request 形状）。
 * - headers：原始请求头，用于读取 Authorization；
 * - currentUser：由 AuthGuard 解析 token 后写入，供 @CurrentUser() 装饰器取出。
 */
export type AuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  currentUser?: CurrentUser;
};

/** 当前登录用户信息（登录接口 / me 接口返回的 user 字段）。 */
export type AuthUserResponse = CurrentUser;

/**
 * 登录成功响应。
 * @property user 当前登录用户信息；
 * @property accessToken 访问令牌，前端需以 `Authorization: Bearer <token>` 携带；
 * @property tokenType 固定 `Bearer`；
 * @property expiresAt token 过期时间（ISO 字符串）。
 */
export type LoginResponse = {
  user: AuthUserResponse;
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
};
