import { describe, expect, it } from 'vitest';
import { PromptsService } from '../../src/modules/prompts/prompts.service';

describe('Tavern prompt preview Context Engine V2 source', () => {
  it('returns WorldBook decisions and compiled sections from the same runtime evaluation', async () => {
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
        description: '',
        personality: '',
        persistentPremise: '',
        initialScenario: '',
        extendedBackground: '',
        characterRules: '',
        speechStyle: '',
        scenario: '',
        firstMessage: '',
        exampleMessagesJson: null,
        metadataJson: null
      }
    };
    const worldBookSection = {
      id: 'world-book:entry:revision',
      kind: 'world_book' as const,
      sourceType: 'world_book_entry',
      sourceId: 'entry',
      sourceRevisionId: 'revision',
      content: 'Lore',
      placement: 'before_history' as const,
      importance: 'optional' as const,
      budgetPriority: 10,
      sortOrder: 20,
      truncationPolicy: 'drop' as const,
      generationPurposes: ['chat_reply' as const],
      contentType: 'lore' as const,
      trustLevel: 'user_authored' as const
    };
    const decision = {
      entryId: 'entry',
      revisionId: 'revision',
      included: true,
      activationSource: 'keyword',
      reason: 'matched',
      sourceMessageId: 'preview-current-user-input'
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
        evaluateConversation: async () => ({ sections: [worldBookSection], decisions: [decision] })
      } as never,
      { listPromptMessages: async () => [] } as never,
      { validate: () => [] } as never
    );

    const preview = await service.preview(
      { id: 'user', username: 'user', displayName: 'User', role: 'admin' },
      { conversationId: 'conversation', userInput: 'trigger' }
    );

    expect(preview.debug.worldBookDecisions).toEqual([decision]);
    expect(
      preview.compiledSections.find((item) => item.section.kind === 'world_book')?.section
    ).toMatchObject({ sourceId: 'entry', sourceRevisionId: 'revision' });
    expect(preview.sections).toEqual([]);
  });
});
