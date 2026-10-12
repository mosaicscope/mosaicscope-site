import type { Simulation } from "../sim/Simulation";
import type { Character } from "../entities/types";
import { TOYS } from "../content/toys";
import { peek } from "../social/Social";
import { appraise, ocean } from "./Affect";
import { newLog } from "./Mind";

/**
 * Learning rules.
 *  - Temporal-difference / Rescorla-Wagner (Rescorla & Wagner 1972; Sutton 1988): V <- V + alpha (r + gamma V' - V).
 *    The learning rate is raised by arousal (emotional events are learned faster, cf. McGaugh) and the felt reward is
 *    tinted by mood (mood-congruent perception: a grumpy person rates the same coffee lower).
 *  - Garcia effect (Garcia & Koelling 1966): one-trial taste aversion after a bad consequence, generalising to the
 *    food's trait (hot drinks), decaying with a half-life of hours, and extinguishing with safe re-exposure.
 *  - Epsilon-greedy exploration: openness/curiosity raises the chance of trying something unfamiliar.
 *  - Prospect theory (Kahneman & Tversky 1979): losses loom larger than gains (lambda ~ 2.25) and diminishing
 *    sensitivity; personality decides whether a loss makes you cautious (once bitten) or a loss-chaser.
 *  - Habit formation (Wood & Neal 2007): context cues (time of day, shifted by chronotype) strengthen routines that
 *    are repeated successfully.
 *  - Social learning (Bandura 1977): tastes are imitated from liked, respected people; gossip carries aversions.
 */

const TPH = 3600;
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/** Deterministic hash to 0..1 (no rng consumption, so it never perturbs the simulation's random stream). */
export function h01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const strHash = (s: string): number => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };

/** Tunables (exported so tests and tuning can reach them). */
export const MIND_TUNING = {
  /** chance that a freshly made hot drink is hot enough to scald (deterministic roll per person/tick/item) */
  scaldChance: 0.07,
  /** half-life-ish time constant of a taste aversion, in game hours (scaled by neuroticism) */
  aversionHours: 10,
};

/* ---------------- TD value learning ---------------- */

export function value(c: Character, key: string): number { return c.mind.v[key] ?? 0; }

/** Rescorla-Wagner / TD(0) update with affect-biased reward and arousal-scaled learning rate. */
export function td(c: Character, key: string, reward: number, next = 0, gamma = 0.6): number {
  const m = c.mind, b = ocean(c.pers);
  const r = cl(reward + 0.2 * m.val, -1.5, 1.5);          // mood-congruent perception
  let alpha = 0.22 * (0.7 + 0.6 * m.aro);                 // arousal boosts learning
  if (r < 0) alpha *= 1 + 0.6 * b.n;                       // negativity bias in anxious people
  const v = m.v[key] ?? 0;
  const nv = cl(v + alpha * (r + gamma * next - v), -1.5, 1.5);
  m.v[key] = nv;
  m.n[key] = (m.n[key] ?? 0) + 1;
  return nv;
}

/* ---------------- items: temperature, taste, aversion (Garcia) ---------------- */

/** How hot a food is served, 0 cold .. 1 scalding. */
export const HEAT: Record<string, number> = { flat_white: 1, pie: 0.8, bao: 0.6, fish_chips: 0.6, burger: 0.5, kebab: 0.5, pizza: 0.5, donut: 0.1 };
export const HOT_DRINKS: readonly string[] = ["flat_white"];
/** Aversion keys: the item itself and the trait it belongs to (the Garcia generalisation gradient). */
export const traitOf = (def: string): string | null => (HOT_DRINKS.includes(def) ? "trait:hot_drink" : null);
export const ITEM_LABEL: Record<string, string> = { "trait:hot_drink": "hot drinks" };
export const labelOf = (key: string): string => ITEM_LABEL[key] ?? TOYS[key.replace(/^item:/, "")]?.name ?? key;

export function aversionTau(c: Character): number { return TPH * MIND_TUNING.aversionHours * (0.7 + 0.8 * ocean(c.pers).n); }

/** Current strength 0..1 of an aversion, decayed from when it was set. */
export function aversion(c: Character, key: string, tick: number): number {
  const a = c.mind.av[key];
  if (!a) return 0;
  return a[0] * Math.exp(-Math.max(0, tick - a[1]) / aversionTau(c));
}
export function addAversion(c: Character, key: string, strength: number, tick: number): void {
  const now = aversion(c, key, tick);
  c.mind.av[key] = [cl(Math.max(now, strength)), tick];
}

