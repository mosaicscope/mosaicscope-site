import { describe, it, expect } from "vitest";
import { small } from "./helpers";
import { Camera } from "../src/render/Camera";
import { NightFX, h2, nightness, fogDensity, moodHue, beatPulse } from "../src/render/NightFX";

describe("night weather look", () => {
  it("rain does not paint mood-coloured discs over roads", () => {
    const sim = small(), cam = new Camera(), styles: unknown[] = [];
    sim.world.tiles.fill(1); sim.env.rain = 1; sim.env.power = false; sim.env.startHour = 0;
    const g = new Proxy({}, {
      get: (_t, k) => k === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {},
      set: (_t, k, v) => { if(k === 'fillStyle') styles.push(v); return true; },
    }) as unknown as CanvasRenderingContext2D;
    const fx = new NightFX();
    for(const mood of [-1,0,1]) {sim.player.emo.mood = mood; fx.draw(g,sim,cam,1,2,false,0,10,0,10);}
    expect(styles.some(s => typeof s === 'string' && s.startsWith('hsla('))).toBe(false);
  });
  it("hash is deterministic and in range", () => {
    for (let i = 0; i < 200; i++) { const v = h2(i, i * 3); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); expect(h2(i, i * 3)).toBe(v); }
  });
  it("night ramps from none by day to full in the dark", () => {
    expect(nightness(1)).toBe(0); expect(nightness(0)).toBe(1);
    expect(nightness(0.4)).toBeGreaterThan(0); expect(nightness(0.4)).toBeLessThan(1);
  });
  it("fog only comes at night, and only on some nights", () => {
    let foggy = 0;
    for (let d = 0; d < 300; d++) { expect(fogDensity(d, 0)).toBe(0); const f = fogDensity(d, 1); expect(f).toBeLessThanOrEqual(1); if (f > 0) foggy++; }
    expect(foggy).toBeGreaterThan(40); expect(foggy).toBeLessThan(180);
  });
  it("mood maps to a hue that differs between sad and happy", () => {
    expect(moodHue(-1)).not.toBe(moodHue(1));
    for (const m of [-5, -1, 0, 1, 5]) { const h = moodHue(m); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(360); }
  });
  it("beat pulse stays within 0..1", () => {
    for (let t = 0; t < 10; t += 0.07) { const p = beatPulse(t); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
  });

  it("draws a rainy foggy night on every quality tier without throwing", () => {
    const sim = small(), cam = new Camera();
    const g = new Proxy({}, { get: (_t, k) => (k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}), set: () => true }) as unknown as CanvasRenderingContext2D;
    sim.env.rain = 1; sim.env.raining = true; sim.env.startHour = 1;
    const S = sim.world.size, fx = new NightFX();
    for (const q of [0, 1, 2, 3]) for (const rm of [false, true]) {
      for (let day = 0; day < 6; day++) { sim.tick = day * 24 * 3600 * 0 + day * 86400; fx.draw(g, sim, cam, 12.5 + day, q, rm, 0, S - 1, 0, S - 1); }
    }
  });
});
