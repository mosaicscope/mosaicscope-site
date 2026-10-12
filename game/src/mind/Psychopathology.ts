import type { Simulation } from "../sim/Simulation";
import type { Character, Step } from "../entities/types";
import type { GoalDef, Choice } from "../ai/goals";
import { friendship, applyInteraction, remember } from "../social/Social";
import { BUILDINGS, isOpen } from "../content/buildings";
import { ocean } from "./Affect";
import { h01 } from "./Learning";
import { newLog } from "./Mind";
import { kin } from "./Kin";
import { profileOf } from "./Culture";
import { whanauSupportNear } from "./Whanau";

/**
 * CLINICAL LAYER: a diathesis-stress (vulnerability-stress) model of mental health, drawn as DIMENSIONS, never labels.
 *
 *  Diathesis: genetic liability, polygenic and continuous (Falconer 1965 liability-threshold; Purcell et al. 2009;
 *  Sullivan, Kendler & Neale 2003). Relatives share it (the Kin module supplies a heritable liability, ~0.5 for first-degree kin).
 *  Early adversity (Felitti et al. 1998 ACEs) sensitises the stress response (Heim & Nemeroff 2001).
 *  Stress: accumulating allostatic load (McEwen 1998), buffered by social support (Cohen & Wills 1985), worsened by
 *  poor sleep and substances (Freeman et al. 2017; Moore et al. 2007).  Life events are scaled by Holmes & Rahe 1967.
 *  Zubin & Spring 1977: illness appears when vulnerability x stress crosses a threshold; Monroe & Simons 1991.
 *
 *  Dimensions (0..1, each continuous, each recovers): acute stress (Selye 1936), anxiety, depression (with behavioural
 *  activation recovery: Lewinsohn 1974; Jacobson 1996; Dimidjian 2006), burnout (Maslach; lives on `Mind.burnout`),
 *  trauma response (Brewin 2000; Ehlers & Clark 2000; decays with support; resilience is the commonest outcome: Bonanno 2004),
 *  and a psychotic-spectrum episode that needs high liability AND high stress, mostly late teens to thirties, rarely
 *  (Saha 2005; Hafner 1993), with a prodrome first (Yung & McGorry 1996).
 *
 *  PORTRAYAL RULES (enforced in code and tests): distress is shown with compassion. Psychosis is NOT linked to violence
 *  (people with these experiences are far more often victims: Teplin 2005; Elbogen & Johnson 2009): `violentBlocked`
 *  removes aggressive goals. Voices are the person's own distressed thoughts; delusions are fear and mistrust of ordinary
 *  things, never mocked. A calm, kind response measurably helps and crowding or shouting hurts (expressed emotion:
 *  Brown 1972; Butzlaff & Hooley 1998). Recovery is the normal outcome with support and treatment.
 *  No diagnoses are shown for real people; the inspector gets a gentle description of how the person is doing.
 */

/** Tunables (rates are per game hour = 3600 ticks). Exported so tests and tuning can reach them. */
export const PSY = {
  /** share of load removed by perfect support (Cohen & Wills buffering) */
  buffer: 0.45,
  loadRate: 0.05,
  acuteHalfLifeH: 5,
  /** liability z-score gate and stress gate for psychotic-spectrum experiences */
  liabGate: 1.3,
  loadGate: 0.45,
  /** hazard (per game hour) of an episode starting once the prodrome is established */
  onsetHazard: 0.05,
  /** treatment/care effects */
  followUpDays: 3,
};
const TPH = 3600;
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sig = (z: number) => 1 / (1 + Math.exp(-z));

export interface Psy {
  /** liability z-score (cached from the kin module), early adversity count (ACEs 0..6) */
  liab: number; ace: number;
  /** stress physiology and modifiers, 0..1 */
  load: number; sleep: number; subst: number; support: number; contact: number; act: number;
  /** dimensions, 0..1 */
  acute: number; anx: number; dep: number; trauma: number; prod: number; psychosis: number;
  /** care */
  treated: number; followUp: number; careUntil: number; inAt: number; via: string;
  episodes: number; visits: number;
  /** social: who they lean on */
  confidant: number; confidantName: string;
  scan: number; lastResp: number; lastVoice: number;
}

