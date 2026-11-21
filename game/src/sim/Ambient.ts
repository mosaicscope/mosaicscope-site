import type { Simulation } from "./Simulation";
import { T } from "../world/World";
import { LITTER_KINDS } from "../content/litter";
import { AmbientEngine, type Anchor, type AnchorTag, type Biome, type Cue, type Season, type Surface, type Vec3, type WorldContext } from "../engines/ambient-life-engine";

/**
 * Adapter between the game and the ambient life engine (engines/ambient-life-engine.ts): one shared wind, drifting litter,
 * critters, distant sounds. The game is 2D, so engine metres map to tiles (1 tile = 2 m) and the engine's Z is the game's Y.
 * What the game can already show is routed straight in (sounds through the shared sound bus, litter into the street litter);
 * everything else (props, critters, particles, light flicker) waits in `ambientCues` for a renderer to draw.
 * The same world context also drives the world-problems rolls (sim/Problems.ts), so weather and time agree everywhere.
 */
const M = 2;
const toE = (x: number, y: number, z = 0): Vec3 => ({ x: x * M, y: z, z: y * M });
const toGame = (p: Vec3) => ({ x: p.x / M, y: p.z / M });
const MONTH_C = [17, 17, 15, 12, 9, 6, 6, 7, 9, 12, 14, 16];   // Christchurch monthly mean temperatures, January first
const ANCHOR: Record<string, AnchorTag> = { lamp: "lamp", light: "lamp", bench: "bench", bin: "bin", door: "door", streetsign: "sign", roadsign: "sign", busstop: "sign" };
interface Critter { sp: string; x: number; y: number; tx: number; ty: number; speed: number; orbit: number; a: number }
interface Prop { prop: string; x: number; y: number }
interface Rt { engine: AmbientEngine; cues: Cue[]; wet: number; still: number; lx: number; ly: number; ctx: WorldContext | null; critters: Map<number, Critter>; props: Map<number, Prop>; beat: number }
/** The renderer already draws pooled particles (dust, water, text glyphs...); critters and drifting props are drawn as short-lived glyphs refreshed as they move. */
const PRESET: Record<string, { kind: string; color?: string; text?: string }> = {
  dust_devil: { kind: "dust" }, feather_dust: { kind: "dust", color: "#f4f0e6" }, leaf_burst: { kind: "text", text: "🍂" }, leaf_fall: { kind: "text", text: "🍃" }, leaf_swirl: { kind: "text", text: "🍂" },
  puddle_splash: { kind: "rain_splash" }, sun_glint: { kind: "star", color: "#fff6c0" }, water_splash_small: { kind: "water" },
};
export const CRITTER: Record<string, string> = { cat: "🐈", pigeon: "🐦", songbird: "🐦", squirrel: "🐿️", butterfly: "🦋", moth: "🦋" };
const fx = (sim: Simulation, kind: string, x: number, y: number, z: number, n = 1, color?: string, text?: string): void => {
  if (Math.hypot(x - sim.player.x, y - sim.player.y) > 30) return;
  sim.bus.emit("fx", { kind, x, y, z, n, color, text } as never);
};
const rts = new WeakMap<Simulation, Rt>();

function runtime(sim: Simulation): Rt {
  let rt = rts.get(sim);
  if (!rt) {
    const made: Rt = { engine: null as unknown as AmbientEngine, cues: [], wet: 0, still: 0, lx: sim.player.x, ly: sim.player.y, ctx: null, critters: new Map(), props: new Map(), beat: 0 };
    made.engine = new AmbientEngine({ emit: (cue) => route(sim, made, cue) }, { seed: sim.cfg.seed, density: 0.8, maxLitter: 60 });
    rts.set(sim, made); rt = made;
  }
  return rt;
}

function route(sim: Simulation, rt: Rt, cue: Cue): void {
  if (cue.kind === "sound") { const g = toGame(cue.pos); sim.bus.emit("sound", { kind: cue.id, x: g.x, y: g.y, vol: cue.volume }); return; }
  if (cue.kind === "litter" && cue.action === "add") {
    const g = toGame(cue.pos);
    if (sim.world.walkable(g.x, g.y) && !sim.world.carriageway(g.x, g.y)) sim.litter.add(LITTER_KINDS[Math.abs(cue.handle) % LITTER_KINDS.length], g.x, g.y);
    return;
  }
  if (cue.kind === "particles") { const g = toGame(cue.pos), p = PRESET[cue.preset] ?? { kind: "dust" }; fx(sim, p.kind, g.x, g.y, cue.pos.y + 0.3, Math.max(1, Math.round(cue.intensity * 4)), p.color, p.text); return; }
  if (cue.kind === "critter") {
    const g = toGame(cue.pos), t = cue.target ? toGame(cue.target) : g;
    if (cue.action === "despawn") rt.critters.delete(cue.handle);
    else if (cue.action === "spawn") rt.critters.set(cue.handle, { sp: cue.species, x: g.x, y: g.y, tx: t.x, ty: t.y, speed: (cue.speed ?? 1) / M, orbit: 0, a: 0 });
    else { const c = rt.critters.get(cue.handle); if (c) { if (cue.action === "moveTo") { c.tx = t.x; c.ty = t.y; c.speed = (cue.speed ?? c.speed * M) / M; c.orbit = 0; } else if (cue.action === "orbit") { c.tx = g.x; c.ty = g.y; c.orbit = (cue.radius ?? 3) / M; } } }
    return;
  }
  if (cue.kind === "prop") {
    // drifting props were drawn as floating glyphs and read as random floaties, so they are not drawn; real litter still lands on the street
    return;
  }
  if (cue.kind === "light") {
    const poi = sim.world.pois[Number(cue.anchorId.replace("poi:", ""))];
    if (poi && cue.mode !== "on") fx(sim, "flash", poi.x, poi.y, 2.4, 1);
    return;
  }
  rt.cues.push(cue); if (rt.cues.length > 200) rt.cues.shift();   // anchor animations and the like, for a renderer to draw
}

