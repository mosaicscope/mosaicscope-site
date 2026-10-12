import type { Simulation } from "../sim/Simulation";
import type { Character, Personality } from "../entities/types";
import { TOYS } from "../content/toys";
import { appraise, baseline, COMPLEX_GOALS, emotionBias, ocean, performance, relaxAffect } from "./Affect";
import { retention, rehearseAbout, sweepMemories, vividCount } from "./Memory";
import { aversion, h01, habitStrength, labelOf, learnGoal, lossLambda, slotOf, SLOT_NAMES, socialLearn } from "./Learning";

/**
 * The cognition engine: one small, fully serialisable `Mind` per person (plain JSON, no Maps), updated at a low
 * rate for detailed characters. See Affect.ts (feeling), Learning.ts (what is learned), Memory.ts (forgetting).
 *
 *   Personality: Big Five (OCEAN, derived from `pers`)     Affect: Russell core affect + OCC appraisal
 *   Learning: TD / Rescorla-Wagner, Garcia, prospect theory Habit: Wood & Neal cue-routine, circadian chronotype
 *   Needs: SDT (autonomy/competence/relatedness)           Stress: Lazarus & Folkman coping, burnout (Maslach)
 *   Memory: Ebbinghaus + flashbulb                          Social: Bandura imitation, gossip, conformity
 */

export type EmotionName = "neutral" | "joyful" | "content" | "calm" | "excited" | "proud" | "relieved" | "angry" | "afraid" | "anxious" | "sad" | "hurt" | "ashamed" | "bored";

export interface Mind {
  /** core affect: valence -1..1, arousal 0..1 */
  val: number; aro: number;
  emotion: EmotionName; emoUntil: number;
  /** learned values ("item:flat_white", "bld:12", "place:cafe", "goal:eat") in -1.5..1.5, and visit/try counts */
  v: Record<string, number>; n: Record<string, number>;
  /** display names for place keys */
  names: Record<string, string>;
  /** Garcia aversions: key -> [strength at setting, tick set] */
  av: Record<string, [number, number]>;
  /** habit strength by "goal@timeslot", 0..1 */
  habit: Record<string, number>;
  /** chronotype: -1 lark .. +1 owl */
  chrono: number;
  /** self-determination needs 0..1 */
  aut: number; comp: number;
  /** chronic stress and burnout 0..1, and the preferred coping style */
  stress: number; burnout: number; coping: "problem" | "emotion";
  /** gambling temperament that grows from experience */
  gamble: { caution: number; urge: number; streak: number; net: number };
  /** conformity pressure 0..1.5 (culture can raise it) */
  conform: number;
  scalds: number;
  /** tick of last update, and last social-learning exchange */
  last: number; lastSocial: number;
  /** recent lessons, newest last (human readable) */
  log: string[];
}

export const newLog = (m: Mind, tick: number, text: string): void => {
  const day = Math.floor(tick / 3600 / 24);
  m.log.push(`Day ${day + 1}: ${text}`);
  if (m.log.length > 8) m.log.shift();
};

/** A fresh mind. Pure function of id + personality (no rng draws, so spawning order is untouched). */
export function newMind(id: number, pers: Personality): Mind {
  const b = baseline(pers);
  const o = ocean(pers);
  return {
    val: b.val, aro: b.aro, emotion: "neutral", emoUntil: 0,
    v: {}, n: {}, names: {}, av: {}, habit: {},
    chrono: Math.max(-1, Math.min(1, (h01(id, 77) - 0.5) * 2 + 0.3 * (pers.playfulness - 0.5))),
    aut: 0.6, comp: 0.5,
    stress: 0, burnout: 0, coping: o.c * 0.7 + (1 - o.n) * 0.3 > 0.5 ? "problem" : "emotion",
    gamble: { caution: 0, urge: 0, streak: 0, net: 0 },
    conform: 0.4 + 0.6 * o.a * (1 - 0.5 * o.o),
    scalds: 0, last: -(id % 40), lastSocial: -99999, log: [],
  };
}

/** Repair a partial mind (old save, hand-built test character). */
export function ensureMind(c: Character): Mind {
  const d = newMind(c.id, c.pers);
  const m = (c.mind ?? {}) as Partial<Mind>;
  c.mind = { ...d, ...m, gamble: { ...d.gamble, ...(m.gamble ?? {}) } };
  return c.mind;
}

const NEED_GOALS = new Set(["eat", "rest", "gohome", "home", "work"]);
const SOCIAL_GOALS = new Set(["socialize", "party", "gossip", "gift", "date", "flirt", "treat", "help", "reconcile"]);
const MASTERY_GOALS = new Set(["craft", "play", "skate", "music", "busk", "photograph", "ballgame", "collect"]);
const FREEDOM_GOALS = new Set(["wander", "tag", "prank", "skate", "play"]);
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/**
 * Multiplier (about 0.4..1.8) on a goal's utility from everything the person has learned and feels:
 * learned goal value, time-of-day habit, named emotion, coping/burnout, SDT needs, Yerkes-Dodson arousal,
 * circadian alertness and gambling temperament. Cheap enough to call for every goal of every decision.
 */
