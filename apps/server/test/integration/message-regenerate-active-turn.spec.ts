import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MessagesService } from '../../src/modules/messages/messages.service';
import type { CurrentUser } from '../../src/modules/users/user.types';
import { GenerationLifecycleService } from '../../src/services/context-engine/generation-lifecycle.service';
import type { ProposedGenerationTrace } from '../../src/services/context-engine/generation-lifecycle.types';
import { ConversationReplayService } from '../../src/services/context-engine/replay.service';
import {
  CompanionTimelineService,
  ConversationTimelineService
} from '../../src/services/context-engine/timeline.service';
import { TargetEventsService } from '../../src/services/target-events/target-events.service';
import { TestDatabase } from '../helpers/test-database';

describe('message regenerate active-turn contract', () => {
  it('injects PrismaService into GenerationLifecycleService through Nest', async () => {
    const prisma = { $transaction: () => undefined };
    const module = await Test.createTestingModule({
      providers: [
        GenerationLifecycleService,
        ConversationTimelineService,
        CompanionTimelineService,
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    const lifecycle = module.get(GenerationLifecycleService) as unknown as {
      prisma: unknown;
    };
    expect(lifecycle.prisma).toBe(prisma);
    expect((module.get(ConversationTimelineService) as unknown as { prisma: unknown }).prisma).toBe(
      prisma
    );
    expect((module.get(CompanionTimelineService) as unknown as { prisma: unknown }).prisma).toBe(
      prisma
    );
    await module.close();
  });

  it('retries the active reply after a failed regenerate attempt and rejects the failed placeholder', async () => {
    const database = await TestDatabase.create();
    try {
      const prisma = database.client as unknown as PrismaService;
      const lifecycle = new GenerationLifecycleService(prisma);
      const messages = new MessagesService(
        prisma,
        new TargetEventsService(),
        new ConversationReplayService(prisma)
      );
      const userRecord = await database.client.user.create({
        data: { username: 'regenerate-active', displayName: 'Owner' }
      });
      const currentUser: CurrentUser = {
        id: userRecord.id,
        username: userRecord.username,
        displayName: userRecord.displayName,
        role: 'member'
      };
      const character = await database.client.character.create({
        data: { userId: userRecord.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: userRecord.id, characterId: character.id, title: 'Thread' }
      });
      const initial = await lifecycle.beginConversation(conversation.id, {
        requestId: 'initial-request',
        userMessage: 'hello'
      });
      if (initial.state !== 'started') throw new Error('expected initial generation');
      await lifecycle.completeConversation({
        conversationId: conversation.id,
        requestDatabaseId: initial.requestDatabaseId,
        turnId: initial.turnId,
        assistantMessageId: initial.assistantMessage.id,
        expectedVersion: initial.expectedVersion,
        content: 'first reply',
        tokenCount: 2,
        purpose: initial.purpose,
        trace: trace(initial.userMessage.id)
      });

      const failedAttempt = await lifecycle.beginConversation(conversation.id, {
        requestId: 'failed-regenerate',
        regenerateMessageId: initial.assistantMessage.id,
        turnId: initial.turnId
      });
      if (failedAttempt.state !== 'started') throw new Error('expected regenerate generation');
      await lifecycle.failConversation({
        conversationId: conversation.id,
        requestDatabaseId: failedAttempt.requestDatabaseId,
        turnId: failedAttempt.turnId,
        assistantMessageId: failedAttempt.assistantMessage.id,
        content: '',
        status: 'failed',
        errorCode: 'MODEL_ERROR'
      });

      await expect(
        messages.regenerate(currentUser, initial.assistantMessage.id)
      ).resolves.toMatchObject({
        regenerateMessageId: initial.assistantMessage.id,
        turnId: initial.turnId
      });
      await expect(
        messages.regenerate(currentUser, failedAttempt.assistantMessage.id)
      ).rejects.toMatchObject({
        response: { code: 'MESSAGE_REGENERATE_TARGET_INVALID' }
      });
    } finally {
      await database.close();
    }
  });
});

function trace(userMessageId: string): ProposedGenerationTrace {
  return {
    requestUserMessageId: userMessageId,
    rootUserMessageId: userMessageId,
    modelId: 'fake',
    compilerVersion: 'test',
    promptSnapshotJson: '{}',
    promptSnapshotHash: 'hash',
    capabilitiesSnapshotJson: '{}',
    modelParametersJson: '{}',
    sections: []
  };
}
