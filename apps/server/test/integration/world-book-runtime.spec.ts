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
              makeEntry({
                id: 'entry',
                worldBookId: 'book',
                title: '外滩',
                content: '外滩夜景很美。',
                keywords: ['上海外滩'],
                secondaryKeywords: ['夜景'],
                budgetPriority: 9,
                sortOrder: 0,
                config: {
                  activationMode: 'keyword',
                  scanSources: ['current_user'],
                  primaryKeywords: ['上海外滩'],
                  secondaryKeywords: ['夜景'],
                  userHistoryScanDepth: 6,
                  stickyTurns: 2,
                  continuationTurns: 1,
                  cooldownTurns: 1
                }
              })
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

      // 扩展后的 RuntimeDecision 携带真实标题/placement 等（含命中条目）。
      expect(result.decisions[0]).toMatchObject({
        entryId: 'entry',
        revisionId: 'revision',
        worldBookId: 'book',
        title: '外滩',
        included: true,
        activationSource: 'current_user',
        reason: null,
        sourceMessageId: 'current',
        placement: 'before_history',
        contentType: 'lore',
        trustLevel: 'user_authored',
        budgetPriority: 9,
        sortOrder: 0
      });
      // 顶层扫描信息。
      expect(result.scanDepth).toBe(6);
      expect(result.scannedMessageIds).toEqual(['current']);
    } finally {
      await database.close();
    }
  });

  it('activates constant entries with activationSource=constant and null sourceMessageId', async () => {
    const database = await TestDatabase.create();
    try {
      const runtime = new WorldBookRuntimeService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'const', displayName: 'Owner' }
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
          content: '你好'
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
              makeEntry({
                id: 'const-entry',
                worldBookId: 'book',
                title: '常驻设定',
                content: '世界观基础设定。',
                keywords: [],
                secondaryKeywords: [],
                budgetPriority: 5,
                sortOrder: 1,
                config: {
                  activationMode: 'constant',
                  scanSources: ['current_user'],
                  primaryKeywords: [],
                  secondaryKeywords: [],
                  userHistoryScanDepth: 6,
                  stickyTurns: 0,
                  continuationTurns: 0,
                  cooldownTurns: 0
                }
              })
            ]
          }
        ]
      });
      expect(result.sections).toHaveLength(1);
      expect(result.decisions[0]).toMatchObject({
        entryId: 'const-entry',
        worldBookId: 'book',
        title: '常驻设定',
        included: true,
        activationSource: 'constant',
        sourceMessageId: null,
        placement: 'before_history',
        contentType: 'lore',
        budgetPriority: 5,
        sortOrder: 1
      });
      expect(result.scannedMessageIds).toEqual(['current']);
    } finally {
      await database.close();
    }
  });

  it('activates user_history_window hits across messages with the history message id', async () => {
    const database = await TestDatabase.create();
    try {
      const runtime = new WorldBookRuntimeService(database.client as unknown as PrismaService);
      const user = await database.client.user.create({
        data: { username: 'hist', displayName: 'Owner' }
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
          content: '继续聊聊'
        },
        history: [
          {
            id: 'hist1',
            conversationId: conversation.id,
            role: 'user',
            content: '去上海外滩看夜景'
          }
        ],
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
              makeEntry({
                id: 'hist-entry',
                worldBookId: 'book',
                title: '外滩历史',
                content: '外滩历史背景。',
                keywords: ['上海外滩'],
                secondaryKeywords: [],
                budgetPriority: 7,
                sortOrder: 2,
                config: {
                  activationMode: 'keyword',
                  matchMode: 'normalized_phrase',
                  scanSources: ['user_history'],
                  sameMessageOnly: false,
                  primaryKeywords: ['上海外滩'],
                  primaryLogic: 'any',
                  secondaryKeywords: [],
                  secondaryLogic: 'and_any',
                  excludeKeywords: [],
                  userHistoryScanDepth: 6,
                  stickyTurns: 0,
                  continuationTurns: 0,
                  cooldownTurns: 0
                }
              })
            ]
          }
        ]
      });
      expect(result.sections).toHaveLength(1);
      expect(result.decisions[0]).toMatchObject({
        entryId: 'hist-entry',
        worldBookId: 'book',
        title: '外滩历史',
        included: true,
        activationSource: 'user_history_window',
        sourceMessageId: 'hist1',
        placement: 'before_history'
      });
      // 喂给匹配器的消息包含 current 与历史用户消息。
      expect(result.scannedMessageIds).toEqual(['current', 'hist1']);
      expect(result.scanDepth).toBe(6);
    } finally {
      await database.close();
    }
  });
});

/** 构造一个 WorldBookEntryContext，config 字段合并默认值。 */
function makeEntry(entry: {
  id: string;
  worldBookId: string;
  title: string;
  content: string;
  keywords: string[];
  secondaryKeywords: string[];
  budgetPriority: number;
  sortOrder: number;
  config: Partial<Record<string, unknown>>;
}) {
  return {
    id: entry.id,
    activeRevisionId: 'revision',
    worldBookId: entry.worldBookId,
    title: entry.title,
    content: entry.content,
    keywords: entry.keywords,
    secondaryKeywords: entry.secondaryKeywords,
    isEnabled: true,
    budgetPriority: entry.budgetPriority,
    sortOrder: entry.sortOrder,
    position: 'before_history' as const,
    tokenBudget: null,
    config: {
      title: entry.title,
      contentType: 'lore',
      trustLevel: 'user_authored',
      matchMode: 'normalized_phrase',
      primaryLogic: 'any',
      secondaryLogic: 'and_any',
      excludeKeywords: [],
      sameMessageOnly: true,
      generationPurposes: ['chat_reply'],
      delayTurns: 0,
      cooldownPolicy: 'strict',
      placement: 'before_history',
      budgetPriority: entry.budgetPriority,
      sortOrder: entry.sortOrder,
      ...entry.config
    }
  };
}
