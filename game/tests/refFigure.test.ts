import { describe, it, expect } from "vitest";
import { facePlan, moodOf } from "../src/render/RefFigure";
import { LoreBook } from "../src/ui/Photos";
import type { StorageProvider } from "../src/persistence/storage";

const mem = (): StorageProvider => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => (m.set(k, v), true), remove: (k) => void m.delete(k), keys: (p) => [...m.keys()].filter((k) => k.startsWith(p)) }; };

describe("street model faces", () => {
  it("gives every person their own face from a large pool", () => {
    const seen = new Set<string>();
    for (let s = 0; s < 2000; s++) seen.add(JSON.stringify(facePlan(s * 7919 + 1)));
    expect(seen.size).toBe(2000);
  });
  it("keeps face proportions in natural ranges", () => {
    for (let s = 0; s < 500; s++) {
      const P = facePlan(s);
      expect(P.eyeR).toBeGreaterThanOrEqual(0.22); expect(P.eyeR).toBeLessThanOrEqual(0.34);
      expect(P.nose).toBeGreaterThanOrEqual(0); expect(P.nose).toBeLessThan(5);
    }
  });
  it("shows the person's current emotion", () => {
    const base = { phys: 0, emo: { fear: 0, frustration: 0, confidence: 0.5, mood: 0, composure: 1 } } as any;
    expect(moodOf(base)).toBe("neutral");
    expect(moodOf({ ...base, emo: { ...base.emo, fear: 0.9 } })).toBe("scared");
    expect(moodOf({ ...base, emo: { ...base.emo, frustration: 0.9 } })).toBe("angry");
    expect(moodOf({ ...base, emo: { ...base.emo, mood: 0.9 } })).toBe("happy");
    expect(moodOf({ ...base, emo: { ...base.emo, mood: -0.9 } })).toBe("sad");
    expect(moodOf({ ...base, phys: 2 })).toBe("stunned");
  });
});

describe("photo lore", () => {
  it("unlocks a Mosaic's lore the first time they are photographed, and remembers it", () => {
    const store = mem(), book = new LoreBook(store);
    expect(book.catch(3)).toBe(true);
    expect(book.catch(3)).toBe(false);
    expect(new LoreBook(store).found.has(3)).toBe(true);
  });
});

import { personalize, lookSpec } from "../src/render/RefFigure";
import { MODELS } from "../src/render/Models";

describe("per-person variation", () => {
  const mid = (id: number) => ({ id, tier: "mid", name: "x", look: { kind: id % 2 ? "girl" : "guy", color: "#fff", accent: "#000", hat: "none", hair: "none", scale: 1 } }) as any;
  it("makes people sharing a model look different from each other", () => {
    const M = MODELS[0], seen = new Set<string>();
    for (let id = 0; id < 3000; id++) seen.add(JSON.stringify(personalize(M, mid(id))) + JSON.stringify(facePlan(id * 2654435761)));
    expect(seen.size).toBe(3000);
  });
  it("leaves the Mosaics and the player as they are", () => {
    const mosaic = { ...mid(1), tier: "principal" }, M = lookSpec(mosaic);
    expect(personalize(M, mosaic)).toBe(M);
    const player = { ...mid(2), mode: "player" }, P = lookSpec(player);
    expect(personalize(P, player)).toBe(P);
  });
});