/** Stable per-person taste for an item (-0.25..0.25) plus declared likes. */
export function taste(c: Character, def: string): number { return (h01(c.id, strHash(def)) - 0.5) * 0.5 + (c.likes.includes(def) ? 0.25 : 0); }

/** Would this freshly made hot drink scald? Deterministic in (tick, person, item). */
export function scaldRoll(tick: number, c: Character, def: string): boolean {
  return HOT_DRINKS.includes(def) && h01(tick * 7919 + c.id, strHash(def)) < MIND_TUNING.scaldChance;
}

/** Appetite-for-this-item utility: needs + taste + learned value - aversion + novelty + cooler-substitute coping. */
export function foodUtility(c: Character, def: string, tick: number): number {
  const f = TOYS[def]?.food;
  if (!f) return -9;
  const m = c.mind, b = ocean(c.pers);
  let u = f.hunger * (1 - c.hunger) * 1.2 + f.energy * (1 - c.needs.energy) * 0.8 + taste(c, def) + (m.v["item:" + def] ?? 0);
  if ((m.n["item:" + def] ?? 0) === 0) u += 0.12 * b.o;                   // novelty appeal of the untried
  const tr = traitOf(def);
  const ai = aversion(c, "item:" + def, tick), at = tr ? aversion(c, tr, tick) : 0;
  u -= 1.3 * Math.max(ai, at);
  // avoidance coping: while a heat aversion is fresh, anything cooler on the menu feels safer
  const hotAv = aversion(c, "trait:hot_drink", tick);
  if (hotAv > 0.1) u += 0.35 * hotAv * (1 - (HEAT[def] ?? 0));
  return u;
}

/** Pick from a menu: epsilon-greedy exploration (openness) over a softmax of utilities. */
export function chooseFood(sim: Simulation, c: Character, options: readonly string[]): string {
  if (options.length <= 1) return options[0];
  const b = ocean(c.pers);
  const eps = 0.04 + 0.2 * b.o * (0.5 + c.pers.curiosity * 0.5);
  if (sim.rng.chance(eps)) {
    // exploration still refuses what it is currently averse to
    const ok = options.filter((d) => aversion(c, "item:" + d, sim.tick) < 0.3 && (!traitOf(d) || aversion(c, traitOf(d)!, sim.tick) < 0.3));
    return sim.rng.pick(ok.length ? ok : options);
  }
  const us = options.map((d) => foodUtility(c, d, sim.tick));
  const mx = Math.max(...us);
  const w = us.map((u) => Math.exp((u - mx) / 0.22));
  return options[Math.max(0, sim.rng.weighted(w))];
}

/**
 * The outcome of eating or drinking: reward -> TD value, scald -> one-trial aversion.
 * Returns true when the person was scalded.
 */
export function onConsume(sim: Simulation, c: Character, def: string, hungerBefore: number): boolean {
  const f = TOYS[def]?.food;
  if (!f) return false;
  const m = c.mind, key = "item:" + def, tr = traitOf(def);
  if (scaldRoll(sim.tick, c, def)) {
    td(c, key, -1);
    addAversion(c, key, 1, sim.tick);
    if (tr) addAversion(c, tr, 0.75, sim.tick);
    appraise(c, sim.tick, { rel: 0.7, cong: -0.8, ctrl: 0.3, blame: "none", pain: true });
    c.emo.mood = Math.max(-1, c.emo.mood - 0.25); c.emo.frustration = Math.min(1, c.emo.frustration + 0.15);
    m.scalds++;
    newLog(m, sim.tick, `Burned my tongue on a ${TOYS[def].name}. Not touching hot drinks for a while.`);
    return true;
  }
  const reward = f.hunger * (1 - hungerBefore) * 1.1 + f.energy * (1 - c.needs.energy) * 0.7 + taste(c, def) + 0.15;
  // extinction: safe exposure weakens an aversion (Rescorla-Wagner with CS alone)
  if (m.av[key]) m.av[key][0] *= 0.5;
  if (tr && m.av[tr]) m.av[tr][0] *= 0.6;
  td(c, key, cl(reward, -1, 1));
  return false;
}

