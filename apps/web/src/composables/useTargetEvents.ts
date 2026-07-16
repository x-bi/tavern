import type { ShareTargetType } from '@tavern/shared';
import { onUnmounted } from 'vue';
import { API_BASE_URL, authHeaders } from '../api/http';
import { parseSseFrame } from './useChatStream';

export function useTargetEvents(onEvent: (event: string, data: Record<string, unknown>) => void) {
  let controller: AbortController | null = null;
  let reconnectTimer: number | null = null;
  let active: { type: ShareTargetType; id: string } | null = null;

  function connect(type: ShareTargetType, id: string) {
    disconnect();
    active = { type, id };
    void run();
  }
  function disconnect() {
    active = null;
    controller?.abort();
    controller = null;
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  async function run() {
    const target = active;
    if (!target) return;
    const abort = new AbortController();
    controller = abort;
    try {
      const query = new URLSearchParams({ targetType: target.type, targetId: target.id });
      const response = await fetch(`${API_BASE_URL}/shares/events?${query}`, {
        headers: { Accept: 'text/event-stream', ...authHeaders() },
        signal: abort.signal
      });
      if (!response.ok || !response.body) throw new Error('Target events unavailable.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const frame = parseSseFrame(part);
          if (frame && frame.event !== 'ping' && frame.event !== 'connected')
            onEvent(frame.event, JSON.parse(frame.data) as Record<string, unknown>);
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) console.warn(error);
    } finally {
      if (controller === abort) controller = null;
      if (active && active.type === target.type && active.id === target.id)
        reconnectTimer = window.setTimeout(run, 1500);
    }
  }
  onUnmounted(disconnect);
  return { connect, disconnect };
}
