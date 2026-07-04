import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

/**
 * 素材模块。
 *
 * imports AuthModule（鉴权）；PrismaModule 虽是 @Global，这里显式 import 表达依赖。
 * 导出 AssetsService 供 CharactersService 校验头像归属时使用。
 */
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService]
})
export class AssetsModule {}
