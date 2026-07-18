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
    if (scope === 'managed') {
      if (currentUser.role !== 'admin') {
        throw new ForbiddenException({
          code: ERROR_CODES.ADMIN_ROLE_REQUIRED,
          message: 'Only administrators can inspect member content.'
        });
      }

      return {
        owner: null,
        isOwner: false,
        ownerName: null,
        isManaged: true
      };
    }

    const owner =
      scope === 'library' ? await this.usersService.getContentLibraryOwner() : currentUser;
    const isOwner = owner.id === currentUser.id;

    return {
      owner,
      isOwner,
      ownerName: isOwner ? null : owner.displayName,
      isManaged: false
    };
  }

  /** 批量解析管理员审计列表中的内容归属人名称。 */
  async getOwnerNameMap(userIds: string[]): Promise<Map<string, string>> {
    return this.usersService.getDisplayNamesByIds(userIds);
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
