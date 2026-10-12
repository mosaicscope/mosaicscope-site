import type { Simulation } from "./Simulation";
import { CAST, MID_STYLES } from "../content/cast";
import { TOYS } from "../content/toys";
import { makeCharacter } from "../entities/factory";
import { Character, Look, Personality, Tier } from "../entities/types";
import { Rng } from "../core/rng";
import { FIRST_GIRL, FIRST_GUY, SURNAMES, NICKNAMES, ROLE_COUNTS, Role, ROLE_LABEL } from "../content/names";
import { uniqueLook, MOSAIC_FACE, lookKey } from "../content/appearance";
import { BUILDINGS } from "../content/buildings";
import { Building } from "../world/World";

function randomPers(rng: Rng): Personality {
  const r = () => Math.min(1, Math.max(0, 0.5 + rng.gauss() * 0.22));
  return { boldness: r(), kindness: r(), temper: r(), sociability: r(), curiosity: r(), playfulness: r(), honesty: r() };
}

/** Personality nudges that make a role believable (thieves are less honest, cops bolder...). */
function shapeForRole(p: Personality, role: Role): void {
  const c = (v: number) => Math.min(1, Math.max(0, v));
  if (role === "thief") { p.honesty = c(p.honesty * 0.35); p.boldness = c(p.boldness + 0.15); }
  if (role === "cop") { p.boldness = c(p.boldness + 0.25); p.honesty = c(p.honesty + 0.25); p.temper = c(p.temper - 0.05); }
  if (role === "graffiti") { p.curiosity = c(p.curiosity + 0.2); p.honesty = c(p.honesty - 0.15); }
  if (role === "busker" || role === "musician") { p.sociability = c(p.sociability + 0.2); p.playfulness = c(p.playfulness + 0.2); }
  if (role === "medic") { p.kindness = c(p.kindness + 0.3); }
  if (role === "gambler") { p.boldness = c(p.boldness + 0.2); p.temper = c(p.temper + 0.1); }
  if (role === "car_enthusiast" || role === "skater") { p.playfulness = c(p.playfulness + 0.2); }
}

export class NameBook {
  private used = new Set<string>();
  constructor(private rng: Rng) {}
  reserve(n: string) { this.used.add(n); }
  next(kind: "guy" | "girl"): string {
    const pool = kind === "guy" ? FIRST_GUY : FIRST_GIRL;
    for (let i = 0; i < 200; i++) {
      const n = `${this.rng.pick(pool)} ${this.rng.pick(SURNAMES)}`;
      if (!this.used.has(n)) { this.used.add(n); return n; }
    }
    // pools give ~5,800 combinations per body type; beyond that, add a middle initial
    for (;;) {
      const n = `${this.rng.pick(pool)} ${String.fromCharCode(65 + this.rng.int(0, 25))}. ${this.rng.pick(SURNAMES)}`;
      if (!this.used.has(n)) { this.used.add(n); return n; }
    }
  }
}

