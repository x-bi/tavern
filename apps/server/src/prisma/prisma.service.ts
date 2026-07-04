import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 数据库客户端的 NestJS 封装。
 *
 * 继承 PrismaClient 拿到全部查询能力，同时实现 NestJS 生命周期钩子，
 * 在模块初始化时建连、销毁时断开，避免连接泄漏。
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** 模块初始化时连接数据库。 */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** 模块销毁时断开数据库连接。 */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
