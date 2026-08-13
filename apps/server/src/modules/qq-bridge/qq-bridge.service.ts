import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type QqAccount, type QqChatBinding } from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';
import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import { ChatService } from '../chat/chat.service';
import { CompanionChatService } from '../companion-chat/companion-chat.service';
import type { CurrentUser } from '../users/user.types';
import type { CreateQqAccountDto, UpdateQqAccountDto } from './dto/qq-account.dto';
import type { CreateQqBindingDto, UpdateQqBindingDto } from './dto/qq-binding.dto';
import { extractOneBotText, isPrivateFriendMessage, splitQqText } from './qq-message.utils';
import { QqNapcatClient } from './qq-napcat.client';
import { InternalChatResponse } from './qq-bridge.types';

type QqTargetType = 'conversation' | 'companion';
type QqAccountItem = {
  id: string;
  label: string;
  apiBaseUrl: string;
  webUiUrl: string | null;
  qqUin: string | null;
  nickname: string | null;
  accessTokenMask: string | null;
  hasAccessToken: boolean;
  status: 'unknown' | 'online' | 'offline' | 'error';
  isEnabled: boolean;
  callbackUrl: string;
  lastConnectedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
type QqConnectionTestResult = {
  ok: boolean;
  qqUin: string | null;
  nickname: string | null;
  message: string;
};
type QqLoginStatus = {
  state: 'waiting' | 'online';
  account: QqAccountItem | null;
  qrCodeDataUrl: string | null;
  qrCodeUpdatedAt: string | null;
  message: string;
};
type QqTargetItem = {
  targetType: QqTargetType;
  targetId: string;
  title: string;
  subtitle: string | null;
  bindingId: string | null;
  boundPeerQqUin: string | null;
  boundPeerNickname: string | null;
};
type QqChatBindingItem = {
  id: string;
  qqAccountId: string;
  accountLabel: string;
  accountQqUin: string | null;
  peerQqUin: string;
  peerNickname: string | null;
  targetType: QqTargetType;
  targetId: string;
  targetTitle: string;
  isEnabled: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class QqBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly encryptionKey: Buffer;
  private readonly inboundQueues = new Map<string, Promise<void>>();
  private readonly deliveryTasks = new Set<string>();
  private unsubscribeEvents: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private suppressedAutoLoginQqUin: string | null = null;
  private ignoreQrBeforeMs = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(QqNapcatClient) private readonly napcat: QqNapcatClient,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(CompanionChatService) private readonly companionChat: CompanionChatService,
    @Inject(TargetEventsService) private readonly targetEvents: TargetEventsService
  ) {
    this.encryptionKey = createHash('sha256')
      .update(this.config.getOrThrow<string>('AUTH_TOKEN_SECRET'))
      .digest();
  }

  async onModuleInit(): Promise<void> {
    await this.prisma.qqInboundEvent.updateMany({
      where: { status: 'processing' },
      data: { status: 'pending', nextRetryAt: new Date() }
    });
    await this.prisma.qqDelivery.updateMany({
      where: { status: 'sending' },
      data: { status: 'failed', nextRetryAt: new Date() }
    });
    this.unsubscribeEvents = this.targetEvents.subscribeAll((event) => {
      if (event.event !== 'generation_done') return;
      const messageId = typeof event.data.messageId === 'string' ? event.data.messageId : null;
      if (messageId) void this.scheduleDelivery(event.targetType, event.targetId, messageId);
    });
    this.retryTimer = setInterval(() => void this.scanPendingWork(), 10_000);
    void this.scanPendingWork();
  }

  onModuleDestroy(): void {
    this.unsubscribeEvents?.();
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  async getAutoLoginStatus(user: CurrentUser): Promise<QqLoginStatus> {
    this.assertAdmin(user);
    const apiBaseUrl = this.normalizeHttpUrl(
      this.config.get<string>('QQ_AUTO_NAPCAT_API_BASE_URL') ?? 'http://127.0.0.1:3000'
    );
    let loginInfo: { qqUin: string; nickname: string | null };
    try {
      loginInfo = await this.napcat.getLoginInfo(apiBaseUrl, null);
    } catch {
      this.suppressedAutoLoginQqUin = null;
      const qrCode = await this.readLoginQrCode();
      return {
        state: 'waiting',
        account: null,
        qrCodeDataUrl: qrCode?.dataUrl ?? null,
        qrCodeUpdatedAt: qrCode?.updatedAt ?? null,
        message: qrCode
          ? '请使用手机 QQ 扫描二维码并确认登录，成功后账号会自动创建。'
          : 'NapCat 正在启动或等待生成登录二维码，请稍后刷新。'
      };
    }
    if (loginInfo.qqUin === this.suppressedAutoLoginQqUin) {
      return {
        state: 'waiting',
        account: null,
        qrCodeDataUrl: null,
        qrCodeUpdatedAt: null,
        message: `QQ ${loginInfo.qqUin} 正在退出，请稍后等待新的登录二维码。`
      };
    }
    this.suppressedAutoLoginQqUin = null;
    const account = await this.upsertAutoAccount(user, apiBaseUrl, loginInfo);
    return {
      state: 'online',
      account: this.toAccountItem(account),
      qrCodeDataUrl: null,
      qrCodeUpdatedAt: null,
      message: `QQ ${loginInfo.qqUin} 已登录并完成接入。`
    };
  }

  async listAccounts(user: CurrentUser) {
    const items = await this.prisma.qqAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    return this.page(items.map((item) => this.toAccountItem(item)));
  }

  async createAccount(user: CurrentUser, dto: CreateQqAccountDto): Promise<QqAccountItem> {
    const accessToken = this.normalizeSecret(dto.accessToken);
    try {
      const account = await this.prisma.qqAccount.create({
        data: {
          userId: user.id,
          label: dto.label.trim(),
          apiBaseUrl: this.normalizeHttpUrl(dto.apiBaseUrl),
          webUiUrl: dto.webUiUrl ? this.normalizeHttpUrl(dto.webUiUrl) : null,
          accessTokenCiphertext: this.encryptSecret(accessToken),
          accessTokenMask: this.maskSecret(accessToken),
          isEnabled: dto.isEnabled ?? true
        }
      });
      return this.toAccountItem(account);
    } catch (error) {
      this.throwAccountUnique(error);
      throw error;
    }
  }

  async updateAccount(
    user: CurrentUser,
    id: string,
    dto: UpdateQqAccountDto
  ): Promise<QqAccountItem> {
    const existing = await this.findOwnedAccount(user, id);
    const accessToken =
      dto.accessToken === undefined ? undefined : this.normalizeSecret(dto.accessToken);
    try {
      const account = await this.prisma.qqAccount.update({
        where: { id: existing.id },
        data: {
          ...(dto.label === undefined ? {} : { label: dto.label.trim() }),
          ...(dto.apiBaseUrl === undefined
            ? {}
            : { apiBaseUrl: this.normalizeHttpUrl(dto.apiBaseUrl) }),
          ...(dto.webUiUrl === undefined
            ? {}
            : { webUiUrl: dto.webUiUrl ? this.normalizeHttpUrl(dto.webUiUrl) : null }),
          ...(accessToken === undefined
            ? {}
            : {
                accessTokenCiphertext: this.encryptSecret(accessToken),
                accessTokenMask: this.maskSecret(accessToken)
              }),
          ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled })
        }
      });
      return this.toAccountItem(account);
    } catch (error) {
      this.throwAccountUnique(error);
      throw error;
    }
  }

  async deleteAccount(user: CurrentUser, id: string) {
    const account = await this.findOwnedAccount(user, id);
    await this.prisma.qqAccount.delete({ where: { id: account.id } });
    return { deleted: true, id };
  }

  async testAccount(user: CurrentUser, id: string): Promise<QqConnectionTestResult> {
    const account = await this.findOwnedAccount(user, id);
    try {
      const info = await this.napcat.getLoginInfo(
        account.apiBaseUrl,
        this.decryptSecret(account.accessTokenCiphertext)
      );
      await this.prisma.qqAccount.update({
        where: { id },
        data: {
          qqUin: info.qqUin,
          nickname: info.nickname,
          status: 'online',
          lastConnectedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null
        }
      });
      return { ok: true, ...info, message: 'NapCat 已连接，QQ 登录状态正常。' };
    } catch (error) {
      const duplicatedQq = this.isUniqueConflict(error);
      const message = duplicatedQq
        ? '该 QQ 已被另一个接入配置使用，请先删除或调整原配置。'
        : this.safeErrorMessage(error);
      await this.prisma.qqAccount.update({
        where: { id },
        data: {
          status: 'error',
          lastErrorCode: duplicatedQq
            ? ERROR_CODES.QQ_ACCOUNT_QQ_ALREADY_USED
            : ERROR_CODES.QQ_NAPCAT_UNREACHABLE,
          lastErrorMessage: message
        }
      });
      return { ok: false, qqUin: null, nickname: null, message };
    }
  }

  async logoutAccount(user: CurrentUser, id: string) {
    this.assertAdmin(user);
    const account = await this.findOwnedAccount(user, id);
    if (!account.qqUin)
      throw new BadRequestException({
        code: ERROR_CODES.QQ_ACCOUNT_NOT_CONNECTED,
        message: '该账号尚未识别 QQ 号，无法执行退出。'
      });

    const apiBaseUrl = this.normalizeHttpUrl(
      this.config.get<string>('QQ_AUTO_NAPCAT_API_BASE_URL') ?? 'http://127.0.0.1:3000'
    );
    const loginInfo = await this.napcat.getLoginInfo(apiBaseUrl, null);
    if (loginInfo.qqUin !== account.qqUin)
      throw new ConflictException({
        code: ERROR_CODES.QQ_ACCOUNT_MISMATCH,
        message: `NapCat 当前登录的是 QQ ${loginInfo.qqUin}，不是要退出的 QQ ${account.qqUin}。`
      });

    this.suppressedAutoLoginQqUin = account.qqUin;
    this.ignoreQrBeforeMs = Date.now();
    try {
      await this.clearPersistedLoginData();
      await this.prisma.qqAccount.update({
        where: { id: account.id },
        data: {
          status: 'offline',
          isEnabled: false,
          lastErrorCode: null,
          lastErrorMessage: null
        }
      });
      await this.napcat.exitBot(apiBaseUrl, null);
    } catch (error) {
      this.suppressedAutoLoginQqUin = null;
      throw error;
    }

    return {
      accountId: account.id,
      qqUin: account.qqUin,
      message: 'QQ 已退出，原账号和好友绑定已保留。请等待新二维码后扫描其他 QQ。'
    };
  }

  async listFriends(user: CurrentUser, id: string) {
    const account = await this.findOwnedAccount(user, id);
    const items = await this.napcat.getFriendList(
      account.apiBaseUrl,
      this.decryptSecret(account.accessTokenCiphertext)
    );
    return this.page(items);
  }

  async listTargets(user: CurrentUser): Promise<{ items: QqTargetItem[] }> {
    const [conversations, companions] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: { userId: user.id, deletedAt: null },
        include: { character: { select: { name: true } }, qqChatBinding: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.companion.findMany({
        where: { userId: user.id, deletedAt: null },
        include: { qqChatBinding: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      })
    ]);
    return {
      items: [
        ...conversations.map((item) =>
          this.toTargetItem(
            'conversation',
            item.id,
            item.title,
            item.character.name,
            item.qqChatBinding
          )
        ),
        ...companions.map((item) =>
          this.toTargetItem('companion', item.id, item.name, 'AI 角色持续会话', item.qqChatBinding)
        )
      ]
    };
  }

  async listBindings(user: CurrentUser) {
    const items = await this.prisma.qqChatBinding.findMany({
      where: { userId: user.id },
      include: this.bindingInclude(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    return this.page(items.map((item) => this.toBindingItem(item)));
  }

  async createBinding(user: CurrentUser, dto: CreateQqBindingDto): Promise<QqChatBindingItem> {
    await this.findOwnedAccount(user, dto.qqAccountId);
    await this.assertOwnedTarget(user, dto.targetType, dto.targetId);
    await this.assertBindingAvailable(
      user,
      dto.qqAccountId,
      dto.peerQqUin,
      dto.targetType,
      dto.targetId
    );
    try {
      const item = await this.prisma.qqChatBinding.create({
        data: {
          userId: user.id,
          qqAccountId: dto.qqAccountId,
          peerQqUin: dto.peerQqUin,
          peerNickname: dto.peerNickname?.trim() || null,
          targetType: dto.targetType,
          conversationId: dto.targetType === 'conversation' ? dto.targetId : null,
          companionId: dto.targetType === 'companion' ? dto.targetId : null
        },
        include: this.bindingInclude()
      });
      return this.toBindingItem(item);
    } catch (error) {
      this.throwBindingUnique(error);
      throw error;
    }
  }

  async switchBinding(
    user: CurrentUser,
    id: string,
    dto: UpdateQqBindingDto
  ): Promise<QqChatBindingItem> {
    const existing = await this.findOwnedBinding(user, id);
    await this.assertOwnedTarget(user, dto.targetType, dto.targetId);
    await this.assertBindingAvailable(
      user,
      existing.qqAccountId,
      existing.peerQqUin,
      dto.targetType,
      dto.targetId,
      existing.id
    );
    try {
      const item = await this.prisma.qqChatBinding.update({
        where: { id },
        data: {
          targetType: dto.targetType,
          conversationId: dto.targetType === 'conversation' ? dto.targetId : null,
          companionId: dto.targetType === 'companion' ? dto.targetId : null,
          lastErrorCode: null,
          lastErrorMessage: null
        },
        include: this.bindingInclude()
      });
      return this.toBindingItem(item);
    } catch (error) {
      this.throwBindingUnique(error);
      throw error;
    }
  }

  async deleteBinding(user: CurrentUser, id: string) {
    const binding = await this.findOwnedBinding(user, id);
    await this.prisma.qqChatBinding.delete({ where: { id: binding.id } });
    return { deleted: true, id };
  }

  async acceptWebhook(accountId: string, token: string | undefined, payload: unknown) {
    const account = await this.prisma.qqAccount.findFirst({
      where: { id: accountId, isEnabled: true }
    });
    if (!account || !this.isWebhookTokenValid(account.id, token)) {
      throw new UnauthorizedException({
        code: ERROR_CODES.QQ_EVENT_UNAUTHORIZED,
        message: 'Invalid QQ event token.'
      });
    }
    return this.acceptAccountEvent(account, payload);
  }

  async acceptAutoWebhook(payload: unknown) {
    if (!isPrivateFriendMessage(payload)) return { accepted: false, reason: 'ignored_event' };
    const account = await this.prisma.qqAccount.findFirst({
      where: { qqUin: String(payload.self_id), isEnabled: true }
    });
    if (!account) return { accepted: false, reason: 'unregistered_account' };
    return this.acceptAccountEvent(account, payload);
  }

  private async acceptAccountEvent(account: QqAccount, payload: unknown) {
    if (!isPrivateFriendMessage(payload)) return { accepted: false, reason: 'ignored_event' };
    if (account.qqUin && String(payload.self_id) !== account.qqUin)
      return { accepted: false, reason: 'account_mismatch' };
    const content = extractOneBotText(payload);
    if (!content) return { accepted: false, reason: 'unsupported_message' };
    const peerQqUin = String(payload.user_id);
    const binding = await this.prisma.qqChatBinding.findFirst({
      where: { qqAccountId: account.id, peerQqUin, isEnabled: true }
    });
    if (!binding) return { accepted: false, reason: 'unbound_friend' };
    try {
      const event = await this.prisma.qqInboundEvent.create({
        data: {
          qqAccountId: account.id,
          bindingId: binding.id,
          externalMessageId: String(payload.message_id),
          peerQqUin,
          content: content.slice(0, 12_000)
        }
      });
      this.enqueueInbound(event.id, binding.id);
      return { accepted: true, eventId: event.id };
    } catch (error) {
      if (this.isUniqueConflict(error)) return { accepted: true, duplicate: true };
      throw error;
    }
  }

  private async upsertAutoAccount(
    user: CurrentUser,
    apiBaseUrl: string,
    loginInfo: { qqUin: string; nickname: string | null }
  ): Promise<QqAccount> {
    const existing = await this.prisma.qqAccount.findUnique({
      where: { qqUin: loginInfo.qqUin }
    });
    if (existing && existing.userId !== user.id)
      throw new ConflictException({
        code: ERROR_CODES.QQ_ACCOUNT_QQ_ALREADY_USED,
        message: '该 QQ 已由另一个 Tavern 账号接入。'
      });
    if (existing) {
      const recentlyConfirmed =
        existing.status === 'online' &&
        existing.nickname === loginInfo.nickname &&
        existing.isEnabled &&
        existing.apiBaseUrl === apiBaseUrl &&
        existing.accessTokenCiphertext === null &&
        existing.lastConnectedAt !== null &&
        Date.now() - existing.lastConnectedAt.getTime() < 60_000;
      if (recentlyConfirmed) return existing;
      return this.prisma.qqAccount.update({
        where: { id: existing.id },
        data: {
          apiBaseUrl,
          webUiUrl: null,
          accessTokenCiphertext: null,
          accessTokenMask: null,
          nickname: loginInfo.nickname,
          status: 'online',
          isEnabled: true,
          lastConnectedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null
        }
      });
    }
    try {
      return await this.prisma.qqAccount.create({
        data: {
          userId: user.id,
          label: `QQ ${loginInfo.qqUin}`,
          apiBaseUrl,
          qqUin: loginInfo.qqUin,
          nickname: loginInfo.nickname,
          status: 'online',
          isEnabled: true,
          lastConnectedAt: new Date()
        }
      });
    } catch (error) {
      this.throwAccountUnique(error);
      throw error;
    }
  }

  private async readLoginQrCode(): Promise<{ dataUrl: string; updatedAt: string } | null> {
    const path = this.config.get<string>('QQ_LOGIN_QR_PATH') ?? 'data/napcat/cache/qrcode.png';
    try {
      const [content, metadata] = await Promise.all([readFile(path), stat(path)]);
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (
        metadata.mtimeMs < this.ignoreQrBeforeMs ||
        content.length < pngSignature.length ||
        content.length > 1024 * 1024 ||
        !content.subarray(0, pngSignature.length).equals(pngSignature)
      )
        return null;
      return {
        dataUrl: `data:image/png;base64,${content.toString('base64')}`,
        updatedAt: metadata.mtime.toISOString()
      };
    } catch {
      return null;
    }
  }

  private async clearPersistedLoginData(): Promise<void> {
    const configuredPath = this.config.get<string>('QQ_LOGIN_DATA_PATH') ?? 'data/napcat/qq';
    const loginDataPath = resolve(configuredPath);
    const filesystemRoot = parse(loginDataPath).root;
    if (
      loginDataPath === filesystemRoot ||
      dirname(loginDataPath) === filesystemRoot ||
      loginDataPath === resolve(process.cwd())
    ) {
      throw new Error('QQ_LOGIN_DATA_PATH points to an unsafe directory.');
    }
    const entries = await readdir(loginDataPath, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    await Promise.all(
      entries.map((entry) => rm(join(loginDataPath, entry.name), { recursive: true, force: true }))
    );
  }

  private assertAdmin(user: CurrentUser): void {
    if (user.role !== 'admin')
      throw new ForbiddenException({
        code: ERROR_CODES.ADMIN_ROLE_REQUIRED,
        message: '只有管理员可以登录和配置服务器 QQ 账号。'
      });
  }

  private enqueueInbound(eventId: string, bindingId: string): void {
    const previous = this.inboundQueues.get(bindingId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.processInbound(eventId))
      .finally(() => {
        if (this.inboundQueues.get(bindingId) === next) this.inboundQueues.delete(bindingId);
      });
    this.inboundQueues.set(bindingId, next);
  }

  private async processInbound(eventId: string): Promise<void> {
    const event = await this.prisma.qqInboundEvent.findUnique({
      where: { id: eventId },
      include: { binding: { include: { user: true, qqAccount: true } } }
    });
    if (!event || !event.binding || !event.content || event.status === 'completed') return;
    const binding = event.binding;
    if (!binding.isEnabled || !binding.qqAccount.isEnabled) return;
    await this.prisma.qqInboundEvent.update({
      where: { id: event.id },
      data: { status: 'processing', attemptCount: { increment: 1 }, nextRetryAt: null }
    });
    const owner: CurrentUser = {
      id: binding.user.id,
      username: binding.user.username,
      displayName: binding.user.displayName,
      role: binding.user.role as CurrentUser['role']
    };
    const response = new InternalChatResponse();
    try {
      if (binding.targetType === 'conversation' && binding.conversationId) {
        await this.chat.streamInternal({
          owner,
          conversationId: binding.conversationId,
          payload: { requestId: `qq:${event.id}`, userMessage: event.content },
          response
        });
      } else if (binding.targetType === 'companion' && binding.companionId) {
        await this.companionChat.streamInternal({
          owner,
          companionId: binding.companionId,
          payload: { requestId: `qq:${event.id}`, userMessage: event.content },
          response
        });
      } else {
        throw new Error('QQ_TARGET_INVALID');
      }
      await this.prisma.$transaction([
        this.prisma.qqInboundEvent.update({
          where: { id: event.id },
          data: {
            status: response.errorCode ? 'failed' : 'completed',
            content: null,
            errorCode: response.errorCode,
            errorMessage: response.errorCode ? 'Chat generation failed.' : null,
            processedAt: new Date()
          }
        }),
        this.prisma.qqChatBinding.update({
          where: { id: binding.id },
          data: {
            lastInboundAt: new Date(),
            lastErrorCode: response.errorCode,
            lastErrorMessage: response.errorCode ? 'Chat generation failed.' : null
          }
        })
      ]);
    } catch (error) {
      const nextAttempt = event.attemptCount + 1;
      const retry = nextAttempt < 3;
      await this.prisma.qqInboundEvent.update({
        where: { id: event.id },
        data: {
          status: retry ? 'pending' : 'failed',
          nextRetryAt: retry ? new Date(Date.now() + this.retryDelay(nextAttempt)) : null,
          errorCode: 'QQ_INBOUND_PROCESSING_FAILED',
          errorMessage: this.safeErrorMessage(error),
          ...(retry ? {} : { content: null, processedAt: new Date() })
        }
      });
    }
  }

  private async scheduleDelivery(targetType: QqTargetType, targetId: string, messageId: string) {
    const binding = await this.prisma.qqChatBinding.findFirst({
      where: {
        isEnabled: true,
        qqAccount: { isEnabled: true },
        ...(targetType === 'conversation'
          ? { conversationId: targetId }
          : { companionId: targetId })
      }
    });
    if (!binding) return;
    try {
      const delivery = await this.prisma.qqDelivery.create({
        data: {
          bindingId: binding.id,
          sourceMessageKey: `${targetType}:${messageId}`,
          targetType,
          messageId
        }
      });
      void this.processDelivery(delivery.id);
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
    }
  }

  private async processDelivery(id: string): Promise<void> {
    if (this.deliveryTasks.has(id)) return;
    this.deliveryTasks.add(id);
    try {
      await this.processDeliveryInternal(id);
    } finally {
      this.deliveryTasks.delete(id);
    }
  }

  private async processDeliveryInternal(id: string): Promise<void> {
    const delivery = await this.prisma.qqDelivery.findUnique({
      where: { id },
      include: { binding: { include: { qqAccount: true } } }
    });
    if (!delivery || delivery.status === 'sent') return;
    const { binding } = delivery;
    if (!binding.isEnabled || !binding.qqAccount.isEnabled) return;
    let content: string | null = null;
    let bindingStillMatches = false;
    if (delivery.targetType === 'conversation') {
      const message = await this.prisma.message.findFirst({
        where: { id: delivery.messageId, role: 'assistant', status: 'complete', deletedAt: null },
        select: { content: true, conversationId: true }
      });
      content = message?.content ?? null;
      bindingStillMatches = Boolean(
        message &&
        binding.targetType === 'conversation' &&
        binding.conversationId === message.conversationId
      );
    } else {
      const message = await this.prisma.companionMessage.findFirst({
        where: { id: delivery.messageId, role: 'assistant', status: 'complete', deletedAt: null },
        select: { content: true, companionId: true }
      });
      content = message?.content ?? null;
      bindingStillMatches = Boolean(
        message && binding.targetType === 'companion' && binding.companionId === message.companionId
      );
    }
    if (!content) return;
    if (!bindingStillMatches) {
      await this.prisma.qqDelivery.update({
        where: { id },
        data: {
          status: 'cancelled',
          nextRetryAt: null,
          errorCode: 'QQ_BINDING_CHANGED',
          errorMessage: '绑定目标已切换，已取消旧目标的待发送消息。'
        }
      });
      return;
    }
    const chunks = splitQqText(content);
    if (!chunks.length) return;
    await this.prisma.qqDelivery.update({
      where: { id },
      data: { status: 'sending', attemptCount: { increment: 1 }, nextRetryAt: null }
    });
    try {
      let externalMessageId = delivery.externalMessageId;
      for (let index = delivery.sentChunkCount; index < chunks.length; index += 1) {
        externalMessageId = await this.napcat.sendPrivateMessage(
          binding.qqAccount.apiBaseUrl,
          this.decryptSecret(binding.qqAccount.accessTokenCiphertext),
          binding.peerQqUin,
          chunks[index]!
        );
        await this.prisma.qqDelivery.update({
          where: { id },
          data: { sentChunkCount: index + 1, externalMessageId }
        });
      }
      await this.prisma.$transaction([
        this.prisma.qqDelivery.update({
          where: { id },
          data: { status: 'sent', sentAt: new Date(), errorCode: null, errorMessage: null }
        }),
        this.prisma.qqChatBinding.update({
          where: { id: binding.id },
          data: { lastOutboundAt: new Date(), lastErrorCode: null, lastErrorMessage: null }
        })
      ]);
    } catch (error) {
      const attempt = delivery.attemptCount + 1;
      const message = this.safeErrorMessage(error);
      await this.prisma.$transaction([
        this.prisma.qqDelivery.update({
          where: { id },
          data: {
            status: 'failed',
            nextRetryAt: new Date(Date.now() + this.retryDelay(attempt)),
            errorCode: 'QQ_DELIVERY_FAILED',
            errorMessage: message
          }
        }),
        this.prisma.qqChatBinding.update({
          where: { id: binding.id },
          data: { lastErrorCode: 'QQ_DELIVERY_FAILED', lastErrorMessage: message }
        })
      ]);
    }
  }

  private async scanPendingWork(): Promise<void> {
    const now = new Date();
    const events = await this.prisma.qqInboundEvent.findMany({
      where: { status: 'pending', OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
      orderBy: [{ receivedAt: 'asc' }],
      take: 20
    });
    for (const event of events) if (event.bindingId) this.enqueueInbound(event.id, event.bindingId);
    const deliveries = await this.prisma.qqDelivery.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }]
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 20
    });
    for (const delivery of deliveries) void this.processDelivery(delivery.id);
  }

  private async assertBindingAvailable(
    user: CurrentUser,
    qqAccountId: string,
    peerQqUin: string,
    type: QqTargetType,
    targetId: string,
    excludeId?: string
  ) {
    const friend = await this.prisma.qqChatBinding.findFirst({
      where: {
        userId: user.id,
        qqAccountId,
        peerQqUin,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    if (friend)
      throw new ConflictException({
        code: ERROR_CODES.QQ_FRIEND_ALREADY_BOUND,
        message: '该 QQ 好友已经绑定了一个会话，请使用切换绑定。'
      });
    const target = await this.prisma.qqChatBinding.findFirst({
      where: {
        userId: user.id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(type === 'conversation' ? { conversationId: targetId } : { companionId: targetId })
      }
    });
    if (target)
      throw new ConflictException({
        code: ERROR_CODES.QQ_TARGET_ALREADY_BOUND,
        message: '该会话已经绑定了其他 QQ 好友。'
      });
  }

  private async assertOwnedTarget(user: CurrentUser, type: QqTargetType, id: string) {
    const target =
      type === 'conversation'
        ? await this.prisma.conversation.findFirst({
            where: { id, userId: user.id, deletedAt: null }
          })
        : await this.prisma.companion.findFirst({
            where: { id, userId: user.id, deletedAt: null }
          });
    if (!target)
      throw new BadRequestException({
        code: ERROR_CODES.QQ_TARGET_INVALID,
        message: '聊天目标不存在或不属于当前用户。'
      });
  }

  private async findOwnedAccount(user: CurrentUser, id: string) {
    const account = await this.prisma.qqAccount.findFirst({ where: { id, userId: user.id } });
    if (!account)
      throw new NotFoundException({
        code: ERROR_CODES.QQ_ACCOUNT_NOT_FOUND,
        message: 'QQ 账号配置不存在。'
      });
    return account;
  }

  private async findOwnedBinding(user: CurrentUser, id: string) {
    const binding = await this.prisma.qqChatBinding.findFirst({ where: { id, userId: user.id } });
    if (!binding)
      throw new NotFoundException({
        code: ERROR_CODES.QQ_BINDING_NOT_FOUND,
        message: 'QQ 聊天绑定不存在。'
      });
    return binding;
  }

  private bindingInclude() {
    return {
      qqAccount: true,
      conversation: { select: { title: true } },
      companion: { select: { name: true } }
    } satisfies Prisma.QqChatBindingInclude;
  }

  private toBindingItem(
    item: QqChatBinding & {
      qqAccount: QqAccount;
      conversation: { title: string } | null;
      companion: { name: string } | null;
    }
  ): QqChatBindingItem {
    return {
      id: item.id,
      qqAccountId: item.qqAccountId,
      accountLabel: item.qqAccount.label,
      accountQqUin: item.qqAccount.qqUin,
      peerQqUin: item.peerQqUin,
      peerNickname: item.peerNickname,
      targetType: item.targetType as QqTargetType,
      targetId: item.conversationId ?? item.companionId!,
      targetTitle: item.conversation?.title ?? item.companion?.name ?? '已删除目标',
      isEnabled: item.isEnabled,
      lastInboundAt: item.lastInboundAt?.toISOString() ?? null,
      lastOutboundAt: item.lastOutboundAt?.toISOString() ?? null,
      lastErrorCode: item.lastErrorCode,
      lastErrorMessage: item.lastErrorMessage,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }

  private toTargetItem(
    type: QqTargetType,
    id: string,
    title: string,
    subtitle: string | null,
    binding: QqChatBinding | null
  ): QqTargetItem {
    return {
      targetType: type,
      targetId: id,
      title,
      subtitle,
      bindingId: binding?.id ?? null,
      boundPeerQqUin: binding?.peerQqUin ?? null,
      boundPeerNickname: binding?.peerNickname ?? null
    };
  }

  private toAccountItem(account: QqAccount): QqAccountItem {
    return {
      id: account.id,
      label: account.label,
      apiBaseUrl: account.apiBaseUrl,
      webUiUrl: account.webUiUrl,
      qqUin: account.qqUin,
      nickname: account.nickname,
      accessTokenMask: account.accessTokenMask,
      hasAccessToken: Boolean(account.accessTokenCiphertext),
      status: account.status as QqAccountItem['status'],
      isEnabled: account.isEnabled,
      callbackUrl: this.callbackUrl(account.id),
      lastConnectedAt: account.lastConnectedAt?.toISOString() ?? null,
      lastErrorCode: account.lastErrorCode,
      lastErrorMessage: account.lastErrorMessage,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }

  private callbackUrl(id: string) {
    const base = (
      this.config.get<string>('QQ_EVENT_CALLBACK_BASE_URL') ?? 'http://127.0.0.1:3100/api'
    ).replace(/\/+$/, '');
    return `${base}/qq/events/${encodeURIComponent(id)}?token=${encodeURIComponent(this.webhookToken(id))}`;
  }
  private webhookToken(id: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('AUTH_TOKEN_SECRET'))
      .update(`qq-event:${id}`)
      .digest('base64url');
  }
  private isWebhookTokenValid(id: string, value?: string) {
    if (!value) return false;
    const expected = Buffer.from(this.webhookToken(id));
    const actual = Buffer.from(value);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private normalizeHttpUrl(value: string) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'NapCat 地址必须是无内嵌凭证的 HTTP/HTTPS URL。'
      });
    return url.toString().replace(/\/$/, '');
  }
  private normalizeSecret(value: string | null | undefined) {
    return value?.trim() || null;
  }
  private encryptSecret(value: string | null) {
    if (!value) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
  }
  private decryptSecret(value: string | null) {
    if (!value) return null;
    if (!value.startsWith('v1:')) return value;
    const [, iv, tag, encrypted] = value.split(':');
    if (!iv || !tag || !encrypted) return null;
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final()
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
  private maskSecret(value: string | null) {
    return value
      ? value.length <= 8
        ? '****'
        : `${value.slice(0, 2)}****${value.slice(-4)}`
      : null;
  }
  private retryDelay(attempt: number) {
    return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
  }
  private safeErrorMessage(error: unknown) {
    return (error instanceof Error ? error.message : 'QQ bridge operation failed.').slice(0, 500);
  }
  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
  private throwAccountUnique(error: unknown): void {
    if (this.isUniqueConflict(error))
      throw new ConflictException({
        code: ERROR_CODES.QQ_ACCOUNT_NAME_EXISTS,
        message: 'QQ 配置名称或登录 QQ 已存在。'
      });
  }
  private throwBindingUnique(error: unknown): void {
    if (this.isUniqueConflict(error))
      throw new ConflictException({
        code: ERROR_CODES.QQ_TARGET_ALREADY_BOUND,
        message: 'QQ 好友或聊天目标已被绑定。'
      });
  }
  private page<T>(items: T[]) {
    return { items, total: items.length, page: 1, pageSize: items.length } as const;
  }
}
