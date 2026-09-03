import type { GenerationPurpose } from './generation-lifecycle.types';
import type { PromptSectionV2 } from './prompt-section.types';

export const PROMPT_CURRENT_TIME_ZONE = 'Asia/Shanghai';

/** Builds a stable, provider-neutral clock section from the generation start time. */
export function buildCurrentTimeSection(
  purpose: GenerationPurpose,
  now: Date = new Date()
): PromptSectionV2 {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: PROMPT_CURRENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const currentTime = `${value('year')}-${value('month')}-${value('day')} ${value('weekday')} ${value('hour')}:${value('minute')}`;

  return {
    id: 'runtime:current-time',
    kind: 'runtime_context',
    sourceType: 'system_runtime_time',
    content: [
      `当前日期时间：${currentTime}（${PROMPT_CURRENT_TIME_ZONE}，北京时间）。`,
      '把该时间作为当前对话的背景事实；当用户谈到现在、今天、昨晚、熬夜、太晚、早起等时间相关语境时，据此判断并自然回应。非必要时不要主动报时，也不要声称能持续感知时间流逝。'
    ].join('\n'),
    placement: 'instruction',
    importance: 'required',
    budgetPriority: 990,
    sortOrder: 5,
    truncationPolicy: 'never',
    generationPurposes: [purpose]
  };
}
