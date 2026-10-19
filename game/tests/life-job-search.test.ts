import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { apply, step } from "../src/sim/life/jobSearch";
import { newLifeSystems } from "../src/sim/life/state";

describe("job search", () => {
  it("sends an application and returns a deterministic update after the wait", () => {
    const sent = apply(newLifeSystems().jobSearch, 0);
    expect(sent.applications).toBe(1);
    expect(step(sent, sent.nextReply, new Rng(2)).events[0]?.type).toBe("life_job_reply");
  });
});