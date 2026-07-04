import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/**
 * 认证模块。
 *
 * - imports UsersModule：AuthService 依赖 UsersService 来读写用户记录；
 * - providers：注册 AuthService（登录 / 取当前用户）、AuthGuard（请求鉴权守卫）、
 *   PasswordService（密码哈希）、TokenService（JWT 签发 / 校验）；
 * - exports：把 AuthGuard 和 AuthService 暴露出去，供全局守卫或其它模块注入使用。
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PasswordService, TokenService],
  exports: [AuthGuard, AuthService]
})
export class AuthModule {}
