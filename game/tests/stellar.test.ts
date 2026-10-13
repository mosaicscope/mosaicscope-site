import { describe, expect, it } from "vitest";
import { StarField } from "../src/render/Stars";
import { nightness } from "../src/render/NightFX";

/** A minimal stand-in for the sim: just the event bus the star field listens to. */
function fakeSim(daylight = 0) {
  const handlers: Array<(e: { type: string }) => void> = [];
  return {
    sim: { bus: { on: (_: string, fn: (e: { type: string }) => void) => handlers.push(fn) }, daylight } as any,
    emit: (type: string) => handlers.forEach((h) => h({ type })),
  };
}

/** A context that counts drawing calls, so the tests can tell whether anything was drawn. */
function fakeCtx() {
  let calls = 0;
  const noop = () => {};
  const ctx: any = new Proxy({}, {
    get: (t: any, k: string) => (k in t ? t[k] : (typeof k === "string" && /^(fill|stroke|arc|move|line|begin|close|save|restore|create)/.test(k) ? (() => { calls++; return { addColorStop: noop }; }) : (t[k] = undefined, undefined))),
    set: (t: any, k: string, v: any) => { t[k] = v; return true; },
  });
  return { ctx, count: () => calls };
}

const cam: any = { viewW: 800, viewH: 600, zoom: 1, toScreen: (_x: number, _y: number, _z: number, out: { x: number; y: number }) => { out.x = 0; out.y = 0; } };

describe("StarField", () => {
  it("lays out the same stars every time (no randomness across visits or saves)", () => {
    const a = new StarField(fakeSim().sim);
    const b = new StarField(fakeSim().sim);
    expect(a.stars.length).toBeGreaterThan(100);
    expect(a.stars.slice(0, 5)).toEqual(b.stars.slice(0, 5));
    for (const s of a.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThan(1);
    }
  });

  it("draws nothing in daylight or on the lowest quality tier", () => {
    const f = new StarField(fakeSim(1).sim);
    const day = fakeCtx();
    f.drawSky(day.ctx, cam, { daylight: 1 } as any, 1, 0.016, 3, false);
    expect(day.count()).toBe(0);
    const low = fakeCtx();
    f.drawSky(low.ctx, cam, { daylight: 0 } as any, 1, 0.016, 0, false);
    expect(low.count()).toBe(0);
  });

  it("draws the sky at night", () => {
    const f = new StarField(fakeSim().sim);
    const night = fakeCtx();
    f.drawSky(night.ctx, cam, { daylight: 0 } as any, 1, 0.016, 2, false);
    expect(night.count()).toBeGreaterThan(50);
    expect(nightness(0)).toBe(1);
  });

  it("starts a shooting star when the sim fires rare_meteor", () => {
    const { sim, emit } = fakeSim();
    const f = new StarField(sim);
    const meteors = () => (f as any).meteors.length as number;
    expect(meteors()).toBe(0);
    emit("rare_meteor");
    expect(meteors()).toBe(1);
    emit("party");
    expect(meteors()).toBe(1);
  });

  it("caps the number of shooting stars on screen at once", () => {
    const f = new StarField(fakeSim().sim);
    for (let i = 0; i < 10; i++) f.streak();
    expect((f as any).meteors.length).toBeLessThanOrEqual(3);
  });
});
