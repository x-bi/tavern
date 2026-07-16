import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';

import type { AuthRequest } from '../auth/auth.types';
import { UsersService } from '../users/users.service';

/** 模型管理接口统一切换到共享管理员归属，不按登录账号分库。 */
@Injectable()
export class SharedModelsGuard implements CanActivate {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.currentUser = await this.usersService.getSharedModelOwner();
    return true;
  }
}
