import { describe, it, expect } from "vitest";
import { worldToScreen, screenToWorld } from "../src/world/iso";
import { SimulationClock } from "../src/core/clock";
import { Rng } from "../src/core/rng";
import { SpatialHash } from "../src/world/SpatialHash";
import { EventBus } from "../src/core/eventBus";

describe("isometric transforms", () => {
  it("round-trips ground points", () => {
    for (const [x, y] of [[0, 0], [3.5, 7.25], [63, 1], [12.1, 40.9]]) {
      const s = worldToScreen(x, y);
      const w = screenToWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(x, 6); expect(w.y).toBeCloseTo(y, 6);
    }
  });
  it("puts +x to screen right/down and height up", () => {
    const a = worldToScreen(0, 0), b = worldToScreen(1, 0), c = worldToScreen(0, 0, 1);
    expect(b.x).toBeGreaterThan(a.x); expect(b.y).toBeGreaterThan(a.y); expect(c.y).toBeLessThan(a.y);
  });
});

describe("fixed-step clock", () => {
  it("accumulates real time into whole steps", () => {
    const c = new SimulationClock({ step: 0.01 });
    expect(c.advance(0.025)).toBe(2);
    expect(c.alpha).toBeCloseTo(0.5, 5);
    expect(c.advance(0.005)).toBe(1);
  });
  it("respects pause and speed, and caps steps per frame", () => {
    const c = new SimulationClock({ step: 0.01, maxStepsPerFrame: 4 });
    c.paused = true; expect(c.advance(1)).toBe(0);
    c.paused = false; c.speed = 2; expect(c.advance(0.02)).toBe(4);
    expect(c.advance(0.2)).toBe(4); // capped, time dropped
    expect(c.droppedSeconds).toBeGreaterThan(0);
  });
});

describe("seeded rng", () => {
  it("is deterministic and restorable", () => {
    const a = new Rng(42), b = new Rng(42);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()));
    const st = a.getState(); const n1 = a.next(); a.setState(st); expect(a.next()).toBe(n1);
    expect(new Rng("tiles").next()).toBe(new Rng("tiles").next());
  });
  it("weighted picks respect zero weights", () => {
    const r = new Rng(1);
    for (let i = 0; i < 100; i++) expect(r.weighted([0, 1, 0])).toBe(1);
    expect(r.weighted([0, 0])).toBe(-1);
  });
});

describe("spatial hash", () => {
  it("matches brute force radius queries", () => {
    const r = new Rng(9), h = new SpatialHash(64, 64, 2, 8);
    const pts = Array.from({ length: 400 }, () => [r.range(0, 64), r.range(0, 64)]);
    pts.forEach(([x, y], i) => h.insert(i, x, y));
    const out: number[] = [];
    for (let q = 0; q < 30; q++) {
      const qx = r.range(0, 64), qy = r.range(0, 64), rad = r.range(0.5, 6);
      h.query(qx, qy, rad, out);
      const brute = pts.map(([x, y], i) => ((x - qx) ** 2 + (y - qy) ** 2 <= rad * rad ? i : -1)).filter((i) => i >= 0);
      expect(out.slice().sort((a, b) => a - b)).toEqual(brute);
    }
  });
});

describe("event bus", () => {
  it("delivers and unsubscribes", () => {
    const bus = new EventBus<{ a: number }>();
    let got = 0;
    const off = bus.on("a", (n) => { got += n; });
    bus.emit("a", 2); off(); bus.emit("a", 5);
    expect(got).toBe(2); expect(bus.listenerCount()).toBe(0);
  });
});
