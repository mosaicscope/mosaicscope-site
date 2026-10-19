import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { step } from "../src/sim/life/childhood";
import { newLifeSystems } from "../src/sim/life/state";

describe("childhood stages", () => {
  it("moves from childhood to the teen stage and records the milestone", () => {
    const child = { ...newLifeSystems().childhood, ageDays: 12 };
    const result = step(child, 86400, new Rng(2));
    expect(result.state.stage).toBe("teen");
    expect(result.events[0]?.type).toBe("life_growing_up");
  });
});