import type { PageResult } from './pagination';
import presetConstants from './prompt-preset.constants.json';

/** Prompt 预设独立导入/导出格式版本。 */
export const PROMPT_PRESET_FORMAT_VERSION = presetConstants.formatVersion;

/** Prompt 预设 generationPurposes 单个合法值。 */
export type PromptPresetGenerationPurpose =
  | 'chat_reply'
  | 'regenerate'
  | 'continue'
  | 'user_suggestions'
  | 'memory_summary';

/**
 * Prompt 预设 generationPurposes 合法值。
 *
 * 这是预设链路的唯一合法值真源。DTO `@IsIn`、schema 默认值、seed、导入回退默认值
 * 均须与此保持一致，禁止各处维护字面量分叉。值与 `GenerationPurpose`（context-engine）
 * 保持一致，但预设层独立持有常量以便运行时校验。
 */
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

/** Prompt 预设的响应体，封装一组可复用的系统约束与生成参数。 */
export type PromptPresetResponse = {
  /** 预设 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 预设名称。 */
  name: string;
  /** 预设描述。 */
  description: string;
  instructions: string[];
  outputRuleOperations: PromptPresetOutputRuleOperation[];
  generationPurposes: PromptPresetGenerationPurpose[];
  /** 采样温度；未设置时为 null，表示沿用模型默认。 */
  temperature: number | null;
  /** topP（核采样）；未设置时为 null。 */
  topP: number | null;
  /** 最大输出 token 数；未设置时为 null。 */
  maxTokens: number | null;
  /** 单次模型请求超时（毫秒）；未设置时为 null。 */
  timeout: number | null;
  /** 频率惩罚；未设置时为 null。 */
  frequencyPenalty: number | null;
  /** 存在惩罚；未设置时为 null。 */
  presencePenalty: number | null;
  /** 是否为默认预设。 */
  isDefault: boolean;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 预设列表分页响应。 */
export type PromptPresetListResponse = PageResult<PromptPresetResponse>;

/** 创建预设入参；三个 V2 数组必须显式提交，空数组具有明确语义。 */
export type PromptPresetPayload = {
  /** 预设名称。 */
  name: string;
  /** 预设描述。 */
  description?: string;
  instructions: string[];
  outputRuleOperations: PromptPresetOutputRuleOperation[];
  generationPurposes: PromptPresetGenerationPurpose[];
  /** 采样温度。 */
  temperature?: number | null;
  /** topP（核采样）。 */
  topP?: number | null;
  /** 最大输出 token 数。 */
  maxTokens?: number | null;
  /** 单次模型请求超时（毫秒）。 */
  timeout?: number | null;
  /** 频率惩罚。 */
  frequencyPenalty?: number | null;
  /** 存在惩罚。 */
  presencePenalty?: number | null;
  /** 是否设为默认预设。 */
  isDefault?: boolean;
  /** 是否标记为敏感内容；未传时默认 false。 */
  isSensitive?: boolean;
  /** 是否发布到固定管理员内容库。 */
  isShared?: boolean;
};
