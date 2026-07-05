/** 预设参数（采样相关，存为 JSON）。 */
export type PromptPresetParams = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
};

/** 预设对外响应。 */
export type PromptPresetResponse = {
  id: string;
  userId: string;
  name: string;
  description: string;
  /** 输出规则（引导模型输出风格的指令）。 */
  outputRules: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  isDefault: boolean;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 预设列表分页响应。 */
export type PromptPresetListResponse = {
  items: PromptPresetResponse[];
  total: number;
  page: number;
  pageSize: number;
};
