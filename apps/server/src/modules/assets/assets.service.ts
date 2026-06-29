import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Asset } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import {
  CHARACTER_AVATAR_KIND,
  CHARACTER_AVATAR_MIME_EXTENSIONS,
  CHARACTER_AVATAR_UPLOAD_PATH,
  CHARACTER_AVATAR_UPLOAD_ROOT
} from './assets.constants';
import type { AssetResponse, UploadedAvatarFile } from './asset.types';

@Injectable()
export class AssetsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async uploadCharacterAvatar(
    currentUser: CurrentUser,
    file: UploadedAvatarFile | undefined
  ): Promise<AssetResponse> {
    if (!file) {
      throw new BadRequestException({
        code: ERROR_CODES.ASSET_FILE_REQUIRED,
        message: 'Avatar file is required.'
      });
    }

    const extension = CHARACTER_AVATAR_MIME_EXTENSIONS[file.mimetype];

    if (!extension) {
      throw new BadRequestException({
        code: ERROR_CODES.ASSET_UNSUPPORTED_TYPE,
        message: 'Only jpeg, png, webp and gif images are supported.'
      });
    }

    await mkdir(CHARACTER_AVATAR_UPLOAD_ROOT, { recursive: true });

    const fileName = `${randomUUID()}.${extension}`;
    const storagePath = join(CHARACTER_AVATAR_UPLOAD_PATH, fileName).replaceAll('\\', '/');
    const publicPath = `/uploads/${storagePath}`;

    await writeFile(join(CHARACTER_AVATAR_UPLOAD_ROOT, fileName), file.buffer);

    const asset = await this.prisma.asset.create({
      data: {
        userId: currentUser.id,
        kind: CHARACTER_AVATAR_KIND,
        fileName,
        originalName: sanitizeOriginalName(file.originalname),
        mimeType: file.mimetype,
        extension,
        sizeBytes: file.size,
        storagePath,
        publicPath
      }
    });

    return this.toResponse(asset);
  }

  private toResponse(asset: Asset): AssetResponse {
    return {
      id: asset.id,
      userId: asset.userId,
      kind: asset.kind,
      fileName: asset.fileName,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      extension: asset.extension,
      sizeBytes: asset.sizeBytes,
      publicPath: asset.publicPath,
      createdAt: asset.createdAt.toISOString()
    };
  }
}

function sanitizeOriginalName(value: string): string {
  return basename(value).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(0, 160);
}
