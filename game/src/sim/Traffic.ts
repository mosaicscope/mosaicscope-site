import type { Simulation } from "./Simulation";
import { Character, Vehicle, Phys } from "../entities/types";
import { VEHICLES, VehicleClass, FOR_SALE } from "../content/vehicles";
import { T, World, PERIOD, ROAD_W, CROSS_W } from "../world/World";
import { clamp, angDiff } from "../core/math";

/**
 * Cars. Traffic drives on the left (Aotearoa rules) on four-lane roads, two lanes each way: the kerb
 * lane (0) and the inner lane (1) beside the solid centre line. Cars pick their turn a block ahead,
 * change lanes when there is a gap (left turns from the kerb lane, right turns from the inner lane),
 * stop at the stop line before the crossing on red and amber, give way to people on crossings, and
 * turning right give way to oncoming traffic. Free-driving cars (the player, joyriders) steer
 * continuously and collide with buildings. Police cars in pursuit drive the lanes greedily toward
 * their target with sirens on and ignore red lights.
 */
const P = PERIOD;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const CITY_SPEED = 7.2; // ≈ 50 km/h
const TURN_SPEED = 3.4;

const lineOf = (c: number) => Math.floor(c / P);
/**
 * Lane centre coordinate (the fixed coordinate) for a direction on a road line. Lane 0 is the kerb
 * lane, lane 1 the inner lane next to the centre line. Eastbound and northbound traffic use offsets
 * 0.5 / 1.5, westbound and southbound 3.5 / 2.5 (left-hand traffic in screen space).
 */
export function laneCoord(dir: number, line: number, lane = 0): number {
  return line * P + (dir === 0 || dir === 3 ? 0.5 + lane : ROAD_W - 0.5 - lane);
}
/** Which lane (0 kerb, 1 inner) a cross-road coordinate is closest to for a direction. */
export function laneAt(dir: number, coord: number): number {
  const m = coord - lineOf(coord) * P;
  const l = dir === 0 || dir === 3 ? Math.round(m - 0.5) : Math.round(ROAD_W - 0.5 - m);
  return l <= 0 ? 0 : 1;
}
export interface Light { green: boolean; amber: boolean; walk: boolean; flash: boolean }
/**
 * Signal state for traffic travelling in `dir` through intersection (c, r). `walk` is the pedestrian
 * signal for the crossings over that same road: people may start crossing only while its traffic is
 * held on red; `flash` is the flashing red man at the end of the walk phase (finish, don't start).
 */
export function lightGreenFor(dir: number, c: number, r: number, tick: number): Light {
  const t = tick / 60 + ((c * 7 + r * 13) % 10);
  const phase = Math.floor(t / 10) % 2; // 10 s per phase
  const inPhase = t % 10;
  const ew = phase === 0;
  const mine = dir % 2 === 0 ? ew : !ew;
  return { green: mine, amber: mine && inPhase > 8.5, walk: !mine && inPhase < 6.5, flash: !mine && inPhase >= 6.5 };
}
/**
 * The intersection and traffic axis a crosswalk tile belongs to: crossing tiles on a north-south road
 * cross north/southbound traffic (axis 1), on an east-west road east/westbound traffic (axis 0).
 */
export function crossingOf(w: World, tx: number, ty: number): { c: number; r: number; axis: number } | null {
  if (w.tile(tx, ty) !== T.CROSSWALK) return null;
  const half = ROAD_W / 2;
  if (w.isRoadLine(tx)) return { c: lineOf(tx), r: Math.round((ty - half) / P), axis: 1 };
  return { c: Math.round((tx - half) / P), r: lineOf(ty), axis: 0 };
}
/** Pedestrian signal for a crosswalk tile: "walk" (green man), "flash" (finish crossing) or "stop". */
export function walkSignal(w: World, tx: number, ty: number, tick: number): "walk" | "flash" | "stop" {
  const x = crossingOf(w, tx, ty);
  if (!x) return "walk";
  const l = lightGreenFor(x.axis, x.c, x.r, tick);
  return l.walk ? "walk" : l.flash ? "flash" : "stop";
}

let plateN = 0;
function plate(sim: Simulation): string {
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ";
  plateN++;
  return L[sim.rng.int(0, L.length - 1)] + L[sim.rng.int(0, L.length - 1)] + L[sim.rng.int(0, L.length - 1)] + String(100 + ((plateN * 37) % 900));
}

