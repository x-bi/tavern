import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GenerationLifecycleService } from '../../src/services/context-engine/generation-lifecycle.service';
import type { ProposedGenerationTrace } from '../../src/services/context-engine/generation-lifecycle.types';
import { TestDatabase } from '../helpers/test-database';

describe('generation lifecycle idempotency and lease', () => {
  it('commits one Conversation request and replays the completed result idempotently', async () => {
    const database = await TestDatabase.create();
    try {
      const lifecycle = new GenerationLifecycleService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'lifecycle', displayName: 'Owner' }
      });
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'Thread' }
      });
      const started = await lifecycle.beginConversation(conversation.id, {
        requestId: 'request-0001',
        userMessage: 'hello'
      });
      expect(started.state).toBe('started');
      if (started.state !== 'started') return;
      await expect(
        lifecycle.beginConversation(conversation.id, {
          requestId: 'request-0001',
          userMessage: 'hello'
        })
      ).rejects.toMatchObject({ response: { code: 'GENERATION_REQUEST_IN_PROGRESS' } });
      await lifecycle.completeConversation({
        conversationId: conversation.id,
        requestDatabaseId: started.requestDatabaseId,
        turnId: started.turnId,
        assistantMessageId: started.assistantMessage.id,
        expectedVersion: started.expectedVersion,
        content: 'world',
        tokenCount: 1,
        purpose: started.purpose,
        trace: trace(started.userMessage.id)
      });
      await expect(
        lifecycle.beginConversation(conversation.id, {
          requestId: 'request-0001',
          userMessage: 'hello'
        })
      ).resolves.toEqual({ state: 'idempotent_complete', messageId: started.assistantMessage.id });
      expect(await database.client.conversationMessageGenerationTrace.count()).toBe(1);
      expect(
        (await database.client.conversationTurn.findUnique({ where: { id: started.turnId } }))
          ?.completedOrdinal
      ).toBe(1);
    } finally {
      await database.close();
    }
  });

  it('rejects a stale version and saves no successful Companion trace', async () => {
    const database = await TestDatabase.create();
    try {
      const lifecycle = new GenerationLifecycleService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'companion-life', displayName: 'Owner' }
      });
      const companion = await database.client.companion.create({
        data: { userId: user.id, name: 'Companion' }
      });
      const started = await lifecycle.beginCompanion(companion.id, {
        requestId: 'request-0002',
        userMessage: 'hello'
      });
      if (started.state !== 'started') return;
      await database.client.companion.update({
        where: { id: companion.id },
        data: { version: { increment: 1 } }
      });
      await expect(
        lifecycle.completeCompanion({
          companionId: companion.id,
          requestDatabaseId: started.requestDatabaseId,
          turnId: started.turnId,
          assistantMessageId: started.assistantMessage.id,
          expectedVersion: started.expectedVersion,
          content: 'stale',
          tokenCount: 1,
          purpose: started.purpose,
          trace: trace(started.userMessage.id)
        })
      ).rejects.toMatchObject({ response: { code: 'CONTEXT_COMMIT_CONFLICT' } });
      expect(await database.client.companionMessageGenerationTrace.count()).toBe(0);
      expect(
        (
          await database.client.companionMessage.findUnique({
            where: { id: started.assistantMessage.id }
          })
        )?.status
      ).toBe('failed');
    } finally {
      await database.close();
    }
  });

  it('commits an assistant-only proactive Companion turn without a user message', async () => {
    const database = await TestDatabase.create();
    try {
      const lifecycle = new GenerationLifecycleService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'companion-proactive', displayName: 'Owner' }
      });
      const companion = await database.client.companion.create({
        data: { userId: user.id, name: 'Companion' }
      });
      const started = await lifecycle.beginCompanionProactive(
        companion.id,
        'proactive:assistant-source'
      );
      expect(started.state).toBe('started');
      if (started.state !== 'started') return;
      expect(
        (await database.client.companionTurn.findUnique({ where: { id: started.turnId } }))
          ?.userMessageId
      ).toBeNull();
      await lifecycle.completeCompanion({
        companionId: companion.id,
        requestDatabaseId: started.requestDatabaseId,
        turnId: started.turnId,
        assistantMessageId: started.assistantMessage.id,
        expectedVersion: started.expectedVersion,
        content: '主动问候',
        tokenCount: 1,
        purpose: started.purpose,
        trace: trace(null)
      });
      const savedTrace = await database.client.companionMessageGenerationTrace.findUnique({
        where: { messageId: started.assistantMessage.id }
      });
      expect(savedTrace).toMatchObject({
        generationPurpose: 'proactive_chat',
        requestUserMessageId: null,
        rootUserMessageId: null
      });
    } finally {
      await database.close();
    }
  });

  it('commits evaluator-proposed WorldBook state exactly and only after success', async () => {
    const database = await TestDatabase.create();
    try {
      const lifecycle = new GenerationLifecycleService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'world-state', displayName: 'Owner' }
      });
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'Thread' }
      });
      const book = await database.client.worldBook.create({
        data: { userId: user.id, name: 'Lore' }
      });
      const entry = await database.client.worldBookEntry.create({
        data: { worldBookId: book.id }
      });
      const revision = await database.client.worldBookEntryRevision.create({
        data: {
          entryId: entry.id,
          version: 1,
          configJson: '{}',
          content: 'content',
          contentHash: 'hash'
        }
      });
      await database.client.worldBookEntry.update({
        where: { id: entry.id },
        data: { activeRevisionId: revision.id }
      });
      const started = await lifecycle.beginConversation(conversation.id, {
        requestId: 'request-world-state',
        userMessage: 'hit'
      });
      if (started.state !== 'started') return;
      const proposed = trace(started.userMessage.id);
      proposed.includedWorldBooks = [
        {
          entryId: entry.id,
          entryRevisionId: revision.id,
          activationSource: 'current_user',
          sourceMessageId: started.userMessage.id,
          rootUserMessageId: started.userMessage.id,
          lineageJson: JSON.stringify([entry.id]),
          bridgeDepth: 0
        }
      ];
      proposed.worldBookStateChanges = [
        {
          entryId: entry.id,
          entryRevisionId: revision.id,
          operation: 'upsert',
          sourceKey: 'turn:1:current_user',
          payload: {
            activatedByMessageId: started.userMessage.id,
            rootUserMessageId: started.userMessage.id,
            lineageJson: JSON.stringify([entry.id]),
            bridgeDepth: 0,
            activatedAtCompletedTurn: 1,
            stickyUntilCompletedTurn: 4,
            continuationUntilCompletedTurn: 2,
            cooldownUntilCompletedTurn: 6,
            pendingUntilCompletedTurn: null,
            manualActive: false,
            sourceType: 'current_user'
          }
        }
      ];
      expect(await database.client.conversationWorldBookActivationState.count()).toBe(0);
      await lifecycle.completeConversation({
        conversationId: conversation.id,
        requestDatabaseId: started.requestDatabaseId,
        turnId: started.turnId,
        assistantMessageId: started.assistantMessage.id,
        expectedVersion: started.expectedVersion,
        content: 'done',
        tokenCount: 1,
        purpose: started.purpose,
        trace: proposed
      });
      const state = await database.client.conversationWorldBookActivationState.findFirstOrThrow();
      expect(state).toMatchObject({
        activatedAtCompletedTurn: 1,
        stickyUntilCompletedTurn: 4,
        continuationUntilCompletedTurn: 2,
        cooldownUntilCompletedTurn: 6
      });
      expect(await database.client.conversationWorldBookActivationEvent.count()).toBe(1);
    } finally {
      await database.close();
    }
  });

  it('keeps failed/stopped requests terminal and prevents a new-turn/regenerate collision', async () => {
    const database = await TestDatabase.create();
    try {
      const lifecycle = new GenerationLifecycleService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'terminal-collision', displayName: 'Owner' }
      });
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'Thread' }
      });
      const initial = await lifecycle.beginConversation(conversation.id, {
        requestId: 'terminal-initial-request',
        userMessage: 'first'
      });
      if (initial.state !== 'started') throw new Error('expected generation start');
      await lifecycle.completeConversation({
        conversationId: conversation.id,
        requestDatabaseId: initial.requestDatabaseId,
        turnId: initial.turnId,
        assistantMessageId: initial.assistantMessage.id,
        expectedVersion: initial.expectedVersion,
        content: 'done',
        tokenCount: 1,
        purpose: initial.purpose,
        trace: trace(initial.userMessage.id)
      });
      const regeneration = await lifecycle.beginConversation(conversation.id, {
        requestId: 'terminal-regenerate-request',
        regenerateMessageId: initial.assistantMessage.id,
        turnId: initial.turnId
      });
      if (regeneration.state !== 'started') throw new Error('expected regeneration start');
      await expect(
        lifecycle.beginConversation(conversation.id, {
          requestId: 'colliding-new-turn',
          userMessage: 'must not be inserted'
        })
      ).rejects.toMatchObject({ response: { code: 'GENERATION_REQUEST_IN_PROGRESS' } });
      await lifecycle.failConversation({
        conversationId: conversation.id,
        requestDatabaseId: regeneration.requestDatabaseId,
        turnId: regeneration.turnId,
        assistantMessageId: regeneration.assistantMessage.id,
        content: 'partial',
        status: 'stopped',
        errorCode: 'CHAT_STOPPED'
      });
      await expect(
        lifecycle.beginConversation(conversation.id, {
          requestId: 'terminal-regenerate-request',
          regenerateMessageId: initial.assistantMessage.id,
          turnId: initial.turnId
        })
      ).rejects.toMatchObject({ response: { code: 'CHAT_STOPPED' } });
      expect(
        await database.client.message.count({
          where: { conversationId: conversation.id, content: 'must not be inserted' }
        })
      ).toBe(0);
    } finally {
      await database.close();
    }
  });

  it('scopes the same public request id independently by owner target', async () => {
    const database = await TestDatabase.create();
    try {
      const lifecycle = new GenerationLifecycleService(database.client as unknown as PrismaService);
      const firstOwner = await database.client.user.create({
        data: { username: 'share-owner-one', displayName: 'One' }
      });
      const secondOwner = await database.client.user.create({
        data: { username: 'share-owner-two', displayName: 'Two' }
      });
      const firstCharacter = await database.client.character.create({
        data: { userId: firstOwner.id, name: 'First role' }
      });
      const secondCharacter = await database.client.character.create({
        data: { userId: secondOwner.id, name: 'Second role' }
      });
      const first = await database.client.conversation.create({
        data: { userId: firstOwner.id, characterId: firstCharacter.id, title: 'First' }
      });
      const second = await database.client.conversation.create({
        data: { userId: secondOwner.id, characterId: secondCharacter.id, title: 'Second' }
      });
      const [firstRequest, secondRequest] = await Promise.all([
        lifecycle.beginConversation(first.id, {
          requestId: 'same-public-request',
          userMessage: 'one'
        }),
        lifecycle.beginConversation(second.id, {
          requestId: 'same-public-request',
          userMessage: 'two'
        })
      ]);
      expect(firstRequest.state).toBe('started');
      expect(secondRequest.state).toBe('started');
      expect(await database.client.conversationGenerationRequest.count()).toBe(2);
    } finally {
      await database.close();
    }
  });
});

function trace(userMessageId: string | null): ProposedGenerationTrace {
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
