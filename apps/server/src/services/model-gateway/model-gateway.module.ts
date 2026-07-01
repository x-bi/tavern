import { Module } from '@nestjs/common';

import { ModelGatewayRegistry } from './model-gateway.registry';
import { ModelGatewayService } from './model-gateway.service';
import { OpenAICompatibleProvider } from './providers/openai-compatible';

@Module({
  providers: [ModelGatewayRegistry, ModelGatewayService, OpenAICompatibleProvider],
  exports: [ModelGatewayRegistry, ModelGatewayService]
})
export class ModelGatewayModule {}
