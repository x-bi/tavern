type RawEnv = Record<string, string | undefined>;

/** 环境变量校验后的结构（所有字段保证为字符串，已填默认值并校验通过）。 */
export type ValidatedEnv = {
  NODE_ENV: string;
  SERVER_HOST: string;
  SERVER_PORT: string;
  API_PREFIX: string;
  REQUEST_BODY_LIMIT: string;
  CORS_ORIGINS: string;
  AUTH_PRESET_USERS_JSON: string;
  AUTH_TOKEN_SECRET: string;
  AUTH_TOKEN_TTL_SECONDS: string;
};

/** 环境变量默认值（未显式设置时使用）。 */
const DEFAULT_ENV: ValidatedEnv = {
  NODE_ENV: 'development',
  SERVER_HOST: '127.0.0.1',
  SERVER_PORT: '3100',
  API_PREFIX: 'api',
  REQUEST_BODY_LIMIT: '5mb',
  CORS_ORIGINS: 'http://127.0.0.1:5173,http://localhost:5173',
  AUTH_PRESET_USERS_JSON: '',
  AUTH_TOKEN_SECRET: 'dev-only-change-me',
  AUTH_TOKEN_TTL_SECONDS: '604800'
};

/**
 * 校验并归一化环境变量。
 *
 * 流程：用默认值兜底 → 逐项校验关键变量 → 端口/ TTL 数值化 → 返回规整后的对象。
 * 校验失败直接抛 Error，会中断应用启动（ConfigModule 的 validate 阶段）。
 *
 * @param config 原始环境变量（process.env）。
 * @returns 校验通过、字段齐全的 ValidatedEnv。
 * @throws Error 任一校验不通过时抛出（含具体原因）。
 */
export function validateEnv(config: RawEnv): ValidatedEnv {
  // 先用默认值兜底，再覆盖以实际传入的值（未设置的字段保留默认值）
  const merged = {
    ...DEFAULT_ENV,
    ...config
  };
  const port = Number(merged.SERVER_PORT);

  // 防止端口非法：必须是 1~65535 的整数
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVER_PORT must be an integer between 1 and 65535.');
  }

  if (!/^[1-9]\d*(b|kb|mb)$/i.test(merged.REQUEST_BODY_LIMIT)) {
    throw new Error('REQUEST_BODY_LIMIT must use a positive b/kb/mb value, such as 5mb.');
  }

  validatePresetUsers(merged.AUTH_PRESET_USERS_JSON);

  const tokenTtlSeconds = Number(merged.AUTH_TOKEN_TTL_SECONDS);

  // token 有效期至少 60 秒，过短会导致频繁过期、无法正常使用
  if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds < 60) {
    throw new Error('AUTH_TOKEN_TTL_SECONDS must be an integer greater than or equal to 60.');
  }

  return {
    NODE_ENV: merged.NODE_ENV,
    SERVER_HOST: merged.SERVER_HOST,
    SERVER_PORT: String(port),
    API_PREFIX: normalizeApiPrefix(merged.API_PREFIX),
    REQUEST_BODY_LIMIT: merged.REQUEST_BODY_LIMIT.toLowerCase(),
    CORS_ORIGINS: merged.CORS_ORIGINS,
    AUTH_PRESET_USERS_JSON: merged.AUTH_PRESET_USERS_JSON,
    AUTH_TOKEN_SECRET: merged.AUTH_TOKEN_SECRET,
    AUTH_TOKEN_TTL_SECONDS: String(tokenTtlSeconds)
  };
}

function validatePresetUsers(value: string): void {
  let users: unknown;
  try {
    users = JSON.parse(value);
  } catch {
    throw new Error('AUTH_PRESET_USERS_JSON must be valid JSON.');
  }
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('AUTH_PRESET_USERS_JSON must contain at least one account.');
  }
  const usernames = new Set<string>();
  let adminCount = 0;
  for (const item of users) {
    if (!item || typeof item !== 'object') throw new Error('AUTH_PRESET_USERS_JSON contains an invalid account.');
    const account = item as Record<string, unknown>;
    if (typeof account.username !== 'string' || !/^[a-zA-Z0-9_.-]{3,64}$/.test(account.username)) throw new Error('Preset username is invalid.');
    if (typeof account.displayName !== 'string' || !account.displayName.trim()) throw new Error('Preset displayName is required.');
    if (typeof account.password !== 'string' || account.password.length < 4) throw new Error('Preset password must be at least 4 characters.');
    if (account.role !== 'admin' && account.role !== 'member') throw new Error('Preset role must be admin or member.');
    if (usernames.has(account.username)) throw new Error('Preset usernames must be unique.');
    usernames.add(account.username);
    if (account.role === 'admin') adminCount += 1;
  }
  if (adminCount === 0) throw new Error('At least one preset admin account is required.');
}

/**
 * 规整 API 前缀：去掉首尾斜杠，避免路由变成 //api//xxx；为空时回退默认 api。
 * @param value 原始 API_PREFIX 值。
 * @returns 不含首尾斜杠的前缀字符串。
 */
function normalizeApiPrefix(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, '');

  return normalized || DEFAULT_ENV.API_PREFIX;
}
