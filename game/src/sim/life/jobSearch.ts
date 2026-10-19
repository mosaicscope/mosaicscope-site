import type { Rng } from "../../core/rng";
import { JOB_SEARCH } from "../../content/life/jobSearch";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function apply(state: LifeSystemsState["jobSearch"], tick: number): LifeSystemsState["jobSearch"] {
  if (state.applications >= JOB_SEARCH.maxApplications || state.nextReply > tick) return state;
  return { applications: state.applications + 1, nextReply: tick + JOB_SEARCH.replyTicks, message: "Application sent. Check back after the interview window." };
}

export function step(state: LifeSystemsState["jobSearch"], tick: number, rng: Rng): LifeStep<LifeSystemsState["jobSearch"]> {
  if (!state.applications || tick < state.nextReply || state.message.startsWith("Reply:")) return { state, events: [] };
  const message = rng.chance(JOB_SEARCH.offerChance) ? "Reply: interview offer received." : "Reply: no offer this time. Try another role.";
  return { state: { ...state, message }, events: [{ type: "life_job_reply", summary: message }] };
}