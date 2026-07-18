import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../../common/dto/error-codes';
import type { CurrentUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import type { ContentLibraryAccess, ContentLibraryScope } from './content-library.types';

/** 固定管理员内容库的归属、查询范围与共享标记写权限。 */
@Injectable()
export class ContentLibraryService {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService
  ) {}

  async resolveAccess(
    currentUser: CurrentUser,
    scope: ContentLibraryScope = 'owned'
  ): Promise<ContentLibraryAccess> {
    const owner =
      scope === 'library' ? await this.usersService.getContentLibraryOwner() : currentUser;
    const isOwner = owner.id === currentUser.id;

    return {
      owner,
      isOwner,
      ownerName: isOwner ? null : owner.displayName
    };
  }

  async assertCanSetShared(currentUser: CurrentUser, value: boolean | undefined): Promise<void> {
    if (value === undefined || (await this.usersService.isContentLibraryOwner(currentUser))) {
      return;
    }

    throw new ForbiddenException({
      code: ERROR_CODES.CONTENT_LIBRARY_OWNER_REQUIRED,
      message: 'Only the built-in content library administrator can change shared content.'
    });
  }

  async getOwner(): Promise<CurrentUser> {
    return this.usersService.getContentLibraryOwner();
  }
}
