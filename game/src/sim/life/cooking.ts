import type { Rng } from "../../core/rng";
import { COOKING } from "../../content/life/cooking";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function cook(state: LifeSystemsState["cooking"], tick: number): LifeSystemsState["cooking"] | null {
  if (tick - state.lastCook < COOKING.cooldown) return null;
  return { ...state, meals: state.meals + 1, lastCook: tick, quality: COOKING.quality };
}
export function step(state: LifeSystemsState["cooking"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["cooking"]> { return { state, events: [] }; }