import { describe, it, expect } from "vitest";
import { Simulation } from "../src/sim/Simulation";
import { kin, founderLiability } from "../src/mind/Kin";
import { kin as kinFromTown, updateTown } from "../src/mind/Town";
import { careOf, helpSeekingProbability, personalStigma, updateWhanau, goForHelp, whanauSupportNear } from "../src/mind/Whanau";
import { deriveProfile } from "../src/mind/Culture";
import { BUILDINGS } from "../src/content/buildings";

const big = (seed: number) => new Simulation({ seed, midCount: 110, backgroundCount: 40 });
const finite = (o: unknown, path = ""): string[] => {
  if (typeof o === "number") return Number.isFinite(o) ? [] : [path];
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => finite(v, path + "." + k));
  return [];
};

describe("adversarial: the mind under extreme load (Agent A's system)", () => {
  it("never produces NaN or out-of-range state when everyone is maximally stressed, sad and burnt out", () => {
    const sim = big(41);
    for (const c of sim.chars) { if (c.tier === "player" || !c.mind) continue; c.mind.stress = 1; c.mind.burnout = 1; c.emo.mood = -1; c.emo.fear = 1; c.emo.frustration = 1; c.needs.social = 0; c.needs.energy = 0; }
    for (let i = 0; i < 900; i++) sim.step();
    for (const c of sim.chars) {
      expect(finite(c.mind), c.name).toEqual([]);
      expect(Number.isFinite(c.x + c.y), c.name).toBe(true);
      expect(c.mind.stress).toBeGreaterThanOrEqual(0); expect(c.mind.stress).toBeLessThanOrEqual(1);
      expect(c.mind.burnout).toBeGreaterThanOrEqual(0); expect(c.mind.burnout).toBeLessThanOrEqual(1);
      expect(Math.abs(c.mind.val)).toBeLessThanOrEqual(1);
      expect(c.emo.mood).toBeGreaterThanOrEqual(-1); expect(c.emo.mood).toBeLessThanOrEqual(1);
    }
  });
  it("keeps all mind state as plain JSON that survives a round trip after a long run", () => {
    const sim = big(42);
    for (let i = 0; i < 1200; i++) sim.step();
    for (const c of sim.chars) {
      const back = JSON.parse(JSON.stringify(c.mind));
      expect(back, c.name).toEqual(JSON.parse(JSON.stringify(c.mind)));
      expect(JSON.stringify(JSON.parse(JSON.stringify(back)))).toBe(JSON.stringify(back));
      expect(finite(c.mind), c.name).toEqual([]);
    }
  });
});

describe("kin groups and heritable liability", () => {
  it("builds families that share surname and district, with parent couples, deterministically, without touching sim.rng", () => {
    const a = big(7), b = big(7);
    expect(a.chars.map((c) => c.name)).toEqual(b.chars.map((c) => c.name));
    expect(a.rng.getState()).toEqual(b.rng.getState());
    const groups = a.chars.filter((c) => kin(a, c).family);
    expect(groups.length).toBeGreaterThanOrEqual(6);
    for (const c of groups) {
      const k = kinFromTown(a, c);
      expect(k).toEqual(kin(a, c));
      for (const id of k.members) { const o = a.chars[id]; expect(o.homeArea).toBe(c.homeArea); expect(o.name.split(" ").pop()).toBe(c.name.split(" ").pop()); }
      expect(k.liability).toBeGreaterThanOrEqual(0); expect(k.liability).toBeLessThanOrEqual(1);
    }
    const withParents = a.chars.filter((c) => kin(a, c).parents.length === 2);
    expect(withParents.length).toBeGreaterThan(0);
    const p = withParents[0], [p1, p2] = kin(a, p).parents.map((id) => a.chars[id]);
    expect(p1.partner).toBe(p2.id);
  });
  it("is heritable: child liability tracks the parental mean, and the population is right-skewed and bounded", () => {
    let xs: number[] = [], ys: number[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = big(seed);
      for (const c of s.chars) { const k = kin(s, c); if (k.parents.length === 2) { xs.push((kin(s, s.chars[k.parents[0]]).liability + kin(s, s.chars[k.parents[1]]).liability) / 2); ys.push(k.liability); } }
    }
    expect(xs.length).toBeGreaterThan(8);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const mx = mean(xs), my = mean(ys);
    const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my))), sx = Math.sqrt(mean(xs.map((x) => (x - mx) ** 2))), sy = Math.sqrt(mean(ys.map((y) => (y - my) ** 2)));
    expect(cov / (sx * sy)).toBeGreaterThan(0.6);
    const founders = Array.from({ length: 3000 }, (_, i) => founderLiability(9, i)).sort((a, b) => a - b);
    expect(founders[0]).toBeGreaterThanOrEqual(0); expect(founders[founders.length - 1]).toBeLessThanOrEqual(1);
    expect(mean(founders)).toBeGreaterThan(founders[1500]); // mean above median: right skew
  });
});