export function spawnAll(sim: Simulation): void {
  const { world, rng, cfg } = sim;
  const names = new NameBook(rng);
  sim.names = names;
  for (const c of CAST) names.reserve(c.name);
  const areaByKind = (k: string) => world.areas.find((a) => a.kind === k) ?? world.areas[1];
  const homes = world.buildings.filter((b) => b.kind === "house" || b.kind === "apartments");
  const usedLooks = sim.usedLooks;

  // the player: paper white with a red accent, like the site's ink
  const plaza = areaByKind("plaza");
  const pp = world.nearestWalkable(plaza.cx + 2, plaza.cy + 3);
  const player = addChar(sim, "You", "player", pp.x, pp.y, { kind: "guy", color: "#eee4d3", accent: "#ec2a1c", hat: "none", hair: "sidepart", scale: 1, face: { eyes: "round", brows: "straight", mouth: "smile", nose: "dot", facial: "none", extra: "none", head: "round" } }, { boldness: 0.6, kindness: 0.6, temper: 0.3, sociability: 0.7, curiosity: 0.8, playfulness: 0.7, honesty: 0.8 });
  player.speed = 2.6; player.bio = "A stranger who found the Mosaics' world."; player.cash = 250; player.role = "local";
  usedLooks.add(lookKey(player.look));
  sim.playerId = player.id;

  const mouths = ["grin", "smile", "smirk", "smile", "flat", "teeth", "smile", "grin", "smile", "flat"] as const;
  CAST.forEach((d, i) => {
    const home = areaByKind(d.home);
    const p = world.randomPointIn(home, rng);
    const look: Look = { ...d.look, scale: 1, build: 1, face: MOSAIC_FACE(mouths[i], i === 1 ? "earrings" : i === 6 ? "nosering" : "none") };
    usedLooks.add(lookKey(look));
    const c = addChar(sim, d.name, "principal", p.x, p.y, look, { ...d.pers });
    c.style = d.style; c.bio = d.bio; c.likes = d.likes; c.fears = d.fears; c.catchphrase = d.catchphrase; c.homeArea = home.id;
    c.speed = 1.7 + d.pers.boldness * 0.3; c.cash = 120 + rng.int(0, 300);
    c.role = d.name === "Kodak" ? "photographer" : d.name === "Static" ? "musician" : d.name === "Bando" ? "mechanic" : d.name === "Grain" ? "skater" : d.name === "Flash" ? "car_enthusiast" : "local";
    c.home = rng.pick(homes).id;
    sim.routines.set(c.id, d.routine);
  });
  // Chris runs MosaicScope (photography + film). He works out of the Studio.
  const studio = world.areas.find((a) => a.kind === "studio")!;
  const cp = world.randomPointIn(studio, rng);
  names.reserve("Chris");
  const chris = addChar(sim, "Chris", "principal", cp.x, cp.y, { kind: "guy", color: "#eee4d3", accent: "#ec2a1c", hat: "beanie", hair: "none", scale: 1.02, build: 1, face: { eyes: "round", brows: "straight", mouth: "smile", nose: "line", facial: "stubble", extra: "none", head: "round" } },
    { boldness: 0.7, kindness: 0.8, temper: 0.25, sociability: 0.85, curiosity: 0.9, playfulness: 0.7, honesty: 0.95 });
  usedLooks.add(lookKey(chris.look));
  chris.role = "photographer"; chris.style = "smooth"; chris.homeArea = studio.id; chris.cash = 400; chris.catchphrase = "Send me a few reference pics.";
  chris.bio = "Runs MosaicScope: photography and music videos around Christchurch. Artists, raves, car meets, skate. Always has a camera on him.";
  chris.likes = ["camera", "frisbee"];
  sim.routines.set(chris.id, [[8, "studio"], [12, "plaza"], [14, "studio"], [18, "gallery"], [20, "dealership"], [22, "stage"]]);

  // the crew knows each other already: seed relationships from the site's crews
  const crews = [["Tiles", "Glitter"], ["Kodak", "Nova", "Grain"], ["Flash", "Ruby"], ["Bando", "Lux", "Static"]];
  const byName = (n: string) => sim.chars.find((c) => c.name === n)!;
  for (const crew of crews) for (const a of crew) for (const b of crew) if (a !== b) {
    const r = sim.relate(byName(a), byName(b).id);
    r.fam = 0.8; r.aff = 0.5; r.trust = 0.45; r.shared = 3;
  }
  for (const a of [...CAST.map((c) => c.name), "Chris"]) for (const b of [...CAST.map((c) => c.name), "Chris"]) if (a !== b) { const r = sim.relate(byName(a), byName(b).id); r.fam = Math.max(r.fam, 0.4); r.aff = Math.max(r.aff, 0.12); }
  const beef = (a: string, b: string, g: number) => { const r = sim.relate(byName(a), byName(b).id); r.grudge = g; r.rivalry = g; r.aff = -0.1; };
  beef("Grain", "Flash", 0.45); beef("Flash", "Grain", 0.3); beef("Ruby", "Tiles", 0.2); beef("Tiles", "Ruby", 0.15);
  sim.relate(byName("Glitter"), byName("Lux").id).aff = 0.6;
  // Tiles and Glitter are a couple (as on the site); a few regulars are paired up too
  const couple = (a: Character, b: Character, love = 0.75) => { a.partner = b.id; b.partner = a.id; a.attractedTo = [...new Set([...a.attractedTo, b.look.kind])]; b.attractedTo = [...new Set([...b.attractedTo, a.look.kind])]; for (const [x, y] of [[a, b], [b, a]] as const) { const r = sim.relate(x, y.id); r.love = love; r.aff = Math.max(r.aff, 0.6); r.trust = Math.max(r.trust, 0.5); r.fam = 1; } };
  couple(byName("Tiles"), byName("Glitter"), 0.85);
  for (const n of ["Kodak", "Glitter", "Tiles"]) { const r = sim.relate(chris, byName(n).id); r.aff = 0.55; r.trust = 0.5; r.fam = 0.9; }

  // regulars: each gets a role, a workplace that fits it and a home
  const roles: Role[] = [];
  for (const [r, n] of Object.entries(ROLE_COUNTS) as [Role, number][]) for (let i = 0; i < n; i++) roles.push(r);
  while (roles.length < cfg.midCount) roles.push(rng.pick(["local", "student", "office", "local", "student"] as Role[]));
  roles.length = cfg.midCount;
  const workFor = (role: Role): Building | undefined => {
    const kinds = Object.values(BUILDINGS).filter((d) => d.job === role).map((d) => d.kind);
    if (role === "office") kinds.push("office", "bank", "hotel");
    if (role === "student") kinds.push("cafe");
    const opts = world.buildings.filter((b) => kinds.includes(b.kind));
    return opts.length ? rng.pick(opts) : undefined;
  };
  const homeAreaFor = (role: Role): string => ({ cop: "police", dealer: "casino", gambler: "casino", busker: "plaza", vendor: "food", chef: "food", barista: "food", shopkeeper: "shops", skater: "playground", car_enthusiast: "dealership", graffiti: "alley", musician: "stage", medic: "hospital", photographer: "studio", tourist: "plaza", thief: "market" } as Record<string, string>)[role] ?? rng.pick(["plaza", "park", "market", "food", "shops", "residential", "court"]);
  for (const role of roles) {
    const kind = rng.chance(0.5) ? "girl" : "guy";
    const pers = randomPers(rng);
    shapeForRole(pers, role);
    const look = uniqueLook(rng, kind, false, usedLooks, role === "cop" ? { hat: "police", accent: "#1c6bd6" } : role === "medic" ? { accent: "#c6ff3d" } : role === "dealer" ? { accent: "#0e0b0a", hat: "none" } : {});
    const area = areaByKind(homeAreaFor(role));
    const p = world.randomPointIn(area, rng);
    const c = addChar(sim, names.next(kind), "mid", p.x, p.y, look, pers);
    c.role = role; c.homeArea = area.id; c.style = rng.pick(MID_STYLES);
    c.workplace = workFor(role)?.id ?? -1; c.home = rng.pick(homes).id;
    c.cash = role === "thief" ? rng.int(0, 25) : role === "gambler" ? rng.int(200, 900) : role === "tourist" ? rng.int(150, 600) : rng.int(30, 260);
    if (role === "thief" && rng.chance(0.5)) c.nickname = rng.pick(NICKNAMES);
    const portable = Object.values(TOYS).filter((t) => t.spawn > 0).map((t) => t.id);
    c.likes = [rng.pick(portable)];
    if (rng.chance(0.15)) c.fears = [rng.pick(["blackout", "storm", "crowd", "fight"])];
    const work = c.workplace >= 0 ? world.buildings[c.workplace] : null;
    c.bio = `${c.name}${c.nickname ? ` ("${c.nickname}")` : ""}, ${ROLE_LABEL[role]}${work ? ` at ${work.name}` : ""}. Lives on ${world.buildings[c.home]?.name ?? "the block"}.`;
  }
  // regulars: a dozen couples, some of them not as solid as they look
  const singles = sim.chars.filter((c) => c.tier === "mid");
  for (let i = 0; i < 12 && singles.length > 2; i++) {
    const a = singles.splice(rng.int(0, singles.length - 1), 1)[0];
    const bi = singles.findIndex((b) => a.attractedTo.includes(b.look.kind) && b.attractedTo.includes(a.look.kind));
    if (bi < 0) continue;
    const b = singles.splice(bi, 1)[0];
    couple(a, b, rng.range(0.3, 0.9));
  }
  spawnBackground(sim, cfg.backgroundCount);
  spawnToys(sim);
  // everyday carry: valuables people can lose to thieves
  for (const c of sim.chars) {
    if (c.tier === "player") continue;
    if (rng.chance(c.tier === "background" ? 0.15 : 0.45)) { const t = sim.spawnToy(rng.pick(["phone", "phone", "watch", "headphones", "chain"]), c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); } }
    if (c.role === "graffiti") { const t = sim.spawnToy("spray_can", c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); } }
    if (c.role === "cop") { const t = sim.spawnToy("taser", c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); } }
    if (c.role === "thief" && c.pers.boldness > 0.55) { const t = sim.spawnToy("knife", c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); const i = c.bag.indexOf(t.id); if (i >= 0) { c.bag.splice(i, 1); if (c.hand >= 0) c.bag.push(c.hand); c.hand = t.id; } } }
    if (c.role === "medic") for (let i = 0; i < 2; i++) { const t = sim.spawnToy("bandage", c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); } }
    if (c.role === "skater") { const t = sim.spawnToy("skateboard", c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); } }
    if (c.role === "photographer") { const t = sim.spawnToy("camera", c.x, c.y); if (t) { t.owner = c.id; sim.pickupToy(c, t); } }
  }
}

