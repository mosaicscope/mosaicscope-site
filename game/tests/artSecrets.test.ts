import { describe, it, expect } from "vitest";
import { goldenHour, gameDay, gameWeek, MURALS, MURAL_W, MURAL_H, muralAt, PAINTINGS, paintingOfWeek, paintingCard, classifyMoment, comicLayout, panelProgress, COMIC_MIN_RANK } from "../src/render/ArtSecrets";
import { TICKS_PER_HOUR } from "../src/sim/Environment";
import { INTERIORS, PROP_INFO } from "../src/content/interiors";

describe("golden hour", () => {
  it("peaks at dusk and dawn, and is dark at noon and midnight", () => {
    expect(goldenHour(18)).toBe(1); expect(goldenHour(6.7)).toBeGreaterThan(0.7);
    for (const h of [0, 3, 12, 14, 22]) expect(goldenHour(h), String(h)).toBe(0);
  });
  it("is smooth and stays inside 0..1", () => {
    let prev = goldenHour(0);
    for (let h = 0; h <= 24; h += 0.05) { const v = goldenHour(h); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); expect(Math.abs(v - prev)).toBeLessThan(0.12); prev = v; }
  });
  it("wraps past 24 hours", () => { expect(goldenHour(24 + 18)).toBe(goldenHour(18)); });
});

describe("game week", () => {
  it("counts days from the start hour and weeks of seven days", () => {
    expect(gameDay(17, 0)).toBe(0); expect(gameDay(17, 7 * TICKS_PER_HOUR)).toBe(1);
    expect(gameWeek(17, 0)).toBe(0); expect(gameWeek(17, 7 * 24 * TICKS_PER_HOUR)).toBe(1); expect(gameWeek(17, 6 * 24 * TICKS_PER_HOUR)).toBe(0);
  });
});

describe("murals", () => {
  it.each(MURALS.map((m) => [m.id, m] as const))("%s is a real mosaic: determined, in palette, neither empty nor solid", (_id, m) => {
    let filled = 0;
    for (let y = 0; y < MURAL_H; y++) for (let x = 0; x < MURAL_W; x++) {
      const c = m.tile(x, y); expect(c).toBe(m.tile(x, y));
      expect(c).toBeGreaterThanOrEqual(-1); expect(c).toBeLessThan(m.palette.length);
      if (c >= 0) filled++;
    }
    const share = filled / (MURAL_W * MURAL_H);
    expect(share).toBeGreaterThan(0.25); expect(share).toBeLessThan(0.92);
    for (let i = 0; i < m.palette.length; i++) { let used = false; for (let y = 0; y < MURAL_H && !used; y++) for (let x = 0; x < MURAL_W; x++) if (m.tile(x, y) === i) { used = true; break; } expect(used, `colour ${i}`).toBe(true); }
  });
  it("only some walls hold one, stable per wall, and every design turns up", () => {
    const hit = new Set<number>(); let n = 0;
    for (let i = -400; i < 400; i++) { const a = muralAt(i); expect(muralAt(i)).toBe(a); if (a >= 0) { hit.add(a); n++; } }
    expect(hit.size).toBe(MURALS.length);
    expect(n / 800).toBeGreaterThan(0.08); expect(n / 800).toBeLessThan(0.25);
  });
});

describe("painting of the week", () => {
  it("has twelve original works with distinct ids and titles", () => {
    expect(PAINTINGS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PAINTINGS.map((p) => p.id)).size).toBe(PAINTINGS.length);
    expect(new Set(PAINTINGS.map((p) => p.title)).size).toBe(PAINTINGS.length);
  });
  it("changes every week, walks the whole catalogue, then repeats; negative weeks are safe", () => {
    const seen = new Set<string>();
    for (let w = 0; w < PAINTINGS.length; w++) { seen.add(paintingOfWeek(w).id); expect(paintingOfWeek(w).id).not.toBe(paintingOfWeek(w + 1).id); }
    expect(seen.size).toBe(PAINTINGS.length);
    expect(paintingOfWeek(PAINTINGS.length).id).toBe(paintingOfWeek(0).id);
    expect(paintingOfWeek(-1)).toBeTruthy();
  });
  it("writes a card that names the work", () => { const p = paintingOfWeek(2); expect(paintingCard(p, 2)).toContain(p.title); });
  it("hangs in the gallery with something to walk up to", () => {
    const g = INTERIORS.gallery!;
    const prop = g.props.find((q) => q.type === "painting");
    expect(prop).toBeTruthy(); expect(PROP_INFO.painting.wall).toBe(true);
    expect(g.interactables.some((i) => i.id === "weekly")).toBe(true);
  });
});

describe("comic moments", () => {
  it("picks loud events and ignores quiet ones", () => {
    expect(classifyMoment("car_crash", 3)?.word).toBe("KRAKOOM!");
    expect(classifyMoment("busted", 2)?.word).toBe("BUSTED!");
    for (const t of ["weather", "tip", "help", "toy_found", "purchase", "nonsense"]) expect(classifyMoment(t, 5), t).toBeNull();
  });
  it("ranks severe events above mild ones and never below the bar", () => {
    expect(classifyMoment("kiss", 4)!.rank).toBeGreaterThan(classifyMoment("kiss", 1)!.rank);
    expect(classifyMoment("kiss", 1)!.rank).toBeGreaterThanOrEqual(COMIC_MIN_RANK);
  });
  it("lays three panels side by side, inside the screen, never taller than a third", () => {
    for (const [W, H] of [[390, 780], [820, 1180], [1280, 800], [1920, 1080]]) {
      const ps = comicLayout(W, H); expect(ps.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(ps[i].x).toBeGreaterThanOrEqual(0); expect(ps[i].x + ps[i].w).toBeLessThanOrEqual(W); expect(ps[i].h).toBeLessThanOrEqual(Math.max(130, H * 0.34));
        if (i) expect(ps[i].x).toBeGreaterThan(ps[i - 1].x + ps[i - 1].w);
      }
    }
  });
  it("pops panels in order and fades the strip out at the end", () => {
    expect(panelProgress(0, 0.3, 3.6).pop).toBe(1); expect(panelProgress(2, 0.3, 3.6).pop).toBeLessThan(1);
    expect(panelProgress(0, 1, 3.6).fade).toBe(1); expect(panelProgress(0, 3.5, 3.6).fade).toBeLessThan(0.3); expect(panelProgress(0, 3.6, 3.6).fade).toBe(0);
  });
});
