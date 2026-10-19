import { describe, expect, it } from "vitest";
import { pay, setTaxCode } from "../src/sim/life/payslip";
import { newLifeSystems } from "../src/sim/life/state";

describe("payslips", () => {
  it("records gross pay, tax and take-home pay", () => {
    const result = pay(newLifeSystems().payslip, 100);
    expect(result.tax).toBe(17);
    expect(result.net).toBe(83);
    expect(result.state.gross).toBe(100);
    expect(pay(setTaxCode(result.state, "S"), 100).tax).toBe(25);
  });
});