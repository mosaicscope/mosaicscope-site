import { describe, it, expect } from "vitest";
import { Simulation } from "../src/sim/Simulation";
import { serialize, restore, parseSave, toJSON } from "../src/persistence/SaveSystem";
import { Phys } from "../src/entities/types";

/** Chaos soak: several seeds, random player behaviour, nothing may throw or go non-finite. */
describe("robustness", () => {
  for (const seed of [3, 77, 4242]) {
    it(`seed ${seed}: 3 simulated minutes of chaos stays valid`, () => {
      const sim = new Simulation({ seed, midCount: 60, backgroundCount: 120 });
      const p = sim.player;
      let r = seed;
      const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
      for (let t = 0; t < 60 * 180; t++) {
        if (t % 90 === 0) { p.x = 4 + rnd() * (sim.world.size - 8); p.y = 4 + rnd() * (sim.world.size - 8); p.vx = (rnd() - 0.5) * 3; p.vy = (rnd() - 0.5) * 3; }
        if (t % 400 === 0) { p.wanted = Math.floor(rnd() * 6); p.cash = Math.floor(rnd() * 5000); }
        if (t % 700 === 0) sim.shootAt(p, p.x + 3, p.y + 3, -1);
        sim.step();
      }
      for (const c of sim.chars) {
        expect(Number.isFinite(c.x) && Number.isFinite(c.y), c.name).toBe(true);
        expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThanOrEqual(sim.world.size);
        expect(Number.isFinite(c.blood) && c.blood >= 0 && c.blood <= 1.001, c.name).toBe(true);
        expect(c.cash).toBeGreaterThanOrEqual(-1e-6);
      }
      for (const v of sim.vehicles) expect(Number.isFinite(v.x + v.y + v.speed)).toBe(true);
      // and the result still saves and loads
      const back = restore(parseSave(toJSON(serialize(sim))));
      expect(back.chars.length).toBe(sim.chars.length);
      expect(sim.chars.filter((c) => c.phys === Phys.OK).length).toBeGreaterThan(sim.chars.length * 0.5);
    }, 60000);
  }
});
