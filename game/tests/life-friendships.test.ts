import { describe, expect, it } from "vitest";
import { gift } from "../src/sim/life/friendships";
import { newLifeSystems } from "../src/sim/life/state";

describe("friendships and gifts", () => {
  it("improves trust once, then respects the gift cooldown", () => {
    const state = newLifeSystems().friendships;
    const result = gift(state, 86400, 0.2)!;
    expect(result.trust).toBeGreaterThan(0.2);
    expect(gift(result.state, 86401, result.trust)).toBeNull();
  });
});