export function newPsy(id: number): Psy {
  const u = h01(id, 31);
  return {
    liab: 0, ace: u < 0.48 ? 0 : u < 0.72 ? 1 : u < 0.85 ? 2 : u < 0.92 ? 3 : u < 0.965 ? 4 : 5,
    load: 0.1, sleep: 0, subst: 0, support: 0.4, contact: 0, act: 0.3,
    acute: 0, anx: 0, dep: 0, trauma: 0, prod: 0, psychosis: 0,
    treated: 0, followUp: 0, careUntil: 0, inAt: 0, via: "",
    episodes: 0, visits: 0, confidant: -1, confidantName: "",
    scan: -1, lastResp: -9999, lastVoice: -9999,
  };
}

/** Standardised genetic liability: Kin.liability (0..1, founder mean ~0.26, sd ~0.13) as a z-score. */
export function liabilityZ(sim: Simulation, c: Character): number { return (kin(sim, c).liability - 0.263) / 0.132; }

/** Age in years (from the culture profile) and onset-age weight: peak late teens to early thirties, men earlier (Hafner 1993). */
export function ageOf(sim: Simulation, c: Character): number { return profileOf(sim.cfg.seed, c, sim.world.areas[c.homeArea]?.kind ?? "street").age; }
export function onsetAgeFactor(age: number, male: boolean): number {
  if (age < 15) return 0;
  const peak = male ? 22 : 25, sd = male ? 5.5 : 7;
  const main = Math.exp(-((age - peak) ** 2) / (2 * sd * sd));
  const late = !male && age >= 40 && age <= 55 ? 0.22 : 0;   // women's smaller second peak
  return Math.max(main, late, age > 35 ? 0.08 : 0);
}

/** Overall distress 0..1 (the single number help-seeking and responders use). */
export function distress(c: Character): number {
  const p = c.mind.psy;
  return Math.max(p.dep, p.anx * 0.9, p.trauma * 0.9, c.mind.burnout * 0.9, p.prod * 0.7, p.psychosis, p.acute * 0.6);
}

/**
 * Life-event weights from Holmes & Rahe (1967) life-change units / 100 (death of spouse 100, divorce 73, separation 65,
 * jail 63, personal injury 53, ...). `s` = stress, `t` = traumatic weight (violence, near-death; witnessing counts less).
 */
export const LIFE_EVENT: Partial<Record<string, { s: number; t: number }>> = {
  broke_up: { s: 0.65, t: 0 }, arrested: { s: 0.63, t: 0.15 }, wounded: { s: 0.53, t: 0.45 }, hit_by: { s: 0.25, t: 0.2 },
  robbed: { s: 0.4, t: 0.3 }, car_hit: { s: 0.45, t: 0.35 }, lost_item: { s: 0.18, t: 0 }, cheating: { s: 0.4, t: 0 },
  saw_crime: { s: 0.15, t: 0.18 }, saw_fight: { s: 0.06, t: 0.06 }, argued: { s: 0.1, t: 0 }, insulted_by: { s: 0.08, t: 0 },
};

/** Apply a life event: acute reaction plus (for violence/injury) the trauma response, dampened by support. */
export function applyLifeEvent(c: Character, kind: string, scale = 1): void {
  const w = LIFE_EVENT[kind];
  if (!w) return;
  const p = c.mind.psy, o = ocean(c.pers);
  const sens = (0.6 + 0.8 * o.n) * (1 + 0.15 * p.ace) * (1 - 0.4 * p.support);
  p.acute = cl(p.acute + w.s * 0.7 * scale * (0.6 + 0.6 * o.n));
  p.trauma = cl(p.trauma + w.t * scale * sens);
  c.emo.fear = Math.min(0.55, c.emo.fear + w.t * scale * 0.3);
}

