import type { Rng } from "../../core/rng";
import { BUDGET } from "../../content/life/budget";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["budget"], tick: number, _rng: Rng, cash: number, rent: number = BUDGET.rent): LifeStep<LifeSystemsState["budget"]> {
  let nextBill = state.nextBill, arrears = state.arrears, balance = Math.max(0, cash);
  const events: LifeStep<LifeSystemsState["budget"]>["events"] = [];
  while (nextBill <= tick) {
    const due = rent + BUDGET.power + BUDGET.phone + BUDGET.groceries;
    const paid = Math.min(balance, due);
    balance -= paid;
    arrears = Math.min(BUDGET.arrearsCap, arrears + due - paid);
    events.push({ type: "life_bill", summary: `Weekly household bills: $${due}; $${due - paid} added to arrears.`, cashDelta: -paid });
    nextBill += BUDGET.billPeriodTicks;
  }
  return { state: { ...state, nextBill, arrears }, events };
}