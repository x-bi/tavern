import { describe, expect, it } from 'vitest';
import { PromptsService } from '../../src/modules/prompts/prompts.service';

describe('Tavern prompt preview Context Engine V2 source', () => {
  it('returns unified worldBookDebug (decisions + inserted sections) and drops legacy fields', async () => {
    const conversation = {
      id: 'conversation',
      userId: 'user',
      characterId: 'character',
      title: 'Thread',
      metadataJson: null,
      modelFallbackGroupId: null,
      personaId: null,
      promptPreset: null,
      persona: null,
      character: {
        id: 'character',
        name: 'Role',
        coreIdentity: 'Core',
        personality: '',
        persistentPremise: '',
        initialScenario: '',
        extendedBackground: '',
        characterRules: '',
        speechStyle: '',
        firstMessage: '',
        exampleMessagesJson: null,
        metadataJson: null
      }
    };
    const worldBookSection = {
      id: 'world-book:entry:revision',
      kind: 'world_book' as const,
      sourceType: 'world_book_entry_revision',
      sourceId: 'entry',
      sourceRevisionId: 'revision',
      content: 'Lore',
      placement: 'before_current_user' as const,
      importance: 'optional' as const,
      budgetPriority: 10,
      sortOrder: 20,
      truncationPolicy: 'drop' as const,
      generationPurposes: ['chat_reply' as const],
      contentType: 'lore' as const,
      trustLevel: 'user_authored' as const
    };
    // 与 WorldBookRuntimeService 扩展后的 RuntimeDecision 形状一致（含真实标题/placement 等）。
    const decision = {
      entryId: 'entry',
      revisionId: 'revision',
      worldBookId: 'book',
      title: '外滩',
      included: true,
      activationSource: 'keyword',
      reason: null,
      sourceMessageId: 'preview-current-user-input',
      placement: 'before_current_user',
      contentType: 'lore',
      trustLevel: 'user_authored',
      budgetPriority: 10,
      sortOrder: 20
    };
    const service = new PromptsService(
      {
        conversation: { findFirst: async () => conversation },
        message: { findMany: async () => [] }
      } as never,
      { listPromptContexts: async () => [] } as never,
      { getGatewayCandidates: async () => [] } as never,
      { shouldShowSensitiveContent: async () => true } as never,
      {
        evaluateConversation: async () => ({
          sections: [worldBookSection],
          decisions: [decision],
          scannedMessageIds: ['preview-current-user-input'],
          scanDepth: 6
        })
      } as never,
      { listPromptMessages: async () => [] } as never,
      { validate: () => [] } as never
    );

    const preview = await service.preview(
      { id: 'user', username: 'user', displayName: 'User', role: 'admin' },
      { conversationId: 'conversation', userInput: 'trigger' }
    );

    // 旧字段彻底消失。
    expect((preview as Record<string, unknown>).worldBook).toBeUndefined();
    expect((preview.debug as Record<string, unknown>).worldBookDecisions).toBeUndefined();
    expect((preview.debug as Record<string, unknown>).matchedEntries).toBeUndefined();

    // 统一调试字段存在。
    expect(preview.worldBookDebug).toBeDefined();
    const debug = preview.worldBookDebug;

    // 一致性约束。
    expect(debug.candidateCount).toBe(debug.decisions.length);
    expect(debug.matchedCount).toBe(debug.decisions.filter((item) => item.included).length);
    expect(debug.skippedCount).toBe(debug.decisions.filter((item) => !item.included).length);
    expect(debug.candidateCount).toBe(1);
    expect(debug.matchedCount).toBe(1);
    expect(debug.skippedCount).toBe(0);
    expect(debug.scanDepth).toBe(6);
    expect(debug.scannedMessageIds).toEqual(['preview-current-user-input']);

    // 真实条目标题（不是 world_book_entry_revision）。
    const entry = debug.decisions[0];
    expect(entry.title).toBe('外滩');
    expect(entry.title).not.toBe('world_book_entry_revision');
    expect(entry.entryId).toBe('entry');
    expect(entry.revisionId).toBe('revision');
    expect(entry.worldBookId).toBe('book');
    expect(entry.included).toBe(true);
    expect(entry.activationSource).toBe('keyword');
    expect(entry.sourceMessageId).toBe('preview-current-user-input');
    expect(entry.placement).toBe('before_current_user');
    expect(entry.contentType).toBe('lore');
    expect(entry.trustLevel).toBe('user_authored');
    expect(entry.budgetPriority).toBe(10);
    expect(entry.sortOrder).toBe(20);
    // token 估算来自 compiledSections（命中条目为 number）。
    const compiledWorldBook = preview.compiledSections.find(
      (item) => item.section.kind === 'world_book'
    );
    expect(compiledWorldBook).toBeDefined();
    expect(entry.tokenEstimate).toBe(compiledWorldBook!.tokenEstimate);

    // insertedSections 使用最终 section 的 placement 与真实标题。
    expect(debug.insertedSections).toHaveLength(1);
    const inserted = debug.insertedSections[0];
    expect(inserted.sectionId).toBe(worldBookSection.id);
    expect(inserted.title).toBe('外滩');
    expect(inserted.placement).toBe('before_current_user');
    expect(inserted.entryId).toBe('entry');
    expect(inserted.revisionId).toBe('revision');
    expect(inserted.tokenEstimate).toBe(compiledWorldBook!.tokenEstimate);

    // 修改前后 compiledSections / finalMessages 不变（仍来自同一次编译）。
    expect(
      preview.compiledSections.find((item) => item.section.kind === 'world_book')?.section
    ).toMatchObject({ sourceId: 'entry', sourceRevisionId: 'revision' });
    // V1 sections/logicalMessages 字段已移除，响应只保留 V2 compiledSections。
    expect((preview as Record<string, unknown>).sections).toBeUndefined();
    expect((preview as Record<string, unknown>).logicalMessages).toBeUndefined();
    expect(preview.finalMessages.length).toBeGreaterThan(0);
  });
});
