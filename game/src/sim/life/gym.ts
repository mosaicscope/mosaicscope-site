import type { Rng } from "../../core/rng";
import { GYM } from "../../content/life/gym";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function workout(state: LifeSystemsState["gym"], tick: number): LifeSystemsState["gym"] | null {
  if (tick - state.lastWorkout < GYM.cooldown) return null;
  return { ...state, fitness: Math.min(1, state.fitness + GYM.fitnessGain), lastWorkout: tick };
}
export function step(state: LifeSystemsState["gym"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["gym"]> { return { state, events: [] }; }