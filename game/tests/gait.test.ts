import { describe, it, expect } from "vitest";
import { gaitOf, pose, applyGait, solve, J } from "../src/render/StickFigure";

describe("personal gait", () => {
  it("gives different people different ways of moving", () => {
    const sigs = new Set<string>();
    for (let id = 0; id < 200; id++) sigs.add(JSON.stringify(gaitOf(id)));
    expect(sigs.size).toBe(200);
  });
  it("keeps each gait within sensible ranges", () => {
    for (let id = 0; id < 200; id++) {
      const G = gaitOf(id);
      expect(G.cadence).toBeGreaterThanOrEqual(0.85); expect(G.cadence).toBeLessThanOrEqual(1.15);
      expect(G.stride).toBeGreaterThanOrEqual(0.8); expect(G.stride).toBeLessThanOrEqual(1.2);
    }
  });
  it("changes the walk so two people walking at the same moment do not match", () => {
    const pts = (id: number) => { const A = pose("walk", "loose", 1, 0.7, 2, 0); applyGait(A, gaitOf(id)); solve(A, 0, 0, 1, 1); return Array.from(J.slice(0, 8)).map((v) => v.toFixed(2)).join(","); };
    expect(pts(3)).not.toBe(pts(4));
  });
});