export function makeVehicle(sim: Simulation, cls: VehicleClass, x: number, y: number, dir: number, state: Vehicle["state"]): Vehicle {
  const d = VEHICLES[cls];
  const v: Vehicle = {
    id: sim.vehicles.length, cls, x, y, px: x, py: y, heading: dir * Math.PI / 2, speed: 0, color: sim.rng.pick(d.colors), driver: -1, owner: -1,
    state, dir, nextDir: -1, damage: 0, siren: false, plate: plate(sim), forSale: false, price: d.price, stuck: 0, honkAt: 0, crashedUntil: 0, meet: false,
  };
  sim.vehicles.push(v);
  return v;
}

/** Put a driver in a car (they disappear from the street while driving). */
export function seat(sim: Simulation, c: Character, v: Vehicle): void {
  if (v.driver >= 0 && sim.chars[v.driver]) sim.chars[v.driver].inCar = -1;
  v.driver = c.id; c.inCar = v.id; c.x = v.x; c.y = v.y; c.goal = null; c.path = null;
  if (c.talkWith >= 0) sim.endConversation(c);
}

/** Get out on a walkable tile beside the car. */
export function unseat(sim: Simulation, v: Vehicle): Character | null {
  const c = sim.chars[v.driver];
  v.driver = -1;
  if (!c) return null;
  c.inCar = -1;
  const side = v.heading + Math.PI / 2;
  const p = sim.world.nearestWalkable(v.x + Math.cos(side) * 1.1, v.y + Math.sin(side) * 1.1);
  c.x = c.px = p.x; c.y = c.py = p.y; c.vx = c.vy = 0; c.facing = v.heading;
  c.nextThink = sim.tick + 1;
  return c;
}

export function spawnVehicles(sim: Simulation): void {
  const w = sim.world, rng = sim.rng;
  // traffic: drivers are real (background) people commuting
  const drivers = sim.chars.filter((c) => c.tier === "background" && c.inCar < 0);
  const traffic = Object.values(VEHICLES).filter((d) => d.traffic > 0);
  for (let i = 0; i < sim.cfg.trafficCars; i++) {
    const d = traffic[rng.weighted(traffic.map((t) => t.traffic))];
    const dir = rng.int(0, 3);
    const horizontal = dir % 2 === 0;
    const line = rng.int(0, w.maxLine), along = rng.range(3, w.size - 3), lane = rng.int(0, 1);
    // keep spawns out of intersections and off the crossings
    const a = w.isRoadLine(Math.floor(along)) ? along + ROAD_W + CROSS_W : along;
    if (a > w.size - 3) continue;
    const x = horizontal ? a : laneCoord(dir, line, lane), y = horizontal ? laneCoord(dir, line, lane) : a;
    if (sim.vehicles.some((o) => Math.hypot(o.x - x, o.y - y) < 3)) continue;
    const v = makeVehicle(sim, d.cls, x, y, dir, "drive");
    v.speed = CITY_SPEED * 0.6;
    const drv = drivers.pop();
    if (drv) seat(sim, drv, v);
  }
  // police patrol cars driven by cops
  const cops = sim.chars.filter((c) => c.role === "cop");
  for (let i = 0; i < 2 && cops.length > 4; i++) {
    const dir = i * 2, line = 2 + i;
    const v = makeVehicle(sim, "police", dir % 2 === 0 ? 20 + i * 30 : laneCoord(dir, line), dir % 2 === 0 ? laneCoord(dir, line) : 20, dir, "drive");
    seat(sim, cops[cops.length - 1 - i], v);
  }
  // parked cars in the lots
  for (let i = 0; i < w.size * w.size; i++) {
    if (w.tiles[i] !== T.PARKING) continue;
    const x = i % w.size, y = Math.floor(i / w.size);
    // neat bays two tiles apart, never on the driveway; every other row stays empty as an aisle so
    // you can drive straight out of a bay
    if (x % 2 !== 0 || y % 3 !== 1 || w.isRoadLine(x) || w.isRoadLine(y)) continue;
    if (w.tile(x, y + 1) !== T.PARKING && w.tile(x, y - 1) !== T.PARKING) continue;
    if (sim.vehicles.some((o) => o.state === "parked" && Math.abs(o.x - (x + 0.5)) < 0.1 && Math.abs(o.y - (y - 2)) < 0.1)) continue;
    const area = w.areaAt(x + 0.5, y + 0.5);
    if (!area || area.kind === "street") continue;
    let cls: VehicleClass = rng.pick(["hatch", "sedan", "suv", "ute", "jdm"] as VehicleClass[]);
    if (area.kind === "police") cls = "police";
    else if (area.kind === "hospital") cls = "ambulance";
    else if (area.kind === "dealership") cls = rng.pick(FOR_SALE);
    else if (area.kind === "casino") cls = rng.pick(["sedan", "suv", "sports", "muscle", "jdm", "super"] as VehicleClass[]);
    const v = makeVehicle(sim, cls, x + 0.5, y + 1, 1, "parked");
    if (area.kind === "dealership") { v.forSale = true; v.owner = -2; v.color = rng.pick(VEHICLES[cls].colors); }
  }
}

