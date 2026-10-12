import type { Character } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import { Rng, hashString } from "../core/rng";
import { deriveProfile, getProfile, setProfile } from "./Culture";
import type { CultureProfile } from "./Culture";

/**
 * KIN GROUPS (whānau) and heritable liability.
 *
 * Families are ordinary people who live in the same district, are given one surname, and (where the
 * ages allow) a parent couple plus children. Everything is *derived* from persistent state (surname,
 * homeArea, the age of the cultural profile), so nothing needs saving: after a load `kin()` rebuilds
 * the same groups.
 *
 * `liability` is a 0..1 heritable vulnerability number (the genetic liability term of the
 * diathesis-stress model, Zubin & Spring 1977; twin studies put the heritability of the major
 * psychiatric conditions around 0.4-0.8, e.g. Sullivan, Kendler & Neale 2003). Founders draw from a
 * right-skewed population distribution; a child's liability is the mean of the parents' (additive
 * polygenic model, Falconer 1965) plus segregation noise. It is a *risk*, not a destiny, and it
 * reads as "family history" only; Psychopathology.ts decides what it does.
 *
 * All randomness comes from private streams keyed on seed/id, never `sim.rng`.
 */

export interface Kin {
  /** shared surname, or "" for someone with no family */
  family: string;
  parents: number[];
  siblings: number[];
  children: number[];
  /** everyone in the group other than self */
  members: number[];
  /** heritable liability 0..1 */
  liability: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const surnameOf = (name: string) => name.slice(name.lastIndexOf(" ") + 1);

/** A founder's liability: right-skewed (most people low, a tail high), mean about 0.25. */
export function founderLiability(seed: number, id: number): number {
  const r = new Rng((seed ^ Math.imul(id + 7, 0x85ebca6b) ^ 0x11AB) >>> 0);
  const u = r.next(), g = r.gauss();
  return clamp01(0.12 + 0.28 * u * u + 0.07 * g + 0.1 * u);
}

const SEGREGATION_SD = 0.08;

function ageOf(sim: Simulation, c: Character): number {
  const p: CultureProfile = getProfile(c) ?? setProfile(c, deriveProfile(sim.cfg.seed, c.id, c.role, sim.world.areas[c.homeArea]?.kind ?? "street", c.tier === "principal"));
  return p.age;
}

/** Parents are the oldest two when there are at least three members and a real generation gap. */
function split(sim: Simulation, members: Character[]): { parents: Character[]; children: Character[] } {
  const s = [...members].sort((a, b) => ageOf(sim, b) - ageOf(sim, a) || a.id - b.id);
  if (s.length >= 3 && ageOf(sim, s[1]) - ageOf(sim, s[s.length - 1]) >= 14) return { parents: s.slice(0, 2), children: s.slice(2) };
  if (s.length === 2 && ageOf(sim, s[0]) - ageOf(sim, s[1]) >= 16) return { parents: [s[0]], children: [s[1]] };
  return { parents: [], children: s };
}

const cache = new WeakMap<Simulation, { n: number; byId: Map<number, Kin> }>();

function build(sim: Simulation): Map<number, Kin> {
  const groups = new Map<string, Character[]>();
  for (const c of sim.chars) {
    if (c.tier === "player" || c.tier === "background" || c.role === "tourist") continue;
    const k = `${surnameOf(c.name)}|${c.homeArea}`;
    const g = groups.get(k); if (g) g.push(c); else groups.set(k, [c]);
  }
  const out = new Map<number, Kin>();
  const seed = sim.cfg.seed;
  const liab = new Map<number, number>();
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const { parents, children } = split(sim, members);
    const fam = key.split("|")[0];
    // a family latent factor stands in for absent parents (siblings share it): they are genetically related
    const latent = founderLiability(seed, hashString(key));
    for (const p of parents) liab.set(p.id, founderLiability(seed, p.id));
    const parentMean = parents.length ? parents.reduce((a, p) => a + liab.get(p.id)!, 0) / parents.length : latent;
    for (const ch of children) {
      const r = new Rng((seed ^ Math.imul(ch.id + 3, 0x9e3779b1) ^ 0xC41D) >>> 0);
      liab.set(ch.id, clamp01(parentMean + r.gauss() * SEGREGATION_SD));
    }
    for (const m of members) {
      const isParent = parents.includes(m);
      out.set(m.id, {
        family: fam,
        parents: isParent ? [] : parents.map((p) => p.id),
        siblings: isParent ? parents.filter((p) => p !== m).map((p) => p.id) : children.filter((c) => c !== m).map((c) => c.id),
        children: isParent ? children.map((c) => c.id) : [],
        members: members.filter((x) => x !== m).map((x) => x.id),
        liability: liab.get(m.id)!,
      });
    }
  }
  return out;
}

/** Kin of anyone (an empty group with founder liability for people without family). Cached; call `resetKin` after renaming. */
export function kin(sim: Simulation, c: Character): Kin {
  let e = cache.get(sim);
  if (!e || e.n !== sim.chars.length) { e = { n: sim.chars.length, byId: build(sim) }; cache.set(sim, e); }
  return e.byId.get(c.id) ?? { family: "", parents: [], siblings: [], children: [], members: [], liability: founderLiability(sim.cfg.seed, c.id) };
}
export function resetKin(sim: Simulation): void { cache.delete(sim); }

/**
 * Turn some co-located ordinary residents into families by giving them one surname (the oldest's).
 * Uses a private RNG, so the world spawns exactly as it did before. Parents become a couple.
 */
export function makeFamilies(sim: Simulation, eligible: Character[], maxFamilies = 10): number {
  const rng = new Rng((sim.cfg.seed ^ 0xFA11) >>> 0);
  const byArea = new Map<number, Character[]>();
  for (const c of eligible) { const g = byArea.get(c.homeArea); if (g) g.push(c); else byArea.set(c.homeArea, [c]); }
  let made = 0;
  for (const [, pool] of [...byArea].sort((a, b) => a[0] - b[0])) {
    // within a district take up to 4 people: the oldest become the parents
    const picked = pool.map((c) => ({ c, k: rng.next() })).sort((a, b) => a.k - b.k).slice(0, Math.min(4, pool.length)).map((x) => x.c);
    if (picked.length < 3 || made >= maxFamilies) continue;
    const { parents } = split(sim, picked);
    const head = parents[0] ?? [...picked].sort((a, b) => ageOf(sim, b) - ageOf(sim, a))[0];
    const surname = surnameOf(head.name);
    for (const m of picked) {
      if (m === head) continue;
      const old = m.name;
      m.name = old.slice(0, old.lastIndexOf(" ") + 1) + surname;
      m.bio = m.bio.split(old).join(m.name);
      sim.names?.reserve(m.name);
      m.home = head.home;
    }
    if (parents.length === 2) {
      const [a, b] = parents;
      if (a.partner < 0 && b.partner < 0) {
        a.partner = b.id; b.partner = a.id;
        for (const [x, y] of [[a, b], [b, a]] as const) { const r = sim.relate(x, y.id); r.love = 0.7; r.aff = Math.max(r.aff, 0.6); r.trust = Math.max(r.trust, 0.5); r.fam = 1; }
      }
    }
    // everyone in the household knows each other well
    for (const x of picked) for (const y of picked) if (x !== y) { const r = sim.relate(x, y.id); r.fam = Math.max(r.fam, 0.9); r.aff = Math.max(r.aff, 0.4); r.trust = Math.max(r.trust, 0.4); }
    made++;
  }
  resetKin(sim);
  return made;
}