/* ============================ the update ============================ */

const scratch: number[] = [];
/** brain.ts registers its forceGoal here (keeps this module out of the ai import cycle). */
let forceGoal: (c: Character, sim: Simulation, id: string, ch: Choice) => boolean = () => false;
export function setForceGoal(f: typeof forceGoal): void { forceGoal = f; }

export function updatePsy(c: Character, sim: Simulation, dt: number): void {
  const m = c.mind, p = m.psy, o = ocean(c.pers), tick = sim.tick, h = dt / 60;
  p.liab = liabilityZ(sim, c);
  const aceN = p.ace / 5, liabN = sig(p.liab), male = c.look.kind === "guy";

  // 1. social support: closest friends, recent kind contact, whanau nearby (Cohen & Wills)
  let t1 = 0, t2 = 0, t3 = 0, best = -1, bf = 0.3;
  for (const [id, r] of c.rel) {
    const f = friendship(r);
    if (f > bf) { bf = f; best = id; }
    if (f > t1) { t3 = t2; t2 = t1; t1 = f; } else if (f > t2) { t3 = t2; t2 = f; } else if (f > t3) t3 = f;
  }
  p.contact *= Math.exp(-h / 14);
  p.support = cl(0.45 * ((Math.max(0, t1) + Math.max(0, t2) + Math.max(0, t3)) / 3) * 1.5 + 0.2 * c.needs.social + 0.4 * p.contact + 0.3 * whanauSupportNear(sim, c));
  if (best >= 0 && best !== p.confidant) { p.confidant = best; p.confidantName = sim.chars[best]?.name ?? ""; }
  else if (best < 0) { p.confidant = -1; p.confidantName = ""; }

  // 2. life events since the last scan
  let bumped = 0;
  for (const mem of c.memories) {
    if (mem.t <= p.scan || mem.t > tick || mem.src === "heard" || mem.src === "told" || bumped >= 3) continue;
    if (LIFE_EVENT[mem.kind]) { applyLifeEvent(c, mem.kind, mem.src === "saw" ? 0.6 : 1); bumped++; }
  }
  p.scan = tick;

  // 3. sleep debt (Borbely two-process, Van Dongen 2003) and insomnia from distress (Baglioni 2011)
  if (c.needs.energy < 0.3) p.sleep = cl(p.sleep + 0.04 * h);
  p.sleep = cl(p.sleep + 0.02 * (p.anx + p.dep + p.prod) * h);
  if (c.needs.energy > 0.7) p.sleep = cl(p.sleep - 0.08 * h);

  // 4. substance use as emotion-focused coping under load (slow, small); fades when load fades
  const subTarget = m.coping === "emotion" ? 0.3 * p.load * (1.1 - o.a * 0.5) : 0.05 * p.load;
  p.subst = cl(p.subst + (subTarget - p.subst) * 0.05 * h);

  // 5. allostatic load: input scaled by sensitisation (ACEs, neuroticism), buffered by support
  const input = cl((0.35 * m.stress + 0.25 * c.emo.frustration + 0.15 * c.emo.fear + 0.25 * p.sleep + 0.2 * p.subst + 0.3 * m.burnout + 0.3 * p.acute + 0.15 * (c.cash < 5 ? 1 : 0))
    * (1 + 0.12 * p.ace) * (0.85 + 0.3 * o.n));
  p.load = cl(p.load + PSY.loadRate * h * (input * (1 - PSY.buffer * p.support) - p.load));

  // 6. acute stress reaction decays with a half-life of hours (Selye alarm stage)
  p.acute *= Math.exp(-h * Math.LN2 / PSY.acuteHalfLifeH);

  // 7. anxiety / depression / trauma
  const vulnA = 0.2 + 0.45 * o.n + 0.2 * liabN + 0.15 * aceN;
  const tA = cl(vulnA * (0.15 + 0.9 * p.load) + 0.5 * p.acute + 0.35 * p.trauma);
  p.anx += (tA - p.anx) * (tA > p.anx ? 0.12 : 0.06) * Math.min(1, h);
  const vulnD = 0.15 + 0.35 * o.n + 0.25 * liabN + 0.15 * aceN + 0.1 * (1 - o.e);
  const tD = cl(vulnD * p.load * 1.15 + 0.2 * (0.5 - m.comp) + 0.15 * Math.max(0, 0.4 - p.support) + 0.15 * p.prod - 0.45 * p.act - 0.3 * p.treated);
  // slow onset, slower recovery for ruminators; behavioural activation, support and treatment speed recovery
  const downRate = 0.02 * (1 + 1.5 * p.treated + 1.0 * p.act + 0.8 * p.support) * (1.15 - 0.4 * o.n);
  p.dep += (tD - p.dep) * (tD > p.dep ? 0.03 : downRate) * Math.min(1, h);
  const trRate = (0.012 + 0.03 * p.support + 0.05 * p.treated) * (1.3 - 0.6 * o.n);
  p.trauma *= Math.exp(-trRate * h);
  p.act = cl(p.act * Math.exp(-h / 24));
  p.treated *= Math.exp(-h / 120);

  // 8. psychotic-spectrum dynamics: needs high liability AND high stress, in the right age window, and starts with a prodrome
  const gate = p.liab >= PSY.liabGate && p.load >= PSY.loadGate;
  const age = ageOf(sim, c), af = onsetAgeFactor(age, male);
  if (gate && af > 0.1) {
    const R = 0.35 * p.liab + 0.9 * p.load + 0.5 * p.sleep + 0.5 * p.subst + 0.3 * p.acute + 0.12 * p.ace + 0.7 * af;
    p.prod = cl(p.prod + 0.02 * h * Math.max(0, R - 1.6) * 6);
  } else p.prod = cl(p.prod * Math.exp(-h / 48));
  if (p.psychosis <= 0 && p.prod > 0.7 && h01(tick >> 3, c.id * 97 + 5) < 1 - Math.exp(-h * PSY.onsetHazard)) {
    p.psychosis = 0.55 + 0.3 * p.prod; p.episodes++;
    newLog(m, tick, "A very frightening stretch began: things feel unreal and unsafe. Needs calm company and care.");
  }
  if (p.psychosis > 0) {
    p.psychosis = cl(p.psychosis - h * 0.025 * (1 + 4 * p.treated + 2 * p.support) + h * 0.03 * Math.max(0, p.load - 0.5));
    if (p.psychosis < 0.05) { p.psychosis = 0; p.prod = Math.min(p.prod, 0.35); newLog(m, tick, "The worst has passed. Feeling steadier."); }
  }

  // 9. couple the dimensions back into core affect (Russell) and the older emotion variables
  m.val = Math.min(m.val, 0.5 - 0.9 * p.dep - 0.3 * p.anx);
  m.aro = Math.max(m.aro, 0.15 + 0.5 * p.anx + 0.4 * p.trauma);

  // 10. neighbours: kind company helps, crowding and shouting hurt; people in crisis are taken to care
  const D = distress(c);
  if (D >= 0.3 && c.inside < 0) respondNear(c, sim, D);
  speak(c, sim, D);
}

