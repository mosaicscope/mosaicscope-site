import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { step } from "../src/sim/life/birthdays";
import { newLifeSystems } from "../src/sim/life/state";

describe("birthdays", () => {
  it("announces each game-year birthday once", () => {
    const state = newLifeSystems().birthdays;
    const result = step(state, 365 * 24 * 3600, new Rng(2));
    expect(result.events[0]?.type).toBe("life_birthday");
    expect(step(result.state, 365 * 24 * 3600, new Rng(2)).events).toHaveLength(0);
  });
});