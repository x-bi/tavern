import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  HttpException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { ShareLink } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import type { CurrentUser } from '../users/user.types';
import type {
  BulkRevokeSharesDto,
  CreateShareDto,
  QuerySharesDto,
  UpdateShareDto
} from './dto/share.dto';
import type { ShareContext, ShareTargetType } from './share.types';

type ManagedShareLink = ShareLink & {
  owner?: { id: string; username: string; displayName: string } | null;
  conversation?: { title: string } | null;
  companion?: { name: string } | null;
};

@Injectable()
export class SharesService {
  private readonly rateWindows = new Map<string, { startedAt: number; count: number }>();
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TargetEventsService) private readonly events: TargetEventsService
  ) {}

  async create(user: CurrentUser, dto: CreateShareDto) {
    await this.assertOwnedTarget(user, dto.targetType, dto.targetId);
    const expiresAt = this.parseFutureExpiry(dto.expiresAt);
    const id = randomUUID();
    const token = this.createToken(id);
    const link = await this.prisma.shareLink.create({
      data: {
        id,
        ownerUserId: user.id,
        targetType: dto.targetType,
        conversationId: dto.targetType === 'conversation' ? dto.targetId : null,
        companionId: dto.targetType === 'companion' ? dto.targetId : null,
        tokenHash: this.hashToken(token),
        permission: dto.permission,
        expiresAt
      }
    });
    return this.toResponse(link, token);
  }

  async list(user: CurrentUser, query: QuerySharesDto) {
    const links = await this.prisma.shareLink.findMany({
      where: {
        ...(user.role === 'admin' ? {} : { ownerUserId: user.id }),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.targetId
          ? query.targetType === 'companion'
            ? { companionId: query.targetId }
            : { conversationId: query.targetId }
          : {})
      },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        conversation: { select: { title: true } },
        companion: { select: { name: true } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    return {
      items: links.map((link) => this.toResponse(link)),
      total: links.length,
      page: 1,
      pageSize: links.length
    };
  }

  async get(user: CurrentUser, id: string) {
    return this.toResponse(await this.findManageable(user, id));
  }

  async update(user: CurrentUser, id: string, dto: UpdateShareDto) {
    await this.findOwnedLink(user, id);
    const link = await this.prisma.shareLink.update({
      where: { id },
      data: {
        ...(dto.permission ? { permission: dto.permission } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: this.parseFutureExpiry(dto.expiresAt) } : {})
      }
    });
    return this.toResponse(link);
  }

  async revoke(user: CurrentUser, id: string) {
    const link = await this.findManageable(user, id);
    if (link.status === 'active') {
      await this.prisma.shareLink.update({
        where: { id },
        data: { status: 'revoked', revokedAt: new Date() }
      });
      this.emitRevoked([link]);
    }
    return { revoked: true, id };
  }

  async bulkRevoke(user: CurrentUser, dto: BulkRevokeSharesDto) {
    await this.assertOwnedTarget(user, dto.targetType, dto.targetId, user.role === 'admin');
    const where = {
      ...(user.role === 'admin' ? {} : { ownerUserId: user.id }),
      status: 'active',
      ...(dto.targetType === 'conversation'
        ? { conversationId: dto.targetId }
        : { companionId: dto.targetId })
    } as const;
    const links = await this.prisma.shareLink.findMany({ where });
    if (links.length) {
      await this.prisma.shareLink.updateMany({
        where,
        data: { status: 'revoked', revokedAt: new Date() }
      });
      this.emitRevoked(links);
    }
    return { revokedCount: links.length };
  }

  async regenerate(user: CurrentUser, id: string) {
    const existing = await this.findOwnedLink(user, id);
    await this.revoke(user, id);
    return this.create(user, {
      targetType: existing.targetType as ShareTargetType,
      targetId: existing.conversationId ?? existing.companionId!,
      permission: existing.permission as 'chat' | 'readonly',
      expiresAt:
        existing.expiresAt && existing.expiresAt > new Date()
          ? existing.expiresAt.toISOString()
          : null
    });
  }

  async resolvePublicToken(token: string, ip?: string): Promise<ShareContext> {
    if (!/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(token)) throw this.publicNotFound();
    const link = await this.prisma.shareLink.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        owner: true,
        conversation: { select: { id: true, deletedAt: true } },
        companion: { select: { id: true, deletedAt: true } }
      }
    });
    const expired = Boolean(link?.expiresAt && link.expiresAt <= new Date());
    const targetDeleted =
      link?.targetType === 'conversation'
        ? Boolean(link.conversation?.deletedAt)
        : Boolean(link?.companion?.deletedAt);
    if (
      !link ||
      link.status !== 'active' ||
      expired ||
      targetDeleted ||
      link.owner.deletedAt ||
      !link.owner.isActive
    )
      throw this.publicNotFound();
    this.assertRate(`${link.id}:${ip ?? 'unknown'}`);
    void this.prisma.shareLink
      .update({ where: { id: link.id }, data: { lastAccessAt: new Date() } })
      .catch(() => undefined);
    return {
      shareId: link.id,
      ownerUserId: link.ownerUserId,
      targetType: link.targetType as ShareTargetType,
      targetId: link.conversationId ?? link.companionId!,
      permission: link.permission as 'chat' | 'readonly',
      expiresAt: link.expiresAt,
      owner: {
        id: link.owner.id,
        username: link.owner.username,
        displayName: link.owner.displayName,
        role: link.owner.role as 'admin' | 'member'
      }
    };
  }

  assertChatPermission(context: ShareContext) {
    if (context.permission !== 'chat')
      throw new ForbiddenException({
        code: 'SHARE_READONLY',
        message: 'This share link is read-only.'
      });
  }

  async assertManagedTarget(user: CurrentUser, targetType: string, targetId: string) {
    if (targetType !== 'conversation' && targetType !== 'companion') {
      throw new BadRequestException({
        code: 'SHARE_TARGET_INVALID',
        message: 'Invalid share target type.'
      });
    }
    await this.assertOwnedTarget(user, targetType, targetId, user.role === 'admin');
    return targetType;
  }

  async publicBootstrap(context: ShareContext) {
    if (context.targetType === 'conversation') {
      const target = await this.prisma.conversation.findFirstOrThrow({
        where: { id: context.targetId, userId: context.ownerUserId, deletedAt: null },
        include: { character: { include: { avatarAsset: true } } }
      });
      return {
        shareId: context.shareId,
        targetType: context.targetType,
        permission: context.permission,
        title: target.title,
        participantName: target.character.name,
        avatarUrl: target.character.avatarAsset?.publicPath ?? null,
        expiresAt: context.expiresAt?.toISOString() ?? null
      };
    }
    const target = await this.prisma.companion.findFirstOrThrow({
      where: { id: context.targetId, userId: context.ownerUserId, deletedAt: null },
      include: { avatarAsset: true }
    });
    return {
      shareId: context.shareId,
      targetType: context.targetType,
      permission: context.permission,
      title: target.name,
      participantName: target.name,
      avatarUrl: target.avatarAsset?.publicPath ?? null,
      expiresAt: context.expiresAt?.toISOString() ?? null
    };
  }

  async publicMessages(context: ShareContext) {
    const rows =
      context.targetType === 'conversation'
        ? await this.prisma.message.findMany({
            where: { conversationId: context.targetId, deletedAt: null },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
          })
        : await this.prisma.companionMessage.findMany({
            where: { companionId: context.targetId, deletedAt: null },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
          });
    return rows.map((row) => ({
      messageId: row.id,
      turnId: row.turnId,
      role: row.role,
      content: row.content,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  async assertPublicRegenerateTarget(context: ShareContext, messageId: string, turnId: string) {
    const row =
      context.targetType === 'conversation'
        ? await this.prisma.message.findFirst({
            where: { id: messageId, turnId, conversationId: context.targetId, deletedAt: null },
            select: { id: true }
          })
        : await this.prisma.companionMessage.findFirst({
            where: { id: messageId, turnId, companionId: context.targetId, deletedAt: null },
            select: { id: true }
          });
    if (!row) throw this.publicNotFound();
  }

  private async findManageable(user: CurrentUser, id: string) {
    const link = await this.prisma.shareLink.findFirst({
      where: { id, ...(user.role === 'admin' ? {} : { ownerUserId: user.id }) }
    });
    if (!link)
      throw new NotFoundException({ code: 'SHARE_NOT_FOUND', message: 'Share link not found.' });
    return link;
  }

  private async findOwnedLink(user: CurrentUser, id: string) {
    const link = await this.prisma.shareLink.findFirst({
      where: { id, ownerUserId: user.id }
    });
    if (!link)
      throw new NotFoundException({ code: 'SHARE_NOT_FOUND', message: 'Share link not found.' });
    return link;
  }

  private async assertOwnedTarget(
    user: CurrentUser,
    type: ShareTargetType,
    id: string,
    allowAdmin = false
  ) {
    const where = {
      id,
      deletedAt: null,
      ...(allowAdmin && user.role === 'admin' ? {} : { userId: user.id })
    };
    const found =
      type === 'conversation'
        ? await this.prisma.conversation.findFirst({ where, select: { id: true } })
        : await this.prisma.companion.findFirst({ where, select: { id: true } });
    if (!found)
      throw new NotFoundException({
        code: 'SHARE_TARGET_NOT_FOUND',
        message: 'Share target not found.'
      });
  }

  private parseFutureExpiry(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (date <= new Date())
      throw new BadRequestException({
        code: 'SHARE_EXPIRY_INVALID',
        message: 'Expiry must be in the future.'
      });
    return date;
  }

  private createToken(id: string) {
    const secret = this.config.get<string>('AUTH_TOKEN_SECRET') ?? 'dev-only-change-me';
    return `${id}.${createHmac('sha256', secret).update(`share:${id}`).digest('base64url')}`;
  }
  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private shareUrl(token: string) {
    const base = (
      this.config.get<string>('SHARE_PUBLIC_BASE_URL') ?? 'http://127.0.0.1:5174'
    ).replace(/\/$/, '');
    return `${base}/s/${encodeURIComponent(token)}`;
  }
  private toResponse(link: ManagedShareLink, explicitToken?: string) {
    const token = explicitToken ?? this.createToken(link.id);
    return {
      id: link.id,
      ownerUserId: link.ownerUserId,
      owner: link.owner
        ? {
            id: link.owner.id,
            username: link.owner.username,
            displayName: link.owner.displayName
          }
        : null,
      targetType: link.targetType,
      targetId: link.conversationId ?? link.companionId!,
      targetTitle: link.conversation?.title ?? link.companion?.name ?? null,
      permission: link.permission,
      status: link.status,
      shareUrl: this.shareUrl(token),
      expiresAt: link.expiresAt?.toISOString() ?? null,
      lastAccessAt: link.lastAccessAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      revokedAt: link.revokedAt?.toISOString() ?? null
    };
  }
  private emitRevoked(links: ShareLink[]) {
    const groups = new Map<string, ShareLink[]>();
    for (const link of links) {
      const key = `${link.targetType}:${link.conversationId ?? link.companionId}`;
      groups.set(key, [...(groups.get(key) ?? []), link]);
    }
    for (const [key, rows] of groups) {
      const [type, targetId] = key.split(':');
      this.events.emit(type as ShareTargetType, targetId, 'share_revoked', {
        shareIds: rows.map((row) => row.id)
      });
    }
  }
  private assertRate(key: string) {
    const now = Date.now();
    const window = this.rateWindows.get(key);
    if (!window || now - window.startedAt >= 60_000) {
      this.rateWindows.set(key, { startedAt: now, count: 1 });
      return;
    }
    window.count += 1;
    if (window.count > 180)
      throw new HttpException(
        { code: 'SHARE_RATE_LIMITED', message: 'Too many share requests.' },
        429
      );
  }
  private publicNotFound() {
    return new NotFoundException({
      code: 'SHARE_NOT_FOUND',
      message: 'Share link is invalid or unavailable.'
    });
  }
}