const tmp: number[] = [];

export function updateVehicles(sim: Simulation, dt: number): void {
  for (const v of sim.vehicles) {
    v.px = v.x; v.py = v.y;
    if (v.state === "parked") continue;
    if (v.state === "crashed") {
      v.speed *= 0.9;
      if (sim.tick > v.crashedUntil) v.state = v.driver === sim.playerId ? "free" : v.driver >= 0 ? (snapToLane(sim, v) ? "drive" : "free") : "parked";
      continue;
    }
    if (v.state === "drive") laneDrive(sim, v, dt);
    else freeDrive(sim, v, dt);
    // keep the driver with the car
    if (v.driver >= 0) { const c = sim.chars[v.driver]; if (c) { c.x = v.x; c.y = v.y; c.px = v.px; c.py = v.py; c.facing = v.heading; } }
  }
  collisions(sim);
}

/** Inputs for free-driving cars (player or joyrider). */
export interface DriveInput { throttle: number; steer: number; brake: boolean }
export const playerInput: DriveInput = { throttle: 0, steer: 0, brake: false };

function freeDrive(sim: Simulation, v: Vehicle, dt: number): void {
  const d = VEHICLES[v.cls];
  const inp = v.driver === sim.playerId ? playerInput : { throttle: 0, steer: 0, brake: true };
  if (inp.brake) v.speed = Math.abs(v.speed) < d.brake * dt ? 0 : v.speed - Math.sign(v.speed) * d.brake * dt;
  else if (inp.throttle > 0) v.speed += (v.speed < 0 ? d.brake : d.accel) * inp.throttle * dt;
  else if (inp.throttle < 0) v.speed -= (v.speed > 0 ? d.brake : d.accel * 0.6) * -inp.throttle * dt;
  else v.speed *= 1 - 0.8 * dt; // coasting
  const top = d.topSpeed * (1 - v.damage * 0.5);
  v.speed = clamp(v.speed, -top * 0.35, top);
  const grip = d.grip * Math.min(1, Math.abs(v.speed) / 3) * (1 - Math.min(0.5, Math.abs(v.speed) / (top * 2.5)));
  v.heading += inp.steer * grip * dt * Math.sign(v.speed || 1);
  moveBlocked(sim, v, dt);
}

/** Move along the heading; solid tiles stop the car and dent it. */
function moveBlocked(sim: Simulation, v: Vehicle, dt: number): void {
  const d = VEHICLES[v.cls];
  const nx = v.x + Math.cos(v.heading) * v.speed * dt, ny = v.y + Math.sin(v.heading) * v.speed * dt;
  const fx = nx + Math.cos(v.heading) * (d.length / 2) * Math.sign(v.speed || 1), fy = ny + Math.sin(v.heading) * (d.length / 2) * Math.sign(v.speed || 1);
  const side = v.heading + Math.PI / 2, hw = d.width / 2 * 0.9;
  const blocked = (x: number, y: number) => !sim.world.walkable(x, y) && sim.world.tile(Math.floor(x), Math.floor(y)) !== T.CRATE || !sim.world.inBounds(Math.floor(x), Math.floor(y));
  if (blocked(fx + Math.cos(side) * hw, fy + Math.sin(side) * hw) || blocked(fx - Math.cos(side) * hw, fy - Math.sin(side) * hw)) {
    const hit = Math.abs(v.speed);
    if (hit > 3) {
      v.damage = Math.min(1, v.damage + hit * 0.015);
      sim.bus.emit("sound", { kind: "crash", x: v.x, y: v.y, vol: Math.min(1, hit / 10) });
      sim.bus.emit("fx", { kind: "spark", x: fx, y: fy, z: 0.4, n: 8, color: "#f6b62c" });
    }
    v.speed = -v.speed * 0.25;
    v.stuck += dt;
    return;
  }
  v.x = nx; v.y = ny; v.stuck = Math.max(0, v.stuck - dt);
}

