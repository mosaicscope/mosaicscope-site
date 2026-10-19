import { describe, expect, it } from "vitest";
import { payRates, step } from "../src/sim/life/council";
import { newLifeSystems } from "../src/sim/life/state";
import { Rng } from "../src/core/rng";

describe("council rates and bins", () => {
  it("schedules rates and clears them when paid", () => {
    const state = newLifeSystems().council;
    const result = step(state, 7 * 24 * 3600, new Rng(2));
    expect(result.state.ratesDue).toBeGreaterThan(0);
    expect(payRates(result.state).ratesDue).toBe(0);
    const overdue = step(result.state, 14 * 24 * 3600, new Rng(2));
    expect(overdue.events.find((event) => event.type === "life_council_fine")?.fineAmount).toBeGreaterThan(0);
  });
});