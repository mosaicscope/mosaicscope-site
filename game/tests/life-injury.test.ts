import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { injure, step } from "../src/sim/life/injury";
import { newLifeSystems } from "../src/sim/life/state";

describe("injury recovery", () => {
  it("heals a sprain faster with treatment and emits recovery", () => {
    const hurt = injure(newLifeSystems().injury, 0.2, 0);
    const result = step(hurt, 5 * 3600, new Rng(2), true);
    expect(result.state.sprain).toBe(0);
    expect(result.events[0]?.type).toBe("life_injury_recovered");
  });
  it("records a lingering scar after recovery time has passed", () => {
    const hurt = injure(newLifeSystems().injury, 0.1, 0);
    const result = step(hurt, 73 * 3600, new Rng(2));
    expect(result.state.scar).toBeGreaterThan(0);
  });
});