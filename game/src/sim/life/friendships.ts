import type { Rng } from "../../core/rng";
import { FRIENDSHIPS } from "../../content/life/friendships";
import type { LifeSystemsState } from "./state";
import type { LifeStep } from "./types";

export function gift(state: LifeSystemsState["friendships"], tick: number, trust: number): { state: LifeSystemsState["friendships"]; trust: number } | null {
  if (tick - state.lastGift < FRIENDSHIPS.giftCooldown) return null;
  return { state: { gifts: state.gifts + 1, lastGift: tick }, trust: Math.min(1, trust + FRIENDSHIPS.giftTrust) };
}
export function step(state: LifeSystemsState["friendships"], _tick: number, _rng: Rng): LifeStep<LifeSystemsState["friendships"]> { return { state, events: [] }; }