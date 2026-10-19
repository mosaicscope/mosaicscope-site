import type { Rng } from "../../core/rng";
import { RENTING } from "../../content/life/renting";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function moveIn(state: LifeSystemsState["renting"], cash: number): { state: LifeSystemsState["renting"]; cashDelta: number } | null {
  const bond = state.weeklyRent * RENTING.bondWeeks;
  if (cash < bond || state.bondPaid) return null;
  return { state: { ...state, bondPaid: true }, cashDelta: -bond };
}

export function step(state: LifeSystemsState["renting"], tick: number, _rng: Rng): LifeStep<LifeSystemsState["renting"]> {
  if (tick < state.nextRise) return { state, events: [] };
  const weeklyRent = Math.ceil(state.weeklyRent * (1 + RENTING.weeklyRise));
  return { state: { ...state, weeklyRent, nextRise: tick + 365 * 24 * 3600 }, events: [{ type: "life_rent_rise", summary: `Weekly rent rose to $${weeklyRent}.` }] };
}

export function inspect(state: LifeSystemsState["renting"], tick: number): LifeSystemsState["renting"] | null {
  if (tick - state.lastInspection < RENTING.inspectionTicks) return null;
  return { ...state, lastInspection: tick };
}