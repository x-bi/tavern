import 'reflect-metadata';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ERROR_CODES } from '../apps/server/src/common/dto/error-codes';
import { DtoValidationPipe } from '../apps/server/src/common/pipes/dto-validation.pipe';
import { CreateCharacterDto } from '../apps/server/src/modules/characters/dto/create-character.dto';
import { CharacterCardJsonImporter } from '../apps/server/src/modules/characters/import/character-card-json-importer';
import { ModelsService } from '../apps/server/src/modules/models/models.service';
import type { ModelGenerationParams } from '../apps/server/src/modules/models/model.types';
import { PresetsService } from '../apps/server/src/modules/presets/presets.service';
import type { PromptPresetParams } from '../apps/server/src/modules/presets/prompt-preset.types';

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
assert.doesNotThrow(() => modelHarness.assertSupportedProviderName('openai-compatible'));
assert.throws(
  () => modelHarness.assertSupportedProviderName('unknown-provider'),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.MODEL_GATEWAY_PROVIDER_UNSUPPORTED
);

const characterPipe = new DtoValidationPipe(CreateCharacterDto);
assert.throws(
  () =>
    characterPipe.transform({
      name: '测试角色',
      exampleMessages: [{ role: 'system', content: '不应被接受' }]
    }),
  (error: unknown) => exceptionCode(error) === ERROR_CODES.VALIDATION_ERROR
);

const importer = new CharacterCardJsonImporter();
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

console.log('OK frontend/backend field alignment regression checks passed.');
