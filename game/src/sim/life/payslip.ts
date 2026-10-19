import type { Rng } from "../../core/rng";
import { PAYSLIP } from "../../content/life/payslip";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function pay(state: LifeSystemsState["payslip"], gross: number): { state: LifeSystemsState["payslip"]; net: number; tax: number } {
  const amount = Math.max(0, Math.round(gross * 100) / 100);
  const tax = Math.round(amount * PAYSLIP.taxRates[state.taxCode] * 100) / 100;
  return { state: { ...state, gross: amount, tax, net: amount - tax }, net: amount - tax, tax };
}

export function setTaxCode(state: LifeSystemsState["payslip"], taxCode: "M" | "S"): LifeSystemsState["payslip"] { return { ...state, taxCode }; }

export function step(state: LifeSystemsState["payslip"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["payslip"]> { return { state, events: [] }; }