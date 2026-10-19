import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { beginSleep, newSleepState, step } from "../src/sim/life/sleep";

describe("sleep and fatigue", () => {
  it("builds fatigue while awake and emits a tired event once", () => {
    let state = newSleepState();
    const rng = new Rng(17);
    let events: string[] = [];
    for (let hour = 1; hour <= 8; hour++) {
      const result = step(state, hour * 3600, rng);
      state = result.state;
      events.push(...result.events.map((event) => event.type));
    }
    expect(state.fatigue).toBeGreaterThan(0.65);
    expect(events).toEqual(["life_tired"]);
  });

  it("recovers during sleep and does not exceed zero fatigue", () => {
    const rng = new Rng(17);
    const asleep = beginSleep({ ...newSleepState(), fatigue: 0.9 }, 100);
    const result = step(asleep, 8 * 3600 + 101, rng);
    expect(result.state.fatigue).toBe(0);
    expect(result.events.some((event) => event.type === "life_rested")).toBe(true);
  });

  it("announces waking when an hourly tick lands exactly at the sleep end", () => {
    const asleep = beginSleep(newSleepState(), 100);
    const result = step(asleep, 8 * 3600 + 100, new Rng(17));
    expect(result.events.some((event) => event.type === "life_rested")).toBe(true);
  });

  it("does not mutate saved input state", () => {
    const state = newSleepState();
    step(state, 3600, new Rng(17));
    expect(state).toEqual(newSleepState());
  });
});