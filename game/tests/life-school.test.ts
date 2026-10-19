import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { sitExam, study } from "../src/sim/life/school";
import { newLifeSystems } from "../src/sim/life/state";

describe("school and exams", () => {
  it("records study credits and awards a seeded grade on passing", () => {
    const first = study(newLifeSystems().school, 3600)!;
    expect(study(first, 3600)).toBeNull();
    const result = sitExam({ ...first, credits: 20 }, new Rng(1));
    expect(result.passed).toBe(true);
    expect(result.state.grade).toBeGreaterThan(0);
  });
});