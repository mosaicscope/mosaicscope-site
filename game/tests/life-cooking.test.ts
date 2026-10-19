import { describe, expect, it } from "vitest";
import { cook } from "../src/sim/life/cooking";
import { newLifeSystems } from "../src/sim/life/state";

describe("cooking", () => {
  it("prepares a quality meal and observes the cooldown", () => {
    const state = { ...newLifeSystems().cooking, lastCook: -3600 };
    const meal = cook(state, 0)!;
    expect(meal.meals).toBe(1);
    expect(meal.quality).toBeGreaterThan(state.quality);
    expect(cook(meal, 1)).toBeNull();
  });
});