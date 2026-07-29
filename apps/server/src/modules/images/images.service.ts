import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit
} from '@nestjs/common';
import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { UPLOADS_ROOT } from '../assets/assets.constants';
import type { CurrentUser } from '../users/user.types';

export type ImageFileResponse = {
  stream: ReturnType<typeof createReadStream>;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
};
type ConversationMessageImagesResponse = Array<{
  messageId: string;
  images: Array<{
    imageAssetId: string;
    batchId: string;
    orderIndex: number;
    fileUrl: string;
    width: number | null;
    height: number | null;
    createdAt: string;
  }>;
}>;
type ImageListItemResponse = {
  id: string;
  batchId: string;
  fileUrl: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sizeBytes: number;
  status: string;
  stylePreset: string;
  aspectRatio: string;
  modelName: string | null;
  sourceMessageSummary: string | null;
  isDisplayedInChat: boolean;
  createdAt: string;
};
type ImageListResponse = {
  items: ImageListItemResponse[];
  total: number;
  page: number;
  pageSize: number;
};
type AdminImageListResponse = {
  items: Array<ImageListItemResponse & { userId: string; username: string }>;
  total: number;
  page: number;
  pageSize: number;
};
type ImageDetailResponse = ImageListItemResponse & {
  conversationId: string | null;
  sourceMessageId: string | null;
  modelFallbackGroupId: string;
  providerModelId: string | null;
  scenePromptModelId: string | null;
  prompt: string | null;
  negativePrompt: string | null;
  parameters: Record<string, unknown> | null;
  providerMetadata: Record<string, unknown> | null;
  sceneSnapshot: Record<string, unknown> | null;
  sourceMessageContentHash: string;
  scenePromptVersion: string;
  promptCompilerVersion: string;
  invalidationReason: string | null;
};
type AdminImageDetailResponse = ImageListItemResponse & {
  userId: string;
  username: string;
  batchId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  modelFallbackGroupId: string;
  providerModelId: string | null;
  scenePromptModelId: string | null;
  promptHash: string | null;
  promptLength: number;
  sceneSnapshotHash: string | null;
  scenePromptInputHash: string | null;
  scenePromptOutputHash: string | null;
  sourceMessageContentHash: string;
  scenePromptVersion: string;
  promptCompilerVersion: string;
  errorCode: string | null;
  errorMessage: string | null;
};

