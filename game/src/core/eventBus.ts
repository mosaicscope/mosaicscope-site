/**
 * Typed pub/sub for immediate, synchronous notifications (UI, audio, particles).
 * World events with causality and budgets live in events/WorldEvents.ts; this bus is just plumbing.
 * Listeners are returned as disposers so nothing leaks.
 */
export type Listener<T> = (payload: T) => void;

export class EventBus<M extends { [K in keyof M]: unknown }> {
  private map = new Map<keyof M, Set<Listener<any>>>();

  on<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    let set = this.map.get(type);
    if (!set) { set = new Set(); this.map.set(type, set); }
    set.add(fn);
    return () => { set!.delete(fn); };
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  listenerCount(type?: keyof M): number {
    if (type) return this.map.get(type)?.size ?? 0;
    let n = 0;
    for (const s of this.map.values()) n += s.size;
    return n;
  }
}
