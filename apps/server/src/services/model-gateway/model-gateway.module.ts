import { Module } from '@nestjs/common';

import { ModelGatewayRegistry } from './model-gateway.registry';
import { ModelGatewayService } from './model-gateway.service';
import { OpenAICompatibleProvider } from './providers/openai-compatible';

/**
 * Model Gateway 模块。
 *
 * 注册三部分：
 * - ModelGatewayRegistry：供应商适配器注册表；
 * - ModelGatewayService：网关服务（调模型、流式）；
 * - OpenAICompatibleProvider：OpenAI 兼容供应商适配器。
 *
 * exports 出 Registry 和 Service，供 ModelsModule、ChatModule 注入。
 */
@Module({
  providers: [ModelGatewayRegistry, ModelGatewayService, OpenAICompatibleProvider],
  exports: [ModelGatewayRegistry, ModelGatewayService]
})
export class ModelGatewayModule {}
