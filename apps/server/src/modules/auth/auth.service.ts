import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { CurrentUser } from '../users/user.types';
import type { LoginResponse } from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/** 仅允许环境变量预置的多账号登录；无注册和免密路径。 */
@Injectable()
export class AuthService {
  constructor(@Inject(UsersService) private readonly usersService: UsersService, @Inject(PasswordService) private readonly passwordService: PasswordService, @Inject(TokenService) private readonly tokenService: TokenService) {}

  async login(username: string, password: string): Promise<LoginResponse> {
    await this.usersService.syncPresetUsers((value) => this.passwordService.hashPassword(value));
    const user = await this.usersService.findActiveByUsername(username);
    if (!user || !this.passwordService.verifyPassword(password, user.passwordHash)) throw new UnauthorizedException('Invalid password.');
    const currentUser = this.usersService.toCurrentUser(user);
    const token = this.tokenService.sign({ sub: currentUser.id, username: currentUser.username, mode: 'preset_users' });
    return { user: currentUser, accessToken: token.accessToken, tokenType: 'Bearer', expiresAt: token.expiresAt.toISOString() };
  }

  async getCurrentUserFromRequestToken(token: string | null): Promise<CurrentUser> {
    if (!token) throw new UnauthorizedException('Missing auth token.');
    const payload = this.tokenService.verify(token);
    const user = await this.usersService.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException('User is inactive or missing.');
    return this.usersService.toCurrentUser(user);
  }

  async me(currentUser: CurrentUser): Promise<CurrentUser> {
    const user = await this.usersService.findActiveById(currentUser.id);
    if (!user) throw new UnauthorizedException('User is inactive or missing.');
    return this.usersService.toCurrentUser(user);
  }

  /** 管理员可指定当前请求要查看的已启用用户；普通账号无权模拟。 */
  async resolveActingUser(actor: CurrentUser, targetUserId: string): Promise<CurrentUser> {
    if (actor.role !== 'admin') throw new ForbiddenException('Admin role is required.');
    const user = await this.usersService.findActiveById(targetUserId);
    if (!user) throw new UnauthorizedException('Target user is inactive or missing.');
    return this.usersService.toCurrentUser(user);
  }
}
