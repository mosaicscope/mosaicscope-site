import type { Character } from "../entities/types";
import { Lod } from "../entities/types";
import type { Simulation } from "../sim/Simulation";
import type { CultureProfile } from "./Culture";
import { deriveProfile, getProfile, setProfile } from "./Culture";
import { kin } from "./Kin";

/**
 * WHĀNAU NET: how a Kiwi town cares for (and fails to care for) a struggling person.
 *
 * Three culture-driven mechanisms, none of them clinical (diagnosis and treatment belong to
 * Psychopathology.ts); this is the *social* layer around it:
 *
 *  1. Whānau buffering. Social support moderates stress (Cohen & Wills 1985, stress-buffering
 *     hypothesis). Family close by turns a heavy load into a lighter one. The frame is Durie's
 *     Te Whare Tapa Whā (1984), where taha whānau (family and social wellbeing) is one wall of the
 *     house of health, standing next to taha hinengaro (mind), taha tinana (body) and taha wairua.
 *  2. Community check-ins. Neighbours and mates notice, and ask. Canterbury's post-quake
 *     neighbourliness (Johnston et al. 2014) and the national "Are you OK?" and "Gumboot Friday"
 *     habits are the model. Men often do it shoulder to shoulder ("fancy a beer and a yarn?"):
 *     indirect register, same care.
 *  3. Stigma delays help-seeking. "Harden up" and "she'll be right" (stoicism norms, higher in men,
 *     older people, trades and port work) postpone walking into Pūtahi; whānau encouragement
 *     shortens the wait; every visible good outcome lowers the town's stigma (the contact
 *     hypothesis: Corrigan et al. 2012, on how contact reduces stigma; Time to Change, Like Minds
 *     Like Mine in NZ).
 *
 * Reads only public fields (`c.mind.stress`, emo, needs). Everything it keeps is derived or
 * transient, so nothing here is saved; the effect on a person (their stress) is what persists.
 */

export interface CareState {
  /** town-level stigma 0..1; falls as people visibly get help and are fine */
  stigma: number;
  /** stress first crossed the help threshold at this tick (per person), to measure the wait */
  struggling: Map<number, number>;
  cooldown: Map<number, number>;
  stats: { checkIns: number; buffered: number; visits: number; waited: number[] };
  log: { tick: number; kind: "checkin" | "whanau" | "visit"; who: number; by: number; line: string }[];
}
const STATES = new WeakMap<Simulation, CareState>();
export const STIGMA_START = 0.55;
export function careOf(sim: Simulation): CareState {
  let s = STATES.get(sim);
  if (!s) { s = { stigma: STIGMA_START, struggling: new Map(), cooldown: new Map(), stats: { checkIns: 0, buffered: 0, visits: 0, waited: [] }, log: [] }; STATES.set(sim, s); }
  return s;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0..1 how hard it is for THIS person to ask for help. */
export function personalStigma(prof: CultureProfile, isMan: boolean, townStigma: number, whanauSupport: number): number {
  const s = townStigma * (0.55 + 0.45 * (1 - prof.ocean.O))
    + (isMan ? 0.12 : 0) + (prof.cohort === "older" ? 0.12 : prof.cohort === "youth" ? -0.08 : 0)
    + (prof.sub === "trades" || prof.sub === "port" ? 0.1 : prof.sub === "creative" ? -0.08 : 0)
    + prof.register.restraint * 0.12 - 0.3 * whanauSupport;
  return clamp01(s);
}

/** Chance per check (once a second) that a distressed person actually goes to get help. */
export function helpSeekingProbability(stress: number, stigma: number): number {
  if (stress < 0.55) return 0;
  return (stress - 0.5) * (1 - stigma) * 0.05;
}

const FAMILY_LINES = ["Come here, cuz. Cuppa?", "Mum's put the jug on, come round.", "We've got you, bro. Kia kaha.", "Sit with us a minute, eh."];
const MATE_LINES = ["Fancy a beer and a yarn?", "You've been quiet, mate. Want to grab a pie?", "Hey, you doing alright?", "Come for a walk, I'll shout the coffee."];
const WARM_LINES = ["Are you OK? No pressure, I'm here.", "Thought I'd check in. How are you really?", "Kia ora, I've got time if you want to korero.", "You seem a bit flat. Want some company?"];
const PUTAHI_LINES = ["Right, I'm going to Pūtahi.", "Time I talked to someone.", "Whānau reckon I should pop in, so, yeah."];

function profileOf(sim: Simulation, c: Character): CultureProfile {
  return getProfile(c) ?? setProfile(c, deriveProfile(sim.cfg.seed, c.id, c.role, sim.world.areas[c.homeArea]?.kind ?? "street", c.tier === "principal"));
}

const scratch: number[] = [];

/** Sum over kin within reach, weighted by closeness. 0..1ish. */
export function whanauSupportNear(sim: Simulation, c: Character, reach = 8): number {
  const k = kin(sim, c);
  if (!k.members.length) return 0;
  let s = 0;
  for (const id of k.members) {
    const o = sim.chars[id];
    if (!o || o.inside >= 0 && o.inside !== c.inside) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d > reach) continue;
    const r = c.rel.get(id);
    s += (0.35 + 0.65 * Math.max(0, r ? r.aff : 0.3)) * (1 - d / (reach + 1));
  }
  return Math.min(1, s);
}

