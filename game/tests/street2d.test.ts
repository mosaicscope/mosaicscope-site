import { describe, it, expect } from "vitest";
import { StreetCast, BAND_OUT, BAND_FULL } from "../src/render/Street2D";
import type { CastChar } from "../src/render/Street2D";

const W = 900, S = 40, K = 1;
const mk = (id: number, x: number, y: number): CastChar => ({ id, x, y, inside: -1, inCar: -1 });

describe("2D street view cast", () => {
  it("regression: someone strolling across the street stays visible instead of popping out of the old +/-1.6 band", () => {
    const cast = new StreetCast(), me = mk(0, 30, 30);
    for (const dv of [0.5, 1.5, 1.7, 2.4, 3.2, 4.2]) {
      const them = mk(1, 30 + dv / 2 + 1, 30 + dv / 2 - 1);
      const slots = cast.pick([me, them], me, W, S, K, 0.016, 10);
      const s = slots.find((q) => q.id === 1);
      expect(s, `dv=${dv}`).toBeTruthy();
      expect(s!.alpha).toBeGreaterThan(0);
    }
  });

  it("fades smoothly at the edge of the band and drops only beyond it", () => {
    const cast = new StreetCast(), me = mk(0, 30, 30);
    const at = (dv: number) => cast.pick([me, mk(1, 30 + dv / 2, 30 + dv / 2)], me, W, S, K, 0.016, 10).find((q) => q.id === 1)?.alpha;
    expect(at(BAND_FULL - 0.1)).toBe(1);
    const mid = at((BAND_FULL + BAND_OUT) / 2)!;
    expect(mid).toBeGreaterThan(0.1); expect(mid).toBeLessThan(1);
    expect(at(BAND_OUT + 0.5)).toBeUndefined();
  });

  it("always shows the person you are following, even when mobbed or in a car", () => {
    const cast = new StreetCast(), me = { ...mk(0, 30, 30), inCar: 3 };
    const crowd = Array.from({ length: 40 }, (_, i) => mk(i + 1, 30 + (i % 7) * 0.1, 30 + (i % 5) * 0.1));
    const slots = cast.pick([me, ...crowd], me, W, S, K, 0.016, 8);
    expect(slots.length).toBe(8);
    expect(slots.some((s) => s.id === 0)).toBe(true);
  });

  it("people already on screen are not swapped out by a near-tie for the last slot", () => {
    const cast = new StreetCast(), me = mk(0, 30, 30);
    const a = mk(1, 31, 30), b = mk(2, 30, 31.2);   // b slightly farther
    let first = cast.pick([me, a, b], me, W, S, K, 0.016, 2).map((s) => s.id).sort();
    expect(first).toEqual([0, 1]);
    // now b edges closer than a; a keeps the slot because it was already shown
    b.x = 30; b.y = 31.0; a.x = 31.2; a.y = 30;
    for (let i = 0; i < 20; i++) first = cast.pick([me, a, b], me, W, S, K, 0.016, 2).map((s) => s.id).sort();
    expect(first).toEqual([0, 1]);
  });

  it("never lets two people overlap and never teleports them between frames", () => {
    const cast = new StreetCast(), me = mk(0, 30, 30);
    const chars = [me, ...Array.from({ length: 6 }, (_, i) => mk(i + 1, 30 + i * 0.02, 30 - i * 0.02))];
    let last = new Map<number, number>();
    for (let f = 0; f < 120; f++) {
      if (f < 60) { chars[3].x += 0.01; chars[3].y -= 0.01; }
      const slots = cast.pick(chars, me, W, S, K, 1 / 60, 10);
      const xs = slots.map((s) => s.x).sort((a, b) => a - b);
      if (f > 100) for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(50);
      if (f > 40) for (const s of slots) if (last.has(s.id)) expect(Math.abs(s.x - last.get(s.id)!)).toBeLessThan(40);
      last = new Map(slots.map((s) => [s.id, s.x]));
    }
  });

  it("skips people indoors or in cars, but only them", () => {
    const cast = new StreetCast(), me = mk(0, 30, 30);
    const ins = { ...mk(1, 30.5, 30), inside: 4 }, car = { ...mk(2, 30.5, 30), inCar: 1 }, ok = mk(3, 30.5, 30);
    expect(cast.pick([me, ins, car, ok], me, W, S, K, 0.016, 10).map((s) => s.id).sort()).toEqual([0, 3]);
  });
});
