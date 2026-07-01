import { Module } from '@nestjs/common';

import { ModelGatewayModule } from '../../services/model-gateway';
import { AuthModule } from '../auth/auth.module';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [AuthModule, ModelGatewayModule],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService]
})
export class ModelsModule {}