/** Once a second, staggered: struggling people are held, noticed, or go and get help. */
export function updateWhanau(sim: Simulation): void {
  const st = careOf(sim), tick = sim.tick, rng = sim.rng;
  const slot = Math.floor(tick / 60) % 10;
  for (const c of sim.chars) {
    if (c.tier === "player" || (c.id % 10) !== slot || c.inCar >= 0 || c.lod === Lod.SLEEP || !c.mind) continue;
    const m = c.mind;
    if (m.stress < 0.3) { st.struggling.delete(c.id); continue; }
    if (c.inside >= 0) continue;
    if (!st.struggling.has(c.id) && m.stress >= 0.55) st.struggling.set(c.id, tick);
    const prof = profileOf(sim, c);
    // 1. whānau buffering: close kin nearby carry part of the load
    const support = whanauSupportNear(sim, c);
    if (support > 0.15) {
      m.stress = Math.max(0, m.stress - 0.012 * support);
      c.needs.social = Math.min(1, c.needs.social + 0.01 * support);
      st.stats.buffered++;
      if (rng.chance(0.06) && !(c.bubble && c.bubble.until > tick)) {
        const k = kin(sim, c), helper = sim.chars[k.members.find((id) => { const o = sim.chars[id]; return o && Math.hypot(o.x - c.x, o.y - c.y) < 8; }) ?? -1];
        if (helper && helper.inside < 0) {
          const line = rng.pick(FAMILY_LINES); sim.say(helper, line, "say", 2.4);
          st.log.push({ tick, kind: "whanau", who: c.id, by: helper.id, line });
        }
      }
    }
    // 2. community check-in: a kind neighbour notices someone who is flat or stressed
    if (c.lod <= Lod.REDUCED && (m.stress > 0.45 || c.emo.mood < -0.3) && (st.cooldown.get(c.id) ?? 0) <= tick) {
      const n = sim.charHash.query(c.x, c.y, 5, scratch);
      for (let i = 0; i < n; i++) {
        const o = sim.chars[scratch[i]];
        if (!o || o.id === c.id || o.tier === "background" || o.inside >= 0 || o.role === "tourist" || o.phys !== 0 || (o.bubble && o.bubble.until > tick)) continue;
        const op = profileOf(sim, o);
        const caring = o.pers.kindness * 0.6 + op.norms.quakeResilience * 0.3 + o.pers.sociability * 0.1;
        const known = (o.rel.get(c.id)?.fam ?? 0) > 0.1 || o.homeArea === c.homeArea;
        if (!known || !rng.chance(caring * 0.35)) continue;
        const indirect = op.register.restraint > 0.6 && o.look.kind === "guy" && op.register.banter > 0.4;
        const line = rng.pick(indirect ? MATE_LINES : WARM_LINES);
        sim.say(o, line, "say", 3);
        m.stress = Math.max(0, m.stress - 0.04); c.needs.social = Math.min(1, c.needs.social + 0.12);
        c.emo.mood = Math.min(1, c.emo.mood + 0.04);
        const r = sim.relate(c, o.id); r.aff = Math.min(1, r.aff + 0.05); r.trust = Math.min(1, r.trust + 0.04);
        st.stigma = Math.max(0.1, st.stigma - 0.002); // asking out loud makes it normal
        st.cooldown.set(c.id, tick + 60 * 40);
        st.stats.checkIns++;
        st.log.push({ tick, kind: "checkin", who: c.id, by: o.id, line });
        break;
      }
    }
    // 3. help-seeking, delayed by stigma, hastened by whānau
    if (m.stress >= 0.55 && c.emo.mood < 0.1) {
      const stig = personalStigma(prof, c.look.kind === "guy", st.stigma, support);
      if (rng.chance(helpSeekingProbability(m.stress, stig))) goForHelp(sim, c, st);
    }
  }
}

/** The visit itself: a calm room, a korero, a plan. Stress eases; the town learns it is survivable. */
export function goForHelp(sim: Simulation, c: Character, st: CareState = careOf(sim)): boolean {
  const b = sim.world.buildings.find((x) => x.kind === "mentalhealth");
  if (!b) return false;
  const m = c.mind, tick = sim.tick;
  sim.say(c, sim.rng.pick(PUTAHI_LINES), "say", 2.2);
  c.inside = b.id; c.insideUntil = tick + 60 * 25; c.vx = c.vy = 0; c.path = null; c.goal = null;
  c.x = c.px = b.door.x + 0.5; c.y = c.py = b.door.y + 0.5;
  m.stress *= 0.55; m.burnout *= 0.8;
  c.emo.mood = Math.min(1, c.emo.mood + 0.15); c.emo.fear *= 0.6; c.needs.social = Math.min(1, c.needs.social + 0.2);
  const since = st.struggling.get(c.id);
  if (since !== undefined) st.stats.waited.push((tick - since) / 60);
  st.struggling.delete(c.id);
  st.stats.visits++;
  st.stigma = Math.max(0.1, st.stigma - 0.012);
  st.log.push({ tick, kind: "visit", who: c.id, by: -1, line: b.name });
  return true;
}