/* ============================ responses ============================ */

export type ResponseStyle = "company" | "crowd" | "shout";

/** Calm company helps; crowding and shouting hurt (expressed emotion). Returns the change in distress. */
export function respond(helper: Character, sufferer: Character, sim: Simulation, style: ResponseStyle): number {
  const p = sufferer.mind.psy, before = distress(sufferer);
  if (style === "company") {
    p.contact = cl(p.contact + 0.3); p.acute *= 0.7; p.anx = cl(p.anx - 0.04); p.act = cl(p.act + 0.12);
    if (p.psychosis > 0) p.psychosis = cl(p.psychosis * 0.93);
    sufferer.emo.fear *= 0.8; sufferer.mind.val = cl(sufferer.mind.val + 0.05, -1, 1);
    applyInteraction(sufferer, helper, "comfort", true, sim.tick, 1);
    remember(sufferer, { t: sim.tick, kind: "helped_by", subj: helper.id, obj: sufferer.id, toy: null, area: 0, val: 0.5, ev: -1, src: "did" });
  } else {
    p.acute = cl(p.acute + 0.15); p.anx = cl(p.anx + 0.06); p.contact = cl(p.contact - 0.2);
    if (p.psychosis > 0) p.psychosis = cl(p.psychosis + 0.05);
    sufferer.emo.fear = Math.min(0.5, sufferer.emo.fear + 0.1);
  }
  return distress(sufferer) - before;
}

