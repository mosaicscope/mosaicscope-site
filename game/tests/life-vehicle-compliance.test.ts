import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { isRoadLegal, renew, step } from "../src/sim/life/vehicleCompliance";
import { newLifeSystems } from "../src/sim/life/state";

describe("WOF and registration", () => {
  it("detects expiry and renews each item independently", () => {
    const state = { ...newLifeSystems().wof, expires: 10, regoExpires: 100 };
    expect(isRoadLegal(state, 11)).toBe(false);
    const renewed = renew(state, 11, "wof");
    expect(renewed.expires).toBeGreaterThan(11);
    expect(renewed.regoExpires).toBe(100);
    expect(step(renewed, 11, new Rng(2)).state).toEqual(renewed);
    const fine = step({ ...state, lastCitation: -86400 }, 11, new Rng(2), true);
    expect(fine.events[0]?.fineAmount).toBeGreaterThan(0);
    expect(fine.state.citations).toBe(1);
  });
});