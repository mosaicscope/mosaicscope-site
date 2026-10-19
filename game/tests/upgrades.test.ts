import { describe, expect, it } from "vitest";
import { UPGRADES, UPGRADE_GROUPS } from "../src/content/upgrades";
import { purchaseUpgrade, upgradeActivity, tickUpgrades } from "../src/sim/Upgrades";
import { action } from "../src/sim/Chronicles";
import { restore, serialize } from "../src/persistence/SaveSystem";
import { small } from "./helpers";

const game = () => { const sim = small(9, { midCount: 0, backgroundCount: 0 }); sim.player.cash = 10000; return sim; };
describe("upgrade progression", () => {
  it("covers every non-interface roadmap item once", () => {
    expect(new Set(UPGRADES.map(i => i.id)).size).toBe(77);
    expect(UPGRADES.map(i => i.number)).toEqual([...Array.from({ length: 66 }, (_, i) => i + 12), ...Array.from({ length: 11 }, (_, i) => i + 89)]);
    for (const group of UPGRADE_GROUPS) expect(UPGRADES.filter(i => i.group === group)).toHaveLength(11);
  });
  it("does not take cash for invalid, duplicate, or unaffordable purchases", () => {
    const sim = game(); sim.player.cash = 50;
    purchaseUpgrade(sim, "throwing");
    expect(sim.player.cash).toBe(5);
    purchaseUpgrade(sim, "throwing"); purchaseUpgrade(sim, "unknown"); purchaseUpgrade(sim, "van");
    expect(sim.player.cash).toBe(5);
    expect(sim.life.upgrades.owned).toEqual(["throwing"]);
  });
  it("requires a business for renovation and applies loyalty discounts", () => {
    const sim = game(); const cash = sim.player.cash;
    purchaseUpgrade(sim, "renovation"); expect(sim.player.cash).toBe(cash);
    purchaseUpgrade(sim, "loyaltycard"); purchaseUpgrade(sim, "busker");
    expect(sim.player.cash).toBe(cash - 20 - 54);
  });
  it("reserves photo commissions for available film and respects cooldowns", () => {
    const sim = game(); const cash = sim.player.cash;
    upgradeActivity(sim, "photo"); expect(sim.player.cash).toBe(cash);
    purchaseUpgrade(sim, "film"); purchaseUpgrade(sim, "photography");
    const before = sim.player.cash; upgradeActivity(sim, "photo"); upgradeActivity(sim, "photo");
    expect(sim.life.upgrades.film).toBe(9); expect(sim.player.cash).toBe(before + 35);
    purchaseUpgrade(sim, "film"); expect(sim.life.upgrades.film).toBe(9);
  });
  it("pays business income once per game day and carries debt interest", () => {
    const sim = game(); purchaseUpgrade(sim, "foodtruck"); purchaseUpgrade(sim, "stall"); purchaseUpgrade(sim, "credit");
    upgradeActivity(sim, "borrow"); const cash = sim.player.cash;
    sim.tick = 86400; tickUpgrades(sim); tickUpgrades(sim);
    expect(sim.player.cash).toBe(cash + 60 + 18); expect(sim.life.upgrades.debt).toBe(101);
  });
  it("never borrows over the limit or repays more than cash and debt", () => {
    const sim = game(); purchaseUpgrade(sim, "credit");
    for (let i = 0; i < 8; i++) upgradeActivity(sim, "borrow");
    expect(sim.life.upgrades.debt).toBe(300);
    sim.player.cash = 12; upgradeActivity(sim, "repay");
    expect(sim.player.cash).toBe(0); expect(sim.life.upgrades.debt).toBe(288);
  });
  it("refunds paid tax once, and never repeats the same refund", () => {
    const sim = game(); purchaseUpgrade(sim, "accounting"); sim.life.upgrades.taxClaimed = 80;
    sim.tick = 86400; const cash = sim.player.cash; tickUpgrades(sim);
    expect(sim.player.cash).toBe(cash + 8);
    sim.tick += 86400; tickUpgrades(sim); expect(sim.player.cash).toBe(cash + 8);
  });
  it("stores and retrieves toys through save restore without duplicating them", () => {
    const sim = game(); purchaseUpgrade(sim, "stash");
    const toy = sim.spawnToy("ball", sim.player.x, sim.player.y)!; sim.pickupToy(sim.player, toy);
    upgradeActivity(sim, "store"); expect(sim.player.hand).toBe(-1); expect(sim.life.upgrades.stash).toEqual([toy.id]);
    sim.step(); expect(toy.state).toBe("held"); expect(toy.x).toBe(-100);
    const loaded = restore(serialize(sim)); loaded.step(); upgradeActivity(loaded, "retrieve"); upgradeActivity(loaded, "retrieve");
    expect(loaded.player.hand).toBe(toy.id); expect(loaded.life.upgrades.stash).toEqual([]);
    expect(loaded.toys.filter(t => t.id === toy.id && t.holder === loaded.playerId)).toHaveLength(1);
  });
  it("only recruits nearby people and keeps the roster unique", () => {
    const sim = game(), c = sim.chars.find(c => c.tier === "principal")!;
    c.x = sim.player.x + 20; c.y = sim.player.y; upgradeActivity(sim, "recruit", String(c.id));
    expect(sim.life.upgrades.crew).toEqual([]);
    c.x = sim.player.x + 1; upgradeActivity(sim, "recruit", String(c.id)); upgradeActivity(sim, "recruit", String(c.id));
    expect(sim.life.upgrades.crew).toEqual([c.id]);
  });
  it("does not allow fast travel out of custody or a vehicle", () => {
    const sim = game(); purchaseUpgrade(sim, "van"); const point = { x: sim.player.x, y: sim.player.y };
    sim.player.arrestedBy = 1; upgradeActivity(sim, "trip", "0");
    expect({ x: sim.player.x, y: sim.player.y }).toEqual(point);
    sim.player.arrestedBy = -1; sim.player.inCar = 0; upgradeActivity(sim, "trip", "0");
    expect({ x: sim.player.x, y: sim.player.y }).toEqual(point);
  });
  it("uses the medic to treat real crew injuries", () => {
    const sim = game(); purchaseUpgrade(sim, "medic"); const c = sim.chars.find(c => c.tier === "principal")!;
    sim.life.upgrades.crew.push(c.id); c.blood = 0.5; c.wounds.push({ part: "arm", severity: 2, kind: "cut", bandaged: false, tick: 0 });
    tickUpgrades(sim); expect(c.wounds.every(w => w.bandaged)).toBe(true); expect(c.blood).toBeGreaterThan(0.5);
  });
  it("uses healing plants once per day", () => {
    const sim = game(); purchaseUpgrade(sim, "honey"); sim.player.blood = 0.4;
    sim.life.systems.injury.sprain = 0.5; upgradeActivity(sim, "heal"); upgradeActivity(sim, "heal");
    expect(sim.player.blood).toBeCloseTo(0.55); expect(sim.life.systems.injury.sprain).toBeCloseTo(0.35);
  });
  it("unlocks album progress with actual recruited crew activities", () => {
    const sim = game(); purchaseUpgrade(sim, "tiles"); purchaseUpgrade(sim, "album");
    upgradeActivity(sim, "tiles"); expect(sim.life.upgrades.album).toBe(0);
    const c = sim.chars.find(c => c.tier === "principal")!; sim.life.upgrades.crew.push(c.id);
    for (let i = 0; i < 3; i++) { sim.tick = i * 3600; upgradeActivity(sim, "tiles"); }
    expect(sim.life.upgrades.album).toBe(3); expect(sim.player.style).toBe("tiles");
  });
  it("defaults saves from before the upgrade roadmap without losing body purchases", () => {
    const sim = game(); sim.life.body.owned.push("shoes"); const data = serialize(sim);
    delete (data.life as any).upgrades; const loaded = restore(data);
    expect(loaded.life.upgrades.owned).toEqual([]); expect(loaded.life.body.owned).toEqual(["shoes"]);
  });
  it("does not charge workout fees after installing a home gym", () => {
    const sim = game(); purchaseUpgrade(sim, "homegym"); const cash = sim.player.cash;
    action(sim, "workout"); expect(sim.player.cash).toBe(cash);
    expect(sim.life.systems.gym.fitness).toBeGreaterThan(0.5);
  });
});
