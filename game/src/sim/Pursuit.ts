import type { Character, Vehicle } from "../entities/types";
import type { Simulation } from "./Simulation";
import { Phys } from "../entities/types";
import { arrest } from "./Society";
import { components, impactComponents } from "./VehicleDamage";
import { VEHICLES } from "../content/vehicles";
import { unseat } from "./Traffic";
import { forceGoal } from "../ai/brain";

/**
 * GTA-style police pursuit layered on the existing police (Society.reportCrime / Simulation.policeTick),
 * traffic drivers (Traffic.laneDrive, MappedTraffic.driveMappedVehicle) and damage (VehicleDamage).
 *
 * Phases:  stalk (1★, unmarked tail, lights dark, holds distance) → chase (sirens, closing in)
 *          → search (lost sight: cops drive to the last-seen spot, a timer runs; leave the zone to escape).
 * Tactics while chasing a car: tail, close, PIT (spin you from the rear quarter), ram, box-in (two cars pin
 * you, officers pull you out), stinger strips laid ahead (burst tyres), roadblocks of parked cruisers.
 * On foot, officers bail out of their cars and run you down (existing "pursue" goal) and cuff you.
 */
export type Phase = "calm" | "stalk" | "chase" | "search";
export type CueKind = "wanted" | "crash" | "busted" | "evaded" | "spotted" | "lost" | "pit" | "ram" | "spikes" | "roadblock" | "boxed" | "tailed" | "foot";
export interface Cue { kind: CueKind; title: string; sub: string; tick: number }
export interface Spike { id: number; x: number; y: number; ax: number; ay: number; len: number; until: number; hit: boolean }
export interface PursuitState {
  phase: Phase;
  seenX: number; seenY: number; lastSeen: number;
  searchUntil: number; searchTotal: number; radius: number;
  spikes: Spike[]; blocks: number[]; blockUntil: number;
  nextSpikeAt: number; nextBlockAt: number; nextReinforceAt: number;
  stalkSince: number; lastPit: number; boxed: number; stopped: number;
  /** a short line for the HUD about what the police are doing right now */
  tactic: string;
  cues: Cue[];
  seq: number;
}

export function pursuitState(): PursuitState {
  return { phase: "calm", seenX: 0, seenY: 0, lastSeen: 0, searchUntil: 0, searchTotal: 1, radius: 0, spikes: [], blocks: [], blockUntil: 0,
    nextSpikeAt: 0, nextBlockAt: 0, nextReinforceAt: 0, stalkSince: 0, lastPit: 0, boxed: 0, stopped: 0, tactic: "", cues: [], seq: 0 };
}

const STEP = 3; // pursuitStep runs every 3 sim ticks
const SEC = 60;

function cue(sim: Simulation, kind: CueKind, title: string, sub = ""): void {
  const q = sim.pursuit.cues;
  if (q.some((c) => c.kind === kind && sim.tick - c.tick < SEC * 2)) return;
  q.push({ kind, title, sub, tick: sim.tick });
  if (q.length > 6) q.shift();
}

/** Public: the UI raises crash and crime cues through the same queue so they never stack on top of each other. */
export function raiseCue(sim: Simulation, kind: CueKind, title: string, sub = ""): void { cue(sim, kind, title, sub); }

/** Where a pursuing officer should drive: the suspect, or (while searching) the last place anyone saw them. */
export function chaseTarget(sim: Simulation, cop: Character | undefined): { x: number; y: number } | undefined {
  if (!cop || cop.pursuing < 0) return undefined;
  const s = sim.chars[cop.pursuing];
  if (!s) return undefined;
  if (s.id === sim.playerId && sim.pursuit.phase === "search") return { x: sim.pursuit.seenX, y: sim.pursuit.seenY };
  return s;
}

const isCop = (c: Character | undefined): c is Character => !!c && c.role === "cop" && c.phys === Phys.OK && c.jailUntil <= 0;
const patrols = (sim: Simulation): Vehicle[] => sim.vehicles.filter((v) => v.siren && v.driver >= 0 && sim.chars[v.driver]?.pursuing === sim.playerId);

/** Sample straight ahead of the player's car for a drivable spot `dist` tiles away. */
function ahead(sim: Simulation, v: Vehicle, dist: number): { x: number; y: number; hx: number; hy: number } | null {
  const hx = Math.cos(v.heading), hy = Math.sin(v.heading);
  for (let d = dist; d >= dist * 0.6; d -= 2) {
    const x = v.x + hx * d, y = v.y + hy * d;
    if (!sim.world.drivable(x, y)) return null; // the road turns before then: wait for a straighter run
    if (d === dist) return { x, y, hx, hy };
  }
  return null;
}

