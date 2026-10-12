import { Character, Memory, MemoryKind, Provenance, Rel } from "../entities/types";
import { clamp } from "../core/math";

/**
 * Sparse social graph. Each character keeps a Map of only the people it has actually interacted with,
 * so cost scales with interactions, not population squared.
 */
export function newRel(tick: number): Rel {
  return { fam: 0, trust: 0, aff: 0, respect: 0, fear: 0, rivalry: 0, grudge: 0, shared: 0, favours: 0, last: tick };
}

export function rel(a: Character, b: number, tick: number): Rel {
  let r = a.rel.get(b);
  if (!r) { r = newRel(tick); a.rel.set(b, r); }
  return r;
}

/** Read-only peek that does not create an edge. */
export function peek(a: Character, b: number): Rel | undefined { return a.rel.get(b); }

export const friendship = (r: Rel | undefined): number => (r ? clamp((r.aff + r.trust) / 2 + r.fam * 0.2 - r.grudge * 0.5, -1, 1) : 0);
export const hostility = (r: Rel | undefined): number => (r ? clamp(r.rivalry * 0.6 + r.grudge * 0.7 - r.aff * 0.3, 0, 1) : 0);

export type Interaction =
  | "hit" | "helped" | "gift" | "insult" | "joke" | "argue" | "apologise" | "talk" | "play" | "party" | "comfort" | "block" | "steal" | "compliment";

/**
 * How an interaction changes the edge from `self` toward `other`, as experienced by `self`.
 * `actorIsOther` = the other person did it to self (vs self did it to other).
 */
export function applyInteraction(self: Character, other: Character, kind: Interaction, actorIsOther: boolean, tick: number, intensity = 1): void {
  const r = rel(self, other.id, tick);
  const k = intensity;
  r.fam = clamp(r.fam + 0.04 * k, 0, 1);
  r.last = tick;
  const temper = self.pers.temper, kind_ = self.pers.kindness;
  switch (kind) {
    case "hit":
      if (actorIsOther) {
        r.grudge = clamp(r.grudge + (0.08 + temper * 0.12) * k, 0, 1);
        r.rivalry = clamp(r.rivalry + 0.06 * k, 0, 1);
        r.aff = clamp(r.aff - 0.06 * k, -1, 1);
        r.trust = clamp(r.trust - 0.05 * k, -1, 1);
        if (self.pers.boldness < 0.45) r.fear = clamp(r.fear + 0.08 * k, 0, 1);
        else r.respect = clamp(r.respect + 0.02, -1, 1);
      } else {
        r.rivalry = clamp(r.rivalry + 0.03 * k, 0, 1);
      }
      break;
    case "block": if (actorIsOther) r.respect = clamp(r.respect + 0.04, -1, 1); break;
    case "helped": case "comfort":
      if (actorIsOther) { r.trust = clamp(r.trust + 0.15 * k, -1, 1); r.aff = clamp(r.aff + 0.12 * k, -1, 1); r.grudge = clamp(r.grudge - 0.1, 0, 1); r.favours += 1; }
      else { r.aff = clamp(r.aff + 0.05, -1, 1); r.favours -= 1; }
      break;
    case "gift":
      if (actorIsOther) { r.aff = clamp(r.aff + 0.14 * k, -1, 1); r.trust = clamp(r.trust + 0.08, -1, 1); r.grudge = clamp(r.grudge - 0.12, 0, 1); r.favours += 1; }
      else { r.aff = clamp(r.aff + 0.04, -1, 1); }
      break;
    case "insult":
      if (actorIsOther) { r.aff = clamp(r.aff - 0.1 * k, -1, 1); r.grudge = clamp(r.grudge + (0.05 + temper * 0.08) * k, 0, 1); r.rivalry = clamp(r.rivalry + 0.05, 0, 1); }
      break;
    case "steal":
      if (actorIsOther) { r.trust = clamp(r.trust - 0.2, -1, 1); r.grudge = clamp(r.grudge + 0.15, 0, 1); }
      break;
    case "joke": case "compliment":
      r.aff = clamp(r.aff + (actorIsOther ? 0.07 : 0.03) * k, -1, 1);
      break;
    case "argue":
      r.aff = clamp(r.aff - 0.05, -1, 1); r.rivalry = clamp(r.rivalry + 0.05, 0, 1);
      r.grudge = clamp(r.grudge + 0.03 * temper, 0, 1);
      break;
    case "apologise":
      if (actorIsOther) { const forgive = 0.1 + kind_ * 0.25 - temper * 0.1; r.grudge = clamp(r.grudge - forgive, 0, 1); r.trust = clamp(r.trust + 0.05, -1, 1); r.rivalry = clamp(r.rivalry - 0.05, 0, 1); }
      break;
    case "talk": r.aff = clamp(r.aff + 0.02 * k, -1, 1); r.trust = clamp(r.trust + 0.01, -1, 1); break;
    case "play": case "party": r.aff = clamp(r.aff + 0.04 * k, -1, 1); r.shared++; break;
  }
}

