import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ContentPacksController } from './content-packs.controller';
import { ContentPacksService } from './content-packs.service';

/** 内容包模块：提供 AI 生成设定包的预览与增量导入能力。 */
@Module({
  imports: [AuthModule],
  controllers: [ContentPacksController],
  providers: [ContentPacksService]
})
export class ContentPacksModule {}
