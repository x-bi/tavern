import { describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { WorldBookRuntimeService } from '../../src/services/context-engine/world-book-runtime.service';
import { TestDatabase } from '../helpers/test-database';

describe('WorldBookRuntimeService', () => {
  it('returns V2 sections and proposed state without mutating preview state', async () => {
    const database = await TestDatabase.create();
    try {
      const runtime = new WorldBookRuntimeService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'runtime', displayName: 'Owner' }
      });
      const character = await database.client.character.create({
        data: { userId: user.id, name: 'Role' }
      });
      const conversation = await database.client.conversation.create({
        data: { userId: user.id, characterId: character.id, title: 'Thread' }
      });
      const result = await runtime.evaluateConversation({
        conversationId: conversation.id,
        purpose: 'chat_reply',
        currentUserMessage: {
          id: 'current',
          conversationId: conversation.id,
          role: 'user',
          content: '去上海外滩看夜景'
        },
        history: [],
        worldBooks: [
          {
            id: 'book',
            userId: user.id,
            name: 'Lore',
            description: '',
            isEnabled: true,
            isSensitive: false,
            scanDepth: 6,
            tokenBudget: 1000,
            entries: [
              {
                id: 'entry',
                activeRevisionId: 'revision',
                worldBookId: 'book',
                title: '外滩',
                content: '外滩夜景很美。',
                keywords: ['上海外滩'],
                secondaryKeywords: ['夜景'],
                isEnabled: true,
                budgetPriority: 9,
                sortOrder: 0,
                position: 'before_history',
                tokenBudget: null,
                config: {
                  title: '外滩',
                  contentType: 'lore',
                  trustLevel: 'user_authored',
                  activationMode: 'keyword',
                  matchMode: 'normalized_phrase',
                  primaryKeywords: ['上海外滩'],
                  primaryLogic: 'any',
                  secondaryKeywords: ['夜景'],
                  secondaryLogic: 'and_any',
                  excludeKeywords: [],
                  sameMessageOnly: true,
                  scanSources: ['current_user'],
                  userHistoryScanDepth: 6,
                  stickyTurns: 2,
                  continuationTurns: 1,
                  cooldownTurns: 1,
                  delayTurns: 0,
                  cooldownPolicy: 'strict',
                  generationPurposes: ['chat_reply'],
                  budgetPriority: 9,
                  sortOrder: 0,
                  placement: 'before_history'
                }
              }
            ]
          }
        ]
      });
      expect(result.sections).toHaveLength(1);
      expect(result.includedWorldBooks[0]).toMatchObject({ activationSource: 'current_user' });
      expect(result.stateChanges[0]?.payload).toMatchObject({
        stickyUntilCompletedTurn: 3,
        continuationUntilCompletedTurn: 2,
        cooldownUntilCompletedTurn: 4
      });
      expect(await database.client.conversationWorldBookActivationState.count()).toBe(0);
    } finally {
      await database.close();
    }
  });
});
