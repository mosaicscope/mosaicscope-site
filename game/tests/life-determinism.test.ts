import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { newLifeSystemFlags } from "../src/debug/flags";
import { stepLifeSystems } from "../src/sim/life/index";
import { newLifeSystems } from "../src/sim/life/state";

function run(seed: number) {
  const rng = new Rng(seed);
  let state = newLifeSystems();
  for (let hour = 1; hour <= 4; hour++)
    state = stepLifeSystems(state, hour * 3600, rng, 1000, 500, newLifeSystemFlags()).state;
  return state;
}

describe("life-system determinism", () => {
  it("produces identical state for the same seed over four game hours", () => {
    expect(run(44)).toEqual(run(44));
  });
});