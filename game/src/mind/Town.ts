import type { Character } from "../entities/types";
import { Lod } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import { T } from "../world/World";
import type { CultureProfile } from "./Culture";
import { deriveProfile, getProfile, setProfile } from "./Culture";
import { updateDress } from "./Dress";
import { updateWhanau } from "./Whanau";
export { kin } from "./Kin";
export type { Kin } from "./Kin";

/**
 * TOWN PSYCHOLOGY: the shared norms that make people from here behave recognisably Kiwi, and make
 * outsiders stand out.
 *
 * Theory: a norm is a behavioural regularity sustained by expectation and mild sanction (Cialdini,
 * Reno & Kallgren 1990 on descriptive vs injunctive norms; Gelfand et al. 2011 on tightness). NZ is
 * "loose" about rules (jaywalking on an empty road is fine) but "tight" on politeness and fairness
 * (queueing, modesty, not making a fuss). Sanctions are gentle and indirect: a dry remark, a raised
 * eyebrow, "yeah nah, the queue's back there" (Kiwi indirectness; Hofstede PDI ~22 means nobody
 * grovels to authority). Newcomers acculturate: each correction raises their adherence
 * (Berry's acculturation model, reduced to one number).
 *
 * Everything here is derived from `CultureProfile` (never saved). The behaviours write only bubbles,
 * small relationship/affect nudges and tip cash, all through the seeded `sim.rng`, so it is
 * deterministic.
 */

export type Violation = "loud" | "tip" | "queue" | "formal_cop";
export interface NormEvent { tick: number; kind: Violation | "greet" | "help" | "famiglia" | "cop_hello"; offender: number; other: number; line: string }

export interface TownState {
  lastGreet: Map<number, number>;
  cooldown: Map<number, number>;
  log: NormEvent[];
  stats: { violations: number; callouts: number; greetings: number; helps: number; famiglia: number; tips: number; tipsRefused: number };
}
const TOWNS = new WeakMap<Simulation, TownState>();
export function townOf(sim: Simulation): TownState {
  let s = TOWNS.get(sim);
  if (!s) { s = { lastGreet: new Map(), cooldown: new Map(), log: [], stats: { violations: 0, callouts: 0, greetings: 0, helps: 0, famiglia: 0, tips: 0, tipsRefused: 0 } }; TOWNS.set(sim, s); }
  return s;
}

/** Profile for anyone, creating it lazily (e.g. right after a save is loaded). */
export function profile(sim: Simulation, c: Character): CultureProfile {
  return getProfile(c) ?? setProfile(c, deriveProfile(sim.cfg.seed, c.id, c.role, sim.world.areas[c.homeArea]?.kind ?? "street", c.tier === "principal"));
}

// ---------------------------------------------------------------- pure norm functions (tested directly)

/** Would this person cross against the light on an empty road? Low PDI, loose rules: mostly yes. */
export function jaywalkProbability(p: CultureProfile, carNearby: boolean): number {
  if (carNearby) return 0.04 * (1 - p.ocean.N); // nobody is that loose
  return Math.min(1, p.norms.jaywalkTolerance * (0.55 + 0.6 * (1 - p.ocean.C) + 0.15 * (p.cohort === "youth" ? 1 : 0)) * (p.cohort === "older" ? 0.5 : 1));
}

/** How likely they are to cut a queue or push in, given the local queueing norm and their adherence. */
export function queueCutProbability(p: CultureProfile): number {
  return Math.max(0, 0.02 + (1 - p.adherence) * 0.5 * (1 - p.norms.queueing * 0.5));
}

/** Tip as a fraction of the bill. NZ has no tipping norm: locals mostly pay exact, visitors may tip. */
export function tipFraction(p: CultureProfile, roll: number): number {
  const willing = p.norms.tipping * (p.local ? 0.6 : 1.0);
  if (roll > willing) return 0;
  return p.local ? 0.05 : 0.12; // a local rounds up a bit, a visitor tips 10-15%
}

/** 0..1 how readily they comply with / talk to police, and how much they grovel. Low PDI: civil, not servile. */
export function copDeference(p: CultureProfile): { civility: number; servility: number } {
  return { civility: Math.min(1, 0.6 + p.ocean.A * 0.4), servility: p.register.deference * (1 - p.norms.authoritySkepticism * 0.6) };
}

