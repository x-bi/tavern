import { describe, expect, it, vi } from 'vitest';

import { AiImportPromptFactory } from '../../src/modules/ai-imports/ai-import-prompt.factory';
import { AiImportRepairPromptFactory } from '../../src/modules/ai-imports/ai-import-repair-prompt.factory';
import { AiImportStrategyRegistry } from '../../src/modules/ai-imports/ai-import-strategy.registry';
import { AiImportsService } from '../../src/modules/ai-imports/ai-imports.service';
import { ModelGatewayError } from '../../src/services/model-gateway';

const user = { id: 'u1', username: 'user', displayName: 'User', role: 'member' as const };
const dto = {
  target: 'character' as const,
  modelFallbackGroupId: 'group-1',
  sourceText: '角色名为林晚。',
  mode: 'smart_optimize' as const,
  generalStrategyIds: ['preserve_source_facts'],
  moduleStrategyIds: [],
  customInstructions: ''
};
const candidate = (modelName: string, contextWindowTokens = 32768) => ({
  modelFallbackGroupId: 'group-1',
  providerName: 'openai-compatible',
  baseUrl: 'https://provider.invalid/v1',
  modelName,
  apiKey: 'secret',
  capabilities: {
    supportsDeveloperRole: false,
    systemPlacement: 'initial_only' as const,
    supportsMultipleSystemMessages: true,
    requiresAlternatingRoles: false,
    contextWindowTokens,
    tokenizerType: 'heuristic'
  },
  params: {}
});
const output = JSON.stringify({
  result: {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: { name: '林晚' }
  },
  decisions: [],
  warnings: []
});

function createService(params?: {
  candidates?: ReturnType<typeof candidate>[];
  gateway?: ReturnType<typeof vi.fn>;
  preview?: ReturnType<typeof vi.fn>;
}) {
  const gateway =
    params?.gateway ??
    vi.fn().mockResolvedValue({
      text: output,
      providerName: 'openai-compatible',
      modelName: 'model-a',
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50 }
    });
  const preview = params?.preview ?? vi.fn().mockResolvedValue({ name: '林晚' });
  const adapter = {
    target: 'character',
    getImportTemplate: () => ({}),
    getImportSpecification: () => ({
      targetDescription: 'character',
      template: { spec: 'chara_card_v2', spec_version: '2.0', data: { name: '' } },
      constraints: { required: ['data.name'] }
    }),
    previewImport: preview
  };
  const service = new AiImportsService(
    {
      getOrThrow: () => ({
        aiImport: {
          sourceMaxChars: 50000,
          fileMaxBytes: 1048576,
          customInstructionsMaxChars: 2000,
          modelOutputMaxChars: 200000
        }
      })
    } as never,
    {
      getGatewayCandidates: vi.fn().mockResolvedValue(params?.candidates ?? [candidate('model-a')])
    } as never,
    { chat: gateway } as never,
    new AiImportStrategyRegistry(),
    { get: () => adapter } as never,
    new AiImportPromptFactory(),
    new AiImportRepairPromptFactory()
  );
  return { service, gateway, preview };
}

describe('AiImportsService', () => {
  it('uses the selected shared model chain, gateway and transform requestSource', async () => {
    const { service, gateway, preview } = createService();
    const result = await service.transform(user, dto);
    expect(result.valid).toBe(true);
    expect(preview).toHaveBeenCalledWith(user, expect.stringContaining('chara_card_v2'));
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(gateway.mock.calls[0][1]).toMatchObject({
      requestSource: 'ai_import_transform',
      temperature: 0,
      topP: 1
    });
  });

  it('falls back to the next candidate after a gateway failure', async () => {
    const gateway = vi
      .fn()
      .mockRejectedValueOnce(new ModelGatewayError('MODEL_GATEWAY_REQUEST_FAILED', 'network'))
      .mockResolvedValueOnce({
        text: output,
        providerName: 'openai-compatible',
        modelName: 'model-b'
      });
    const { service } = createService({
      candidates: [candidate('model-a'), candidate('model-b')],
      gateway
    });
    const result = await service.transform(user, dto);
    expect(result.valid).toBe(true);
    expect(gateway).toHaveBeenCalledTimes(2);
  });

  it('skips candidates without enough context capacity', async () => {
    const { service, gateway } = createService({
      candidates: [candidate('small', 1000), candidate('large', 32768)]
    });
    const result = await service.transform(user, dto);
    expect(result.valid).toBe(true);
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(gateway.mock.calls[0][1].modelName).toBe('large');
  });

  it('returns a stable context error when every candidate is too small', async () => {
    const { service, gateway } = createService({
      candidates: [candidate('small-a', 1000), candidate('small-b', 2000)]
    });
    await expect(service.transform(user, dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AI_IMPORT_CONTEXT_LIMIT_EXCEEDED' })
    });
    expect(gateway).not.toHaveBeenCalled();
  });

  it('repairs at most once and marks the repair source', async () => {
    const gateway = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({ result: { broken: true }, decisions: [], warnings: [] }),
        providerName: 'openai-compatible',
        modelName: 'model-a'
      })
      .mockResolvedValueOnce({
        text: output,
        providerName: 'openai-compatible',
        modelName: 'model-a'
      });
    const preview = vi
      .fn()
      .mockRejectedValueOnce(new Error('invalid target JSON'))
      .mockResolvedValueOnce({ name: '林晚' });
    const { service } = createService({ gateway, preview });
    const result = await service.transform(user, dto);
    expect(result.repairAttempted).toBe(true);
    expect(result.valid).toBe(true);
    expect(gateway).toHaveBeenCalledTimes(2);
    expect(gateway.mock.calls[1][1].requestSource).toBe('ai_import_repair');
  });

  it('releases the per-user lock after failure', async () => {
    const gateway = vi
      .fn()
      .mockRejectedValueOnce(new ModelGatewayError('MODEL_GATEWAY_TIMEOUT', 'timeout'))
      .mockResolvedValueOnce({
        text: output,
        providerName: 'openai-compatible',
        modelName: 'model-a'
      });
    const { service } = createService({ gateway });
    await expect(service.transform(user, dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AI_IMPORT_ALL_MODELS_FAILED' })
    });
    await expect(service.transform(user, dto)).resolves.toMatchObject({ valid: true });
  });
});
