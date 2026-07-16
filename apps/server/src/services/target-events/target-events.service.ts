import { Injectable } from '@nestjs/common';

export type TargetType = 'conversation' | 'companion';
export type TargetEvent = { event: string; data: Record<string, unknown> };
type Listener = (event: TargetEvent) => void;

/** 单实例目标级事件发布器。SQLite 仍是事实源，事件仅用于提示客户端重新同步。 */
@Injectable()
export class TargetEventsService {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(targetType: TargetType, targetId: string, listener: Listener): () => void {
    const key = this.key(targetType, targetId);
    const set = this.listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(key, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  emit(
    targetType: TargetType,
    targetId: string,
    event: string,
    data: Record<string, unknown> = {}
  ) {
    for (const listener of this.listeners.get(this.key(targetType, targetId)) ?? []) {
      listener({ event, data });
    }
  }

  private key(targetType: TargetType, targetId: string) {
    return `${targetType}:${targetId}`;
  }
}
