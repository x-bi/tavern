import type { CompiledPromptSection } from './prompt-section.types';
import type { PromptPreviewWorldBookDebug } from '../prompt-builder/types';
import type { WorldBookRuntimeResult } from './world-book-runtime.service';

/**
 * 将 V2 运行时决策与 Provider 编译后的 section 投影为统一的 Prompt 预览世界书调试结构。
 *
 * 数据来源（均为真实结果，不做任何匹配/预算/排序决策）：
 * - decisions / scannedMessageIds / scanDepth：来自 WorldBookRuntimeService，已在 RuntimeDecision
 *   中携带 worldBookId / title / placement / contentType / trustLevel / budgetPriority /
 *   sortOrder（含未命中条目）。
 * - tokenEstimate：来自 compiledSections，按 entryId = section.sourceId 关联；未命中条目无
 *   section，为 null（真实无估算，非伪造）。
 * - insertedSections：compiledSections 中 kind = world_book 且最终纳入 Provider Prompt 的 section。
 *
 * 一致性：candidateCount === decisions.length；matchedCount === 命中数；
 * skippedCount === 未命中数；insertedSections 为命中条目中实际插入 Prompt 的子集
 * （可能因预算裁剪少于 matchedCount）。
 */
export function buildWorldBookDebug(input: {
  runtime: WorldBookRuntimeResult;
  compiledSections: CompiledPromptSection[];
}): PromptPreviewWorldBookDebug {
  const { decisions, scannedMessageIds, scanDepth } = input.runtime;
  const tokenByEntryId = new Map<string, number>();
  for (const item of input.compiledSections) {
    if (item.section.kind === 'world_book' && item.section.sourceId) {
      tokenByEntryId.set(item.section.sourceId, item.tokenEstimate);
    }
  }
  const decisionByEntryId = new Map(decisions.map((decision) => [decision.entryId, decision]));

  return {
    candidateCount: decisions.length,
    matchedCount: decisions.filter((decision) => decision.included).length,
    skippedCount: decisions.filter((decision) => !decision.included).length,
    scannedMessageIds,
    scanDepth,
    decisions: decisions.map((decision) => ({
      worldBookId: decision.worldBookId,
      entryId: decision.entryId,
      revisionId: decision.revisionId,
      title: decision.title,
      included: decision.included,
      activationSource: decision.activationSource,
      reason: decision.reason,
      sourceMessageId: decision.sourceMessageId,
      placement: decision.placement,
      contentType: decision.contentType,
      trustLevel: decision.trustLevel,
      budgetPriority: decision.budgetPriority,
      sortOrder: decision.sortOrder,
      tokenEstimate: decision.included ? (tokenByEntryId.get(decision.entryId) ?? null) : null
    })),
    insertedSections: input.compiledSections
      .filter((item) => item.section.kind === 'world_book' && item.included)
      .map((item) => {
        const section = item.section;
        const decision = section.sourceId ? decisionByEntryId.get(section.sourceId) : undefined;
        return {
          sectionId: section.id,
          worldBookId: decision?.worldBookId ?? '',
          entryId: section.sourceId ?? '',
          revisionId: section.sourceRevisionId ?? '',
          title: decision?.title ?? '',
          placement: section.placement,
          contentType: section.contentType ?? 'lore',
          budgetPriority: section.budgetPriority,
          sortOrder: section.sortOrder,
          tokenEstimate: item.tokenEstimate
        };
      })
  };
}
