import { Simulation } from "../src/sim/Simulation";
import { Character } from "../src/entities/types";

export const small = (seed = 3, extra: Record<string, number> = {}) => new Simulation({ seed, midCount: 12, backgroundCount: 30, ...extra });
export const byName = (sim: Simulation, n: string): Character => sim.chars.find((c) => c.name === n)!;
/** Put two characters somewhere open, side by side, and freeze their AI so tests control them. */
export function stage(sim: Simulation, a: Character, b: Character, gap = 3): void {
  const p = sim.world.areas.find((x) => x.kind === "plaza")!;
  const x = p.x0 + 2.5, y = p.y0 + 2.5;
  for (const [c, dx] of [[a, 0], [b, gap]] as const) { c.x = c.px = x + dx; c.y = c.py = y; c.goal = null; c.nextThink = 1e9; c.vx = c.vy = 0; c.talkWith = -1; }
  a.facing = 0; b.facing = Math.PI;
  sim.rebuildHash();
}
/** Empty someone's hands and bag; the toys are taken out of play so they can't interfere. */
export function emptyHands(sim: Simulation, c: Character): void {
  for (const id of [c.hand, ...c.bag]) { const t = sim.toys[id]; if (t) { t.state = "broken"; t.brokenAt = sim.tick; t.holder = -1; t.x = -100; t.y = -100; } }
  c.hand = -1; c.bag = [];
}
export function hashState(sim: Simulation): string {
  let h = 0;
  const mix = (v: number) => { h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) + 0x9e3779b9) | 0; };
  for (const c of sim.chars) { mix(c.x); mix(c.y); mix(c.emo.mood); mix(c.hand); mix(c.rel.size); }
  for (const t of sim.toys) { mix(t.x); mix(t.y); mix(t.z); mix(t.holder); }
  mix(sim.events.history.length);
  return (h >>> 0).toString(16);
}
