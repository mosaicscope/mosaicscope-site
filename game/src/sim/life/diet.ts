import type { Rng } from "../../core/rng";
import { DIET } from "../../content/life/diet";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["diet"], tick: number, _rng: Rng): LifeStep<LifeSystemsState["diet"]> {
  const hours = Math.max(0, tick - state.lastTick) / 3600;
  const hunger = Math.max(0, state.hunger - hours * DIET.hungerPerHour);
  return { state: { ...state, hunger, weight: Math.max(35, state.weight + (hunger < 0.15 ? -0.01 : 0) * hours), lastTick: tick }, events: [] };
}

export function eat(state: LifeSystemsState["diet"], quality: number): LifeSystemsState["diet"] {
  const q = Math.max(0, Math.min(1, quality));
  return { ...state, hunger: Math.min(1, state.hunger + 0.25 + q * 0.35), foodQuality: q, weight: Math.max(35, state.weight + (q > DIET.goodMealQuality ? DIET.weightPerMeal : 0)) };
}