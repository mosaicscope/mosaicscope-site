import type { Rng } from "../../core/rng";
import { SAVINGS } from "../../content/life/savings";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["savings"], tick: number, _rng: Rng, balance: number): LifeStep<LifeSystemsState["savings"]> {
  const weeks = Math.floor(Math.max(0, tick - state.lastInterest) / SAVINGS.weekTicks);
  if (!weeks) return { state, events: [] };
  const interest = Math.floor(Math.max(0, balance) * SAVINGS.weeklyInterestRate * weeks * 100) / 100;
  return { state: { lastInterest: state.lastInterest + weeks * SAVINGS.weekTicks }, events: interest ? [{ type: "life_interest", summary: `Savings earned $${interest.toFixed(2)} interest.`, savingsDelta: interest }] : [] };
}