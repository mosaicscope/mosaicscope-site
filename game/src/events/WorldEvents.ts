/**
 * Event queue for emergent world events: priority, dedupe, cooldowns, causal-depth limits and a
 * per-tick budget. Events are produced by simulation rules (physics hits, AI decisions, weather) and
 * consumed by handlers that change world state and may emit follow-up events. Depth and dedupe keep
 * chains finite; the queue cap provides backpressure.
 */
export type Severity = 1 | 2 | 3 | 4 | 5;

export interface WorldEvent {
  id: number;
  type: string;
  tick: number;
  x: number; y: number;
  radius: number;          // affected area (tiles)
  priority: number;        // higher first
  severity: Severity;
  actors: number[];        // participating entity ids (actor first)
  toy: string | null;
  cause: number;           // parent event id or -1
  depth: number;           // causal depth
  data: Record<string, number | string>;
  resolved: boolean;
  summary: string;
}

export interface EventDef {
  type: string;
  label: string;
  /** Base priority/severity; emitters may override. */
  priority: number;
  severity: Severity;
  radius: number;
  /** Min ticks between events of this type with the same dedupe key. */
  cooldown: number;
  /** How the dedupe key is formed (default: type + rounded position + first actor). */
  key?: (e: WorldEvent) => string;
  /** Who perceives it: "sight" needs LOS, "sound" is radius-only, "global" everyone. */
  propagation: "sight" | "sound" | "global";
  /** Dialogue topic hook. */
  topic?: string;
}

export interface EmitSpec {
  type: string; x: number; y: number; actors?: number[]; toy?: string | null; cause?: WorldEvent | null;
  priority?: number; severity?: Severity; radius?: number; data?: Record<string, number | string>; summary?: string;
}

export type EventHandler = (e: WorldEvent) => void;

export class WorldEventSystem {
  readonly defs = new Map<string, EventDef>();
  private queue: WorldEvent[] = [];
  private handlers = new Map<string, EventHandler[]>();
  private anyHandlers: EventHandler[] = [];
  private lastByKey = new Map<string, number>();
  history: WorldEvent[] = [];
  historyMax = 400;
  private nextId = 1;
  /** metrics */
  dropped = 0; deduped = 0; tooDeep = 0; processedThisTick = 0;
  counts: Record<string, number> = {};

  constructor(public perTick = 12, public cap = 256, public maxDepth = 5) {}

  register(def: EventDef): void { this.defs.set(def.type, def); }
  on(type: string, fn: EventHandler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn); this.handlers.set(type, list);
    return () => { const l = this.handlers.get(type); if (l) l.splice(l.indexOf(fn), 1); };
  }
  onAny(fn: EventHandler): () => void { this.anyHandlers.push(fn); return () => { this.anyHandlers.splice(this.anyHandlers.indexOf(fn), 1); }; }

  get depthOfQueue(): number { return this.queue.length; }

  /** Queue an event. Returns it, or null when rejected (unknown, deduped, too deep). */
  emit(spec: EmitSpec, tick: number): WorldEvent | null {
    const def = this.defs.get(spec.type);
    if (!def) throw new Error("Unregistered event type: " + spec.type);
    const depth = spec.cause ? spec.cause.depth + 1 : 0;
    if (depth > this.maxDepth) { this.tooDeep++; return null; }
    const e: WorldEvent = {
      id: this.nextId++, type: spec.type, tick, x: spec.x, y: spec.y,
      radius: spec.radius ?? def.radius, priority: spec.priority ?? def.priority, severity: spec.severity ?? def.severity,
      actors: spec.actors ?? [], toy: spec.toy ?? null, cause: spec.cause ? spec.cause.id : -1, depth,
      data: spec.data ?? {}, resolved: false, summary: spec.summary ?? def.label,
    };
    const key = def.key ? def.key(e) : `${e.type}:${Math.round(e.x / 4)}:${Math.round(e.y / 4)}:${e.actors[0] ?? -1}`;
    const last = this.lastByKey.get(key);
    if (last !== undefined && tick - last < def.cooldown) { this.deduped++; return null; }
    this.lastByKey.set(key, tick);
    if (this.queue.length >= this.cap) {
      // backpressure: drop the lowest-priority item (possibly this one)
      let lo = 0;
      for (let i = 1; i < this.queue.length; i++) if (this.queue[i].priority < this.queue[lo].priority) lo = i;
      if (this.queue[lo].priority >= e.priority) { this.dropped++; return null; }
      this.queue.splice(lo, 1); this.dropped++;
    }
    this.queue.push(e);
    return e;
  }

  /** Process up to perTick events, highest priority first (stable by id). */
  process(tick: number): number {
    this.processedThisTick = 0;
    if (!this.queue.length) return 0;
    this.queue.sort((a, b) => b.priority - a.priority || a.id - b.id);
    const batch = this.queue.splice(0, this.perTick);
    for (const e of batch) {
      this.processedThisTick++;
      this.counts[e.type] = (this.counts[e.type] ?? 0) + 1;
      this.history.push(e);
      if (this.history.length > this.historyMax) this.history.splice(0, this.history.length - this.historyMax);
      const hs = this.handlers.get(e.type);
      if (hs) for (const h of hs.slice()) h(e);
      for (const h of this.anyHandlers.slice()) h(e);
    }
    // forget old dedupe keys so the map stays small
    if (tick % 600 === 0) for (const [k, t] of this.lastByKey) if (tick - t > 3600) this.lastByKey.delete(k);
    return batch.length;
  }

  find(id: number): WorldEvent | undefined {
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i].id === id) return this.history[i];
    return this.queue.find((e) => e.id === id);
  }

  /** Walk causes back to the root, for the event log's "because..." chain. */
  chain(e: WorldEvent): WorldEvent[] {
    const out = [e];
    let cur = e;
    for (let i = 0; i < 10 && cur.cause >= 0; i++) { const p = this.find(cur.cause); if (!p) break; out.push(p); cur = p; }
    return out;
  }

  serialize() { return { nextId: this.nextId, history: this.history.slice(-120), counts: this.counts }; }
  restore(s: { nextId: number; history: WorldEvent[]; counts: Record<string, number> }): void {
    this.nextId = s.nextId; this.history = s.history; this.counts = s.counts ?? {}; this.queue = []; this.lastByKey.clear();
  }
}
