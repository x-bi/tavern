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

export function createGenerationRequestId(): string {
  return globalThis.crypto.randomUUID();
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
