import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service';
import type { CurrentUser } from '../users/user.types';
import type { LoginResponse } from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/**
 * 认证服务：处理单用户模式下的登录、token 解析与当前用户获取。
 *
 * 依赖：
 * - ConfigService：读取 AUTH_REQUIRE_PASSWORD、AUTH_SINGLE_USER_PASSWORD 等环境配置；
 * - UsersService：读写唯一 admin 用户记录、转换为 CurrentUser；
 * - PasswordService：密码哈希与校验；
 * - TokenService：JWT 签发与校验。
 *
 * 是否要求密码由环境变量 AUTH_REQUIRE_PASSWORD 决定：
 * - `false`（默认，免密模式）：登录直接放行，请求也无需 token；
 * - `true`（鉴权模式）：登录需校验密码，后续请求需携带有效 token。
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  /**
   * 是否开启了密码校验（即鉴权模式）。
   * @returns AUTH_REQUIRE_PASSWORD === 'true' 时返回 `true`。
   */
  isPasswordRequired(): boolean {
    return this.configService.get<string>('AUTH_REQUIRE_PASSWORD') === 'true';
  }

  /**
   * 单用户登录：校验密码并签发 JWT。
   *
   * 流程：读取配置的密码哈希 → 确保存在唯一 admin 用户 →
   * 若开启密码校验则比对入参密码 → 通过后签发 token。
   *
   * @param password 可选，登录密码明文。
   *   - AUTH_REQUIRE_PASSWORD=false（免密模式）：可不传，直接放行；
   *   - AUTH_REQUIRE_PASSWORD=true（鉴权模式）：必须传，且要与
   *     AUTH_SINGLE_USER_PASSWORD 的哈希匹配，否则抛 401。
   * @returns LoginResponse，含当前用户、accessToken、tokenType、过期时间。
   * @throws UnauthorizedException 密码未配置或校验失败时抛出，
   *   被全局 ApiExceptionFilter 转成 HTTP 401。
   */
  async login(password?: string): Promise<LoginResponse> {
    // 取配置要求的密码哈希：免密模式返回 null（用户记录不存密码），鉴权模式返回配置密码的哈希
    const passwordHash = this.getConfiguredPasswordHash();
    // upsert 出唯一 admin 用户，并把 passwordHash 写回库（保证用户记录与配置一致）
    const user = await this.usersService.ensureSingleAdmin(passwordHash);

    // 仅鉴权模式需要校验密码：比对入参明文与库中哈希，不匹配则拒绝
    // 免密模式直接跳过此分支放行
    if (
      this.isPasswordRequired() &&
      !this.passwordService.verifyPassword(password ?? '', user.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid password.');
    }

    // 用户记录 → 对外暴露的 CurrentUser（剔除 passwordHash 等敏感字段）
    const currentUser = this.usersService.toCurrentUser(user);
    // 用用户身份签发 token，过期时间由 TokenService 按 TTL 自动计算
    const token = this.tokenService.sign({
      sub: currentUser.id,
      username: currentUser.username,
      mode: 'single_user'
    });

    return {
      user: currentUser,
      accessToken: token.accessToken,
      tokenType: 'Bearer',
      expiresAt: token.expiresAt.toISOString()
    };
  }

  /**
   * 从请求里的 token 解析当前登录用户（供 AuthGuard 调用）。
   *
   * @param token 请求头解析出的 Bearer token；免密模式下可为 `null`。
   *   - 免密模式：忽略 token，直接返回默认 admin 用户；
   *   - 鉴权模式：token 为空抛 401，否则校验 token 并查库确认用户仍有效。
   * @returns 当前登录用户。
   * @throws UnauthorizedException token 缺失 / 无效或用户不存在时抛出（→ 401）。
   */
  async getCurrentUserFromRequestToken(token: string | null): Promise<CurrentUser> {
    // 免密模式：忽略 token，直接返回默认 admin 用户（不做任何凭证校验）
    if (!this.isPasswordRequired()) {
      const user = await this.usersService.ensureSingleAdmin(null);

      return this.usersService.toCurrentUser(user);
    }

    // 鉴权模式：必须有 token，缺失即视为未登录
    if (!token) {
      throw new UnauthorizedException('Missing auth token.');
    }

    // 验签 + 解码 token（TokenService.verify 内部校验签名、过期、payload 字段）
    const payload = this.tokenService.verify(token);
    // 用 token 里的用户 id 查库，确认用户仍活跃（防止已停用用户拿旧 token 继续访问）
    const user = await this.usersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User is inactive or missing.');
    }

    return this.usersService.toCurrentUser(user);
  }

  /**
   * 获取当前登录用户的最新信息（GET /auth/me 用）。
   * @param currentUser 由 token 解析出的当前用户（至少含 id）。
   * @returns 数据库中最新的用户信息。
   * @throws UnauthorizedException 用户已停用 / 不存在时抛出（→ 401）。
   */
  async me(currentUser: CurrentUser): Promise<CurrentUser> {
    const user = await this.usersService.findActiveById(currentUser.id);

    if (!user) {
      throw new UnauthorizedException('User is inactive or missing.');
    }

    return this.usersService.toCurrentUser(user);
  }

  /**
   * 读取配置中要求的密码哈希（供登录时写库与比对）。
   * @returns 密码的哈希字符串。
   *   - 免密模式：返回 `null`（用户记录不存密码）；
   *   - 鉴权模式：返回 AUTH_SINGLE_USER_PASSWORD 的哈希。
   * @throws UnauthorizedException 鉴权模式但 AUTH_SINGLE_USER_PASSWORD 未配置时抛出。
   */
  private getConfiguredPasswordHash(): string | null {
    if (!this.isPasswordRequired()) {
      return null;
    }

    const password = this.configService.get<string>('AUTH_SINGLE_USER_PASSWORD');

    if (!password) {
      throw new UnauthorizedException('Single-user password is not configured.');
    }

    return this.passwordService.hashPassword(password);
  }
}
