import { describe, it, expect } from "vitest";
import { small, stage, emptyHands } from "./helpers";
import { Phys } from "../src/entities/types";

describe("player punches", () => {
  it("injures a background pedestrian, reacts visibly and respects cooldown", () => {
    const sim = small(); const p = sim.player;
    const victim = sim.chars.find(c => c.tier === "background")!;
    victim.inside = -1; victim.inCar = -1; emptyHands(sim,p); emptyHands(sim,victim); stage(sim,p,victim,1);
    expect(sim.punchHeld(p)).toBeGreaterThan(0);
    expect(victim.wounds.some(w => w.kind === "bruise")).toBe(true);
    expect(victim.phys).toBe(Phys.STUMBLE);
    const hits = victim.stats.hitsTaken;
    expect(sim.punchHeld(p)).toBe(0);
    expect(victim.stats.hitsTaken).toBe(hits);
  });
  it("does not hit someone behind the player or beyond reach", () => {
    const sim = small(); const p = sim.player; const victim = sim.chars[1];
    stage(sim,p,victim,4); sim.punchHeld(p); expect(victim.wounds).toHaveLength(0);
    sim.tick += 60; stage(sim,p,victim,-1); sim.punchHeld(p); expect(victim.wounds).toHaveLength(0);
  });
});
