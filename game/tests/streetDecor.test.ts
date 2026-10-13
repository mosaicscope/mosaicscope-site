import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import { decorGrid, D } from "../src/render/StreetDecor";
import { T } from "../src/world/World";

describe("street decor", () => {
  const w = small().world, g = decorGrid(w);
  it("is deterministic and cached per world", () => {
    expect(decorGrid(w)).toBe(g);
    expect(Array.from(decorGrid(small().world))).toEqual(Array.from(g));
  });
  it("only dresses footpaths, and leaves doors, crossings and points of interest clear", () => {
    let trees = 0, total = 0;
    for (let i = 0; i < g.length; i++) {
      if (!g[i]) continue;
      total++; if (g[i] === D.TREE) trees++;
      expect(w.tiles[i]).toBe(T.SIDEWALK);
    }
    for (const p of w.pois) expect(g[Math.floor(p.y) * w.size + Math.floor(p.x)]).toBe(0);
    expect(trees).toBeGreaterThan(50);
    expect(total / (w.size * w.size)).toBeLessThan(0.08); // calm: a lot of small things, not a forest
  });
});
