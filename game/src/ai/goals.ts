import type { Simulation } from "../sim/Simulation";
import { Character, Phys, Step } from "../entities/types";
import { TOYS, canThrow, isMelee } from "../content/toys";
import { friendship, hostility, peek } from "../social/Social";
import { carried, craftable, findCarried } from "../inventory/Inventory";
import { F, planSteps, PlanContext } from "./planner";
import { CITY_GOALS } from "./cityGoals";
import { PSY_GOALS } from "../mind/Psychopathology";

/**
 * Utility-scored goals. Each goal scores itself from needs, personality, relationships and the
 * world around the character, then builds a step plan (GOAP for principals, templates for others).
 */
export interface Choice { u: number; target: number; x?: number; y?: number; toy?: number; poi?: number; topic?: string }
export interface GoalDef {
  id: string;
  cooldown: number; // seconds after completion before it can be chosen again
  principalOnly?: boolean;
  interruptible: boolean;
  score(c: Character, sim: Simulation): Choice | null;
  build(c: Character, sim: Simulation, ch: Choice): Step[] | null;
}

const tmp: number[] = [];
const busy = (o: Character) => o.talkWith >= 0 || o.phys !== Phys.OK || o.mode === "panic";
const visibleTier = (o: Character) => o.tier !== "background" || o.promoted;

function nearestToy(c: Character, sim: Simulation, r: number, pred: (def: string) => boolean): number {
  let best = -1, bd = r * r;
  for (const t of sim.toys) {
    if (t.state === "held" || t.state === "broken" || !pred(t.def) || !TOYS[t.def].portable) continue;
    if (t.owner >= 0 && t.owner !== c.id && sim.chars[t.owner] && c.pers.honesty > 0.5 && Math.hypot(sim.chars[t.owner].x - t.x, sim.chars[t.owner].y - t.y) < 4) continue; // don't grab toys right next to their owner
    const d = (t.x - c.x) ** 2 + (t.y - c.y) ** 2;
    if (d < bd) { bd = d; best = t.id; }
  }
  return best;
}

/** Facts for the planner from the character's real situation. */
function planContext(c: Character, sim: Simulation, target: Character): { facts: number; ctx: PlanContext } {
  let facts = 0;
  if (findCarried(c, sim.toys, isMelee)) facts |= F.HAS_MELEE;
  if (findCarried(c, sim.toys, canThrow)) facts |= F.HAS_THROW;
  if (findCarried(c, sim.toys, (d) => TOYS[d].uses.includes("ranged"))) facts |= F.HAS_BOW;
  if (findCarried(c, sim.toys, (d) => TOYS[d].uses.includes("comfort"))) facts |= F.HAS_COMFORT;
  if (carried(c).length) facts |= F.HAS_ANY_TOY;
  const d = Math.hypot(target.x - c.x, target.y - c.y);
  if (d < 1.3) facts |= F.NEAR_TARGET;
  if (d < 6) facts |= F.IN_RANGE;
  const meleeToy = nearestToy(c, sim, 10, isMelee), throwToy = nearestToy(c, sim, 10, canThrow);
  const bowToy = nearestToy(c, sim, 10, (x) => TOYS[x].uses.includes("ranged")), comfortToy = nearestToy(c, sim, 10, (x) => TOYS[x].uses.includes("comfort"));
  if (meleeToy >= 0) facts |= F.SEES_MELEE_TOY;
  if (throwToy >= 0) facts |= F.SEES_THROW_TOY;
  if (bowToy >= 0) facts |= F.SEES_BOW_TOY;
  if (comfortToy >= 0) facts |= F.SEES_COMFORT_TOY;
  const ctx: PlanContext = {
    meleeToy, throwToy, bowToy, comfortToy, target: target.id, targetDist: d, boldness: c.pers.boldness,
    toyDist: (id) => (id >= 0 ? Math.hypot(sim.toys[id].x - c.x, sim.toys[id].y - c.y) : 99),
  };
  // learned preferences: a toy that went well before is "cheaper"
  return { facts, ctx };
}

function hasWeaponAccess(c: Character, sim: Simulation): boolean {
  return !!findCarried(c, sim.toys, (d) => isMelee(d) || canThrow(d) || TOYS[d].uses.includes("ranged")) || nearestToy(c, sim, 10, (d) => isMelee(d) || canThrow(d)) >= 0;
}

