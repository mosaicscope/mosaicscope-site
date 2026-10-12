import type { Simulation } from "./Simulation";
import { CAST, PALETTE, MID_STYLES, NAME_A, NAME_B } from "../content/cast";
import { TOYS } from "../content/toys";
import { makeCharacter } from "../entities/factory";
import { Character, Look, Personality, Tier } from "../entities/types";
import { Rng } from "../core/rng";

function randomPers(rng: Rng): Personality {
  const r = () => Math.min(1, Math.max(0, 0.5 + rng.gauss() * 0.22));
  return { boldness: r(), kindness: r(), temper: r(), sociability: r(), curiosity: r(), playfulness: r(), honesty: r() };
}

function randomLook(rng: Rng, tier: Tier): Look {
  const kind = rng.chance(0.5) ? "girl" : "guy";
  let color = rng.pick(PALETTE), accent = rng.pick(PALETTE);
  if (accent === color) accent = PALETTE[(PALETTE.indexOf(color) + 3) % PALETTE.length];
  return {
    kind, color, accent,
    hat: kind === "guy" ? rng.pick(["bandana", "cap", "beanie", "none", "none"] as const) : rng.pick(["none", "none", "beanie", "cap"] as const),
    hair: kind === "girl" ? rng.pick(["big", "bun", "pony"] as const) : "none",
    scale: tier === "background" ? rng.range(0.72, 0.85) : rng.range(0.9, 1.02),
  };
}

