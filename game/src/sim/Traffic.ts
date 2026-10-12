import type { Simulation } from "./Simulation";
import { Character, Vehicle, Phys } from "../entities/types";
import { VEHICLES, VehicleClass, FOR_SALE } from "../content/vehicles";
import { T } from "../world/World";
import { clamp, angDiff } from "../core/math";

/**
 * Cars. Traffic drives on the left (Aotearoa rules) in lanes on a two-lane road grid, obeys traffic
 * lights, keeps distance, brakes for pedestrians and picks turns at intersections. Free-driving cars
 * (the player, joyriders) steer continuously and collide with buildings. Police cars in pursuit drive
 * the lanes greedily toward their target with sirens on and ignore red lights.
 */
const P = 16;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const CITY_SPEED = 7.2; // ≈ 50 km/h

const lineOf = (c: number) => Math.floor(c / P);
/** Lane centre coordinate (the fixed coordinate) for a direction on a road line. */
export function laneCoord(dir: number, line: number): number {
  return line * P + (dir === 0 ? 0.5 : dir === 1 ? 1.5 : dir === 2 ? 1.5 : 0.5);
}
export function lightGreenFor(dir: number, c: number, r: number, tick: number): { green: boolean; amber: boolean } {
  const t = tick / 60 + ((c * 7 + r * 13) % 10);
  const phase = Math.floor(t / 10) % 2; // 10 s per phase
  const inPhase = t % 10;
  const ew = phase === 0;
  const mine = dir % 2 === 0 ? ew : !ew;
  return { green: mine, amber: mine && inPhase > 8.5 };
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
    const line = rng.int(0, 6), along = rng.range(3, w.size - 3);
    // keep spawns out of intersections
    const a = w.isRoadLine(Math.floor(along)) ? along + 3 : along;
    const x = horizontal ? a : laneCoord(dir, line), y = horizontal ? laneCoord(dir, line) : a;
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
  const lane = laneCoord(dir, lineC);
  if (Math.abs((horizontal ? v.y : v.x) - lane) > 2) return false;
  if (horizontal) v.y = lane; else v.x = lane;
  if (!w.drivable(v.x, v.y)) return false;
  v.dir = dir; v.heading = dir * Math.PI / 2; v.nextDir = -1;
  return true;
}

function validDirs(c: number, r: number, from: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    if (d === (from + 2) % 4) continue; // no U-turns
    if (d === 0 && c >= 6) continue; if (d === 2 && c <= 0) continue;
    if (d === 1 && r >= 6) continue; if (d === 3 && r <= 0) continue;
    out.push(d);
  }
  return out.length ? out : [(from + 2) % 4];
}

