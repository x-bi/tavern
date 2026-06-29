import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';

import { AuthService } from './auth.service';
import type { AuthRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const currentUser = await this.authService.getCurrentUserFromRequestToken(
      this.extractBearerToken(request)
    );

    request.currentUser = currentUser;

    return true;
  }

  private extractBearerToken(request: AuthRequest): string | null {
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;

    if (!value) {
      return null;
    }

    const [type, token] = value.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header.');
    }

    return token;
  }
}
