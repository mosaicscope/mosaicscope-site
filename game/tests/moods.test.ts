import { describe, it, expect } from "vitest";
import { rng } from "../src/audio/Music";
import { dreamLevel, stepWalk, lateLevel, layersFor, buskerTune, buskerNote, buskerGain, BUSKER_RANGE, DREAM_FROM, DREAM_FULL, BASE_CRACKLE } from "../src/audio/Moods";

describe("Lil Wooski's mood layers", () => {
  it("dream mode builds slowly over a long walk and wakes when you rest", () => {
    expect(dreamLevel(0)).toBe(0);
    expect(dreamLevel(DREAM_FROM)).toBe(0);
    expect(dreamLevel(DREAM_FULL)).toBe(1);
    expect(dreamLevel(165)).toBeGreaterThan(0.3);
    let w = 0; for (let i = 0; i < 1200; i++) w = stepWalk(w, 3, 0.25);
    expect(dreamLevel(w)).toBe(1);
    for (let i = 0; i < 400; i++) w = stepWalk(w, 0, 0.25);
    expect(w).toBe(0);
  });
  it("the dream slows and darkens the music but never by much", () => {
    const l = layersFor({ dream: 1, late: 0, rain: 0 });
    expect(l.bpm).toBeLessThan(1); expect(l.bpm).toBeGreaterThan(0.8);
    expect(l.bright).toBeLessThan(1); expect(l.hue).toBeGreaterThan(0);
  });
  it("rain adds vinyl crackle and glass only indoors", () => {
    expect(layersFor({ dream: 0, late: 0, rain: 0 }).crackle).toBe(BASE_CRACKLE);
    expect(layersFor({ dream: 0, late: 0, rain: 1 }).crackle).toBeGreaterThan(BASE_CRACKLE * 2);
    expect(layersFor({ dream: 0, late: 0, rain: 1, indoors: true }).glass).toBeGreaterThan(0);
    expect(layersFor({ dream: 0, late: 0, rain: 1 }).glass).toBe(0);
  });
  it("the 3am layer fades in when the city is quiet and not in danger", () => {
    expect(lateLevel(12)).toBe(0);
    expect(lateLevel(21)).toBe(0);
    expect(lateLevel(3)).toBe(1);
    expect(lateLevel(1)).toBeGreaterThan(0);
    expect(lateLevel(6)).toBe(0);
    expect(lateLevel(3, 0, 1)).toBeLessThan(lateLevel(3, 0, 0));
    expect(lateLevel(3, 0.8)).toBe(0);
    expect(layersFor({ dream: 0, late: 1, rain: 0 }).hush).toBeGreaterThan(0);
  });
  it("the busker's tune follows the day, softens in rain and only plays scale notes", () => {
    expect(buskerTune(8).name).toBe("morning");
    expect(buskerTune(14).name).toBe("afternoon");
    expect(buskerTune(19).name).toBe("evening");
    expect(buskerTune(2).name).toBe("late");
    expect(buskerTune(14, 1).gain).toBeLessThan(buskerTune(14).gain);
    const t = buskerTune(19), r = rng(3), allowed = new Set(t.steps.map((s) => s % 12));
    let notes = 0;
    for (let bar = 0; bar < 16; bar++) for (let slot = 0; slot < 8; slot++) {
      const n = buskerNote(t, bar, slot, r);
      if (n !== null) { notes++; expect(allowed.has((n - t.root) % 12)).toBe(true); }
    }
    expect(notes).toBeGreaterThan(8);
    expect(buskerNote(t, 0, 0, r)).toBe(t.root);
  });
  it("the busker fades with distance", () => {
    expect(buskerGain(0)).toBe(1);
    expect(buskerGain(BUSKER_RANGE)).toBe(0);
    expect(buskerGain(5)).toBeGreaterThan(buskerGain(10));
  });
});
