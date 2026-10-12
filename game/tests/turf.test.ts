import { describe, it, expect } from "vitest";
import { small, stage, emptyHands } from "./helpers";
import { TOYS, BLACK_MARKET, isGun } from "../src/content/toys";
import { BUILDINGS } from "../src/content/buildings";
import { CRIME_STARS } from "../src/sim/Society";

describe("firearms", () => {
  it("are black-market only weapons with full stats", () => {
    expect(BLACK_MARKET.length).toBe(5);
    for (const id of BLACK_MARKET) {
      const d = TOYS[id];
      expect(d.category).toBe("weapon");
      expect(isGun(id)).toBe(true);
      expect(d.spawn).toBe(0);
      const w = d.weapon!;
      for (const v of [w.damage, w.reach, w.rate, w.accuracy]) expect(v).toBeGreaterThan(0);
      expect(TOYS[w.ammo!].uses).toContain("projectile");
      for (const b of Object.values(BUILDINGS)) expect(b.menu ?? []).not.toContain(id);
    }
    expect(CRIME_STARS.gunfire).toBe(3);
  });

  it("a shot flashes, bangs, wounds the target and is reported as gunfire", () => {
    const sim = small(7, { midCount: 30 });
    const [a, b] = sim.chars.filter((c) => c.tier === "mid" && c.role !== "cop" && !c.crew);
    stage(sim, a, b, 4);
    emptyHands(sim, a); emptyHands(sim, b);
    const gun = sim.spawnToy("revolver", a.x, a.y)!;
    sim.pickupToy(a, gun);
    expect(a.hand).toBe(gun.id);
    const fx: string[] = [], sounds: string[] = [];
    sim.bus.on("fx", (e) => fx.push(e.kind));
    sim.bus.on("sound", (e) => sounds.push(e.kind));
    let hit = false;
    for (let i = 0; i < 60 * 8 && !hit; i++) {
      a.x = a.px = b.x - 4; a.y = a.py = b.y; a.vx = a.vy = 0;
      sim.shootAt(a, b.x, b.y, b.id);
      sim.step();
      hit = b.wounds.length > 0;
    }
    expect(hit).toBe(true);
    expect(fx).toContain("flash");
    expect(sounds).toContain("bang");
    expect(sim.crimes.some((c) => c.type === "gunfire" && c.perp === a.id)).toBe(true);
  });
});

describe("turf war", () => {
  it("the Riccarton Boys exist, cops carry pistols, and a skirmish arms both crews", () => {
    const sim = small(11, { midCount: 110 });
    const ric = sim.chars.filter((c) => c.crew === "riccarton");
    const fam = sim.chars.filter((c) => c.crew === "famiglia");
    expect(ric.length).toBe(4);
    expect(ric.every((c) => c.role === "mobster" && c.nickname)).toBe(true);
    expect(fam.length).toBeGreaterThanOrEqual(3);
    for (const cop of sim.chars.filter((c) => c.role === "cop")) expect([cop.hand, ...cop.bag].some((id) => sim.toys[id]?.def === "pistol")).toBe(true);
    // never on its own in the first few game hours
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.turfWar).toBeNull();
    expect(sim.startTurfWar()).toBe(true);
    expect(sim.turfWar).not.toBeNull();
    expect(sim.startTurfWar()).toBe(false); // one at a time
    sim.step();
    const fighters = sim.chars.filter((c) => c.goal?.id === "turf");
    expect(fighters.some((c) => c.crew === "famiglia") && fighters.some((c) => c.crew === "riccarton")).toBe(true);
    for (const c of fighters) expect([c.hand, ...c.bag].some((id) => isGun(sim.toys[id]?.def ?? ""))).toBe(true);
  });
});
