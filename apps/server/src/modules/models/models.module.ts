import { Module } from '@nestjs/common';

import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

/**
 * 模型配置模块。
 *
 * imports ModelGatewayModule（测试连接时调用网关）和 AuthModule（鉴权）。
 */
@Module({
  imports: [AuthModule, ModelGatewayModule],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService]
})
export class ModelsModule {}
