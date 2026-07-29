import { Module } from '@nestjs/common';

import { ContextEngineModule } from '../../services/context-engine/context-engine.module';
import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { ModelsModule } from '../models/models.module';
import { ImageGenerationsController } from './image-generations.controller';
import { ImageGenerationsService } from './image-generations.service';

@Module({
  imports: [AuthModule, ModelsModule, ModelGatewayModule, ContextEngineModule],
  controllers: [ImageGenerationsController],
  providers: [ImageGenerationsService],
  exports: [ImageGenerationsService]
})
export class ImageGenerationsModule {}
