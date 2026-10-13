import { describe, it, expect } from "vitest";
import { billAbsence, collect, ARREARS_CAP, RENT_PER_DAY } from "../src/sim/Arrears";

describe("rent arrears", () => {
  it("charges nothing for no time away", () => {
    expect(billAbsence(0, 500)).toEqual({ rent: 0, paid: 0, arrears: 0 });
  });
  it("pays all the rent when cash covers it", () => {
    const b = billAbsence(2, 1000);
    expect(b).toEqual({ rent: 2 * RENT_PER_DAY, paid: 90, arrears: 0 });
  });
  it("turns the unpaid part into arrears instead of forgiving it", () => {
    const b = billAbsence(10, 100); // rent 450, only 40% of $100 can be taken
    expect(b.rent).toBe(450);
    expect(b.paid).toBe(40);
    expect(b.arrears).toBe(410);
  });
  it("adds interest to arrears already owed, and caps the total", () => {
    expect(billAbsence(10, 1000, 200).arrears).toBeGreaterThan(200);
    expect(billAbsence(30, 0, ARREARS_CAP).arrears).toBe(ARREARS_CAP);
    expect(billAbsence(30, 0, 0).arrears).toBe(30 * RENT_PER_DAY); // 1350, under the cap
    expect(billAbsence(30, 0, 1000).arrears).toBe(ARREARS_CAP); // pushed past the cap
  });
  it("caps the days counted at 30 and is never negative or NaN", () => {
    expect(billAbsence(400, 0).rent).toBe(30 * RENT_PER_DAY);
    for (const [d, c, a] of [[-5, -10, -3], [NaN, NaN, NaN], [Infinity, 1e9, 1e9]] as const) {
      const b = billAbsence(d, c, a);
      for (const v of [b.rent, b.paid, b.arrears]) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
      expect(b.arrears).toBeLessThanOrEqual(ARREARS_CAP);
    }
  });
  it("collects at most 30% of cash and never more than is owed", () => {
    expect(collect(1000, 2000)).toEqual({ taken: 300, left: 1700 });
    expect(collect(1000, 50)).toEqual({ taken: 50, left: 0 });
    expect(collect(0, 500)).toEqual({ taken: 0, left: 500 });
    expect(collect(NaN, NaN)).toEqual({ taken: 0, left: 0 });
  });
  it("is deterministic", () => {
    expect(billAbsence(7, 321, 123)).toEqual(billAbsence(7, 321, 123));
  });
});
