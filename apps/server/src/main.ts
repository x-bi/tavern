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

/**
 * 应用启动入口。
 *
 * 创建 Nest 实例 → 读取配置 → 注册全局中间件/管道/过滤器/拦截器 → 监听端口。
 * 任一环节失败会直接抛错退出。
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false
  });
  const configService = app.get(ConfigService);
  // 取 server 命名空间配置（在 app.module 经 load: [serverConfig] 注册）
  const serverConfig = configService.getOrThrow<ServerConfig>('server');

  // JSON 导入内容可能明显超过 Express 默认 100kb，统一使用配置项限制。
  app.useBodyParser('json', { limit: serverConfig.requestBodyLimit });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: serverConfig.requestBodyLimit
  });
  // 全局 API 前缀：所有路由变为 /{apiPrefix}/...
  app.setGlobalPrefix(serverConfig.apiPrefix);
  // 静态资源：把 uploads 目录映射到 /uploads/ 路径（供前端访问上传的文件）
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: '/uploads/'
  });
  // CORS：允许配置的前端来源跨域访问，并允许携带凭证（cookie 等）
  app.enableCors({
    origin: serverConfig.corsOrigins,
    credentials: true
  });
  // 全局 DTO 校验管道：拒绝契约外字段，避免旧字段被静默剥离后仍返回成功。
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  // 全局异常过滤器：把异常统一转成 { success: false, error } 结构
  app.useGlobalFilters(new ApiExceptionFilter());
  // 全局响应拦截器：把返回值统一包成 { success: true, data }，需注入 Reflector 读元数据
  app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));

  await app.listen(serverConfig.port, serverConfig.host);
}

void bootstrap();
