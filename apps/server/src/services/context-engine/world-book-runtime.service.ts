import { Inject, Injectable } from '@nestjs/common';
import { canonicalJson } from '../../common/canonical-json';
import { PrismaService } from '../../prisma/prisma.service';
import type { ChatMessageLike, WorldBookContext } from '../prompt-builder/types';
import type {
  GenerationPurpose,
  ProposedWorldBookStateChange,
  ProposedWorldBookTrace
} from './generation-lifecycle.types';
import type { PromptSectionV2 } from './prompt-section.types';
import {
  advanceWorldBookActivationState,
  matchWorldBookEntriesV2,
  type WorldBookActivationSource,
  type WorldBookActivationStateV2,
  type WorldBookCandidateV2,
  type WorldBookEntryConfigV2,
  type WorldBookMatchEvidence
} from './world-book-matcher-v2';

type RuntimeTarget = 'conversation' | 'companion';
type RuntimeDecision = {
  entryId: string;
  revisionId: string;
  included: boolean;
  activationSource: WorldBookActivationSource | null;
  reason: string | null;
  sourceMessageId: string | null;
};
export type WorldBookRuntimeResult = {
  sections: PromptSectionV2[];
  includedWorldBooks: ProposedWorldBookTrace[];
  stateChanges: ProposedWorldBookStateChange[];
  decisions: RuntimeDecision[];
};

type StoredState = WorldBookActivationStateV2 & {
  entryId: string;
  entryRevisionId: string;
  activatedByMessageId: string | null;
  rootUserMessageId: string | null;
  lineageJson: string;
  bridgeDepth: number;
};

