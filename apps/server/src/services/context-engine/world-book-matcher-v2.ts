import type { GenerationPurpose } from './generation-lifecycle.types';

export type WorldBookScanSource = 'current_user' | 'user_history' | 'assistant_latest';
export type WorldBookActivationSource =
  | 'constant'
  | 'current_user'
  | 'user_history_window'
  | 'assistant_bridge'
  | 'sticky'
  | 'continuation'
  | 'manual';

export type WorldBookEntryConfigV2 = {
  activationMode: 'constant' | 'keyword' | 'manual';
  matchMode: 'contains' | 'normalized_phrase';
  primaryKeywords: string[];
  primaryLogic: 'any' | 'all';
  secondaryKeywords: string[];
  secondaryLogic: 'and_any' | 'and_all' | 'not_any' | 'not_all';
  excludeKeywords: string[];
  sameMessageOnly: boolean;
  scanSources: WorldBookScanSource[];
  userHistoryScanDepth: number;
  stickyTurns: number;
  continuationTurns: number;
  cooldownTurns: number;
  delayTurns: number;
  cooldownPolicy: 'strict' | 'current_user_override';
  generationPurposes: GenerationPurpose[];
  budgetPriority: number;
  sortOrder: number;
};

export type WorldBookCandidateV2 = {
  entryId: string;
  revisionId: string;
  config: WorldBookEntryConfigV2;
  assistantInfluenceEntryIds?: string[];
  assistantLineages?: Array<{ lineageEntryIds: string[]; bridgeDepth: number }>;
};

export type WorldBookEvidenceMessage = {
  id: string;
  source: WorldBookScanSource;
  content: string;
  rootUserMessageId: string;
};

export type WorldBookMatchEvidence = {
  entryId: string;
  revisionId: string;
  activationSource: WorldBookActivationSource;
  sourceMessageId: string | null;
  rootUserMessageId: string;
  matchedPrimary: string[];
  matchedSecondary: string[];
  lineageEntryIds: string[];
  bridgeDepth: number;
  specificity: number;
};

