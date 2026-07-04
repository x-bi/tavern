import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 登录入参 DTO。
 *
 * 由全局 ValidationPipe（whitelist + transform）校验：多余字段会被剥离，
 * 字符串类型会自动转换。校验失败会被转成 VALIDATION_ERROR（400）。
 */
export class LoginDto {
  /**
   * 登录密码明文。
   *
   * - 可选字段：
   *   - AUTH_REQUIRE_PASSWORD=false（免密模式）时无需提供；
   *   - AUTH_REQUIRE_PASSWORD=true（鉴权模式）时需提供。
   *     注意本字段标了 `@IsOptional`，真正的"必填"判定在 AuthService.login
   *     内根据配置走，不传时在那里抛 401。
   * - 必须是字符串，最长 256 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string;
}
