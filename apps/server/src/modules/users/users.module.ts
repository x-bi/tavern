import { Module } from '@nestjs/common';

import { UsersService } from './users.service';

/**
 * 用户模块。
 *
 * 提供 UsersService 并导出，供 AuthModule 等需要读写用户记录的模块注入。
 */
@Module({
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
