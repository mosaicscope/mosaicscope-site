import type { Simulation } from "./Simulation";

/** Time of day, weather (seeded Markov chain), power and party state. */
export type Weather = "clear" | "cloudy" | "rain" | "storm";
export const TICKS_PER_HOUR = 3600; // one game hour = one real minute at 1x

export interface EnvState {
  weather: Weather;
  raining: boolean;
  storm: boolean;
  rain: number;            // 0..1 render intensity
  power: boolean;
  powerBackAt: number;
  party: boolean;
  partyUntil: number;
  boomboxCooldown: number;
  lightningAt: number;
  startHour: number;
}

export function newEnv(): EnvState {
  return { weather: "clear", raining: false, storm: false, rain: 0, power: true, powerBackAt: 0, party: false, partyUntil: 0, boomboxCooldown: 0, lightningAt: -1, startHour: 17 };
}

const NEXT: Record<Weather, [Weather, number][]> = {
  clear: [["clear", 0.82], ["cloudy", 0.18]],
  cloudy: [["clear", 0.35], ["cloudy", 0.4], ["rain", 0.25]],
  rain: [["cloudy", 0.35], ["rain", 0.45], ["storm", 0.2]],
  storm: [["rain", 0.6], ["storm", 0.4]],
};

export function updateEnvironment(sim: Simulation): void {
  const env = sim.env, tick = sim.tick, rng = sim.rng;
  // weather transitions every game half-hour
  if (sim.flags.weather && tick % (TICKS_PER_HOUR / 2) === 0 && tick > 0) {
    const opts = NEXT[env.weather];
    const next = opts[rng.weighted(opts.map((o) => o[1]))][0];
    if (next !== env.weather) {
      const was = env.weather;
      env.weather = next; env.raining = next === "rain" || next === "storm"; env.storm = next === "storm";
      sim.emit({ type: "weather", x: sim.world.size / 2, y: sim.world.size / 2, data: { from: was, to: next }, summary: `Weather: ${was} → ${next}` });
    }
  }
  env.rain += ((env.raining ? (env.storm ? 1 : 0.6) : 0) - env.rain) * 0.01;
  if (env.storm && rng.chance(1 / 400)) env.lightningAt = tick;
  // blackouts: storms at night can knock the power out
  if (sim.flags.powerOutages && env.power && sim.isDark && tick % 600 === 0) {
    const p = env.storm ? 0.25 : 0.015;
    if (rng.chance(p)) {
      env.power = false; env.powerBackAt = tick + rng.int(40, 80) * 60;
      for (const poi of sim.world.pois) if (poi.kind === "lamp") poi.on = false;
      const was = env.party;
      sim.emit({ type: "blackout", x: sim.world.size / 2, y: sim.world.size / 2, summary: was ? "Power cut killed the party" : "The power went out" });
      if (was) sim.endParty("blackout");
    }
  }
  if (!env.power && tick >= env.powerBackAt) {
    env.power = true;
    for (const poi of sim.world.pois) if (poi.kind === "lamp") poi.on = true;
    sim.emit({ type: "power_back", x: sim.world.size / 2, y: sim.world.size / 2, summary: "Power's back on" });
  }
  if (env.party && tick >= env.partyUntil) sim.endParty("time");
}

/** 0 (midnight dark) .. 1 (full day) */
export function daylight(hour: number): number {
  if (hour >= 7 && hour <= 18) return 1;
  if (hour > 18 && hour < 21) return 1 - (hour - 18) / 3;
  if (hour >= 5 && hour < 7) return (hour - 5) / 2;
  return 0;
}
