import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { step } from "../src/sim/life/savings";
import { newLifeSystems } from "../src/sim/life/state";

describe("savings interest", () => {
  it("credits interest once for each completed week", () => {
    const result = step(newLifeSystems().savings, 7 * 24 * 3600, new Rng(2), 1000);
    expect(result.events[0]?.savingsDelta).toBe(2);
    expect(step(result.state, 7 * 24 * 3600, new Rng(2), 1000).events).toHaveLength(0);
  });
});