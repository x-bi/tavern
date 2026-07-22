import { describe, expect, it } from 'vitest';
import {
  CompanionTimelineService,
  resolveRows,
  selectTimelineMessages
} from '../../src/services/context-engine/timeline.service';

const message = (id: string, role: string, status = 'complete', content = id) => ({
  id,
  role,
  status,
  content,
  deletedAt: null as Date | null
});

describe('canonical timeline selection', () => {
  it('selects only the turn active pointer, independent of message update order', () => {
    const turns = [
      {
        id: 'turn-1',
        sequence: 1,
        completedOrdinal: 1,
        status: 'complete',
        userMessageId: 'user-1',
        activeAssistantMessageId: 'assistant-active',
        messages: [
          message('user-1', 'user'),
          message('assistant-newer-but-replaced', 'assistant', 'complete'),
          message('assistant-active', 'assistant', 'complete')
        ]
      }
    ];
    expect(selectTimelineMessages(turns).map((item) => item.id)).toEqual([
      'user-1',
      'assistant-active'
    ]);
    expect(resolveRows(turns, false)[0]?.advancesDynamicState).toBe(true);
  });

  it('allows edited assistant text in Prompt but never as memory evidence', () => {
    const turns = [
      {
        id: 'turn-1',
        sequence: 1,
        completedOrdinal: 1,
        status: 'complete',
        userMessageId: 'user-1',
        activeAssistantMessageId: 'assistant-edited',
        messages: [message('user-1', 'user'), message('assistant-edited', 'assistant', 'edited')]
      }
    ];
    expect(selectTimelineMessages(turns).map((item) => item.id)).toEqual([
      'user-1',
      'assistant-edited'
    ]);
    expect(
      selectTimelineMessages(turns, { allowImportedEditedAssistant: false }).map((item) => item.id)
    ).toEqual(['user-1']);
    expect(resolveRows(turns, false)[0]?.activeAssistant?.canBridge).toBe(false);
  });

  it('does not expose incomplete turns unless the caller explicitly requests them', () => {
    const turns = [
      {
        id: 'turn-1',
        sequence: 1,
        completedOrdinal: null,
        status: 'pending',
        userMessageId: 'user-1',
        activeAssistantMessageId: null,
        messages: [message('user-1', 'user')]
      }
    ];
    expect(selectTimelineMessages(turns)).toEqual([]);
    expect(
      selectTimelineMessages(turns, { includeIncompleteUserMessages: true }).map((item) => item.id)
    ).toEqual(['user-1']);
  });

  it('prevents an assistant generated from the active memory revision from self-proving it', async () => {
    const turns = [
      {
        id: 'turn-1',
        sequence: 1,
        completedOrdinal: 1,
        status: 'complete',
        userMessageId: 'user-1',
        activeAssistantMessageId: 'assistant-1',
        messages: [
          { ...message('user-1', 'user'), generationTrace: null },
          {
            ...message('assistant-1', 'assistant'),
            generationTrace: { memoryRevisionIdUsed: 'memory-active' }
          }
        ]
      }
    ];
    const timeline = new CompanionTimelineService({
      companionTurn: { findMany: async () => turns }
    } as never);
    expect(
      (await timeline.listMemoryEvidenceMessages('companion', 'memory-active')).map(
        (item) => item.id
      )
    ).toEqual(['user-1']);
  });
});
