import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { Simulation } from "./Simulation";
import { worldContext } from "./Ambient";
import { Rng } from "../engines/ambient-life-engine";
import { PROBLEM_BY_ID, abandonProblem, instantiate, resolveProblem, rollProblem, tickProblem, type ProblemInstance } from "../engines/world-problems";
import { addTopics } from "../dialogue/playerTalk";
import { forceGoal } from "../ai/brain";
import { remember } from "../social/Social";
import type { WorldEvent } from "../events/WorldEvents";

/**
 * World problems (engines/world-problems.ts) made part of the living town. Problems come from two places:
 *  - the world's own state: weather, time and where you are drive a roll every so often (a pothole in the wet, a fridge
 *    dying in a heatwave, a missed last bus at night)
 *  - the game's real events: a car crash becomes a fender-bender with two drivers arguing, a blackout, a collapse or a
 *    serious injury, fresh graffiti and so on, each pinned to the person it happened to
 * Each problem lands on a real nearby person, who shows the signs one by one (a bubble). You can ask what is wrong and
 * pick a fix; kind bystanders may step in; if everyone leaves it, it escalates along the catalog's chains (a leak becomes
 * a flooded floor) and the consequence is announced and gossiped about. Runtime-only: nothing is saved.
 */
interface Active { inst: ProblemInstance; actor: number; x: number; y: number; shown: number; helper: number; helpAt: number; farFor: number; fixIndex: number }
interface State { active: Active[]; next: number; rng: Rng; wired: boolean; emitting: boolean }
const states = new WeakMap<Simulation, State>();
const state = (sim: Simulation): State => { let s = states.get(sim); if (!s) states.set(sim, s = { active: [], next: 60 * 30, rng: new Rng(sim.cfg.seed ^ 0x51ab), wired: false, emitting: false }); return s; };
const MAX_ACTIVE = 3;
const free = (c: Character) => c.tier !== "player" && c.phys === Phys.OK && c.inside < 0 && c.inCar < 0 && c.jailUntil <= 0 && c.arrestedBy < 0 && c.talkWith < 0;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const problemOf = (sim: Simulation, npcId: number): Active | undefined => state(sim).active.find((a) => a.actor === npcId && a.inst.stage !== "resolved");

