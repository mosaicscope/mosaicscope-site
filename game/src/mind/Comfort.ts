import type { Weather } from "../sim/Environment";

/**
 * Weather and appetite: people reach for hot, filling food when it is wet and cold, and for cold treats
 * when it is clear. Confidence: LOW to MEDIUM. This matches everyday experience and common market
 * reports that hot drinks and pies sell better in cold, wet weather, but no specific study is cited here
 * because none was checked. The size of the effect is a game-design choice, kept small (at most +0.14 on a
 * utility scale where taste spans about 0.5) so it nudges menus without overriding hunger or aversions.
 * Pure and deterministic: no randomness, no state.
 */
export const WARM_FOODS: readonly string[] = ["flat_white", "pie", "bao", "fish_chips", "burger", "kebab"];
export const COLD_TREATS: readonly string[] = ["hokey_pokey", "lp"];

const WARM: Record<Weather, number> = { clear: 0, cloudy: 0.03, rain: 0.1, storm: 0.14 };
const COLD: Record<Weather, number> = { clear: 0.08, cloudy: 0.02, rain: -0.03, storm: -0.05 };

/** Extra appetite (utility units, about -0.05..0.14) for `def` in this weather; 0 for anything else. */
export function comfortPull(def: string, weather: Weather | undefined): number {
  if (!weather) return 0;
  if (WARM_FOODS.includes(def)) return WARM[weather];
  if (COLD_TREATS.includes(def)) return COLD[weather];
  return 0;
}
