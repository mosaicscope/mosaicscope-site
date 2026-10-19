import { describe, expect, it } from "vitest";
import { workout } from "../src/sim/life/gym";
import { newLifeSystems } from "../src/sim/life/state";

describe("gym and fitness", () => {
  it("raises fitness and applies a daily cooldown", () => {
    const state = { ...newLifeSystems().gym, lastWorkout: -86400 };
    const trained = workout(state, 0)!;
    expect(trained.fitness).toBeGreaterThan(state.fitness);
    expect(workout(trained, 1)).toBeNull();
  });
});