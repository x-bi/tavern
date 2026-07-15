import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModelGatewayModule } from '../../services/model-gateway';
import { ModelsModule } from '../models/models.module';
import { CompanionMemoryController } from './companion-memory.controller';
import { CompanionMemoryService } from './companion-memory.service';
@Module({
  imports: [AuthModule, ModelsModule, ModelGatewayModule],
  controllers: [CompanionMemoryController],
  providers: [CompanionMemoryService],
  exports: [CompanionMemoryService]
})
export class CompanionMemoryModule {}