function laneDrive(sim: Simulation, v: Vehicle, dt: number): void {
  const w = sim.world, d = VEHICLES[v.cls];
  const [ux, uy] = DIRS[v.dir];
  const tx = Math.floor(v.x), ty = Math.floor(v.y);
  const inX = w.isRoadLine(tx) && w.isRoadLine(ty);
  const pursuing = v.siren;
  let target = Math.min(d.topSpeed, pursuing ? d.topSpeed : CITY_SPEED) * (1 - v.damage * 0.5);

  // distance to the next intersection along our lane
  let dist = 99, ic = -1, ir = -1;
  if (!inX) {
    for (let s = 1; s <= 7; s++) {
      const cx = Math.floor(v.x + ux * s), cy = Math.floor(v.y + uy * s);
      if (w.isRoadLine(cx) && w.isRoadLine(cy)) {
        dist = (ux ? (ux > 0 ? cx - v.x : v.x - (cx + 1)) : (uy > 0 ? cy - v.y : v.y - (cy + 1))) - d.length / 2;
        ic = lineOf(cx); ir = lineOf(cy);
        break;
      }
    }
  }
  if (inX && v.nextDir < 0) { ic = lineOf(tx); ir = lineOf(ty); dist = 0; }
  if (ic >= 0 && v.nextDir < 0 && dist < 4) {
    const opts = validDirs(ic, ir, v.dir);
    if (pursuing && v.driver >= 0) {
      // head toward the suspect
      const cop = sim.chars[v.driver], s = cop ? sim.chars[cop.pursuing] : undefined;
      if (s) { const want = Math.abs(s.x - v.x) > Math.abs(s.y - v.y) ? (s.x > v.x ? 0 : 2) : (s.y > v.y ? 1 : 3); v.nextDir = opts.includes(want) ? want : opts.includes(v.dir) ? v.dir : opts[0]; }
      else v.nextDir = opts.includes(v.dir) ? v.dir : opts[0];
    } else {
      const wts = opts.map((o) => (o === v.dir ? 2 : 1));
      v.nextDir = opts[Math.max(0, sim.rng.weighted(wts))];
    }
  }
  // traffic lights
  if (ic >= 0 && !pursuing && dist < 2.2 && dist > -0.2) {
    const l = lightGreenFor(v.dir, ic, ir, sim.tick);
    if (!l.green || (l.amber && dist > 0.8)) target = Math.min(target, Math.max(0, dist - 0.3) * 3);
  }
  // keep distance from cars ahead and anything crossing in front
  for (const o of sim.vehicles) {
    if (o === v || o.state === "parked" && w.tile(Math.floor(o.x), Math.floor(o.y)) === T.PARKING) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const ahead = dx * ux + dy * uy, lateral = Math.abs(dx * -uy + dy * ux);
    const hd = Math.abs(angDiff(o.heading, v.heading));
    // same lane ahead, or anything crossing/turning right in front of us (not oncoming traffic)
    const crossing = ahead > 0 && ahead < 2.6 && lateral < 1.6 && hd > 0.5 && hd < 2.4;
    if (crossing || ahead > 0 && ahead < 4.5 && lateral < 0.75) {
      const gap = ahead - (d.length + VEHICLES[o.cls].length) / 2 - 0.4;
      target = Math.min(target, Math.max(0, gap) * 2.2);
    }
  }
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
        if (c.tier !== "player") { c.emo.fear = Math.min(1, c.emo.fear + 0.1); c.emo.frustration = Math.min(1, c.emo.frustration + 0.05); sim.say(c, sim.dialogue.bark(c, "honked"), "shout", 1.2); }
      }
    }
  } else v.stuck = Math.max(0, v.stuck - dt);

  // accelerate / brake toward target
  const dv = target - v.speed;
  v.speed += dv > 0 ? Math.min(dv, d.accel * dt) : Math.max(dv, -d.brake * dt);
  if (v.speed < 0) v.speed = 0;

  // turning inside an intersection: snap to the new lane when we pass its coordinate
  if (inX && v.nextDir >= 0 && v.nextDir !== v.dir) {
    const c = lineOf(tx), r = lineOf(ty);
    const nd = v.nextDir;
    const targetCoord = nd % 2 === 0 ? laneCoord(nd, r) : laneCoord(nd, c);
    const cur = v.dir % 2 === 0 ? v.x : v.y;
    const sgn = v.dir === 0 || v.dir === 1 ? 1 : -1;
    if ((sgn > 0 && cur >= targetCoord) || (sgn < 0 && cur <= targetCoord)) {
      if (v.dir % 2 === 0) v.x = targetCoord; else v.y = targetCoord;
      v.dir = nd; v.nextDir = -1;
    }
  }
  if (!inX && v.nextDir === v.dir && dist > 5) v.nextDir = -1;
  // ease heading toward the lane direction (smooth turns visually)
  const want = v.dir * Math.PI / 2;
  v.heading += angDiff(want, v.heading) * Math.min(1, dt * 10);
  // hold the lane
  const [nux, nuy] = DIRS[v.dir];
  if (nux) v.y += (laneCoord(v.dir, lineOf(v.y)) - v.y) * Math.min(1, dt * 6);
  else v.x += (laneCoord(v.dir, lineOf(v.x)) - v.x) * Math.min(1, dt * 6);
  v.x += nux * v.speed * dt; v.y += nuy * v.speed * dt;
  // wrap protection: off the map -> turn around
  if (v.x < 0.3 || v.y < 0.3 || v.x > w.size - 0.3 || v.y > w.size - 0.3) {
    // should never happen (turns are forced at the edge), but if it does: U-turn into the correct lane
    v.dir = (v.dir + 2) % 4; v.nextDir = -1;
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
