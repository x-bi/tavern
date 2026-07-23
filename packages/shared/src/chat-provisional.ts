export type ProvisionalAssistantState = {
  requestId: string;
  messageId: string | null;
  content: string;
  status: 'streaming' | 'committed' | 'discarded';
  errorCode: string | null;
};

export type ProvisionalAssistantEvent =
  | { event: 'delta'; data: { messageId?: string; text: string } }
  | { event: 'done'; data: { messageId: string } }
  | { event: 'error'; data: { code: string } };

/** Creates a UUID v4 in both secure and HTTP browser contexts. */
export function createClientOperationId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function createGenerationRequestId(): string {
  return createClientOperationId();
}

export function createProvisionalAssistant(requestId: string): ProvisionalAssistantState {
  return { requestId, messageId: null, content: '', status: 'streaming', errorCode: null };
}

/** Keeps deltas provisional until the server confirms its commit with `done`. */
export function reduceProvisionalAssistant(
  state: ProvisionalAssistantState,
  event: ProvisionalAssistantEvent
): ProvisionalAssistantState {
  if (state.status !== 'streaming') {
    return state;
  }
  if (event.event === 'delta') {
    return {
      ...state,
      messageId: event.data.messageId ?? state.messageId,
      content: state.content + event.data.text
    };
  }
  if (event.event === 'done') {
    return { ...state, messageId: event.data.messageId, status: 'committed' };
  }
  return {
    ...state,
    messageId: null,
    content: '',
    status: 'discarded',
    errorCode: event.data.code
  };
}
