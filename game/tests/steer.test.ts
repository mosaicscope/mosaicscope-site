import { describe, it, expect } from "vitest";
import { screenToWorldDir, easeVelocity } from "../src/app/steer";
import { worldToScreen } from "../src/world/iso";

describe("walking controls", () => {
  it("moves exactly where the player presses on screen", () => {
    for (const [ix, iy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, 1]]) {
      const w = screenToWorldDir(ix, iy), s = worldToScreen(w.x, w.y);
      expect(Math.sign(Math.round(s.x * 100) / 100)).toBe(Math.sign(ix));
      expect(Math.sign(Math.round(s.y * 100) / 100)).toBe(Math.sign(iy));
      expect(Math.hypot(w.x, w.y)).toBeCloseTo(1, 5);
    }
  });
  it("up goes away from the camera (x+y shrinks)", () => {
    const w = screenToWorldDir(0, -1);
    expect(w.x + w.y).toBeLessThan(0);
  });
  it("analog sticks scale speed and zero is zero", () => {
    const a = screenToWorldDir(0.4, 0);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(0.4, 5);
    expect(screenToWorldDir(0, 0)).toEqual({ x: 0, y: 0 });
  });
  it("accelerates smoothly and brakes to a full stop", () => {
    const v = { x: 0, y: 0 };
    easeVelocity(v, 1.6, 0, 1 / 60);
    expect(v.x).toBeGreaterThan(0); expect(v.x).toBeLessThan(0.8);
    for (let i = 0; i < 40; i++) easeVelocity(v, 1.6, 0, 1 / 60);
    expect(v.x).toBeGreaterThan(1.55);
    for (let i = 0; i < 90; i++) easeVelocity(v, 0, 0, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});
