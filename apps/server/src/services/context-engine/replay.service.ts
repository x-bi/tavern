import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  advanceWorldBookActivationState,
  type WorldBookActivationStateV2,
  type WorldBookEntryConfigV2
} from './world-book-matcher-v2';

/** Full deterministic replay is the correctness baseline after timeline mutations. */
@Injectable()
export class ConversationReplayService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replay(conversationId: string) {
    const turns = await this.prisma.conversationTurn.findMany({
      where: { conversationId },
      include: {
        messages: { include: { generationTrace: { include: { includedWorldBooks: true } } } }
      },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return this.prisma.$transaction(async (tx) => {
      await tx.conversationWorldBookActivationState.deleteMany({ where: { conversationId } });
      await tx.conversationWorldBookActivationEvent.deleteMany({ where: { conversationId } });
      let completedOrdinal = 0;
      const stateByEntry = new Map<string, WorldBookActivationStateV2>();
      for (const turn of turns) {
        const user = turn.messages.find(
          (message) => message.id === turn.userMessageId && !message.deletedAt
        );
        const active = turn.messages.find(
          (message) =>
            message.id === turn.activeAssistantMessageId &&
            message.role === 'assistant' &&
            !message.deletedAt &&
            message.status === 'complete' &&
            message.generationTrace
        );
        const complete = Boolean(active && (user || turn.userMessageId === null));
        if (complete) completedOrdinal += 1;
        await tx.conversationTurn.update({
          where: { id: turn.id },
          data: {
            activeAssistantMessageId: active?.id ?? null,
            completedOrdinal: complete ? completedOrdinal : null,
            status: complete ? 'complete' : user ? 'pending' : 'invalid',
            completedAt: complete ? (turn.completedAt ?? active!.generationTrace!.createdAt) : null
          }
        });
        const trace = active?.generationTrace;
        for (const included of trace?.includedWorldBooks ?? []) {
          const revision = await tx.worldBookEntryRevision.findUniqueOrThrow({
            where: { id: included.entryRevisionId },
            select: { configJson: true }
          });
          const nextState = advanceWorldBookActivationState(
            stateByEntry.get(included.entryId) ?? null,
            replayConfig(revision.configJson),
            included.activationSource as Parameters<typeof advanceWorldBookActivationState>[2],
            completedOrdinal
          );
          stateByEntry.set(included.entryId, nextState);
          await tx.conversationWorldBookActivationState.upsert({
            where: { conversationId_entryId: { conversationId, entryId: included.entryId } },
            create: {
              conversationId,
              entryId: included.entryId,
              entryRevisionId: included.entryRevisionId,
              activatedByMessageId: included.sourceMessageId,
              rootUserMessageId: included.rootUserMessageId,
              lineageJson: included.lineageJson,
              bridgeDepth: included.bridgeDepth,
              ...nextState
            },
            update: {
              entryRevisionId: included.entryRevisionId,
              activatedByMessageId: included.sourceMessageId,
              rootUserMessageId: included.rootUserMessageId,
              lineageJson: included.lineageJson,
              bridgeDepth: included.bridgeDepth,
              ...nextState,
              stateVersion: { increment: 1 }
            }
          });
          await tx.conversationWorldBookActivationEvent.create({
            data: {
              conversationId,
              entryId: included.entryId,
              entryRevisionId: included.entryRevisionId,
              sourceType: included.activationSource,
              sourceKey: `replay:${trace!.id}:${included.entryId}`,
              sourceMessageId: included.sourceMessageId,
              rootUserMessageId: included.rootUserMessageId,
              lineageJson: included.lineageJson,
              bridgeDepth: included.bridgeDepth,
              completedTurn: completedOrdinal
            }
          });
        }
      }
      await tx.conversation.update({
        where: { id: conversationId },
        data: { version: { increment: 1 } }
      });
      return { conversationId, completedTurns: completedOrdinal };
    });
  }
}

@Injectable()
export class CompanionReplayService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replay(companionId: string) {
    const turns = await this.prisma.companionTurn.findMany({
      where: { companionId },
      include: {
        messages: { include: { generationTrace: { include: { includedWorldBooks: true } } } }
      },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }]
    });
    return this.prisma.$transaction(async (tx) => {
      await tx.companionWorldBookActivationState.deleteMany({ where: { companionId } });
      await tx.companionWorldBookActivationEvent.deleteMany({ where: { companionId } });
      let completedOrdinal = 0;
      const stateByEntry = new Map<string, WorldBookActivationStateV2>();
      for (const turn of turns) {
        const user = turn.messages.find(
          (message) => message.id === turn.userMessageId && !message.deletedAt
        );
        const active = turn.messages.find(
          (message) =>
            message.id === turn.activeAssistantMessageId &&
            message.role === 'assistant' &&
            !message.deletedAt &&
            message.status === 'complete' &&
            message.generationTrace
        );
        if (user && active) completedOrdinal += 1;
        await tx.companionTurn.update({
          where: { id: turn.id },
          data: {
            activeAssistantMessageId: active?.id ?? null,
            completedOrdinal: user && active ? completedOrdinal : null,
            status: user && active ? 'complete' : user ? 'pending' : 'invalid',
            completedAt:
              user && active ? (turn.completedAt ?? active.generationTrace!.createdAt) : null
          }
        });
        const trace = active?.generationTrace;
        for (const included of trace?.includedWorldBooks ?? []) {
          const revision = await tx.worldBookEntryRevision.findUniqueOrThrow({
            where: { id: included.entryRevisionId },
            select: { configJson: true }
          });
          const nextState = advanceWorldBookActivationState(
            stateByEntry.get(included.entryId) ?? null,
            replayConfig(revision.configJson),
            included.activationSource as Parameters<typeof advanceWorldBookActivationState>[2],
            completedOrdinal
          );
          stateByEntry.set(included.entryId, nextState);
          await tx.companionWorldBookActivationState.upsert({
            where: { companionId_entryId: { companionId, entryId: included.entryId } },
            create: {
              companionId,
              entryId: included.entryId,
              entryRevisionId: included.entryRevisionId,
              activatedByMessageId: included.sourceMessageId,
              rootUserMessageId: included.rootUserMessageId,
              lineageJson: included.lineageJson,
              bridgeDepth: included.bridgeDepth,
              ...nextState
            },
            update: {
              entryRevisionId: included.entryRevisionId,
              activatedByMessageId: included.sourceMessageId,
              rootUserMessageId: included.rootUserMessageId,
              lineageJson: included.lineageJson,
              bridgeDepth: included.bridgeDepth,
              ...nextState,
              stateVersion: { increment: 1 }
            }
          });
          await tx.companionWorldBookActivationEvent.create({
            data: {
              companionId,
              entryId: included.entryId,
              entryRevisionId: included.entryRevisionId,
              sourceType: included.activationSource,
              sourceKey: `replay:${trace!.id}:${included.entryId}`,
              sourceMessageId: included.sourceMessageId,
              rootUserMessageId: included.rootUserMessageId,
              lineageJson: included.lineageJson,
              bridgeDepth: included.bridgeDepth,
              completedTurn: completedOrdinal
            }
          });
        }
      }
      await tx.companionMemory.updateMany({
        where: { companionId, activeRevisionId: { not: null } },
        data: { status: 'stale', nextRetryAt: new Date() }
      });
      await tx.companion.update({
        where: { id: companionId },
        data: { version: { increment: 1 } }
      });
      return { companionId, completedTurns: completedOrdinal, memoryMarkedStale: true };
    });
  }
}

function replayConfig(
  value: string
): Pick<
  WorldBookEntryConfigV2,
  'stickyTurns' | 'continuationTurns' | 'cooldownTurns' | 'delayTurns'
> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      stickyTurns: safeCount(parsed.stickyTurns),
      continuationTurns: safeCount(parsed.continuationTurns, 1),
      cooldownTurns: safeCount(parsed.cooldownTurns),
      delayTurns: safeCount(parsed.delayTurns)
    };
  } catch {
    return { stickyTurns: 0, continuationTurns: 1, cooldownTurns: 0, delayTurns: 0 };
  }
}

function safeCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}
