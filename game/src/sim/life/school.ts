import type { Rng } from "../../core/rng";
import { SCHOOL } from "../../content/life/school";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function study(state: LifeSystemsState["school"], tick: number): LifeSystemsState["school"] | null {
  if (tick - state.lastStudy < SCHOOL.studyCooldown) return null;
  return { ...state, credits: state.credits + 1, lastStudy: tick };
}
export function sitExam(state: LifeSystemsState["school"], rng: Rng): { state: LifeSystemsState["school"]; passed: boolean } {
  if (!state.credits) return { state, passed: false };
  const passed = rng.chance(Math.min(0.95, 0.55 + state.credits * 0.05));
  return { state: passed ? { ...state, grade: Math.min(100, state.grade + state.credits), credits: 0 } : state, passed };
}
export function step(state: LifeSystemsState["school"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["school"]> { return { state, events: [] }; }