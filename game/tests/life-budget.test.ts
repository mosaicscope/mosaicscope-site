import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { step } from "../src/sim/life/budget";
import { newLifeSystems } from "../src/sim/life/state";

describe("budget and bills", () => {
  it("pays what it can and records the unpaid remainder as capped arrears", () => {
    const state = { ...newLifeSystems().budget, nextBill: 3600 };
    const result = step(state, 3600, new Rng(2), 10);
    expect(result.events[0]?.cashDelta).toBe(-10);
    expect(result.state.arrears).toBeGreaterThan(0);
    expect(result.state.nextBill).toBeGreaterThan(3600);
  });
});