export function goalBias(c: Character, goal: string, hour: number): number {
  const m = c.mind;
  let k = 1 + 0.35 * Math.tanh(m.v["goal:" + goal] ?? 0);
  k *= 1 + 0.35 * habitStrength(c, goal, hour);
  k *= emotionBias(m.emotion, goal);
  // stress and coping (Lazarus & Folkman): problem-focused people fix the unmet need, emotion-focused ones soothe or escape
  if (m.stress > 0.4) {
    if (m.coping === "problem" && NEED_GOALS.has(goal)) k *= 1 + 0.3 * m.stress;
    else if (m.coping === "emotion" && (SOCIAL_GOALS.has(goal) || goal === "gamble" || goal === "play")) k *= 1 + 0.3 * m.stress;
  }
  if (m.burnout > 0.4) k *= goal === "work" ? 1 - 0.5 * m.burnout : goal === "rest" || goal === "gohome" ? 1 + 0.5 * m.burnout : 1 - 0.1 * m.burnout;
  // self-determination: a starved need pulls toward goals that feed it
  if (m.comp < 0.35 && MASTERY_GOALS.has(goal)) k *= 1.15;
  if (c.needs.social < 0.3 && SOCIAL_GOALS.has(goal)) k *= 1.1;
  if (m.aut < 0.35 && FREEDOM_GOALS.has(goal)) k *= 1.15;
  // Yerkes-Dodson: over- or under-aroused people do demanding things worse
  if (COMPLEX_GOALS.has(goal)) k *= 0.8 + 0.3 * performance(m.aro, true);
  // circadian alertness (chronotype shifts the peak: larks ~11h, owls ~19h)
  const alert = 0.5 + 0.5 * Math.cos(((hour - (15 + 4 * m.chrono)) / 24) * Math.PI * 2);
  if (goal === "rest" || goal === "gohome" || goal === "home") k *= 1 + 0.4 * (0.5 - alert);
  else if (goal === "work" || goal === "craft") k *= 0.9 + 0.2 * alert;
  if (goal === "gamble") k *= cl(1 + 0.9 * m.gamble.urge - 0.8 * m.gamble.caution, 0.15, 2);
  return cl(k, 0.3, 2);
}

/** Craving to gamble that a loss-chaser carries (0..1); lets the gamble goal fire for people who normally would not. */
export const gambleUrge = (c: Character): number => c.mind.gamble.urge;

/**
 * Low-rate mind update (called from the AI think for detailed characters, staggered by id).
 * Relax affect, tick stress/burnout, decay learning, forget memories, and learn from conversation partners.
 */
export function updateMind(c: Character, sim: Simulation): void {
  const m = c.mind, tick = sim.tick;
  const dt = Math.min(60, Math.max(0.1, (tick - m.last) / 60));
  m.last = tick;
  relaxAffect(c, tick, dt);

  // needs -> stress -> burnout. Chronically unmet needs are what burn people out.
  let unmet = 0;
  if (c.needs.energy < 0.25) unmet++;
  if (c.needs.social < 0.25) unmet++;
  if (c.needs.fun < 0.25) unmet++;
  if (c.hunger < 0.2) unmet++;
  if (c.cash < 5) unmet++;
  m.stress = cl(m.stress + (unmet * 0.012 - 0.008) * dt);
  m.burnout = cl(m.burnout + (m.stress > 0.6 ? 0.0008 : -0.0004) * dt);
  // relatedness shows up through the social need; autonomy erodes under arrest/aggression and recovers slowly
  if (c.arrestedBy >= 0 || c.jailUntil > tick || tick - c.lastHitTick < 600) m.aut = cl(m.aut - 0.01 * dt);
  else m.aut = cl(m.aut + 0.002 * dt);
  m.comp = cl(m.comp + (c.emo.confidence - 0.5) * 0.001 * dt);

  // gentle two-way consistency with the older mood variable
  c.emo.mood = cl(c.emo.mood + (m.val - c.emo.mood) * 0.03, -1, 1);

  // slow decay of what was learned (value regresses toward neutral over ~2 game days; habits over ~3)
  const dv = Math.exp(-dt / (3600 * 48)), dh = Math.exp(-dt / (3600 * 72));
  for (const k in m.v) { const nv = m.v[k] * dv; if (Math.abs(nv) < 0.01) { delete m.v[k]; delete m.n[k]; delete m.names[k]; } else m.v[k] = nv; }
  for (const k in m.habit) { const nh = m.habit[k] * dh; if (nh < 0.02) delete m.habit[k]; else m.habit[k] = nh; }
  for (const k in m.av) if (aversion(c, k, tick) < 0.02) delete m.av[k];
  const gd = Math.exp(-dt / (3600 * 36));
  m.gamble.caution *= gd; m.gamble.urge *= gd;

  // memory: forgetting curve; talking about someone rehearses what you know of them
  sweepMemories(c, tick);
  if (c.talkWith >= 0) {
    const o = sim.chars[c.talkWith];
    if (o) {
      rehearseAbout(c, o.id, tick);
      if (tick - m.lastSocial > 1200 && o.tier !== "background") { m.lastSocial = tick; socialLearn(sim, c, o); }
    }
  }
}

