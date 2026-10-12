import type { Simulation } from "./Simulation";
import { Character } from "../entities/types";
import { friendship, hostility, peek, remember, applyInteraction } from "../social/Social";
import { forceGoal } from "../ai/brain";

/**
 * Romance. Attraction follows each person's own preferences; feelings ("love") grow through flirting
 * and dates. Couples kiss, go on dates and sometimes head home together (off-screen; the game shows
 * hearts, nothing more). Unhappy partners with loose morals may start an affair. Anyone who sees a
 * cheater kissing someone else can tell the partner, and that leads to jealousy and break-ups.
 * Everyone in this world is an adult.
 */
export const attracted = (a: Character, b: Character) => a !== b && a.tier !== "player" && b.tier !== "background" && a.attractedTo.includes(b.look.kind);
export const loveOf = (a: Character, b: number) => peek(a, b)?.love ?? 0;

export function addLove(sim: Simulation, a: Character, b: Character, d: number): void {
  if (!a.attractedTo.includes(b.look.kind)) return;
  const r = sim.relate(a, b.id);
  r.love = Math.max(0, Math.min(1, (r.love ?? 0) + d));
}

/** How well two people click (stable for a pair). */
export function chemistry(a: Character, b: Character): number {
  const p = a.pers, q = b.pers;
  const sim = 1 - (Math.abs(p.playfulness - q.playfulness) * 0.4 + Math.abs(p.sociability - q.sociability) * 0.3 + Math.abs(p.curiosity - q.curiosity) * 0.3);
  const spark = ((a.id * 7919 + b.id * 104729) % 97) / 97; // some pairs just have it
  return Math.max(0, Math.min(1, sim * 0.6 + spark * 0.4));
}

/** Will this person flirt back right now? */
export function receptive(sim: Simulation, b: Character, a: Character): boolean {
  if (!attracted(b, a)) return false;
  if (b.partner >= 0 && b.partner !== a.id && !(b.pers.honesty < 0.35 && loveOf(b, b.partner) < 0.5)) return false;
  return chemistry(a, b) + friendship(peek(b, a.id)) * 0.5 - hostility(peek(b, a.id)) + sim.rng.range(-0.15, 0.15) > 0.45;
}

export function getTogether(sim: Simulation, a: Character, b: Character): void {
  const secret = a.partner >= 0 && a.partner !== b.id || b.partner >= 0 && b.partner !== a.id;
  if (secret) {
    a.affair = b.id; b.affair = a.id;
    sim.emit({ type: "affair", x: a.x, y: a.y, actors: [a.id, b.id], priority: 2, severity: 1, summary: `${a.name} and ${b.name} are secretly seeing each other` });
  } else {
    a.partner = b.id; b.partner = a.id;
    sim.emit({ type: "together", x: a.x, y: a.y, actors: [a.id, b.id], summary: `${a.name} and ${b.name} are officially together` });
    sim.bus.emit("fx", { kind: "heart", x: a.x, y: a.y, z: 1.8, n: 6 });
  }
}

export function breakUp(sim: Simulation, a: Character, b: Character, why: string): void {
  if (a.partner === b.id) a.partner = -1;
  if (b.partner === a.id) b.partner = -1;
  if (a.affair === b.id) a.affair = -1;
  if (b.affair === a.id) b.affair = -1;
  for (const [x, y] of [[a, b], [b, a]] as const) { const r = sim.relate(x, y.id); r.love = (r.love ?? 0) * 0.3; r.trust = Math.max(-1, r.trust - 0.4); r.aff = Math.max(-1, r.aff - 0.3); remember(x, { t: sim.tick, kind: "broke_up", subj: x.id, obj: y.id, toy: null, area: sim.world.areaAt(x.x, x.y)?.id ?? 0, val: -0.8, ev: -1, src: "did" }); x.emo.mood = Math.max(-1, x.emo.mood - 0.5); }
  sim.emit({ type: "breakup", x: a.x, y: a.y, actors: [a.id, b.id], severity: 3, summary: `${a.name} and ${b.name} broke up (${why})` });
}