export interface FamigliaReaction { fear: number; mock: number; pay: number }
/**
 * Reaction to the Famiglia Tessera. Egalitarian scepticism turns a mob into a joke for the young and
 * dry; the timid, older and shopkeepers keep their heads down and pay in pies.
 */
export function famigliaReaction(p: CultureProfile, role: string, boldness: number): FamigliaReaction {
  const fear = Math.max(0, Math.min(1, (1 - boldness) * 0.55 + p.register.deference * 0.5 + (p.cohort === "older" ? 0.15 : 0) - 0.1));
  const mock = Math.max(0, Math.min(1, p.register.banter * 0.6 + (p.cohort === "youth" ? 0.2 : 0) + boldness * 0.2 - fear * 0.3));
  const pay = role === "shopkeeper" || role === "vendor" || role === "chef" || role === "barista" ? 0.85 : 0.1;
  return { fear, mock, pay };
}

// ---------------------------------------------------------------- lines (kept short; PG-13 dry)

type Tone = "polite" | "dry" | "casual";
const CALLOUT: Record<Violation, Record<Tone, string[]>> = {
  queue: {
    polite: ["Sorry, I think the queue starts back there.", "Excuse me, we're all in a line here."],
    dry: ["Oh, you're in a hurry. We're all in a hurry.", "Yeah nah, the end of the line's back there."],
    casual: ["Mate, the queue's back there.", "End of the line, bro."],
  },
  tip: {
    polite: ["Oh, lovely, but we don't do tips here. Cheers though!", "That's kind, but no need at all."],
    dry: ["Tipping? Steady on, we'll all get ideas.", "Keep it. Buy yourself a pie."],
    casual: ["Nah, you're right, mate. We don't tip here.", "All good, keep your cash, eh."],
  },
  loud: {
    polite: ["Gentle on the volume, love, there's a good lad.", "Just a bit quieter, if you can."],
    dry: ["Bit keen, aren't we.", "Inside voice, mate. We're outside, but still."],
    casual: ["Easy, tourist.", "Settle, petal. It's only Christchurch."],
  },
  formal_cop: {
    polite: ["Just 'hello' is fine.", "No need for 'sir' here."],
    dry: ["Sir's my dad. Mate'll do.", "I work for a living, just call me Dave."],
    casual: ["Haha, 'sir'. Nah, just mate.", "Chill, bro. I'm just a person."],
  },
};
const OFFENCE: Record<Violation, string[]> = {
  loud: ["WOW, THIS IS AMAZING!", "Honey, LOOK at that!", "It is SO cheap here!"],
  tip: ["Here, a tip for you!", "Keep the change! Twenty percent?"],
  queue: ["Excuse me, just ahead of you.", "Hi! I just need to squeeze in here."],
  formal_cop: ["Good day, SIR, officer, sir!", "Yes sir, no sir, officer!"],
};
const GREET_DAY = ["Morning.", "G'day.", "Hey.", "Kia ora.", "How's it going?", "Not bad out.", "Cheers."];
const GREET_NIGHT = ["Evening.", "Hey.", "Chur.", "Night, eh."];
const GREET_COP = ["G'day officer.", "Hey, how's it going?", "All good, officer."];
const HELP = ["You right, mate?", "Whoa, you alright?", "Kia kaha. Up you get.", "Sweet as, take my hand."];

function toneOf(p: CultureProfile): Tone { return p.register.banter > 0.55 ? "dry" : p.register.formality > 0.45 ? "polite" : "casual"; }
export function calloutLine(kind: Violation, p: CultureProfile, pick: <T>(a: readonly T[]) => T): string { return pick(CALLOUT[kind][toneOf(p)]); }

// ---------------------------------------------------------------- the tick

const scratch: number[] = [];
const REACH = 6;

function free(sim: Simulation, c: Character): boolean {
  return c.inside < 0 && c.inCar < 0 && c.lod <= Lod.REDUCED && !(c.bubble && c.bubble.until > sim.tick) && c.talkWith < 0 && c.phys === 0;
}

function logEvent(st: TownState, e: NormEvent): void { st.log.push(e); if (st.log.length > 80) st.log.shift(); }

