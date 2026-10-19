import { describe, expect, it } from "vitest";
import { small } from "./helpers";
import { parseSave, restore, serialize } from "../src/persistence/SaveSystem";
import { newLifeSystemFlags } from "../src/debug/flags";

describe("life-system saves", () => {
  it("round-trips an active sleep system", () => {
    const sim = small(16, { midCount: 0, backgroundCount: 0 });
    sim.life.systems.sleep.fatigue = 0.72;
    sim.life.systems.sleep.lastTick = sim.tick;
    const restored = restore(parseSave(JSON.stringify(serialize(sim))));
    expect(restored.life.systems.sleep).toEqual(sim.life.systems.sleep);
  });

  it("adds Batch 1 defaults to a v6 save", () => {
    const sim = small(16, { midCount: 0, backgroundCount: 0 });
    const old = serialize(sim) as any;
    old.version = 6;
    delete old.life.systems;
    const restored = restore(parseSave(JSON.stringify(old)));
    expect(restored.life.systems.sleep.fatigue).toBeGreaterThanOrEqual(0);
    expect(restored.life.savings).toBe(sim.life.savings);
  });

  it("keeps the active developer switches attached when loading", () => {
    const sim = small(16, { midCount: 0, backgroundCount: 0 });
    const flags = newLifeSystemFlags();
    flags.sleepFatigue = false;
    const restored = restore(serialize(sim), flags);
    expect(restored.lifeFlags).toBe(flags);
    expect(restored.lifeFlags.sleepFatigue).toBe(false);
  });
});