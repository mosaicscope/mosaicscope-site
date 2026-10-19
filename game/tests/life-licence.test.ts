import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { practice, test } from "../src/sim/life/licence";
import { newLifeSystems } from "../src/sim/life/state";

describe("driver licence", () => {
  it("requires practice before a test and advances only on a seeded pass", () => {
    const base = newLifeSystems().licence;
    expect(test(base, new Rng(2)).passed).toBe(false);
    const ready = { ...base, practiceHours: 12 };
    const seed = Array.from({ length: 100 }, (_, index) => index).find((value) => test(ready, new Rng(value)).passed)!;
    const result = test(ready, new Rng(seed));
    expect(result.passed).toBe(true);
    expect(result.state.stage).toBe("restricted");
    expect(practice(result.state, 3600)?.practiceHours).toBe(1);
  });
});