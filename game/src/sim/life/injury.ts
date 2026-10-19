import type { Rng } from "../../core/rng";
import { INJURY_RECOVERY } from "../../content/life/injury";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["injury"], tick: number, _rng: Rng, treated = false): LifeStep<LifeSystemsState["injury"]> {
  const hours = Math.max(0, tick - state.lastTick) / 3600;
  const sprain = Math.max(0, state.sprain - hours * INJURY_RECOVERY.sprainPerHour * (treated ? 2 : 1));
  const scarDue = state.injuredAt >= 0 && tick - state.injuredAt >= INJURY_RECOVERY.scarAfterHours * 3600;
  const scar = scarDue ? Math.min(1, state.scar + 0.1) : state.scar;
  const events = state.sprain > 0 && sprain === 0 ? [{ type: "life_injury_recovered", summary: "Your sprain has healed." }] : [];
  return { state: { ...state, sprain, scar, lastTick: tick }, events };
}

export function injure(state: LifeSystemsState["injury"], severity: number, tick: number): LifeSystemsState["injury"] {
  return { ...state, sprain: Math.min(1, Math.max(state.sprain, severity)), lastTick: tick, injuredAt: tick };
}