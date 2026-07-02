import type {
  ChatMessageLike,
  WorldBookContext,
  WorldBookMatchedEntry,
  WorldBookMatchResult,
  WorldBookSkippedEntry
} from './types';

type MatchCandidate = WorldBookMatchedEntry & {
  originalIndex: number;
};

export function matchWorldBookEntries(input: {
  worldBooks?: WorldBookContext[];
  history: ChatMessageLike[];
  currentUserMessage: ChatMessageLike;
  estimateTokens: (content: string) => number;
}): WorldBookMatchResult {
  const worldBooks = input.worldBooks ?? [];
  const enabledWorldBooks = worldBooks.filter((worldBook) => worldBook.isEnabled);
  const scanDepth = enabledWorldBooks.reduce(
    (maxDepth, worldBook) => Math.max(maxDepth, normalizeCount(worldBook.scanDepth)),
    0
  );
  const scannedMessages = selectScannedMessages({
    history: input.history,
    currentUserMessage: input.currentUserMessage,
    scanDepth
  });
  const scannedMessageIds = unique(scannedMessages.map((message) => message.id));
  const skippedEntries: WorldBookSkippedEntry[] = [];
  const candidates: MatchCandidate[] = [];
  let originalIndex = 0;

  for (const worldBook of worldBooks) {
    const bookScanDepth = normalizeCount(worldBook.scanDepth);
    const bookMessages = worldBook.isEnabled
      ? selectScannedMessages({
          history: input.history,
          currentUserMessage: input.currentUserMessage,
          scanDepth: bookScanDepth
        })
      : [];

    for (const entry of worldBook.entries) {
      originalIndex += 1;

      if (!worldBook.isEnabled || !entry.isEnabled) {
        skippedEntries.push(toSkippedEntry(worldBook, entry, 'disabled', input.estimateTokens));
        continue;
      }

      const tokenEstimate = input.estimateTokens(entry.content);
      const entryBudget = entry.tokenBudget ?? null;

      if (entryBudget !== null && entryBudget >= 0 && tokenEstimate > entryBudget) {
        skippedEntries.push({
          ...toSkippedEntry(worldBook, entry, 'token_budget_exceeded', input.estimateTokens),
          tokenEstimate
        });
        continue;
      }

      const matchedKeywords = matchKeywords(entry.keywords, bookMessages);

      if (matchedKeywords.length === 0) {
        skippedEntries.push({
          ...toSkippedEntry(worldBook, entry, 'no_keyword_match', input.estimateTokens),
          tokenEstimate
        });
        continue;
      }

      const matchedSecondaryKeywords = matchKeywords(entry.secondaryKeywords ?? [], bookMessages);

      if ((entry.secondaryKeywords?.length ?? 0) > 0 && matchedSecondaryKeywords.length === 0) {
        skippedEntries.push({
          ...toSkippedEntry(worldBook, entry, 'secondary_keyword_miss', input.estimateTokens),
          tokenEstimate
        });
        continue;
      }

      candidates.push({
        worldBookId: worldBook.id,
        worldBookName: worldBook.name,
        entryId: entry.id,
        title: entry.title,
        content: entry.content,
        keywords: entry.keywords,
        matchedKeywords,
        secondaryKeywords: entry.secondaryKeywords,
        matchedSecondaryKeywords,
        priority: entry.priority,
        position: entry.position,
        insertionOrder: entry.position,
        tokenBudget: entry.tokenBudget ?? null,
        tokenEstimate,
        sourceMessageIds: findSourceMessageIds(
          [...matchedKeywords, ...matchedSecondaryKeywords],
          bookMessages
        ),
        metadata: entry.metadata ?? null,
        originalIndex
      });
    }
  }

  const usedByWorldBook = new Map<string, number>();
  const matchedEntries: WorldBookMatchedEntry[] = [];
  const sortedCandidates = candidates.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.originalIndex - right.originalIndex;
  });

  for (const candidate of sortedCandidates) {
    const worldBook = enabledWorldBooks.find((item) => item.id === candidate.worldBookId);
    const bookBudget = normalizeCount(worldBook?.tokenBudget ?? 0);
    const used = usedByWorldBook.get(candidate.worldBookId) ?? 0;
    const tokenEstimate = candidate.tokenEstimate ?? 0;

    if (bookBudget > 0 && used + tokenEstimate > bookBudget) {
      skippedEntries.push({
        worldBookId: candidate.worldBookId,
        entryId: candidate.entryId,
        title: candidate.title,
        reason: 'token_budget_exceeded',
        tokenEstimate
      });
      continue;
    }

    usedByWorldBook.set(candidate.worldBookId, used + tokenEstimate);
    matchedEntries.push(stripCandidateState(candidate));
  }

  return {
    scannedMessageIds,
    scanDepth,
    tokenBudget: enabledWorldBooks.reduce(
      (total, worldBook) => total + normalizeCount(worldBook.tokenBudget),
      0
    ),
    usedTokenEstimate: matchedEntries.reduce(
      (total, entry) => total + (entry.tokenEstimate ?? 0),
      0
    ),
    matchedEntries,
    skippedEntries
  };
}

function selectScannedMessages(input: {
  history: ChatMessageLike[];
  currentUserMessage: ChatMessageLike;
  scanDepth: number;
}): ChatMessageLike[] {
  const scanDepth = Math.max(0, input.scanDepth);
  const historyWithoutCurrent = input.history.filter(
    (message) => message.id !== input.currentUserMessage.id
  );
  const recentHistory = scanDepth === 0 ? [] : historyWithoutCurrent.slice(-scanDepth);

  return [...recentHistory, input.currentUserMessage].filter((message) =>
    hasContent(message.content)
  );
}

function matchKeywords(keywords: string[], messages: ChatMessageLike[]): string[] {
  const normalizedMessages = messages.map((message) => message.content.toLocaleLowerCase());

  return unique(
    keywords
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0)
      .filter((keyword) => {
        const normalizedKeyword = keyword.toLocaleLowerCase();

        return normalizedMessages.some((message) => message.includes(normalizedKeyword));
      })
  );
}

function findSourceMessageIds(keywords: string[], messages: ChatMessageLike[]): string[] {
  const normalizedKeywords = keywords
    .map((keyword) => keyword.trim().toLocaleLowerCase())
    .filter((keyword) => keyword.length > 0);

  if (normalizedKeywords.length === 0) {
    return [];
  }

  return messages
    .filter((message) => {
      const normalizedContent = message.content.toLocaleLowerCase();

      return normalizedKeywords.some((keyword) => normalizedContent.includes(keyword));
    })
    .map((message) => message.id);
}

function toSkippedEntry(
  worldBook: WorldBookContext,
  entry: WorldBookContext['entries'][number],
  reason: WorldBookSkippedEntry['reason'],
  estimateTokens: (content: string) => number
): WorldBookSkippedEntry {
  return {
    worldBookId: worldBook.id,
    entryId: entry.id,
    title: entry.title,
    reason,
    tokenEstimate: estimateTokens(entry.content)
  };
}

function stripCandidateState(candidate: MatchCandidate): WorldBookMatchedEntry {
  const { originalIndex, ...entry } = candidate;

  return entry;
}

function normalizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function hasContent(value: string): boolean {
  return value.trim().length > 0;
}
