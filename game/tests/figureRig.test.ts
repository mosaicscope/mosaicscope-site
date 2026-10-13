import { describe, it, expect } from "vitest";
import { pose } from "../src/render/StickFigure";
import { smooth, sway } from "../src/render/FigureRig";

describe("figure rig", () => {
  it("snaps on first sight, then eases toward a new pose without snapping", () => {
    const key = {};
    const a0 = { ...pose("idle", "loose", 0, 0, 0, 0) };
    smooth(key, { ...a0 }, 1, "idle");
    const target = { ...pose("cheer", "loose", 1, 0, 0, 0) };
    const first = smooth(key, { ...target }, 1 + 1 / 60, "cheer").armL;
    expect(first).toBeGreaterThan(a0.armL);
    expect(first).toBeLessThan(target.armL - 0.3); // one frame later it is still on its way
    let v = first;
    for (let i = 2; i < 90; i++) v = smooth(key, { ...target }, 1 + i / 60, "cheer").armL;
    expect(Math.abs(v - target.armL)).toBeLessThan(0.35);
  });

  it("keeps every angle finite through a hitch, a paused clock and rapid pose changes", () => {
    const key = {};
    const names = ["walk", "run", "talk", "wave", "shrug", "startle", "down", "idle"];
    let t = 0;
    for (let i = 0; i < 400; i++) {
      t += i === 200 ? 5 : i % 7 === 0 ? 0.045 : 1 / 60;
      const n = names[i % names.length];
      const o = smooth(key, pose(n, "swagger", t, i * 0.4, 2.2, (i % 30) / 60), t, n) as unknown as Record<string, number>;
      for (const k of Object.keys(o)) expect(Number.isFinite(o[k])).toBe(true);
    }
  });

  it("scales arm swing with ground speed", () => {
    const slow = pose("walk", "loose", 0, 1.2, 0.6, 0).armR;
    const fast = pose("walk", "loose", 0, 1.2, 2.4, 0).armR;
    expect(Math.abs(fast)).toBeGreaterThan(Math.abs(slow));
  });

  it("hair sway leans against head motion and settles", () => {
    const key = {};
    sway(key, 0, 0, 1, 1, 0);
    let r = sway(key, 0, 0, 1, 1, 1 / 60);
    for (let i = 2; i < 30; i++) r = sway(key, i * 2, 0, 1, 1, i / 60);
    expect(r.sway).toBeLessThan(0);
    for (let i = 30; i < 200; i++) r = sway(key, 60, 0, 1, 1, i / 60);
    expect(Math.abs(r.sway)).toBeLessThan(0.02);
  });
});
