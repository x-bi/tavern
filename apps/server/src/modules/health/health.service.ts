import { Injectable } from '@nestjs/common';

import type { ServerConfig } from '../../config/server.config';

export type HealthResponse = {
  status: 'ok';
  service: 'tavern-lite-server';
  environment: string;
  apiPrefix: string;
  timestamp: string;
};

@Injectable()
export class HealthService {
  getHealth(config: ServerConfig): HealthResponse {
    return {
      status: 'ok',
      service: 'tavern-lite-server',
      environment: config.nodeEnv,
      apiPrefix: config.apiPrefix,
      timestamp: new Date().toISOString()
    };
  }
}
