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

const avatarUploadOptions: MulterOptions = {
  limits: {
    fileSize: CHARACTER_AVATAR_MAX_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_request, file, callback) => {
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

@Controller('assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(
    @Inject(AssetsService)
    private readonly assetsService: AssetsService
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  uploadCharacterAvatar(
    @CurrentUser() currentUser: CurrentUserType,
    @UploadedFile() file: UploadedAvatarFile | undefined
  ) {
    return this.assetsService.uploadCharacterAvatar(currentUser, file);
  }
}
