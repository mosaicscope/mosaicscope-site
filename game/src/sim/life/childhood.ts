import type { Rng } from "../../core/rng";
import { CHILDHOOD } from "../../content/life/childhood";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["childhood"], tick: number, _rng: Rng): LifeStep<LifeSystemsState["childhood"]> {
  const ageDays = state.ageDays + Math.max(0, tick - state.lastTick) / 86400;
  const stage = ageDays >= CHILDHOOD.adultAtDays ? "adult" : ageDays >= CHILDHOOD.teenAtDays ? "teen" : "child";
  const events = stage !== state.stage ? [{ type: "life_growing_up", summary: `A new life stage: ${stage}.` }] : [];
  return { state: { ...state, ageDays, stage, lastTick: tick }, events };
}