function snapToLane(sim: Simulation, v: Vehicle): boolean {
  const w = sim.world;
  // find a lane through a nearby road tile, aligned to the closest cardinal heading
  const dir = ((Math.round(v.heading / (Math.PI / 2)) % 4) + 4) % 4;
  const horizontal = dir % 2 === 0;
  const lineC = horizontal ? lineOf(v.y) : lineOf(v.x);
  const cross = horizontal ? v.y : v.x;
  const lane = laneCoord(dir, lineC, laneAt(dir, cross));
  if (Math.abs(cross - lane) > 2) return false;
  if (horizontal) v.y = lane; else v.x = lane;
  if (!w.drivable(v.x, v.y)) return false;
  v.dir = dir; v.heading = dir * Math.PI / 2; v.nextDir = -1;
  clearLaneState(v);
  return true;
}

/** The lane (0 kerb, 1 inner) each lane-driving car is steering for; absent = the lane it is in. */
const laneWant = new WeakMap<Vehicle, number>();
/** The intersection a car has already picked its turn for (c * 64 + r). */
const decidedAt = new WeakMap<Vehicle, number>();
/** Forget lane and turn plans (after a car is teleported, towed or snapped back into traffic). */
export function clearLaneState(v: Vehicle): void { laneWant.delete(v); decidedAt.delete(v); }

const crossCoord = (v: Vehicle) => (v.dir % 2 === 0 ? v.y : v.x);
const leftOf = (d: number) => (d + 3) % 4, rightOf = (d: number) => (d + 1) % 4;
const tmp2: number[] = [];

function validDirs(c: number, r: number, from: number, max: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    if (d === (from + 2) % 4) continue; // no U-turns
    if (d === 0 && c >= max) continue; if (d === 2 && c <= 0) continue;
    if (d === 1 && r >= max) continue; if (d === 3 && r <= 0) continue;
    out.push(d);
  }
  return out.length ? out : [(from + 2) % 4];
}

/** Is anyone on foot on the crossing on arm `arm` (0 E, 1 S, 2 W, 3 N) of intersection (c, r)? */
function crosswalkBusy(sim: Simulation, c: number, r: number, arm: number): boolean {
  const X = c * P, Y = r * P;
  let x0: number, y0: number, x1: number, y1: number;
  if (arm === 0) { x0 = X + ROAD_W; x1 = x0 + CROSS_W; y0 = Y; y1 = Y + ROAD_W; }
  else if (arm === 2) { x1 = X; x0 = X - CROSS_W; y0 = Y; y1 = Y + ROAD_W; }
  else if (arm === 1) { y0 = Y + ROAD_W; y1 = y0 + CROSS_W; x0 = X; x1 = X + ROAD_W; }
  else { y1 = Y; y0 = Y - CROSS_W; x0 = X; x1 = X + ROAD_W; }
  const n = sim.charHash.query((x0 + x1) / 2, (y0 + y1) / 2, 2.4, tmp2);
  for (let i = 0; i < n; i++) {
    const ch = sim.chars[tmp2[i]];
    if (ch.inCar >= 0 || ch.inside >= 0) continue;
    if (ch.x > x0 - 0.1 && ch.x < x1 + 0.1 && ch.y > y0 - 0.1 && ch.y < y1 + 0.1) return true;
  }
  return false;
}

