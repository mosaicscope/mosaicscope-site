import { Personality } from "../entities/types";
import type { Character } from "../entities/types";
import type { Role } from "../content/names";
import { Rng, hashString } from "../core/rng";

/**
 * REGIONAL CULTURE: Aotearoa New Zealand / Canterbury / Christchurch.
 *
 * Everything here is a *prior*, built from published cross-cultural research (summarised from the
 * literature, nothing scraped), then bent by district sub-culture, age cohort and chronotype. People
 * are sampled around the prior, so the town is recognisably Kiwi on average while individuals vary:
 * we skew the distribution, we do not stamp a stereotype on anyone.
 *
 * Sources (published literature, figures rounded as commonly reported):
 *  - Hofstede, G., Hofstede, G. J. & Minkov, M. (2010). Cultures and Organizations (3rd ed.), and
 *    the public country comparison for New Zealand: PDI ~22, IDV ~79, MAS ~58, UAI ~49, LTO ~33,
 *    IVR ~75.
 *  - Costa & McCrae (1992) NEO-PI-R / the Five-Factor Model; McCrae & Costa (1997) on its
 *    cross-cultural structure.
 *  - Schmitt, Allik, McCrae & Benet-Martinez (2007), "The geographic distribution of Big Five
 *    personality traits" (56-nation sample; NZ sits high on Openness and Agreeableness, lower on
 *    Neuroticism than the Anglo average). Values below are indicative, not exact.
 *  - Rentfrow, Gosling & Potter (2008) on regional personality clusters (inspires district offsets).
 *  - Feaver (2005) / Phillips (1987) and the NZ "tall poppy syndrome" literature (Kirkwood 2007):
 *    modesty, levelling of the over-confident.
 *  - Gelfand et al. (2011), "Differences between tight and loose cultures": NZ is loosely-normed but
 *    with strong politeness norms (queueing).
 *  - Roenneberg et al. (2007), Munich ChronoType Questionnaire: chronotype shifts later through the
 *    teens, earlier with age. Borbely (1982) two-process model for the alertness curve.
 *  - Canterbury post-earthquake research (e.g. Canterbury Wellbeing Survey, CERA; Johnston et al.
 *    2014 on social capital and recovery): high community spirit, neighbourliness, dark humour.
 *  - NZ Environmental / climate normals (NIWA, Christchurch): seasonal mean temps, nor'wester
 *    foehn, southerly cold snaps.
 */

// ---------------------------------------------------------------- national priors

export interface Hofstede { pdi: number; idv: number; mas: number; uai: number; lto: number; ivr: number }
export const HOFSTEDE_NZ: Readonly<Hofstede> = { pdi: 22, idv: 79, mas: 58, uai: 49, lto: 33, ivr: 75 };

/** Big Five on a 0..1 scale (population means) with a shared individual-difference SD. */
export interface Ocean { O: number; C: number; E: number; A: number; N: number }
export const OCEAN_NZ: Readonly<Ocean> = { O: 0.64, C: 0.56, E: 0.53, A: 0.62, N: 0.40 };
export const OCEAN_SD = 0.17;
const OCEAN_NEUTRAL: Ocean = { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 };

/** Shared social norms, 0..1 strength. Used by Town.ts, Dress.ts and the dialogue bias. */
export interface Norms {
  modesty: number;            // tall-poppy ethos: don't boast, cut the show-off down to size
  understatement: number;     // "not bad" means excellent; "bit of a wind" means gale
  dryHumour: number;
  informality: number;        // first names, shorts at the office, "mate" to the boss
  authoritySkepticism: number;// egalitarian: politeness yes, grovelling no (low PDI)
  queueing: number;           // orderly, politely seething
  politeness: number;         // thank the driver, "cheers", "sorry" when bumped
  greetStrangers: number;     // nod/hello on a quiet street, small-country manners
  tipping: number;            // not customary: exceptional, a bit awkward
  jaywalkTolerance: number;   // crossing against the light on an empty road is shrugged at
  sportMad: number;           // rugby, cricket, netball, the All Blacks, Crusaders
  quakeResilience: number;    // Canterbury: help your neighbour, shrug, "kia kaha"
  weatherTalk: number;        // nor'wester, southerly, "four seasons in a day"
}
export const NZ_NORMS: Readonly<Norms> = {
  modesty: 0.85, understatement: 0.8, dryHumour: 0.8, informality: 0.9, authoritySkepticism: 0.75,
  queueing: 0.9, politeness: 0.8, greetStrangers: 0.55, tipping: 0.08, jaywalkTolerance: 0.7,
  sportMad: 0.75, quakeResilience: 0.8, weatherTalk: 0.85,
};

