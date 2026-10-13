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

import { sceneFor, SceneTracker, parseInspo, liveTint, resolveTheme, motifNote, MOTIFS, THEMES, HOLD } from "../src/audio/Score";
import { parseVibe, clockVibe } from "../src/audio/LiveVibe";
import inspoJson from "../src/audio/inspo.json";

describe("Lil Wooski's scenes", () => {
  it("picks the right scene, chase first", () => {
    expect(sceneFor(calm)).toBe("city");
    expect(sceneFor({ ...calm, hour: 6 })).toBe("dawn");
    expect(sceneFor({ ...calm, rain: 0.8 })).toBe("rain");
    expect(sceneFor({ ...calm, street: true })).toBe("street2d");
    expect(sceneFor({ ...calm, indoors: true })).toBe("interior");
    expect(sceneFor({ ...calm, party: true })).toBe("nightlife");
    expect(sceneFor({ ...calm, place: "recycling" })).toBe("recycling");
    expect(sceneFor({ ...calm, place: "studio" })).toBe("studio");
    expect(sceneFor({ ...calm, place: "terrance", party: true })).toBe("terrance");
    expect(sceneFor({ ...calm, chase: true, place: "terrance" })).toBe("chase");
  });
  it("holds a new scene for a couple of bars but cuts the chase in at once", () => {
    const t = new SceneTracker();
    for (let i = 0; i < HOLD - 1; i++) expect(t.update({ ...calm, street: true })).toBeNull();
    expect(t.update({ ...calm, street: true })).toBe("city");
    expect(t.scene).toBe("street2d");
    t.update(calm); t.update({ ...calm, street: true }); // a flicker does not switch
    expect(t.scene).toBe("street2d");
    expect(t.update({ ...calm, chase: true })).toBe("street2d");
    expect(t.scene).toBe("chase");
  });
  it("gives recurring characters and places a fixed leitmotif", () => {
    expect(THEMES.terrance.motif).toBe("terrance");
    const heard = [0, 1, 2, 3].map((s) => motifNote("terrance", 0, s * 3));
    expect(heard).toEqual(MOTIFS.terrance.notes);
    expect(motifNote("studio", 1, 0)).toBeNull(); // studio theme only every 4th bar
    expect(motifNote(undefined, 0, 0)).toBeNull();
    const r = rng(3);
    const notes = Array.from({ length: 16 }, (_, s) => planStep({ ...calm, place: "terrance" }, "dread", 0, s, r, THEMES.terrance).motif).filter((n) => n !== null);
    expect(notes).toHaveLength(4);
  });
  it("shipped inspo.json parses and bad inspo is ignored or clamped", () => {
    const i = parseInspo(inspoJson);
    expect(i.live).toBe(true);
    expect(i.scenes.studio?.mood).toBe("tender");
    const bad = parseInspo({ tempo: 99, density: "loud", scenes: { studio: { mood: "bonkers", tempo: -4 }, nonsense: {} } });
    expect(bad.tempo).toBe(1.3); expect(bad.density).toBe(1); expect(bad.scenes.studio?.mood).toBeUndefined(); expect(bad.scenes.studio?.tempo).toBe(0.6);
    expect(parseInspo(null).scenes).toEqual({});
  });
  it("inspo and live data bend the theme, and live can be switched off", () => {
    const live = { weather: "rain" as const, isDay: false, temp: 4, wind: 10, hour: 2, source: "live" as const };
    const base = resolveTheme("city", parseInspo({}), null), wet = resolveTheme("city", parseInspo({}), live);
    expect(wet.density).toBeLessThan(base.density); expect(wet.bpm).toBeLessThan(base.bpm); expect(wet.bright).toBeLessThan(base.bright);
    expect(resolveTheme("city", parseInspo({ live: false }), live)).toEqual(base);
    expect(resolveTheme("studio", parseInspo({ scenes: { studio: { mood: "hype" } } }), null).bpm).toBeGreaterThan(THEMES.studio.bpm);
    expect(liveTint(null)).toEqual({ bpm: 1, density: 1, bright: 1, rain: 0 });
  });
  it("trusts only well-formed live data and falls back to the clock", () => {
    expect(parseVibe({ weather: "rain", isDay: true, temp: 9, wind: 12, hour: 14.5 })?.weather).toBe("rain");
    expect(parseVibe({ weather: "snow", temp: 1, wind: 1, hour: 1 })).toBeNull();
    expect(parseVibe({ weather: "clear", temp: "hot", wind: 1, hour: 1 })).toBeNull();
    expect(parseVibe("<html>")).toBeNull();
    const c = clockVibe(new Date("2026-10-13T01:00:00Z"));
    expect(c.source).toBe("clock"); expect(c.hour).toBeGreaterThanOrEqual(0); expect(c.hour).toBeLessThan(24);
  });
});
