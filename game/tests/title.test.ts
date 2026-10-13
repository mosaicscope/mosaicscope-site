import { describe, it, expect } from "vitest";
import { skylineFrom, skylinePath } from "../src/ui/Title";
import { Simulation } from "../src/sim/Simulation";

describe("neon skyline title", () => {
  it("is empty for an empty city and never throws", () => {
    expect(skylineFrom([])).toEqual([]);
    expect(skylinePath([])).toEqual([[0, 0], [1, 0]]);
  });

  it("keeps the tallest building of each column, normalised to 0..1", () => {
    const b = (x0: number, x1: number, height: number) => ({ x0, x1, floors: 3, height, sign: "#fff", name: "b" });
    const s = skylineFrom([b(0, 3, 2), b(1, 2, 9), b(50, 53, 4)], 4);
    expect(s.find((q) => q.h === 1)).toBeTruthy();
    expect(s.every((q) => q.h > 0 && q.h <= 1)).toBe(true);
  });

  it("the real city makes a stable, left-to-right outline", () => {
    const sim = new Simulation({ backgroundCount: 0 });
    const s = skylineFrom(sim.world.buildings);
    expect(s.length).toBeGreaterThan(8);
    for (let i = 1; i < s.length; i++) expect(s[i].x).toBeGreaterThan(s[i - 1].x);
    const p = skylinePath(s);
    expect(p[0][0]).toBe(0); expect(p[p.length - 1][0]).toBe(1);
    expect(p.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
    expect(JSON.stringify(skylineFrom(new Simulation({ backgroundCount: 0 }).world.buildings))).toBe(JSON.stringify(s));
  });
});