/** Room to move into `lane` beside us (nobody alongside or just behind/ahead in it)? */
function laneClear(sim: Simulation, v: Vehicle, lane: number): boolean {
  const [ux, uy] = DIRS[v.dir], d = VEHICLES[v.cls];
  const tc = laneCoord(v.dir, lineOf(crossCoord(v)), lane);
  for (const o of sim.vehicles) {
    if (o === v || o.state === "parked" && sim.world.tile(Math.floor(o.x), Math.floor(o.y)) === T.PARKING) continue;
    if (Math.abs((v.dir % 2 === 0 ? o.y : o.x) - tc) > 0.75) continue;
    const rel = (o.x - v.x) * ux + (o.y - v.y) * uy, reach = (d.length + VEHICLES[o.cls].length) / 2;
    if (rel > -(reach + 1.2 + Math.max(0, o.speed - v.speed) * 0.8) && rel < reach + 1.5) return false;
  }
  return true;
}

/** Turning right across oncoming traffic: is anything coming that has right of way? */
function oncomingConflict(sim: Simulation, v: Vehicle, c: number, r: number): boolean {
  const od = (v.dir + 2) % 4, [oux, ouy] = DIRS[od];
  const bx = c * P + ROAD_W / 2, by = r * P + ROAD_W / 2;
  for (const o of sim.vehicles) {
    if (o === v || (o.state !== "drive" && o.state !== "free")) continue;
    if (o.state === "drive" ? o.dir !== od : Math.abs(angDiff(o.heading, od * Math.PI / 2)) > 0.6) continue;
    const dd = (bx - o.x) * oux + (by - o.y) * ouy, lat = Math.abs((bx - o.x) * -ouy + (by - o.y) * oux);
    if (lat > ROAD_W / 2 + 0.3 || dd < -1.2 || dd > 13) continue;
    if (o.state === "drive" && o.nextDir === rightOf(o.dir)) continue; // opposing right-turners pass each other
    if (Math.abs(o.speed) < 0.4 && dd > 3) continue;                    // held at their own stop line
    return true;
  }
  return false;
}

