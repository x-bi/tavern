import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit
} from '@nestjs/common';
import { Prisma, type ImageGenerationBatch } from '@prisma/client';
import type {
  ConversationImageGenerationConfig,
  ImageGenerationBatchResponse,
  ImageStylePreset,
  SceneImage
} from './image-generation.types';

import { canonicalSha256 } from '../../common/canonical-json';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SCENE_IMAGE_COMPILER_VERSION,
  SCENE_IMAGE_PROMPT_VERSION,
  SceneImagePromptService
} from '../../services/context-engine/scene-image-prompt.service';
import {
  ModelGatewayError,
  ModelGatewayService,
  type GeneratedImageOutput
} from '../../services/model-gateway';
import { UPLOADS_ROOT } from '../assets/assets.constants';
import { parseConversationImageGenerationConfig } from '../conversations/image-generation-config';
import { ModelsService } from '../models/models.service';
import type { ModelGatewayConfig } from '../models/model.types';
import type { CurrentUser } from '../users/user.types';

const RUNNING_STATUSES = [
  'pending',
  'building_prompt',
  'generating',
  'saving',
  'cancel_requested'
] as const;
const LEASE_MS = 5 * 60 * 1000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const GENERATED_IMAGE_PATH = 'generated-images';

type PreparedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
};