export function spawnBackground(sim: Simulation, n: number): void {
  const { world, rng } = sim;
  const names = sim.names!;
  const homes = world.buildings.filter((b) => b.kind === "house" || b.kind === "apartments");
  const work = world.buildings.filter((b) => b.kind === "office" || b.kind === "bank" || b.kind === "hotel" || b.kind === "hospital" || BUILDINGS[b.kind].menu);
  for (let i = 0; i < n; i++) {
    // most walk the sidewalks between home and work; the rest hang around a district
    const onStreet = rng.chance(0.6);
    const area = onStreet ? world.areas[0] : rng.pick(world.areas.filter((a) => a.kind !== "street" && a.kind !== "studio"));
    const p = onStreet ? streetSpot(sim) : world.randomPointIn(area, rng);
    const kind = rng.chance(0.5) ? "girl" : "guy";
    const look = uniqueLook(rng, kind, true, sim.usedLooks);
    const c = addChar(sim, names.next(kind), "background", p.x, p.y, look, randomPers(rng));
    c.homeArea = area.id; c.pathGoalX = p.x; c.pathGoalY = p.y;
    c.role = rng.pick(["local", "office", "student", "local", "tourist"] as Role[]);
    c.home = homes.length ? rng.pick(homes).id : -1;
    c.workplace = work.length && c.role !== "tourist" ? rng.pick(work).id : -1;
    c.bio = `${c.name}, ${ROLE_LABEL[c.role]}.`;
  }
}

