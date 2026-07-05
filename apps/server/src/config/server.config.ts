import { registerAs } from '@nestjs/config';

/**
 * 服务端运行配置（通过 ConfigModule 的 `load` 注册，命名空间为 `server`）。
 * 各字段从环境变量读取，未设置时走默认值。
 */
export type ServerConfig = {
  /** 运行环境，如 development / production。 */
  nodeEnv: string;
  /** 监听地址，默认 127.0.0.1（仅本机）。 */
  host: string;
  /** 监听端口，默认 3100。 */
  port: number;
  /** API 路由前缀，默认 api（最终路径形如 /api/...）。 */
  apiPrefix: string;
  /** JSON / urlencoded 请求体大小上限，默认 5mb。 */
  requestBodyLimit: string;
  /** 允许的 CORS 来源列表，从 CORS_ORIGINS 逗号分隔得到。 */
  corsOrigins: string[];
};

/**
 * 读取并组装服务端配置。
 * 在 app.module.ts 中经 `load: [serverConfig]` 注册，
 * 后续用 `configService.get<ServerConfig>('server')` 取出。
 */
export default registerAs('server', (): ServerConfig => {
  const corsOrigins = process.env.CORS_ORIGINS ?? '';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.SERVER_HOST ?? '127.0.0.1',
    port: Number(process.env.SERVER_PORT ?? 3100),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '5mb',
    corsOrigins: corsOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
});
