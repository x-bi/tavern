import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UnsupportedMediaTypeException,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../users/user.types';
import {
  CHARACTER_AVATAR_MAX_SIZE_BYTES,
  CHARACTER_AVATAR_MIME_EXTENSIONS
} from './assets.constants';
import { AssetsService } from './assets.service';
import type { UploadedAvatarFile } from './asset.types';

/**
 * 头像上传的 multer 配置：
 * - limits：单文件、最大 2MB；
 * - fileFilter：只允许 jpeg/png/webp/gif，其余抛 415。
 */
const avatarUploadOptions: MulterOptions = {
  limits: {
    fileSize: CHARACTER_AVATAR_MAX_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_request, file, callback) => {
    // mimetype 不在允许列表 → 拒绝并抛 415
    if (!CHARACTER_AVATAR_MIME_EXTENSIONS[file.mimetype]) {
      callback(
        new UnsupportedMediaTypeException({
          code: ERROR_CODES.ASSET_UNSUPPORTED_TYPE,
          message: 'Only jpeg, png, webp and gif images are supported.'
        }),
        false
      );
      return;
    }

    callback(null, true);
  }
};

/**
 * 素材控制器，路由前缀 `/assets`，需登录。
 *
 * 上传校验在 multer 拦截器层完成（fileFilter + limits），通过后才进入 service。
 */
@Controller('assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(
    @Inject(AssetsService)
    private readonly assetsService: AssetsService
  ) {}

  /** 上传角色头像。POST /assets/upload，字段名 file，multer 接收单文件。 */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  uploadCharacterAvatar(
    @CurrentUser() currentUser: CurrentUserType,
    @UploadedFile() file: UploadedAvatarFile | undefined
  ) {
    return this.assetsService.uploadCharacterAvatar(currentUser, file);
  }
}
