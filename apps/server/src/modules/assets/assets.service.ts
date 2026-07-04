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

/**
 * 素材服务：处理头像等文件上传与落库。
 *
 * 文件写入磁盘（uploads 目录），元数据入库；
 * 公开访问路径通过 main.ts 的静态资源映射暴露。
 */
@Injectable()
export class AssetsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * 上传角色头像：校验文件 → 写磁盘 → 入库。
   * @param currentUser 当前登录用户。
   * @param file multer 接收的上传文件（可能 undefined）。
   * @returns 创建后的素材响应。
   * @throws BadRequestException 文件未上传或不支持的类型。
   */
  async uploadCharacterAvatar(
    currentUser: CurrentUser,
    file: UploadedAvatarFile | undefined
  ): Promise<AssetResponse> {
    // 文件未上传（multer 未拦截到 file 字段）
    if (!file) {
      throw new BadRequestException({
        code: ERROR_CODES.ASSET_FILE_REQUIRED,
        message: 'Avatar file is required.'
      });
    }

    // 取 MIME 对应扩展名，不在允许列表则拒绝
    const extension = CHARACTER_AVATAR_MIME_EXTENSIONS[file.mimetype];

    if (!extension) {
      throw new BadRequestException({
        code: ERROR_CODES.ASSET_UNSUPPORTED_TYPE,
        message: 'Only jpeg, png, webp and gif images are supported.'
      });
    }

    // 确保上传目录存在（递归创建）
    await mkdir(CHARACTER_AVATAR_UPLOAD_ROOT, { recursive: true });

    // 生成唯一文件名（UUID + 扩展名）；后续 storagePath 用 / 分隔以便拼成 URL
    const fileName = `${randomUUID()}.${extension}`;
    const storagePath = join(CHARACTER_AVATAR_UPLOAD_PATH, fileName).replaceAll('\\', '/');
    const publicPath = `/uploads/${storagePath}`;

    // 写入磁盘
    await writeFile(join(CHARACTER_AVATAR_UPLOAD_ROOT, fileName), file.buffer);

    // 入库记录素材元数据
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

  /** 数据库记录 → 对外响应（格式化时间）。 */
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

/**
 * 清理原始文件名：取 basename 去路径、替换非法字符为 _（保留中文字符）、截断 160 字符。
 */
function sanitizeOriginalName(value: string): string {
  return basename(value).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(0, 160);
}
