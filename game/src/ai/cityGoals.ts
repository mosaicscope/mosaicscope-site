import type { Simulation } from "../sim/Simulation";
import type { GoalDef, Choice } from "./goals";
import { Character, Phys, Step } from "../entities/types";
import { TOYS, isFood } from "../content/toys";
import { BUILDINGS, isOpen } from "../content/buildings";
import { SHOOTS } from "../content/mosaicscope";
import { findWall, shootArea } from "../sim/Society";
import { carried } from "../inventory/Inventory";
import { friendship, peek, hostility } from "../social/Social";
import { attracted, loveOf, chemistry } from "../sim/Romance";

/** Goals that make the city run: food, jobs, homes, shopping, crime, policing, art and the business. */
const tmp: number[] = [];
const tmp2: number[] = [];
const hourIn = (h: number, a: number, b: number) => (a < b ? h >= a && h < b : h >= a || h < b);
const nightOwl = (c: Character) => ["thief", "graffiti", "cop", "bouncer", "musician", "car_enthusiast", "gambler", "dealer", "medic", "taxi"].includes(c.role);

function nearestFood(sim: Simulation, c: Character): { building?: number; poi?: number; d: number } | null {
  let best: { building?: number; poi?: number; d: number } | null = null;
  for (const b of sim.world.buildings) {
    const def = BUILDINGS[b.kind];
    if (!def.menu || !def.menu.some(isFood) || !isOpen(def, sim.hour)) continue;
    const cheapest = Math.min(...def.menu.filter(isFood).map((m) => TOYS[m].value));
    if (cheapest > c.cash) continue;
    const d = Math.hypot(b.door.x - c.x, b.door.y - c.y);
    if (d < 40 && (!best || d < best.d)) best = { building: b.id, d };
  }
  for (const p of sim.world.pois) {
    if (p.kind !== "foodtruck" || !p.menu) continue;
    if (Math.min(...p.menu.map((m) => TOYS[m].value)) > c.cash) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < 40 && (!best || d < best.d)) best = { poi: p.id, d };
  }
  return best;
}

