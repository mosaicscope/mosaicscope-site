import type { Simulation } from "./Simulation";
import type { Character } from "../entities/types";
import type { CrimeType } from "./Society";
import { CRIME_STARS } from "./Society";
import { CREWS } from "./Turf";
import { forceGoal } from "../ai/brain";

/**
 * Street rep: each crew (see content/lore.ts) remembers what the player does to it and to its rival.
 * -100..100 per crew. Hurting a crew's people costs rep with them and earns a little with their rival;
 * other crimes earn general street cred with both. High rep: crew members greet you and won't start on you.
 * Very low rep: they come for you after dark.
 */

export type Rank = "marked" | "unwelcome" | "nobody" | "known face" | "associate" | "made";
export const RIVAL: Record<string, string> = { famiglia: "riccarton", riccarton: "famiglia" };

export function rankOf(v: number): Rank {
  return v <= -40 ? "marked" : v < -10 ? "unwelcome" : v < 15 ? "nobody" : v < 40 ? "known face" : v < 80 ? "associate" : "made";
}

/** The player's rep table, created on first use. Stored on the character, so it saves with it. */
export function repOf(p: Character): Record<string, number> {
  p.rep ??= {};
  for (const id of Object.keys(CREWS)) p.rep[id] ??= 0;
  return p.rep;
}

const clampRep = (v: number) => Math.max(-100, Math.min(100, v));

/** Adjust one crew's rep, announcing any change of rank. */
export function addRep(sim: Simulation, p: Character, crew: string, delta: number, why: string): void {
  const rep = repOf(p);
  const before = rankOf(rep[crew]);
  rep[crew] = clampRep(rep[crew] + delta);
  const after = rankOf(rep[crew]);
  if (after !== before && sim.events.defs.has("rep_change")) {
    sim.emit({ type: "rep_change", x: p.x, y: p.y, actors: [p.id], data: { crew, rank: after },
      summary: `${CREWS[crew].name} now see you as ${after === "made" || after === "marked" ? "" : "a "}${after} (${why})` });
  }
}

/** Called for every crime the player commits (from Society.commitCrime). */
export function onPlayerCrime(sim: Simulation, p: Character, type: CrimeType, victim: Character | null, noticed: boolean): void {
  const stars = CRIME_STARS[type];
  const crew = victim?.crew;
  if (crew && CREWS[crew]) {
    addRep(sim, p, crew, -12 * stars, `you hit one of theirs`);
    const rival = RIVAL[crew];
    if (rival) addRep(sim, p, rival, 6 * stars, `you hit ${CREWS[crew].name}`);
  } else if (noticed) {
    // a public crime builds street cred with both crews, a little
    for (const id of Object.keys(CREWS)) addRep(sim, p, id, stars, "word gets around");
  }
}

const tmp: number[] = [];
const lastMove = new WeakMap<Character, number>();

/** Crew members react to the player's standing. Cheap: runs a few times a second of game time. */
export function updateRep(sim: Simulation): void {
  if (sim.tick % 90 !== 0) return;
  const p = sim.player;
  if (!p || p.inside >= 0) return;
  const rep = repOf(p);
  const n = sim.charHash.query(p.x, p.y, 7, tmp);
  for (let i = 0; i < n; i++) {
    const c = sim.chars[tmp[i]];
    if (c === p || !c.crew || c.talkWith >= 0 || c.inside >= 0 || c.inCar >= 0) continue;
    const r = rankOf(rep[c.crew] ?? 0);
    if (sim.tick - (lastMove.get(c) ?? -1e9) < 60 * 90) continue; // each member reacts at most every 90 s
    if (r === "marked" && sim.isDark) {
      lastMove.set(c, sim.tick);
      sim.say(c, `${CREWS[c.crew].name} remember you.`, "shout", 2);
      forceGoal(c, sim, "fight", { u: 1, target: p.id });
    } else if ((r === "associate" || r === "made") && sim.rng.chance(0.25)) {
      lastMove.set(c, sim.tick);
      sim.say(c, r === "made" ? "Boss. Anything you need." : "Alright, mate. You're good with us.", "say", 2);
      const rel = sim.relate(c, p.id); rel.trust = Math.min(1, rel.trust + 0.05);
    }
  }
}

export function registerRepEvents(sim: Simulation): void {
  if (!sim.events.defs.has("rep_change")) sim.events.register({ type: "rep_change", label: "Street rep", priority: 4, severity: 2, radius: 1, cooldown: 0, propagation: "sight", topic: "crime" });
}

/** One line for the AI character card: how this crew member sees the player. */
export function repLine(c: Character, sim: Simulation): string {
  const p = sim.player;
  if (!c.crew || !p || !CREWS[c.crew]) return "";
  return `You run with ${CREWS[c.crew].name}. To your crew the newcomer (${p.name}) is ${rankOf(repOf(p)[c.crew] ?? 0)}.`;
}
