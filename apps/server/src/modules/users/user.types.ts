/**
 * 当前登录用户信息（对外暴露的安全形态，不含密码哈希等敏感字段）。
 */
export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  mode: 'single_user';
};

/**
 * 用户数据库记录形态（含敏感字段 passwordHash，仅在服务内部使用）。
 */
export type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  isActive: boolean;
};