export const CITY_GOALS: GoalDef[] = [
  {
    id: "eat", cooldown: 60, interruptible: true,
    score: (c, sim) => {
      if (c.hunger > 0.4) return null;
      if (carried(c).some((id) => sim.toys[id] && isFood(sim.toys[id].def))) return { u: 0.9, target: -1 };
      const f = nearestFood(sim, c);
      if (!f) return null;
      return { u: (1 - c.hunger) * 0.95 - f.d * 0.004, target: -1, poi: f.poi, toy: f.building };
    },
    build: (c, sim, ch) => {
      if (carried(c).some((id) => sim.toys[id] && isFood(sim.toys[id].def))) return [{ kind: "eat" }];
      if (ch.poi !== undefined) return [{ kind: "buy", poi: ch.poi }, { kind: "eat" }];
      return [{ kind: "enter", building: ch.toy, minutes: sim.rng.range(8, 20) }];
    },
  },
  {
    id: "work", cooldown: 120, interruptible: true,
    score: (c, sim) => {
      if (c.workplace < 0 || c.tier === "principal") return null;
      const b = sim.world.buildings[c.workplace];
      const def = BUILDINGS[b.kind];
      const shift = c.role === "office" ? hourIn(sim.hour, 8, 17) : isOpen(def, sim.hour);
      if (!shift) return null;
      return { u: 0.42 + Math.max(0, 1 - c.cash / 250) * 0.25, target: -1 };
    },
    build: (c, sim) => [{ kind: "enter", building: c.workplace, minutes: sim.rng.range(60, 180) }],
  },
  {
    id: "gohome", cooldown: 60, interruptible: true,
    score: (c, sim) => {
      if (c.home < 0 || c.tier === "principal" || nightOwl(c) && sim.hour > 20) return null;
      if (!hourIn(sim.hour, 23, 6) && c.needs.energy > 0.15) return null;
      return { u: 0.55 + (1 - c.needs.energy) * 0.3, target: -1 };
    },
    build: (c, sim) => { const h = sim.hour; const untilMorning = ((7 - h + 24) % 24) * 60; return [{ kind: "enter", building: c.home, minutes: Math.max(60, untilMorning) }]; },
  },
  {
    id: "shop", cooldown: 300, interruptible: true,
    score: (c, sim) => {
      if (c.cash < 40 || c.needs.fun > 0.6 || (c.hand >= 0 && c.bag.length >= c.bagMax)) return null;
      let best = -1, bd = 35;
      for (const b of sim.world.buildings) {
        const def = BUILDINGS[b.kind];
        if (!def.menu || !isOpen(def, sim.hour) || !def.menu.some((m) => !isFood(m) && (c.likes.includes(m) || (c.prefs[m] ?? 0) > 0.3) && TOYS[m].value <= c.cash)) continue;
        const d = Math.hypot(b.door.x - c.x, b.door.y - c.y);
        if (d < bd) { bd = d; best = b.id; }
      }
      return best >= 0 ? { u: 0.22 + (1 - c.needs.fun) * 0.2, target: -1, toy: best } : null;
    },
    build: (_c, sim, ch) => [{ kind: "enter", building: ch.toy, minutes: sim.rng.range(5, 15) }],
  },
  {
    id: "gamble", cooldown: 400, interruptible: true,
    score: (c, sim) => {
      const casino = sim.world.buildings.find((b) => b.kind === "casino");
      if (!casino || c.cash < 40 || c.tier === "principal" && c.name !== "Tiles" && c.name !== "Flash") return null;
      const keen = c.role === "gambler" ? 0.55 : c.pers.boldness > 0.6 && c.needs.fun < 0.45 ? 0.25 : 0;
      return keen ? { u: keen + Math.min(0.2, c.cash / 2000), target: -1, toy: casino.id } : null;
    },
    build: (_c, sim, ch) => [{ kind: "enter", building: ch.toy, minutes: sim.rng.range(20, 70) }],
  },
  {
    id: "steal", cooldown: 200, interruptible: false,
    score: (c, sim) => {
      const desperate = c.pers.honesty < 0.3 && c.cash < 15 && c.emo.frustration > 0.4;
      if (c.role !== "thief" && !desperate) return null;
      if (c.jailUntil > 0 || c.emo.fear > 0.5) return null;
      const n = sim.charHash.query(c.x, c.y, 12, tmp);
      let best = -1, bs = 0;
      for (let i = 0; i < n; i++) {
        const v = sim.chars[tmp[i]];
        if (v === c || v.role === "cop" || v.inside >= 0 || v.inCar >= 0 || v.tier === "principal" && v.name === "Ruby") continue;
        const valuable = carried(v).some((id) => sim.toys[id] && TOYS[sim.toys[id].def].category === "valuable");
        const s = (v.cash > 40 ? Math.min(1, v.cash / 300) : 0) + (valuable ? 0.5 : 0) - friendship(peek(c, v.id)) - (v.tier === "player" ? 0.2 : 0) + sim.rng.next() * 0.2;
        if (s > bs) { bs = s; best = v.id; }
      }
      for (const cop of sim.chars) if (cop.role === "cop" && cop.inside < 0 && Math.hypot(cop.x - c.x, cop.y - c.y) < 10) return null;
      if (best < 0 || bs < 0.35) return null;
      return { u: 0.35 + (1 - c.pers.honesty) * 0.3 + (c.cash < 20 ? 0.2 : 0), target: best };
    },
    build: (_c, _s, ch) => [{ kind: "steal", target: ch.target }, { kind: "flee_far" }],
  },
  {
    id: "mug", cooldown: 600, interruptible: false,
    score: (c, sim) => {
      if (c.role !== "thief" || c.hand < 0 || sim.toys[c.hand]?.def !== "knife" || c.jailUntil > 0) return null;
      if (!hourIn(sim.hour, 20, 4) || c.emo.fear > 0.4) return null;
      for (const cop of sim.chars) if (cop.role === "cop" && cop.inside < 0 && Math.hypot(cop.x - c.x, cop.y - c.y) < 14) return null;
      const n = sim.charHash.query(c.x, c.y, 10, tmp);
      for (let i = 0; i < n; i++) {
        const v = sim.chars[tmp[i]];
        if (v === c || v.role === "cop" || v.cash < 50 || v.inside >= 0 || v.inCar >= 0 || v.tier === "principal") continue;
        // only when nobody else is around to see
        if (sim.charHash.query(v.x, v.y, 5, tmp2) > 2) continue;
        return { u: 0.5 + (1 - c.pers.honesty) * 0.3, target: v.id };
      }
      return null;
    },
    build: (_c, _s, ch) => [{ kind: "mug", target: ch.target }, { kind: "flee_far" }],
  },
  {
    id: "flirt", cooldown: 240, interruptible: true,
    score: (c, sim) => {
      if (c.tier === "background" || c.emo.mood < -0.2 || c.needs.social > 0.85) return null;
      const looking = c.partner < 0 || (c.pers.honesty < 0.35 && loveOf(c, c.partner) < 0.5 && c.affair < 0);
      if (!looking) return null;
      const n = sim.charHash.query(c.x, c.y, 9, tmp);
      let best = -1, bs = 0.35;
      for (let i = 0; i < n; i++) {
        const o = sim.chars[tmp[i]];
        if (!attracted(c, o) || o.tier === "player" || o.talkWith >= 0 || o.inside >= 0 || hostility(peek(c, o.id)) > 0.3) continue;
        const s = chemistry(c, o) + loveOf(c, o.id) + friendship(peek(c, o.id)) * 0.3;
        if (s > bs) { bs = s; best = o.id; }
      }
      return best >= 0 ? { u: 0.2 + c.pers.sociability * 0.15 + bs * 0.1 + (c.partner >= 0 ? -0.05 : 0), target: best } : null;
    },
    build: (_c, _s, ch) => [{ kind: "flirt", target: ch.target }],
  },
  {
    id: "date", cooldown: 900, interruptible: true,
    score: (c, sim) => {
      const who = c.affair >= 0 && sim.rng.chance(0.4) ? c.affair : c.partner;
      if (who < 0) return null;
      const o = sim.chars[who];
      if (!o || o.inside >= 0 || o.inCar >= 0 || o.jailUntil > 0 || Math.hypot(o.x - c.x, o.y - c.y) > 25 || loveOf(c, who) < 0.35) return null;
      if (!hourIn(sim.hour, 11, 3)) return null;
      // they already asked me out: go along with their plan instead of both leading
      if (o.goal && (o.goal.id === "date" || o.goal.id === "follow") && o.goal.target === c.id) return null;
      return { u: 0.3 + loveOf(c, who) * 0.35, target: who };
    },
    build: (c, sim, ch) => {
      const o = sim.chars[ch.target];
      const late = hourIn(sim.hour, 22, 3);
      // late, deep in love, and one of them has a place: they head home together (off-screen)
      let b = late && loveOf(c, o.id) > 0.65 && loveOf(o, c.id) > 0.55 && c.home >= 0 ? sim.world.buildings[c.home] : undefined;
      if (!b) {
        const places = sim.world.buildings.filter((x) => ["diner", "pizza", "sushi", "cafe", "fishchips", "gallery", "casino"].includes(x.kind) && isOpen(BUILDINGS[x.kind], sim.hour));
        if (!places.length) return null;
        b = places.sort((a, z) => Math.hypot(a.door.x - c.x, a.door.y - c.y) - Math.hypot(z.door.x - c.x, z.door.y - c.y))[sim.rng.int(0, Math.min(2, places.length - 1))];
      }
      return [{ kind: "approach", target: o.id, dist: 1.4 }, { kind: "kiss", target: o.id }, { kind: "date", target: o.id, building: b.id, minutes: b.kind === "house" || b.kind === "apartments" ? 120 : sim.rng.range(20, 45) }];
    },
  },
  {
    id: "follow", cooldown: 0, interruptible: true,
    score: () => null,
    build: (_c, _s, ch) => [{ kind: "follow", target: ch.target, time: 90 }],
  },
  {
    id: "treat", cooldown: 0, interruptible: false,
    score: (c, sim) => {
      if (c.role !== "medic") return null;
      let best = -1, bd = 25;
      for (const o of sim.chars) { if (o.inside >= 0 || o.inCar >= 0 || o === c || !o.wounds.some((w) => !w.bandaged && w.severity >= 2)) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o.id; } }
      return best >= 0 ? { u: 1.1, target: best } : null;
    },
    build: (_c, _s, ch) => [{ kind: "treat", target: ch.target }],
  },
  {
    id: "escape", cooldown: 5, interruptible: false,
    score: () => null, // only ever forced after being seen
    build: (c, sim) => {
      // duck into the nearest open shop, or just run
      const b = sim.world.buildings.filter((x) => BUILDINGS[x.kind].enterable && x.kind !== "police" && isOpen(BUILDINGS[x.kind], sim.hour)).sort((a, z) => Math.hypot(a.door.x - c.x, a.door.y - c.y) - Math.hypot(z.door.x - c.x, z.door.y - c.y))[0];
      return b && Math.hypot(b.door.x - c.x, b.door.y - c.y) < 8 && sim.rng.chance(0.5) ? [{ kind: "enter", building: b.id, minutes: sim.rng.range(15, 40) }] : [{ kind: "flee_far" }, { kind: "flee_far" }];
    },
  },
  {
    id: "tag", cooldown: 240, interruptible: true,
    score: (c, sim) => {
      if (c.role !== "graffiti" && !(c.name === "Bando")) return null;
      const night = hourIn(sim.hour, 19, 5);
      return { u: night ? 0.5 : 0.18, target: -1, topic: night ? "any" : "legal" };
    },
    build: (c, sim, ch) => {
      const spot = findWall(sim, c.x, c.y, 14, ch.topic === "legal");
      if (!spot) return null;
      return [{ kind: "spray", x: spot.sx, y: spot.sy, poi: spot.tx, target: spot.ty, text: spot.face, topic: spot.legal ? "legal" : "" }, ...(spot.legal ? [] : [{ kind: "flee_far" } as Step])];
    },
  },
  {
    id: "clean", cooldown: 30, interruptible: true,
    score: (c, sim) => {
      if (c.role !== "cleaner") return null;
      const g = sim.world.graffiti.filter((x) => !x.legal);
      if (!g.length) return null;
      const n = g.reduce((a, b) => (Math.hypot(a.tx - c.x, a.ty - c.y) < Math.hypot(b.tx - c.x, b.ty - c.y) ? a : b));
      return { u: 0.55, target: -1, poi: n.id };
    },
    build: (_c, _s, ch) => [{ kind: "clean", poi: ch.poi }],
  },
  {
    id: "patrol", cooldown: 20, interruptible: true,
    score: (c) => (c.role === "cop" && c.pursuing < 0 ? { u: 0.3, target: -1 } : null),
    build: (c, sim) => {
      const a = sim.rng.pick(sim.world.areas.filter((x) => ["plaza", "market", "food", "shops", "casino", "stage", "alley", "street"].includes(x.kind)));
      const p = a.kind === "street" ? sim.streetPoint(c) : sim.world.randomPointIn(a, sim.rng);
      return [{ kind: "goto", x: p.x, y: p.y }, { kind: "wait", time: sim.rng.range(3, 8), text: "watch" }];
    },
  },
  {
    id: "pursue", cooldown: 0, interruptible: false,
    score: (c) => (c.role === "cop" && c.pursuing >= 0 ? { u: 1.5, target: c.pursuing } : null),
    build: (_c, _s, ch) => [{ kind: "chase", target: ch.target }],
  },
  {
    id: "book", cooldown: 3600, interruptible: true,
    score: (c, sim) => {
      if (c.tier === "background" || c.emo.mood < 0 || sim.bookings.some((b) => !b.done && b.client === c.id)) return null;
      if (!SHOOTS.some((s) => s.who.includes(c.role) && s.price <= c.cash)) return null;
      if (!hourIn(sim.hour, 8, 22) || sim.bookings.filter((b) => !b.done).length >= 4) return null;
      return { u: 0.12 + c.emo.confidence * 0.12 + (c.role === "musician" || c.role === "car_enthusiast" ? 0.15 : 0), target: -1 };
    },
    build: (_c, sim) => { const st = sim.world.areas.find((a) => a.kind === "studio")!; const p = sim.world.randomPointIn(st, sim.rng); return [{ kind: "goto", x: p.x, y: p.y }, { kind: "book" }]; },
  },
  {
    id: "attend", cooldown: 10, interruptible: false,
    score: (c, sim) => {
      const b = sim.bookings.find((x) => !x.done && x.client === c.id && sim.tick >= x.at - 600);
      return b ? { u: 1.1, target: -1, poi: b.id } : null;
    },
    build: (_c, sim, ch) => { const b = sim.bookings.find((x) => x.id === ch.poi)!; const a = shootArea(sim, b.place); const p = sim.world.randomPointIn(a, sim.rng); return [{ kind: "pose", booking: b.id, x: p.x, y: p.y }]; },
  },
  {
    id: "photograph", cooldown: 5, interruptible: false,
    score: (c, sim) => {
      if (c.role !== "photographer") return null;
      const b = sim.bookings.filter((x) => !x.done && x.photographer === c.id && sim.tick >= x.at).sort((a, z) => a.at - z.at)[0];
      return b ? { u: 1.2, target: -1, poi: b.id } : null;
    },
    build: (_c, _s, ch) => [{ kind: "photo", booking: ch.poi }],
  },
  {
    id: "carmeet", cooldown: 120, interruptible: true,
    score: (c, sim) => {
      if (!hourIn(sim.hour, 21, 1)) return null;
      const into = c.role === "car_enthusiast" || c.name === "Flash" || c.role === "photographer" || c.name === "Kodak";
      if (!into && !(c.pers.curiosity > 0.75 && c.tier !== "background")) return null;
      return { u: into ? 0.65 : 0.25, target: -1 };
    },
    build: (c, sim) => {
      const lot = sim.world.areas.find((a) => a.kind === "dealership")!;
      const p = sim.world.randomPointIn({ ...lot, y0: lot.y0 + 7 }, sim.rng);
      return [{ kind: c.role === "photographer" ? "watch" : sim.rng.chance(0.5) ? "cheer" : "watch", x: p.x, y: p.y, dist: 1.5, time: sim.rng.range(20, 45) }];
    },
  },
  {
    id: "skate", cooldown: 60, interruptible: true,
    score: (c, sim) => (c.role === "skater" && hourIn(sim.hour, 8, 21) ? { u: 0.4 + (1 - c.needs.fun) * 0.3, target: -1 } : null),
    build: (_c, sim) => [{ kind: "skate", time: sim.rng.range(20, 50) }],
  },
  {
    id: "busk", cooldown: 60, interruptible: true,
    score: (c, sim) => ((c.role === "busker" || c.role === "musician" && c.tier !== "principal") && hourIn(sim.hour, 9, 22) ? { u: 0.45, target: -1 } : null),
    build: (_c, sim) => { const a = sim.rng.pick(sim.world.areas.filter((x) => x.kind === "plaza" || x.kind === "market" || x.kind === "food")); const p = sim.world.randomPointIn(a, sim.rng); return [{ kind: "busk", x: p.x, y: p.y, time: sim.rng.range(40, 90) }]; },
  },
  {
    id: "vend", cooldown: 60, interruptible: true,
    score: (c, sim) => (c.role === "vendor" && hourIn(sim.hour, 10, 23) ? { u: 0.5, target: -1 } : null),
    build: (c, sim) => {
      const trucks = sim.world.pois.filter((p) => p.kind === "foodtruck");
      const t = trucks[c.id % trucks.length];
      return t ? [{ kind: "goto", x: t.x + 0.6, y: t.y + 0.2 }, { kind: "wait", time: sim.rng.range(40, 90), text: "idle" }] : null;
    },
  },
  {
    id: "barter", cooldown: 400, interruptible: true,
    score: (c, sim) => {
      if (c.tier === "background" || carried(c).length < 1) return null;
      const n = sim.charHash.query(c.x, c.y, 8, tmp);
      for (let i = 0; i < n; i++) {
        const o = sim.chars[tmp[i]];
        if (o === c || o.tier === "player" || o.talkWith >= 0 || o.inside >= 0) continue;
        if (carried(o).some((id) => sim.toys[id] && c.likes.includes(sim.toys[id].def) && sim.toys[id].owner === o.id)) return { u: 0.2 + c.pers.sociability * 0.1, target: o.id };
      }
      return null;
    },
    build: (_c, _s, ch: Choice) => [{ kind: "trade", target: ch.target }],
  },
];

export { Phys };
