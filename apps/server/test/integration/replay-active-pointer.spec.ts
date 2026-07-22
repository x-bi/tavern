import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GenerationLifecycleService } from '../../src/services/context-engine/generation-lifecycle.service';
import type { ProposedGenerationTrace } from '../../src/services/context-engine/generation-lifecycle.types';
import {
  CompanionReplayService,
  ConversationReplayService
} from '../../src/services/context-engine/replay.service';
import { TestDatabase } from '../helpers/test-database';

describe('deterministic replay active pointer contract', () => {
  it('does not select a newer Conversation assistant outside the active pointer', async () => {
    const database = await TestDatabase.create();
    try {
      const prisma = database.client as unknown as PrismaService;
      const lifecycle = new GenerationLifecycleService(prisma);
      const user = await database.client.user.create({
        data: { username: 'replay-conversation', displayName: 'Owner' }
      });
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'Thread' }
      });
      const started = await lifecycle.beginConversation(conversation.id, {
        requestId: 'replay-conversation-request',
        userMessage: 'hello'
      });
      if (started.state !== 'started') throw new Error('expected generation start');
      await lifecycle.completeConversation({
        conversationId: conversation.id,
        requestDatabaseId: started.requestDatabaseId,
        turnId: started.turnId,
        assistantMessageId: started.assistantMessage.id,
        expectedVersion: started.expectedVersion,
        content: 'valid',
        tokenCount: 1,
        purpose: started.purpose,
        trace: trace(started.userMessage.id)
      });
      const invalid = await database.client.message.create({
        data: {
          conversationId: conversation.id,
          turnId: started.turnId,
          role: 'assistant',
          content: 'newer invalid',
          status: 'failed'
        }
      });
      await database.client.conversationTurn.update({
        where: { id: started.turnId },
        data: { activeAssistantMessageId: invalid.id }
      });
      const result = await new ConversationReplayService(prisma).replay(conversation.id);
      const replayed = await database.client.conversationTurn.findUniqueOrThrow({
        where: { id: started.turnId }
      });
      expect(result.completedTurns).toBe(0);
      expect(replayed).toMatchObject({
        activeAssistantMessageId: null,
        completedOrdinal: null,
        status: 'pending'
      });
    } finally {
      await database.close();
    }
  });

  it('uses the same active-pointer rule for Companion replay', async () => {
    const database = await TestDatabase.create();
    try {
      const prisma = database.client as unknown as PrismaService;
      const lifecycle = new GenerationLifecycleService(prisma);
      const user = await database.client.user.create({
        data: { username: 'replay-companion', displayName: 'Owner' }
      });
      const companion = await database.client.companion.create({
        data: { userId: user.id, name: 'Companion', memory: { create: {} } }
      });
      const started = await lifecycle.beginCompanion(companion.id, {
        requestId: 'replay-companion-request',
        userMessage: 'hello'
      });
      if (started.state !== 'started') throw new Error('expected generation start');
      await lifecycle.completeCompanion({
        companionId: companion.id,
        requestDatabaseId: started.requestDatabaseId,
        turnId: started.turnId,
        assistantMessageId: started.assistantMessage.id,
        expectedVersion: started.expectedVersion,
        content: 'valid',
        tokenCount: 1,
        purpose: started.purpose,
        trace: trace(started.userMessage.id)
      });
      const invalid = await database.client.companionMessage.create({
        data: {
          companionId: companion.id,
          turnId: started.turnId,
          role: 'assistant',
          content: 'newer invalid',
          status: 'stopped'
        }
      });
      await database.client.companionTurn.update({
        where: { id: started.turnId },
        data: { activeAssistantMessageId: invalid.id }
      });
      const result = await new CompanionReplayService(prisma).replay(companion.id);
      const replayed = await database.client.companionTurn.findUniqueOrThrow({
        where: { id: started.turnId }
      });
      expect(result.completedTurns).toBe(0);
      expect(replayed).toMatchObject({
        activeAssistantMessageId: null,
        completedOrdinal: null,
        status: 'pending'
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