/* ---------------- places ---------------- */

/** Pull toward a place, in tile-equivalents of distance (applied by the eat goal when picking where to go). */
export function placePull(c: Character, kind: string, id: number): number {
  const v = (c.mind.v["bld:" + id] ?? 0) * 1.0 + (c.mind.v["place:" + kind] ?? 0) * 0.5;
  return cl(v, -1.5, 1.5) * 14;
}

/** Learn a place from a visit. `reward` is the outcome (food, welcome, winnings). */
export function learnPlace(_sim: Simulation, c: Character, kind: string, id: number, name: string, reward: number): void {
  const m = c.mind;
  const nextBest = m.v["place:" + kind] ?? 0;
  td(c, "bld:" + id, reward, nextBest);
  td(c, "place:" + kind, reward);
  m.names["bld:" + id] = name;
  m.names["place:" + kind] = kind;
  trimValues(c);
}

/**
 * Social reward of a visit: warm staff mean more to shy people (relatedness need, Deci & Ryan) because the
 * welcome beats their low expectations; cold staff sting the sociable.
 */
export function welcomeReward(sim: Simulation, c: Character, buildingId: number): number {
  let n = 0, k = 0;
  for (const o of sim.chars) if (o.workplace === buildingId && o.inside === buildingId && o !== c) { n++; k += o.pers.kindness; }
  if (!n) return 0;
  const warmth = k / n - 0.45;
  const shy = 1.15 - ocean(c.pers).e;
  c.needs.social = Math.min(1, c.needs.social + Math.max(0, warmth) * 0.15);
  return warmth * (0.7 + shy);
}

/** Keep the value table small (saves stay compact): drop the weakest signals beyond a cap. */
export function trimValues(c: Character, cap = 28): void {
  const m = c.mind, keys = Object.keys(m.v);
  if (keys.length <= cap) return;
  keys.sort((a, b) => Math.abs(m.v[a]) - Math.abs(m.v[b]));
  for (let i = 0; i < keys.length - cap; i++) { delete m.v[keys[i]]; delete m.n[keys[i]]; delete m.names[keys[i]]; }
}

/* ---------------- goals and habits ---------------- */

/** Three-hour slot on the person's subjective clock (owls live later, larks earlier). */
export function slotOf(hour: number, chrono: number): number { return Math.floor((((hour - chrono * 1.5) % 24) + 24) % 24 / 3) % 8; }
export const SLOT_NAMES = ["the small hours", "early morning", "mid-morning", "around midday", "the afternoon", "early evening", "night", "late night"];

export function habitStrength(c: Character, goal: string, hour: number): number { return c.mind.habit[goal + "@" + slotOf(hour, c.mind.chrono)] ?? 0; }

/** Learn from a finished goal: TD on the goal's value; successful repetition at this time strengthens the habit. */
export function learnGoal(c: Character, goal: string, ok: boolean, hour: number): void {
  const m = c.mind;
  td(c, "goal:" + goal, ok ? 0.35 : -0.45);
  m.comp = cl(m.comp + (ok ? 0.02 : -0.03) * (1 - 0.5 * ocean(c.pers).n), 0, 1);   // competence (SDT)
  if (ok) {
    const k = goal + "@" + slotOf(hour, m.chrono);
    m.habit[k] = cl((m.habit[k] ?? 0) + 0.1 * (1 - (m.habit[k] ?? 0)));
  }
}

/* ---------------- gambling: prospect theory ---------------- */

/** Loss-aversion coefficient: ~2.25 for the average person; anxious, careful people feel losses more. */
export function lossLambda(c: Character): number { const b = ocean(c.pers); return cl(1.4 + 1.5 * b.n + 0.7 * b.c - 0.5 * c.pers.boldness, 1.2, 3.4); }
/** Kahneman-Tversky value function over a gain/loss expressed in units of stake. */
export function prospect(x: number, lambda: number): number { return x >= 0 ? Math.pow(x, 0.88) : -lambda * Math.pow(-x, 0.88); }
/** Impulsivity: low conscientiousness, high extraversion/boldness (sensation seeking). */
export function impulsivity(c: Character): number { const b = ocean(c.pers); return cl(0.6 * (1 - b.c) + 0.25 * b.e + 0.15 * c.pers.boldness); }