/** Called once a second from the environment tick. Cheap: a staggered slice of the town per call. */
export function updateTown(sim: Simulation): void {
  updateDress(sim);
  updateWhanau(sim);
  const st = townOf(sim);
  const slot = Math.floor(sim.tick / 60) % 6;
  for (const c of sim.chars) {
    if (c.tier === "player" || c.lod > Lod.REDUCED || c.inside >= 0 || c.inCar >= 0) continue;
    const isTourist = c.role === "tourist";
    if (!isTourist && (c.id % 6) !== slot) continue;
    if (!free(sim, c)) continue;
    const p = profile(sim, c);
    const n = sim.charHash.query(c.x, c.y, REACH, scratch);
    if (isTourist) { touristBehaviour(sim, st, c, p, n); continue; }
    localBehaviour(sim, st, c, p, n);
  }
}

function localBehaviour(sim: Simulation, st: TownState, c: Character, p: CultureProfile, n: number): void {
  const rng = sim.rng, tick = sim.tick;
  let crowd = 0, nearest: Character | null = null, nd = 99;
  let faller: Character | null = null, mob: Character | null = null, cop: Character | null = null;
  for (let i = 0; i < n; i++) {
    const o = sim.chars[scratch[i]];
    if (!o || o.id === c.id || o.inside >= 0) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    crowd++;
    if (d < nd && o.phys === 0) { nd = d; nearest = o; }
    if (o.phys === 2 && d < 5 && !faller) faller = o;
    if (o.role === "mobster" && c.role !== "mobster" && d < 4.5 && !mob) mob = o;
    if (o.role === "cop" && c.role !== "cop" && d < 3.5 && !cop) cop = o;
  }
  // community spirit after the quakes: help somebody who has gone down, even a stranger
  if (faller && rng.chance(p.norms.quakeResilience * (0.2 + 0.5 * c.pers.kindness))) {
    const line = rng.pick(HELP);
    sim.say(c, line, "say", 2);
    const r = sim.relate(c, faller.id); r.fam = Math.min(1, r.fam + 0.08); r.aff = Math.min(1, r.aff + 0.05);
    faller.emo.composure = Math.min(1, faller.emo.composure + 0.05);
    st.stats.helps++; logEvent(st, { tick, kind: "help", offender: faller.id, other: c.id, line });
    return;
  }
  // the Famiglia: some freeze, some joke, shopkeepers hand over pies
  if (mob && rng.chance(0.18)) {
    const f = famigliaReaction(p, c.role, c.pers.boldness);
    let line: string, kind: "say" | "think" = "say";
    const r = rng.next();
    if (f.pay > 0.5 && r < f.pay) line = rng.pick(["Pies are on the house, Mr Tessera.", "The usual, boys. Mince and cheese."]);
    else if (r < f.fear) { line = rng.pick(["…Evening, Mr Tessera.", "Not a word. I saw nothing."]); c.emo.fear = Math.min(1, c.emo.fear + 0.04); }
    else if (r < f.fear + f.mock) { line = rng.pick(["Nice tomatoes, Vito.", "Hope the pie's worth the protection."]); kind = "think"; }
    else line = rng.pick(["Evening.", "Hey."]);
    sim.say(c, line, kind, 2.2);
    st.stats.famiglia++; logEvent(st, { tick, kind: "famiglia", offender: mob.id, other: c.id, line });
    return;
  }
  if (cop && rng.chance(0.05 * (0.5 + copDeference(p).civility))) {
    const line = rng.pick(GREET_COP);
    sim.say(c, line, "say", 1.8);
    const r = sim.relate(c, cop.id); r.respect = Math.min(1, r.respect + 0.02);
    logEvent(st, { tick, kind: "cop_hello", offender: c.id, other: cop.id, line });
    return;
  }
  // greeting strangers: small-country manners. Quiet street (few people) = more nods.
  if (nearest && nd < 2.4 && crowd <= 6) {
    const key = Math.min(c.id, nearest.id) * 4096 + Math.max(c.id, nearest.id);
    if ((st.lastGreet.get(key) ?? -9999) + 60 * 120 > tick) return;
    const quiet = 1.15 - Math.min(1, crowd / 7) * 0.6;
    const pg = p.norms.greetStrangers * (0.35 + 0.65 * p.ocean.E) * quiet * (nearest.role === "tourist" ? 1.3 : 1) * (p.cohort === "older" ? 1.2 : 1);
    if (rng.chance(pg * 0.5)) {
      const night = sim.hour >= 20 || sim.hour < 5;
      const line = rng.pick(night ? GREET_NIGHT : GREET_DAY);
      sim.say(c, line, "say", 1.5);
      st.lastGreet.set(key, tick);
      const r = sim.relate(c, nearest.id); r.fam = Math.min(1, r.fam + 0.03); r.aff = Math.min(1, r.aff + 0.01);
      st.stats.greetings++; logEvent(st, { tick, kind: "greet", offender: c.id, other: nearest.id, line });
    }
  }
}