/** Slow drift: grudges fade (kind people forgive faster), familiarity decays without contact. */
export function decayRelations(c: Character, tick: number, ticksElapsed: number): void {
  const f = ticksElapsed / 3600; // per simulated minute
  for (const [id, r] of c.rel) {
    r.grudge = Math.max(0, r.grudge - f * (0.01 + c.pers.kindness * 0.02));
    r.fear = Math.max(0, r.fear - f * 0.03);
    r.rivalry = Math.max(0, r.rivalry - f * 0.005);
    if (tick - r.last > 60 * 600) r.fam = Math.max(0, r.fam - f * 0.01);
    // prune meaningless edges to keep the graph sparse
    if (r.fam < 0.01 && Math.abs(r.aff) < 0.01 && r.grudge < 0.01 && r.shared === 0) c.rel.delete(id);
  }
}

export function remember(c: Character, m: Omit<Memory, "cred" | "from" | "src"> & Partial<Pick<Memory, "cred" | "from" | "src">>): Memory {
  const mem: Memory = { src: "saw", from: -1, cred: 1, ...m } as Memory;
  // dedupe: same kind/subject/event within 5 seconds just refreshes
  for (let i = c.memories.length - 1; i >= Math.max(0, c.memories.length - 6); i--) {
    const o = c.memories[i];
    if (o.kind === mem.kind && o.subj === mem.subj && o.obj === mem.obj && (o.ev === mem.ev && mem.ev >= 0 || mem.t - o.t < 300)) {
      o.t = mem.t; o.cred = Math.max(o.cred, mem.cred);
      return o;
    }
  }
  c.memories.push(mem);
  if (c.memories.length > c.memMax) {
    // forget the least important: weakest |valence| * credibility among the oldest half
    let worst = 0, ws = Infinity;
    for (let i = 0; i < c.memories.length / 2; i++) { const s = Math.abs(c.memories[i].val) * c.memories[i].cred + 0.1; if (s < ws) { ws = s; worst = i; } }
    c.memories.splice(worst, 1);
  }
  return mem;
}

export function knows(c: Character, ev: number): Memory | undefined {
  if (ev < 0) return undefined;
  for (let i = c.memories.length - 1; i >= 0; i--) if (c.memories[i].ev === ev) return c.memories[i];
  return undefined;
}

/** Most salient memory about someone (for dialogue). */
export function memoryAbout(c: Character, who: number): Memory | undefined {
  let best: Memory | undefined, bs = 0;
  for (const m of c.memories) {
    if (m.subj !== who && m.obj !== who) continue;
    const s = Math.abs(m.val) * m.cred + m.t * 1e-7;
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}

/**
 * Gossip: speaker shares their juiciest first-hand-or-heard memory the listener does not already know.
 * Credibility degrades with each hop and with the speaker's dishonesty; the listener records provenance.
 */
export function shareGossip(speaker: Character, listener: Character, tick: number): Memory | null {
  let best: Memory | null = null, bs = 0.15;
  for (const m of speaker.memories) {
    if (m.kind === "talked" || m.subj === listener.id) continue;
    if (m.ev >= 0 && knows(listener, m.ev)) continue;
    const s = Math.abs(m.val) * m.cred * (m.src === "saw" || m.src === "did" ? 1 : 0.7);
    if (s > bs) { bs = s; best = m; }
  }
  if (!best) return null;
  const trust = peek(listener, speaker.id)?.trust ?? 0;
  const src: Provenance = best.src === "did" || best.src === "saw" ? "told" : "heard";
  const cred = clamp(best.cred * (0.55 + speaker.pers.honesty * 0.35) * (0.8 + trust * 0.2), 0.05, 1);
  const m = remember(listener, { t: tick, kind: best.kind === "rumour" ? "rumour" : best.kind, subj: best.subj, obj: best.obj, toy: best.toy, area: best.area, val: best.val * 0.8, ev: best.ev, src, from: speaker.id, cred });
  // opinions travel with gossip: hearing that X hit someone lowers your view of X a little
  if (best.subj >= 0 && best.subj !== listener.id && (best.kind === "hit" || best.kind === "insulted_by" || best.kind === "hit_by")) {
    const aggressor = best.kind === "hit_by" || best.kind === "insulted_by" ? best.subj : best.subj;
    const r = rel(listener, aggressor, tick);
    r.trust = clamp(r.trust - 0.03 * cred, -1, 1);
  }
  return m;
}

export const memoryVerb: Record<MemoryKind, string> = {
  hit_by: "got hit by", hit: "hit", helped_by: "got helped by", helped: "helped", gift_from: "got a gift from", gift_to: "gave a gift to",
  argued: "argued with", made_up: "made up with", insulted_by: "got roasted by", joked_with: "joked around with", saw_fight: "saw a toy fight involving",
  saw_break: "saw something get broken by", lost_item: "lost their", party: "partied with", talked: "talked with", rumour: "heard a rumour about", event: "saw", player_action: "saw the stranger do something",
  saw_crime: "saw a crime by", robbed: "got robbed by", arrested: "saw the police arrest", shoot: "did a photoshoot with", car_hit: "got hit by a car driven by",
  wounded: "got hurt by", kissed: "kissed", dated: "went on a date with", cheating: "caught cheating:", broke_up: "broke up with",
};