function speedOf(v: Vehicle): number { return Math.hypot(v.vx ?? Math.cos(v.heading) * v.speed, v.vy ?? Math.sin(v.heading) * v.speed); }

/** Called every few ticks from Simulation.step. */
export function pursuitStep(sim: Simulation): void {
  if (sim.tick % STEP !== 0) return;
  const ps = sim.pursuit, p = sim.player;
  const car = p.inCar >= 0 ? sim.vehicles[p.inCar] : undefined;
  tickSpikes(sim, car);
  if (ps.blocks.length && sim.tick > ps.blockUntil) clearBlocks(sim);
  if (p.wanted <= 0 || p.jailUntil > sim.tick || p.arrestedBy >= 0) {
    if (ps.phase !== "calm") endPursuit(sim);
    return;
  }
  const cars = patrols(sim);

  // ---- line of sight: cops on foot see 14 tiles, cruisers 18 ----
  let seen = false;
  for (const c of sim.chars) {
    if (c.role !== "cop" || c.inside >= 0 || c.phys !== Phys.OK) continue;
    const r = c.inCar >= 0 ? 18 : 14, d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < r && (d < 3 || sim.world.lineOfSight(c.x, c.y, p.x, p.y))) { seen = true; break; }
  }
  if (p.inside >= 0) seen = false;
  if (seen) {
    if (ps.phase === "search") cue(sim, "spotted", "Spotted", "They have eyes on you again");
    ps.seenX = p.x; ps.seenY = p.y; ps.lastSeen = sim.tick;
    if (ps.phase === "calm" || ps.phase === "search") { ps.phase = p.wanted <= 1 ? "stalk" : "chase"; ps.stalkSince = sim.tick; }
  } else if (ps.phase === "calm") { ps.seenX = p.x; ps.seenY = p.y; ps.lastSeen = sim.tick; ps.phase = "search"; startSearch(sim); }
  if (p.wanted >= 2 && ps.phase === "stalk") ps.phase = "chase";
  // a tail that has been on you for 10 s lights up
  if (ps.phase === "stalk" && sim.tick - ps.stalkSince > SEC * 10 && cars.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 16)) {
    ps.phase = "chase"; cue(sim, "tailed", "Lights on", "The car behind you was a cop");
  }
  if ((ps.phase === "stalk" || ps.phase === "chase") && sim.tick - ps.lastSeen > SEC * 3) { ps.phase = "search"; startSearch(sim); cue(sim, "lost", "Out of sight", "Get clear of the search zone"); }

  // ---- search zone: timer runs while unseen; outside the zone when it ends = escaped ----
  if (ps.phase === "search" && sim.tick >= ps.searchUntil) {
    const out = Math.hypot(p.x - ps.seenX, p.y - ps.seenY) > ps.radius;
    if (out || p.wanted <= 1) { endPursuit(sim, true); return; }
    p.wanted -= 1; startSearch(sim);
    sim.emit({ type: "wanted", x: p.x, y: p.y, actors: [p.id], data: { stars: p.wanted }, summary: `The police are losing your trail (${p.wanted}★)` });
  }

  reinforce(sim, cars.length);
  const stalking = ps.phase === "stalk", searching = ps.phase === "search";
  for (const v of cars) {
    v.silent = stalking;
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    // stalking: hold 9 to 15 tiles back, matching your pace
    if (stalking) v.pursuitCap = d < 9 ? Math.max(0, (car ? speedOf(car) : 1.4) * 0.8) : d < 15 ? Math.max(2, car ? speedOf(car) : 1.4) : undefined;
    else if (searching) v.pursuitCap = Math.min(VEHICLES[v.cls].topSpeed, 8); // sweeping, not racing
    else v.pursuitCap = undefined;
  }
  ps.tactic = stalking ? "Unmarked car tailing you" : searching ? "Searching the area" : car ? "In pursuit" : "Officers on foot";

  if (car && ps.phase === "chase") carTactics(sim, car, cars);
  else ps.boxed = ps.stopped = 0;
  // on foot: a cruiser that pulls up anywhere near you (or gets stuck at the kerb) lets its officer out to run you down
  if (!car && ps.phase === "chase") for (const v of cars) {
    if (Math.hypot(v.x - p.x, v.y - p.y) > 16 || Math.abs(v.speed) > 1.5) continue;
    const cop = sim.chars[v.driver];
    v.speed = 0; unseat(sim, v); v.state = "parked"; v.pursuitCap = undefined;
    if (cop) forceGoal(cop, sim, "pursue", { u: 1, target: p.id });
    cue(sim, "foot", "Foot chase", "Officers out of the car");
  }
}

