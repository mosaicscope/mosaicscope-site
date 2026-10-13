import { describe, it, expect } from "vitest";
import { rng, flavourFor, planStep, scaleFor, mtof, stepSeconds, type Mood } from "../src/audio/Music";

const calm: Mood = { hour: 12, rain: 0, storm: false, tension: 0, street: false, party: false };

describe("generative soundtrack", () => {
  it("is deterministic for a seed", () => {
    const a = rng(7), b = rng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("follows the clock and bends to dread", () => {
    expect(flavourFor({ ...calm, hour: 9 })).toBe("day");
    expect(flavourFor({ ...calm, hour: 18 })).toBe("dusk");
    expect(flavourFor({ ...calm, hour: 2 })).toBe("night");
    expect(flavourFor({ ...calm, hour: 12, tension: 0.8 })).toBe("dread");
  });
  it("only plays notes from the chosen scale family and keeps the street beat busier", () => {
    const r = rng(1), notes = new Set<number>();
    let streetKicks = 0, cityKicks = 0;
    for (let bar = 0; bar < 8; bar++) for (let s = 0; s < 16; s++) {
      const st = planStep({ ...calm, street: true }, "night", bar, s, r), c = planStep(calm, "night", bar, s, r);
      if (st.lead !== null) notes.add((st.lead - scaleFor("night").root) % 12);
      if (st.kick) streetKicks++; if (c.kick) cityKicks++;
    }
    const allowed = new Set(scaleFor("night").steps.map((x) => x % 12));
    for (const n of notes) expect(allowed.has(n)).toBe(true);
    expect(streetKicks).toBeGreaterThan(cityKicks);
  });
  it("has sane tuning and tempo", () => {
    expect(mtof(69)).toBe(440);
    for (const f of ["day", "dusk", "night", "dread"] as const) expect(stepSeconds(scaleFor(f).bpm)).toBeGreaterThan(0.1);
  });
});
