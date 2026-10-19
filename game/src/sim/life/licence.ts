import type { Rng } from "../../core/rng";
import { LICENCE } from "../../content/life/licence";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function practice(state: LifeSystemsState["licence"], tick: number): LifeSystemsState["licence"] | null {
  if (tick - state.lastPractice < LICENCE.practiceCooldown) return null;
  return { ...state, practiceHours: state.practiceHours + 1, lastPractice: tick };
}

export function test(state: LifeSystemsState["licence"], rng: Rng): { state: LifeSystemsState["licence"]; passed: boolean } {
  const needed = state.stage === "learner" ? LICENCE.practiceForRestricted : LICENCE.practiceForFull;
  if (state.stage === "full" || state.practiceHours < needed) return { state, passed: false };
  const passed = rng.chance(LICENCE.testPassChance);
  return { state: passed ? { ...state, stage: state.stage === "learner" ? "restricted" : "full", practiceHours: 0 } : state, passed };
}

export function step(state: LifeSystemsState["licence"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["licence"]> { return { state, events: [] }; }