@Injectable()
export class ImagesService implements OnModuleInit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupSoftDeletedFiles();
  }

  async messageImages(
    user: CurrentUser,
    conversationId: string
  ): Promise<ConversationMessageImagesResponse> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id, deletedAt: null },
      select: { id: true }
    });
    if (!conversation) throw this.notFound();
    const links = await this.prisma.messageImageLink.findMany({
      where: {
        status: 'active',
        message: {
          conversationId,
          deletedAt: null,
          status: { not: 'replaced' }
        },
        imageAsset: { userId: user.id, status: 'active' }
      },
      include: { imageAsset: true },
      orderBy: [{ messageId: 'asc' }, { imageAsset: { orderIndex: 'asc' } }]
    });
    const grouped = new Map<string, ConversationMessageImagesResponse[number]['images']>();
    for (const link of links) {
      const image = link.imageAsset;
      const items = grouped.get(link.messageId) ?? [];
      items.push({
        imageAssetId: image.id,
        batchId: image.batchId,
        orderIndex: image.orderIndex,
        fileUrl: `/api/images/${image.id}/file`,
        width: image.width,
        height: image.height,
        createdAt: image.createdAt.toISOString()
      });
      grouped.set(link.messageId, items);
    }
    return [...grouped.entries()].map(([messageId, images]) => ({ messageId, images }));
  }

  async list(
    user: CurrentUser,
    query: {
      page?: number;
      pageSize?: number;
      status?: string;
      stylePreset?: string;
      modelId?: string;
      createdFrom?: string;
      createdTo?: string;
    }
  ): Promise<ImageListResponse> {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where = {
      userId: user.id,
      ...(query.status ? { status: query.status } : { status: { not: 'deleted' } }),
      ...(query.stylePreset || query.modelId
        ? {
            batch: {
              ...(query.stylePreset ? { stylePreset: query.stylePreset } : {}),
              ...(query.modelId ? { providerModelId: query.modelId } : {})
            }
          }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {})
            }
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.imageAsset.findMany({
        where,
        include: {
          asset: true,
          batch: true,
          links: { where: { status: 'active' }, select: { id: true }, take: 1 }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.imageAsset.count({ where })
    ]);
    return {
      items: items.map((item) => this.toListItem(item)),
      total,
      page,
      pageSize
    };
  }

  async detail(user: CurrentUser, imageId: string): Promise<ImageDetailResponse> {
    const image = await this.prisma.imageAsset.findFirst({
      where: { id: imageId, userId: user.id, status: { not: 'deleted' } },
      include: {
        asset: true,
        batch: true,
        links: { orderBy: { updatedAt: 'desc' } }
      }
    });
    if (!image) throw this.notFound();
    const listItem = this.toListItem(image);
    const activeLink = image.links.find((link) => link.status === 'active');
    const latestLink = image.links[0];
    return {
      ...listItem,
      conversationId: image.batch.conversationId,
      sourceMessageId: image.batch.sourceMessageId,
      modelFallbackGroupId: image.batch.modelFallbackGroupId,
      providerModelId: image.batch.providerModelId,
      scenePromptModelId: image.batch.scenePromptModelId,
      prompt: image.batch.prompt,
      negativePrompt: image.batch.negativePrompt,
      parameters: this.parseRecord(image.batch.parametersJson),
      providerMetadata: this.parseRecord(image.batch.providerMetadataJson),
      sceneSnapshot: this.parseRecord(image.batch.sceneSnapshotJson),
      sourceMessageContentHash: image.batch.sourceMessageContentHash,
      scenePromptVersion: image.batch.scenePromptVersion,
      promptCompilerVersion: image.batch.promptCompilerVersion,
      invalidationReason: activeLink ? null : (latestLink?.reason ?? null)
    };
  }

  async adminList(
    user: CurrentUser,
    query: {
      page?: number;
      pageSize?: number;
      userId?: string;
      status?: string;
      modelId?: string;
      createdFrom?: string;
      createdTo?: string;
    }
  ): Promise<AdminImageListResponse> {
    this.assertAdmin(user);
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.modelId ? { batch: { providerModelId: query.modelId } } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {})
            }
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.imageAsset.findMany({
        where,
        include: {
          asset: true,
          batch: true,
          user: true,
          links: { where: { status: 'active' }, select: { id: true }, take: 1 }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.imageAsset.count({ where })
    ]);
    return {
      items: items.map((item) => ({
        ...this.toListItem(item),
        userId: item.userId,
        username: item.user.username
      })),
      total,
      page,
      pageSize
    };
  }

  async adminDetail(user: CurrentUser, imageId: string): Promise<AdminImageDetailResponse> {
    this.assertAdmin(user);
    const image = await this.prisma.imageAsset.findUnique({
      where: { id: imageId },
      include: {
        user: true,
        asset: true,
        batch: true,
        links: { where: { status: 'active' }, select: { id: true }, take: 1 }
      }
    });
    if (!image) throw this.notFound();
    return {
      ...this.toListItem(image),
      userId: image.userId,
      username: image.user.username,
      batchId: image.batch.id,
      conversationId: image.batch.conversationId,
      sourceMessageId: image.batch.sourceMessageId,
      modelFallbackGroupId: image.batch.modelFallbackGroupId,
      providerModelId: image.batch.providerModelId,
      scenePromptModelId: image.batch.scenePromptModelId,
      promptHash: image.batch.promptHash,
      promptLength: image.batch.prompt?.length ?? 0,
      sceneSnapshotHash: image.batch.sceneSnapshotHash,
      scenePromptInputHash: image.batch.scenePromptInputHash,
      scenePromptOutputHash: image.batch.scenePromptOutputHash,
      sourceMessageContentHash: image.batch.sourceMessageContentHash,
      scenePromptVersion: image.batch.scenePromptVersion,
      promptCompilerVersion: image.batch.promptCompilerVersion,
      errorCode: image.batch.errorCode,
      errorMessage: image.batch.errorMessage?.slice(0, 500) ?? null
    };
  }

  async file(user: CurrentUser, imageId: string): Promise<ImageFileResponse> {
    const image = await this.prisma.imageAsset.findUnique({
      where: { id: imageId },
      include: { asset: true }
    });
    if (!image || image.status === 'deleted') throw this.notFound();
    if (image.userId !== user.id && user.role !== 'admin') throw this.notFound();
    const absolutePath = this.resolveStoragePath(image.asset.storagePath);
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) throw this.notFound();
    return {
      stream: createReadStream(absolutePath),
      mimeType: image.asset.mimeType,
      sizeBytes: image.asset.sizeBytes,
      fileName: image.asset.fileName
    };
  }

  async remove(user: CurrentUser, imageId: string): Promise<{ deleted: true; id: string }> {
    const image = await this.prisma.imageAsset.findFirst({
      where: { id: imageId, userId: user.id, status: { not: 'deleted' } }
    });
    if (!image) throw this.notFound();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.messageImageLink.updateMany({
        where: { imageAssetId: imageId },
        data: { status: 'detached', reason: 'image_deleted' }
      }),
      this.prisma.imageAsset.update({ where: { id: imageId }, data: { status: 'deleted' } }),
      this.prisma.asset.update({ where: { id: image.assetId }, data: { deletedAt: now } })
    ]);
    return { deleted: true, id: imageId };
  }

  private async cleanupSoftDeletedFiles(): Promise<void> {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const assets = await this.prisma.asset.findMany({
      where: {
        kind: 'generated_image',
        deletedAt: { lt: threshold },
        imageAsset: { status: 'deleted' }
      },
      select: { id: true, storagePath: true }
    });
    for (const asset of assets) {
      const referenced = await this.prisma.imageAsset.count({
        where: { assetId: asset.id, status: { not: 'deleted' } }
      });
      if (referenced) continue;
      await unlink(this.resolveStoragePath(asset.storagePath)).catch(() => undefined);
    }
  }

  toListItem(image: {
    id: string;
    batchId: string;
    width: number | null;
    height: number | null;
    status: string;
    createdAt: Date;
    asset: { mimeType: string; sizeBytes: number };
    batch: {
      stylePreset: string;
      aspectRatio: string;
      providerModelId: string | null;
      providerMetadataJson: string | null;
      adminSafeSourceSummary: string | null;
    };
    links: { id: string }[];
  }): ImageListItemResponse {
    return {
      id: image.id,
      batchId: image.batchId,
      fileUrl: `/api/images/${image.id}/file`,
      width: image.width,
      height: image.height,
      mimeType: image.asset.mimeType,
      sizeBytes: image.asset.sizeBytes,
      status: image.status,
      stylePreset: image.batch.stylePreset as ImageDetailResponse['stylePreset'],
      aspectRatio: image.batch.aspectRatio as ImageDetailResponse['aspectRatio'],
      modelName:
        String(this.parseRecord(image.batch.providerMetadataJson)?.modelName ?? '') ||
        image.batch.providerModelId,
      sourceMessageSummary: image.batch.adminSafeSourceSummary,
      isDisplayedInChat: image.links.length > 0,
      createdAt: image.createdAt.toISOString()
    };
  }

  private resolveStoragePath(storagePath: string): string {
    const root = resolve(UPLOADS_ROOT);
    const candidate = resolve(root, storagePath);
    const fromRoot = relative(root, candidate);
    if (isAbsolute(fromRoot) || fromRoot.startsWith('..')) {
      throw new BadRequestException({
        code: 'IMAGE_STORAGE_FAILED',
        message: 'Invalid image storage path.'
      });
    }
    return candidate;
  }

  private parseRecord(value: string | null): Record<string, unknown> | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private assertAdmin(user: CurrentUser): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: ERROR_CODES.ADMIN_ROLE_REQUIRED,
        message: '仅管理员可以查看全站图片。'
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'IMAGE_NOT_FOUND',
      message: 'Image was not found.'
    });
  }
}
