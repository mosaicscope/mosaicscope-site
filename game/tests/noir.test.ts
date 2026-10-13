import { describe, it, expect } from "vitest";
import { NOIR, SHOP_NAMES, shade, muted, hash01, pickOf } from "../src/render/noir";

const HEX = /^#[0-9a-f]{6}$/;
const all = (o: unknown): string[] => (typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(all) : o && typeof o === "object" ? Object.values(o).flatMap(all) : []);

describe("noir palette", () => {
  it("is all valid hex and never pure black or pure white", () => {
    for (const c of all(NOIR)) { expect(c).toMatch(HEX); expect(c).not.toBe("#000000"); expect(c).not.toBe("#ffffff"); }
  });
  it("shade darkens and lightens, staying valid", () => {
    expect(shade("#808080", 0.5)).toMatch(HEX);
    const dark = parseInt(shade("#808080", 0.5).slice(1, 3), 16), lite = parseInt(shade("#808080", 1.3).slice(1, 3), 16);
    expect(dark).toBeLessThan(128); expect(lite).toBeGreaterThan(128);
  });
  it("muted pulls a neon colour toward the dusk", () => {
    const m = muted("#3dd6ff"); expect(m).toMatch(HEX);
    const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    expect(Math.max(ch(m, 0), ch(m, 1), ch(m, 2))).toBeLessThan(0xe0);
  });
  it("is deterministic", () => {
    expect(hash01(42)).toBe(hash01(42)); expect(pickOf(SHOP_NAMES, 7)).toBe(pickOf(SHOP_NAMES, 7));
    for (let i = 0; i < 50; i++) { const h = hash01(i); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
  });
  it("shop names are original and short enough to fit a sign", () => {
    for (const n of SHOP_NAMES) expect(n.length).toBeLessThanOrEqual(15);
  });
});