function laneDrive(sim: Simulation, v: Vehicle, dt: number): void {
  const w = sim.world, d = VEHICLES[v.cls], maxL = w.maxLine;
  const [ux, uy] = DIRS[v.dir];
  const tx = Math.floor(v.x), ty = Math.floor(v.y);
  const inX = w.isRoadLine(tx) && w.isRoadLine(ty);
  const pursuing = v.siren;
  let target = Math.min(d.topSpeed, pursuing ? d.topSpeed : CITY_SPEED) * (1 - v.damage * 0.5);
  /** fastest speed that still stops within `gap` tiles at a comfortable deceleration */
  const stopFor = (gap: number) => (gap <= 0.05 ? 0 : Math.sqrt(2 * d.brake * 0.55 * gap));

  // the intersection we are in or approaching, and front bumper -> box distance
  const along = v.dir % 2 === 0 ? v.x : v.y, pos = v.dir === 0 || v.dir === 1;
  let ic = -1, ir = -1, dist = 99;
  if (inX) { ic = lineOf(tx); ir = lineOf(ty); dist = 0; }
  else {
    const L = pos ? Math.ceil(along / P) : Math.floor((along - ROAD_W) / P);
    if (L >= 0 && L <= maxL) {
      dist = (pos ? L * P - along : along - (L * P + ROAD_W)) - d.length / 2;
      const other = lineOf(crossCoord(v));
      if (v.dir % 2 === 0) { ic = L; ir = other; } else { ic = other; ir = L; }
    }
  }
  const distStop = dist - CROSS_W; // front bumper -> stop line (before the crossing)

  // pick the turn a block ahead, so there is time to get into the right lane
  if (ic >= 0) {
    const key = ic * 64 + ir;
    const repick = pursuing && !inX && dist < 6;
    if (decidedAt.get(v) !== key || v.nextDir < 0 || repick) {
      decidedAt.set(v, key);
      const opts = validDirs(ic, ir, v.dir, maxL);
      if (inX) v.nextDir = opts.includes(v.dir) ? v.dir : opts[0];
      else if (pursuing && v.driver >= 0) {
        // head toward the suspect
        const cop = sim.chars[v.driver], s = cop ? sim.chars[cop.pursuing] : undefined;
        if (s) { const want = Math.abs(s.x - v.x) > Math.abs(s.y - v.y) ? (s.x > v.x ? 0 : 2) : (s.y > v.y ? 1 : 3); v.nextDir = opts.includes(want) ? want : opts.includes(v.dir) ? v.dir : opts[0]; }
        else v.nextDir = opts.includes(v.dir) ? v.dir : opts[0];
      } else {
        const wts = opts.map((o) => (o === v.dir ? 2 : 1));
        v.nextDir = opts[Math.max(0, sim.rng.weighted(wts))];
      }
    }
  }
  const turning = v.nextDir >= 0 && v.nextDir !== v.dir;
  const turnRight = turning && v.nextDir === rightOf(v.dir);
  const curLane = laneAt(v.dir, crossCoord(v));
  let want = laneWant.get(v) ?? curLane;
  // lanes: left turns from the kerb lane, right turns from the inner lane, straight on from either
  if (!inX && ic >= 0) {
    const need = !turning ? -1 : v.nextDir === leftOf(v.dir) ? 0 : 1;
    if (need >= 0 && want !== need) {
      if (distStop > 1.5 && laneClear(sim, v, need)) want = need;
      else if (distStop <= 1.5 && validDirs(ic, ir, v.dir, maxL).includes(v.dir) && !pursuing) v.nextDir = v.dir; // missed it: carry on straight
    }
  }

  // how far the car's centre is from the point where it swings into the new road
  let turnGap = 99, turnLane = 0;
  if (turning && ic >= 0) {
    turnLane = v.nextDir === leftOf(v.dir) ? 0 : 1;
    const tc = v.nextDir % 2 === 0 ? laneCoord(v.nextDir, ir, turnLane) : laneCoord(v.nextDir, ic, turnLane);
    turnGap = (tc - along) * (pos ? 1 : -1);
    target = Math.min(target, inX ? TURN_SPEED : TURN_SPEED + Math.max(0, distStop) * 0.9);
  }

  let holdPed = false;
  if (ic >= 0 && !pursuing) {
    if (!inX && distStop > -0.4) {
      // traffic lights: stop at the line on red, and on amber when there is room to stop
      const l = lightGreenFor(v.dir, ic, ir, sim.tick);
      const canStop = (v.speed * v.speed) / (2 * d.brake) < distStop + 0.3;
      if (!l.green || (l.amber && canStop)) target = Math.min(target, stopFor(distStop - 0.15));
      // give way to anyone on the crossing in front, or on the far crossing when going straight on
      else if (distStop < 12 && (crosswalkBusy(sim, ic, ir, (v.dir + 2) % 4) || (!turning && crosswalkBusy(sim, ic, ir, v.dir)))) {
        target = Math.min(target, stopFor(distStop - 0.15)); holdPed = true;
      }
    }
    if (turning && (inX || distStop < 0.6)) {
      // turning: wait in the intersection for people on the crossing of the road we turn into,
      // and turning right, give way to oncoming traffic going straight or turning left
      if (crosswalkBusy(sim, ic, ir, v.nextDir) || (turnRight && oncomingConflict(sim, v, ic, ir))) {
        target = Math.min(target, stopFor(turnGap - 0.6)); holdPed = true;
      }
    }
  }
  // keep distance from cars ahead and anything crossing in front
  let leadGap = 99, leadSpeed = 99;
  for (const o of sim.vehicles) {
    if (o === v || o.state === "parked" && w.tile(Math.floor(o.x), Math.floor(o.y)) === T.PARKING) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const ahead = dx * ux + dy * uy, lateral = Math.abs(dx * -uy + dy * ux);
    const hd = Math.abs(angDiff(o.heading, v.heading));
    // same lane ahead, or anything crossing/turning in front of us (not oncoming or side-by-side traffic)
    const crossing = ahead > 0 && ahead < 2.6 && lateral < 1.6 && hd > 0.5 && hd < 2.4;
    const sameLane = ahead > 0 && ahead < 4.5 && lateral < 0.75;
    if (crossing || sameLane) {
      const gap = ahead - (d.length + VEHICLES[o.cls].length) / 2 - 0.4;
      target = Math.min(target, Math.max(0, gap) * 2.2);
      if (sameLane && !crossing && gap < leadGap) { leadGap = gap; leadSpeed = Math.abs(o.speed); }
    }
  }
  // stuck behind something slow mid-block (a breakdown, someone parking)? overtake in the other lane
  if (!inX && !turning && distStop > 8 && leadGap < 2.5 && leadSpeed < 1.5 && want === curLane && laneClear(sim, v, 1 - curLane)) want = 1 - curLane;
  laneWant.set(v, want);

  // pedestrians in front (look as far as the stopping distance): stop, and honk if they dawdle
  const look = d.length / 2 + 0.6 + (v.speed * v.speed) / (2 * d.brake);
  let blockedBy = -1;
  for (let step = 0.9; step <= look + 0.01 && blockedBy < 0; step += 0.9) {
    const n = sim.charHash.query(v.x + ux * step, v.y + uy * step, 0.85, tmp);
    for (let i = 0; i < n; i++) { const c = sim.chars[tmp[i]]; if (c.inCar < 0 && c.inside < 0 && c.id !== v.driver) { blockedBy = c.id; break; } }
  }
  if (blockedBy >= 0 && !pursuing) {
    target = 0;
    if (Math.abs(v.speed) < 0.3) {
      v.stuck += dt;
      if (v.stuck > 1.6 && sim.tick > v.honkAt) {
        v.honkAt = sim.tick + 240;
        sim.bus.emit("sound", { kind: "horn", x: v.x, y: v.y, vol: 0.6 });
        const c = sim.chars[blockedBy];
        // someone loitering in the lane steps back onto the footpath instead of blocking traffic forever
        // (but nobody gets shoved off a crossing they are using properly)
        const onCrossing = w.tile(Math.floor(c.x), Math.floor(c.y)) === T.CROSSWALK;
        if (c.tier !== "player" && v.stuck > 3 && !onCrossing) { const k = sim.world.nearestWalkable(c.x + (c.x - v.x), c.y + (c.y - v.y)); if (!sim.world.isRoadLine(Math.floor(k.x)) && !sim.world.isRoadLine(Math.floor(k.y))) { c.x = c.px = k.x; c.y = c.py = k.y; c.path = null; } }
        if (c.tier !== "player" && !onCrossing) { c.emo.fear = Math.min(1, c.emo.fear + 0.1); c.emo.frustration = Math.min(1, c.emo.frustration + 0.05); sim.say(c, sim.dialogue.bark(c, "honked"), "shout", 1.2); }
      }
    }
  } else if (holdPed && Math.abs(v.speed) < 0.3) v.stuck += dt * 0.5;
  else v.stuck = Math.max(0, v.stuck - dt);

  // accelerate / brake toward target
  const dv = target - v.speed;
  v.speed += dv > 0 ? Math.min(dv, d.accel * dt) : Math.max(dv, -d.brake * dt);
  if (v.speed < 0) v.speed = 0;

  // turning inside an intersection: swing into the new road when we reach its lane
  if (inX && turning) {
    const nd = v.nextDir, c = lineOf(tx), r = lineOf(ty);
    const tc = nd % 2 === 0 ? laneCoord(nd, r, turnLane) : laneCoord(nd, c, turnLane);
    const cur = v.dir % 2 === 0 ? v.x : v.y;
    if ((pos && cur >= tc) || (!pos && cur <= tc)) {
      if (v.dir % 2 === 0) v.x = tc; else v.y = tc;
      v.dir = nd; laneWant.set(v, turnLane); // nextDir stays = dir: no second turn in this box
    }
  }
  // hold the wanted lane; a lane change drifts across at a pace that depends on speed
  const [nux, nuy] = DIRS[v.dir];
  const cc = crossCoord(v);
  const lw = laneWant.get(v) ?? laneAt(v.dir, cc);
  const off = laneCoord(v.dir, lineOf(cc), lw) - cc;
  const latMax = dt * (Math.abs(off) > 0.3 ? 0.3 + 0.2 * v.speed : 3);
  const lat = clamp(off * Math.min(1, dt * 6), -latMax, latMax);
  if (nux) v.y += lat; else v.x += lat;
  // ease heading toward the lane direction, yawing a little into a lane change
  const latComp = nux ? lat * nux : lat * -nuy;
  const yaw = clamp(Math.atan2(latComp / Math.max(dt, 1e-4), Math.max(1, v.speed)), -0.35, 0.35);
  v.heading += angDiff(v.dir * Math.PI / 2 + yaw, v.heading) * Math.min(1, dt * 10);
  v.x += nux * v.speed * dt; v.y += nuy * v.speed * dt;
  // wrap protection: off the map -> turn around
  if (v.x < 0.3 || v.y < 0.3 || v.x > w.size - 0.3 || v.y > w.size - 0.3) {
    // should never happen (turns are forced at the edge), but if it does: U-turn into the correct lane
    v.dir = (v.dir + 2) % 4; v.nextDir = -1; clearLaneState(v);
    v.x = clamp(v.x, 0.5, w.size - 0.5); v.y = clamp(v.y, 0.5, w.size - 0.5);
    if (v.dir % 2 === 0) v.y = laneCoord(v.dir, lineOf(v.y)); else v.x = laneCoord(v.dir, lineOf(v.x));
    v.heading = v.dir * Math.PI / 2;
  }
}

