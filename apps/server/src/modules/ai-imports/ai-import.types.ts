import type { CurrentUser } from '../users/user.types';

export const AI_IMPORT_TARGETS = [
  'character',
  'persona',
  'prompt_preset',
  'world_book',
  'companion'
] as const;
export type AiImportTarget = (typeof AI_IMPORT_TARGETS)[number];

export const AI_IMPORT_MODES = ['fill_missing', 'smart_optimize', 'rebuild'] as const;
export type AiImportMode = (typeof AI_IMPORT_MODES)[number];

export type AiImportPromptSpecification = {
  targetDescription: string;
  template: Record<string, unknown>;
  constraints: Record<string, unknown>;
};

export type AiImportTargetAdapter = {
  target: AiImportTarget;
  getImportTemplate(): Record<string, unknown>;
  getImportSpecification(): AiImportPromptSpecification;
  previewImport(currentUser: CurrentUser, rawJson: string): Promise<unknown>;
};

export type AiImportStrategyDefinition = {
  id: string;
  label: string;
  description: string;
  scope: 'general' | 'module';
  category: string;
  targets: AiImportTarget[];
  supportedModes: AiImportMode[];
  promptRule: string;
  order: number;
  defaultModes?: AiImportMode[];
  recommended?: boolean;
  conflictsWith?: string[];
  requires?: string[];
};

export type NormalizedAiImportEnvelope = {
  result: Record<string, unknown>;
  decisions: Array<{
    field: string;
    value: string | number | boolean | null;
    previousValue?: string | number | boolean | null;
    basis: 'source' | 'inferred' | 'generated' | 'default' | 'modified';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  warnings: Array<{ code: string; message: string }>;
};