@Injectable()
export class ImageGenerationsService implements OnModuleInit {
  private readonly tasks = new Map<string, Promise<void>>();
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ModelsService) private readonly models: ModelsService,
    @Inject(ModelGatewayService) private readonly gateway: ModelGatewayService,
    @Inject(SceneImagePromptService) private readonly scenePrompt: SceneImagePromptService
  ) {}

  async onModuleInit(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.imageGenerationLease.findMany({
      where: { expiresAt: { lt: now } },
      select: { batchId: true }
    });
    const batchIds = expired.map((item) => item.batchId);
    await this.prisma.$transaction([
      this.prisma.imageGenerationBatch.updateMany({
        where: { id: { in: batchIds }, status: { in: [...RUNNING_STATUSES] } },
        data: {
          status: 'failed',
          errorCode: 'IMAGE_GENERATION_INTERRUPTED',
          errorMessage: 'Image generation was interrupted by a service restart.'
        }
      }),
      this.prisma.imageGenerationLease.deleteMany({ where: { batchId: { in: batchIds } } }),
      this.prisma.imageGenerationBatch.updateMany({
        where: {
          status: { in: [...RUNNING_STATUSES] },
          lease: null
        },
        data: {
          status: 'failed',
          errorCode: 'IMAGE_GENERATION_INTERRUPTED',
          errorMessage: 'Image generation was interrupted before it could be resumed.'
        }
      })
    ]);
  }

  async create(
    user: CurrentUser,
    messageId: string,
    requestId: string
  ): Promise<ImageGenerationBatchResponse> {
    const source = await this.findSource(user, messageId);
    const config = parseConversationImageGenerationConfig(
      source.conversation.imageGenerationConfigJson
    );
    const { chatCandidates, imageCandidates } = await this.resolveCandidates(
      user,
      source.conversation.modelFallbackGroupId,
      source.conversation.imageModelFallbackGroupId
    );
    const requestHash = canonicalSha256({
      purpose: 'chat_scene_generation',
      messageId,
      sourceHash: canonicalSha256(source.content),
      imageModelFallbackGroupId: source.conversation.imageModelFallbackGroupId,
      config
    });
    const existing = await this.prisma.imageGenerationBatch.findUnique({
      where: { userId_requestId: { userId: user.id, requestId } }
    });
    if (existing) {
      if (existing.requestHash !== requestHash) this.throwIdempotencyConflict();
      return this.get(user, existing.id);
    }
    const leaseId = randomUUID();
    let batch: ImageGenerationBatch;
    try {
      batch = await this.prisma.$transaction(async (tx) => {
        const expiredLease = await tx.imageGenerationLease.findFirst({
          where: { sourceMessageId: messageId, expiresAt: { lt: new Date() } },
          select: { batchId: true }
        });
        if (expiredLease) {
          await tx.imageGenerationBatch.updateMany({
            where: {
              id: expiredLease.batchId,
              status: { in: [...RUNNING_STATUSES] }
            },
            data: {
              status: 'failed',
              errorCode: 'IMAGE_GENERATION_INTERRUPTED',
              errorMessage: 'The previous image generation lease expired.'
            }
          });
        }
        await tx.imageGenerationLease.deleteMany({
          where: { sourceMessageId: messageId, expiresAt: { lt: new Date() } }
        });
        const created = await tx.imageGenerationBatch.create({
          data: {
            userId: user.id,
            conversationId: source.conversationId,
            sourceMessageId: messageId,
            requestId,
            requestHash,
            modelFallbackGroupId: source.conversation.imageModelFallbackGroupId!,
            status: 'pending',
            stylePreset: config.stylePreset,
            requestedImageCount: config.imageCount,
            aspectRatio: config.aspectRatio,
            sourceMessageContentHash: canonicalSha256(source.content),
            adminSafeSourceSummary: this.safeSummary(source.content),
            scenePromptVersion: SCENE_IMAGE_PROMPT_VERSION,
            promptCompilerVersion: SCENE_IMAGE_COMPILER_VERSION
          }
        });
        await tx.imageGenerationLease.create({
          data: {
            sourceMessageId: messageId,
            batchId: created.id,
            leaseId,
            expiresAt: new Date(Date.now() + LEASE_MS)
          }
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const retry = await this.prisma.imageGenerationBatch.findUnique({
          where: { userId_requestId: { userId: user.id, requestId } }
        });
        if (retry) {
          if (retry.requestHash !== requestHash) this.throwIdempotencyConflict();
          return this.get(user, retry.id);
        }
        throw new ConflictException({
          code: 'IMAGE_GENERATION_ALREADY_RUNNING',
          message: 'This message already has a running image generation.'
        });
      }
      throw error;
    }
    this.startTask(batch.id, leaseId, user, config, chatCandidates, imageCandidates);
    return this.get(user, batch.id);
  }

  async regenerate(
    user: CurrentUser,
    parentBatchId: string,
    requestId: string
  ): Promise<ImageGenerationBatchResponse> {
    const parent = await this.prisma.imageGenerationBatch.findFirst({
      where: { id: parentBatchId, userId: user.id },
      include: { sourceMessage: { include: { conversation: true } } }
    });
    if (!parent?.sourceMessage || !parent.sceneSnapshotJson || !parent.positivePromptBody) {
      throw new BadRequestException({
        code: 'IMAGE_GENERATION_BATCH_NOT_REGENERATABLE',
        message: 'This image batch cannot be regenerated.'
      });
    }
    if (canonicalSha256(parent.sourceMessage.content) !== parent.sourceMessageContentHash) {
      throw new BadRequestException({
        code: 'IMAGE_SOURCE_MESSAGE_CHANGED',
        message: 'The source message changed; generate a new scene image instead.'
      });
    }
    const config = parseConversationImageGenerationConfig(
      parent.sourceMessage.conversation.imageGenerationConfigJson
    );
    const { imageCandidates } = await this.resolveCandidates(
      user,
      parent.sourceMessage.conversation.modelFallbackGroupId,
      parent.sourceMessage.conversation.imageModelFallbackGroupId
    );
    const requestHash = canonicalSha256({
      purpose: 'chat_scene_regeneration',
      parentBatchId,
      sourceHash: parent.sourceMessageContentHash,
      config
    });
    const existing = await this.prisma.imageGenerationBatch.findUnique({
      where: { userId_requestId: { userId: user.id, requestId } }
    });
    if (existing) {
      if (existing.requestHash !== requestHash) this.throwIdempotencyConflict();
      return this.get(user, existing.id);
    }
    const snapshot = JSON.parse(parent.sceneSnapshotJson) as {
      style: { promptFragment: string; preset: ImageStylePreset };
    };
    const styleFragment = this.styleFragment(config.stylePreset);
    snapshot.style = { preset: config.stylePreset, promptFragment: styleFragment };
    const prompt = this.scenePrompt.compile(parent.positivePromptBody, styleFragment);
    const leaseId = randomUUID();
    let batch: ImageGenerationBatch;
    try {
      batch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.imageGenerationBatch.create({
          data: {
            userId: user.id,
            conversationId: parent.conversationId,
            sourceMessageId: parent.sourceMessageId,
            requestId,
            requestHash,
            modelFallbackGroupId: parent.sourceMessage!.conversation.imageModelFallbackGroupId!,
            status: 'pending',
            stylePreset: config.stylePreset,
            requestedImageCount: config.imageCount,
            aspectRatio: config.aspectRatio,
            prompt,
            promptHash: canonicalSha256(prompt),
            positivePromptBody: parent.positivePromptBody,
            negativePrompt: parent.negativePrompt,
            sceneSnapshotJson: JSON.stringify(snapshot),
            sceneSnapshotHash: canonicalSha256(snapshot),
            sourceMessageContentHash: parent.sourceMessageContentHash,
            adminSafeSourceSummary: parent.adminSafeSourceSummary,
            scenePromptVersion: parent.scenePromptVersion,
            scenePromptInputHash: parent.scenePromptInputHash,
            scenePromptOutputHash: parent.scenePromptOutputHash,
            scenePromptModelId: parent.scenePromptModelId,
            promptCompilerVersion: SCENE_IMAGE_COMPILER_VERSION,
            parentBatchId
          }
        });
        await tx.imageGenerationLease.create({
          data: {
            sourceMessageId: parent.sourceMessageId!,
            batchId: created.id,
            leaseId,
            expiresAt: new Date(Date.now() + LEASE_MS)
          }
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'IMAGE_GENERATION_ALREADY_RUNNING',
          message: 'This message already has a running image generation.'
        });
      }
      throw error;
    }
    this.startTask(batch.id, leaseId, user, config, [], imageCandidates);
    return this.get(user, batch.id);
  }

  async get(user: CurrentUser, batchId: string): Promise<ImageGenerationBatchResponse> {
    const batch = await this.prisma.imageGenerationBatch.findFirst({
      where: { id: batchId, userId: user.id },
      include: { images: { where: { status: 'active' }, orderBy: { orderIndex: 'asc' } } }
    });
    if (!batch) throw this.notFound();
    return this.toBatchResponse(batch);
  }

  async listByConversation(
    user: CurrentUser,
    conversationId: string,
    status?: string
  ): Promise<ImageGenerationBatchResponse[]> {
    const owned = await this.prisma.conversation.count({
      where: { id: conversationId, userId: user.id, deletedAt: null }
    });
    if (!owned) throw this.notFound();
    const batches = await this.prisma.imageGenerationBatch.findMany({
      where: {
        conversationId,
        userId: user.id,
        ...(status === 'running' ? { status: { in: [...RUNNING_STATUSES] } } : {})
      },
      include: { images: { where: { status: 'active' }, orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    return batches.map((batch) => this.toBatchResponse(batch));
  }

  async cancel(user: CurrentUser, batchId: string): Promise<ImageGenerationBatchResponse> {
    const batch = await this.prisma.imageGenerationBatch.findFirst({
      where: { id: batchId, userId: user.id }
    });
    if (!batch) throw this.notFound();
    if (!RUNNING_STATUSES.includes(batch.status as (typeof RUNNING_STATUSES)[number])) {
      return this.get(user, batchId);
    }
    await this.prisma.imageGenerationBatch.update({
      where: { id: batchId },
      data: { status: 'cancel_requested', cancelRequestedAt: new Date() }
    });
    this.abortControllers.get(batchId)?.abort();
    return this.get(user, batchId);
  }

  private startTask(
    batchId: string,
    leaseId: string,
    user: CurrentUser,
    config: ConversationImageGenerationConfig,
    chatCandidates: ModelGatewayConfig[],
    imageCandidates: ModelGatewayConfig[]
  ): void {
    const controller = new AbortController();
    this.abortControllers.set(batchId, controller);
    const task = this.execute(
      batchId,
      leaseId,
      user,
      config,
      chatCandidates,
      imageCandidates,
      controller.signal
    )
      .catch((error) => this.fail(batchId, leaseId, error))
      .finally(() => {
        this.tasks.delete(batchId);
        this.abortControllers.delete(batchId);
      });
    this.tasks.set(batchId, task);
  }

  private async execute(
    batchId: string,
    leaseId: string,
    user: CurrentUser,
    config: ConversationImageGenerationConfig,
    chatCandidates: ModelGatewayConfig[],
    imageCandidates: ModelGatewayConfig[],
    signal: AbortSignal
  ): Promise<void> {
    let batch = await this.assertLease(batchId, leaseId);
    if (!batch.prompt) {
      await this.setStage(batchId, leaseId, 'building_prompt');
      const promptResult = await this.scenePrompt.build({
        userId: user.id,
        sourceMessageId: batch.sourceMessageId!,
        config,
        candidates: chatCandidates,
        signal
      });
      await this.prisma.imageGenerationBatch.update({
        where: { id: batchId },
        data: {
          prompt: promptResult.prompt,
          promptHash: promptResult.promptHash,
          positivePromptBody: promptResult.positivePromptBody,
          negativePrompt: promptResult.negativePrompt,
          sceneSnapshotJson: JSON.stringify(promptResult.sceneSnapshot),
          sceneSnapshotHash: promptResult.sceneSnapshotHash,
          scenePromptInputHash: promptResult.scenePromptInputHash,
          scenePromptOutputHash: promptResult.scenePromptOutputHash,
          scenePromptModelId: promptResult.scenePromptModelId,
          parametersJson: JSON.stringify({
            imageCount: config.imageCount,
            aspectRatio: config.aspectRatio,
            stylePreset: config.stylePreset
          })
        }
      });
      batch = await this.assertLease(batchId, leaseId);
    }
    this.throwIfAborted(signal);
    await this.setStage(batchId, leaseId, 'generating');
    const generated = await this.generateWithFallback(
      imageCandidates,
      batch.prompt!,
      batch.negativePrompt,
      config,
      signal
    );
    await this.setStage(batchId, leaseId, 'saving');
    const savedIds: string[] = [];
    const saveErrors: string[] = [];
    for (let index = 0; index < generated.outputs.length; index += 1) {
      try {
        const prepared = await this.prepareImage(generated.outputs[index]!, signal);
        const image = await this.saveImage(user.id, batchId, prepared, index);
        savedIds.push(image.id);
      } catch (error) {
        saveErrors.push(this.safeErrorMessage(error));
      }
    }
    if (savedIds.length === 0) {
      throw new BadRequestException({
        code: 'IMAGE_INVALID_CONTENT',
        message: saveErrors[0] ?? 'No generated image could be saved.'
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const lease = await tx.imageGenerationLease.findUnique({
        where: { sourceMessageId: batch.sourceMessageId! }
      });
      if (!lease || lease.leaseId !== leaseId) throw this.interrupted();
      await tx.messageImageLink.updateMany({
        where: { messageId: batch.sourceMessageId!, status: 'active' },
        data: { status: 'hidden', reason: 'new_image_generation' }
      });
      await tx.messageImageLink.createMany({
        data: savedIds.map((imageAssetId) => ({
          messageId: batch.sourceMessageId!,
          imageAssetId,
          status: 'active',
          reason: 'generated'
        }))
      });
      await tx.imageGenerationBatch.update({
        where: { id: batchId },
        data: {
          status:
            savedIds.length === config.imageCount && saveErrors.length === 0
              ? 'succeeded'
              : 'partially_succeeded',
          providerModelId: generated.candidate.providerModelId,
          providerMetadataJson: JSON.stringify({
            modelName: generated.candidate.modelName,
            providerName: generated.candidate.providerName,
            successCount: savedIds.length,
            errors: saveErrors
          }),
          errorCode: saveErrors.length ? 'IMAGE_PARTIAL_SAVE_FAILED' : null,
          errorMessage: saveErrors.length ? saveErrors.join('; ').slice(0, 1000) : null
        }
      });
      await tx.imageGenerationLease.delete({ where: { sourceMessageId: batch.sourceMessageId! } });
    });
  }

  private async generateWithFallback(
    candidates: ModelGatewayConfig[],
    prompt: string,
    negativePrompt: string | null,
    config: ConversationImageGenerationConfig,
    signal: AbortSignal
  ): Promise<{ outputs: GeneratedImageOutput[]; candidate: ModelGatewayConfig }> {
    for (const candidate of candidates) {
      try {
        const result = await this.gateway.generateImage({
          providerName: candidate.providerName,
          baseUrl: candidate.baseUrl,
          modelName: candidate.modelName,
          apiKey: candidate.apiKey,
          timeout: candidate.params.timeout,
          requestSource: 'chat_scene_image',
          prompt,
          options: {
            imageCount: config.imageCount,
            aspectRatio: config.aspectRatio,
            ...(negativePrompt ? { negativePrompt } : {})
          },
          signal
        });
        if (result.images.length > 0) return { outputs: result.images, candidate };
      } catch (error) {
        if (signal.aborted) throw error;
        if (!(error instanceof ModelGatewayError)) throw error;
      }
    }
    throw new BadRequestException({
      code: 'IMAGE_PROVIDER_EMPTY_RESULT',
      message: 'All configured image models failed to generate an image.'
    });
  }

  private async prepareImage(
    output: GeneratedImageOutput,
    signal: AbortSignal
  ): Promise<PreparedImage> {
    let buffer = output.data;
    let declaredMime = output.mimeType;
    if (!buffer && output.remoteUrl) {
      await this.assertSafeRemoteImageUrl(output.remoteUrl);
      const response = await fetch(output.remoteUrl, { signal });
      if (!response.ok) {
        throw new BadRequestException({
          code: 'IMAGE_DOWNLOAD_FAILED',
          message: `Generated image download failed with HTTP ${response.status}.`
        });
      }
      declaredMime = response.headers.get('content-type')?.split(';')[0] ?? declaredMime;
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_IMAGE_BYTES) this.throwFileTooLarge();
      buffer = Buffer.from(await response.arrayBuffer());
    }
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException({
        code: 'IMAGE_INVALID_CONTENT',
        message: 'Generated image is empty.'
      });
    }
    if (buffer.length > MAX_IMAGE_BYTES) this.throwFileTooLarge();
    const detected = detectImage(buffer);
    if (!detected || (declaredMime && declaredMime !== detected.mimeType)) {
      throw new BadRequestException({
        code: 'IMAGE_INVALID_CONTENT',
        message: 'Generated content is not a supported image or MIME does not match.'
      });
    }
    return { buffer, ...detected };
  }

  private async saveImage(
    userId: string,
    batchId: string,
    image: PreparedImage,
    orderIndex: number
  ) {
    const uploadRoot = join(UPLOADS_ROOT, GENERATED_IMAGE_PATH);
    await mkdir(uploadRoot, { recursive: true });
    const fileName = `${randomUUID()}.${image.extension}`;
    const storagePath = `${GENERATED_IMAGE_PATH}/${fileName}`;
    await writeFile(join(uploadRoot, fileName), image.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            userId,
            kind: 'generated_image',
            fileName,
            originalName: null,
            mimeType: image.mimeType,
            extension: image.extension,
            sizeBytes: image.buffer.length,
            storagePath,
            publicPath: null
          }
        });
        return tx.imageAsset.create({
          data: {
            userId,
            batchId,
            assetId: asset.id,
            width: image.width,
            height: image.height,
            orderIndex
          }
        });
      });
    } catch (error) {
      await unlink(join(uploadRoot, fileName)).catch(() => undefined);
      throw new BadRequestException({
        code: 'IMAGE_STORAGE_FAILED',
        message: this.safeErrorMessage(error)
      });
    }
  }

  private async assertSafeRemoteImageUrl(value: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException({
        code: 'IMAGE_DOWNLOAD_FAILED',
        message: 'Image provider returned an invalid download URL.'
      });
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new BadRequestException({
        code: 'IMAGE_DOWNLOAD_FAILED',
        message: 'Generated image download URL must use HTTPS without embedded credentials.'
      });
    }
    const addresses = isIP(url.hostname)
      ? [{ address: url.hostname }]
      : await lookup(url.hostname, { all: true }).catch(() => []);
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateOrReservedAddress(address))
    ) {
      throw new BadRequestException({
        code: 'IMAGE_DOWNLOAD_FAILED',
        message: 'Generated image download URL resolves to a private or reserved address.'
      });
    }
  }

  private async resolveCandidates(
    user: CurrentUser,
    chatGroupId: string | null,
    imageGroupId: string | null
  ): Promise<{ chatCandidates: ModelGatewayConfig[]; imageCandidates: ModelGatewayConfig[] }> {
    if (!chatGroupId) {
      throw new BadRequestException({
        code: 'IMAGE_SCENE_PROMPT_MODEL_NOT_CONFIGURED',
        message: '请先在会话设置中选择可用的聊天模型链'
      });
    }
    if (!imageGroupId) {
      throw new BadRequestException({
        code: 'IMAGE_MODEL_NOT_CONFIGURED',
        message: '请先在会话设置中选择可用的生图模型链'
      });
    }
    const [chatCandidates, imageCandidates] = await Promise.all([
      this.models.getGatewayCandidates({
        currentUser: user,
        capability: 'chat',
        modelFallbackGroupId: chatGroupId
      }),
      this.models.getGatewayCandidates({
        currentUser: user,
        capability: 'image',
        modelFallbackGroupId: imageGroupId
      })
    ]);
    if (chatCandidates.length === 0) {
      throw new BadRequestException({
        code: 'IMAGE_SCENE_PROMPT_MODEL_NOT_CONFIGURED',
        message: '请先在会话设置中选择可用的聊天模型链'
      });
    }
    if (imageCandidates.length === 0) {
      throw new BadRequestException({
        code: 'IMAGE_MODEL_NOT_CONFIGURED',
        message: '请先在会话设置中选择可用的生图模型链'
      });
    }
    return { chatCandidates, imageCandidates };
  }

  private async findSource(user: CurrentUser, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, deletedAt: null, conversation: { userId: user.id, deletedAt: null } },
      include: { conversation: true }
    });
    if (!message) throw this.notFound();
    if (message.role !== 'assistant') {
      throw new BadRequestException({
        code: 'IMAGE_MESSAGE_NOT_ASSISTANT',
        message: 'Only assistant messages can generate scene images.'
      });
    }
    if (message.status !== 'complete') {
      throw new BadRequestException({
        code: 'IMAGE_MESSAGE_NOT_COMPLETE',
        message: 'Only completed assistant messages can generate scene images.'
      });
    }
    return message;
  }

  private async setStage(batchId: string, leaseId: string, status: string): Promise<void> {
    const batch = await this.assertLease(batchId, leaseId);
    if (batch.cancelRequestedAt) throw this.cancelled();
    await this.prisma.$transaction([
      this.prisma.imageGenerationBatch.update({ where: { id: batchId }, data: { status } }),
      this.prisma.imageGenerationLease.update({
        where: { sourceMessageId: batch.sourceMessageId! },
        data: { expiresAt: new Date(Date.now() + LEASE_MS) }
      })
    ]);
  }

  private async assertLease(batchId: string, leaseId: string) {
    const batch = await this.prisma.imageGenerationBatch.findUnique({
      where: { id: batchId },
      include: { lease: true }
    });
    if (!batch?.lease || batch.lease.leaseId !== leaseId) throw this.interrupted();
    return batch;
  }

  private async fail(batchId: string, leaseId: string, error: unknown): Promise<void> {
    const batch = await this.prisma.imageGenerationBatch.findUnique({
      where: { id: batchId },
      include: { _count: { select: { images: true } } }
    });
    if (!batch) return;
    const cancelled =
      batch.cancelRequestedAt !== null ||
      (error instanceof Error && error.name === 'AbortError') ||
      (error instanceof BadRequestException &&
        (error.getResponse() as { code?: string }).code === 'IMAGE_GENERATION_ABORTED');
    const lease = batch.sourceMessageId
      ? await this.prisma.imageGenerationLease.findUnique({
          where: { sourceMessageId: batch.sourceMessageId }
        })
      : null;
    if (!lease || lease.leaseId !== leaseId) return;
    const partial = batch._count.images > 0;
    await this.prisma.$transaction([
      this.prisma.imageGenerationBatch.update({
        where: { id: batchId },
        data: {
          status: partial ? 'partially_succeeded' : cancelled ? 'cancelled' : 'failed',
          errorCode: cancelled ? 'IMAGE_GENERATION_ABORTED' : this.errorCode(error),
          errorMessage: this.safeErrorMessage(error)
        }
      }),
      this.prisma.imageGenerationLease.delete({
        where: { sourceMessageId: batch.sourceMessageId! }
      })
    ]);
  }

  private toBatchResponse(
    batch: ImageGenerationBatch & {
      images: Array<{
        id: string;
        batchId: string;
        orderIndex: number;
        width: number | null;
        height: number | null;
        createdAt: Date;
      }>;
    }
  ): ImageGenerationBatchResponse {
    const images: SceneImage[] = batch.images.map((image) => ({
      imageAssetId: image.id,
      batchId: image.batchId,
      orderIndex: image.orderIndex,
      fileUrl: `/api/images/${image.id}/file`,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt.toISOString()
    }));
    return {
      id: batch.id,
      conversationId: batch.conversationId,
      sourceMessageId: batch.sourceMessageId,
      parentBatchId: batch.parentBatchId,
      status: batch.status as ImageGenerationBatchResponse['status'],
      stylePreset: batch.stylePreset as ImageGenerationBatchResponse['stylePreset'],
      requestedImageCount: batch.requestedImageCount,
      aspectRatio: batch.aspectRatio as ImageGenerationBatchResponse['aspectRatio'],
      errorCode: batch.errorCode,
      errorMessage: batch.errorMessage,
      canCancel: RUNNING_STATUSES.includes(batch.status as (typeof RUNNING_STATUSES)[number]),
      images,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString()
    };
  }

  private safeSummary(value: string): string {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[REDACTED]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
      .replace(/\b1[3-9]\d{9}\b/g, '[PHONE]')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 240);
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'object' && response && 'message' in response) {
        return String((response as { message: unknown }).message).slice(0, 1000);
      }
    }
    return error instanceof Error ? error.message.slice(0, 1000) : 'Image generation failed.';
  }

  private errorCode(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'object' && response && 'code' in response) {
        return String((response as { code: unknown }).code);
      }
    }
    if (error instanceof ModelGatewayError) return error.code;
    return 'IMAGE_GENERATION_FAILED';
  }

  private throwIdempotencyConflict(): never {
    throw new ConflictException({
      code: 'IMAGE_GENERATION_IDEMPOTENCY_CONFLICT',
      message: 'The requestId was already used for a different image generation request.'
    });
  }

  private throwFileTooLarge(): never {
    throw new BadRequestException({
      code: 'IMAGE_FILE_TOO_LARGE',
      message: `Generated image exceeds ${MAX_IMAGE_BYTES} bytes.`
    });
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw this.cancelled();
  }

  private cancelled(): BadRequestException {
    return new BadRequestException({
      code: 'IMAGE_GENERATION_ABORTED',
      message: 'Image generation was cancelled.'
    });
  }

  private interrupted(): ConflictException {
    return new ConflictException({
      code: 'IMAGE_GENERATION_INTERRUPTED',
      message: 'Image generation lease is no longer owned by this task.'
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'IMAGE_GENERATION_BATCH_NOT_FOUND',
      message: 'Image generation resource was not found.'
    });
  }

  private styleFragment(style: ImageStylePreset): string {
    const map: Record<ImageStylePreset, string> = {
      auto: '根据当前场景选择统一、自然且具有叙事感的视觉风格',
      anime: '动漫插画风格，清晰线条，细腻上色，人物表情自然',
      realistic: '写实摄影风格，自然光影，真实材质，人物比例自然',
      cinematic: '电影感构图，叙事性镜头，层次光影，具有沉浸感',
      illustration: '高质量叙事插画，画面完整，细节丰富，统一美术风格',
      fantasy: '奇幻概念插画，富有想象力的环境设计，氛围感强'
    };
    return map[style];
  }
}

function detectImage(buffer: Buffer): Omit<PreparedImage, 'buffer'> | null {
  if (
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return {
      mimeType: 'image/png',
      extension: 'png',
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }
  if (
    buffer.length >= 10 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return {
      mimeType: 'image/gif',
      extension: 'gif',
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8)
    };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const dimensions = readWebpDimensions(buffer);
    return dimensions ? { mimeType: 'image/webp', extension: 'webp', ...dimensions } : null;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const dimensions = readJpegDimensions(buffer);
    return dimensions ? { mimeType: 'image/jpeg', extension: 'jpg', ...dimensions } : null;
  }
  return null;
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker
      )
    ) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  const type = buffer.subarray(12, 16).toString('ascii');
  if (type === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (type === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function isPrivateOrReservedAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true;
  }
  const ipv4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  const parts = ipv4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0]! >= 224 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1]! >= 64 && parts[1]! <= 127)
  );
}