/** Car footprint hits: people get knocked (fake blood at speed); cars crash into each other. */
function collisions(sim: Simulation): void {
  for (const v of sim.vehicles) {
    if (v.state === "parked") continue;
    const sp = Math.abs(v.speed);
    const d = VEHICLES[v.cls];
    const n = sim.charHash.query(v.x, v.y, d.length / 2 + 0.6, tmp);
    const cos = Math.cos(v.heading), sin = Math.sin(v.heading);
    for (let i = 0; i < n; i++) {
      const c = sim.chars[tmp[i]];
      if (c.inCar >= 0 || c.inside >= 0 || c.id === v.driver) continue;
      // lane traffic never mounts the kerb; only free-driven cars can hit people on the footpath
      if (v.state === "drive" && !sim.world.drivable(c.x, c.y)) continue;
      const dx = c.x - v.x, dy = c.y - v.y;
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
      if (Math.abs(lx) > d.length / 2 + c.radius * 0.5 || Math.abs(ly) > d.width / 2 + c.radius * 0.5) continue;
      if (sp < 1.4) {
        // nudge people out of the way at walking pace
        const push = Math.sign(ly || 1) * 0.06; c.x += -sin * push; c.y += cos * push; continue;
      }
      sim.onCarHit(v, c, sp);
    }
  }
  const vs = sim.vehicles;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const a = vs[i], b = vs[j];
    if (a.state === "parked" && b.state === "parked") continue;
    const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
    const r = (VEHICLES[a.cls].length + VEHICLES[b.cls].length) * 0.5;
    if (dd > r * r || !bodiesTouch(a, b)) continue;
    const rel = Math.hypot(Math.cos(a.heading) * a.speed - Math.cos(b.heading) * b.speed, Math.sin(a.heading) * a.speed - Math.sin(b.heading) * b.speed);
    const dl = Math.sqrt(dd) || 0.01, push = (r - dl) / 2;
    if (a.state !== "parked") { a.x -= (dx / dl) * push; a.y -= (dy / dl) * push; }
    if (b.state !== "parked") { b.x += (dx / dl) * push; b.y += (dy / dl) * push; }
    if (rel > 2.5) sim.onCarCrash(a, b, rel);
  }
}

