import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import type { CompanionMessage, Message, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { canonicalSha256 } from '../../common/canonical-json';
import type {
  GenerationPurpose,
  PreparedGeneration,
  ProposedGenerationTrace
} from './generation-lifecycle.types';

type BeginInput = {
  requestId: string;
  userMessage?: string;
  regenerateMessageId?: string;
  turnId?: string;
  requestContext?: unknown;
};

@Injectable()
export class GenerationLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async beginConversation(
    conversationId: string,
    input: BeginInput
  ): Promise<PreparedGeneration<Message>> {
    const purpose: GenerationPurpose = input.regenerateMessageId ? 'regenerate' : 'chat_reply';
    const requestHash = canonicalSha256({
      target: { type: 'conversation', id: conversationId },
      purpose,
      userMessage: input.userMessage?.trim() ?? null,
      regenerateMessageId: input.regenerateMessageId ?? null,
      turnId: input.turnId ?? null,
      requestContext: input.requestContext ?? null
    });
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.conversationGenerationRequest.findUnique({
        where: { conversationId_requestId: { conversationId, requestId: input.requestId } }
      });
      if (existing) return this.resolveExisting<Message>(existing, requestHash);

      const conversation = await tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { version: true, activeGenerationLeaseId: true }
      });
      if (conversation.activeGenerationLeaseId) this.inProgress();

      const ids = {
        request: randomUUID(),
        turn: input.turnId ?? randomUUID(),
        user: randomUUID(),
        assistant: randomUUID()
      };
      const expectedVersion = conversation.version + 1;
      const leased = await tx.conversation.updateMany({
        where: { id: conversationId, version: conversation.version, activeGenerationLeaseId: null },
        data: { version: { increment: 1 }, activeGenerationLeaseId: ids.request }
      });
      if (leased.count !== 1) this.inProgress();

      let turnId = ids.turn;
      let userMessage: Message;
      if (purpose === 'regenerate') {
        const turn = await tx.conversationTurn.findFirst({
          where: {
            id: input.turnId,
            conversationId,
            activeAssistantMessageId: input.regenerateMessageId
          },
          include: { userMessage: true }
        });
        if (!turn)
          this.conflict(
            'GENERATION_TURN_INVALID',
            'Regenerate must target the active assistant of the supplied turn.'
          );
        turnId = turn.id;
        userMessage = turn.userMessage;
      } else {
        if (!input.userMessage?.trim()) this.conflict('BAD_REQUEST', 'User message is required.');
        const last = await tx.conversationTurn.aggregate({
          where: { conversationId },
          _max: { sequence: true }
        });
        userMessage = await tx.message.create({
          data: {
            id: ids.user,
            conversationId,
            role: 'user',
            content: input.userMessage.trim(),
            status: 'complete',
            metadataJson: JSON.stringify({ source: 'chat-stream', requestId: input.requestId })
          }
        });
        await tx.conversationTurn.create({
          data: {
            id: turnId,
            conversationId,
            sequence: (last._max.sequence ?? 0) + 1,
            userMessageId: userMessage.id,
            status: 'generating'
          }
        });
        userMessage = await tx.message.update({ where: { id: userMessage.id }, data: { turnId } });
      }
      const assistantMessage = await tx.message.create({
        data: {
          id: ids.assistant,
          conversationId,
          turnId,
          role: 'assistant',
          content: '',
          status: 'generating',
          metadataJson: JSON.stringify({
            source: 'chat-stream',
            requestId: input.requestId,
            requestMessageId: userMessage.id
          })
        }
      });
      await tx.conversationGenerationRequest.create({
        data: {
          id: ids.request,
          requestId: input.requestId,
          requestHash,
          conversationId,
          turnId,
          purpose,
          status: 'generating',
          baseVersion: conversation.version
        }
      });
      return {
        state: 'started',
        requestDatabaseId: ids.request,
        turnId,
        expectedVersion,
        purpose,
        userMessage,
        assistantMessage
      };
    });
  }

  async beginCompanion(
    companionId: string,
    input: BeginInput
  ): Promise<PreparedGeneration<CompanionMessage>> {
    const purpose: GenerationPurpose = input.regenerateMessageId ? 'regenerate' : 'chat_reply';
    const requestHash = canonicalSha256({
      target: { type: 'companion', id: companionId },
      purpose,
      userMessage: input.userMessage?.trim() ?? null,
      regenerateMessageId: input.regenerateMessageId ?? null,
      turnId: input.turnId ?? null,
      requestContext: input.requestContext ?? null
    });
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.companionGenerationRequest.findUnique({
        where: { companionId_requestId: { companionId, requestId: input.requestId } }
      });
      if (existing) return this.resolveExisting<CompanionMessage>(existing, requestHash);
      const companion = await tx.companion.findUniqueOrThrow({
        where: { id: companionId },
        select: { version: true, activeGenerationLeaseId: true }
      });
      if (companion.activeGenerationLeaseId) this.inProgress();
      const ids = {
        request: randomUUID(),
        turn: input.turnId ?? randomUUID(),
        user: randomUUID(),
        assistant: randomUUID()
      };
      const expectedVersion = companion.version + 1;
      const leased = await tx.companion.updateMany({
        where: { id: companionId, version: companion.version, activeGenerationLeaseId: null },
        data: { version: { increment: 1 }, activeGenerationLeaseId: ids.request }
      });
      if (leased.count !== 1) this.inProgress();

      let turnId = ids.turn;
      let userMessage: CompanionMessage;
      if (purpose === 'regenerate') {
        const turn = await tx.companionTurn.findFirst({
          where: {
            id: input.turnId,
            companionId,
            activeAssistantMessageId: input.regenerateMessageId
          },
          include: { userMessage: true }
        });
        if (!turn)
          this.conflict(
            'GENERATION_TURN_INVALID',
            'Regenerate must target the active assistant of the supplied turn.'
          );
        turnId = turn.id;
        userMessage = turn.userMessage;
      } else {
        if (!input.userMessage?.trim()) this.conflict('BAD_REQUEST', 'User message is required.');
        const last = await tx.companionTurn.aggregate({
          where: { companionId },
          _max: { sequence: true }
        });
        userMessage = await tx.companionMessage.create({
          data: {
            id: ids.user,
            companionId,
            role: 'user',
            content: input.userMessage.trim(),
            status: 'complete',
            metadataJson: JSON.stringify({ requestId: input.requestId })
          }
        });
        await tx.companionTurn.create({
          data: {
            id: turnId,
            companionId,
            sequence: (last._max.sequence ?? 0) + 1,
            userMessageId: userMessage.id,
            status: 'generating'
          }
        });
        userMessage = await tx.companionMessage.update({
          where: { id: userMessage.id },
          data: { turnId }
        });
      }
      const assistantMessage = await tx.companionMessage.create({
        data: {
          id: ids.assistant,
          companionId,
          turnId,
          role: 'assistant',
          content: '',
          status: 'generating',
          metadataJson: JSON.stringify({
            requestId: input.requestId,
            requestMessageId: userMessage.id
          })
        }
      });
      await tx.companionGenerationRequest.create({
        data: {
          id: ids.request,
          requestId: input.requestId,
          requestHash,
          companionId,
          turnId,
          purpose,
          status: 'generating',
          baseVersion: companion.version
        }
      });
      return {
        state: 'started',
        requestDatabaseId: ids.request,
        turnId,
        expectedVersion,
        purpose,
        userMessage,
        assistantMessage
      };
    });
  }

  createConversationAttempt(
    requestDatabaseId: string,
    attemptIndex: number,
    modelId: string,
    snapshot?: { hash: string; capabilities: unknown; parameters: unknown }
  ) {
    return this.prisma.conversationGenerationAttempt.create({
      data: {
        generationRequestId: requestDatabaseId,
        attemptIndex,
        modelId,
        status: 'generating',
        ...(snapshot
          ? {
              promptSnapshotHash: snapshot.hash,
              capabilitiesSnapshotJson: JSON.stringify(snapshot.capabilities),
              modelParametersJson: JSON.stringify(snapshot.parameters)
            }
          : {})
      }
    });
  }

  createCompanionAttempt(
    requestDatabaseId: string,
    attemptIndex: number,
    modelId: string,
    snapshot?: { hash: string; capabilities: unknown; parameters: unknown }
  ) {
    return this.prisma.companionGenerationAttempt.create({
      data: {
        generationRequestId: requestDatabaseId,
        attemptIndex,
        modelId,
        status: 'generating',
        ...(snapshot
          ? {
              promptSnapshotHash: snapshot.hash,
              capabilitiesSnapshotJson: JSON.stringify(snapshot.capabilities),
              modelParametersJson: JSON.stringify(snapshot.parameters)
            }
          : {})
      }
    });
  }

  updateConversationAttemptSnapshot(
    id: string,
    snapshot: { hash: string; capabilities: unknown; parameters: unknown }
  ) {
    return this.prisma.conversationGenerationAttempt.update({
      where: { id },
      data: {
        promptSnapshotHash: snapshot.hash,
        capabilitiesSnapshotJson: canonical(snapshot.capabilities),
        modelParametersJson: canonical(snapshot.parameters)
      }
    });
  }

  updateCompanionAttemptSnapshot(
    id: string,
    snapshot: { hash: string; capabilities: unknown; parameters: unknown }
  ) {
    return this.prisma.companionGenerationAttempt.update({
      where: { id },
      data: {
        promptSnapshotHash: snapshot.hash,
        capabilitiesSnapshotJson: canonical(snapshot.capabilities),
        modelParametersJson: canonical(snapshot.parameters)
      }
    });
  }

  async finishConversationAttempt(
    id: string,
    status: 'succeeded' | 'failed' | 'stopped',
    emittedDelta: boolean,
    errorCode?: string
  ) {
    await this.prisma.conversationGenerationAttempt.update({
      where: { id },
      data: { status, emittedDelta, errorCode, completedAt: new Date() }
    });
  }

  async finishCompanionAttempt(
    id: string,
    status: 'succeeded' | 'failed' | 'stopped',
    emittedDelta: boolean,
    errorCode?: string
  ) {
    await this.prisma.companionGenerationAttempt.update({
      where: { id },
      data: { status, emittedDelta, errorCode, completedAt: new Date() }
    });
  }

  async completeConversation(input: {
    conversationId: string;
    requestDatabaseId: string;
    turnId: string;
    assistantMessageId: string;
    expectedVersion: number;
    content: string;
    tokenCount: number;
    purpose: GenerationPurpose;
    trace: ProposedGenerationTrace;
  }): Promise<void> {
    const committed = await this.prisma.$transaction(async (tx) => {
      const lease = await tx.conversation.updateMany({
        where: {
          id: input.conversationId,
          version: input.expectedVersion,
          activeGenerationLeaseId: input.requestDatabaseId
        },
        data: {
          version: { increment: 1 },
          activeGenerationLeaseId: null,
          lastMessageAt: new Date()
        }
      });
      if (lease.count !== 1) {
        await this.markConversationConflict(tx, input);
        return false;
      }
      const turn = await tx.conversationTurn.findUniqueOrThrow({ where: { id: input.turnId } });
      const completedOrdinal =
        turn.completedOrdinal ??
        ((
          await tx.conversationTurn.aggregate({
            where: { conversationId: input.conversationId },
            _max: { completedOrdinal: true }
          })
        )._max.completedOrdinal ?? 0) + 1;
      if (
        turn.activeAssistantMessageId &&
        turn.activeAssistantMessageId !== input.assistantMessageId
      ) {
        await tx.message.update({
          where: { id: turn.activeAssistantMessageId },
          data: { status: 'replaced' }
        });
      }
      await tx.message.update({
        where: { id: input.assistantMessageId },
        data: { content: input.content, status: 'complete', tokenCount: input.tokenCount }
      });
      await tx.conversationTurn.update({
        where: { id: input.turnId },
        data: {
          activeAssistantMessageId: input.assistantMessageId,
          completedOrdinal,
          status: 'complete',
          completedAt: new Date()
        }
      });
      await this.createConversationTrace(tx, input);
      await this.commitConversationWorldBookState(tx, input, completedOrdinal);
      await tx.conversationGenerationRequest.update({
        where: { id: input.requestDatabaseId },
        data: {
          status: 'complete',
          resultMessageId: input.assistantMessageId,
          completedAt: new Date()
        }
      });
      return true;
    });
    if (!committed)
      this.conflict(
        'CONTEXT_COMMIT_CONFLICT',
        'Conversation context changed before generation committed.'
      );
  }

  async completeCompanion(input: {
    companionId: string;
    requestDatabaseId: string;
    turnId: string;
    assistantMessageId: string;
    expectedVersion: number;
    content: string;
    tokenCount: number;
    purpose: GenerationPurpose;
    trace: ProposedGenerationTrace;
  }): Promise<void> {
    const committed = await this.prisma.$transaction(async (tx) => {
      const lease = await tx.companion.updateMany({
        where: {
          id: input.companionId,
          version: input.expectedVersion,
          activeGenerationLeaseId: input.requestDatabaseId
        },
        data: { version: { increment: 1 }, activeGenerationLeaseId: null }
      });
      if (lease.count !== 1) {
        await this.markCompanionConflict(tx, input);
        return false;
      }
      const turn = await tx.companionTurn.findUniqueOrThrow({ where: { id: input.turnId } });
      const completedOrdinal =
        turn.completedOrdinal ??
        ((
          await tx.companionTurn.aggregate({
            where: { companionId: input.companionId },
            _max: { completedOrdinal: true }
          })
        )._max.completedOrdinal ?? 0) + 1;
      if (
        turn.activeAssistantMessageId &&
        turn.activeAssistantMessageId !== input.assistantMessageId
      )
        await tx.companionMessage.update({
          where: { id: turn.activeAssistantMessageId },
          data: { status: 'replaced' }
        });
      await tx.companionMessage.update({
        where: { id: input.assistantMessageId },
        data: { content: input.content, status: 'complete', tokenCount: input.tokenCount }
      });
      await tx.companionTurn.update({
        where: { id: input.turnId },
        data: {
          activeAssistantMessageId: input.assistantMessageId,
          completedOrdinal,
          status: 'complete',
          completedAt: new Date()
        }
      });
      await this.createCompanionTrace(tx, input);
      await this.commitCompanionWorldBookState(tx, input, completedOrdinal);
      await tx.companionGenerationRequest.update({
        where: { id: input.requestDatabaseId },
        data: {
          status: 'complete',
          resultMessageId: input.assistantMessageId,
          completedAt: new Date()
        }
      });
      return true;
    });
    if (!committed)
      this.conflict(
        'CONTEXT_COMMIT_CONFLICT',
        'Companion context changed before generation committed.'
      );
  }

  async failConversation(input: {
    conversationId: string;
    requestDatabaseId: string;
    turnId: string;
    assistantMessageId: string;
    content: string;
    status: 'failed' | 'stopped';
    errorCode: string;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: input.assistantMessageId },
        data: { content: input.content, status: input.status }
      });
      const turn = await tx.conversationTurn.findUnique({ where: { id: input.turnId } });
      if (!turn?.activeAssistantMessageId)
        await tx.conversationTurn.update({
          where: { id: input.turnId },
          data: { status: input.status }
        });
      await tx.conversationGenerationRequest.update({
        where: { id: input.requestDatabaseId },
        data: { status: input.status, errorCode: input.errorCode, completedAt: new Date() }
      });
      await tx.conversation.updateMany({
        where: { id: input.conversationId, activeGenerationLeaseId: input.requestDatabaseId },
        data: { activeGenerationLeaseId: null, version: { increment: 1 } }
      });
    });
  }

  async failCompanion(input: {
    companionId: string;
    requestDatabaseId: string;
    turnId: string;
    assistantMessageId: string;
    content: string;
    status: 'failed' | 'stopped';
    errorCode: string;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.companionMessage.update({
        where: { id: input.assistantMessageId },
        data: { content: input.content, status: input.status }
      });
      const turn = await tx.companionTurn.findUnique({ where: { id: input.turnId } });
      if (!turn?.activeAssistantMessageId)
        await tx.companionTurn.update({
          where: { id: input.turnId },
          data: { status: input.status }
        });
      await tx.companionGenerationRequest.update({
        where: { id: input.requestDatabaseId },
        data: { status: input.status, errorCode: input.errorCode, completedAt: new Date() }
      });
      await tx.companion.updateMany({
        where: { id: input.companionId, activeGenerationLeaseId: input.requestDatabaseId },
        data: { activeGenerationLeaseId: null, version: { increment: 1 } }
      });
    });
  }

  private resolveExisting<TMessage extends Message | CompanionMessage>(
    existing: {
      requestHash: string;
      status: string;
      resultMessageId: string | null;
      errorCode: string | null;
    },
    requestHash: string
  ): PreparedGeneration<TMessage> {
    if (existing.requestHash !== requestHash)
      this.conflict(
        'GENERATION_REQUEST_CONFLICT',
        'requestId was already used with different generation input.'
      );
    if (existing.status === 'complete' && existing.resultMessageId)
      return { state: 'idempotent_complete', messageId: existing.resultMessageId };
    if (existing.status === 'generating') this.inProgress();
    this.conflict(
      existing.errorCode ?? 'GENERATION_REQUEST_TERMINAL',
      'Generation request already reached a terminal state.'
    );
  }

  private async createConversationTrace(
    tx: Prisma.TransactionClient,
    input: Parameters<GenerationLifecycleService['completeConversation']>[0]
  ) {
    await tx.conversationMessageGenerationTrace.create({
      data: {
        messageId: input.assistantMessageId,
        generationRequestId: input.requestDatabaseId,
        turnId: input.turnId,
        requestUserMessageId: input.trace.requestUserMessageId,
        generationPurpose: input.purpose,
        modelId: input.trace.modelId,
        compilerVersion: input.trace.compilerVersion,
        rootUserMessageId: input.trace.rootUserMessageId,
        promptSnapshotJson: input.trace.promptSnapshotJson,
        promptSnapshotHash: input.trace.promptSnapshotHash,
        capabilitiesSnapshotJson: input.trace.capabilitiesSnapshotJson,
        modelParametersJson: input.trace.modelParametersJson,
        sectionTraces: { create: input.trace.sections },
        includedWorldBooks: { create: input.trace.includedWorldBooks ?? [] }
      }
    });
  }

  private async createCompanionTrace(
    tx: Prisma.TransactionClient,
    input: Parameters<GenerationLifecycleService['completeCompanion']>[0]
  ) {
    await tx.companionMessageGenerationTrace.create({
      data: {
        messageId: input.assistantMessageId,
        generationRequestId: input.requestDatabaseId,
        turnId: input.turnId,
        requestUserMessageId: input.trace.requestUserMessageId,
        generationPurpose: input.purpose,
        modelId: input.trace.modelId,
        compilerVersion: input.trace.compilerVersion,
        rootUserMessageId: input.trace.rootUserMessageId,
        memoryRevisionIdUsed: input.trace.memoryRevisionIdUsed,
        promptSnapshotJson: input.trace.promptSnapshotJson,
        promptSnapshotHash: input.trace.promptSnapshotHash,
        capabilitiesSnapshotJson: input.trace.capabilitiesSnapshotJson,
        modelParametersJson: input.trace.modelParametersJson,
        sectionTraces: { create: input.trace.sections },
        includedWorldBooks: { create: input.trace.includedWorldBooks ?? [] }
      }
    });
  }

  private async commitConversationWorldBookState(
    tx: Prisma.TransactionClient,
    input: Parameters<GenerationLifecycleService['completeConversation']>[0],
    completedOrdinal: number
  ) {
    for (const change of input.trace.worldBookStateChanges ?? []) {
      if (change.operation === 'clear') {
        await tx.conversationWorldBookActivationState.deleteMany({
          where: { conversationId: input.conversationId, entryId: change.entryId }
        });
        continue;
      }
      const payload = change.payload;
      await tx.conversationWorldBookActivationState.upsert({
        where: {
          conversationId_entryId: {
            conversationId: input.conversationId,
            entryId: change.entryId
          }
        },
        create: {
          conversationId: input.conversationId,
          entryId: change.entryId,
          entryRevisionId: change.entryRevisionId,
          activatedByMessageId: stringOrNull(payload.activatedByMessageId),
          rootUserMessageId: stringOrNull(payload.rootUserMessageId),
          lineageJson: stringValue(payload.lineageJson, '[]'),
          bridgeDepth: numberValue(payload.bridgeDepth),
          activatedAtCompletedTurn: nullableNumber(payload.activatedAtCompletedTurn),
          stickyUntilCompletedTurn: nullableNumber(payload.stickyUntilCompletedTurn),
          continuationUntilCompletedTurn: nullableNumber(payload.continuationUntilCompletedTurn),
          cooldownUntilCompletedTurn: nullableNumber(payload.cooldownUntilCompletedTurn),
          pendingUntilCompletedTurn: nullableNumber(payload.pendingUntilCompletedTurn),
          manualActive: booleanValue(payload.manualActive)
        },
        update: {
          entryRevisionId: change.entryRevisionId,
          activatedByMessageId: stringOrNull(payload.activatedByMessageId),
          rootUserMessageId: stringOrNull(payload.rootUserMessageId),
          lineageJson: stringValue(payload.lineageJson, '[]'),
          bridgeDepth: numberValue(payload.bridgeDepth),
          activatedAtCompletedTurn: nullableNumber(payload.activatedAtCompletedTurn),
          stickyUntilCompletedTurn: nullableNumber(payload.stickyUntilCompletedTurn),
          continuationUntilCompletedTurn: nullableNumber(payload.continuationUntilCompletedTurn),
          cooldownUntilCompletedTurn: nullableNumber(payload.cooldownUntilCompletedTurn),
          pendingUntilCompletedTurn: nullableNumber(payload.pendingUntilCompletedTurn),
          manualActive: booleanValue(payload.manualActive),
          stateVersion: { increment: 1 }
        }
      });
      await tx.conversationWorldBookActivationEvent.upsert({
        where: {
          conversationId_entryId_entryRevisionId_sourceKey: {
            conversationId: input.conversationId,
            entryId: change.entryId,
            entryRevisionId: change.entryRevisionId,
            sourceKey: change.sourceKey
          }
        },
        create: {
          conversationId: input.conversationId,
          entryId: change.entryId,
          entryRevisionId: change.entryRevisionId,
          sourceType: stringValue(payload.sourceType, 'runtime'),
          sourceKey: change.sourceKey,
          sourceMessageId: stringOrNull(payload.activatedByMessageId),
          rootUserMessageId: stringOrNull(payload.rootUserMessageId),
          lineageJson: stringValue(payload.lineageJson, '[]'),
          bridgeDepth: numberValue(payload.bridgeDepth),
          completedTurn: completedOrdinal
        },
        update: {}
      });
    }
  }

  private async commitCompanionWorldBookState(
    tx: Prisma.TransactionClient,
    input: Parameters<GenerationLifecycleService['completeCompanion']>[0],
    completedOrdinal: number
  ) {
    for (const change of input.trace.worldBookStateChanges ?? []) {
      if (change.operation === 'clear') {
        await tx.companionWorldBookActivationState.deleteMany({
          where: { companionId: input.companionId, entryId: change.entryId }
        });
        continue;
      }
      const payload = change.payload;
      await tx.companionWorldBookActivationState.upsert({
        where: {
          companionId_entryId: { companionId: input.companionId, entryId: change.entryId }
        },
        create: {
          companionId: input.companionId,
          entryId: change.entryId,
          entryRevisionId: change.entryRevisionId,
          activatedByMessageId: stringOrNull(payload.activatedByMessageId),
          rootUserMessageId: stringOrNull(payload.rootUserMessageId),
          lineageJson: stringValue(payload.lineageJson, '[]'),
          bridgeDepth: numberValue(payload.bridgeDepth),
          activatedAtCompletedTurn: nullableNumber(payload.activatedAtCompletedTurn),
          stickyUntilCompletedTurn: nullableNumber(payload.stickyUntilCompletedTurn),
          continuationUntilCompletedTurn: nullableNumber(payload.continuationUntilCompletedTurn),
          cooldownUntilCompletedTurn: nullableNumber(payload.cooldownUntilCompletedTurn),
          pendingUntilCompletedTurn: nullableNumber(payload.pendingUntilCompletedTurn),
          manualActive: booleanValue(payload.manualActive)
        },
        update: {
          entryRevisionId: change.entryRevisionId,
          activatedByMessageId: stringOrNull(payload.activatedByMessageId),
          rootUserMessageId: stringOrNull(payload.rootUserMessageId),
          lineageJson: stringValue(payload.lineageJson, '[]'),
          bridgeDepth: numberValue(payload.bridgeDepth),
          activatedAtCompletedTurn: nullableNumber(payload.activatedAtCompletedTurn),
          stickyUntilCompletedTurn: nullableNumber(payload.stickyUntilCompletedTurn),
          continuationUntilCompletedTurn: nullableNumber(payload.continuationUntilCompletedTurn),
          cooldownUntilCompletedTurn: nullableNumber(payload.cooldownUntilCompletedTurn),
          pendingUntilCompletedTurn: nullableNumber(payload.pendingUntilCompletedTurn),
          manualActive: booleanValue(payload.manualActive),
          stateVersion: { increment: 1 }
        }
      });
      await tx.companionWorldBookActivationEvent.upsert({
        where: {
          companionId_entryId_entryRevisionId_sourceKey: {
            companionId: input.companionId,
            entryId: change.entryId,
            entryRevisionId: change.entryRevisionId,
            sourceKey: change.sourceKey
          }
        },
        create: {
          companionId: input.companionId,
          entryId: change.entryId,
          entryRevisionId: change.entryRevisionId,
          sourceType: stringValue(payload.sourceType, 'runtime'),
          sourceKey: change.sourceKey,
          sourceMessageId: stringOrNull(payload.activatedByMessageId),
          rootUserMessageId: stringOrNull(payload.rootUserMessageId),
          lineageJson: stringValue(payload.lineageJson, '[]'),
          bridgeDepth: numberValue(payload.bridgeDepth),
          completedTurn: completedOrdinal
        },
        update: {}
      });
    }
  }

  private async markConversationConflict(
    tx: Prisma.TransactionClient,
    input: { conversationId: string; requestDatabaseId: string; assistantMessageId: string }
  ) {
    await tx.message.update({
      where: { id: input.assistantMessageId },
      data: { status: 'failed' }
    });
    await tx.conversationGenerationRequest.update({
      where: { id: input.requestDatabaseId },
      data: { status: 'failed', errorCode: 'CONTEXT_COMMIT_CONFLICT', completedAt: new Date() }
    });
    await tx.conversation.updateMany({
      where: { id: input.conversationId, activeGenerationLeaseId: input.requestDatabaseId },
      data: { activeGenerationLeaseId: null, version: { increment: 1 } }
    });
  }

  private async markCompanionConflict(
    tx: Prisma.TransactionClient,
    input: { companionId: string; requestDatabaseId: string; assistantMessageId: string }
  ) {
    await tx.companionMessage.update({
      where: { id: input.assistantMessageId },
      data: { status: 'failed' }
    });
    await tx.companionGenerationRequest.update({
      where: { id: input.requestDatabaseId },
      data: { status: 'failed', errorCode: 'CONTEXT_COMMIT_CONFLICT', completedAt: new Date() }
    });
    await tx.companion.updateMany({
      where: { id: input.companionId, activeGenerationLeaseId: input.requestDatabaseId },
      data: { activeGenerationLeaseId: null, version: { increment: 1 } }
    });
  }

  private inProgress(): never {
    return this.conflict(
      'GENERATION_REQUEST_IN_PROGRESS',
      'A generation request is already in progress.'
    );
  }
  private conflict(code: string, message: string): never {
    throw new ConflictException({ code, message });
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}
