import { Character } from "../entities/types";
import { clamp } from "../core/math";

/**
 * Needs drift over time; mood follows needs and recent emotion. Called on each AI think with the
 * real simulated seconds since the last think, so reduced-LOD characters stay consistent.
 */
export function updateNeeds(c: Character, dt: number, ctx: { raining: boolean; dark: boolean; sheltered: boolean; party: boolean }): void {
  const n = c.needs, e = c.emo, p = c.pers;
  const active = c.vx * c.vx + c.vy * c.vy > 0.2;
  n.energy = clamp(n.energy - dt * (active ? 0.0016 : 0.0005), 0, 1);
  n.social = clamp(n.social - dt * 0.0025 * (0.5 + p.sociability), 0, 1);
  n.fun = clamp(n.fun - dt * 0.0025 * (0.5 + p.playfulness), 0, 1);
  n.curiosity = clamp(n.curiosity - dt * 0.003 * (0.4 + p.curiosity), 0, 1);
  c.hunger = clamp(c.hunger - dt * 0.0011, 0, 1);
  if (c.hunger < 0.2) e.frustration = clamp(e.frustration + dt * 0.006, 0, 1);
  e.fear = clamp(e.fear - dt * (0.04 + p.boldness * 0.05), 0, 1);
  e.frustration = clamp(e.frustration - dt * (0.015 + (1 - p.temper) * 0.02), 0, 1);
  if (ctx.raining && !ctx.sheltered) { e.frustration = clamp(e.frustration + dt * 0.01, 0, 1); n.fun = clamp(n.fun - dt * 0.004, 0, 1); }
  if (ctx.dark && c.fears.includes("blackout")) e.fear = clamp(e.fear + dt * 0.03, 0, 1);
  if (ctx.party) { n.fun = clamp(n.fun + dt * 0.01, 0, 1); n.social = clamp(n.social + dt * 0.005, 0, 1); }
  // mood: weighted needs minus negative emotion, eased
  const target = clamp((n.energy + n.social + n.fun + n.curiosity) / 2 - 1 + 0.35 - e.fear * 0.8 - e.frustration * 0.6 + (e.confidence - 0.5) * 0.3, -1, 1);
  e.mood += (target - e.mood) * clamp(dt * 0.15, 0, 1);
}

/** Short label for the inspector. */
export function moodWord(c: Character): string {
  const e = c.emo;
  if (e.composure < 0.2) return "dazed";
  if (e.fear > 0.6) return "scared";
  if (e.frustration > 0.6) return "furious";
  if (e.frustration > 0.35) return "annoyed";
  if (c.needs.energy < 0.2) return "exhausted";
  if (c.hunger < 0.2) return "starving";
  if (c.needs.fun < 0.2) return "bored";
  if (c.needs.social < 0.2) return "lonely";
  if (e.mood > 0.5) return "buzzing";
  if (e.mood > 0.15) return "good";
  if (e.mood > -0.2) return "ok";
  return "low";
}
