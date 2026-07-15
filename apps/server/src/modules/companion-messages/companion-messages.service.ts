import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
@Injectable()
export class CompanionMessagesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(user: CurrentUser, companionId: string) {
    await this.assertCompanion(user, companionId);
    return this.prisma.companionMessage.findMany({
      where: { companionId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
  }
  async update(user: CurrentUser, id: string, content: string) {
    const message = await this.find(user, id);
    if (message.role !== 'user')
      throw new NotFoundException({
        code: 'COMPANION_MESSAGE_EDIT_FORBIDDEN',
        message: 'Only user messages can be edited.'
      });
    const stale = await this.affectsSummary(message);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.companionMessage.update({
        where: { id },
        data: { content: content.trim(), status: 'edited' }
      });
      if (stale)
        await tx.companionMemory.update({
          where: { companionId: message.companionId },
          data: { status: 'stale', nextRetryAt: null }
        });
      return updated;
    });
  }
  async remove(user: CurrentUser, id: string) {
    const message = await this.find(user, id);
    const stale = await this.affectsSummary(message);
    await this.prisma.$transaction(async (tx) => {
      await tx.companionMessage.update({
        where: { id },
        data: { status: 'deleted', deletedAt: new Date() }
      });
      if (stale)
        await tx.companionMemory.update({
          where: { companionId: message.companionId },
          data: { status: 'stale', nextRetryAt: null }
        });
    });
    return { deleted: true, id };
  }
  async regenerate(user: CurrentUser, id: string) {
    const message = await this.find(user, id);
    if (message.role !== 'assistant')
      throw new NotFoundException({
        code: 'COMPANION_MESSAGE_REGENERATE_INVALID',
        message: 'Only assistant messages can be regenerated.'
      });
    const latest = await this.prisma.companionMessage.findFirst({
      where: { companionId: message.companionId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    if (latest?.id !== id)
      throw new NotFoundException({
        code: 'COMPANION_MESSAGE_REGENERATE_INVALID',
        message: 'Only latest assistant message can be regenerated.'
      });
    return {
      id,
      companionId: message.companionId,
      regenerateMessageId: id,
      streamPath: `/companions/${message.companionId}/chat/stream`
    };
  }
  private async affectsSummary(message: { id: string; companionId: string; createdAt: Date }) {
    const memory = await this.prisma.companionMemory.findUnique({
      where: { companionId: message.companionId }
    });
    if (!memory?.lastSummarizedMessageId) return false;
    const cursor = await this.prisma.companionMessage.findUnique({
      where: { id: memory.lastSummarizedMessageId }
    });
    return Boolean(
      cursor &&
      (message.createdAt < cursor.createdAt ||
        (message.createdAt.getTime() === cursor.createdAt.getTime() && message.id <= cursor.id))
    );
  }
  private async assertCompanion(user: CurrentUser, id: string) {
    const found = await this.prisma.companion.findFirst({
      where: { id, userId: user.id, deletedAt: null }
    });
    if (!found)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
  }
  private async find(user: CurrentUser, id: string) {
    const message = await this.prisma.companionMessage.findFirst({
      where: { id, deletedAt: null, companion: { userId: user.id, deletedAt: null } }
    });
    if (!message)
      throw new NotFoundException({
        code: 'COMPANION_MESSAGE_NOT_FOUND',
        message: 'Companion message not found.'
      });
    return message;
  }
}
