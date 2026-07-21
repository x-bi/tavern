import { PROMPT_BUILDER_DEFAULT_MAX_PROMPT_TOKENS } from './prompt-builder.constants';

/** 计算 Prompt 输入预算所需的最小模型配置。 */
export type PromptBudgetModelConfig = {
  contextLength?: number | null;
  params: {
    maxTokens?: number | null;
  };
};

/**
 * 按候选模型上下文长度扣除输出预算，得到 Builder 可使用的输入 token 预算。
 *
 * 预设 maxTokens 优先于模型默认值；候选未配置上下文长度时使用兼容默认预算。
 * @param candidate 当前实际调用的候选模型。
 * @param presetMaxTokens Prompt 预设覆盖的最大输出 token。
 * @returns Prompt Builder 可使用的输入预算。
 */
export function resolveModelPromptBudget(
  candidate: PromptBudgetModelConfig | null | undefined,
  presetMaxTokens?: number | null
): number {
  if (!candidate?.contextLength || candidate.contextLength <= 0) {
    return PROMPT_BUILDER_DEFAULT_MAX_PROMPT_TOKENS;
  }

  const outputBudget = presetMaxTokens ?? candidate.params.maxTokens ?? 1200;

  return Math.max(0, Math.floor(candidate.contextLength - outputBudget));
}
