import type {
  ChatMessageLike,
  WorldBookContext,
  WorldBookMatchedEntry,
  WorldBookMatchResult,
  WorldBookSkippedEntry
} from './types';

/** 匹配候选条目（命中后待排序、预算筛选的中间形态，含原始序号用于稳定排序）。 */
type MatchCandidate = WorldBookMatchedEntry & {
  originalIndex: number;
};

/**
 * 世界书条目匹配：扫描最近消息，按关键词命中筛选要插入的条目。
 *
 * 算法流程：
 * 1. 取启用世界书，算出最大扫描深度 scanDepth；
 * 2. 选出要扫描的用户消息（最近 scanDepth 条用户历史 + 当前用户输入）；
 * 3. 遍历所有条目，逐条判定：
 *    - 禁用（世界书或条目未启用）→ skipped(disabled)；
 *    - 条目自身 token 超条目预算 → skipped(token_budget_exceeded)；
 *    - 关键词无命中 → skipped(no_keyword_match)；
 *    - 有次要关键词但未命中 → skipped(secondary_keyword_miss)；
 *    - 否则 → 加入候选。
 * 4. 候选按优先级降序、原始序号升序排序；
 * 5. 逐个套用世界书 token 预算，超预算的转 skipped，其余纳入 matched。
 *
 * @param input 输入参数（世界书、历史、当前消息、token 估算函数）。
 * @returns 匹配结果（matched + skipped + 扫描信息）。
 */
export function matchWorldBookEntries(input: {
  worldBooks?: WorldBookContext[];
  history: ChatMessageLike[];
  currentUserMessage: ChatMessageLike;
  estimateTokens: (content: string) => number;
}): WorldBookMatchResult {
  const worldBooks = input.worldBooks ?? [];
  // 只取启用的世界书参与扫描深度计算
  const enabledWorldBooks = worldBooks.filter((worldBook) => worldBook.isEnabled);
  // 扫描深度 = 所有启用世界书中最大的 scanDepth（保证都能扫到足够消息）
  const scanDepth = enabledWorldBooks.reduce(
    (maxDepth, worldBook) => Math.max(maxDepth, normalizeCount(worldBook.scanDepth)),
    0
  );
  // 选出全局要扫描的消息（用于记录 scannedMessageIds）
  const scannedMessages = selectScannedMessages({
    history: input.history,
    currentUserMessage: input.currentUserMessage,
    scanDepth
  });
  const scannedMessageIds = unique(scannedMessages.map((message) => message.id));
  const skippedEntries: WorldBookSkippedEntry[] = [];
  const candidates: MatchCandidate[] = [];
  // 原始序号：遍历所有条目的全局计数，用于稳定排序
  let originalIndex = 0;

  for (const worldBook of worldBooks) {
    const bookScanDepth = normalizeCount(worldBook.scanDepth);
    // 每本世界书按自己的扫描深度取消息（禁用的世界书取空，跳过其条目）
    const bookMessages = worldBook.isEnabled
      ? selectScannedMessages({
          history: input.history,
          currentUserMessage: input.currentUserMessage,
          scanDepth: bookScanDepth
        })
      : [];

    for (const entry of worldBook.entries) {
      originalIndex += 1;

      // 判定1：世界书或条目未启用 → disabled
      if (!worldBook.isEnabled || !entry.isEnabled) {
        skippedEntries.push(toSkippedEntry(worldBook, entry, 'disabled', input.estimateTokens));
        continue;
      }

      const tokenEstimate = input.estimateTokens(entry.content);
      // 条目独立 token 预算（entry.tokenBudget）超限 → 跳过
      const entryBudget = entry.tokenBudget ?? null;

      if (entryBudget !== null && entryBudget >= 0 && tokenEstimate > entryBudget) {
        skippedEntries.push({
          ...toSkippedEntry(worldBook, entry, 'token_budget_exceeded', input.estimateTokens),
          tokenEstimate
        });
        continue;
      }

      // 判定2：主关键词命中
      const matchedKeywords = matchKeywords(entry.keywords, bookMessages, entry.caseSensitive);

      if (matchedKeywords.length === 0) {
        skippedEntries.push({
          ...toSkippedEntry(worldBook, entry, 'no_keyword_match', input.estimateTokens),
          tokenEstimate
        });
        continue;
      }

      // 判定3：次要关键词（有配置时必须至少命中一个）
      const matchedSecondaryKeywords = matchKeywords(
        entry.secondaryKeywords ?? [],
        bookMessages,
        entry.caseSensitive
      );

      if ((entry.secondaryKeywords?.length ?? 0) > 0 && matchedSecondaryKeywords.length === 0) {
        skippedEntries.push({
          ...toSkippedEntry(worldBook, entry, 'secondary_keyword_miss', input.estimateTokens),
          tokenEstimate
        });
        continue;
      }

      // 全部通过 → 加入候选
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
        // 命中的来源消息 ID（用于追溯是哪条消息触发的）
        sourceMessageIds: findSourceMessageIds(
          [...matchedKeywords, ...matchedSecondaryKeywords],
          bookMessages,
          entry.caseSensitive
        ),
        metadata: entry.metadata ?? null,
        originalIndex
      });
    }
  }

  // 按世界书累计已用 token，用于世界书级预算筛选
  const usedByWorldBook = new Map<string, number>();
  const matchedEntries: WorldBookMatchedEntry[] = [];
  // 候选排序：优先级降序优先，同级按原始序号升序（稳定排序）
  const sortedCandidates = candidates.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.originalIndex - right.originalIndex;
  });

  // 逐个套用世界书 token 预算：超预算的转 skipped，否则纳入 matched
  for (const candidate of sortedCandidates) {
    const worldBook = enabledWorldBooks.find((item) => item.id === candidate.worldBookId);
    const bookBudget = normalizeCount(worldBook?.tokenBudget ?? 0);
    const used = usedByWorldBook.get(candidate.worldBookId) ?? 0;
    const tokenEstimate = candidate.tokenEstimate ?? 0;

    if (bookBudget > 0 && used + tokenEstimate > bookBudget) {
      // 世界书级预算超限 → 跳过
      skippedEntries.push({
        worldBookId: candidate.worldBookId,
        entryId: candidate.entryId,
        title: candidate.title,
        reason: 'token_budget_exceeded',
        tokenEstimate
      });
      continue;
    }

    // 累计已用 token，纳入 matched
    usedByWorldBook.set(candidate.worldBookId, used + tokenEstimate);
    matchedEntries.push(stripCandidateState(candidate));
  }

  return {
    scannedMessageIds,
    scanDepth,
    // 总 token 预算 = 所有启用世界书预算之和
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

/**
 * 选出要扫描的消息：最近 scanDepth 条用户历史（不含当前消息）+ 当前用户输入。
 *
 * 世界书关键词由用户输入触发，不能由 assistant 上轮回复反向触发。
 * 否则 assistant 每轮提到的角色名、设定名会在下一轮持续命中世界书，
 * 再把同一批条目塞回 system，形成上下文自激循环。
 * @param input 历史消息、当前消息、扫描深度。
 * @returns 待扫描的消息数组（按时间正序）。
 */
function selectScannedMessages(input: {
  history: ChatMessageLike[];
  currentUserMessage: ChatMessageLike;
  scanDepth: number;
}): ChatMessageLike[] {
  const scanDepth = Math.max(0, input.scanDepth);
  // 历史中排除当前消息（当前消息单独加入）
  const historyWithoutCurrent = input.history.filter(
    (message) => message.id !== input.currentUserMessage.id && message.role === 'user'
  );
  // scanDepth=0 表示只扫当前消息；否则取最近 scanDepth 条历史
  const recentHistory = scanDepth === 0 ? [] : historyWithoutCurrent.slice(-scanDepth);

  // 拼成 [历史..., 当前消息]，过滤掉空内容
  return [...recentHistory, input.currentUserMessage].filter((message) =>
    hasContent(message.content)
  );
}

/**
 * 关键词匹配：返回命中的关键词列表。
 *
 * 匹配规则：关键词 trim 后，在任一消息内容（都 toLowerCase）中包含即命中。
 * 结果去重。
 *
 * @param keywords 候选关键词。
 * @param messages 待扫描消息。
 * @returns 命中的关键词数组（去重）。
 */
function matchKeywords(
  keywords: string[],
  messages: ChatMessageLike[],
  caseSensitive: boolean
): string[] {
  const normalizedMessages = messages.map((message) =>
    caseSensitive ? message.content : message.content.toLocaleLowerCase()
  );

  return unique(
    keywords
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0)
      .filter((keyword) => {
        const normalizedKeyword = caseSensitive ? keyword : keyword.toLocaleLowerCase();

        return normalizedMessages.some((message) => message.includes(normalizedKeyword));
      })
  );
}

