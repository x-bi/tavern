import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAICompatibleProvider } from '../../src/services/model-gateway/providers/openai-compatible/openai-compatible.provider';

describe('Model Gateway request source and raw log redaction', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redacts API keys, Authorization and Bearer tokens recursively', () => {
    const provider = new OpenAICompatibleProvider({ register: () => undefined } as never);
    const sanitize = (
      provider as unknown as {
        sanitizeLogValue(value: unknown, apiKey: string): unknown;
      }
    ).sanitizeLogValue.bind(provider);
    const result = JSON.stringify(
      sanitize(
        {
          messages: [{ content: 'Bearer abc.def and sk-test-secret' }],
          Authorization: 'Bearer raw-token',
          nested: { apiKey: 'sk-test-secret' }
        },
        'sk-test-secret'
      )
    );
    expect(result).not.toContain('sk-test-secret');
    expect(result).not.toContain('abc.def');
    expect(result).not.toContain('raw-token');
  });

  it('keeps requestId and requestSource on request, response and body logs', async () => {
    const provider = new OpenAICompatibleProvider({ register: () => undefined } as never);
    const logs: Array<Record<string, unknown>> = [];
    (
      provider as unknown as {
        writeRawLog(entry: Record<string, unknown>): void;
        recordCall(entry: unknown): void;
      }
    ).writeRawLog = (entry) => logs.push(entry);
    (
      provider as unknown as {
        recordCall(entry: unknown): void;
      }
    ).recordCall = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: 'test-model',
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await provider.chat([{ role: 'user', content: 'hello' }], {
      providerName: 'openai-compatible',
      baseUrl: 'https://provider.invalid/v1',
      modelName: 'test-model',
      apiKey: 'sk-secret',
      requestId: 'request-1',
      requestSource: 'ai_import_transform'
    });

    expect(logs.map((entry) => entry.type)).toEqual(['request', 'response-start', 'response-body']);
    expect(logs.every((entry) => entry.requestId === 'request-1')).toBe(true);
    expect(logs.every((entry) => entry.requestSource === 'ai_import_transform')).toBe(true);
  });
});
