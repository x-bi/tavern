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
  /** 输出约束规则文本（注入到 output_rules 段）。 */
  outputRules: string;
  /** 采样温度；未设置时为 null，表示沿用模型默认。 */
  temperature: number | null;
  /** top_p；未设置时为 null。 */
  topP: number | null;
  /** 最大输出 token 数；未设置时为 null。 */
  maxTokens: number | null;
  /** 是否为默认预设。 */
  isDefault: boolean;
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
  /** 输出约束规则文本。 */
  outputRules?: string;
  /** 采样温度。 */
  temperature?: number;
  /** top_p。 */
  topP?: number;
  /** 最大输出 token 数。 */
  maxTokens?: number;
  /** 是否设为默认预设。 */
  isDefault?: boolean;
};