const KIND_LINES = ["I'm here. No rush.", "Want to sit for a bit? I'll stay.", "Fancy a walk and a cuppa?", "You don't have to explain. I'm just here.", "Take your time. We can go somewhere quiet."];
const COP_LINES = ["Hey, it's alright. Nobody's in trouble. Let's find someone to talk to.", "Easy does it. I'll walk with you."];
const TAKEN_LINES = ["Let's get you somewhere safe and quiet.", "There are people at Pūtahi who can help. I'll come with you."];

/** Someone nearby notices. Friends and cops respond kindly; a crowd of strangers is stressful (and diffuses responsibility). */
function respondNear(c: Character, sim: Simulation, D: number): void {
  const p = c.mind.psy, tick = sim.tick;
  if (tick - p.lastResp < 600) return;
  const n = sim.charHash.query(c.x, c.y, 5, scratch);
  let crowd = 0, helper: Character | null = null, hf = -9;
  for (let i = 0; i < n; i++) {
    const o = sim.chars[scratch[i]];
    if (!o || o === c || o.inside >= 0 || o.phys !== 0) continue;
    crowd++;
    if (o.tier === "background" && !o.promoted) continue;
    const f = friendship(o.rel.get(c.id)) + (o.role === "cop" || o.role === "medic" ? 0.5 : 0);
    if (f > hf) { hf = f; helper = o; }
  }
  if (crowd >= 5 && D > 0.4) { p.lastResp = tick; respond(helper ?? c, c, sim, "crowd"); return; }       // crowding hurts
  if (!helper || hf < 0.25) return;
  p.lastResp = tick;
  if (helper.pers.temper > 0.8 && helper.pers.kindness < 0.35) { respond(helper, c, sim, "shout"); sim.say(helper, "Calm DOWN!", "shout", 1.6); return; }
  // bystander effect (Darley & Latane 1968): strangers help less when others are around; friends and officials still do
  const friend = friendship(helper.rel.get(c.id)) > 0.3 || helper.role === "cop" || helper.role === "medic";
  if (!friend && h01(tick >> 4, helper.id * 13 + c.id) > 0.7 / (1 + 0.25 * Math.max(0, crowd - 1))) return;
  respond(helper, c, sim, "company");
  sim.say(helper, sim.rng.pick(helper.role === "cop" ? COP_LINES : KIND_LINES), "say", 3);
  if ((D > 0.8 || p.psychosis > 0.45) && p.careUntil <= tick && c.tier !== "player") {
    const b = careBuilding(sim, c);
    if (b) { sim.say(helper, sim.rng.pick(TAKEN_LINES), "say", 3); forceGoal(c, sim, "crisis_care", { u: 1, target: -1, toy: b.id }); }
  }
}

/* ============================ the person's own words ============================ */

