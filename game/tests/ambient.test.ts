import { describe, it, expect } from "vitest";
import { wind, sway, windowOn } from "../src/render/Ambient";

describe("ambient wind", () => {
  it("is one shared value, bounded and smooth", () => {
    let prev = sway(0, 0.3);
    for (let t = 0.05; t < 600; t += 0.05) {
      const w = wind(t), s = sway(t, 0.3);
      expect(w.gust).toBeGreaterThanOrEqual(0.35); expect(w.gust).toBeLessThanOrEqual(1);
      expect(Math.abs(w.lean)).toBeLessThanOrEqual(1);
      expect(Math.abs(s)).toBeLessThan(1.6);
      expect(Math.abs(s - prev)).toBeLessThan(0.15); // no jerks
      prev = s;
    }
  });
  it("things lean the same way as the wind, but not in step", () => {
    let differ = 0;
    for (let i = 0; i < 50; i++) if (Math.abs(sway(12.3, i / 50) - sway(12.3, 0)) > 0.05) differ++;
    expect(differ).toBeGreaterThan(40);
  });
  it("heavier things sway less", () => { expect(Math.abs(sway(7, 0.2, 2))).toBeCloseTo(Math.abs(sway(7, 0.2, 1)) / 2, 6); });
});

describe("window life", () => {
  const frac = (h: number) => { let n = 0; for (let i = 0; i < 4000; i++) if (windowOn(i * 7 + 3, h)) n++; return n / 4000; };
  it("is deterministic", () => { for (let i = 0; i < 200; i++) expect(windowOn(i, 21.3)).toBe(windowOn(i, 21.3)); });
  it("fills up through the evening and thins out into the small hours", () => {
    expect(frac(17)).toBe(0);
    expect(frac(18.5)).toBeGreaterThan(0.2); expect(frac(18.5)).toBeLessThan(0.7);
    expect(frac(21.5)).toBe(1);
    expect(frac(23)).toBeLessThan(0.95);
    expect(frac(1)).toBeLessThan(frac(23));
    expect(frac(3.5)).toBeGreaterThan(0); expect(frac(3.5)).toBeLessThan(0.25);
    expect(frac(4.9)).toBeLessThan(0.1);
  });
  it("a few early risers light up before work", () => { expect(frac(7)).toBeGreaterThan(0.05); expect(frac(7)).toBeLessThan(0.3); expect(frac(9)).toBe(0); });
  it("every household has its own hours", () => {
    const at = (h: number) => Array.from({ length: 60 }, (_, i) => windowOn(i, h));
    expect(new Set(at(19)).size).toBe(2); expect(new Set(at(23.5)).size).toBe(2);
  });
});
