import { describe, it, expect } from "vitest";
import { isResident, residentTraits, RESIDENT_SHARE, drawResident } from "../src/render/Residents";
import type { Character } from "../src/entities/types";

const mk = (id: number, over: Record<string, unknown> = {}, look: Record<string, unknown> = {}): Character =>
  ({ id, mode: "idle", look: { kind: "guy", color: "#3dd6ff", accent: "#ff7ad9", scale: 1, ...look }, ...over }) as unknown as Character;

describe("residents", () => {
  it("never makes the player, the Mosaics or glam people a resident", () => {
    for (let i = 0; i < 300; i++) {
      expect(isResident(mk(-1))).toBe(false);
      expect(isResident(mk(i, { mode: "player" }))).toBe(false);
      expect(isResident(mk(i, {}, { main: true }))).toBe(false);
      expect(isResident(mk(i, {}, { glam: true }))).toBe(false);
    }
  });
  it("is deterministic and close to the intended share", () => {
    let n = 0; const N = 2000;
    for (let i = 0; i < N; i++) { const a = isResident(mk(i)), b = isResident(mk(i)); expect(a).toBe(b); if (a) n++; }
    expect(Math.abs(n / N - RESIDENT_SHARE)).toBeLessThan(0.06);
  });
  it("traits are deterministic and in range", () => {
    for (let i = 0; i < 200; i++) {
      const t = residentTraits(i); expect(residentTraits(i)).toEqual(t);
      expect(t.belly).toBeGreaterThanOrEqual(0.85); expect(t.belly).toBeLessThan(1.3);
      expect(t.lids).toBeGreaterThanOrEqual(0.45); expect(t.lids).toBeLessThan(0.9);
    }
  });
  it("draws without throwing for both facings, with and without the HD pass", () => {
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => { calls.push(String(k)); }), set: () => true }) as unknown as CanvasRenderingContext2D;
    const J = new Float32Array(24).map((_, i) => 100 + i * 3);
    for (const dir of [1, -1]) for (const hd of [true, false]) drawResident(g, J, mk(7), 2, dir, 1, hd, false, 3);
    expect(calls.length).toBeGreaterThan(50);
  });
});