function pickActor(sim: Simulation, st: State, x: number, y: number, min: number, max: number): Character | undefined {
  let best: Character | undefined, bd = Infinity;
  for (const c of sim.chars) {
    if (!free(c) || st.active.some((a) => a.actor === c.id)) continue;
    const d = Math.hypot(c.x - x, c.y - y); if (d < min || d > max) continue;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function start(_sim: Simulation, st: State, inst: ProblemInstance, actor: Character): void {
  st.active.push({ inst, actor: actor.id, x: actor.x, y: actor.y, shown: 0, helper: -1, helpAt: 0, farFor: 0, fixIndex: actor.id % inst.def.fixes.length });
  actor.emo.fear = Math.min(1, actor.emo.fear + 0.08 * inst.severity); actor.emo.composure = Math.max(0.25, actor.emo.composure - 0.08 * inst.severity);
  if (inst.def.domain === "health" && inst.severity >= 3) { actor.anim.pose = "stumble"; actor.anim.poseT = 0; }
}

function announce(sim: Simulation, st: State, type: string, x: number, y: number, actors: number[], summary: string): void {
  st.emitting = true; try { sim.emit({ type, x, y, actors, summary }); } finally { st.emitting = false; }
}

/** What happens when nobody deals with it: the catalog's own consequence, as a world event people then talk about. */
function consequence(sim: Simulation, st: State, a: Active, escalated: boolean): void {
  const actor = sim.chars[a.actor], d = a.inst.def, dangerous = a.inst.severity >= 4 || d.domain === "health";
  if (actor && dangerous && d.domain === "health") { announce(sim, st, "collapse", a.x, a.y, [actor.id], `${actor.name}: ${d.title.toLowerCase()} got worse`); sim.callAmbulance(actor); }
  else announce(sim, st, "rumour", a.x, a.y, actor ? [actor.id] : [], `${d.title}: ${d.ignored}`);
  if (!escalated) for (const c of sim.chars) if (free(c) && Math.hypot(c.x - a.x, c.y - a.y) < 12 && c.tier !== "background") { remember(c, { t: sim.tick, kind: "event", subj: a.actor, obj: -1, toy: null, area: -1, val: -0.2 * Math.min(3, a.inst.severity), ev: -1, cred: 0.8, src: "saw" }); }
}

export function updateProblems(sim: Simulation): void {
  const st = state(sim);
  if (!st.wired) { st.wired = true; wire(sim, st); }
  if (sim.tick % 30 !== 5) return;
  const p = sim.player;
  // the world's own state rolls new trouble every so often, near where you are
  if (sim.tick >= st.next && st.active.length < MAX_ACTIVE && p.inside < 0) {
    st.next = sim.tick + Math.round(60 * st.rng.range(25, 70));
    const crowd = sim.chars.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 15).length > 14;
    const inst = rollProblem(worldContext(sim), st.rng, { crowd, maxSeverity: 4 });
    const actor = inst && pickActor(sim, st, p.x, p.y, 6, 28);
    if (inst && actor) start(sim, st, inst, actor);
  }
  for (const a of [...st.active]) {
    const actor = sim.chars[a.actor], inst = a.inst;
    if (!actor || inst.stage === "resolved") { st.active.splice(st.active.indexOf(a), 1); continue; }
    // signs show up one at a time as little bubbles on the person it is happening to
    const succ = tickProblem(inst, 0.5, st.rng);
    if (inst.signsShown > a.shown && free(actor)) { sim.say(actor, "*" + inst.def.signs[a.shown] + "*", "think", 3); a.shown = inst.signsShown; }
    if (succ) {   // left alone long enough: it gets worse, here
      consequence(sim, st, a, true);
      st.active.splice(st.active.indexOf(a), 1);
      start(sim, st, succ, actor);
      continue;
    }
    // a kind person nearby may step in after a while, then it resolves
    if (a.helper < 0 && inst.age > 20 && inst.severity <= 4) {
      const h = sim.chars.find((c) => free(c) && c.id !== a.actor && c.pers.kindness > 0.6 && Math.hypot(c.x - a.x, c.y - a.y) < 10 && !st.active.some((o) => o.helper === c.id));
      if (h) { a.helper = h.id; a.helpAt = sim.tick + 60 * 25; forceGoal(h, sim, "help", { u: 1, target: actor.id }); sim.say(h, "Hey, are you alright? Let me help.", "say", 2); }
    }
    if (a.helper >= 0 && sim.tick >= a.helpAt) { finish(sim, st, a, sim.chars[a.helper], a.fixIndex); continue; }
    // nobody around to see it: it plays out unseen and the town hears about it
    const far = Math.hypot(actor.x - p.x, actor.y - p.y) > 45;
    a.farFor = far ? a.farFor + 0.5 : 0;
    if (a.farFor > 90) { abandonProblem(inst); consequence(sim, st, a, false); st.active.splice(st.active.indexOf(a), 1); }
  }
}

function finish(sim: Simulation, st: State, a: Active, helper: Character | undefined, fix: number): void {
  const actor = sim.chars[a.actor], d = a.inst.def; resolveProblem(a.inst, fix);
  if (actor) {
    actor.emo.fear = Math.max(0, actor.emo.fear - 0.3); actor.emo.composure = Math.min(1, actor.emo.composure + 0.25); actor.emo.mood = Math.min(1, actor.emo.mood + 0.1);
    if (actor.anim.pose === "stumble") actor.anim.pose = "auto";
    if (/ambulance|emergency|fire brigade|fire service/i.test(a.inst.resolvedBy ?? "")) sim.callAmbulance(actor);
    sim.say(actor, "Thank you. Really.", "say", 2);
    if (helper) remember(actor, { t: sim.tick, kind: "helped_by", subj: helper.id, obj: -1, toy: null, area: -1, val: 0.4, ev: -1, cred: 1, src: "saw" });
  }
  if (helper && helper.tier === "player" && actor && actor.cash >= 5 && a.inst.severity >= 2) { const tip = Math.min(actor.cash, 5 * a.inst.severity); actor.cash -= tip; helper.cash += tip; }
  announce(sim, st, "help", a.x, a.y, helper && actor ? [helper.id, actor.id] : [], `${helper?.name ?? "Someone"} sorted out: ${d.title.toLowerCase()} (${a.inst.resolvedBy})`);
  st.active.splice(st.active.indexOf(a), 1);
}

/** The game's real events become problems, pinned to whoever they happened to. */
function wire(sim: Simulation, st: State): void {
  const make = (id: string, e: WorldEvent, near = true) => {
    if (st.emitting || st.active.length >= MAX_ACTIVE + 2) return;
    const def = PROBLEM_BY_ID.get(id); if (!def) return;
    const actor = (e.actors.map((i) => sim.chars[i]).find((c) => c && free(c) && !st.active.some((a) => a.actor === c.id))) ?? (near ? pickActor(sim, st, e.x, e.y, 0, 15) : undefined);
    if (actor) start(sim, st, instantiate(def, st.rng), actor);
  };
  sim.events.on("car_crash", (e) => { if (e.severity >= 2) make("traffic.fender_bender", e); });
  sim.events.on("blackout", (e) => make("infrastructure.blackout", e));
  sim.events.on("power_back", () => { for (const a of [...st.active]) if (a.inst.def.id === "infrastructure.blackout") finish(sim, st, a, undefined, 0); });
  sim.events.on("collapse", (e) => make("health.collapsed_stranger", e));
  sim.events.on("injury", (e) => { if (e.severity >= 3) make("health.head_injury", e); });
  sim.events.on("graffiti", (e) => make("street.graffiti_dispute", e));
  sim.events.on("near_miss", (e) => { if (sim.env.raining) make("street.puddle_splash", e); });
}

/** Player: ask what is wrong, then offer a hand. The answer comes from the catalog, so every problem reads differently. */
addTopics([
  { id: "t_problem", labels: () => ["You okay? Need a hand?", "What's wrong?", "Everything alright?"],
    score: (t) => { const a = problemOf(t.sim, t.npc.id); return a && a.inst.stage === "active" && t.hostile < 0.5 ? 0.98 : 0; },
    reply: (t) => { const a = problemOf(t.sim, t.npc.id)!; return [`${cap(a.inst.def.title.toLowerCase())}. ${cap(a.inst.cause)}.`, `Ugh. ${cap(a.inst.cause)}, and now this: ${a.inst.def.title.toLowerCase()}.`]; },
    follow: ["t_problem_fix"] },
  { id: "t_problem_fix", score: () => 0,
    labels: (t) => { const a = problemOf(t.sim, t.npc.id); return a ? [`Let me help: ${a.inst.def.fixes[a.fixIndex]}.`] : ["Let me help."]; },
    reply: (t) => { const a = problemOf(t.sim, t.npc.id); return a ? ["Would you? That would be a huge help.", "Yes. Please. Thank you."] : ["I think it's sorted."]; },
    effect: (t) => { const a = problemOf(t.sim, t.npc.id); if (a) finish(t.sim, state(t.sim), a, t.sim.player, a.fixIndex); } },
]);