/** Unicode/case/width/whitespace/punctuation normalization used by phrase matching. */
export function normalizeWorldBookPhrase(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Matches each message independently and enforces the bounded assistant bridge. */
export function matchWorldBookEntriesV2(input: {
  entries: WorldBookCandidateV2[];
  messages: WorldBookEvidenceMessage[];
  purpose: GenerationPurpose;
  maxAssistantBridgeDepth?: number;
  maxAssistantTriggeredEntriesPerTurn?: number;
}): WorldBookMatchEvidence[] {
  const maxDepth = input.maxAssistantBridgeDepth ?? 2;
  const maxAssistant = input.maxAssistantTriggeredEntriesPerTurn ?? 3;
  const matches: WorldBookMatchEvidence[] = [];
  for (const entry of input.entries) {
    if (!entry.config.generationPurposes.includes(input.purpose)) continue;
    if (entry.config.activationMode === 'constant') {
      const root = input.messages.find(
        (message) => message.source === 'current_user'
      )?.rootUserMessageId;
      if (root) matches.push(toEvidence(entry, 'constant', null, root, [], []));
      continue;
    }
    if (entry.config.activationMode !== 'keyword') continue;
    const eligibleMessages = input.messages.filter((message) => {
      if (!entry.config.scanSources.includes(message.source)) return false;
      if (message.source === 'assistant_latest') {
        if (!resolveAssistantLineage(entry, maxDepth)) return false;
        if (
          entry.config.primaryKeywords.some(
            (keyword) => normalizeWorldBookPhrase(keyword).length < 2
          )
        )
          return false;
      }
      return true;
    });
    const crossMessage = entry.config.sameMessageOnly
      ? null
      : matchAcrossMessages(entry.config, eligibleMessages);
    const messagesToCheck = crossMessage ? [crossMessage.message] : eligibleMessages;
    for (const message of messagesToCheck) {
      const evidence = crossMessage?.evidence ?? matchMessage(entry.config, message.content);
      if (!evidence) continue;
      const source: WorldBookActivationSource =
        message.source === 'current_user'
          ? 'current_user'
          : message.source === 'user_history'
            ? 'user_history_window'
            : 'assistant_bridge';
      matches.push(
        toEvidence(
          entry,
          source,
          message.id,
          message.rootUserMessageId,
          evidence.primary,
          evidence.secondary,
          message.source === 'assistant_latest' ? resolveAssistantLineage(entry, maxDepth) : null
        )
      );
      break;
    }
  }
  const sourceRank: Record<WorldBookActivationSource, number> = {
    current_user: 7,
    manual: 6,
    sticky: 5,
    continuation: 4,
    user_history_window: 3,
    assistant_bridge: 2,
    constant: 1
  };
  const sorted = matches.sort(
    (a, b) =>
      sourceRank[b.activationSource] - sourceRank[a.activationSource] ||
      b.specificity - a.specificity ||
      (input.entries.find((entry) => entry.entryId === b.entryId)?.config.budgetPriority ?? 0) -
        (input.entries.find((entry) => entry.entryId === a.entryId)?.config.budgetPriority ?? 0) ||
      (input.entries.find((entry) => entry.entryId === a.entryId)?.config.sortOrder ?? 0) -
        (input.entries.find((entry) => entry.entryId === b.entryId)?.config.sortOrder ?? 0) ||
      a.entryId.localeCompare(b.entryId)
  );
  let assistantCount = 0;
  return sorted.filter((match) => {
    if (match.activationSource !== 'assistant_bridge') return true;
    assistantCount += 1;
    return assistantCount <= maxAssistant;
  });
}

function matchMessage(config: WorldBookEntryConfigV2, content: string) {
  const matchKeywords = (keywords: string[]) => matchKeywordsInContent(config, content, keywords);
  if (matchKeywords(config.excludeKeywords).length) return null;
  const primary = matchKeywords(config.primaryKeywords);
  const primaryOk =
    config.primaryLogic === 'all'
      ? primary.length === config.primaryKeywords.length && primary.length > 0
      : primary.length > 0;
  if (!primaryOk) return null;
  const secondary = matchKeywords(config.secondaryKeywords);
  const secondaryOk = secondaryMatches(config, secondary);
  return secondaryOk ? { primary, secondary } : null;
}

function matchAcrossMessages(
  config: WorldBookEntryConfigV2,
  messages: WorldBookEvidenceMessage[]
): {
  message: WorldBookEvidenceMessage;
  evidence: { primary: string[]; secondary: string[] };
} | null {
  if (
    messages.some(
      (message) =>
        matchKeywordsInContent(config, message.content, config.excludeKeywords).length > 0
    )
  ) {
    return null;
  }
  const primary = unique(
    messages.flatMap((message) =>
      matchKeywordsInContent(config, message.content, config.primaryKeywords)
    )
  );
  const primaryOk =
    config.primaryLogic === 'all'
      ? primary.length === config.primaryKeywords.length && primary.length > 0
      : primary.length > 0;
  if (!primaryOk) return null;
  const secondary = unique(
    messages.flatMap((message) =>
      matchKeywordsInContent(config, message.content, config.secondaryKeywords)
    )
  );
  if (!secondaryMatches(config, secondary)) return null;
  const representative = messages.find(
    (message) => matchKeywordsInContent(config, message.content, config.primaryKeywords).length > 0
  );
  return representative ? { message: representative, evidence: { primary, secondary } } : null;
}

function matchKeywordsInContent(
  config: WorldBookEntryConfigV2,
  content: string,
  keywords: string[]
): string[] {
  const haystack =
    config.matchMode === 'normalized_phrase' ? normalizeWorldBookPhrase(content) : content;
  return keywords.filter((keyword) => {
    const needle =
      config.matchMode === 'normalized_phrase' ? normalizeWorldBookPhrase(keyword) : keyword;
    return needle.length > 0 && haystack.includes(needle);
  });
}

function secondaryMatches(config: WorldBookEntryConfigV2, secondary: string[]): boolean {
  return (
    config.secondaryKeywords.length === 0 ||
    (config.secondaryLogic === 'and_any'
      ? secondary.length > 0
      : config.secondaryLogic === 'and_all'
        ? secondary.length === config.secondaryKeywords.length
        : config.secondaryLogic === 'not_any'
          ? secondary.length === 0
          : secondary.length < config.secondaryKeywords.length)
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function toEvidence(
  entry: WorldBookCandidateV2,
  activationSource: WorldBookActivationSource,
  sourceMessageId: string | null,
  rootUserMessageId: string,
  primary: string[],
  secondary: string[],
  assistantLineage: { lineageEntryIds: string[]; bridgeDepth: number } | null = null
): WorldBookMatchEvidence {
  const lineage =
    activationSource === 'assistant_bridge'
      ? [...(assistantLineage?.lineageEntryIds ?? []), entry.entryId]
      : [entry.entryId];
  return {
    entryId: entry.entryId,
    revisionId: entry.revisionId,
    activationSource,
    sourceMessageId,
    rootUserMessageId,
    matchedPrimary: primary,
    matchedSecondary: secondary,
    lineageEntryIds: lineage,
    bridgeDepth:
      activationSource === 'assistant_bridge' ? (assistantLineage?.bridgeDepth ?? 0) + 1 : 0,
    specificity: [...primary, ...secondary].reduce(
      (sum, keyword) => sum + normalizeWorldBookPhrase(keyword).length,
      0
    )
  };
}

function resolveAssistantLineage(
  entry: WorldBookCandidateV2,
  maxDepth: number
): { lineageEntryIds: string[]; bridgeDepth: number } | null {
  if (entry.assistantInfluenceEntryIds?.includes(entry.entryId)) return null;
  const lineages = entry.assistantLineages ?? [];
  if (!lineages.length) return { lineageEntryIds: [], bridgeDepth: 0 };
  const eligible = lineages
    .filter(
      (lineage) =>
        lineage.bridgeDepth + 1 <= maxDepth && !lineage.lineageEntryIds.includes(entry.entryId)
    )
    .sort(
      (left, right) =>
        left.bridgeDepth - right.bridgeDepth ||
        left.lineageEntryIds.join('\u0000').localeCompare(right.lineageEntryIds.join('\u0000'))
    );
  return eligible[0] ?? null;
}

export type WorldBookActivationStateV2 = {
  activatedAtCompletedTurn: number | null;
  stickyUntilCompletedTurn: number | null;
  continuationUntilCompletedTurn: number | null;
  cooldownUntilCompletedTurn: number | null;
  pendingUntilCompletedTurn: number | null;
  manualActive: boolean;
};

/** Pure completed-turn state transition; preview/failed/stopped callers must not invoke it. */
export function advanceWorldBookActivationState(
  previous: WorldBookActivationStateV2 | null,
  config: Pick<
    WorldBookEntryConfigV2,
    'stickyTurns' | 'continuationTurns' | 'cooldownTurns' | 'delayTurns'
  >,
  source: WorldBookActivationSource,
  completedOrdinal: number
): WorldBookActivationStateV2 {
  if (source === 'user_history_window') return previous ?? emptyState();
  if (source === 'manual') return { ...(previous ?? emptyState()), manualActive: true };
  const stickyUntil =
    source === 'current_user' && config.stickyTurns > 0
      ? completedOrdinal + config.stickyTurns
      : (previous?.stickyUntilCompletedTurn ?? null);
  const continuationUntil =
    (source === 'current_user' || source === 'assistant_bridge') && config.continuationTurns > 0
      ? completedOrdinal + config.continuationTurns
      : (previous?.continuationUntilCompletedTurn ?? null);
  const activeUntil = Math.max(
    stickyUntil ?? completedOrdinal,
    continuationUntil ?? completedOrdinal
  );
  return {
    activatedAtCompletedTurn: completedOrdinal,
    stickyUntilCompletedTurn: stickyUntil,
    continuationUntilCompletedTurn: continuationUntil,
    cooldownUntilCompletedTurn:
      config.cooldownTurns > 0 ? activeUntil + config.cooldownTurns : null,
    pendingUntilCompletedTurn: config.delayTurns > 0 ? completedOrdinal + config.delayTurns : null,
    manualActive: previous?.manualActive ?? false
  };
}

function emptyState(): WorldBookActivationStateV2 {
  return {
    activatedAtCompletedTurn: null,
    stickyUntilCompletedTurn: null,
    continuationUntilCompletedTurn: null,
    cooldownUntilCompletedTurn: null,
    pendingUntilCompletedTurn: null,
    manualActive: false
  };
}
