import { describe, expect, it } from "vitest";
import { action } from "../src/sim/Chronicles";
import { BODY_UPGRADES, bodyPace, gymMultiplier, newBody } from "../src/sim/life/body";
import { serialize, restore } from "../src/persistence/SaveSystem";
import { small } from "./helpers";

describe("player body upgrades", () => {
  it("rejects unaffordable, unknown and duplicate purchases without taking cash", () => {
    const sim = small(9, { midCount: 0, backgroundCount: 0 });
    sim.player.cash = 0;
    action(sim, "bodyUpgrade", "shoes");
    expect(sim.life.body.owned).toEqual([]);
    sim.player.cash = 100;
    action(sim, "bodyUpgrade", "shoes");
    expect(sim.player.cash).toBe(20);
    action(sim, "bodyUpgrade", "shoes");
    action(sim, "bodyUpgrade", "invalid");
    expect(sim.player.cash).toBe(20);
    expect(sim.life.body.owned).toEqual(["shoes"]);
  });
  it("keeps purchases through save restore and defaults old saves", () => {
    const sim = small(9, { midCount: 0, backgroundCount: 0 });
    sim.player.cash = 5000;
    for (const item of BODY_UPGRADES) action(sim, "bodyUpgrade", item.id);
    const saved = serialize(sim);
    expect(restore(saved).life.body.owned).toEqual(BODY_UPGRADES.map(u => u.id));
    delete (saved.life as any).body;
    expect(restore(saved).life.body).toEqual(newBody());
  });
  it("uses the best gym tier and improves movement in adverse weather", () => {
    const body = newBody();
    expect(gymMultiplier(body)).toBe(1);
    const pace = bodyPace(body, true, 1);
    body.owned.push("basic", "pro", "iron", "jacket", "sunnies");
    expect(gymMultiplier(body)).toBe(1.5);
    expect(bodyPace(body, true, 1)).toBeGreaterThan(pace);
  });
});
