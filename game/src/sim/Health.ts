import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { Simulation } from "./Simulation";
import type { SubstanceKind } from "./Substances";
import { forceGoal } from "../ai/brain";
import { hospitalise } from "./Life";
import { peek, remember } from "../social/Social";

/**
 * Health fallout of the street scene, adapted from npc-conditions (all fictional, abstract, nothing real-world):
 *  - needles: heavy users of some substances may start injecting; clean kits, reused and shared needles carry the risk of
 *    a made-up bloodborne illness ("Red Fever") that wears people down until it's treated
 *  - outreach: medics carry clean kits and a rescue shot, hand kits out, treat the sick and pull people back from a crisis
 *  - psychosis: stress, sleeplessness-style strain and stimulants can tip a vulnerable person into an episode with
 *    paranoid, reference or voices symptoms. They voice it, mistrust people, spread shaky rumours and others react
 *    by their own nature (back away, or sit with them). Support and treatment bring them back.
 * Runtime-only: nothing is saved.
 */
const INJECTABLE = new Set<SubstanceKind>(["stimulant", "sedative"]);
const THEMES: Record<string, string[]> = {
  persecution: ["{who} is following me near the {place}.", "{who} keeps watching me."],
  reference: ["{who} was laughing at me. I know it.", "Everyone at the {place} is talking about me."],
  voices: ["A voice keeps telling me to leave the {place}.", "Someone keeps whispering my name."],
};
interface Needle { infected: boolean }
interface Kit { clean: number; used: Needle[]; antidote: number }
interface Inf { severity: number; known: boolean; treated: boolean; hospAt: number }
interface Mind { psychosis: number; theme: string; next: number; support: number; onMeds: boolean; reacted: boolean }
interface State { seen: Map<number, number>; uses: Map<number, number>; inject: Set<number>; kits: Map<number, Kit>; inf: Map<number, Inf>; mind: Map<number, Mind>; served: Map<number, number>;
  poses: { id: number; at: number }[]; ready: boolean }
const states = new WeakMap<Simulation, State>();
const state = (sim: Simulation): State => { let s = states.get(sim); if (!s) states.set(sim, s = { seen: new Map(), uses: new Map(), inject: new Set(), kits: new Map(), inf: new Map(), mind: new Map(), served: new Map(), poses: [], ready: false }); return s; };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const dist = (a: Character, b: Character) => Math.hypot(a.x - b.x, a.y - b.y);
const free = (c: Character) => c.tier !== "player" && c.phys === Phys.OK && c.inside < 0 && c.inCar < 0 && c.jailUntil <= 0 && c.arrestedBy < 0;
const vulnerability = (c: Character) => ((Math.imul(c.id + 7, 2654435761) >>> 0) % 100) / 140;   // stable per person, 0..0.7
const place = (sim: Simulation, c: Character) => sim.world.areaAt(c.x, c.y)?.name ?? "street";
const pose = (st: State, sim: Simulation, c: Character, p: string, ticks = 150) => { c.anim.pose = p; c.anim.poseT = 0; st.poses.push({ id: c.id, at: sim.tick + ticks }); };

/** Queries for the player menu. */
export const isPsychotic = (sim: Simulation, id: number) => (state(sim).mind.get(id)?.psychosis ?? 0) > 0.25;
export const isInfected = (sim: Simulation, id: number) => { const i = state(sim).inf.get(id); return !!i && i.severity > 0.3 && !i.treated; };
/** Sit with someone, or (clinic) steer them to treatment. */
export function supportNpc(sim: Simulation, npc: Character, clinic: boolean): void {
  const st = state(sim), m = st.mind.get(npc.id), i = st.inf.get(npc.id);
  npc.emo.fear = Math.max(0, npc.emo.fear - 0.15); npc.emo.composure = Math.min(1, npc.emo.composure + 0.1);
  if (m) { m.support = clamp(m.support + 0.3); if (clinic) m.onMeds = true; }
  if (i && clinic) i.treated = true;
}

export function updateHealth(sim: Simulation): void {
  if (sim.tick % 30 !== 17) return;
  const st = state(sim);
  if (!st.ready) { if (sim.chars.length < 50) return; st.ready = true; for (const c of sim.chars) if (c.role === "medic") st.kits.set(c.id, { clean: 12, used: [], antidote: 3 }); }
  for (const r of st.poses.splice(0)) { if (sim.tick < r.at) { st.poses.push(r); continue; } const c = sim.chars[r.id]; if (c && (c.anim.pose === "comfort" || c.anim.pose === "deal")) c.anim.pose = "auto"; }
  for (const c of sim.chars) {
    const s = c.substances;
    if (s && s.usedAt !== (st.seen.get(c.id) ?? s.usedAt)) onUse(sim, st, c, s.last);
    if (s) st.seen.set(c.id, s.usedAt);
    if (s?.crisis) rescue(sim, st, c);
  }
  infections(sim, st);
  outreach(sim, st);
  psychosis(sim, st);
}

