import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Prisma 模块。
 *
 * 标 `@Global()` 后，PrismaService 全局可用，其它业务模块无需再各自 import 本模块
 * 即可直接注入 PrismaService。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
