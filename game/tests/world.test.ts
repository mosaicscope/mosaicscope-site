import { describe, it, expect } from "vitest";
import { generateWorld, reachableMask } from "../src/world/WorldGenerator";
import { Navigation } from "../src/world/Navigation";
import { World, T, SOLID } from "../src/world/World";

describe("world generator", () => {
  for (const seed of [1, 7, 20251012, 99999]) {
    it(`seed ${seed}: every walkable tile and every POI is reachable from the plaza`, () => {
      const w = generateWorld({ size: 64, seed });
      const seen = reachableMask(w);
      for (let i = 0; i < w.tiles.length; i++) if (!SOLID.has(w.tiles[i])) expect(seen[i]).toBe(1);
      for (const p of w.pois) {
        if (p.kind === "fountain" || p.kind === "door") continue;
        const tx = Math.floor(p.x), ty = Math.floor(p.y);
        expect(seen[ty * 64 + tx], `${p.kind} at ${tx},${ty}`).toBe(1);
      }
      for (const a of w.areas) expect(w.randomPointIn(a, { range: (lo: number, hi: number) => (lo + hi) / 2 } as any)).toBeTruthy();
    });
  }
  it("is deterministic for a seed and differs between seeds", () => {
    const a = generateWorld({ size: 64, seed: 5 }), b = generateWorld({ size: 64, seed: 5 }), c = generateWorld({ size: 64, seed: 6 });
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
  });
  it("has all the districts", () => {
    const w = generateWorld({ size: 64, seed: 3 });
    for (const k of ["plaza", "park", "court", "studio", "stage", "market", "playground", "alley", "street"]) expect(w.areas.some((a) => a.kind === k)).toBe(true);
  });
});

describe("navigation", () => {
  const w = generateWorld({ size: 64, seed: 11 });
  const nav = new Navigation(w, 5000);
  it("finds walkable paths between every district", () => {
    const plaza = w.areas.find((a) => a.kind === "plaza")!;
    const from = w.nearestWalkable(plaza.cx, plaza.cy);
    for (const a of w.areas) {
      if (a.kind === "street") continue;
      const to = w.nearestWalkable(a.cx, a.cy);
      const p = nav.findPath(from.x, from.y, to.x, to.y);
      expect(p, a.name).not.toBeNull();
      for (let i = 0; i < p!.length; i += 2) expect(w.walkable(p![i], p![i + 1])).toBe(true);
      expect(Math.hypot(p![p!.length - 2] - to.x, p![p!.length - 1] - to.y)).toBeLessThan(1.5);
    }
  });
  it("routes around obstacles and fails cleanly when sealed off", () => {
    const tw = new World(10);
    tw.areas.push({ id: 0, name: "t", kind: "plaza", x0: 0, y0: 0, x1: 9, y1: 9, cx: 5, cy: 5 });
    for (let y = 0; y < 9; y++) tw.set(5, y, T.WALL); // wall with a gap at y=9
    const n = new Navigation(tw);
    const p = n.findPath(1.5, 1.5, 8.5, 1.5);
    expect(p).not.toBeNull();
    let maxY = 0; for (let i = 1; i < p!.length; i += 2) maxY = Math.max(maxY, p![i]);
    expect(maxY).toBeGreaterThan(8); // had to go round through the gap
    tw.set(5, 9, T.WALL);
    expect(n.findPath(1.5, 1.5, 8.5, 1.5)).toBeNull();
  });
  it("queues requests and processes a bounded number per tick", () => {
    let done = 0;
    for (let i = 0; i < 10; i++) nav.request(30, 30, 10 + i, 30, () => done++);
    nav.process(4);
    expect(done).toBe(4); expect(nav.queueLength).toBe(6);
    nav.process(100); expect(done).toBe(10);
  });
  it("line of sight is blocked by walls but not fences", () => {
    const tw = new World(8);
    tw.set(4, 4, T.WALL);
    expect(tw.lineOfSight(1.5, 4.5, 6.5, 4.5)).toBe(false);
    tw.set(4, 4, T.FENCE);
    expect(tw.lineOfSight(1.5, 4.5, 6.5, 4.5)).toBe(true);
  });
});
