import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetEventsService } from '../../services/target-events/target-events.service';
import { CompanionReplayService } from '../../services/context-engine/replay.service';
import { CompanionMemoryService } from '../companion-memory/companion-memory.service';
import type { CurrentUser } from '../users/user.types';
import { SettingsService } from '../settings/settings.service';
@Injectable()
export class CompanionMessagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanionMemoryService) private readonly memoryService: CompanionMemoryService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(TargetEventsService) private readonly targetEvents: TargetEventsService,
    @Inject(CompanionReplayService) private readonly replayService: CompanionReplayService
  ) {}
  async list(user: CurrentUser, companionId: string) {
    await this.assertCompanion(user, companionId);
    return this.prisma.companionMessage.findMany({
      // 排除被重新生成取代的旧回复（replaced），避免重新生成后旧消息堆积
      where: { companionId, deletedAt: null, status: { not: 'replaced' } },
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
    const { updated, stale } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.companionMessage.update({
        where: { id },
        data: { content: content.trim(), status: 'edited' }
      });
      const stale = await this.memoryService.markStaleIfAffected(message.companionId, message, tx);
      return { updated, stale };
    });
    if (stale) void this.memoryService.maybeScheduleUpdate(user, message.companionId);
    await this.replayService.replay(message.companionId);
    this.targetEvents.emit('companion', message.companionId, 'message_updated', { messageId: id });
    return updated;
  }
  async remove(user: CurrentUser, id: string) {
    const message = await this.find(user, id);
    if (message.status === 'generating')
      throw new BadRequestException({
        code: 'COMPANION_MESSAGE_BUSY',
        message: 'Generating message cannot be deleted.'
      });
    const stale = await this.prisma.$transaction(async (tx) => {
      await tx.companionMessage.update({
        where: { id },
        data: { status: 'deleted', deletedAt: new Date() }
      });
      return this.memoryService.markStaleIfAffected(message.companionId, message, tx);
    });
    if (stale) void this.memoryService.maybeScheduleUpdate(user, message.companionId);
    await this.replayService.replay(message.companionId);
    this.targetEvents.emit('companion', message.companionId, 'message_deleted', { messageId: id });
    return { deleted: true, id };
  }
  async regenerate(user: CurrentUser, id: string) {
    const message = await this.find(user, id);
    if (
      message.role !== 'assistant' ||
      (message.status !== 'complete' && message.status !== 'edited')
    )
      throw new NotFoundException({
        code: 'COMPANION_MESSAGE_REGENERATE_INVALID',
        message: 'Only assistant messages can be regenerated.'
      });
    const latest = await this.prisma.companionMessage.findFirst({
      where: {
        companionId: message.companionId,
        deletedAt: null,
        status: { in: ['complete', 'edited'] }
      },
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
      turnId: message.turnId,
      streamPath: `/companions/${message.companionId}/chat/stream`
    };
  }
  private async assertCompanion(user: CurrentUser, id: string) {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(user);
    const found = await this.prisma.companion.findFirst({
      where: {
        id,
        userId: user.id,
        deletedAt: null,
        ...(showSensitiveContent ? {} : { isSensitive: false })
      }
    });
    if (!found)
      throw new NotFoundException({ code: 'COMPANION_NOT_FOUND', message: 'Companion not found.' });
  }
  private async find(user: CurrentUser, id: string) {
    const showSensitiveContent = await this.settingsService.shouldShowSensitiveContent(user);
    const message = await this.prisma.companionMessage.findFirst({
      where: {
        id,
        deletedAt: null,
        companion: {
          userId: user.id,
          deletedAt: null,
          ...(showSensitiveContent ? {} : { isSensitive: false })
        }
      }
    });
    if (!message)
      throw new NotFoundException({
        code: 'COMPANION_MESSAGE_NOT_FOUND',
        message: 'Companion message not found.'
      });
    return message;
  }
}