const VOICES = {
  prod: ["I haven't slept properly in days.", "Everything feels a bit too loud lately.", "I just need some quiet.", "Something feels off, and I can't say what."],
  psychosis: ["I keep hearing my name. There's nobody there.", "Is someone talking about me? I'm scared.", "I don't know what's real right now. Please stay with me.", "The voices won't let up today.", "That van's been parked there all week. Why?", "The streetlights feel like they're watching me.", "I can't trust the crowd today. Everyone's too close."],
  trauma: ["Every loud noise makes me jump.", "I keep seeing it again.", "I don't want to go near there."],
  dep: ["Can't be bothered with anything.", "Tired in a way sleep doesn't fix.", "I should call someone. Maybe tomorrow."],
  anx: ["My heart won't slow down.", "What if it all goes wrong?"],
};

function speak(c: Character, sim: Simulation, D: number): void {
  const p = c.mind.psy, tick = sim.tick;
  if (D < 0.35 || tick - p.lastVoice < 1500 || c.talkWith >= 0 || (c.bubble && c.bubble.until > tick)) return;
  const pool = p.psychosis > 0.2 ? VOICES.psychosis : p.prod > 0.3 ? VOICES.prod : p.trauma > 0.4 ? VOICES.trauma : p.dep > 0.5 ? VOICES.dep : p.anx > 0.5 ? VOICES.anx : null;
  if (!pool) return;
  p.lastVoice = tick + Math.floor(h01(tick, c.id) * 900);
  sim.say(c, pool[Math.floor(h01(tick >> 2, c.id + 1) * pool.length) % pool.length], "think", 3.5);   // thoughts, never shouted or aimed at anyone
}

/* ============================ goal biases and portrayal guard ============================ */

const PLEASANT = new Set(["socialize", "party", "play", "music", "busk", "skate", "flirt", "date", "gossip", "ballgame", "gift"]);
const SHELTER = new Set(["gohome", "shelter", "home", "rest"]);
/** Aggressive goals are removed from anyone in a psychotic-spectrum state: it is never a reason to hurt someone. */
const AGGRESSIVE = new Set(["fight", "mug", "steal", "turf", "prank"]);
export function violentBlocked(c: Character, goal: string): boolean { return AGGRESSIVE.has(goal) && (c.mind.psy.psychosis > 0.05 || c.mind.psy.prod > 0.3); }

/** Utility multiplier from the clinical state: low mood withdraws, anxiety seeks safety, prodrome retreats. */
export function psyBias(c: Character, goal: string): number {
  const p = c.mind.psy;
  let k = 1;
  const x = Math.max(p.prod * 0.7, p.psychosis);
  if (PLEASANT.has(goal)) k *= (1 - 0.5 * p.dep) * (1 - 0.35 * p.anx) * (1 - 0.6 * x);
  if (SHELTER.has(goal)) k *= (1 + 0.4 * p.dep) * (1 + 0.3 * p.anx) * (1 + 0.3 * p.trauma) * (1 + 0.5 * x);
  if (goal === "work") k *= 1 - 0.25 * p.dep;
  if (goal === "wander") k *= 1 - 0.3 * p.trauma;
  return k;
}

/** Behavioural activation (Lewinsohn 1974): doing rewarding things lifts mood, which makes more of them possible. */
export function activate(c: Character, goal: string, ok: boolean): void { if (ok && PLEASANT.has(goal)) c.mind.psy.act = cl(c.mind.psy.act + 0.12); }

/* ============================ care pathways ============================ */

export const isCareBuilding = (kind: string): boolean => kind === "mentalhealth" || kind === "hospital";

