import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { eat, step } from "../src/sim/life/diet";
import { newLifeSystems } from "../src/sim/life/state";

describe("diet and hunger", () => {
  it("tracks hunger over time and restores it with a quality meal", () => {
    const state = step(newLifeSystems().diet, 3600, new Rng(2)).state;
    expect(state.hunger).toBeLessThan(1);
    expect(eat(state, 0.9).hunger).toBeGreaterThan(state.hunger);
    expect(eat(state, 0.9).foodQuality).toBe(0.9);
  });
});