@Injectable()
export class WorldBookRuntimeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  evaluateConversation(input: {
    conversationId: string;
    worldBooks: WorldBookContext[];
    history: ChatMessageLike[];
    currentUserMessage: ChatMessageLike;
    purpose: GenerationPurpose;
  }) {
    return this.evaluate('conversation', input.conversationId, input);
  }

  evaluateCompanion(input: {
    companionId: string;
    worldBooks: WorldBookContext[];
    history: ChatMessageLike[];
    currentUserMessage: ChatMessageLike;
    purpose: GenerationPurpose;
  }) {
    return this.evaluate('companion', input.companionId, input);
  }

  private async evaluate(
    target: RuntimeTarget,
    targetId: string,
    input: {
      worldBooks: WorldBookContext[];
      history: ChatMessageLike[];
      currentUserMessage: ChatMessageLike;
      purpose: GenerationPurpose;
    }
  ): Promise<WorldBookRuntimeResult> {
    const [states, completedOrdinal, assistantLineages] = await Promise.all([
      this.loadStates(target, targetId),
      this.nextCompletedOrdinal(target, targetId),
      this.loadAssistantLineages(target, targetId)
    ]);
    const stateByEntry = new Map(states.map((state) => [state.entryId, state]));
    const entries = input.worldBooks
      .filter((book) => book.isEnabled)
      .flatMap((book) =>
        book.entries
          .filter((entry) => entry.isEnabled && entry.activeRevisionId)
          .map((entry) => ({ book, entry, config: parseConfig(entry.config) }))
      );
    const candidates: WorldBookCandidateV2[] = entries.map(({ entry, config }) => ({
      entryId: entry.id,
      revisionId: entry.activeRevisionId!,
      config,
      assistantInfluenceEntryIds: assistantLineages.map((lineage) => lineage.entryId),
      assistantLineages: assistantLineages.map(({ lineageEntryIds, bridgeDepth }) => ({
        lineageEntryIds,
        bridgeDepth
      }))
    }));
    const current = input.currentUserMessage;
    const userHistory = input.history
      .filter((message) => message.role === 'user' && message.id !== current.id)
      .slice(-Math.max(1, ...candidates.map((entry) => entry.config.userHistoryScanDepth)))
      .map((message) => ({
        id: message.id,
        source: 'user_history' as const,
        content: message.content,
        rootUserMessageId: message.id
      }));
    const latestAssistant = [...input.history]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status !== 'edited');
    const direct = matchWorldBookEntriesV2({
      entries: candidates,
      messages: [
        {
          id: current.id,
          source: 'current_user',
          content: current.content,
          rootUserMessageId: current.id
        },
        ...userHistory,
        ...(latestAssistant
          ? [
              {
                id: latestAssistant.id,
                source: 'assistant_latest' as const,
                content: latestAssistant.content,
                rootUserMessageId: current.id
              }
            ]
          : [])
      ],
      purpose: input.purpose
    });
    const matchByEntry = new Map(direct.map((match) => [match.entryId, match]));
    const decisions: RuntimeDecision[] = [];
    const sections: PromptSectionV2[] = [];
    const includedWorldBooks: ProposedWorldBookTrace[] = [];
    const stateChanges: ProposedWorldBookStateChange[] = [];

    entries.forEach(({ book, entry, config }) => {
      const previous = stateByEntry.get(entry.id) ?? null;
      let evidence =
        matchByEntry.get(entry.id) ??
        this.stateEvidence(
          entry.id,
          entry.activeRevisionId!,
          previous,
          current.id,
          completedOrdinal
        );
      let reason: string | null = evidence ? null : 'not_matched';
      if (
        evidence &&
        previous?.cooldownUntilCompletedTurn &&
        completedOrdinal <= previous.cooldownUntilCompletedTurn
      ) {
        const overridden =
          config.cooldownPolicy === 'current_user_override' &&
          evidence.activationSource === 'current_user';
        if (!overridden) {
          evidence = undefined;
          reason = 'cooldown';
        }
      }
      if (
        evidence &&
        previous?.pendingUntilCompletedTurn &&
        completedOrdinal < previous.pendingUntilCompletedTurn
      ) {
        evidence = undefined;
        reason = 'delay';
      }
      if (
        evidence &&
        config.delayTurns > 0 &&
        !previous &&
        evidence.activationSource !== 'constant' &&
        evidence.activationSource !== 'manual'
      ) {
        stateChanges.push(
          this.toPendingStateChange(
            entry.id,
            entry.activeRevisionId!,
            evidence,
            config,
            completedOrdinal
          )
        );
        evidence = undefined;
        reason = 'delay';
      }
      decisions.push({
        entryId: entry.id,
        revisionId: entry.activeRevisionId!,
        included: Boolean(evidence),
        activationSource: evidence?.activationSource ?? null,
        reason,
        sourceMessageId: evidence?.sourceMessageId ?? null
      });
      if (!evidence) return;

      const context = record(entry.config);
      const placement = placementFor(context.placement);
      const contentType = contentTypeFor(context.contentType);
      const trustLevel = trustLevelFor(context.trustLevel);
      sections.push({
        id: `world-book:${entry.id}:${entry.activeRevisionId}`,
        kind: 'world_book',
        sourceType: 'world_book_entry_revision',
        sourceId: entry.id,
        sourceRevisionId: entry.activeRevisionId!,
        content: entry.content,
        compactContent: entry.compactContent ?? undefined,
        compactSourceHash: entry.compactSourceHash ?? undefined,
        placement,
        importance: contentType === 'state' ? 'reserved' : 'optional',
        budgetPriority: config.budgetPriority,
        sortOrder: config.sortOrder,
        truncationPolicy: 'drop',
        generationPurposes: config.generationPurposes,
        contentType,
        trustLevel
      });
      includedWorldBooks.push({
        entryId: entry.id,
        entryRevisionId: entry.activeRevisionId!,
        activationSource: evidence.activationSource,
        sourceMessageId: evidence.sourceMessageId,
        rootUserMessageId: evidence.rootUserMessageId,
        lineageJson: canonicalJson(evidence.lineageEntryIds),
        bridgeDepth: evidence.bridgeDepth
      });
      const next = advanceWorldBookActivationState(
        previous,
        config,
        evidence.activationSource,
        completedOrdinal
      );
      if (
        previous?.pendingUntilCompletedTurn &&
        completedOrdinal >= previous.pendingUntilCompletedTurn &&
        evidence.activationSource === 'continuation'
      ) {
        next.pendingUntilCompletedTurn = null;
      }
      stateChanges.push({
        entryId: entry.id,
        entryRevisionId: entry.activeRevisionId!,
        operation: 'upsert',
        sourceKey: `turn:${completedOrdinal}:${evidence.activationSource}:${evidence.sourceMessageId ?? current.id}`,
        payload: {
          ...next,
          activatedByMessageId: evidence.sourceMessageId,
          rootUserMessageId: evidence.rootUserMessageId,
          lineageJson: canonicalJson(evidence.lineageEntryIds),
          bridgeDepth: evidence.bridgeDepth,
          sourceType: evidence.activationSource
        }
      });
      void book;
    });
    return { sections, includedWorldBooks, stateChanges, decisions };
  }

  private stateEvidence(
    entryId: string,
    revisionId: string,
    state: StoredState | null,
    rootUserMessageId: string,
    completedOrdinal: number
  ): WorldBookMatchEvidence | undefined {
    if (!state || state.entryRevisionId !== revisionId) return undefined;
    let source: WorldBookActivationSource | null = null;
    if (state.manualActive) source = 'manual';
    else if (state.stickyUntilCompletedTurn && completedOrdinal <= state.stickyUntilCompletedTurn)
      source = 'sticky';
    else if (
      state.continuationUntilCompletedTurn &&
      completedOrdinal <= state.continuationUntilCompletedTurn
    )
      source = 'continuation';
    else if (state.pendingUntilCompletedTurn && completedOrdinal >= state.pendingUntilCompletedTurn)
      source = 'continuation';
    if (!source) return undefined;
    return {
      entryId,
      revisionId,
      activationSource: source,
      sourceMessageId: state.activatedByMessageId,
      rootUserMessageId: state.rootUserMessageId ?? rootUserMessageId,
      matchedPrimary: [],
      matchedSecondary: [],
      lineageEntryIds: parseStringArray(state.lineageJson, [entryId]),
      bridgeDepth: state.bridgeDepth,
      specificity: 0
    };
  }

  private toPendingStateChange(
    entryId: string,
    revisionId: string,
    evidence: WorldBookMatchEvidence,
    config: WorldBookEntryConfigV2,
    completedOrdinal: number
  ): ProposedWorldBookStateChange {
    return {
      entryId,
      entryRevisionId: revisionId,
      operation: 'upsert',
      sourceKey: `turn:${completedOrdinal}:delay:${evidence.sourceMessageId ?? evidence.rootUserMessageId}`,
      payload: {
        ...advanceWorldBookActivationState(
          null,
          config,
          evidence.activationSource,
          completedOrdinal
        ),
        activatedByMessageId: evidence.sourceMessageId,
        rootUserMessageId: evidence.rootUserMessageId,
        lineageJson: canonicalJson(evidence.lineageEntryIds),
        bridgeDepth: evidence.bridgeDepth,
        sourceType: 'delay_pending'
      }
    };
  }

  private async loadStates(target: RuntimeTarget, targetId: string): Promise<StoredState[]> {
    return target === 'conversation'
      ? this.prisma.conversationWorldBookActivationState.findMany({
          where: { conversationId: targetId }
        })
      : this.prisma.companionWorldBookActivationState.findMany({
          where: { companionId: targetId }
        });
  }

  private async nextCompletedOrdinal(target: RuntimeTarget, targetId: string): Promise<number> {
    const aggregate =
      target === 'conversation'
        ? await this.prisma.conversationTurn.aggregate({
            where: { conversationId: targetId },
            _max: { completedOrdinal: true }
          })
        : await this.prisma.companionTurn.aggregate({
            where: { companionId: targetId },
            _max: { completedOrdinal: true }
          });
    return (aggregate._max.completedOrdinal ?? 0) + 1;
  }

  private async loadAssistantLineages(target: RuntimeTarget, targetId: string) {
    const traces =
      target === 'conversation'
        ? ((
            await this.prisma.conversationTurn.findFirst({
              where: { conversationId: targetId, activeAssistantMessageId: { not: null } },
              orderBy: { completedOrdinal: 'desc' },
              include: {
                activeAssistant: {
                  include: { generationTrace: { include: { includedWorldBooks: true } } }
                }
              }
            })
          )?.activeAssistant?.generationTrace?.includedWorldBooks ?? [])
        : ((
            await this.prisma.companionTurn.findFirst({
              where: { companionId: targetId, activeAssistantMessageId: { not: null } },
              orderBy: { completedOrdinal: 'desc' },
              include: {
                activeAssistant: {
                  include: { generationTrace: { include: { includedWorldBooks: true } } }
                }
              }
            })
          )?.activeAssistant?.generationTrace?.includedWorldBooks ?? []);
    return traces
      .map((trace) => ({
        entryId: trace.entryId,
        lineageEntryIds: parseStringArray(trace.lineageJson, [trace.entryId]),
        bridgeDepth: trace.bridgeDepth
      }))
      .sort(
        (left, right) =>
          left.bridgeDepth - right.bridgeDepth ||
          left.entryId.localeCompare(right.entryId) ||
          left.lineageEntryIds.join('\u0000').localeCompare(right.lineageEntryIds.join('\u0000'))
      );
  }
}