/** Nearest open mental health unit, else the hospital (GP-style visit). */
export function careBuilding(sim: Simulation, c: Character): { id: number; kind: string; name: string } | null {
  let best: { id: number; kind: string; name: string } | null = null, bd = Infinity;
  for (const b of sim.world.buildings) {
    if (!isCareBuilding(b.kind) || !isOpen(BUILDINGS[b.kind], sim.hour)) continue;
    const d = Math.hypot(b.door.x - c.x, b.door.y - c.y) - (b.kind === "mentalhealth" ? 25 : 0);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Called as someone walks into a building (before their goal is cleared). */
export function noteEnter(sim: Simulation, c: Character, kind: string, goalId: string | undefined): void {
  if (!isCareBuilding(kind)) return;
  const p = c.mind.psy;
  p.inAt = sim.tick; p.via = goalId ?? "";
  if (goalId === "seek_help" || goalId === "crisis_care") p.careUntil = c.insideUntil;
}

/** When they come out: treatment and rest, or a visit that comforts a friend. */
export function careOutcome(sim: Simulation, c: Character, b: { id: number; kind: string; name: string }): void {
  const p = c.mind.psy, tick = sim.tick, hours = Math.max(0, (tick - p.inAt) / TPH);
  if (!isCareBuilding(b.kind) || c.workplace === b.id) { p.via = ""; return; }
  if (p.via === "visit_friend_in_care") {
    for (const o of sim.chars) {
      if (o.inside !== b.id || o === c || o.mind.psy.careUntil <= tick - 1 || friendship(c.rel.get(o.id)) < 0.25) continue;
      const q = o.mind.psy;
      q.contact = cl(q.contact + 0.4); q.visits++; q.act = cl(q.act + 0.1);
      newLog(o.mind, tick, `${c.name} came to visit. It helped to see a friendly face.`);
    }
    c.needs.social = Math.min(1, c.needs.social + 0.15);
  } else if (p.via === "seek_help" || p.via === "crisis_care" || distress(c) > 0.35) {
    const keep = Math.exp(-hours / 8);
    p.treated = cl(p.treated + 0.35 + 0.05 * Math.min(hours, 8));
    p.load *= keep; p.sleep *= Math.exp(-hours / 4); p.acute = 0; p.anx *= Math.exp(-hours / 12); p.psychosis *= Math.exp(-hours / 6);
    p.dep *= 0.93; p.trauma *= 0.85; p.contact = cl(p.contact + 0.3);
    c.mind.burnout *= 0.85; c.needs.energy = 1; c.emo.fear *= 0.5;
    p.followUp = tick + PSY.followUpDays * 24 * TPH; p.careUntil = 0;
    newLog(c.mind, tick, `Rested and talked it through at ${b.name}. A follow-up is booked.`);
  }
  p.via = "";
}

const followDue = (c: Character, tick: number) => c.mind.psy.followUp > 0 && tick >= c.mind.psy.followUp && c.mind.psy.followUp > tick - 24 * TPH * 3;

export const PSY_GOALS: GoalDef[] = [
  {
    id: "seek_help", cooldown: 900, interruptible: true,
    score: (c, sim) => {
      const p = c.mind.psy, D = distress(c);
      const due = followDue(c, sim.tick);
      if ((D < 0.5 && !due) || p.careUntil > sim.tick) return null;
      if (!due && D > 0.85) return null;                                 // crisis_care takes over
      const o = ocean(c.pers);
      const propensity = 0.35 + 0.25 * p.support + 0.25 * o.o + (due ? 0.3 : 0);
      const b = careBuilding(sim, c);
      return b ? { u: Math.min(0.85, (0.2 + D * 0.5) * propensity * 1.6 + (due ? 0.2 : 0)), target: -1, toy: b.id } : null;
    },
    build: (_c, sim, ch): Step[] => [{ kind: "enter", building: ch.toy, minutes: sim.rng.range(40, 100) }],
  },
  {
    id: "crisis_care", cooldown: 600, interruptible: true,
    score: (c, sim) => {
      const p = c.mind.psy;
      if (p.careUntil > sim.tick || (p.psychosis < 0.4 && distress(c) < 0.85 && p.prod < 0.8)) return null;
      const b = careBuilding(sim, c);
      return b ? { u: 1.2, target: -1, toy: b.id } : null;
    },
    build: (_c, sim, ch): Step[] => [{ kind: "enter", building: ch.toy, minutes: sim.rng.range(300, 600) }],
  },
  {
    id: "visit_friend_in_care", cooldown: 1200, interruptible: true,
    score: (c, sim) => {
      if (c.needs.energy < 0.3) return null;
      let best = -1, bf = 0.3;
      for (const [id, r] of c.rel) {
        const o = sim.chars[id];
        if (!o || o.inside < 0 || o.mind.psy.careUntil <= sim.tick) continue;
        const f = friendship(r);
        if (f > bf) { bf = f; best = o.inside; }
      }
      return best >= 0 ? { u: 0.3 + bf * 0.4 + c.pers.kindness * 0.2, target: -1, toy: best } : null;
    },
    build: (_c, sim, ch): Step[] => [{ kind: "enter", building: ch.toy, minutes: sim.rng.range(10, 25) }],
  },
];

/* ============================ the inspector view ============================ */

/** One-line "what helps", chosen by what the person is dealing with. Generic, kind, practical. */
export const WHAT_HELPS: Record<string, string> = {
  stress: "Rest, regular sleep, a friend to lean on, and fewer demands for a while.",
  anxiety: "Slow breathing, a calm familiar place, and someone steady beside them.",
  depression: "Small enjoyable activities, company, daylight and movement, and talking to someone who listens.",
  trauma: "Feeling safe, time, and people who stay close without pushing; talking when ready.",
  prodrome: "Sleep, lower stress, avoiding drink and drugs, and an early, gentle check-in with care services.",
  psychosis: "Calm, quiet company, no arguing or crowding, and getting care early. Recovery is the usual outcome.",
  burnout: "Time off, fewer demands, and getting the basics (sleep, food, company) back.",
};

/** Gentle, readable summary of how someone is doing. Deliberately not a diagnosis. */
export function mentalSummary(c: Character, tick: number): string[] {
  const p = c.mind.psy, out: string[] = [];
  const bits: string[] = [];
  if (p.load > 0.6) bits.push("under heavy stress"); else if (p.load > 0.35) bits.push("under some strain");
  if (p.sleep > 0.5) bits.push("sleeping badly");
  if (p.subst > 0.35) bits.push("leaning on a drink more than usual");
  if (p.dep > 0.65) bits.push("very low and worn out"); else if (p.dep > 0.35) bits.push("feeling flat and low");
  if (p.anx > 0.4) bits.push("on edge and worried");
  if (p.trauma > 0.3) bits.push("shaken by something that happened, easily startled");
  if (c.mind.burnout > 0.4) bits.push("burnt out");
  if (p.psychosis > 0.2) bits.push("in a frightening stretch where things feel unreal and unsafe");
  else if (p.prod > 0.3) bits.push("withdrawn and finding things unsettling");
  if (p.support > 0.35 && p.confidantName) bits.push(`leaning on ${p.confidantName}`);
  else if (p.support < 0.15 && bits.length) bits.push("feeling pretty alone");
  if (!bits.length) out.push("Coping well at the moment.");
  else out.push(bits[0][0].toUpperCase() + bits[0].slice(1) + (bits.length > 1 ? ", " + bits.slice(1, -1).join(", ") + (bits.length > 2 ? ", and " : "") + bits[bits.length - 1] : "") + ".");
  const key = p.psychosis > 0.2 ? "psychosis" : p.prod > 0.3 ? "prodrome" : p.trauma > 0.4 ? "trauma" : p.dep > 0.4 ? "depression" : p.anx > 0.45 ? "anxiety" : c.mind.burnout > 0.4 ? "burnout" : p.load > 0.5 ? "stress" : "";
  if (key) out.push("What helps: " + WHAT_HELPS[key]);
  if (p.treated > 0.2) out.push("Getting support and care; it is working.");
  if (p.followUp > tick) out.push("Has a follow-up booked.");
  else if (followDue(c, tick)) out.push("A follow-up visit is due.");
  return out;
}
