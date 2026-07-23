import 'reflect-metadata';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ERROR_CODES } from '../apps/server/src/common/dto/error-codes';
import { DtoValidationPipe } from '../apps/server/src/common/pipes/dto-validation.pipe';
import { CreateCharacterDto } from '../apps/server/src/modules/characters/dto/create-character.dto';
import { CharacterCardJsonImporter } from '../apps/server/src/modules/characters/import/character-card-json-importer';
import { ModelsService } from '../apps/server/src/modules/models/models.service';
import type {
  ModelGenerationParams,
  ProviderModelResponse
} from '../apps/server/src/modules/models/model.types';
import { PresetsService } from '../apps/server/src/modules/presets/presets.service';
import type { PromptPresetParams } from '../apps/server/src/modules/presets/prompt-preset.types';
import { resolveModelPromptBudget } from '../apps/server/src/services/prompt-builder/prompt-budget';

type PresetParamHarness = {
  parseParams(value: string | null): PromptPresetParams;
  mergeParams(existing: PromptPresetParams, dto: Record<string, unknown>): PromptPresetParams;
};

type ModelParamHarness = {
  mergeProviderModelParams(
    existing: ModelGenerationParams,
    dto: Record<string, unknown>
  ): ModelGenerationParams;
  assertSupportedProviderName(providerName: string): void;
  toProviderModelResponse(model: unknown): ProviderModelResponse;
};

function exceptionCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('getResponse' in error)) return undefined;
  const getResponse = (error as { getResponse?: unknown }).getResponse;
  if (typeof getResponse !== 'function') return undefined;
  const response = getResponse.call(error) as { code?: string };
  return response.code;
}

const presetHarness = Object.create(PresetsService.prototype) as PresetParamHarness;
const parsedPreset = presetHarness.parseParams(
  JSON.stringify({
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024,
    timeout: 45000,
    frequencyPenalty: 0.4,
    presencePenalty: 0.2
  })
);
const editedPreset = presetHarness.mergeParams(parsedPreset, { temperature: 0.8 });

assert.deepEqual(editedPreset, {
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 1024,
  timeout: 45000,
  frequencyPenalty: 0.4,
  presencePenalty: 0.2
});
assert.equal(presetHarness.mergeParams(editedPreset, { timeout: null }).timeout, undefined);

const modelHarness = Object.assign(Object.create(ModelsService.prototype) as object, {
  modelGateway: {
    supportsProviderName: (providerName: string) => providerName === 'openai-compatible'
  }
}) as unknown as ModelParamHarness;
const editedModel = modelHarness.mergeProviderModelParams(
  { frequencyPenalty: 0.6, presencePenalty: 0.3 },
  { temperature: 0.5 }
);

assert.deepEqual(editedModel, {
  temperature: 0.5,
  frequencyPenalty: 0.6,
  presencePenalty: 0.3
});
const inheritedTimeoutModel = modelHarness.toProviderModelResponse({
  id: 'model-1',
  providerId: 'provider-1',
  name: '测试模型',
  model: 'test-model',
  defaultParamsJson: null,
  contextLength: 8192,
  notes: null,
  sortOrder: 0,
  isEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  provider: {
    provider: 'openai-compatible',
    name: '测试供应商',
    timeout: 45000
  }
});
assert.equal(inheritedTimeoutModel.timeout, null);
assert.equal(inheritedTimeoutModel.effectiveTimeout, 45000);
assert.doesNotThrow(() => modelHarness.assertSupportedProviderName('openai-compatible'));
assert.throws(
  () => modelHarness.assertSupportedProviderName('unknown-provider'),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.MODEL_GATEWAY_PROVIDER_UNSUPPORTED
);

const characterPipe = new DtoValidationPipe(CreateCharacterDto);
const importer = new CharacterCardJsonImporter();
assert.throws(
  () =>
    characterPipe.transform({
      name: '测试角色',
      exampleMessages: [{ role: 'user', content: '   ' }]
    }),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.VALIDATION_ERROR
);

assert.throws(
  () =>
    characterPipe.transform({
      name: '测试角色',
      exampleMessages: [{ role: 'system', content: '不应被接受' }]
    }),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.VALIDATION_ERROR
);
assert.throws(
  () =>
    importer.map(
      JSON.stringify({
        name: '测试角色',
        exampleMessages: [{ role: 'user', content: '   ' }]
      })
    ),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT
);
assert.throws(
  () =>
    importer.map(
      JSON.stringify({
        name: '测试角色',
        exampleMessages: [{ content: '缺少 role' }]
      })
    ),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT
);

assert.equal(
  resolveModelPromptBudget({ contextLength: 128000, params: { maxTokens: 4000 } }),
  124000
);
assert.equal(resolveModelPromptBudget({ contextLength: 8192, params: { maxTokens: 1024 } }), 7168);
assert.equal(resolveModelPromptBudget(null), 8000);

assert.throws(
  () =>
    importer.map(
      JSON.stringify({
        name: '测试角色',
        exampleMessages: [{ role: 'system', content: '不应被接受' }]
      })
    ),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.CHARACTER_IMPORT_INVALID_FORMAT
);

const modelViewSource = readFileSync(
  resolve(process.cwd(), '../../apps/web/src/views/models/ModelConfigView.vue'),
  'utf8'
);
assert.match(
  modelViewSource,
  /isEnabled:\s*groupForm\.candidateEnabled\[modelId\]\s*!==\s*false/,
  '模型链保存必须提交候选项的实际启停状态。'
);
assert.match(
  modelViewSource,
  /model\.timeout !== null[\s\S]*model\.effectiveTimeout/,
  '模型列表必须区分显式 timeout 和继承后的生效 timeout。'
);

const promptPreviewSource = readFileSync(
  resolve(process.cwd(), '../../apps/server/src/modules/prompts/prompts.service.ts'),
  'utf8'
);
assert.match(
  promptPreviewSource,
  /getGatewayCandidates[\s\S]*modelGateway: gatewayConfig[\s\S]*maxPromptTokens: resolveModelPromptBudget/,
  'Prompt Preview 必须使用真实模型链和上下文预算。'
);

const chatSource = readFileSync(
  resolve(process.cwd(), '../../apps/server/src/modules/chat/chat.service.ts'),
  'utf8'
);
assert.match(
  chatSource,
  /for \(const \[candidateIndex, candidate\][\s\S]*gatewayConfig: candidate[\s\S]*buildTavernPromptSections[\s\S]*streamChat\(compiled\.messages/,
  '酒馆聊天必须在候选循环内按当前候选重新构建 Prompt。'
);

const companionChatSource = readFileSync(
  resolve(process.cwd(), '../../apps/server/src/modules/companion-chat/companion-chat.service.ts'),
  'utf8'
);
assert.match(
  companionChatSource,
  /for \(const \[candidateIndex, candidate\] of candidates\.entries\(\)\)[\s\S]*promptBudget\(candidate,[\s\S]*buildCompanionPromptSections[\s\S]*streamChat\(compiled\.messages/,
  'AI 角色聊天必须在候选循环内按当前候选重新构建 Prompt。'
);

console.log('OK frontend/backend field alignment regression checks passed.');
