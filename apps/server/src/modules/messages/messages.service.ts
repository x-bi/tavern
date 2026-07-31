import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Message } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import { ConversationReplayService } from '../../services/context-engine/replay.service';
import type { CurrentUser } from '../users/user.types';
import type { QueryMessagesDto } from './dto/query-messages.dto';
import type { UpdateMessageDto } from './dto/update-message.dto';
import type {
  MessageListResponse,
  MessageRegenerateResponse,
  MessageResponse
} from './message.types';

/**
 * 消息服务：消息的查询、编辑、删除、重新生成。
 *
 * 消息归属通过其所属会话的用户间接校验（不直接按 userId）。
 * 编辑内容仅限 user 消息；重新生成仅限最新 assistant 消息。
 */
@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TargetEventsService) private readonly targetEvents: TargetEventsService,
    @Inject(ConversationReplayService) private readonly replayService: ConversationReplayService
  ) {}

  /**
   * 按会话分页查询消息。
   * @param currentUser 当前登录用户。
   * @param conversationId 会话 ID（先校验归属）。
   * @param query 分页/排序/角色/状态/搜索参数。
   * @returns 分页结果，含 items、total、page、pageSize。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  async listByConversation(
    currentUser: CurrentUser,
    conversationId: string,
    query: QueryMessagesDto
  ): Promise<MessageListResponse> {
    // 先校验会话存在且属于当前用户
    await this.ensureOwnedActiveConversation(currentUser, conversationId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const order = query.order ?? 'asc';
    // 构建查询条件：限定会话 + 未软删除
    const where: Prisma.MessageWhereInput = {
      conversationId,
      deletedAt: null,
      // role 未传时不加条件，传了则按值过滤
      ...(query.role === undefined ? {} : { role: query.role }),
      // status 未传时默认排除被重新生成取代的旧回复（replaced），
      // 否则重新生成后旧 assistant 消息会随重载回流，越点越多；
      // 显式传 status 时按传入值精确过滤（如审计查询 replaced）。
      ...(query.status === undefined ? { status: { not: 'replaced' } } : { status: query.status }),
      // search 关键字：匹配 content 包含
      ...(query.search === undefined ? {} : { content: { contains: query.search } })
    };

    // 事务内并行：查当前页 + 统计总数，按创建时间排序（对话顺序）
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.message.count({ where })
    ]);

    return {
      items: items.map((message) => this.toResponse(message)),
      total,
      page,
      pageSize
    };
  }

  /**
   * 更新消息（部分更新）。
   *
   * 特殊规则：
   * - 只有 user 消息可以编辑内容（assistant 等不行）；
   * - 若改了 content 且未显式传 status，自动标为 edited。
   *
   * @param currentUser 当前登录用户。
   * @param id 消息 ID。
   * @param dto 更新入参。
   * @returns 更新后的消息响应。
   * @throws BadRequestException 试图编辑非 user 消息的内容。
   * @throws NotFoundException 消息不存在或不属于该用户。
   */
  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateMessageDto
  ): Promise<MessageResponse> {
    const existing = await this.findOwnedActiveMessage(currentUser, id);
    // 判断 content 是否实际变化（决定是否自动标记 edited）
    const contentChanged = dto.content !== undefined && dto.content !== existing.content;

    // 只允许编辑 user 消息的内容
    if (dto.content !== undefined && existing.role !== 'user') {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_UPDATE_TARGET_INVALID,
        message: 'Only user messages can be edited.'
      });
    }

    // 部分更新：仅写入 DTO 中实际传入的字段（undefined 的跳过保持原值）
    // status：未传时若 content 变了自动标 edited，否则不动；传了用传入值
    const activeAssistant =
      contentChanged && existing.turnId
        ? await this.prisma.conversationTurn.findUnique({
            where: { id: existing.turnId },
            select: { activeAssistantMessageId: true }
          })
        : null;
    const message = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id },
        data: {
          ...(dto.content === undefined ? {} : { content: dto.content }),
          ...(dto.status === undefined
            ? contentChanged
              ? { status: 'edited' }
              : {}
            : { status: dto.status }),
          ...(dto.metadata === undefined
            ? {}
            : { metadataJson: this.stringifyNullable(dto.metadata) }),
          ...(dto.tokenCount === undefined ? {} : { tokenCount: dto.tokenCount })
        }
      });
      if (contentChanged && activeAssistant?.activeAssistantMessageId) {
        await tx.messageImageLink.updateMany({
          where: {
            messageId: activeAssistant.activeAssistantMessageId,
            status: 'active'
          },
          data: { status: 'hidden', reason: 'request_user_edited' }
        });
      }
      return updated;
    });
    this.targetEvents.emit('conversation', message.conversationId, 'message_updated', {
      messageId: message.id
    });
    if (contentChanged) await this.replayService.replay(message.conversationId);

    return this.toResponse(message);
  }

  /**
   * 删除消息（软删除：标记 deleted 状态 + 删除时间）。
   * @param currentUser 当前登录用户。
   * @param id 消息 ID。
   * @returns `{ deleted: true, id }`。
   * @throws NotFoundException 消息不存在或所属会话不属于该用户。
   */
  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.findOwnedActiveMessage(currentUser, id);

    const activeAssistant =
      existing.role === 'user' && existing.turnId
        ? await this.prisma.conversationTurn.findUnique({
            where: { id: existing.turnId },
            select: { activeAssistantMessageId: true }
          })
        : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        }
      });
      const linkedMessageId =
        existing.role === 'assistant' ? existing.id : activeAssistant?.activeAssistantMessageId;
      if (linkedMessageId) {
        await tx.messageImageLink.updateMany({
          where: { messageId: linkedMessageId, status: 'active' },
          data: {
            status: 'detached',
            reason: existing.role === 'assistant' ? 'message_deleted' : 'request_user_deleted'
          }
        });
      }
    });
    await this.replayService.replay(existing.conversationId);
    this.targetEvents.emit('conversation', existing.conversationId, 'message_deleted', {
      messageId: id
    });

    return {
      deleted: true,
      id
    };
  }

  /**
   * 重新生成消息：校验目标后返回提示，实际重生成由 /chat/stream 接口完成。
   *
   * 本接口不直接生成，只校验前置条件（避免在流式接口里做复杂校验）。
   *
   * @param currentUser 当前登录用户。
   * @param id 待重新生成的消息 ID。
   * @returns 含 streamPath 等提示信息。
   * @throws BadRequestException 目标不可重新生成（见 assertRegenerateTarget）。
   */
  async regenerate(currentUser: CurrentUser, id: string): Promise<MessageRegenerateResponse> {
    const target = await this.findOwnedActiveMessage(currentUser, id);
    // 校验是否可重新生成（必须是 assistant、最新消息、有前一条 user 消息）
    await this.assertRegenerateTarget(target);
    if (!target.turnId) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Regenerate requires a logical turn.'
      });
    }

    return {
      id,
      conversationId: target.conversationId,
      regenerateMessageId: id,
      turnId: target.turnId,
      replaceStrategy: 'switch-active-on-success',
      streamPath: '/chat/stream',
      message: 'Use /chat/stream with regenerateMessageId to regenerate this assistant reply.'
    };
  }

  /**
   * 校验会话归属：限定 id + 当前用户 + 未删除。
   * @param currentUser 当前登录用户。
   * @param conversationId 会话 ID。
   * @returns 无返回值（仅校验，不通过则抛异常）。
   * @throws NotFoundException 会话不存在或不属于该用户。
   */
  private async ensureOwnedActiveConversation(
    currentUser: CurrentUser,
    conversationId: string
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: currentUser.id,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!conversation) {
      throw new NotFoundException({
        code: ERROR_CODES.CONVERSATION_NOT_FOUND,
        message: 'Conversation not found.'
      });
    }
  }

  /**
   * 查询消息并校验所有权：通过所属会话的用户间接校验。
   * @param currentUser 当前登录用户。
   * @param id 消息 ID。
   * @returns 校验通过的消息记录。
   * @throws NotFoundException 消息不存在或所属会话不属于该用户。
   */
  private async findOwnedActiveMessage(currentUser: CurrentUser, id: string): Promise<Message> {
    const message = await this.prisma.message.findFirst({
      where: {
        id,
        deletedAt: null,
        // 通过 conversation 关联校验：会话必须属于当前用户
        conversation: {
          userId: currentUser.id,
          deletedAt: null
        }
      }
    });

    if (!message) {
      throw new NotFoundException({
        code: ERROR_CODES.MESSAGE_NOT_FOUND,
        message: 'Message not found.'
      });
    }

    return message;
  }

  /**
   * 校验消息是否可重新生成：
   * 1. 必须是 complete/edited assistant；
   * 2. 必须是所属 turn 的 active assistant，且 user message 仍有效；
   * 3. 必须是 canonical timeline 中最后一条消息。
   *
   * @param target 待校验的消息。
   * @returns 无返回值（仅校验，不通过则抛异常）。
   * @throws BadRequestException 上述任一条件不满足时抛 MESSAGE_REGENERATE_TARGET_INVALID。
   */
  private async assertRegenerateTarget(target: Message): Promise<void> {
    // 仅已完成的 active assistant 可以作为重新生成基线；失败/停止的 attempt 不会成为 active。
    if (
      target.role !== 'assistant' ||
      (target.status !== 'complete' && target.status !== 'edited') ||
      !target.turnId
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Only active completed assistant messages can be regenerated.'
      });
    }

    const turn = await this.prisma.conversationTurn.findFirst({
      where: {
        id: target.turnId,
        conversationId: target.conversationId,
        activeAssistantMessageId: target.id
      },
      include: { userMessage: true }
    });
    if (
      !turn ||
      turn.userMessage.deletedAt ||
      (turn.userMessage.status !== 'complete' && turn.userMessage.status !== 'edited')
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Regenerate must target the active assistant of a valid turn.'
      });
    }

    // 失败/停止的生成 attempt 不属于 canonical timeline，不能挡住 active reply 的重新生成。
    const activeMessages = await this.prisma.message.findMany({
      where: {
        conversationId: target.conversationId,
        deletedAt: null,
        status: { in: ['complete', 'edited'] }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
    const targetIndex = activeMessages.findIndex((message) => message.id === target.id);

    // 校验2：必须是最后一条消息
    if (targetIndex === -1 || targetIndex !== activeMessages.length - 1) {
      throw new BadRequestException({
        code: ERROR_CODES.MESSAGE_REGENERATE_TARGET_INVALID,
        message: 'Only the latest assistant reply can be regenerated.'
      });
    }
  }

  /**
   * 数据库记录 → 对外响应（解析 metadata JSON、格式化时间）。
   * @param message 消息数据库记录。
   * @returns 消息响应。
   */
  private toResponse(message: Message): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      turnId: message.turnId,
      role: message.role,
      content: message.content,
      status: message.status,
      metadata: this.parseRecord(message.metadataJson),
      tokenCount: message.tokenCount,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString()
    };
  }

  /**
   * 把结构化数据序列化成 JSON 字符串；undefined/null 返回 null。
   * @param value 任意值。
   * @returns JSON 字符串，undefined/null 返回 null。
   */
  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

  /**
   * 解析 metadataJson 为对象；为空/非对象/解析失败返回 null。
   * @param value metadataJson 字符串。
   * @returns 解析后的对象，或 null。
   */
  private parseRecord(value: string | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