function onUse(sim: Simulation, st: State, c: Character, kind: SubstanceKind): void {
  const n = (st.uses.get(c.id) ?? 0) + 1; st.uses.set(c.id, n);
  if (!INJECTABLE.has(kind)) return;
  // heavy, repeated use is what tips some people from smoking or swallowing to injecting
  if (!st.inject.has(c.id) && n >= 4 && sim.rng.next() < Math.min(0.6, 0.1 + 0.05 * (n - 4))) st.inject.add(c.id);
  if (!st.inject.has(c.id)) return;
  const kit = st.kits.get(c.id) ?? { clean: 0, used: [], antidote: 0 }; st.kits.set(c.id, kit);
  let needle: Needle, how = "clean";
  if (kit.clean > 0) { kit.clean--; needle = { infected: false }; }
  else if (kit.used.length) { needle = kit.used.pop()!; how = "reused"; }
  else {
    let peer: Kit | undefined;
    for (const [id, k] of st.kits) { const o = sim.chars[id]; if (o && o !== c && k.used.length && dist(o, c) < 4) { peer = k; break; } }
    if (peer) { needle = peer.used.pop()!; how = "shared"; } else { needle = { infected: false }; how = "improvised"; }
  }
  const inf = st.inf.get(c.id);
  if (needle.infected && !inf && sim.rng.next() < 0.25) { st.inf.set(c.id, { severity: 0.1, known: false, treated: false, hospAt: 0 }); sim.emit({ type: "injury", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} has come down with Red Fever` }); }
  if (how !== "clean" && sim.rng.next() < 0.06) c.emo.composure = Math.max(0.3, c.emo.composure - 0.1);   // a wound or abscess scare
  needle.infected = needle.infected || !!st.inf.get(c.id);
  kit.used.push(needle); if (kit.used.length > 6) kit.used.shift();
}

function infections(sim: Simulation, st: State): void {
  for (const [id, i] of st.inf) {
    const c = sim.chars[id]; if (!c) { st.inf.delete(id); continue; }
    i.severity = clamp(i.severity + (i.treated ? -0.0018 : 0.0006));
    if (i.treated && i.severity <= 0) { st.inf.delete(id); continue; }
    if (i.severity > 0.3) { c.needs.energy = Math.max(0.05, c.needs.energy - i.severity * 0.0005); c.emo.composure = Math.max(0.3, c.emo.composure - i.severity * 0.001); }
    if (i.severity > 0.4) i.known = true;
    // someone who knows they are sick and is getting worse goes to the hospital
    if (i.known && !i.treated && i.severity > 0.6 && free(c) && sim.tick - i.hospAt > 60 * 300) { i.hospAt = sim.tick; i.treated = true; hospitalise(sim, c); }
  }
}

/** A medic or neighbour with a rescue shot pulls someone back from a crisis before the ambulance gets there. */
function rescue(sim: Simulation, st: State, c: Character): void {
  for (const [id, kit] of st.kits) {
    const h = sim.chars[id]; if (!h || h === c || kit.antidote <= 0 || !free(h) || dist(h, c) > 6 || sim.rng.next() > 0.5) continue;
    kit.antidote--; const s = c.substances!; s.crisis = false; for (const k of Object.keys(s.levels) as SubstanceKind[]) s.levels[k] *= 0.4;
    sim.say(h, "Stay with me! I've got you.", "shout", 2); pose(st, sim, h, "comfort");
    sim.emit({ type: "help", x: c.x, y: c.y, actors: [h.id, c.id], summary: `${h.name} brought ${c.name} back from a crisis` });
    return;
  }
}

function outreach(sim: Simulation, st: State): void {
  for (const medic of sim.chars) {
    const mk = st.kits.get(medic.id); if (medic.role !== "medic" || !mk || !free(medic)) continue;
    let best: Character | undefined, bd = 20;
    for (const c of sim.chars) { if (c === medic || !free(c) || sim.tick - (st.served.get(c.id) ?? -1e9) < 60 * 180 || !(st.inject.has(c.id) || st.inf.get(c.id)?.known || (st.uses.get(c.id) ?? 0) >= 3)) continue; const d = dist(c, medic); if (d < bd) { bd = d; best = c; } }
    if (!best) continue;
    if (bd > 3) { if (sim.rng.next() < 0.1) forceGoal(medic, sim, "follow", { u: 2, target: best.id }); continue; }
    st.served.set(best.id, sim.tick);
    const kit = st.kits.get(best.id) ?? { clean: 0, used: [], antidote: 0 }; st.kits.set(best.id, kit);
    const n = Math.min(3, mk.clean); mk.clean -= n; kit.clean += n;
    if (mk.antidote > 0 && kit.antidote === 0) { mk.antidote--; kit.antidote = 1; }
    const i = st.inf.get(best.id); if (i && i.known && sim.rng.next() < 0.6) i.treated = true;
    sim.say(medic, "I'm with the outreach team. Clean kits, no judgment.", "say", 3); pose(st, sim, medic, "comfort");
    const m = st.mind.get(best.id); if (m) m.support = clamp(m.support + 0.2);
    if (mk.clean <= 0) mk.clean = 12;   // restocks from the van
  }
}

function psychosis(sim: Simulation, st: State): void {
  for (const c of sim.chars) {
    if (c.tier === "player" || c.phys !== Phys.OK) continue;
    const lv = c.substances?.levels, stim = lv ? lv.stimulant + lv.cannabis * 0.3 : 0, inf = st.inf.get(c.id);
    let m = st.mind.get(c.id);
    if (!m && stim < 0.3 && c.emo.frustration < 0.5 && !inf) continue;   // nothing pushing on them: cheap exit
    const stress = clamp(c.emo.frustration * 0.5 + (1 - c.emo.composure) * 0.4 + (inf ? inf.severity * 0.3 : 0));
    const risk = vulnerability(c) * (stress * 0.5 + stim * 0.35) * (m?.onMeds ? 0.3 : 1);
    if (!m) { if (sim.rng.next() < risk * risk * 0.02) st.mind.set(c.id, m = { psychosis: 0.1, theme: Object.keys(THEMES)[sim.rng.int(0, 2)], next: sim.tick + 60 * 10, support: 0, onMeds: false, reacted: false }); else continue; }
    m.support = Math.max(0, m.support - 0.002);
    m.psychosis = clamp(m.psychosis + (risk * 1.2 - 0.1 - (m.onMeds ? 0.15 : 0) - m.support * 0.1) * 0.02);
    if (m.psychosis <= 0) { st.mind.delete(c.id); continue; }
    if (m.psychosis < 0.25) continue;
    if (!m.reacted) { m.reacted = true; bystanders(sim, c); }
    if (sim.tick < m.next) continue;
    m.next = sim.tick + Math.round(60 * (8 + sim.rng.next() * 20 / (0.5 + m.psychosis)));
    symptom(sim, c, m);
  }
}

function symptom(sim: Simulation, c: Character, m: Mind): void {
  const near = sim.chars.filter((o) => o !== c && o.inside < 0 && dist(o, c) < 10), who = near.length ? near[sim.rng.int(0, near.length - 1)] : null;
  const lines = THEMES[m.theme], text = lines[sim.rng.int(0, lines.length - 1)].replace("{who}", who?.name ?? "someone").replace("{place}", place(sim, c));
  sim.say(c, text, "think", 3);
  if (m.theme === "persecution") c.emo.fear = Math.min(1, c.emo.fear + 0.25);
  if (!who) return;
  // a delusion becomes a shaky rumour the person might repeat, and it sours how they feel about whoever it names
  remember(c, { t: sim.tick, kind: "rumour", subj: who.id, obj: -1, toy: null, area: -1, val: -0.35, ev: -1, cred: 0.35, src: "heard" });
  const r = peek(c, who.id); if (r && m.theme !== "voices") r.aff = Math.max(-1, r.aff - 0.04);
  if (m.theme === "persecution" && sim.rng.next() < 0.3) forceGoal(c, sim, "flee_far", { u: 1, target: who.id });
}

/** Others react by their own nature: the uneasy back away, the kind sit with them. */
function bystanders(sim: Simulation, c: Character): void {
  let helped = false;
  for (const o of sim.chars) {
    if (o === c || !free(o) || dist(o, c) > 7) continue;
    if (o.pers.kindness < 0.35) { sim.say(o, "I, uh... I have to go.", "say", 2); forceGoal(o, sim, "flee_far", { u: 1, target: -1 }); }
    else if (o.pers.kindness > 0.6 && !helped) { helped = true; sim.say(o, "Hey, it's okay. I'm here.", "say", 2); forceGoal(o, sim, "help", { u: 1, target: c.id }); const m = state(sim).mind.get(c.id); if (m) m.support = clamp(m.support + 0.3); }
  }
}

/** Developer helper: put a condition on someone. */
export function debugCondition(sim: Simulation, c: Character, kind: string): string {
  const st = state(sim);
  if (kind === "infect") { st.inf.set(c.id, { severity: 0.65, known: true, treated: false, hospAt: 0 }); return `${c.name} has Red Fever`; }
  if (kind === "psychosis") { st.mind.set(c.id, { psychosis: 0.6, theme: "persecution", next: sim.tick, support: 0, onMeds: false, reacted: false }); return `${c.name} is having an episode`; }
  return "infect | psychosis";
}
