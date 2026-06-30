import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Message } from '@prisma/client';

import { ERROR_CODES } from '../../common/dto/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import type { QueryMessagesDto } from './dto/query-messages.dto';
import type { UpdateMessageDto } from './dto/update-message.dto';
import type {
  MessageListResponse,
  MessageRegenerateResponse,
  MessageResponse
} from './message.types';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async listByConversation(
    currentUser: CurrentUser,
    conversationId: string,
    query: QueryMessagesDto
  ): Promise<MessageListResponse> {
    await this.ensureOwnedActiveConversation(currentUser, conversationId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const order = query.order ?? 'asc';
    const where: Prisma.MessageWhereInput = {
      conversationId,
      deletedAt: null,
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search === undefined ? {} : { content: { contains: query.search } })
    };

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

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateMessageDto
  ): Promise<MessageResponse> {
    const existing = await this.findOwnedActiveMessage(currentUser, id);
    const contentChanged = dto.content !== undefined && dto.content !== existing.content;

    const message = await this.prisma.message.update({
      where: { id },
      data: {
        ...(dto.content === undefined ? {} : { content: dto.content }),
        ...(dto.status === undefined
          ? contentChanged
            ? { status: 'edited' }
            : {}
          : { status: dto.status }),
        ...(dto.metadata === undefined ? {} : { metadataJson: this.stringifyNullable(dto.metadata) }),
        ...(dto.tokenCount === undefined ? {} : { tokenCount: dto.tokenCount })
      }
    });

    return this.toResponse(message);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOwnedActiveMessage(currentUser, id);

    await this.prisma.message.update({
      where: { id },
      data: {
        status: 'deleted',
        deletedAt: new Date()
      }
    });

    return {
      deleted: true,
      id
    };
  }

  async regenerate(
    currentUser: CurrentUser,
    id: string
  ): Promise<MessageRegenerateResponse> {
    await this.findOwnedActiveMessage(currentUser, id);

    return {
      regenerated: false,
      id,
      reason: 'NOT_IMPLEMENTED',
      message: 'Message regenerate is reserved for a later chat generation stage.'
    };
  }

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

  private async findOwnedActiveMessage(currentUser: CurrentUser, id: string): Promise<Message> {
    const message = await this.prisma.message.findFirst({
      where: {
        id,
        deletedAt: null,
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

  private toResponse(message: Message): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      status: message.status,
      metadata: this.parseRecord(message.metadataJson),
      tokenCount: message.tokenCount,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString()
    };
  }

  private stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : JSON.stringify(value);
  }

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
