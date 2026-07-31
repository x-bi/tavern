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
      requestSource: 'scene_image_prompt'
    });

    expect(logs.map((entry) => entry.type)).toEqual(['request', 'response-start', 'response-body']);
    expect(logs.every((entry) => entry.requestId === 'request-1')).toBe(true);
    expect(logs.every((entry) => entry.requestSource === 'scene_image_prompt')).toBe(true);
    expect(logs.every((entry) => entry.operation === 'chat')).toBe(true);
  });

  it('logs image generation separately without storing image payloads or remote URLs', async () => {
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
            data: [
              { b64_json: 'aGVsbG8=', revised_prompt: 'final scene' },
              { url: 'https://temporary.invalid/image.png?token=secret' }
            ],
            usage: { total_tokens: 12 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await provider.generateImage({
      providerName: 'openai-compatible',
      baseUrl: 'https://provider.invalid/v1',
      modelName: 'test-image-model',
      apiKey: 'sk-secret',
      requestId: 'image-request-1',
      requestSource: 'chat_scene_image',
      prompt: 'draw the final scene'
    });

    expect(logs.map((entry) => entry.type)).toEqual([
      'request',
      'response-start',
      'response-body',
      'response-result'
    ]);
    expect(logs.every((entry) => entry.requestId === 'image-request-1')).toBe(true);
    expect(logs.every((entry) => entry.requestSource === 'chat_scene_image')).toBe(true);
    expect(logs.every((entry) => entry.operation === 'generateImage')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('aGVsbG8=');
    expect(JSON.stringify(logs)).not.toContain('token=secret');
    expect(logs.at(-1)).toMatchObject({
      type: 'response-result',
      success: true,
      imageCount: 2
    });
  });

  it('logs image request errors with the image operation and source', async () => {
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
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('image endpoint unavailable')));

    await expect(
      provider.generateImage({
        providerName: 'openai-compatible',
        baseUrl: 'https://provider.invalid/v1',
        modelName: 'test-image-model',
        requestId: 'image-request-2',
        requestSource: 'chat_scene_image',
        prompt: 'draw the final scene'
      })
    ).rejects.toBeDefined();

    expect(logs.at(-1)).toMatchObject({
      type: 'request-error',
      requestId: 'image-request-2',
      operation: 'generateImage',
      requestSource: 'chat_scene_image',
      message: 'image endpoint unavailable'
    });
  });
});