// ---------------------------------------------------------------- sub-cultures

export type SubcultureId =
  | "cbd" | "student" | "surf" | "port" | "trades" | "hospo" | "service" | "retiree"
  | "creative" | "outdoors" | "famiglia" | "visitor" | "local";
export type Cohort = "youth" | "adult" | "older";
export type Chronotype = "lark" | "neutral" | "owl";

export interface Subculture {
  id: SubcultureId;
  /** Christchurch flavour, for bios and tests */
  where: string;
  /** shift in SD units on each Big Five trait */
  d: Partial<Ocean>;
  /** shift on norms (absolute, clamped) */
  norms: Partial<Norms>;
  /** relative weights of [youth, adult, older] */
  cohorts: [number, number, number];
  /** extra lean towards lark(-) / owl(+), in probability points */
  chronoLean: number;
  /** how much slang the group uses 0..1 */
  slang: number;
  /** what they talk about; feeds the dialogue bias */
  topics: string[];
}

export const SUBCULTURES: Record<SubcultureId, Subculture> = {
  cbd: { id: "cbd", where: "the CBD, Cashel Mall, Victoria Square", d: { C: 0.4, N: 0.2, E: 0.05 }, norms: { informality: 0.75, modesty: 0.8 }, cohorts: [0.25, 0.6, 0.15], chronoLean: -0.05, slang: 0.3, topics: ["work", "coffee", "weather", "rebuild"] },
  student: { id: "student", where: "Riccarton and Ilam (Canterbury Uni)", d: { O: 0.5, C: -0.35, E: 0.25, N: 0.25, A: -0.05 }, norms: { informality: 1, authoritySkepticism: 0.9, jaywalkTolerance: 0.85, sportMad: 0.65, tipping: 0.02 }, cohorts: [0.92, 0.07, 0.01], chronoLean: 0.3, slang: 0.8, topics: ["exams", "flat", "broke", "party", "rugby"] },
  surf: { id: "surf", where: "Sumner and New Brighton beaches", d: { O: 0.3, C: -0.2, N: -0.35, E: 0.2, A: 0.15 }, norms: { informality: 1, modesty: 0.9, weatherTalk: 0.95, greetStrangers: 0.75 }, cohorts: [0.45, 0.4, 0.15], chronoLean: -0.25, slang: 0.85, topics: ["swell", "wind", "tide", "wetsuit", "weather"] },
  port: { id: "port", where: "Lyttelton port and harbour", d: { C: 0.1, E: 0.1, A: 0.0, O: 0.1, N: -0.1 }, norms: { dryHumour: 0.95, authoritySkepticism: 0.85, modesty: 0.9, understatement: 0.9 }, cohorts: [0.2, 0.55, 0.25], chronoLean: -0.2, slang: 0.7, topics: ["ships", "shifts", "weather", "pies", "union"] },
  trades: { id: "trades", where: "Addington and Sydenham workshops", d: { C: 0.3, O: -0.2, A: -0.05, E: 0.0 }, norms: { dryHumour: 0.9, modesty: 0.9, authoritySkepticism: 0.85, sportMad: 0.9 }, cohorts: [0.25, 0.55, 0.2], chronoLean: -0.2, slang: 0.75, topics: ["utes", "rugby", "jobs", "weather", "pies"] },
  hospo: { id: "hospo", where: "Victoria St, the Terraces, New Regent St", d: { E: 0.4, A: 0.3, O: 0.15, C: 0.1 }, norms: { politeness: 0.9, greetStrangers: 0.8, informality: 0.95 }, cohorts: [0.5, 0.4, 0.1], chronoLean: 0.15, slang: 0.65, topics: ["regulars", "coffee", "tips", "weather", "specials"] },
  service: { id: "service", where: "emergency services, council, hospital", d: { C: 0.4, A: 0.25, N: -0.15, E: 0.0 }, norms: { queueing: 0.95, politeness: 0.9, quakeResilience: 0.95 }, cohorts: [0.2, 0.65, 0.15], chronoLean: -0.05, slang: 0.4, topics: ["shifts", "rebuild", "weather", "community"] },
  retiree: { id: "retiree", where: "Fendalton, Merivale, Cashmere", d: { C: 0.3, A: 0.35, N: -0.1, O: -0.25, E: -0.1 }, norms: { queueing: 0.97, politeness: 0.95, greetStrangers: 0.8, modesty: 0.9, jaywalkTolerance: 0.35, quakeResilience: 0.95 }, cohorts: [0.0, 0.1, 0.9], chronoLean: -0.45, slang: 0.3, topics: ["garden", "weather", "rebuild", "grandkids", "cricket"] },
  creative: { id: "creative", where: "the Arts Centre, Sol Square, Gap Filler spaces", d: { O: 0.6, C: -0.25, E: 0.15, A: 0.05, N: 0.15 }, norms: { informality: 1, authoritySkepticism: 0.9, modesty: 0.7 }, cohorts: [0.5, 0.4, 0.1], chronoLean: 0.35, slang: 0.7, topics: ["gigs", "gallery", "rebuild", "projects", "broke"] },
  outdoors: { id: "outdoors", where: "Port Hills tracks, Mt Hutt, the Canterbury high country", d: { O: 0.25, N: -0.3, C: 0.2, E: 0.15 }, norms: { weatherTalk: 1, understatement: 0.95, modesty: 0.9 }, cohorts: [0.4, 0.45, 0.15], chronoLean: -0.4, slang: 0.7, topics: ["snow", "tracks", "weather", "gear", "conditions"] },
  famiglia: { id: "famiglia", where: "behind the casino (parody mob)", d: { A: -0.4, N: 0.1, E: 0.2, C: 0.2 }, norms: { authoritySkepticism: 0.2, modesty: 0.3, queueing: 0.5, politeness: 0.6, understatement: 0.4, informality: 0.4 }, cohorts: [0.1, 0.55, 0.35], chronoLean: 0.3, slang: 0.3, topics: ["family", "tomatoes", "respect", "business"] },
  visitor: { id: "visitor", where: "airport, hotels, the tram", d: { O: 0.3, E: 0.15, C: -0.1 }, norms: { queueing: 0.5, modesty: 0.5, understatement: 0.4, informality: 0.55, tipping: 0.6, greetStrangers: 0.35, jaywalkTolerance: 0.4, weatherTalk: 0.4, authoritySkepticism: 0.4, quakeResilience: 0.3 }, cohorts: [0.3, 0.5, 0.2], chronoLean: 0.1, slang: 0.15, topics: ["sights", "photos", "prices", "where's the", "jetlag"] },
  local: { id: "local", where: "the suburbs of Christchurch", d: {}, norms: {}, cohorts: [0.3, 0.45, 0.25], chronoLean: 0, slang: 0.5, topics: ["weather", "rugby", "rebuild", "traffic", "coffee"] },
};