/** Hook for brain.finish. */
export function onGoalDone(c: Character, goal: string, ok: boolean, sim: Simulation): void { learnGoal(c, goal, ok, sim.hour); if (!ok) appraise(c, sim.tick, { rel: 0.15, cong: -0.3, ctrl: 0.6, blame: "none" }); }

/* ============================ the inspector view ============================ */

const sign = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2);
const traitWord = (v: number, lo: string, hi: string) => (v > 0.62 ? hi : v < 0.38 ? lo : "");

/** Short human-readable lines about what this person has learned and how they feel (for the UI inspector). */
export function describeMind(c: Character, tick = c.mind?.last ?? 0): string[] {
  const m = ensureMind(c), o = ocean(c.pers), out: string[] = [];
  out.push(`Feeling ${m.emotion} (mood ${sign(m.val)}, arousal ${m.aro.toFixed(2)}).`);
  const words = [traitWord(o.o, "set in their ways", "open to new things"), traitWord(o.c, "impulsive", "careful"), traitWord(o.e, "reserved", "outgoing"), traitWord(o.a, "prickly", "agreeable"), traitWord(o.n, "steady", "anxious")].filter(Boolean);
  out.push(`Personality: ${words.length ? words.join(", ") : "pretty middle of the road"} (O${Math.round(o.o * 100)} C${Math.round(o.c * 100)} E${Math.round(o.e * 100)} A${Math.round(o.a * 100)} N${Math.round(o.n * 100)}).`);
  out.push(m.chrono > 0.35 ? "Night owl: peaks in the evening." : m.chrono < -0.35 ? "Early lark: peaks in the morning." : "Neither lark nor owl.");
  for (const k in m.av) {
    const s = aversion(c, k, tick);
    if (s < 0.08) continue;
    const hrs = Math.max(1, Math.round(Math.log(s / 0.08) * 10 * (0.7 + 0.8 * o.n)));
    out.push(`Avoids ${labelOf(k)} (aversion ${s.toFixed(2)}, fading over ~${hrs}h).`);
  }
  const vals = Object.entries(m.v).filter(([k]) => !k.startsWith("goal:") && !k.startsWith("bld:") && Math.abs(m.v[k]) > 0.12).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
  for (const [k, v] of vals) {
    const nm = k.startsWith("item:") ? (TOYS[k.slice(5)]?.name ?? k) : k.startsWith("place:") ? (m.names[k] ?? k.slice(6)) : k;
    out.push(`${v > 0 ? "Likes" : "Dislikes"} ${nm} (${sign(v)}).`);
  }
  const fav = Object.entries(m.v).filter(([k, v]) => k.startsWith("bld:") && Math.abs(v) > 0.15).sort((a, b) => b[1] - a[1]);
  if (fav.length && fav[0][1] > 0) out.push(`Regular at ${m.names[fav[0][0]] ?? "a local spot"} (${sign(fav[0][1])}).`);
  const bad = fav[fav.length - 1];
  if (bad && bad[1] < -0.15) out.push(`Steers clear of ${m.names[bad[0]] ?? "a place"} (${sign(bad[1])}).`);
  const hab = Object.entries(m.habit).filter(([, h]) => h > 0.15).sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [k, h] of hab) { const [g, s] = k.split("@"); out.push(`Habit: ${g} ${SLOT_NAMES[+s]} (${Math.round(h * 100)}%).`); }
  const g = m.gamble;
  if (g.caution > 0.15) out.push(`Wary of gambling since a bad night (caution ${g.caution.toFixed(2)}, loss aversion x${lossLambda(c).toFixed(1)}).`);
  if (g.urge > 0.15) out.push(`Itching to win it back at the tables (urge ${g.urge.toFixed(2)}).`);
  if (m.burnout > 0.35) out.push(`Burning out (${Math.round(m.burnout * 100)}%).`);
  else if (m.stress > 0.35) out.push(`Stressed (${Math.round(m.stress * 100)}%), coping ${m.coping === "problem" ? "by tackling it head on" : "by seeking comfort"}.`);
  const vivid = vividCount(c, tick);
  if (c.memories.length) out.push(`Remembers ${c.memories.length} things, ${vivid} vividly.`);
  for (const l of m.log.slice(-3)) out.push(l);
  return out;
}

export { chooseFood, onConsume, learnPlace, welcomeReward, placePull, noteGamble, chaseProbability, stakeFactor, socialLearn, impulsivity, MIND_TUNING, aversion } from "./Learning";
export { appraise, ocean } from "./Affect";
export { retention, rehearseAbout, slotOf };
