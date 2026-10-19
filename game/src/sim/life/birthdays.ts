import type { Rng } from "../../core/rng";
import { BIRTHDAYS } from "../../content/life/birthdays";
import type { LifeStep } from "./types";
import type { LifeSystemsState } from "./state";

export function step(state: LifeSystemsState["birthdays"], tick: number, _rng: Rng): LifeStep<LifeSystemsState["birthdays"]> {
  const day = Math.floor(tick / BIRTHDAYS.yearTicks);
  if (day <= state.lastDay) return { state, events: [] };
  return { state: { ...state, lastDay: day, giftsReceived: state.giftsReceived + 1 }, events: [{ type: "life_birthday", summary: "Happy birthday! Your friends remembered." }] };
}
export function giveGift(state: LifeSystemsState["birthdays"]): LifeSystemsState["birthdays"] { return { ...state, giftsReceived: state.giftsReceived + 1 }; }