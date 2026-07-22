import { describe, expect, it } from 'vitest';
import { resolveTimelineTurns, type TimelineTurn } from './timeline';

describe('resolveTimelineTurns', () => {
  it('uses only the active assistant and excludes failed, stopped and replaced versions', () => {
    const turns: TimelineTurn[] = [
      {
        id: 'turn-1',
        sequence: 1,
        completedOrdinal: 1,
        status: 'complete',
        userMessageId: 'user-1',
        activeAssistantMessageId: 'assistant-active',
        messages: [
          message('user-1', 'turn-1', 'user', '你好', 'edited'),
          message('assistant-failed', 'turn-1', 'assistant', '失败', 'failed'),
          message('assistant-stopped', 'turn-1', 'assistant', '停止', 'stopped'),
          message('assistant-replaced', 'turn-1', 'assistant', '旧版', 'replaced'),
          message('assistant-active', 'turn-1', 'assistant', '新版', 'complete')
        ]
      }
    ];

    const result = resolveTimelineTurns(turns);
    expect(result).toHaveLength(1);
    expect(result[0]?.user.source).toBe('edited_user');
    expect(result[0]?.activeAssistant?.id).toBe('assistant-active');
    expect(result[0]?.advancesDynamicState).toBe(true);
  });

  it('keeps an incomplete user for audit but excludes it from prompt by policy', () => {
    const turn: TimelineTurn = {
      id: 'turn-2',
      sequence: 2,
      completedOrdinal: null,
      status: 'failed',
      userMessageId: 'user-2',
      activeAssistantMessageId: null,
      messages: [message('user-2', 'turn-2', 'user', '仍是用户事实', 'complete')]
    };
    expect(resolveTimelineTurns([turn])[0]?.includedInPrompt).toBe(false);
    expect(
      resolveTimelineTurns([turn], { includeIncompleteUserMessages: true })[0]?.includedInPrompt
    ).toBe(true);
  });
});

function message(
  id: string,
  turnId: string,
  role: 'user' | 'assistant',
  content: string,
  status: string
) {
  return { id, turnId, role, content, status, createdAt: '2026-07-22T00:00:00.000Z' };
}
