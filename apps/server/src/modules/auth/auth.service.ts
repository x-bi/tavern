import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service';
import type { CurrentUser } from '../users/user.types';
import type { LoginResponse } from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

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

  isPasswordRequired(): boolean {
    return this.configService.get<string>('AUTH_REQUIRE_PASSWORD') === 'true';
  }

  async login(password?: string): Promise<LoginResponse> {
    const passwordHash = this.getConfiguredPasswordHash();
    const user = await this.usersService.ensureSingleAdmin(passwordHash);

    if (
      this.isPasswordRequired() &&
      !this.passwordService.verifyPassword(password ?? '', user.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid password.');
    }

    const currentUser = this.usersService.toCurrentUser(user);
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

  async getCurrentUserFromRequestToken(token: string | null): Promise<CurrentUser> {
    if (!this.isPasswordRequired()) {
      const user = await this.usersService.ensureSingleAdmin(null);

      return this.usersService.toCurrentUser(user);
    }

    if (!token) {
      throw new UnauthorizedException('Missing auth token.');
    }

    const payload = this.tokenService.verify(token);
    const user = await this.usersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User is inactive or missing.');
    }

    return this.usersService.toCurrentUser(user);
  }

  async me(currentUser: CurrentUser): Promise<CurrentUser> {
    const user = await this.usersService.findActiveById(currentUser.id);

    if (!user) {
      throw new UnauthorizedException('User is inactive or missing.');
    }

    return this.usersService.toCurrentUser(user);
  }

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
