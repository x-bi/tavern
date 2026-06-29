import { registerAs } from '@nestjs/config';

export type ServerConfig = {
  nodeEnv: string;
  host: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
};

export default registerAs('server', (): ServerConfig => {
  const corsOrigins = process.env.CORS_ORIGINS ?? '';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.SERVER_HOST ?? '127.0.0.1',
    port: Number(process.env.SERVER_PORT ?? 3100),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: corsOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
});
