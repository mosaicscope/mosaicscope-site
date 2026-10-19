import type { Rng } from "../../core/rng";
import { SLEEP } from "../../content/life/sleep";

export interface SleepState {
  fatigue: number;
  lastTick: number;
  sleepUntil: number;
  tiredNoted: boolean;
  exhaustedNoted: boolean;
}

export interface SleepEvent {
  type: "life_tired" | "life_exhausted" | "life_rested";
  summary: string;
}

export const newSleepState = (): SleepState => ({
  fatigue: 0.1,
  lastTick: 0,
  sleepUntil: 0,
  tiredNoted: false,
  exhaustedNoted: false,
});

export function beginSleep(state: SleepState, tick: number): SleepState {
  return {
    ...state,
    sleepUntil: tick + SLEEP.standardSleepHours * 3600,
    lastTick: tick,
  };
}

export function step(
  state: SleepState,
  tick: number,
  _rng: Rng,
  resting = false,
): { state: SleepState; events: SleepEvent[] } {
  const elapsedHours = Math.max(0, tick - state.lastTick) / 3600;
  const wasSleeping = state.sleepUntil > state.lastTick;
  const sleptHours = Math.max(0, Math.min(tick, state.sleepUntil) - state.lastTick) / 3600;
  const awakeHours = Math.max(0, elapsedHours - sleptHours);
  const recovery = sleptHours * SLEEP.sleepingRecoveryPerHour +
    awakeHours * (resting ? SLEEP.restingRecoveryPerHour : -SLEEP.awakeFatiguePerHour);
  const fatigue = Math.max(0, Math.min(1, state.fatigue - recovery));
  const next: SleepState = {
    ...state,
    fatigue,
    lastTick: tick,
    sleepUntil: tick >= state.sleepUntil ? 0 : state.sleepUntil,
    tiredNoted: fatigue >= SLEEP.tiredAt ? state.tiredNoted : false,
    exhaustedNoted: fatigue >= SLEEP.exhaustedAt ? state.exhaustedNoted : false,
  };
  const events: SleepEvent[] = [];
  if (fatigue >= SLEEP.exhaustedAt && !next.exhaustedNoted) {
    next.exhaustedNoted = true;
    events.push({ type: "life_exhausted", summary: "You are exhausted and need proper sleep." });
  } else if (fatigue >= SLEEP.tiredAt && !next.tiredNoted) {
    next.tiredNoted = true;
    events.push({ type: "life_tired", summary: "You are getting tired. A rest would help." });
  }
  if (wasSleeping && tick >= state.sleepUntil && fatigue < SLEEP.tiredAt) {
    events.push({ type: "life_rested", summary: "You got some proper sleep and feel rested." });
  }
  return { state: next, events };
}