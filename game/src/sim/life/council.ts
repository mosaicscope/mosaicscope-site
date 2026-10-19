import type { Rng } from "../../core/rng";
import { COUNCIL } from "../../content/life/council";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["council"], tick: number, _rng: Rng): LifeStep<LifeSystemsState["council"]> {
  const due = Math.floor(Math.max(0, tick - state.binDay) / COUNCIL.collectionTicks);
  if (!due) return { state, events: [] };
  const ratesDue = Math.min(COUNCIL.ratesCap, state.ratesDue + due * COUNCIL.ratesPerDay * 7);
  const overdueWeeks = state.ratesDue > 0 ? due : Math.max(0, due - 1);
  const events: LifeStep<LifeSystemsState["council"]>["events"] = [
    { type: "life_council_rates", summary: `Council rates are due: $${ratesDue}.` },
    { type: "life_bin_collection", summary: "Kerbside bins were collected and emptied." },
  ];
  if (overdueWeeks) events.push({ type: "life_council_fine", summary: `Council added $${overdueWeeks * COUNCIL.lateFine} in late fees.`, fineAmount: overdueWeeks * COUNCIL.lateFine });
  return { state: { ...state, ratesDue, binDay: state.binDay + due * COUNCIL.collectionTicks }, events };
}
export function payRates(state: LifeSystemsState["council"]): LifeSystemsState["council"] { return { ...state, ratesDue: 0, fines: 0 }; }