/** Move the critters and refresh glyphs for critters and props so they read as moving things. */
function visuals(sim: Simulation, rt: Rt, dt: number): void {
  rt.beat += dt;
  const refresh = rt.beat >= 0.4; if (refresh) rt.beat = 0;
  for (const [h, c] of rt.critters) {
    if (c.orbit > 0) { c.a += dt * c.speed / Math.max(0.5, c.orbit); c.x = c.tx + Math.cos(c.a) * c.orbit; c.y = c.ty + Math.sin(c.a) * c.orbit; }
    else { const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy); if (d > 0.05) { const s = Math.min(d, c.speed * dt); c.x += dx / d * s; c.y += dy / d * s; } }
    if (Math.hypot(c.x - sim.player.x, c.y - sim.player.y) > 60) rt.critters.delete(h);
    /* critters are not drawn: floating glyph birds and bugs read as random things popping up */
  }

}

/** Cues the game has no drawing for yet (props, critters, particles, lights). Drain this each frame when a renderer exists. */
export function ambientCues(sim: Simulation): Cue[] { const rt = runtime(sim); return rt.cues.splice(0); }

/** The world as the engine asks about it. Also used by world problems. */
export function worldContext(sim: Simulation): WorldContext {
  const rt = runtime(sim), p = sim.player, env = sim.env, w = sim.world, now = new Date(), month = now.getMonth();
  const hour = sim.hour, storm = env.storm, raining = env.raining;
  rt.wet += ((raining ? 1 : 0) - rt.wet) * (raining ? 0.02 : 0.004);
  const speed = Math.hypot(p.vx, p.vy);
  rt.still = speed < 0.15 ? rt.still + 1 / 60 : 0;
  const season: Season = month === 11 || month < 2 ? "summer" : month < 5 ? "autumn" : month < 8 ? "winter" : "spring";
  const t = sim.tick / 60, ang = t / 400;
  const ctx: WorldContext = {
    time: t, hour, season,
    weather: { rain: env.rain, wetness: rt.wet, windSpeed: storm ? 12 : raining ? 6.5 : 2.5 + 1.5 * Math.sin(t / 90), windDir: { x: Math.cos(ang), y: 0, z: Math.sin(ang) },
      gustiness: storm ? 0.8 : 0.3, temperature: MONTH_C[month] + 4 * Math.sin(((hour - 9) / 24) * Math.PI * 2) - (raining ? 2 : 0), cloud: env.weather === "clear" ? 0.1 : env.weather === "cloudy" ? 0.6 : 0.9, fog: 0 },
    player: { pos: toE(p.x, p.y), vel: toE(p.vx, p.vy), forward: { x: Math.cos(p.facing), y: 0, z: Math.sin(p.facing) },
      state: p.inCar >= 0 ? "driving" : p.talkWith >= 0 ? "dialogue" : speed > 3 ? "running" : speed > 0.2 ? "walking" : "idle", stillFor: rt.still, noise: Math.min(1, speed / 4) },
    biomeAt: (e): Biome => biomeOf(sim, toGame(e)),
    surfaceAt: (e): Surface => { const g = toGame(e), tile = w.tile(Math.floor(g.x), Math.floor(g.y)); return tile === T.ROAD ? "asphalt" : tile === T.GRASS ? "grass" : tile === T.SAND ? "sand" : tile === T.WATER ? "water" : "concrete"; },
    groundY: (x, z) => w.groundZ(x / M, z / M),
    isIndoors: () => p.inside >= 0,
    isVisible: (e) => { const g = toGame(e); return Math.hypot(g.x - p.x, g.y - p.y) < 14; },
    anchorsNear: (tag, center, radius, max): Anchor[] => {
      const c = toGame(center), out: Anchor[] = [];
      for (const poi of w.pois) { if (ANCHOR[poi.kind] !== tag || Math.hypot(poi.x - c.x, poi.y - c.y) > radius / M) continue; out.push({ id: "poi:" + poi.id, tag, pos: toE(poi.x, poi.y) }); if (out.length >= max) break; }
      return out;
    },
  };
  rt.ctx = ctx; return ctx;
}

/** Game position -> the engine's biome vocabulary. */
export function biomeOf(sim: Simulation, g: { x: number; y: number }): Biome {
  const w = sim.world, tile = w.tile(Math.floor(g.x), Math.floor(g.y)), area = w.areaAt(g.x, g.y);
  if (tile === T.SAND) return "beach";
  if (area?.kind === "park" || tile === T.GRASS) return "park";
  if (w.buildings.some((b) => (b.kind === "recycling" || b.kind === "garage") && Math.hypot(b.door.x - g.x, b.door.y - g.y) < 12)) return "industrial";
  if (w.carriageway(g.x, g.y)) return "street";
  return /plaza|square/i.test(area?.name ?? "") ? "plaza" : "suburb";
}

export function updateAmbient(sim: Simulation): void {
  if (sim.tick % 6 !== 3) return;
  const rt = runtime(sim);
  rt.engine.update(0.1, worldContext(sim));
  visuals(sim, rt, 0.1);
}
