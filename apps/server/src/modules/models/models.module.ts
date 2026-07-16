import { Module } from '@nestjs/common';

import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ModelFallbackGroupsController } from './model-fallback-groups.controller';
import { ModelProvidersController } from './model-providers.controller';
import { ModelsService } from './models.service';
import { SharedModelsGuard } from './shared-models.guard';
import { ProviderModelsController } from './provider-models.controller';

/**
 * 模型配置模块。
 *
 * imports ModelGatewayModule（测试连接时调用网关）和 AuthModule（鉴权）。
 */
@Module({
  imports: [AuthModule, UsersModule, ModelGatewayModule],
  controllers: [ModelProvidersController, ProviderModelsController, ModelFallbackGroupsController],
  providers: [ModelsService, SharedModelsGuard],
  exports: [ModelsService]
})
export class ModelsModule {}
