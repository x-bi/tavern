import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PresetsController } from './presets.controller';
import { PresetsService } from './presets.service';

/** 预设模块。imports AuthModule 鉴权。 */
@Module({
  imports: [AuthModule],
  controllers: [PresetsController],
  providers: [PresetsService],
  exports: [PresetsService]
})
export class PresetsModule {}
