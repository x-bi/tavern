/** 预设参数（采样相关，存为 JSON）。 */
export type PromptPresetParams = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

/** 预设对外响应。 */
export type PromptPresetResponse = {
  id: string;
  userId: string;
  name: string;
  description: string;
  instructions: string[];
  outputRuleOperations: Array<{
    key: string;
    content: string;
    operation: 'add' | 'replace_optional' | 'disable_optional';
    sortOrder: number;
  }>;
  generationPurposes: string[];
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeout: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  isDefault: boolean;
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
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
