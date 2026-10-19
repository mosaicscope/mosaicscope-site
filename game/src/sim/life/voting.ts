import type { Rng } from "../../core/rng";
import { VOTING } from "../../content/life/voting";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function vote(state: LifeSystemsState["voting"], tick: number): LifeSystemsState["voting"] | null {
  if (tick - state.lastElection < VOTING.electionPeriod) return null;
  return { lastElection: tick, votes: state.votes + 1 };
}
export function step(state: LifeSystemsState["voting"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["voting"]> { return { state, events: [] }; }