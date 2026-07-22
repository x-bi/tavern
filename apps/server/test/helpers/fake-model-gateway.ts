export type FakeGatewayStep =
  | { type: 'delta'; text: string }
  | { type: 'done'; finishReason?: string }
  | { type: 'error'; code: string }
  | { type: 'throw'; error: Error }
  | { type: 'wait'; key: string };

export type FakeGatewayEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; finishReason: string };

export type FakeGatewayCall = {
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  parameters: Record<string, unknown>;
  aborted: boolean;
};

type Barrier = {
  promise: Promise<void>;
  release: () => void;
};

/** Deterministic, network-free model gateway used by unit and integration tests. */
export class FakeModelGateway {
  readonly calls: FakeGatewayCall[] = [];
  private readonly barriers = new Map<string, Barrier>();

  constructor(private readonly scripts: FakeGatewayStep[][]) {}

  release(key: string): void {
    this.getBarrier(key).release();
  }

  async *stream(input: {
    modelId: string;
    messages: Array<{ role: string; content: string }>;
    parameters?: Record<string, unknown>;
    signal?: AbortSignal;
  }): AsyncGenerator<FakeGatewayEvent> {
    const call: FakeGatewayCall = {
      modelId: input.modelId,
      messages: input.messages,
      parameters: input.parameters ?? {},
      aborted: false
    };
    this.calls.push(call);
    const steps = this.scripts[this.calls.length - 1] ?? [];

    for (const step of steps) {
      if (input.signal?.aborted) {
        call.aborted = true;
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (step.type === 'wait') {
        await this.getBarrier(step.key).promise;
        continue;
      }
      if (step.type === 'delta') {
        yield step;
        continue;
      }
      if (step.type === 'done') {
        yield { type: 'done', finishReason: step.finishReason ?? 'stop' };
        return;
      }
      if (step.type === 'error') {
        throw Object.assign(new Error(step.code), { code: step.code });
      }
      throw step.error;
    }
  }

  private getBarrier(key: string): Barrier {
    const existing = this.barriers.get(key);
    if (existing) {
      return existing;
    }
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const barrier = { promise, release };
    this.barriers.set(key, barrier);
    return barrier;
  }
}