/** A random point on a sidewalk. */
export function streetSpot(sim: Simulation): { x: number; y: number } {
  const w = sim.world;
  for (let i = 0; i < 60; i++) {
    const x = sim.rng.int(1, w.size - 2), y = sim.rng.int(1, w.size - 2);
    if (w.tile(x, y) === 17 /* sidewalk */) return { x: x + 0.5, y: y + 0.5 };
  }
  return w.nearestWalkable(w.size / 2, w.size / 2);
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
  for (let i = 0; i < 40; i++) {
    const d = defs[rng.weighted(weights)];
    const q = world.randomWalkable(rng);
    if (world.tile(Math.floor(q.x), Math.floor(q.y)) === 16) continue; // not in the road
    sim.spawnToy(d.id, q.x, q.y);
  }
  // breakable boxes and wheelie bins around the shops; crates in the alley
  for (const kind of ["market", "alley", "playground", "food", "shops"]) {
    const a = world.areas.find((x) => x.kind === kind);
    if (!a) continue;
    for (let i = 0; i < 3; i++) { const q = world.randomPointIn(a, rng); sim.spawnToy(rng.chance(0.5) ? "box" : "bin", q.x, q.y); }
  }
  const alley = world.areas.find((x) => x.kind === "alley");
  if (alley) for (let i = 0; i < 3; i++) { const q = world.randomPointIn(alley, rng); sim.spawnToy("crate", q.x, q.y); }
  // a few favourite toys are owned from the start
  for (const c of sim.chars) {
    if (c.tier !== "principal" || !c.likes[0]) continue;
    const t = sim.spawnToy(c.likes[0], c.x + 0.5, c.y);
    if (t) { t.owner = c.id; sim.pickupToy(c, t); }
  }
}
