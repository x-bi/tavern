import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ServerConfig } from '../../config/server.config';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  @Get()
  getHealth() {
    const serverConfig = this.configService.getOrThrow<ServerConfig>('server');

    return this.healthService.getHealth(serverConfig);
  }
}