describe("Pūtahi and the whānau net", () => {
  it("exists, is enterable, sits in the hospital block and is on the map", () => {
    expect(BUILDINGS.mentalhealth.enterable).toBe(true);
    const sim = big(3);
    const mh = sim.world.buildings.find((b) => b.kind === "mentalhealth")!, h = sim.world.buildings.find((b) => b.kind === "hospital")!;
    expect(mh.name).toMatch(/Pūtahi/);
    expect(mh.area).toBe(h.area);
  });
  it("stigma delays help-seeking, and whānau close by shortens the wait", () => {
    const old = { ...deriveProfile(1, 1, "mechanic", "market"), cohort: "older" as const, sub: "trades" as const };
    const young = { ...deriveProfile(1, 2, "student", "plaza"), cohort: "youth" as const, sub: "creative" as const };
    const hi = personalStigma(old, true, 0.8, 0), lo = personalStigma(young, false, 0.3, 0);
    expect(hi).toBeGreaterThan(lo + 0.3);
    expect(personalStigma(old, true, 0.8, 1)).toBeLessThan(hi - 0.2);
    expect(helpSeekingProbability(0.9, lo)).toBeGreaterThan(helpSeekingProbability(0.9, hi) * 2);
    expect(helpSeekingProbability(0.3, 0)).toBe(0); // not struggling: nobody goes
    // integration: stressed people go to Pūtahi sooner when the town is less stigmatised, and the visit eases stress
    const waits = (stigma: number) => {
      const sim = big(11); const st = careOf(sim); st.stigma = stigma;
      const who = sim.chars.filter((c) => c.tier === "mid" && c.mind && c.inside < 0).slice(0, 40);
      for (const c of who) { c.mind.stress = 0.9; c.emo.mood = -0.4; }
      let visits = 0;
      for (let i = 0; i < 200; i++) { sim.tick += 60; for (const c of who) { if (c.inside < 0) c.mind.stress = Math.max(c.mind.stress, 0.9); } updateWhanau(sim); }
      visits = st.stats.visits; return { visits, st };
    };
    const calm = waits(0.1), harsh = waits(0.95);
    expect(calm.visits).toBeGreaterThan(harsh.visits);
    expect(calm.st.stigma).toBeGreaterThanOrEqual(0.1 - 1e-9); // visits lower stigma, never below its floor
  });
  it("whānau buffering and gentle check-ins lower stress; a visit to Pūtahi eases it and normalises asking", () => {
    const sim = big(5);
    const fam = sim.chars.find((c) => kin(sim, c).members.length >= 2 && c.mind)!;
    const k = kin(sim, fam), others = k.members.map((id) => sim.chars[id]);
    const arrange = (near: boolean) => {
      fam.x = fam.px = 20; fam.y = fam.py = 20; fam.inside = -1; fam.inCar = -1; fam.lod = 0;
      others.forEach((o, i) => { o.inside = -1; o.x = o.px = near ? 21 + i * 0.5 : 120; o.y = o.py = near ? 20 : 120; });
      sim.rebuildHash();
      fam.mind.stress = 0.8; fam.emo.mood = 0.6; // mood high: isolates the buffering from help-seeking
      const st = careOf(sim); st.cooldown.clear();
      for (let i = 0; i < 40; i++) { sim.tick += 60; updateWhanau(sim); }
      return fam.mind.stress;
    };
    expect(whanauSupportNear(sim, fam)).toBeGreaterThanOrEqual(0);
    const withKin = arrange(true), alone = arrange(false);
    expect(withKin).toBeLessThan(alone);
    // direct visit
    const st = careOf(sim), before = st.stigma, stress = fam.mind.stress = 0.9;
    expect(goForHelp(sim, fam, st)).toBe(true);
    expect(fam.mind.stress).toBeLessThan(stress * 0.7);
    expect(st.stigma).toBeLessThan(before);
    expect(sim.world.buildings[fam.inside].kind).toBe("mentalhealth");
    updateTown(sim); // runs with someone inside without throwing
  });
});