/** Where an ordinary person lives decides their sub-culture mix (area.kind -> weights). */
const AREA_MIX: Record<string, [SubcultureId, number][]> = {
  plaza: [["cbd", 3], ["local", 3], ["creative", 1], ["student", 1]],
  park: [["surf", 2], ["retiree", 2], ["outdoors", 2], ["local", 2]],
  playground: [["surf", 3], ["student", 1], ["local", 2]],
  court: [["local", 3], ["student", 2], ["trades", 1]],
  market: [["port", 2], ["trades", 2], ["local", 3], ["hospo", 1]],
  food: [["hospo", 4], ["local", 2], ["student", 1]],
  shops: [["hospo", 2], ["cbd", 2], ["local", 3]],
  residential: [["retiree", 3], ["local", 4], ["student", 1], ["trades", 1]],
  alley: [["creative", 3], ["student", 2], ["trades", 1]],
  office: [["cbd", 6], ["local", 1]],
  casino: [["local", 3], ["trades", 1], ["port", 1]],
  gallery: [["creative", 4], ["cbd", 1]],
  stage: [["creative", 4], ["student", 2]],
  street: [["local", 4], ["cbd", 2], ["student", 2], ["retiree", 1], ["trades", 1]],
};
const ROLE_SUB: Partial<Record<Role, SubcultureId>> = {
  student: "student", office: "cbd", barista: "hospo", chef: "hospo", vendor: "hospo", shopkeeper: "hospo",
  cop: "service", medic: "service", cleaner: "service", bouncer: "hospo", dealer: "hospo",
  mechanic: "trades", car_enthusiast: "trades", driver: "trades", taxi: "trades",
  tourist: "visitor", skibunny: "outdoors", zookeeper: "outdoors", skater: "student",
  graffiti: "creative", busker: "creative", musician: "creative", photographer: "creative", comic: "creative", model: "creative",
  mobster: "famiglia", smuggler: "port", thief: "local", mogul: "cbd", vigilante: "cbd", villain: "creative",
};

