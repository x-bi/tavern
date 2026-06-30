export type PromptPresetParams = {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
};

export type PromptPresetResponse = {
  id: string;
  userId: string;
  name: string;
  description: string;
  outputRules: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromptPresetListResponse = {
  items: PromptPresetResponse[];
  total: number;
  page: number;
  pageSize: number;
};