function startSearch(sim: Simulation): void {
  const ps = sim.pursuit, w = sim.player.wanted;
  ps.searchTotal = SEC * (8 + 4 * w);
  ps.searchUntil = sim.tick + ps.searchTotal;
  ps.radius = 16 + 7 * w;
}

function endPursuit(sim: Simulation, escaped = false): void {
  const ps = sim.pursuit, p = sim.player;
  for (const v of sim.vehicles) if (v.pursuitCap !== undefined || v.silent) { v.pursuitCap = undefined; v.silent = false; }
  if (escaped) {
    p.wanted = 0;
    for (const c of sim.chars) if (c.pursuing === p.id) { c.pursuing = -1; c.goal = null; if (c.inCar >= 0) { const v = sim.vehicles[c.inCar]; if (v) v.siren = false; } }
    sim.emit({ type: "wanted", x: p.x, y: p.y, actors: [p.id], data: { stars: 0 }, summary: "The police lost you. Wanted level cleared." });
    cue(sim, "evaded", "Evaded", "The police lost you");
  }
  ps.phase = "calm"; ps.tactic = ""; ps.boxed = ps.stopped = 0;
  ps.spikes.length = 0; clearBlocks(sim);
}

/** Keep 1 + stars cruisers on the case. Backup comes from traffic well away from you, so nobody pops in on camera. */
function reinforce(sim: Simulation, have: number): void {
  const ps = sim.pursuit, p = sim.player, want = Math.min(6, 1 + p.wanted);
  if (have >= want || sim.tick < ps.nextReinforceAt || p.wanted < 2) return;
  ps.nextReinforceAt = sim.tick + SEC * 4;
  const v = sim.vehicles.find((v) => v.state === "drive" && v.driver >= 0 && v.owner < 0 && !v.siren && v.rescueTarget === undefined && v.fireTarget === undefined
    && sim.chars[v.driver]?.tier === "background" && Math.hypot(v.x - p.x, v.y - p.y) > 30 && Math.hypot(v.x - p.x, v.y - p.y) < 90);
  if (!v) return;
  const c = sim.chars[v.driver];
  v.cls = "police"; v.siren = true; c.role = "cop"; c.pursuing = p.id; c.goal = null;
}

// ------------------------------------------------------------------ tactics against a car
function carTactics(sim: Simulation, car: Vehicle, cars: Vehicle[]): void {
  const ps = sim.pursuit, p = sim.player, sp = speedOf(car);
  const hx = Math.cos(car.heading), hy = Math.sin(car.heading);
  let near = 0, closest: Vehicle | undefined, cd = Infinity;
  for (const v of cars) {
    const dx = v.x - car.x, dy = v.y - car.y, d = Math.hypot(dx, dy);
    if (d < 4.5) near++;
    if (d < cd) { cd = d; closest = v; }
    if (d > 3.4 || sim.tick - ps.lastPit < SEC * 4 || sp < 4) continue;
    const along = dx * hx + dy * hy, side = -dx * hy + dy * hx, rel = Math.max(1, speedOf(v) - sp * 0.6 + 3);
    if (p.wanted >= 2 && along < 0.6 && along > -2.8 && Math.abs(side) > 0.6 && Math.abs(side) < 2.2) {
      // PIT: tap the rear quarter, the back steps out
      const sgn = side > 0 ? -1 : 1;
      car.heading += sgn * (0.75 + Math.random() * 0.35);
      car.speed *= 0.45; if (car.vx !== undefined) { car.vx *= 0.45; car.vy = (car.vy ?? 0) * 0.45; }
      impactComponents(car, -dx / d, -dy / d, rel, VEHICLES[v.cls].mass ?? 1.5, sim.tick, { x: v.x, y: v.y });
      ps.lastPit = sim.tick; ps.tactic = "PIT manoeuvre";
      sim.emit({ type: "car_crash", x: car.x, y: car.y, actors: [p.id, v.driver], severity: 2, data: { police: 1 }, summary: "Police PIT manoeuvre: your car spun out" });
      cue(sim, "pit", "PIT", "They spun you out");
    } else if (p.wanted >= 3 && along < -0.8 && Math.abs(side) < 1.1) {
      // ram from behind
      car.speed *= 0.75; car.heading += (Math.random() - 0.5) * 0.4;
      impactComponents(car, hx, hy, rel, VEHICLES[v.cls].mass ?? 1.5, sim.tick, { x: v.x, y: v.y });
      ps.lastPit = sim.tick; ps.tactic = "Ramming";
      cue(sim, "ram", "Rammed", "Cruiser up your bumper");
    }
  }
  if (closest && cd < 30 && ps.tactic === "In pursuit") ps.tactic = cd < 6 ? "Closing in" : "Tailing you";

  // box in: two cruisers alongside while you crawl = pinned
  if (near >= 2 && sp < 2.5) {
    ps.boxed += STEP; car.speed *= 0.4; if (car.vx !== undefined) { car.vx *= 0.4; car.vy = (car.vy ?? 0) * 0.4; }
    ps.tactic = "Boxed in";
    if (ps.boxed === STEP) cue(sim, "boxed", "Boxed in", "Floor it or you're done");
  } else ps.boxed = Math.max(0, ps.boxed - STEP);
  // stopped with a cop at the door
  ps.stopped = sp < 0.8 && cd < 3.5 ? ps.stopped + STEP : 0;
  if ((ps.boxed > SEC * 2.5 || ps.stopped > SEC * 3) && closest) {
    const cop = sim.chars[closest.driver];
    if (isCop(cop)) { ps.boxed = ps.stopped = 0; arrest(sim, cop, p); return; }
  }

  // stinger strips: laid well ahead when you're flying
  if (p.wanted >= 2 && sp > 6 && sim.tick >= ps.nextSpikeAt) {
    const at = ahead(sim, car, 26);
    if (at) {
      ps.nextSpikeAt = sim.tick + SEC * (p.wanted >= 4 ? 10 : 16);
      ps.spikes.push({ id: ++ps.seq, x: at.x, y: at.y, ax: -at.hy, ay: at.hx, len: 3.2, until: sim.tick + SEC * 25, hit: false });
      cue(sim, "spikes", "Stinger ahead", "Spike strip across the road");
    }
  }
  // roadblock: two parked cruisers across the road ahead
  if (p.wanted >= 3 && sp > 4 && sim.tick >= ps.nextBlockAt && !ps.blocks.length) {
    const at = ahead(sim, car, 40);
    if (at) placeBlock(sim, at);
  }
}