const usedNames = new Set<string>();
function uniqueName(rng: Rng): string {
  for (let i = 0; i < 50; i++) {
    const b = rng.pick(NAME_B), a = rng.pick(NAME_A);
    const n = b === "Lil" || b === "Big" ? `${b} ${a}` : b ? `${a} ${b}` : a;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  const n = `${rng.pick(NAME_A)} ${rng.int(2, 99)}`; usedNames.add(n); return n;
}

export function spawnAll(sim: Simulation): void {
  const { world, rng, cfg } = sim;
  usedNames.clear();
  for (const c of CAST) usedNames.add(c.name);
  const areaByKind = (k: string) => world.areas.find((a) => a.kind === k) ?? world.areas[0];

  // the player: paper white with a red accent, like the site's ink
  const plaza = areaByKind("plaza");
  const pp = world.nearestWalkable(plaza.cx + 2, plaza.cy + 3);
  const player = addChar(sim, "You", "player", pp.x, pp.y, { kind: "guy", color: "#eee4d3", accent: "#ec2a1c", hat: "none", hair: "none", scale: 1 }, { boldness: 0.6, kindness: 0.6, temper: 0.3, sociability: 0.7, curiosity: 0.8, playfulness: 0.7, honesty: 0.8 });
  player.speed = 2.4; player.bio = "A stranger who found the Mosaics' world.";
  sim.playerId = player.id;

  for (const d of CAST) {
    const home = areaByKind(d.home);
    const p = world.randomPointIn(home, rng);
    const c = addChar(sim, d.name, "principal", p.x, p.y, { ...d.look, scale: 1 }, { ...d.pers });
    c.style = d.style; c.bio = d.bio; c.likes = d.likes; c.fears = d.fears; c.catchphrase = d.catchphrase; c.homeArea = home.id;
    c.speed = 1.7 + d.pers.boldness * 0.3;
    sim.routines.set(c.id, d.routine);
  }
  // the crew knows each other already: seed relationships from the site's crews
  const crews = [["Tiles", "Glitter"], ["Kodak", "Nova", "Grain"], ["Flash", "Ruby"], ["Bando", "Lux", "Static"]];
  const byName = (n: string) => sim.chars.find((c) => c.name === n)!;
  for (const crew of crews) for (const a of crew) for (const b of crew) if (a !== b) {
    const r = sim.relate(byName(a), byName(b).id);
    r.fam = 0.8; r.aff = 0.5; r.trust = 0.45; r.shared = 3;
  }
  for (const a of CAST) for (const b of CAST) if (a !== b) { const r = sim.relate(byName(a.name), byName(b.name).id); r.fam = Math.max(r.fam, 0.4); r.aff = Math.max(r.aff, 0.1); }
  // a little history: Flash and Grain have beef, Ruby and Tiles compete, Glitter adores Lux
  const beef = (a: string, b: string, g: number) => { const r = sim.relate(byName(a), byName(b).id); r.grudge = g; r.rivalry = g; r.aff = -0.1; };
  beef("Grain", "Flash", 0.45); beef("Flash", "Grain", 0.3); beef("Ruby", "Tiles", 0.2); beef("Tiles", "Ruby", 0.15);
  sim.relate(byName("Glitter"), byName("Lux").id).aff = 0.6;

  const homeKinds = ["plaza", "park", "court", "market", "stage", "studio", "playground", "alley"];
  for (let i = 0; i < cfg.midCount; i++) {
    const home = areaByKind(rng.pick(homeKinds));
    const p = world.randomPointIn(home, rng);
    const look = randomLook(rng, "mid");
    const c = addChar(sim, uniqueName(rng), "mid", p.x, p.y, look, randomPers(rng));
    c.homeArea = home.id; c.style = rng.pick(MID_STYLES);
    const portable = Object.values(TOYS).filter((t) => t.spawn > 0).map((t) => t.id);
    c.likes = [rng.pick(portable)];
    if (rng.chance(0.15)) c.fears = [rng.pick(["blackout", "storm", "crowd", "fight"])];
    c.bio = `${c.name}. Usually around ${home.name}.`;
  }
  spawnBackground(sim, cfg.backgroundCount);
  spawnToys(sim);
}

export function spawnBackground(sim: Simulation, n: number): void {
  const { world, rng } = sim;
  const street = world.areas.find((a) => a.kind === "street")!;
  for (let i = 0; i < n; i++) {
    // two thirds walk the street ring (the far depth layer), the rest drift around districts
    const onStreet = rng.chance(0.66);
    const area = onStreet ? street : rng.pick(world.areas.filter((a) => a.kind !== "street" && a.kind !== "studio"));
    const p = onStreet ? streetSpot(sim) : world.randomPointIn(area, rng);
    const look = randomLook(rng, "background");
    const c = addChar(sim, uniqueName(rng), "background", p.x, p.y, look, randomPers(rng));
    c.homeArea = area.id; c.pathGoalX = p.x; c.pathGoalY = p.y;
  }
}

export function streetSpot(sim: Simulation): { x: number; y: number } {
  const S = sim.world.size, rng = sim.rng, side = rng.int(0, 3), t = rng.range(1.5, S - 1.5), off = rng.range(0.6, 2.4);
  const p = side === 0 ? { x: t, y: off } : side === 1 ? { x: t, y: S - off } : side === 2 ? { x: off, y: t } : { x: S - off, y: t };
  return sim.world.walkable(p.x, p.y) ? p : sim.world.nearestWalkable(p.x, p.y);
}

export function addChar(sim: Simulation, name: string, tier: Tier, x: number, y: number, look: Look, pers: Personality): Character {
  const c = makeCharacter(sim.chars.length, name, tier, x, y, look, pers, sim.rng);
  sim.chars.push(c);
  return c;
}

export function spawnToys(sim: Simulation): void {
  const { world, rng } = sim;
  const defs = Object.values(TOYS).filter((t) => t.spawn > 0 && t.portable);
  const weights = defs.map((d) => d.spawn);
  for (const p of world.pois) {
    if (p.kind !== "toychest") continue;
    for (let i = 0; i < 6; i++) {
      const d = defs[rng.weighted(weights)];
      const q = world.nearestWalkable(p.x + rng.range(-1.5, 1.5), p.y + rng.range(-1.5, 1.5));
      sim.spawnToy(d.id, q.x, q.y);
    }
  }
  for (let i = 0; i < 26; i++) {
    const d = defs[rng.weighted(weights)];
    const q = world.randomWalkable(rng);
    if (world.areaAt(q.x, q.y)?.kind === "street") continue;
    sim.spawnToy(d.id, q.x, q.y);
  }
  // breakable boxes in the market and alley, pushable crates in the alley
  for (const kind of ["market", "alley", "playground"]) {
    const a = world.areas.find((x) => x.kind === kind);
    if (!a) continue;
    for (let i = 0; i < 4; i++) { const q = world.randomPointIn(a, rng); sim.spawnToy("box", q.x, q.y); }
  }
  const alley = world.areas.find((x) => x.kind === "alley");
  if (alley) for (let i = 0; i < 3; i++) { const q = world.randomPointIn(alley, rng); sim.spawnToy("crate", q.x, q.y); }
  // a few favourite toys are owned from the start
  for (const c of sim.chars) {
    if (c.tier !== "principal") continue;
    const t = sim.spawnToy(c.likes[0], c.x + 0.5, c.y);
    if (t) { t.owner = c.id; sim.pickupToy(c, t); }
  }
}
