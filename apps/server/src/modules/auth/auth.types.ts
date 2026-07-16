import type { CurrentUser } from '../users/user.types';

/**
 * 认证模式。
 * - `preset_users`：仅允许环境变量预置的管理员和普通账号登录。
 */
export type AuthMode = 'preset_users';

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