/** Someone learns their partner is cheating: confront, argue, maybe break up or go after the lover. */
export function discoverCheating(sim: Simulation, victim: Character, cheater: Character, lover: Character | null, how: "saw" | "told"): void {
  if (victim.partner !== cheater.id) return;
  const r = sim.relate(victim, cheater.id);
  r.trust = Math.max(-1, r.trust - 0.6); r.grudge = Math.min(1, r.grudge + 0.5);
  r.love = Math.max(0, (r.love ?? 0) - 0.3); // even if they forgive, it stings
  victim.emo.frustration = Math.min(1, victim.emo.frustration + 0.5);
  const e = sim.emit({ type: "caught_cheating", x: victim.x, y: victim.y, actors: [victim.id, cheater.id, ...(lover ? [lover.id] : [])], severity: 4,
    summary: how === "saw" ? `${victim.name} caught ${cheater.name} with ${lover?.name ?? "someone else"}` : `${victim.name} found out ${cheater.name} has been cheating${lover ? ` with ${lover.name}` : ""}` });
  if (lover) { const rl = sim.relate(victim, lover.id); rl.grudge = Math.min(1, rl.grudge + 0.6); rl.rivalry = Math.min(1, rl.rivalry + 0.6); }
  sim.emitArgument(victim, cheater, e);
  // forgiveness is rare; temper decides whether the lover gets confronted too
  if (victim.pers.kindness + loveOf(victim, cheater.id) * 0.5 < 0.9 || sim.rng.chance(0.6)) breakUp(sim, victim, cheater, "cheating");
  if (lover && victim.pers.temper + victim.pers.boldness > 1.2) sim.afterConversation(() => forceGoal(victim, sim, "fight", { u: 1, target: lover.id }));
}

/** Kiss + witnesses: an affair seen by someone who knows the betrayed partner becomes gossip. */
export function kiss(sim: Simulation, a: Character, b: Character): void {
  addLove(sim, a, b, 0.08); addLove(sim, b, a, 0.08);
  applyInteraction(a, b, "play", true, sim.tick, 0.5); applyInteraction(b, a, "play", true, sim.tick, 0.5);
  sim.bus.emit("fx", { kind: "heart", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 1.9, n: 4 });
  for (const [x, y] of [[a, b], [b, a]] as const) remember(x, { t: sim.tick, kind: "kissed", subj: x.id, obj: y.id, toy: null, area: sim.world.areaAt(x.x, x.y)?.id ?? 0, val: 0.6, ev: -1, src: "did" });
  const cheaters = [a, b].filter((c) => c.partner >= 0 && c.partner !== (c === a ? b.id : a.id));
  sim.emit({ type: "kiss", x: a.x, y: a.y, actors: [a.id, b.id], priority: cheaters.length ? 6 : 2, severity: cheaters.length ? 2 : 1, summary: `${a.name} and ${b.name} kissed` });
  if (!cheaters.length) return;
  const tmp: number[] = [];
  const n = sim.charHash.query(a.x, a.y, 9, tmp);
  for (const cheater of cheaters) {
    const lover = cheater === a ? b : a, betrayed = sim.chars[cheater.partner];
    if (!betrayed) continue;
    for (let i = 0; i < n; i++) {
      const w = sim.chars[tmp[i]];
      if (w === a || w === b || w.tier === "background" && !w.promoted || !sim.world.lineOfSight(w.x, w.y, a.x, a.y)) continue;
      if (w === betrayed) { discoverCheating(sim, betrayed, cheater, lover, "saw"); continue; }
      if (friendship(peek(w, betrayed.id)) > 0.15 || (peek(w, betrayed.id)?.fam ?? 0) > 0.3) {
        // juicy: the witness now knows, and gossip carries it (with source and credibility)
        remember(w, { t: sim.tick, kind: "cheating", subj: cheater.id, obj: lover.id, toy: null, area: sim.world.areaAt(w.x, w.y)?.id ?? 0, val: -0.95, ev: -1, src: "saw" });
      }
    }
  }
}

/** Called when gossip lands: if the listener just heard their partner is cheating, they react. */
export function onGossip(sim: Simulation, listener: Character, kind: string, subj: number, obj: number, cred: number): void {
  if (kind !== "cheating" || listener.partner !== subj || cred < 0.3) return;
  discoverCheating(sim, listener, sim.chars[subj], sim.chars[obj] ?? null, "told");
}