export const GOALS: GoalDef[] = [
  {
    id: "wander", cooldown: 0, interruptible: true,
    score: (c) => ({ u: 0.08 + c.pers.curiosity * 0.06, target: -1 }),
    build: (c, sim) => {
      const a = sim.rng.range(0, 6.28), r = sim.rng.range(2, 7);
      const p = sim.world.nearestWalkable(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      return [{ kind: "wander", x: p.x, y: p.y }, { kind: "wait", time: sim.rng.range(1, 4), text: sim.rng.chance(0.3) ? "think" : "auto" }];
    },
  },
  {
    id: "routine", cooldown: 30, principalOnly: true, interruptible: true,
    score: (c, sim) => {
      const want = sim.routineArea(c);
      if (!want || sim.world.areaAt(c.x, c.y)?.id === want.id) return null;
      return { u: 0.28, target: -1, x: want.cx, y: want.cy };
    },
    build: (c, sim) => { const a = sim.routineArea(c)!; const p = sim.world.randomPointIn(a, sim.rng); return [{ kind: "goto", x: p.x, y: p.y }]; },
  },
  {
    id: "home", cooldown: 40, interruptible: true,
    score: (c, sim) => {
      const a = sim.world.areas[c.homeArea];
      if (!a || c.tier !== "mid" || sim.world.areaAt(c.x, c.y)?.id === a.id) return null;
      return { u: 0.12, target: -1 };
    },
    build: (c, sim) => { const p = sim.world.randomPointIn(sim.world.areas[c.homeArea], sim.rng); return [{ kind: "goto", x: p.x, y: p.y }]; },
  },
  {
    id: "socialize", cooldown: 12, interruptible: true,
    score: (c, sim) => {
      const need = 1 - c.needs.social;
      if (need < 0.25) return null;
      const n = sim.charHash.query(c.x, c.y, 9, tmp);
      let best = -1, bs = -Infinity;
      for (let i = 0; i < n; i++) {
        const o = sim.chars[tmp[i]];
        if (o === c || busy(o) || !visibleTier(o)) continue;
        const r = peek(c, o.id);
        const s = friendship(r) * 1.2 + (r ? r.fam * 0.3 : c.pers.sociability * 0.2 - 0.1) - hostility(r) + (o.tier === "principal" ? 0.15 : 0) + sim.rng.next() * 0.3;
        if (s > bs) { bs = s; best = o.id; }
      }
      if (best < 0) return null;
      return { u: need * (0.35 + c.pers.sociability * 0.45) + Math.max(0, bs) * 0.1, target: best, topic: "chat" };
    },
    build: (c, sim, ch) => {
      const t = sim.chars[ch.target];
      const topic = (c.tier === "principal" || c.role === "photographer") && sim.rng.chance(0.4) ? "plug" : "chat";
      if (c.tier === "principal") { const { facts, ctx } = planContext(c, sim, t); return planSteps(facts, F.TALKED, ctx)?.map((s) => (s.kind === "talk" ? { ...s, topic } : s)) ?? null; }
      return [{ kind: "talk", target: t.id, topic }];
    },
  },
  {
    id: "gossip", cooldown: 40, interruptible: true,
    score: (c, sim) => {
      if (!sim.flags.rumours) return null;
      const juicy = c.memories.some((m) => Math.abs(m.val) * m.cred > 0.3 && m.kind !== "talked" && sim.tick - m.t < 60 * 240);
      if (!juicy) return null;
      const n = sim.charHash.query(c.x, c.y, 8, tmp);
      for (let i = 0; i < n; i++) {
        const o = sim.chars[tmp[i]];
        if (o === c || busy(o) || !visibleTier(o) || o.tier === "player") continue;
        if (friendship(peek(c, o.id)) > 0.1) return { u: 0.22 + c.pers.sociability * 0.25 - c.pers.honesty * 0.08, target: o.id, topic: "gossip" };
      }
      return null;
    },
    build: (_c, _s, ch) => [{ kind: "talk", target: ch.target, topic: "gossip" }],
  },
  {
    id: "play", cooldown: 8, interruptible: true,
    score: (c, sim) => {
      const need = 1 - c.needs.fun;
      if (need < 0.2) return null;
      let best = -1, bs = -Infinity;
      for (const t of sim.toys) {
        if (t.state === "broken" || (t.state === "held" && t.holder !== c.id) || !TOYS[t.def].uses.some((u) => u === "throw" || u === "spring")) continue;
        const d = Math.hypot(t.x - c.x, t.y - c.y);
        if (d > 10) continue;
        const s = -d * 0.08 + (c.likes.includes(t.def) ? 0.4 : 0) + (c.prefs[t.def] ?? 0) * 0.3 + (t.holder === c.id ? 0.3 : 0);
        if (s > bs) { bs = s; best = t.id; }
      }
      if (best < 0) return null;
      return { u: need * (0.3 + c.pers.playfulness * 0.45) + bs * 0.1, target: -1, toy: best };
    },
    build: (_c, sim, ch) => [{ kind: "play", toy: ch.toy, time: sim.rng.range(6, 12) }],
  },
  {
    id: "collect", cooldown: 20, interruptible: true,
    score: (c, sim) => {
      if (c.hand >= 0 && c.bag.length >= c.bagMax) return null;
      const id = nearestToy(c, sim, 8, (d) => c.likes.includes(d) || (c.prefs[d] ?? 0) > 0.3);
      if (id < 0 || sim.toys[id].owner >= 0 && sim.toys[id].owner !== c.id) return null;
      return { u: 0.18 + c.pers.curiosity * 0.1, target: -1, toy: id };
    },
    build: (_c, _s, ch) => [{ kind: "pickup", toy: ch.toy }],
  },
  {
    id: "fight", cooldown: 180, interruptible: false,
    score: (c, sim) => {
      if (c.emo.fear > 0.5 || c.emo.composure < 0.35 || !hasWeaponAccess(c, sim)) return null;
      const n = sim.charHash.query(c.x, c.y, 10, tmp);
      let best = -1, bs = 0;
      for (let i = 0; i < n; i++) {
        const o = sim.chars[tmp[i]];
        if (o === c || o.phys === Phys.DOWN || !visibleTier(o)) continue;
        const r = peek(c, o.id);
        const hostile = hostility(r);
        const spar = c.pers.playfulness > 0.65 && o.pers.playfulness > 0.55 && friendship(r) > 0.2 && c.needs.fun < 0.55 ? 0.35 : 0;
        const fearOf = r ? r.fear : 0;
        const s = hostile * (0.55 + c.pers.temper * 0.6) + c.emo.frustration * 0.35 * (hostile > 0.1 ? 1 : 0.2) + spar - fearOf * 0.8 - c.pers.kindness * 0.15 + (o.id === c.lastHitBy && sim.tick - c.lastHitTick < 600 ? 0.35 * c.pers.temper + 0.1 : 0);
        if (s > bs) { bs = s; best = o.id; }
      }
      if (best < 0 || bs < 0.25) return null;
      return { u: bs * (0.6 + c.pers.boldness * 0.5), target: best };
    },
    build: (c, sim, ch) => {
      const t = sim.chars[ch.target];
      if (c.tier === "principal") { const { facts, ctx } = planContext(c, sim, t); return planSteps(facts, F.TARGET_HIT, ctx); }
      // template plan: use what you have, else grab the nearest weapon
      const m = findCarried(c, sim.toys, isMelee), th = findCarried(c, sim.toys, canThrow);
      if (m) return [{ kind: "approach", target: t.id, dist: 1.1 }, { kind: "swing", target: t.id }];
      if (th) return [{ kind: "approach", target: t.id, dist: 5 }, { kind: "throw", target: t.id }];
      const id = nearestToy(c, sim, 10, (d) => isMelee(d) || canThrow(d));
      if (id < 0) return null;
      const def = sim.toys[id].def;
      return [{ kind: "pickup", toy: id }, { kind: "approach", target: t.id, dist: isMelee(def) ? 1.1 : 5 }, { kind: isMelee(def) ? "swing" : "throw", target: t.id }];
    },
  },
  {
    id: "help", cooldown: 15, interruptible: false,
    score: (c, sim) => {
      if (c.pers.kindness < 0.35 || c.emo.fear > 0.5) return null;
      const n = sim.charHash.query(c.x, c.y, 11, tmp);
      let best = -1, bs = 0;
      for (let i = 0; i < n; i++) {
        const o = sim.chars[tmp[i]];
        if (o === c || !visibleTier(o) || (o.phys !== Phys.DOWN && o.mode !== "panic" && o.bleed <= 0)) continue;
        if (o.talkWith >= 0 || o.tier === "player" && o.phys !== Phys.DOWN) continue;
        const helper = sim.helpers.get(o.id);
        if (helper !== undefined && helper !== c.id && sim.chars[helper]?.goal?.id === "help") continue;
        const r = peek(c, o.id);
        const s = c.pers.kindness * 0.7 + friendship(r) * 0.5 - hostility(r) * 0.8 + (o.phys === Phys.DOWN ? 0.2 : 0);
        if (s > bs) { bs = s; best = o.id; }
      }
      if (best < 0 || bs < 0.3) return null;
      return { u: bs, target: best };
    },
    build: (c, sim, ch) => {
      const t = sim.chars[ch.target];
      if (c.tier === "principal") { const { facts, ctx } = planContext(c, sim, t); return planSteps(facts, F.TARGET_COMFORTED, ctx); }
      return [{ kind: "comfort", target: t.id }];
    },
  },
  {
    id: "rest", cooldown: 30, interruptible: true,
    score: (c) => (c.needs.energy < 0.35 ? { u: (1 - c.needs.energy) * 0.7, target: -1 } : null),
    build: (c, sim) => {
      let best = -1, bd = 15 * 15;
      for (const p of sim.world.pois) if (p.kind === "bench") { const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = p.id; } }
      return best >= 0 ? [{ kind: "sit", poi: best, time: sim.rng.range(8, 16) }] : [{ kind: "wait", time: 8, text: "sitfloor" }];
    },
  },
  {
    id: "watch", cooldown: 10, interruptible: true,
    score: (c, sim) => {
      const h = sim.hotspotNear(c.x, c.y, 14, c.id);
      if (!h) return null;
      if (c.fears.includes("crowd") && h.severity >= 3) return null;
      return { u: 0.18 + c.pers.curiosity * 0.35 + (1 - c.needs.curiosity) * 0.2 + h.severity * 0.05, target: -1, x: h.x, y: h.y };
    },
    build: (_c, sim, ch) => [{ kind: sim.rng.chance(0.4) ? "cheer" : "watch", x: ch.x, y: ch.y, dist: sim.rng.range(2.2, 4), time: sim.rng.range(4, 9) }],
  },
  {
    id: "party", cooldown: 5, interruptible: true,
    score: (c, sim) => (sim.env.party ? { u: 0.45 + c.pers.playfulness * 0.3 + (1 - c.needs.fun) * 0.2 - (c.fears.includes("crowd") ? 0.3 : 0), target: -1 } : null),
    build: (_c, sim) => { const a = sim.world.areas.find((x) => x.kind === "stage")!; const p = sim.world.randomPointIn(a, sim.rng); return [{ kind: "dance", x: p.x, y: p.y, time: sim.rng.range(10, 20) }]; },
  },
  {
    id: "music", cooldown: 120, interruptible: true,
    score: (c, sim) => {
      if (sim.env.party || sim.env.boomboxCooldown > sim.tick || !sim.env.power) return null;
      const h = sim.hour;
      const evening = h >= 19 || h < 1;
      const djBonus = c.name === "Static" ? 0.4 : c.name === "Tiles" ? 0.15 : 0;
      if (!evening && djBonus < 0.4 || djBonus === 0 && c.role !== "musician") return null;
      return { u: (evening ? 0.25 : 0.05) + djBonus, target: -1 };
    },
    build: (_c, sim) => { const p = sim.world.pois.find((x) => x.kind === "boombox"); return p ? [{ kind: "music", poi: p.id }] : null; },
  },
  {
    id: "shelter", cooldown: 10, interruptible: true,
    score: (c, sim) => (sim.env.raining && !sim.world.isSheltered(c.x, c.y) ? { u: 0.45 + (1 - c.pers.boldness) * 0.3 + (c.fears.includes("storm") ? 0.3 : 0), target: -1 } : null),
    build: (c, sim) => { const p = sim.nearestShelter(c.x, c.y); return p ? [{ kind: "goto", x: p.x, y: p.y }, { kind: "wait", time: 10 }] : null; },
  },
  {
    id: "search", cooldown: 30, interruptible: true,
    score: (c, sim) => (c.memories.some((m) => m.kind === "lost_item" && m.val < 0 && sim.tick - m.t < 60 * 300) ? { u: 0.4, target: -1 } : null),
    build: (c, sim) => { const m = c.memories.find((x) => x.kind === "lost_item" && x.val < 0)!; const p = sim.world.randomPointIn(sim.world.areas[m.area] ?? sim.world.areas[0], sim.rng); return [{ kind: "search", x: p.x, y: p.y, time: 20 }]; },
  },
  {
    id: "reclaim", cooldown: 45, interruptible: false,
    score: (c, sim) => {
      for (const t of sim.toys) {
        if (t.owner !== c.id || t.state !== "held" || t.holder === c.id || t.holder < 0) continue;
        const h = sim.chars[t.holder];
        if (Math.hypot(h.x - c.x, h.y - c.y) < 12 && !busy(h)) return { u: 0.35 + c.pers.boldness * 0.2 + c.pers.temper * 0.15, target: h.id, toy: t.id, topic: "dispute" };
      }
      return null;
    },
    build: (_c, _s, ch) => [{ kind: "talk", target: ch.target, topic: "dispute" }],
  },
  {
    id: "gift", cooldown: 90, interruptible: true,
    score: (c, sim) => {
      if (carried(c).length < 1 || c.pers.kindness < 0.45) return null;
      let best = -1, bs = 0.35;
      for (const [id, r] of c.rel) {
        const o = sim.chars[id];
        if (!o || busy(o) || o.tier === "background" || Math.hypot(o.x - c.x, o.y - c.y) > 10) continue;
        const f = friendship(r) + (o.emo.mood < -0.2 ? 0.2 : 0);
        if (f > bs) { bs = f; best = id; }
      }
      return best >= 0 ? { u: 0.12 + c.pers.kindness * 0.2 + bs * 0.1, target: best } : null;
    },
    build: (_c, _s, ch) => [{ kind: "approach", target: ch.target, dist: 1.1 }, { kind: "give", target: ch.target }],
  },
  {
    id: "reconcile", cooldown: 120, interruptible: true,
    score: (c, sim) => {
      if (c.pers.kindness < 0.45 || c.emo.frustration > 0.4) return null;
      for (const [id, r] of c.rel) {
        const o = sim.chars[id];
        if (!o || busy(o) || r.grudge < 0.15 || r.grudge > 0.7 || r.fam < 0.1) continue;
        if (Math.hypot(o.x - c.x, o.y - c.y) > 12) continue;
        return { u: 0.18 + c.pers.kindness * 0.25, target: id, topic: "apology" };
      }
      return null;
    },
    build: (_c, _s, ch) => [{ kind: "talk", target: ch.target, topic: "apology" }],
  },
  {
    id: "craft", cooldown: 60, interruptible: true,
    score: (c, sim) => (sim.flags.crafting && craftable(c, sim.toys) ? { u: 0.3 + c.pers.curiosity * 0.3 + (c.name === "Bando" ? 0.3 : 0), target: -1 } : null),
    build: () => [{ kind: "craft" }],
  },
  {
    id: "prank", cooldown: 1200, interruptible: true,
    score: (c, sim) => {
      if (c.pers.playfulness < 0.75 || c.pers.kindness > 0.6) return null;
      const spring = findCarried(c, sim.toys, (d) => d === "spring") ?? null;
      const ball = findCarried(c, sim.toys, canThrow);
      if (!spring && !ball) return null;
      const n = sim.charHash.query(c.x, c.y, 7, tmp);
      for (let i = 0; i < n; i++) { const o = sim.chars[tmp[i]]; if (o !== c && !busy(o) && visibleTier(o) && o.tier !== "player" && hostility(peek(c, o.id)) < 0.4) return { u: 0.22, target: o.id }; }
      return null;
    },
    build: (_c, _s, ch) => [{ kind: "approach", target: ch.target, dist: 3.5 }, { kind: "throw", target: ch.target }],
  },
  {
    id: "ballgame", cooldown: 30, interruptible: true,
    score: (c, sim) => {
      const g = sim.activeGameNear(c.x, c.y, 16);
      if (!g || c.needs.fun > 0.85) return null;
      return { u: 0.3 + c.pers.playfulness * 0.3 + (1 - c.needs.fun) * 0.2, target: -1, toy: g.toy };
    },
    build: (c, sim, ch) => {
      const steps: Step[] = [];
      const n = sim.charHash.query(c.x, c.y, 10, tmp);
      const mates = tmp.slice(0, n).filter((id) => id !== c.id && sim.chars[id].tier !== "background");
      for (let i = 0; i < 4; i++) steps.push(mates.length ? { kind: "kick", toy: ch.toy, target: sim.rng.pick(mates) } : { kind: "kick", toy: ch.toy, x: c.x + sim.rng.range(-4, 4), y: c.y + sim.rng.range(-4, 4) });
      return steps;
    },
  },
];

GOALS.push(...CITY_GOALS, ...PSY_GOALS);
export const GOAL_BY_ID = new Map(GOALS.map((g) => [g.id, g]));
