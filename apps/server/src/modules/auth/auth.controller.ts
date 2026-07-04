import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';

/**
 * 认证控制器，路由前缀 `/auth`（完整路径为 `/{API_PREFIX}/auth/...`）。
 *
 * 统一响应格式：成功返回由全局 ApiResponseInterceptor 包成
 * `{ success: true, data: ... }`；失败由全局 ApiExceptionFilter 包成
 * `{ success: false, error: { code, message } }` 并带对应 HTTP 状态码。
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  /**
   * 登录。`POST /{apiPrefix}/auth/login`
   *
   * @param dto 登录入参，password 是否必填取决于服务端 AUTH_REQUIRE_PASSWORD。
   * @returns LoginResponse（被全局拦截器包成成功响应）。
   * @throws UnauthorizedException 密码错误时抛出，并带错误码 AUTH_INVALID_CREDENTIALS（→ 401）。
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    try {
      return await this.authService.login(dto.password);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }

      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid username or password.'
      });
    }
  }

  /**
   * 获取当前登录用户。`GET /{apiPrefix}/auth/me`
   *
   * 需携带有效 token（由 AuthGuard 校验）。
   * @param currentUser 由 @CurrentUser() 注入的当前用户。
   * @returns 当前用户的最新信息。
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() currentUser: CurrentUserType) {
    return this.authService.me(currentUser);
  }

  /**
   * 登出。`POST /{apiPrefix}/auth/logout`
   *
   * 服务端不维护 session，登出仅作语义占位（前端丢弃 token 即可）。
   * @returns `{ loggedOut: true }`。
   */
  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  logout() {
    return {
      loggedOut: true
    };
  }
}
