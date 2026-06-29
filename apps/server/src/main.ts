import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import type { ServerConfig } from './config/server.config';
import { UPLOADS_ROOT } from './modules/assets/assets.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const serverConfig = configService.getOrThrow<ServerConfig>('server');

  app.setGlobalPrefix(serverConfig.apiPrefix);
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: '/uploads/'
  });
  app.enableCors({
    origin: serverConfig.corsOrigins,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));

  await app.listen(serverConfig.port, serverConfig.host);
}

void bootstrap();
