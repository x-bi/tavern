type RawEnv = Record<string, string | undefined>;

export type ValidatedEnv = {
  NODE_ENV: string;
  SERVER_HOST: string;
  SERVER_PORT: string;
  API_PREFIX: string;
  CORS_ORIGINS: string;
  AUTH_MODE: string;
  AUTH_REQUIRE_PASSWORD: string;
  AUTH_SINGLE_USER_USERNAME: string;
  AUTH_SINGLE_USER_DISPLAY_NAME: string;
  AUTH_SINGLE_USER_PASSWORD: string;
  AUTH_TOKEN_SECRET: string;
  AUTH_TOKEN_TTL_SECONDS: string;
};

const DEFAULT_ENV: ValidatedEnv = {
  NODE_ENV: 'development',
  SERVER_HOST: '127.0.0.1',
  SERVER_PORT: '3100',
  API_PREFIX: 'api',
  CORS_ORIGINS: 'http://127.0.0.1:5173,http://localhost:5173',
  AUTH_MODE: 'single_user',
  AUTH_REQUIRE_PASSWORD: 'false',
  AUTH_SINGLE_USER_USERNAME: 'demo',
  AUTH_SINGLE_USER_DISPLAY_NAME: 'Tavern Admin',
  AUTH_SINGLE_USER_PASSWORD: '',
  AUTH_TOKEN_SECRET: 'dev-only-change-me',
  AUTH_TOKEN_TTL_SECONDS: '604800'
};

export function validateEnv(config: RawEnv): ValidatedEnv {
  const merged = {
    ...DEFAULT_ENV,
    ...config
  };
  const port = Number(merged.SERVER_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVER_PORT must be an integer between 1 and 65535.');
  }

  if (merged.AUTH_MODE !== 'single_user') {
    throw new Error('AUTH_MODE currently only supports single_user.');
  }

  if (!['true', 'false'].includes(merged.AUTH_REQUIRE_PASSWORD)) {
    throw new Error('AUTH_REQUIRE_PASSWORD must be true or false.');
  }

  if (merged.AUTH_REQUIRE_PASSWORD === 'true' && !merged.AUTH_SINGLE_USER_PASSWORD) {
    throw new Error('AUTH_SINGLE_USER_PASSWORD is required when AUTH_REQUIRE_PASSWORD is true.');
  }

  const tokenTtlSeconds = Number(merged.AUTH_TOKEN_TTL_SECONDS);

  if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds < 60) {
    throw new Error('AUTH_TOKEN_TTL_SECONDS must be an integer greater than or equal to 60.');
  }

  return {
    NODE_ENV: merged.NODE_ENV,
    SERVER_HOST: merged.SERVER_HOST,
    SERVER_PORT: String(port),
    API_PREFIX: normalizeApiPrefix(merged.API_PREFIX),
    CORS_ORIGINS: merged.CORS_ORIGINS,
    AUTH_MODE: merged.AUTH_MODE,
    AUTH_REQUIRE_PASSWORD: merged.AUTH_REQUIRE_PASSWORD,
    AUTH_SINGLE_USER_USERNAME: merged.AUTH_SINGLE_USER_USERNAME,
    AUTH_SINGLE_USER_DISPLAY_NAME: merged.AUTH_SINGLE_USER_DISPLAY_NAME,
    AUTH_SINGLE_USER_PASSWORD: merged.AUTH_SINGLE_USER_PASSWORD,
    AUTH_TOKEN_SECRET: merged.AUTH_TOKEN_SECRET,
    AUTH_TOKEN_TTL_SECONDS: String(tokenTtlSeconds)
  };
}

function normalizeApiPrefix(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, '');

  return normalized || DEFAULT_ENV.API_PREFIX;
}