/**
 * 找出命中关键词的来源消息 ID。
 * @param keywords 命中的关键词。
 * @param messages 待扫描消息。
 * @returns 命中的消息 ID 数组。
 */
function findSourceMessageIds(
  keywords: string[],
  messages: ChatMessageLike[],
  caseSensitive: boolean
): string[] {
  const normalizedKeywords = keywords
    .map((keyword) => {
      const trimmed = keyword.trim();

      return caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
    })
    .filter((keyword) => keyword.length > 0);

  if (normalizedKeywords.length === 0) {
    return [];
  }

  return messages
    .filter((message) => {
      const normalizedContent = caseSensitive
        ? message.content
        : message.content.toLocaleLowerCase();

      return normalizedKeywords.some((keyword) => normalizedContent.includes(keyword));
    })
    .map((message) => message.id);
}

/**
 * 构造跳过条目（不含 tokenEstimate，由调用方按需补充）。
 * @param worldBook 所属世界书。
 * @param entry 条目。
 * @param reason 跳过原因。
 * @param estimateTokens token 估算函数。
 * @returns 跳过条目。
 */
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

/** 去掉候选条目的内部排序状态（originalIndex），转成最终匹配条目。 */
function stripCandidateState(candidate: MatchCandidate): WorldBookMatchedEntry {
  const entry = { ...candidate };
  Reflect.deleteProperty(entry, 'originalIndex');

  return entry;
}

/** 归一化计数：非有限数转 0，否则取不小于 0 的整数。 */
function normalizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** 字符串数组去重。 */
function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** 内容是否非空（trim 后有字符）。 */
function hasContent(value: string): boolean {
  return value.trim().length > 0;
}
