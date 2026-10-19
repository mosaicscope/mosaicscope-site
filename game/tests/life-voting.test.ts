import { describe, expect, it } from "vitest";
import { vote } from "../src/sim/life/voting";
import { newLifeSystems } from "../src/sim/life/state";

describe("voting", () => {
  it("records an election vote and prevents duplicate votes", () => {
    const state = { ...newLifeSystems().voting, lastElection: -365 * 24 * 3600 };
    const result = vote(state, 0)!;
    expect(result.votes).toBe(1);
    expect(vote(result, 1)).toBeNull();
  });
});