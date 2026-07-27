import * as presetConstants from '../../../../../packages/shared/src/prompt-preset.constants.json';

/** Prompt 预设独立导入/导出格式版本。 */
export const PROMPT_PRESET_FORMAT_VERSION = presetConstants.formatVersion;

/** generationPurposes 单个合法值。 */
export type PromptPresetGenerationPurpose =
  | 'chat_reply'
  | 'regenerate'
  | 'continue'
  | 'user_suggestions'
  | 'memory_summary';

/** generationPurposes 合法值；运行时值直接来自 shared JSON 真源。 */
export const PROMPT_PRESET_GENERATION_PURPOSES =
  presetConstants.generationPurposes as readonly PromptPresetGenerationPurpose[];

/** 新建/导入预设未指定生效用途时的默认值（核心对话用途）。 */
export const PROMPT_PRESET_DEFAULT_GENERATION_PURPOSES =
  presetConstants.defaultGenerationPurposes as PromptPresetGenerationPurpose[];

export type PromptPresetOutputRuleOperationKind = 'add' | 'replace_optional' | 'disable_optional';

/** outputRuleOperations 允许的操作类型。 */
export const PROMPT_PRESET_OUTPUT_RULE_OPERATIONS =
  presetConstants.outputRuleOperations as readonly PromptPresetOutputRuleOperationKind[];

/** 单条 outputRuleOperations 元素。 */
export type PromptPresetOutputRuleOperation = {
  key: string;
  content: string;
  operation: PromptPresetOutputRuleOperationKind;
  sortOrder: number;
};
