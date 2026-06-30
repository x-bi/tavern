import type { PageResult } from './pagination';

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

export type PromptPresetListResponse = PageResult<PromptPresetResponse>;

export type PromptPresetPayload = {
  name: string;
  description?: string;
  outputRules?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  isDefault?: boolean;
};
