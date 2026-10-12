import { describe, it, expect } from "vitest";
import { Simulation } from "../src/sim/Simulation";
import { Phys } from "../src/entities/types";

describe("living world (integration)", () => {
  const sim = new Simulation({ seed: 20251012 });
  const ticks = 60 * 60 * 4; // four game minutes... the clock runs 1 game hour per real minute
  for (let i = 0; i < ticks; i++) sim.step();

  it("meets the population target with three distinct tiers", () => {
    const tiers = { principal: 0, mid: 0, background: 0 };
    for (const c of sim.chars) if (c.tier !== "player") tiers[c.tier]++;
    expect(tiers.principal).toBe(11); // the ten Mosaics + Chris from MosaicScope expect(tiers.mid).toBeGreaterThanOrEqual(50); expect(tiers.background).toBeGreaterThanOrEqual(400);
    expect(sim.chars.length).toBeGreaterThanOrEqual(400);
  });
  it("keeps everyone in a valid place with finite state", () => {
    for (const c of sim.chars) {
      expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(sim.world.size);
      if (c.phys === Phys.OK) expect(sim.world.walkable(c.x, c.y) || sim.world.walkable(c.x + 0.3, c.y) || sim.world.walkable(c.x, c.y + 0.3)).toBe(true);
    }
    for (const t of sim.toys) if (t.state !== "broken") expect(Number.isFinite(t.x + t.y + t.z)).toBe(true);
  });
  it("produces emergent events from simulation rules, including causal chains", () => {
    const c = sim.events.counts;
    for (const type of ["toy_hit", "rumour", "help", "near_miss", "toy_fight"]) expect(c[type] ?? 0, type).toBeGreaterThan(0);
    expect(sim.events.history.some((e) => e.cause >= 0)).toBe(true);
    expect(sim.events.tooDeep + sim.events.dropped).toBeLessThan(sim.events.history.length);
  });
  it("relationships and memories evolved from interactions", () => {
    const principals = sim.chars.filter((c) => c.tier === "principal");
    expect(principals.every((c) => c.memories.length > 0)).toBe(true);
    const mids = sim.chars.filter((c) => c.tier === "mid");
    expect(mids.filter((c) => c.rel.size > 0).length).toBeGreaterThan(mids.length / 2);
  });
  it("principals are individually distinct (different goals over time)", () => {
    const stats = sim.chars.filter((c) => c.tier === "principal").map((c) => JSON.stringify(c.stats));
    expect(new Set(stats).size).toBeGreaterThan(5);
  });
  it("runs well inside the frame budget headlessly", () => {
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) sim.step();
    expect((performance.now() - t0) / 300).toBeLessThan(8);
  });
}, 120000);
