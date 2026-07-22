import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { FakeModelGateway } from '../helpers/fake-model-gateway';
import { collectSseChunks } from '../helpers/sse-collector';

@Injectable()
class SmokeService {
  value(): string {
    return 'server-unit-ready';
  }
}

describe('T0a server unit infrastructure', () => {
  it('creates a Nest testing module', async () => {
    const module = await Test.createTestingModule({ providers: [SmokeService] }).compile();
    expect(module.get(SmokeService).value()).toBe('server-unit-ready');
  });

  it('runs deterministic gateway and SSE helpers', async () => {
    const gateway = new FakeModelGateway([[{ type: 'delta', text: '你' }, { type: 'done' }]]);
    const output = [];
    for await (const event of gateway.stream({ modelId: 'fake', messages: [] })) {
      output.push(event);
    }
    expect(output).toEqual([
      { type: 'delta', text: '你' },
      { type: 'done', finishReason: 'stop' }
    ]);
    expect(
      collectSseChunks([
        'event: delta\ndata: {"text":"你"}\n',
        '\nevent: done\ndata: {"messageId":"m1"}\n\n'
      ])
    ).toEqual([
      { event: 'delta', data: { text: '你' } },
      { event: 'done', data: { messageId: 'm1' } }
    ]);
  });

  it('controls concurrent fake calls with a barrier instead of sleeping', async () => {
    const gateway = new FakeModelGateway([
      [{ type: 'wait', key: 'release-first' }, { type: 'done' }],
      [{ type: 'delta', text: 'second' }, { type: 'done' }]
    ]);
    const first = collect(gateway.stream({ modelId: 'first', messages: [] }));
    const second = await collect(gateway.stream({ modelId: 'second', messages: [] }));
    expect(second[0]).toEqual({ type: 'delta', text: 'second' });
    gateway.release('release-first');
    expect(await first).toEqual([{ type: 'done', finishReason: 'stop' }]);
  });
});

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const event of events) {
    result.push(event);
  }
  return result;
}
