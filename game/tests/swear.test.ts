import { describe, it, expect } from "vitest";
import { small, byName } from "./helpers";
import { swear, foulness } from "../src/dialogue/swear";
import type { Character } from "../src/entities/types";

const roll = (seed: number) => { let a = seed; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; };
const SWEARS = /\b(fuck\w*|shit|bloody|bugger|bastard|piss|jesus christ)\b/i;

describe("the town swears", () => {
  it("hot-heads swear far more than kind, calm people, and swears are never bleeped", () => {
    const sim = small();
    const hot = byName(sim, "Flash"), calm = byName(sim, "Nova");
    hot.pers.temper = 0.95; hot.pers.kindness = 0.1; hot.emo.frustration = 0.8;
    calm.pers.temper = 0.05; calm.pers.kindness = 0.95; calm.emo.frustration = 0; calm.emo.fear = 0;
    expect(foulness(hot)).toBeGreaterThan(foulness(calm) * 3);
    const r = roll(7), count = (c: Character) => Array.from({ length: 300 }, () => swear("That was really good.", c, r)).filter((t) => SWEARS.test(t)).length;
    const h = count(hot), k = count(calm);
    expect(h).toBeGreaterThan(150); expect(k).toBeLessThan(60);
    for (let i = 0; i < 200; i++) expect(swear("Nice one.", hot, r)).not.toMatch(/\*|bleep|#@!/i);
  });
  it("NPC dialogue in town actually comes out swearing", () => {
    const sim = small();
    for (const c of sim.chars) { c.pers.temper = 0.9; c.pers.kindness = 0.1; }
    const a = byName(sim, "Kodak"), b = byName(sim, "Tiles");
    const lines = Array.from({ length: 60 }, () => sim.dialogue.bark(a, "greet", b));
    expect(lines.some((l) => SWEARS.test(l))).toBe(true);
  });
});
