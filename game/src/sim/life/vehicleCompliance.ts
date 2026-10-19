import type { Rng } from "../../core/rng";
import { VEHICLE_COMPLIANCE } from "../../content/life/vehicleCompliance";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function isRoadLegal(state: LifeSystemsState["wof"], tick: number): boolean { return tick < state.expires && tick < state.regoExpires; }
export function renew(state: LifeSystemsState["wof"], tick: number, kind: "wof" | "rego"): LifeSystemsState["wof"] {
  return kind === "wof" ? { ...state, expires: tick + VEHICLE_COMPLIANCE.renewalTicks } : { ...state, regoExpires: tick + VEHICLE_COMPLIANCE.renewalTicks };
}
export function step(state: LifeSystemsState["wof"], tick: number, _rng: Rng, driving = false): LifeStep<LifeSystemsState["wof"]> {
  if (!driving || isRoadLegal(state, tick) || tick - state.lastCitation < 24 * 3600) return { state, events: [] };
  const next = { ...state, citations: state.citations + 1, lastCitation: tick };
  return { state: next, events: [{ type: "life_traffic_fine", summary: "Traffic enforcement issued a fine for expired WOF or registration.", fineAmount: VEHICLE_COMPLIANCE.expiredFine }] };
}