/** Each car body is three circles along its length (radius = half width), so lanes side by side never touch. */
function bodiesTouch(a: Vehicle, b: Vehicle): boolean {
  const da = VEHICLES[a.cls], db = VEHICLES[b.cls];
  const ra = da.width * 0.4, rb = db.width * 0.4, rr = (ra + rb) * (ra + rb);
  for (const ka of [-1, 0, 1]) {
    const ax = a.x + Math.cos(a.heading) * ka * da.length / 3, ay = a.y + Math.sin(a.heading) * ka * da.length / 3;
    for (const kb of [-1, 0, 1]) {
      const bx = b.x + Math.cos(b.heading) * kb * db.length / 3, by = b.y + Math.sin(b.heading) * kb * db.length / 3;
      if ((ax - bx) ** 2 + (ay - by) ** 2 < rr) return true;
    }
  }
  return false;
}

export function isPlayerDriving(sim: Simulation): Vehicle | null {
  const p = sim.player;
  return p.inCar >= 0 ? sim.vehicles[p.inCar] ?? null : null;
}

export function nearestCar(sim: Simulation, x: number, y: number, r = 2.2): Vehicle | null {
  let best: Vehicle | null = null, bd = r;
  for (const v of sim.vehicles) { const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v; } }
  return best;
}

export { Phys };
