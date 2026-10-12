import { describe, it, expect } from "vitest";
import { WorldEventSystem } from "../src/events/WorldEvents";

function sys(perTick = 3, cap = 5, depth = 3) {
  const s = new WorldEventSystem(perTick, cap, depth);
  s.register({ type: "a", label: "A", priority: 1, severity: 1, radius: 5, cooldown: 0, propagation: "sight" });
  s.register({ type: "b", label: "B", priority: 5, severity: 2, radius: 5, cooldown: 0, propagation: "sight" });
  s.register({ type: "c", label: "C", priority: 3, severity: 1, radius: 5, cooldown: 100, propagation: "sight", key: () => "c" });
  return s;
}

describe("world events", () => {
  it("processes highest priority first within a per-tick budget", () => {
    const s = sys(2);
    const order: string[] = [];
    s.onAny((e) => order.push(e.type));
    s.emit({ type: "a", x: 0, y: 0 }, 1); s.emit({ type: "b", x: 9, y: 9 }, 1); s.emit({ type: "a", x: 20, y: 20 }, 1);
    expect(s.process(1)).toBe(2);
    expect(order).toEqual(["b", "a"]);
    expect(s.depthOfQueue).toBe(1);
  });
  it("dedupes within the cooldown window", () => {
    const s = sys();
    expect(s.emit({ type: "c", x: 0, y: 0 }, 10)).not.toBeNull();
    expect(s.emit({ type: "c", x: 50, y: 50 }, 50)).toBeNull();
    expect(s.emit({ type: "c", x: 0, y: 0 }, 200)).not.toBeNull();
    expect(s.deduped).toBe(1);
  });
  it("limits causal depth so chains always end", () => {
    const s = sys(100, 1000, 3);
    let n = 0;
    // a handler that always causes another event: an infinite loop without protection
    s.on("a", (e) => { n++; s.emit({ type: "a", x: e.x + 10 * n, y: 0, cause: e }, 1); });
    s.emit({ type: "a", x: 0, y: 0 }, 1);
    for (let t = 0; t < 20; t++) s.process(t);
    expect(n).toBe(4); // depth 0..3
    expect(s.tooDeep).toBe(1);
  });
  it("applies backpressure when the queue is full", () => {
    const s = sys(1, 3);
    for (let i = 0; i < 3; i++) s.emit({ type: "a", x: i * 10, y: 0 }, 1);
    expect(s.emit({ type: "a", x: 99, y: 0 }, 1)).toBeNull(); // same priority, dropped
    expect(s.emit({ type: "b", x: 99, y: 0 }, 1)).not.toBeNull(); // higher priority evicts a low one
    expect(s.depthOfQueue).toBe(3);
    expect(s.dropped).toBe(2);
  });
  it("records history and causal chains", () => {
    const s = sys();
    const root = s.emit({ type: "b", x: 0, y: 0 }, 1)!;
    s.process(1);
    const child = s.emit({ type: "a", x: 1, y: 1, cause: root }, 2)!;
    s.process(2);
    expect(s.chain(child).map((e) => e.id)).toEqual([child.id, root.id]);
    expect(() => s.emit({ type: "nope", x: 0, y: 0 }, 1)).toThrow();
  });
});