/** After a session: update caution (once bitten) or the urge to chase, learn the casino's value. */
export function noteGamble(sim: Simulation, c: Character, net: number, stake: number): void {
  const m = c.mind, g = m.gamble, lam = lossLambda(c), imp = impulsivity(c);
  const ref = Math.max(20, stake);
  const pv = prospect(net / ref, lam);
  if (net < 0) {
    const pain = Math.min(1.5, -pv) / 1.5;
    const lamN = cl((lam - 1.2) / 2.2);
    g.caution = cl(g.caution + pain * 0.55 * (1 - imp) * (0.5 + lamN));
    g.urge = cl(g.urge + pain * 0.6 * imp * (1.1 - 0.5 * lamN) + c.emo.frustration * 0.1);
    g.streak++;
    appraise(c, sim.tick, { rel: Math.min(1, 0.3 + pain), cong: -pain, ctrl: 0.35, blame: "self" });
    if (pain > 0.35) newLog(m, sim.tick, imp > 0.5 ? "Dropped a stack at the casino. I'll win it back, I know I will." : "Dropped a stack at the casino. Never again, or at least not soon.");
  } else {
    g.caution = cl(g.caution - 0.1); g.urge = cl(g.urge - 0.35); g.streak = 0;
    appraise(c, sim.tick, { rel: 0.4, cong: Math.min(0.8, net / ref), ctrl: 0.6, blame: "self" });
  }
  g.net += net;
  const reward = cl(pv / 1.5, -1, 0.8);
  td(c, "place:casino", reward);
  m.names["place:casino"] = "casino";
}

/** Probability of staying at the table for another round (chasing losses vs quitting). */
export function chaseProbability(c: Character, net: number, stake0: number): number {
  const g = c.mind.gamble, imp = impulsivity(c), b = ocean(c.pers), lam = lossLambda(c);
  if (net < 0) {
    const z = 3 * (imp - 0.5) + 2 * g.urge + 1.2 * Math.min(1, -net / Math.max(10, stake0)) + 1.0 * c.emo.frustration - 2.5 * g.caution - 0.8 * (lam - 2.25);
    return 1 / (1 + Math.exp(-z));
  }
  // house-money effect for the bold; the careful lock in a win
  return cl(0.3 + 0.3 * c.pers.boldness - 0.4 * g.caution - 0.2 * b.n, 0, 0.9);
}
/** Next stake multiplier for the first round of a visit. */
export function stakeFactor(c: Character): number { const g = c.mind.gamble; return cl(1 + 0.8 * g.urge - 0.65 * g.caution, 0.3, 2); }

/* ---------------- social learning (Bandura) ---------------- */

/** How strongly `a` is influenced by `b`: liking, respect, status, and a conformity trait. */
export function influence(a: Character, b: Character): number {
  const r = peek(a, b.id);
  if (!r) return 0;
  const w = 0.4 * Math.max(0, r.aff) + 0.3 * Math.max(0, r.respect) + 0.15 * Math.max(0, b.reputation) + 0.15 * Math.min(1, r.fam);
  return cl(w * (0.5 + a.mind.conform), 0, 1);
}

/** One-way imitation: `a` nudges its tastes toward `b`'s, and hears about `b`'s aversions. Returns number of keys changed. */
export function socialLearn(sim: Simulation, a: Character, b: Character): number {
  const w = influence(a, b);
  if (w < 0.02) return 0;
  let changed = 0;
  for (const k in b.mind.v) {
    if (!k.startsWith("item:") && !k.startsWith("place:")) continue;
    const vb = b.mind.v[k];
    if (Math.abs(vb) < 0.12) continue;
    const va = a.mind.v[k] ?? 0;
    a.mind.v[k] = cl(va + w * 0.35 * (vb - va), -1.5, 1.5);
    if (k.startsWith("place:") && b.mind.names[k]) a.mind.names[k] = b.mind.names[k];
    changed++;
  }
  // gossip carries a fear of the thing: vicarious conditioning at a fraction of first-hand strength
  for (const k in b.mind.av) {
    const sb = aversion(b, k, sim.tick);
    if (sb > 0.3 && aversion(a, k, sim.tick) < sb * 0.3) { addAversion(a, k, sb * 0.45 * Math.min(1, w * 2), sim.tick); changed++; }
  }
  if (changed) trimValues(a);
  return changed;
}