// ---------------------------------------------------------------- profile

/** How a person talks and carries themselves; all 0..1. Drives dialogue choice and Town behaviour. */
export interface Register {
  formality: number;   // sir/ma'am vs mate
  warmth: number;
  restraint: number;   // understatement, modesty; low = loud / boastful
  slang: number;       // "yeah nah", "sweet as", "chur", "heaps"
  banter: number;      // dry teasing
  deference: number;   // to authority (low in NZ)
}

export interface CultureProfile {
  sub: SubcultureId;
  cohort: Cohort;
  age: number;
  chrono: Chronotype;
  /** hours the body clock runs relative to a neutral type (lark negative, owl positive) */
  phase: number;
  /** the person's mean Big Five *before* individual noise (prior + sub-culture + cohort) */
  ocean: Ocean;
  hof: Hofstede;
  norms: Norms;
  register: Register;
  /** 0..1 how strictly local norms are followed (tourists low, rises as they acculturate) */
  adherence: number;
  local: boolean;
  /** stable personal randoms (0..1) for cosmetic/stylistic choices, so nothing flickers */
  quirk: [number, number, number, number];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function weightedPick<T>(rng: Rng, items: readonly [T, number][]): T {
  const i = rng.weighted(items.map((x) => x[1]));
  return items[Math.max(0, i)][0];
}

/** Choose a sub-culture from role first (a job is a strong cue) then home district. */
export function subcultureFor(rng: Rng, role: Role, areaKind: string): SubcultureId {
  const fixed = ROLE_SUB[role];
  // a role pulls strongly but not totally: 85% of baristas are hospo people, some are students
  if (fixed && rng.chance(role === "tourist" || role === "mobster" ? 1 : 0.85)) return fixed;
  return weightedPick(rng, AREA_MIX[areaKind] ?? AREA_MIX.street);
}

/** Chronotype probabilities by age cohort and sub-culture lean (Roenneberg et al. 2007). */
function chronotypeFor(rng: Rng, cohort: Cohort, lean: number): Chronotype {
  const base = cohort === "youth" ? { lark: 0.15, owl: 0.45 } : cohort === "adult" ? { lark: 0.28, owl: 0.25 } : { lark: 0.55, owl: 0.08 };
  let lark = base.lark - lean, owl = base.owl + lean;
  lark = Math.min(0.85, Math.max(0.03, lark)); owl = Math.min(0.85, Math.max(0.03, owl));
  const r = rng.next() * (lark + owl + 0.3);
  return r < lark ? "lark" : r < lark + owl ? "owl" : "neutral";
}

const COHORT_OCEAN: Record<Cohort, Partial<Ocean>> = {
  // maturity principle (Roberts et al. 2006): C and A rise with age, N falls; O and E dip a little
  youth: { C: -0.25, A: -0.15, N: 0.2, O: 0.15, E: 0.12 },
  adult: {},
  older: { C: 0.2, A: 0.25, N: -0.2, O: -0.2, E: -0.12 },
};

/**
 * Derive a person's cultural profile. Deterministic from (seed, id, role, district): it uses a
 * private RNG stream, never `sim.rng`, so adding it does not perturb the rest of the world, and it is
 * recomputable after a save/load, so nothing here needs serialising.
 */
export function deriveProfile(seed: number, id: number, role: Role, areaKind: string, isMain = false): CultureProfile {
  const rng = new Rng((seed ^ Math.imul(id + 1, 0x9e3779b1) ^ hashString(role)) >>> 0);
  const sub = subcultureFor(rng, role, areaKind);
  const S = SUBCULTURES[sub];
  const cohort: Cohort = (["youth", "adult", "older"] as const)[Math.max(0, rng.weighted(S.cohorts))];
  const age = cohort === "youth" ? rng.int(17, 29) : cohort === "adult" ? rng.int(30, 54) : rng.int(55, 84);
  const chrono = chronotypeFor(rng, cohort, S.chronoLean);
  const phase = chrono === "lark" ? -1.5 - rng.next() : chrono === "owl" ? 1.5 + rng.next() * 1.5 : rng.range(-0.5, 0.5);
  const co = COHORT_OCEAN[cohort];
  const ocean = {} as Ocean;
  for (const k of ["O", "C", "E", "A", "N"] as const) ocean[k] = clamp01(OCEAN_NZ[k] + ((S.d[k] ?? 0) + (co[k] ?? 0)) * OCEAN_SD);
  // sub-culture nudges Hofstede-style dimensions a little (age: older = lower IVR; students = lower UAI)
  const hof: Hofstede = { ...HOFSTEDE_NZ };
  if (cohort === "older") { hof.ivr -= 12; hof.uai += 8; hof.lto += 8; }
  if (cohort === "youth") { hof.ivr += 8; hof.uai -= 8; hof.pdi -= 3; }
  if (sub === "famiglia") { hof.pdi += 35; hof.idv -= 30; hof.uai += 10; }
  const norms = { ...NZ_NORMS } as Norms;
  for (const [k, v] of Object.entries(S.norms) as [keyof Norms, number][]) norms[k] = v;
  const local = sub !== "visitor";
  const adherence = local ? clamp01(0.82 + rng.range(-0.08, 0.1)) : clamp01(0.3 + rng.range(0, 0.25));
  // register: personality + Hofstede + cohort + sub-culture
  const pdi = hof.pdi / 100;
  const register: Register = {
    formality: clamp01(0.25 + pdi * 0.8 + (cohort === "older" ? 0.2 : cohort === "youth" ? -0.1 : 0) - norms.informality * 0.45 + 0.25 + (ocean.C - 0.5) * 0.3),
    warmth: clamp01(0.3 + ocean.A * 0.45 + ocean.E * 0.3 + (norms.politeness - 0.5) * 0.2),
    restraint: clamp01(norms.modesty * 0.5 + norms.understatement * 0.3 + (1 - ocean.E) * 0.25 - 0.1),
    slang: clamp01(S.slang * 0.7 + (cohort === "youth" ? 0.2 : cohort === "older" ? -0.1 : 0) + (rng.next() - 0.5) * 0.2),
    banter: clamp01(norms.dryHumour * 0.55 + ocean.O * 0.2 + ocean.E * 0.2 + (1 - ocean.N) * 0.1 - 0.1),
    deference: clamp01(pdi * 0.8 + (cohort === "older" ? 0.2 : 0) + (1 - norms.authoritySkepticism) * 0.4 - 0.05),
  };
  if (isMain) register.slang = Math.max(register.slang, 0.6);
  return { sub, cohort, age, chrono, phase, ocean, hof, norms, register, adherence, local, quirk: [rng.next(), rng.next(), rng.next(), rng.next()] };
}

// ---------------------------------------------------------------- personality <-> Big Five

/**
 * The game's seven `pers` traits and the Big Five are kept consistent by one pair of linear maps.
 * pers -> OCEAN (a proxy; anger loads on N, honesty-humility is folded into C):
 *   O = curiosity/playfulness, C = honesty & low temper, E = sociability & boldness,
 *   A = kindness & low temper, N = low boldness & temper.
 */
export function oceanOf(p: Personality): Ocean {
  return {
    O: clamp01(0.55 * p.curiosity + 0.45 * p.playfulness),
    C: clamp01(0.6 * p.honesty + 0.4 * (1 - p.temper)),
    E: clamp01(0.6 * p.sociability + 0.4 * p.boldness),
    A: clamp01(0.55 * p.kindness + 0.45 * (1 - p.temper)),
    N: clamp01(0.5 * (1 - p.boldness) + 0.5 * p.temper),
  };
}

/** Shift `pers` by a Big Five delta (inverse map). Each pers trait stays in 0..1. */
export function applyOceanDelta(p: Personality, d: Partial<Ocean>): void {
  const dO = d.O ?? 0, dC = d.C ?? 0, dE = d.E ?? 0, dA = d.A ?? 0, dN = d.N ?? 0;
  p.curiosity = clamp01(p.curiosity + dO); p.playfulness = clamp01(p.playfulness + dO);
  p.honesty = clamp01(p.honesty + dC * 1.2);
  p.sociability = clamp01(p.sociability + dE * 1.2); p.boldness = clamp01(p.boldness + dE * 0.8 - dN * 0.8);
  p.kindness = clamp01(p.kindness + dA * 1.2);
  p.temper = clamp01(p.temper - dC * 0.4 - dA * 0.6 + dN * 0.8);
}

/** How strongly the culture skews an individual (0 = ignore culture, 1 = fully the group mean). */
export const CULTURE_PULL = 0.6;

/**
 * Skew a freshly rolled personality towards this person's culture. The roll keeps its own variance
 * (SD ~0.22), only the *mean* moves, by `CULTURE_PULL` of the gap between the profile's Big Five and
 * the neutral 0.5. That is the "skew, not stereotype" rule: lots of loud Kiwis and shy surfers remain.
 */
export function culturalize(p: Personality, prof: CultureProfile): Personality {
  const delta: Partial<Ocean> = {};
  for (const k of ["O", "C", "E", "A", "N"] as const) delta[k] = (prof.ocean[k] - OCEAN_NEUTRAL[k]) * CULTURE_PULL;
  // tall-poppy ethos: nobody sits far above the pack on boldness-as-showing-off
  applyOceanDelta(p, delta);
  p.boldness = clamp01(p.boldness - (prof.norms.modesty - 0.5) * 0.12 * Math.max(0, p.boldness - 0.5) * 2);
  return p;
}

// ---------------------------------------------------------------- circadian + sport etc.

/**
 * Alertness 0..1 by hour for a person (Borbely's Process C as a cosine, peak ~14:00 shifted by the
 * chronotype phase, plus a dip after lunch and a night trough). Larks peak early, owls late.
 */
export function alertness(prof: CultureProfile, hour: number): number {
  const h = (hour - prof.phase + 24) % 24;
  const c = 0.5 + 0.5 * Math.cos(((h - 14.5) / 24) * Math.PI * 2);
  const postLunch = 0.1 * Math.exp(-((h - 15) ** 2) / 2);
  return clamp01(c - postLunch);
}

/** Shift a daily routine (sorted [hour, areaKind][]) by the chronotype phase, keeping it sorted. */
export function shiftRoutine(routine: [number, string][], prof: CultureProfile): [number, string][] {
  const s = Math.round(Math.max(-1.5, Math.min(1.5, prof.phase)) * 2) / 2;
  let last = -1;
  return routine.map(([h, k]) => {
    const nh = Math.min(23.5, Math.max(0, h + s));
    const fixed = Math.max(nh, last + 0.25);
    last = fixed;
    return [fixed, k] as [number, string];
  });
}

/** Per-simulation cache of cultural profiles: derived, never saved. */
const PROFILES = new WeakMap<Character, CultureProfile>();
export function setProfile(c: Character, p: CultureProfile): CultureProfile { PROFILES.set(c, p); return p; }
export function getProfile(c: Character): CultureProfile | undefined { return PROFILES.get(c); }
/** Profile of anyone, computing on demand (after a load, or for characters spawned elsewhere). */
export function profileOf(seed: number, c: Character, areaKind: string): CultureProfile {
  let p = PROFILES.get(c);
  if (!p) { p = deriveProfile(seed, c.id, c.role, areaKind, c.tier === "principal"); PROFILES.set(c, p); }
  return p;
}