function placeBlock(sim: Simulation, at: { x: number; y: number; hx: number; hy: number }): void {
  const ps = sim.pursuit, p = sim.player;
  const spare = sim.vehicles.filter((v) => v.driver < 0 && v.owner < 0 && !v.forSale && v.state === "parked" && !v.burnt && p.inCar !== v.id && Math.hypot(v.x - p.x, v.y - p.y) > 45).slice(0, 2);
  ps.nextBlockAt = sim.tick + SEC * 25;
  if (spare.length < 2) return;
  const ax = -at.hy, ay = at.hx;
  spare.forEach((v, i) => {
    const off = (i === 0 ? -1 : 1) * 1.15;
    v.x = v.px = at.x + ax * off; v.y = v.py = at.y + ay * off;
    v.heading = Math.atan2(ay, ax) + (i ? 0.35 : -0.35); v.speed = 0; v.vx = v.vy = 0;
    v.cls = "police"; v.siren = true; v.state = "parked"; v.roadblock = true;
  });
  ps.blocks = spare.map((v) => v.id); ps.blockUntil = sim.tick + SEC * 30;
  cue(sim, "roadblock", "Roadblock", "Cruisers across the road ahead");
}

function clearBlocks(sim: Simulation): void {
  for (const id of sim.pursuit.blocks) { const v = sim.vehicles[id]; if (v) { v.siren = false; v.roadblock = false; } }
  sim.pursuit.blocks.length = 0;
}

function tickSpikes(sim: Simulation, car: Vehicle | undefined): void {
  const ps = sim.pursuit;
  if (ps.spikes.length) ps.spikes = ps.spikes.filter((s) => s.until > sim.tick);
  if (!car) return;
  for (const s of ps.spikes) {
    if (s.hit) continue;
    const dx = car.x - s.x, dy = car.y - s.y, along = dx * s.ax + dy * s.ay, across = Math.abs(-dx * s.ay + dy * s.ax);
    if (Math.abs(along) > s.len / 2 + 0.6 || across > 0.8) continue;
    s.hit = true; s.until = Math.min(s.until, sim.tick + SEC * 4);
    const parts = components(car);
    for (const w of parts.wheels) w.puncture = true;
    car.flatLeft = car.flatRight = true;
    car.speed *= 0.7;
    sim.emit({ type: "car_crash", x: car.x, y: car.y, actors: [sim.playerId], severity: 2, data: { police: 1 }, summary: "You hit a stinger. All four tyres are shredded." });
    cue(sim, "spikes", "Tyres blown", "You drove over the stinger");
  }
}