function touristBehaviour(sim: Simulation, st: TownState, c: Character, p: CultureProfile, n: number): void {
  const rng = sim.rng, tick = sim.tick;
  if ((st.cooldown.get(c.id) ?? 0) > tick) return;
  if (rng.chance(0.85)) return; // most seconds they behave
  const locals: Character[] = [];
  let worker: Character | null = null, cop: Character | null = null, still = 0;
  for (let i = 0; i < n; i++) {
    const o = sim.chars[scratch[i]];
    if (!o || o.id === c.id || o.inside >= 0 || o.role === "tourist") continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    locals.push(o);
    if (d < 3.5 && (o.role === "barista" || o.role === "vendor" || o.role === "shopkeeper" || o.role === "chef") && !worker) worker = o;
    if (d < 4 && o.role === "cop" && !cop) cop = o;
    if (Math.hypot(o.vx, o.vy) < 0.1 && d < 4.5) still++;
  }
  if (!locals.length) return;
  const options: [Violation, number][] = [
    ["loud", 1 - p.norms.modesty * 0.3 + (1 - p.adherence)],
    ["tip", worker && c.cash > 8 ? 1.2 * (1 - p.adherence) * (p.norms.tipping + 0.2) : 0],
    ["queue", still >= 2 ? 3 * queueCutProbability(p) : 0],
    ["formal_cop", cop ? 1.5 * (1 - p.adherence) : 0],
  ];
  const k = rng.weighted(options.map((x) => x[1]));
  if (k < 0) return;
  const kind = options[k][0];
  const offence = rng.pick(OFFENCE[kind]);
  sim.say(c, offence, kind === "loud" ? "shout" : "say", 2);
  st.cooldown.set(c.id, tick + 60 * 25);
  st.stats.violations++;
  const target: Character | null = kind === "tip" ? worker : kind === "formal_cop" ? cop : null;
  if (kind === "tip" && worker) {
    const fee = rng.int(2, 6);
    const wp = profile(sim, worker);
    if (rng.chance(1 - wp.norms.tipping * 0.7) && c.cash >= fee) { st.stats.tipsRefused++; }
    else { c.cash -= fee; worker.cash += fee; st.stats.tips++; }
  }
  logEvent(st, { tick, kind, offender: c.id, other: target ? target.id : -1, line: offence });
  // a nearby local gently calls it out (Kiwi sanction: indirect, mild, often funny)
  let caller: Character | null = target;
  if (!caller) {
    let best = 0;
    for (const o of locals) {
      if (o.tier === "player" || !free(sim, o)) continue;
      const op = profile(sim, o);
      const s = op.norms.queueing * (0.4 + op.ocean.C) * (0.5 + 0.5 * op.ocean.A) * (o.phys === 0 ? 1 : 0);
      if (s > best) { best = s; caller = o; }
    }
  }
  if (!caller) return;
  const cp = profile(sim, caller);
  if (!rng.chance(0.35 + 0.5 * cp.norms.politeness * (kind === "formal_cop" || kind === "tip" ? 1 : 0.8))) return;
  const reply = calloutLine(kind, cp, (a) => rng.pick(a));
  caller.facing = Math.atan2(c.y - caller.y, c.x - caller.x);
  // the reply lands after the offence has been heard, so it overrides the caller's bubble
  sim.say(caller, reply, "say", 2.6);
  p.adherence = Math.min(0.92, p.adherence + 0.06); // acculturation: the correction sticks
  c.emo.mood = Math.max(-1, c.emo.mood - 0.03);
  const r = sim.relate(caller, c.id); r.fam = Math.min(1, r.fam + 0.05);
  st.stats.callouts++;
  logEvent(st, { tick, kind, offender: c.id, other: caller.id, line: reply });
}

/** Terrain helper for callers: is the point on a road (jaywalking context)? */
export function onRoad(sim: Simulation, x: number, y: number): boolean {
  const t = sim.world.tile(Math.floor(x), Math.floor(y));
  return t === 16 /* road */ || t === (T.STREET as number);
}
