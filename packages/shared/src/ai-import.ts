import type { CharacterImportPreview } from './character-import';
import type { CompanionImportPreview } from './companion';
import type {
  PersonaImportPreview,
  PromptPresetImportPreview,
  WorldBookImportPreview
} from './module-import';

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

export type AiImportDecisionBasis = 'source' | 'inferred' | 'generated' | 'default' | 'modified';

export type AiImportDecisionConfidence = 'high' | 'medium' | 'low';

export type AiImportDecision = {
  field: string;
  value: string | number | boolean | null;
  previousValue?: string | number | boolean | null;
  basis: AiImportDecisionBasis;
  confidence: AiImportDecisionConfidence;
  reason: string;
};

export type AiImportWarning = {
  code: string;
  message: string;
};

export type AiImportValidationError = {
  code: string;
  message: string;
  field?: string;
};

export type AiImportStrategyOption = {
  id: string;
  label: string;
  description: string;
  scope: 'general' | 'module';
  category: string;
  supportedModes: AiImportMode[];
  defaultEnabled: boolean;
  recommended: boolean;
  disabled: boolean;
  disabledReason: string | null;
};

export type AiImportTargetOption = {
  value: AiImportTarget;
  label: string;
  description: string;
};

export type AiImportModeOption = {
  value: AiImportMode;
  label: string;
  description: string;
};

export type AiImportOptionsResponse = {
  targets: AiImportTargetOption[];
  modes: AiImportModeOption[];
  generalStrategies: AiImportStrategyOption[];
  moduleStrategies: AiImportStrategyOption[];
  defaults: {
    generalStrategyIds: string[];
    moduleStrategyIds: string[];
  };
  limits: {
    sourceMaxChars: number;
    fileMaxBytes: number;
    customInstructionsMaxChars: number;
    modelOutputMaxChars: number;
    allowedExtensions: string[];
  };
};

export type AiImportTransformPayload = {
  target: AiImportTarget;
  modelFallbackGroupId: string;
  sourceText: string;
  mode: AiImportMode;
  generalStrategyIds?: string[];
  moduleStrategyIds?: string[];
  customInstructions?: string;
};

export type AiImportPreview =
  | CharacterImportPreview
  | PersonaImportPreview
  | PromptPresetImportPreview
  | WorldBookImportPreview
  | CompanionImportPreview;

export type AiImportSafeModelMetadata = {
  modelFallbackGroupId: string;
  providerName: string;
  modelName: string;
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
};

export type AiImportTransformResult<TPreview = AiImportPreview> = {
  target: AiImportTarget;
  mode: AiImportMode;
  rawJson: string;
  result: Record<string, unknown>;
  preview: TPreview | null;
  decisions: AiImportDecision[];
  warnings: AiImportWarning[];
  errors: AiImportValidationError[];
  valid: boolean;
  repairAttempted: boolean;
  model: AiImportSafeModelMetadata | null;
};

export type AiImportValidatePayload = {
  target: AiImportTarget;
  rawJson: string;
};

export type AiImportValidationResult<TPreview = AiImportPreview> = {
  target: AiImportTarget;
  rawJson: string;
  result: Record<string, unknown> | null;
  preview: TPreview | null;
  errors: AiImportValidationError[];
  valid: boolean;
};
