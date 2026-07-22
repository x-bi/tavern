import { describe, expect, it } from 'vitest';
import {
  advanceWorldBookActivationState,
  matchWorldBookEntriesV2,
  normalizeWorldBookPhrase
} from '../../src/services/context-engine/world-book-matcher-v2';

const config = {
  activationMode: 'keyword' as const,
  matchMode: 'normalized_phrase' as const,
  primaryKeywords: ['上海 外滩'],
  primaryLogic: 'any' as const,
  secondaryKeywords: ['夜景'],
  secondaryLogic: 'and_any' as const,
  excludeKeywords: [],
  sameMessageOnly: true,
  scanSources: ['current_user', 'user_history', 'assistant_latest'] as const,
  userHistoryScanDepth: 6,
  stickyTurns: 2,
  continuationTurns: 1,
  cooldownTurns: 1,
  delayTurns: 0,
  cooldownPolicy: 'strict' as const,
  generationPurposes: ['chat_reply'] as const,
  budgetPriority: 10,
  sortOrder: 0
};

describe('world book matcher v2', () => {
  it('normalizes width, punctuation and whitespace without joining messages', () => {
    expect(normalizeWorldBookPhrase('ＳＨＡＮＧＨＡＩ，  外滩')).toBe('shanghai 外滩');
    expect(
      matchWorldBookEntriesV2({
        entries: [{ entryId: 'e1', revisionId: 'r1', config: { ...config } }],
        purpose: 'chat_reply',
        messages: [
          { id: 'm1', source: 'user_history', content: '上海 外滩', rootUserMessageId: 'u1' },
          { id: 'm2', source: 'user_history', content: '夜景', rootUserMessageId: 'u1' }
        ]
      })
    ).toHaveLength(0);
  });

  it('allows explicit cross-message keyword aggregation without concatenating content', () => {
    const matches = matchWorldBookEntriesV2({
      entries: [
        {
          entryId: 'e1',
          revisionId: 'r1',
          config: { ...config, sameMessageOnly: false }
        }
      ],
      purpose: 'chat_reply',
      messages: [
        { id: 'm1', source: 'user_history', content: '上海 外滩', rootUserMessageId: 'u1' },
        { id: 'm2', source: 'user_history', content: '夜景', rootUserMessageId: 'u1' }
      ]
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchedSecondary).toEqual(['夜景']);
  });

  it('keeps contains mode exact while normalized phrase mode canonicalizes text', () => {
    const message = {
      id: 'm1',
      source: 'current_user' as const,
      content: '上海，外滩 夜景',
      rootUserMessageId: 'm1'
    };
    const exact = matchWorldBookEntriesV2({
      entries: [
        {
          entryId: 'exact',
          revisionId: 'r1',
          config: { ...config, matchMode: 'contains', primaryKeywords: ['上海 外滩'] }
        }
      ],
      purpose: 'chat_reply',
      messages: [message]
    });
    const normalized = matchWorldBookEntriesV2({
      entries: [{ entryId: 'normalized', revisionId: 'r2', config: { ...config } }],
      purpose: 'chat_reply',
      messages: [message]
    });
    expect(exact).toHaveLength(0);
    expect(normalized).toHaveLength(1);
  });

  it('blocks assistant cycles/depth and caps bridge fan-out', () => {
    const entries = [0, 1, 2, 3].map((index) => ({
      entryId: `e${index}`,
      revisionId: `r${index}`,
      config: { ...config },
      assistantInfluenceEntryIds: index === 0 ? ['e0'] : [],
      assistantLineages: index === 1 ? [{ lineageEntryIds: ['other'], bridgeDepth: 2 }] : []
    }));
    const matches = matchWorldBookEntriesV2({
      entries,
      purpose: 'chat_reply',
      messages: [
        { id: 'a', source: 'assistant_latest', content: '上海 外滩的夜景', rootUserMessageId: 'u' }
      ]
    });
    expect(matches).toHaveLength(2);
    expect(matches.every((item) => item.activationSource === 'assistant_bridge')).toBe(true);
  });

  it('keeps independent assistant lineages separate instead of union-poisoning them', () => {
    const matches = matchWorldBookEntriesV2({
      entries: [
        {
          entryId: 'candidate',
          revisionId: 'revision',
          config: { ...config },
          assistantInfluenceEntryIds: ['trace-a', 'trace-b'],
          assistantLineages: [
            { lineageEntryIds: ['candidate', 'trace-a'], bridgeDepth: 1 },
            { lineageEntryIds: ['trace-b'], bridgeDepth: 0 }
          ]
        }
      ],
      purpose: 'chat_reply',
      messages: [
        {
          id: 'assistant',
          source: 'assistant_latest',
          content: '上海 外滩夜景',
          rootUserMessageId: 'user'
        }
      ]
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.lineageEntryIds).toEqual(['trace-b', 'candidate']);
  });

  it('counts sticky, continuation and cooldown from completed ordinals', () => {
    const state = advanceWorldBookActivationState(null, config, 'current_user', 5);
    expect(state.stickyUntilCompletedTurn).toBe(7);
    expect(state.continuationUntilCompletedTurn).toBe(6);
    expect(state.cooldownUntilCompletedTurn).toBe(8);
    expect(advanceWorldBookActivationState(state, config, 'user_history_window', 6)).toEqual(state);
  });
});
