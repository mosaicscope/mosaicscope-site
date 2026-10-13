import { describe, it, expect } from "vitest";
import { storyOf, paintWindows, paintSpill, type Win } from "../src/render/NightGlow";

describe("night glow", () => {
  it("stories are deterministic and about a third of windows have one", () => {
    let withStory = 0; const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) { const a = storyOf(i); expect(storyOf(i)).toBe(a); if (a !== "none") { withStory++; seen.add(a); } }
    expect(withStory / 3000).toBeGreaterThan(0.25); expect(withStory / 3000).toBeLessThan(0.45);
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
  it("painters draw nothing at daytime strength and survive a stub context", () => {
    const calls: string[] = [];
    const g = new Proxy({ globalAlpha: 1, globalCompositeOperation: "source-over" } as Record<string, unknown>, {
      get: (t, k: string) => (k in t ? t[k] : () => { calls.push(k); return k === "createLinearGradient" ? { addColorStop() {} } : undefined; }),
      set: (t, k: string, v) => { t[k] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const w: Win = { A: [0, 10], B: [10, 12], C: [10, 0], D: [0, -2], col: "#ffd27a", seed: 5 };
    paintWindows(g, [w], 0, 0, true); paintSpill(g, [0, 0], [10, 2], [-6, 8], [4, 10], "#ffd27a", 0);
    expect(calls.length).toBe(0);
    paintWindows(g, [w], 1, 0, true); paintSpill(g, [0, 0], [10, 2], [-6, 8], [4, 10], "#ffd27a", 1);
    expect(calls.length).toBeGreaterThan(5);
  });
});
