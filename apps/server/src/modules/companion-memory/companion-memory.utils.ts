export type MessagePosition = {
  id: string;
  createdAt: Date;
};

export type MemorySummary = {
  relationshipState: string;
  currentArc: string;
};

export function getMemoryUpdateMode(
  isEnabled: boolean,
  isPaused: boolean,
  status: string
): 'none' | 'rebuild' | 'incremental' {
  if (!isEnabled || isPaused) return 'none';
  return status === 'stale' ? 'rebuild' : 'incremental';
}

export function compareMessagePosition(left: MessagePosition, right: MessagePosition): number {
  const timeDifference = left.createdAt.getTime() - right.createdAt.getTime();

  if (timeDifference !== 0) return timeDifference;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function shouldInvalidateMemory(
  status: string,
  changed: MessagePosition,
  cursor: MessagePosition | null,
  historyFloor: MessagePosition | null
): boolean {
  if (historyFloor && compareMessagePosition(changed, historyFloor) <= 0) return false;
  if (status === 'pending' || status === 'updating' || status === 'stale') return true;
  return Boolean(cursor && compareMessagePosition(changed, cursor) <= 0);
}

export function selectMessagesAfterPosition<T extends MessagePosition>(
  messages: T[],
  cursor: MessagePosition | null
): T[] {
  return cursor
    ? messages.filter((message) => compareMessagePosition(message, cursor) > 0)
    : messages;
}

export function selectLatestSafeRevision<T extends { lastSummarizedMessageId: string | null }>(
  revisions: T[],
  cursors: Map<string, MessagePosition>,
  changed: MessagePosition,
  historyFloor: MessagePosition | null
): T | null {
  return (
    revisions.find((revision) => {
      const cursor = revision.lastSummarizedMessageId
        ? cursors.get(revision.lastSummarizedMessageId)
        : null;
      return Boolean(
        cursor &&
        compareMessagePosition(cursor, changed) < 0 &&
        (!historyFloor || compareMessagePosition(cursor, historyFloor) >= 0)
      );
    }) ?? null
  );
}

export function parseMemorySummary(text: string, previous: MemorySummary): MemorySummary {
  const json = extractFirstJsonObject(text);
  const value = JSON.parse(json) as Record<string, unknown>;

  if (typeof value.relationshipState !== 'string' || typeof value.currentArc !== 'string') {
    throw new Error('MEMORY_SUMMARY_INVALID');
  }

  const relationshipState = value.relationshipState.trim();
  const currentArc = value.currentArc.trim();

  return {
    relationshipState: relationshipState || previous.relationshipState,
    currentArc: currentArc || previous.currentArc
  };
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('MEMORY_SUMMARY_INVALID');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  throw new Error('MEMORY_SUMMARY_INVALID');
}
