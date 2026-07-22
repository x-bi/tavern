import type { PageResult } from './pagination';

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
  /** 预设的系统提示词。 */
  systemPrompt: string;
  /** 输出约束规则文本（注入到 output_rules 段）。 */
  outputRules: string;
  instructions: string[];
  outputRuleOperations: Array<{
    key: string;
    content: string;
    operation: 'add' | 'replace_optional' | 'disable_optional';
    sortOrder: number;
  }>;
  generationPurposes: string[];
  /** 采样温度；未设置时为 null，表示沿用模型默认。 */
  temperature: number | null;
  /** top_p；未设置时为 null。 */
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

/** 创建 / 更新预设的入参，所有业务字段可选（部分更新）。 */
export type PromptPresetPayload = {
  /** 预设名称。 */
  name: string;
  /** 预设描述。 */
  description?: string;
  /** 预设级系统/开发者约束。 */
  systemPrompt?: string;
  /** 输出约束规则文本。 */
  outputRules?: string;
  instructions?: string[];
  outputRuleOperations?: PromptPresetResponse['outputRuleOperations'];
  generationPurposes?: string[];
  /** 采样温度。 */
  temperature?: number | null;
  /** top_p。 */
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