function parseConfig(config: Record<string, unknown> | null | undefined): WorldBookEntryConfigV2 {
  const value = record(config);
  const scanSources = stringArray(value.scanSources).filter(
    (item): item is 'current_user' | 'user_history' | 'assistant_latest' =>
      ['current_user', 'user_history', 'assistant_latest'].includes(item)
  );
  const generationPurposes = stringArray(value.generationPurposes).filter(
    (item): item is GenerationPurpose =>
      ['chat_reply', 'regenerate', 'continue', 'user_suggestions', 'memory_summary'].includes(item)
  );
  return {
    activationMode: oneOf(value.activationMode, ['constant', 'keyword', 'manual'], 'keyword'),
    matchMode: oneOf(value.matchMode, ['contains', 'normalized_phrase'], 'normalized_phrase'),
    primaryKeywords: stringArray(value.primaryKeywords),
    primaryLogic: oneOf(value.primaryLogic, ['any', 'all'], 'any'),
    secondaryKeywords: stringArray(value.secondaryKeywords),
    secondaryLogic: oneOf(
      value.secondaryLogic,
      ['and_any', 'and_all', 'not_any', 'not_all'],
      'and_any'
    ),
    excludeKeywords: stringArray(value.excludeKeywords),
    sameMessageOnly: value.sameMessageOnly !== false,
    scanSources: scanSources.length
      ? scanSources
      : ['current_user', 'user_history', 'assistant_latest'],
    userHistoryScanDepth: number(value.userHistoryScanDepth, 6),
    stickyTurns: number(value.stickyTurns, 0),
    continuationTurns: number(value.continuationTurns, 1),
    cooldownTurns: number(value.cooldownTurns, 0),
    delayTurns: number(value.delayTurns, 0),
    cooldownPolicy: oneOf(value.cooldownPolicy, ['strict', 'current_user_override'], 'strict'),
    generationPurposes: generationPurposes.length
      ? generationPurposes
      : ['chat_reply', 'regenerate', 'continue'],
    budgetPriority: integer(value.budgetPriority, 0),
    sortOrder: integer(value.sortOrder, 0)
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
function parseStringArray(value: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(value);
    return stringArray(parsed).length ? stringArray(parsed) : fallback;
  } catch {
    return fallback;
  }
}
function number(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}
function integer(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}
function oneOf<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback;
}
function placementFor(value: unknown): PromptSectionV2['placement'] {
  return oneOf(
    value,
    ['instruction', 'before_history', 'after_history', 'before_current_user'],
    'before_history'
  );
}
function contentTypeFor(value: unknown): NonNullable<PromptSectionV2['contentType']> {
  return oneOf(value, ['lore', 'state', 'behavior_rule', 'reference'], 'lore');
}
function trustLevelFor(value: unknown): NonNullable<PromptSectionV2['trustLevel']> {
  return oneOf(
    value,
    ['system', 'user_authored', 'imported_untrusted', 'user_confirmed_import'],
    'user_authored'
  );
}
