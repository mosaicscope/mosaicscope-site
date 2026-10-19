import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { inspect, moveIn, step } from "../src/sim/life/renting";
import { newLifeSystems } from "../src/sim/life/state";

describe("renting", () => {
  it("requires a bond and raises the rent on its scheduled anniversary", () => {
    const base = newLifeSystems().renting;
    expect(moveIn(base, 100)).toBeNull();
    expect(moveIn(base, 2000)?.cashDelta).toBe(-1260);
    const result = step(base, base.nextRise, new Rng(2));
    expect(result.state.weeklyRent).toBeGreaterThan(base.weeklyRent);
    expect(result.events[0]?.type).toBe("life_rent_rise");
    expect(inspect(base, 1)).toBeNull();
    expect(inspect(base, 30 * 24 * 3600)?.lastInspection).toBe(30 * 24 * 3600);
  });
});