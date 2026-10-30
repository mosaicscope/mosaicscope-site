import {stepWaterVehicle,waterDepth} from './WaterPhysics';
import {releaseBusPassengers} from './BusService';
import {stepDrivingTelemetry} from './DrivingTelemetry';
import {aerodynamicForces} from './VehicleAero';
import {drivingDynamics,wheelGrip,dynamicsEffects,stepDrivingDynamics} from './VehicleDynamics';
import {wheelContactControl} from './WheelContact';
import {partsEffects} from './VehicleParts';
import {arcadeDriving,powerEnvelope,damagePull,drivingTopSpeed} from './ArcadeDriving';
import {structuralDynamics,brakeThermals} from './VehicleStructure';
import {worldIndex} from '../world/WorldIndex';
import {hitFacade} from "./CivicDamage";
import {mappedDrivingLimit,advanceDistantTraffic,spawnMappedVehicles,driveMappedVehicle,snapMappedVehicle} from './MappedTraffic';
import { handlingProfile, roadSurfaceAt, slipGrip, corneringBudget, followingSpeed, temperatureGrip } from "./VehicleHandling";
import { vehicleIndex } from "./VehicleIndex";
import { vehicleGeometry, chassisContact, sweptChassisContact } from "./VehicleGeometry";
import { drivingSetup, stepPowertrain, stepDrift, coastResistance, manualGearLimit, driverAssists } from "./DrivingExperience";
import { utilityDynamics, stepUtility } from "./VehicleUtility";
import {junctionAvailable} from "./TrafficControl";
import { components, impactComponents, damageTick, damageParts, repairVehicle } from "./VehicleDamage";
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
/** The road line whose carriageway a cross-road coordinate is nearest (robust to being nudged off it). */
const roadOf = (c: number) => Math.max(0, Math.round((c - ROAD_W / 2) / P));
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
  if(w.mapped)return null; // surveyed crossings are not controlled by the former generated-grid signals
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

function plate(sim: Simulation): string {
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const ordinal=sim.vehicles.length+1;
  return L[sim.rng.int(0, L.length - 1)] + L[sim.rng.int(0, L.length - 1)] + L[sim.rng.int(0, L.length - 1)] + String(100 + ((ordinal * 37) % 900));
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
  const doors=v.components?.structure?.doors,partDoors=partsEffects(v).door;
  // A jammed door sends the driver out the other side; both jammed uses a rear escape.
  const right=Math.max(doors?.[1]??0,partDoors[1]),left=Math.max(doors?.[0]??0,partDoors[0]);
  const side = v.heading + (right>.6?(left>.6?Math.PI:-Math.PI/2):Math.PI/2);
  const p = waterDepth(sim.world,v.x,v.y)>0?{x:v.x+Math.cos(side)*.6,y:v.y+Math.sin(side)*.6}:sim.world.nearestWalkable(v.x + Math.cos(side) * 1.1, v.y + Math.sin(side) * 1.1);
  c.x = c.px = p.x; c.y = c.py = p.y; c.vx = c.vy = c.vz = c.kx = c.ky = c.z = 0; c.facing = v.heading;
  c.nextThink = sim.tick + 1;
  return c;
}

export function spawnVehicles(sim: Simulation): void {
  if(sim.world.mapped){spawnMappedVehicles(sim,makeVehicle);return;}
  const w = sim.world, rng = sim.rng;
  const parkingPool=Object.values(VEHICLES).filter(d=>d.traffic>0&&d.length<3.5&&d.width>.6&&d.cls!=='police'&&d.cls!=='ambulance').map(d=>d.cls);
  let parkingBag:VehicleClass[]=parkingPool.filter(id=>!!VEHICLES[id].design);const parkedClass=()=>{if(!parkingBag.length)parkingBag=[...parkingPool];return parkingBag.splice(rng.int(0,parkingBag.length-1),1)[0];};
  // traffic: drivers are real (background) people commuting
  const drivers = sim.chars.filter((c) => c.tier === "background" && c.inCar < 0);
  const traffic = Object.values(VEHICLES).filter((d) => d.traffic > 0);
  for (let i = 0; i < sim.cfg.trafficCars; i++) {
    const d = traffic[rng.weighted(traffic.map((t) => t.traffic))];
    const dir = rng.int(0, 3);
    const horizontal = dir % 2 === 0;
    const line = rng.int(0, w.maxLine), along = rng.range(3, w.size - 3), lane = rng.int(0, 1);
    // keep spawns out of intersections and off the crossings
    const m = along % P, a = along - m + clamp(m, ROAD_W + CROSS_W + 4, P - CROSS_W - 4); // mid-block, room to brake
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
    let cls: VehicleClass = parkedClass();
    if (area.kind === "police") cls = "police";
    else if (area.kind === "hospital") cls = "ambulance";
    else if (area.kind === "dealership") cls = rng.pick(FOR_SALE);
    else if (area.kind === "casino") cls = rng.pick(["seven", "mercs", "supra", "mustang", "nsx", "corvette", "camry", "crown", "cxfive", "navara"] as VehicleClass[]);
    const v = makeVehicle(sim, cls, x + 0.5, y + 1, 1, "parked");
    if (area.kind === "dealership") { v.forSale = true; v.owner = -2; v.color = rng.pick(VEHICLES[cls].colors); }
  }
}

const tmp: number[] = [];

/** Refresh only untouched, unowned background parking in older saves. Owned or damaged assemblies keep their history. */
export function refreshAmbientFleet(sim:Simulation):void{
 const pool=Object.values(VEHICLES).filter(d=>d.design&&d.width>.6&&d.length<2.8&&d.traffic>0);
 for(const v of sim.vehicles){if(v.state!=='parked'||v.driver>=0||v.owner>=0||v.forSale||v.components||v.damage>0||v.lifeMods?.length||VEHICLES[v.cls].design||['police','ambulance','fire','tow','bus','bin'].includes(v.cls))continue;const hash=[...v.plate].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,v.id),d=pool[hash%pool.length];v.cls=d.cls;v.color=d.colors[hash%d.colors.length];}
}

const frameScratch=new WeakMap<Simulation,{previous:Float64Array;fleet:Vehicle[]}>();
export function updateVehicles(sim: Simulation, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if(sim.world.mapped)advanceDistantTraffic(sim);
  const count=sim.vehicles.length;let scratch=frameScratch.get(sim);
  if(!scratch){scratch={previous:new Float64Array(Math.max(32,count*2)),fleet:[]};frameScratch.set(sim,scratch);}
  if(scratch.previous.length<count*2)scratch.previous=new Float64Array(Math.max(count*2,scratch.previous.length*2));
  const previous=scratch.previous,fleet=sim.world.mapped?scratch.fleet:sim.vehicles;if(sim.world.mapped)fleet.length=0;
  for(let i=0;i<count;i++){const v=sim.vehicles[i];previous[i*2]=v.x;previous[i*2+1]=v.y;
    if(!sim.world.mapped)continue;
    if(v.driver===sim.playerId||v.state==='free'||v.state==='crashed'||v.rescueTarget!==undefined||(v.x-sim.focus.x)**2+(v.y-sim.focus.y)**2<sim.trafficRadius*sim.trafficRadius)fleet.push(v);
    else{v.px=v.x;v.py=v.y;v.speed=0;v.vx=v.vy=0;}
  }
  // Bound hitch catch-up work and resolve fast contacts at 120 Hz, independently of rendering.
  const hz=sim.vehicles.some(v=>v.state==='free'||v.state==='crashed')?120:60;
  const elapsed = Math.min(dt, 0.25), steps = Math.ceil(elapsed * hz), step = elapsed / steps;
  for (let i = 0; i < steps; i++) stepVehicles(sim, step,fleet);
  // Other systems (props, interpolation) need the full frame sweep, not only the last substep.
  sim.vehicles.forEach((v, i) => {
    if (i<count) { v.px = previous[i*2]; v.py = previous[i*2+1]; }
    const driver=sim.chars[v.driver];
    if(driver){driver.x=v.x;driver.y=v.y;driver.px=v.px;driver.py=v.py;driver.facing=v.heading;}
  });
}

const nearby: Vehicle[] = [], collisionCandidates: Vehicle[] = [], recoveryCandidates: Vehicle[] = [];
function stepVehicles(sim: Simulation, dt: number,fleet=sim.vehicles): void {
  vehicleIndex(sim).rebuild(fleet);
  for (const v of fleet) {
    v.px = v.x; v.py = v.y;
    if(v.state!=="free") {
      v.wheelTravel=(v.wheelTravel??0)+v.speed*dt;
      v.bodyRoll=(v.bodyRoll??0)*Math.exp(-dt*7);v.bodyPitch=(v.bodyPitch??0)*Math.exp(-dt*7);
      v.tyreHeat=Math.max(0,(v.tyreHeat??0)-dt*.22);
    }
    damageTick(v, dt);stepWaterVehicle(sim,v,dt);
    if (v.burning || v.burnt || ((v.engineDamage ?? 0) > 0.8 || v.flatLeft || v.flatRight) && v.driver !== sim.playerId) {
      releaseBusPassengers(sim,v);if (v.driver >= 0) unseat(sim, v);
      v.state = "parked"; v.speed = 0; v.vx = 0; v.vy = 0;
      if (!v.towAt) v.towAt = sim.tick + 3600;
      if (sim.tick >= v.towAt && v.owner !== sim.playerId) { const park = sim.world.buildings.find(b => b.kind === "garage"); if (park) { v.x = park.door.x + 1; v.y = park.door.y + 1; } repairVehicle(v); v.towAt = undefined; }
      continue;
    }
    if (v.state === "parked") {releaseBusPassengers(sim,v);v.braking=false;if(waterDepth(sim.world,v.x,v.y)>0){const x=v.x+(v.vx??0)*dt,y=v.y+(v.vy??0)*dt;if(waterDepth(sim.world,x,y)>0){v.x=x;v.y=y;}}continue;}
    if (v.state === "crashed") {
      slide(sim, v, dt);
      if (sim.tick > v.crashedUntil) v.state = v.driver === sim.playerId ? "free" : v.driver >= 0 ? (snapToLane(sim, v) ? "drive" : "free") : "parked";
      continue;
    }
    if (v.state === "drive") {const before=v.speed;if(sim.world.mapped)driveMappedVehicle(sim,v,dt);else laneDrive(sim, v, dt);v.braking=v.speed<before-.01;}
    else freeDrive(sim, v, dt);
    if(v.state==='drive'){v.vx=(v.x-v.px)/dt;v.vy=(v.y-v.py)/dt;v.dynT=sim.tick;}
    // keep the driver with the car
    if (v.driver >= 0) { const c = sim.chars[v.driver]; if (c) { c.x = v.x; c.y = v.y; c.px = v.px; c.py = v.py; c.facing = v.heading; } }
  }
  vehicleIndex(sim).rebuild(fleet, true);
  collisions(sim,fleet);
}

/** Inputs for free-driving cars (player or joyrider). */
export interface DriveInput { throttle: number; steer: number; brake: boolean; serviceBrake?: number }
export const playerInput: DriveInput = { throttle: 0, steer: 0, brake: false };

/** World velocity of a car: its free-body velocity when that is live, else straight along the heading. */
export function carVel(sim: Simulation, v: Vehicle): { x: number; y: number } {
  if (v.vx !== undefined && v.vy !== undefined && v.dynT !== undefined && sim.tick - v.dynT <= 1) return { x: v.vx, y: v.vy };
  return { x: Math.cos(v.heading) * v.speed, y: Math.sin(v.heading) * v.speed };
}

/** Tyre grip in tiles/s² of sideways acceleration before the car starts to slide. */
function tyreGrip(sim: Simulation, v: Vehicle, surfaces?:number[], roughness?:number[]): number {
  const d = VEHICLES[v.cls];
  const profile = handlingProfile(v.cls), geometry = vehicleGeometry(v), c = Math.cos(v.heading), s = Math.sin(v.heading);
  let surfaceGrip = 0;
  // Each contact patch sees its own surface, including when straddling a verge.
  for (let i = 0; i < 4; i++) {
    if(profile.twoWheeler && i%2) continue;
    const x = (i < 2 ? 1 : -1) * geometry.wheelbase / 2, y = profile.twoWheeler ? 0 : (i % 2 ? 1 : -1) * (geometry.width/2-0.02);
    const wheel = v.components?.wheels[i];
    const condition = wheel ? wheel.missing ? 0 : (wheel.puncture ? 0.55 : 1)*(1-wheel.suspension*0.25-wheel.rim*0.1)*(0.45+0.55*(wheel.attachment??1)) : (i%2 === 0 ? v.flatLeft : v.flatRight) ? 0.55 : 1;
    const contactSurface=roadSurfaceAt(sim.world,v.x+x*c-y*s,v.y+x*s+y*c,sim.env.rain,profile.offroad),surface=contactSurface.grip;
    if(surfaces)surfaces[i]=surface;if(roughness)roughness[i]=contactSurface.loose?1:0;
    const footprint=contactSurface.loose?1+.45*(1-(v.dynamics?.wheels[i]?.pressure??1)):1;
    surfaceGrip += surface * condition * wheelGrip(v,i) * footprint * (v.dynamics?.wheels[i]?.load??.25) * (profile.twoWheeler?2:1);
  }
  return d.grip * 2.5 * surfaceGrip * utilityDynamics(v).grip * temperatureGrip(v.tyreHeat ?? 0) * (v.lifeMods?.includes("Racing tyres") ? 1.3 : 1) / (v.lifeMods?.includes("Double deck") ? 1.2 : 1) * (1 - Math.max(0,v.damage-.35) * 0.16);
}

/**
 * Free driving as a simple tyre model: the car has a real velocity that is separate from where it points.
 * Throttle fades out toward top speed; rolling resistance and air drag slow it when coasting. Steering asks for a
 * yaw rate (from a bicycle model, softened at speed); the tyres can only push sideways up to their grip, so asking
 * for more than that makes the car slide: understeer when the front gives up, a drift when braking or (in tail-happy
 * cars) flooring it mid-corner unloads the rear. Rain and damage cost grip. Sliding scrubs speed and leaves marks.
 */
function freeDrive(sim: Simulation, v: Vehicle, dt: number): void {
  const d = VEHICLES[v.cls];
  const inp = v.parkingBrake?{throttle:0,steer:0,brake:true}:v.driver === sim.playerId ? playerInput : { throttle: 0, steer: 0, brake: true };
  const setup=drivingSetup(v),aids=driverAssists(v);
  drivingDynamics(v);
  const working=utilityDynamics(v),structural=structuralDynamics(v),parts=partsEffects(v),dynamic=dynamicsEffects(v);
  const roadLimit=mappedDrivingLimit(sim,v);
  const arcade=arcadeDriving(v,roadLimit);
  const top=drivingTopSpeed(v,arcade.top,setup.range);
  const vel = carVel(sim, v);
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  let lon = vel.x * fx + vel.y * fy, lat = -vel.x * fy + vel.y * fx;
  const s = Math.abs(lon);
  const surfaces=[1,1,1,1],roughness=[0,0,0,0],aero=aerodynamicForces(v,lon,top);
  const grip = tyreGrip(sim, v,surfaces,roughness)*structural.grip*parts.grip*aero.load;
  const profile = handlingProfile(v.cls);
  const geometry = vehicleGeometry(v);
  const surface = roadSurfaceAt(sim.world,v.x,v.y,sim.env.rain,profile.offroad);
  // Pedal response builds torque smoothly; braking always responds immediately.
  const pedal = v.water?.locked?0:clamp(inp.throttle, -1, 1);
  const serviceBrake=clamp(inp.serviceBrake??0,0,1);
  const braking = inp.brake || serviceBrake>0 || pedal < 0 && lon > 0.05 || pedal > 0 && lon < -0.05;
  v.braking=braking;
  const previousThrottle = v.dynT !== undefined && sim.tick - v.dynT <= 1 && (v.driveThrottle ?? 0) * pedal >= 0 ? v.driveThrottle ?? 0 : 0;
  const targetThrottle = braking ? 0 : pedal;
  v.driveThrottle = previousThrottle + (targetThrottle - previousThrottle) * (1 - Math.exp(-dt * (targetThrottle === 0 ? 16 : setup.response)));
  const throttle = inp.brake||serviceBrake>0?0:braking?pedal:v.driveThrottle;
  const transmission=stepPowertrain(v,lon,top,throttle,dt);
  if (v.flatLeft !== v.flatRight) v.heading += (v.flatLeft ? -1 : 1) * Math.min(s, 5) * dt * 0.025;

  // ---- along the car: engine, brakes, rolling resistance, aero drag ----
  let a = 0;
  // Space is the handbrake: it locks the rear wheels, so it slows you less than full brakes but lets the tail go
  if (inp.brake) a = -Math.sign(lon) * d.brake * (s > 2 ? 0.5 : 1);
  else if(serviceBrake>0)a=-Math.sign(lon)*d.brake*serviceBrake;
  else if (throttle > 0) a = lon < -0.05 ? d.brake * throttle : d.accel * arcade.launch * throttle * powerEnvelope(lon,manualGearLimit(v,top));
  else if (throttle < 0) a = lon > 0.05 ? -d.brake * -throttle : -d.accel * .75 * -throttle * powerEnvelope(lon,Math.min(4.2,top*.35));
  if(braking&&s>2&&!v.components)components(v);
  brakeThermals(v,s,braking?Math.max(serviceBrake,Math.abs(pedal),inp.brake?.5:0):0,dt);
  if(braking) a*=working.braking*structural.braking*parts.braking*dynamic.braking;
  const engineForce = a * Math.max(.18,1-Math.max(0,(v.engineDamage??0)-.15)*1.05) * transmission * setup.torque * working.acceleration * structural.power * parts.power;
  // Acceleration shifts load rearward; AWD can use both axles, FWD unloads its driven tyres.
  const transfer = clamp(engineForce * geometry.height * 0.45 / (4.905 * geometry.wheelbase), -0.22, 0.22);
  const drivenLoad = profile.drive === "awd" ? 1 : profile.drive === "rwd" ? 0.64 + transfer : Math.max(arcade.frontLoad,0.7 - transfer);
  const demand=braking?Math.max(serviceBrake,Math.abs(pedal),inp.brake?.5:0):0;
  const contacts=wheelContactControl(v,surfaces,lon,v.yaw??0,braking?0:engineForce/Math.max(.25,grip),demand,!!inp.brake,aids.abs,geometry.width,dt,roughness,aids.traction);
  const surfaceMean=Math.max(.15,profile.twoWheeler?(surfaces[0]+surfaces[2])*.5:(surfaces[0]+surfaces[1]+surfaces[2]+surfaces[3])*.25);
  const axleFactor=clamp(contacts.driveGrip/surfaceMean,.7,1.05);
  const traction = grip * Math.max(0.25, drivenLoad) * dynamic.differential * axleFactor;
  const spin = (!braking ? Math.max(0, Math.abs(engineForce) - traction) : 0)*(aids.traction?0.08:1);
  v.wheelspin = spin;
  if (!braking) a = clamp(engineForce*(1-(aids.traction?contacts.traction*.1:0)), -traction, traction);
  else {
    // Leave front-tyre capacity for steering under ordinary braking (ABS/ESC in Road mode).
    const locked=profile.twoWheeler?(contacts.wheels[0].lock+contacts.wheels[2].lock)/2:contacts.wheels.reduce((n,w)=>n+w.lock,0)/4;
    const brakeGrip=grip*(1-locked*.18)*clamp(contacts.brakeGrip/surfaceMean,.7,1.05)*(aids.abs&&!inp.brake?1-.18*Math.min(1,Math.abs(inp.steer)):1);
    a=clamp(a*contacts.brakeEffect,-brakeGrip,brakeGrip);
  }
  const wheelDrag = (v.components?.wheels.reduce((n,w)=>n+(w.missing?0.9:w.puncture?0.3:0)+w.rim*0.12+Math.max(0,.65-(w.attachment??1))*.6,0) ?? (v.flatLeft?0.3:0)+(v.flatRight?0.3:0));
  const regen=coastResistance(v,lon,pedal,braking);
  const resist = 0.25 + regen + surface.drag + wheelDrag + structural.drag + parts.drag + dynamic.drag + (pedal===0?working.engineDrag:0) + aero.drag;
  if (braking || a === 0) {
    // brakes and drag can stop the car but never push it backwards
    const dec = Math.abs(a) + resist;
    lon = Math.abs(lon) <= dec * dt ? 0 : lon - Math.sign(lon) * dec * dt;
  } else {
    lon += a * dt;
    lon = Math.sign(lon) * Math.max(0, Math.abs(lon) - resist * dt);
  }

  // ---- turning: yaw toward what the steering asks, capped by what the tyres can hold ----
  // how loose the rear is: a locked handbrake, or (tail-happy cars) too much throttle while turning
  const powerOver = profile.drive !== "fwd" && throttle > 0 && lon > 1 ? throttle * Math.min(1, s / 5) * Math.min(1, Math.abs(v.steerAngle ?? 0) / 0.3) * setup.rearSlip * (profile.drive==='awd'?0.4:1) : 0;
  const rearSurfaceLoss=Math.max(0,contacts.frontGrip/1.08-contacts.rearGrip/.92);
  const rearLoose = clamp((inp.brake ? clamp((s - 1) / 2, 0, 1) : powerOver)+rearSurfaceLoss*.3,0,1.3);
  const wheelDamage=v.components?.wheels??[],loss=wheelDamage.reduce((n,w)=>n+(w.missing?.35:w.puncture?.1:0)+w.suspension*.05+Math.max(0,.65-(w.attachment??1))*.12,0);
  const steering=clamp(inp.steer,-1,1);
  const countersteering = steering * (v.steerAngle ?? 0) < 0;
  const steerResponse = (countersteering ? 16 : steering === 0 ? 13 : 11) * arcade.steerResponse * working.turnResponse * parts.steering * dynamic.steering / (1 + s / top * 0.35);
  v.steerAngle=(v.steerAngle??0)+(steering*.55-(v.steerAngle??0))*(1-Math.exp(-dt*steerResponse));
  const wheelbase = geometry.wheelbase;
  let lock = 0.68 * setup.steer * working.steering * structural.steer * (1 - 0.55 * Math.min(1, s / top));
  // Road/Trail assist scales steering lock to the available tyre force at speed.
  if(aids.stability&&!inp.brake)lock=Math.min(lock,Math.atan(grip*wheelbase*.95/Math.max(1,s*s)));
  // a bent side (wheel knocked out of line) drags the car toward it
  const bent=damagePull(v,s,structural.pull)+dynamic.pull+parts.steeringPull+aero.pull+(braking?structural.brakePull+dynamic.brakePull+parts.brakePull+contacts.splitPull:0);
  v.wheelSteer = (v.steerAngle??0)/.55 * lock;
  const want = lon * Math.tan(v.wheelSteer + bent) / wheelbase;
  const cap = (grip * (1 + 1.2 * rearLoose)) / Math.max(s, 1);   // a loose rear lets the nose swing past the grip line
  const axleBalance=clamp(contacts.frontGrip/Math.max(.2,contacts.rearGrip),.65,1.25);
  const frontPush = (profile.drive === "fwd" ? 1 / (1 + spin * 0.15) : 1)*Math.min(1,axleBalance);
  // Road mode catches a developing spin; Drift mode retains the full rear-slip envelope.
  const stability = aids.stability && !inp.brake ? clamp(Math.atan2(lat, Math.max(1,s)) * Math.sign(lon), -.35, .35) * 1.4 : 0;
  const yawError=(v.yaw??0)-want,stabilityActive=aids.stability&&!inp.brake&&s>3&&Math.abs(yawError)>Math.max(.2,cap*.8);
  v.stabilityActive=stabilityActive;
  const yawWant = clamp(want * frontPush + stability-(stabilityActive?clamp(yawError,-cap,cap)*.15:0), -cap, cap);
  const inertiaResponse = clamp(2 / geometry.wheelbase, .6, 1.5);
  v.yaw = (v.yaw ?? 0) + (yawWant - (v.yaw ?? 0)) * (1 - Math.exp(-dt * (4.5 + grip * 0.8) * inertiaResponse * working.turnResponse));
  if(Math.hypot(lon,lat)<.04)v.yaw=0;
  v.heading += v.yaw * dt;
  // the body turned under the velocity: re-express it in the new frame, then let the tyres fight the sideways part
  const nfx = Math.cos(v.heading), nfy = Math.sin(v.heading);
  const vxW = fx * lon - fy * lat, vyW = fy * lon + fx * lat;
  lon = vxW * nfx + vyW * nfy; lat = -vxW * nfy + vyW * nfx;
  // Acceleration and cornering share the tyre's traction budget.
  const slipAngle = Math.atan2(lat, Math.max(0.8, Math.abs(lon)));
  const loadSensitivity = 1 - Math.min(0.18, Math.abs(v.yaw * lon) * profile.cg / Math.max(1, d.width) * 0.025);
  const latGrip = corneringBudget(grip, inp.brake ? a * 0.35 : a) * slipGrip(slipAngle) * loadSensitivity * (1 - 0.55 * rearLoose)*Math.max(.18,1-loss);
  const pull = clamp(lat * 14, -latGrip, latGrip);
  lat = Math.abs(lat) <= Math.abs(pull) * dt ? 0 : lat - pull * dt;
  if (Math.abs(lat) > 0.8) lon -= Math.sign(lon) * Math.min(Math.abs(lon), Math.abs(pull) * 0.18 * dt);     // sliding scrubs speed
  // Engine power fades at its speed limit; damage cannot instantly delete existing momentum.

  v.vx = nfx * lon - nfy * lat; v.vy = nfy * lon + nfx * lat; v.dynT = sim.tick;
  v.speed = lon; v.slip = lat;
  v.wheelTravel = (v.wheelTravel ?? 0) + lon * dt;
  v.wheelSpinTravel = (v.wheelSpinTravel ?? 0) + Math.sign(throttle)*spin*0.35*dt;
  const settle = 1-Math.exp(-dt*7);
  v.bodyRoll = (v.bodyRoll ?? 0) + (clamp(v.yaw*lon*geometry.height*0.018*working.roll/geometry.width+dynamic.roll,-0.12,0.12)-(v.bodyRoll ?? 0))*settle;
  v.bodyPitch = (v.bodyPitch ?? 0) + (clamp(a*geometry.height*0.025/geometry.wheelbase+dynamic.pitch,-0.08,0.08)-(v.bodyPitch ?? 0))*settle;
  const scrub = Math.abs(lat) * Math.min(1, s / 3) + spin * 0.5 + (inp.brake && s > 2 ? s * 0.25 : 0);
  v.tyreHeat = clamp((v.tyreHeat ?? 0) + (scrub * 0.16 - 0.22) * dt, 0, 1);
  stepDrivingDynamics(v,lon,lat,a,sim.env.rain,braking?Math.max(serviceBrake,Math.abs(pedal)):0,!!inp.brake,dt);
  if(working.active)stepUtility(v,a,(v.yaw??0)*lon,lon,braking,dt);
  skidMarks(sim, v, lat, inp.brake && s > 2 ? s : 0);
  const oldX=v.x,oldY=v.y;
  moveBlocked(sim, v, dt);
  if(v.driver===sim.playerId){const distance=Math.hypot(v.x-oldX,v.y-oldY);stepDrift(v,distance,dt);stepDrivingTelemetry(v,v.speed,distance,pedal,braking,dt);}
}

/**
 * Damage lands where the car was hit. (nx, ny) is the direction the blow came FROM, in world space; amount is the
 * share of the car's overall damage it caused. The body crumples there (renderer), a hit front knocks out a lamp and
 * then smokes, and a bent side drags the steering toward it.
 */
export function bump(v: Vehicle, nx: number, ny: number, amount: number): void {
  if(amount>.005&&v.drift){v.drift.points=0;v.drift.chain=0;v.drift.grace=0;}
  const c = Math.cos(v.heading), s = Math.sin(v.heading);
  const along = nx * c + ny * s, side = -nx * s + ny * c;
  const add = (cur: number | undefined, w: number) => Math.min(1, (cur ?? 0) + amount * w * 2.2);
  if (along > 0.35) v.dmgF = add(v.dmgF, along); else if (along < -0.35) v.dmgR = add(v.dmgR, -along);
  if (side > 0.35) v.dmgS = add(v.dmgS, side); else if (side < -0.35) v.dmgL = add(v.dmgL, -side);
  damageParts(v);
}

/** A crashed car keeps its momentum: it slides on locked tyres and spins down, it does not just stop. */
function slide(sim: Simulation, v: Vehicle, dt: number): void {
  const vel = carVel(sim, v);
  let sp = Math.hypot(vel.x, vel.y);
  const dec = tyreGrip(sim, v) * 0.8;
  const k = sp > 1e-4 ? Math.max(0, sp - dec * dt) / sp : 0;
  v.vx = vel.x * k; v.vy = vel.y * k; v.dynT = sim.tick; sp *= k;
  v.yaw = (v.yaw ?? 0) * Math.exp(-2.5 * dt);
  v.heading += v.yaw * dt;
  const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
  v.speed = v.vx * fx + v.vy * fy; v.slip = -v.vx * fy + v.vy * fx;
  skidMarks(sim, v, sp > 2 ? sp : 0, 0);
  moveBlocked(sim, v, dt);
}

/** When each person last dived out of the way, per simulation (so separate games and tests never share it). */
const dodges = new WeakMap<Simulation, Map<number, number>>();
/**
 * Someone standing in the path of a car that is coming on fast dives for the kerb, swears at the driver, and the
 * driver leans on the horn. Under half a second away is too late: that is a hit, not a dodge.
 */
function dodge(sim: Simulation, v: Vehicle, c: Character, gap: number, side: number, sp: number): void {
  if (sp < 3 || c.tier === "player" || c.phys !== Phys.OK || c.inCar >= 0) return;
  const tti = gap / sp;
  if (tti > 0.9 || tti < 0.12) return;
  let dodgedAt = dodges.get(sim);
  if (!dodgedAt) dodges.set(sim, dodgedAt = new Map());
  if ((dodgedAt.get(c.id) ?? -1e9) > sim.tick - 90) return;
  dodgedAt.set(c.id, sim.tick);
  // jump to whichever side of the car's path they're already on, toward the kerb if it's close
  const foot = sim.world.nearestFoot(c.x, c.y, 3), cos = Math.cos(v.heading), sin = Math.sin(v.heading);
  const fs = -(foot.x - c.x) * sin + (foot.y - c.y) * cos;
  const s = Math.abs(fs) > 0.2 ? Math.sign(fs) : Math.sign(side || 1);
  const jump = 3.2 + (1 - tti) * 2.5;
  c.kx += -sin * s * jump; c.ky += cos * s * jump; c.vz = Math.max(c.vz, 1.6);
  c.phys = Phys.STUMBLE; c.physTimer = 0.45;
  c.emo.fear = Math.min(1, c.emo.fear + 0.35);
  if (sim.tick > v.honkAt) { v.honkAt = sim.tick + 180; sim.bus.emit("sound", { kind: "horn", x: v.x, y: v.y, vol: 0.7 }); }
  const driver = v.driver >= 0 ? sim.chars[v.driver] : null;
  sim.say(c, driver && driver.tier === "player" ? "Oi! Watch where you're driving!" : sim.rng.pick(["Whoa!", "Oi! Slow down!", "Jesus, mate!", "Watch it!"]), "shout", 1.6);
  if (driver && c.tier !== "background") { const r = sim.relate(c, driver.id); r.grudge = Math.min(1, r.grudge + 0.15); }
}

/** A squealing skid turns heads: everyone close by looks at the car and gets a fright. */
function startle(sim: Simulation, v: Vehicle): void {
  const n = sim.charHash.query(v.x, v.y, 7, tmp);
  for (let i = 0; i < n; i++) {
    const c = sim.chars[tmp[i]];
    if (!c || c.inCar >= 0 || c.tier === "player" || c.phys !== Phys.OK) continue;
    c.facing = Math.atan2(v.y - c.y, v.x - c.x);
    c.emo.fear = Math.min(1, c.emo.fear + 0.08);
  }
}

/** Tyre marks and smoke while a car is sliding or locking its brakes (the renderer turns "skid" into marks). */
const skidTick = new WeakMap<Vehicle,number>();
function skidMarks(sim: Simulation, v: Vehicle, lat: number, lock: number): void {
  if ((sim.tick + v.id) % 4 !== 0) return;
  if(skidTick.get(v)===sim.tick)return;
  skidTick.set(v,sim.tick);
  const amt = Math.max(Math.abs(lat) - 0.65, lock > 0 ? 0.6 : 0, (v.wheelspin ?? 0)*0.5);
  const geometry = vehicleGeometry(v), profile = handlingProfile(v.cls), c = Math.cos(v.heading), s = Math.sin(v.heading);
  for (let i = 0; i < 4; i++) {
    if(profile.twoWheeler && i%2) continue;
    if (v.components?.wheels[i]?.missing) continue;
    const lx = (i < 2 ? 1 : -1)*geometry.wheelbase/2, ly = profile.twoWheeler ? 0 : (i%2 ? 1 : -1)*(geometry.width/2-0.02);
    const x=v.x+lx*c-ly*s, y=v.y+lx*s+ly*c;
    const surface = roadSurfaceAt(sim.world,x,y,sim.env.rain,profile.offroad);
    const powered = profile.drive === "awd" || (profile.drive === "fwd" ? i<2 : i>=2);
    const patchLock=v.contactControl?.wheels[i]?.lock??0;
    const scrub = Math.max(Math.abs(lat)-0.65, i>=2 && lock>0 ? 0.6 : 0, patchLock>.25?patchLock*.8:0, powered ? (v.wheelspin ?? 0)*0.5 : 0);
    if (surface.loose && Math.abs(v.speed)>1.5) {
      sim.bus.emit("fx",{kind:"dust",x,y,z:0.06,n:Math.min(3,1+Math.floor(scrub)),color:"#a59a83"});
    } else {
      if (scrub>0) sim.bus.emit("fx",{kind:"skid",x,y,z:0,n:1});
      if (sim.env.rain>0.25 && Math.abs(v.speed)>3) sim.bus.emit("fx",{kind:"spray",x,y,z:0.08,n:1,color:"rgba(190,207,217,.28)"});
      else if (scrub>0.3 && (v.tyreHeat ?? 0)>0.08) sim.bus.emit("fx",{kind:"tyre_smoke",x,y,z:0.12,n:Math.min(3,Math.ceil(scrub*(v.tyreHeat ?? 0))),color:"rgba(210,214,216,.24)"});
    }
  }
  if (amt>0 && (sim.tick + v.id) % 24 === 0) { sim.bus.emit("sound", { kind: "skid", x: v.x, y: v.y, vol: Math.min(1, amt / 4) }); startle(sim, v); }
}

/** Move with the car's velocity; solid tiles stop the car, bounce it back and dent it. */
function moveBlocked(sim: Simulation, v: Vehicle, dt: number): void {
  const d = { ...VEHICLES[v.cls], ...vehicleGeometry(v),mass:utilityDynamics(v).mass };
  const vel = carVel(sim, v);
  const nx = v.x + vel.x * dt, ny = v.y + vel.y * dt;
  if(sim.world.mapped){const ox=v.x,oy=v.y,px=v.px,py=v.py;v.px=ox;v.py=oy;v.x=nx;v.y=ny;const hit=sim.mappedDamage.contact([...worldIndex(sim.world).buildings.query(Math.min(ox,nx)-d.length-2,Math.min(oy,ny)-d.length-2,Math.max(ox,nx)+d.length+2,Math.max(oy,ny)+d.length+2)].flatMap(id=>{const b=worldIndex(sim.world).damage.get(id);return b?[b]:[];}),v,sim.tick/60,1);v.px=px;v.py=py;if(hit){if(hit.speed>1){sim.bus.emit('sound',{kind:'crash',x:v.x,y:v.y,vol:Math.min(1,hit.speed/10)});sim.bus.emit('fx',{kind:'dust',x:hit.x,y:hit.y,z:.3,n:Math.min(16,Math.ceil(hit.speed*2))});if(hit.damage?.opening&&hit.damage.at===sim.tick/60)sim.bus.emit('fx',{kind:'break',x:hit.x,y:hit.y,z:.7,n:Math.min(20,Math.ceil(hit.speed*1.5)),color:hit.damage.material==='brick'?'#a87962':hit.damage.material==='glass'?'#b7d5d2':'#aaa99b'});}return;}v.x=ox;v.y=oy;}
  const nowWater=sim.world.tile(Math.floor(nx),Math.floor(ny))===T.WATER,wasWater=sim.world.tile(Math.floor(v.x),Math.floor(v.y))===T.WATER;
  if(nowWater){const speed=Math.hypot(vel.x,vel.y);if(!wasWater||(sim.tick+v.id)%30===0&&speed>1)sim.liquids.disturb(nx,ny,speed);}
  const fx = nx + Math.cos(v.heading) * (d.length / 2) * Math.sign(v.speed || 1), fy = ny + Math.sin(v.heading) * (d.length / 2) * Math.sign(v.speed || 1);
  const side = v.heading + Math.PI / 2, hw = d.width / 2 * 0.9;
  const blocked = (x: number, y: number) => !sim.world.walkable(x, y) && sim.world.tile(Math.floor(x), Math.floor(y)) !== T.CRATE && sim.world.tile(Math.floor(x), Math.floor(y)) !== T.WATER && !(sim.world.mapped&&sim.world.tile(Math.floor(x),Math.floor(y))===T.BUILDING) || !sim.world.inBounds(Math.floor(x), Math.floor(y));
  // also probe the way the car is actually moving: a drifting or spinning car slides sideways into things too
  const ms = Math.hypot(vel.x, vel.y), mx = ms > 1e-3 ? vel.x / ms : 0, my = ms > 1e-3 ? vel.y / ms : 0;
  const contact=[[nx+mx*hw,ny+my*hw],[fx+Math.cos(side)*hw,fy+Math.sin(side)*hw],[fx-Math.cos(side)*hw,fy-Math.sin(side)*hw],[nx,ny]].find(([x,y])=>blocked(x,y));
  if (contact) {
    const tx=Math.floor(contact[0]),ty=Math.floor(contact[1]);let cx=nx<tx?1:nx>tx+1?-1:0,cy=ny<ty?1:ny>ty+1?-1:0;
    if(!cx&&!cy){cx=contact[0]-nx;cy=contact[1]-ny;}const length=Math.hypot(cx,cy)||1;cx/=length;cy/=length;
    const normalSpeed=vel.x*cx+vel.y*cy,hit=Math.abs(normalSpeed);
    if (hit > 1.2) {
      impactComponents(v,cx,cy,hit,d.mass,sim.tick,{x:contact[0],y:contact[1]});
      hitFacade(sim,v,contact[0],contact[1],hit);
      v.damage = Math.min(1, v.damage + hit * 0.015);
      bump(v,cx,cy,hit*.015);
      sim.bus.emit("sound", { kind: "crash", x: v.x, y: v.y, vol: Math.min(1, hit / 10) });
      sim.bus.emit("fx", { kind: "spark", x: fx, y: fy, z: 0.4, n: 8, color: "#f6b62c" });
    }
    if (v.vx !== undefined && v.vy !== undefined) { const inward=Math.max(0,normalSpeed);v.vx-=cx*inward*1.22;v.vy-=cy*inward*1.22;v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);const torque=(contact[0]-nx)*cy-(contact[1]-ny)*cx;v.yaw=(v.yaw??0)*.4+torque*inward/Math.max(1,d.mass*10); }else v.speed=-v.speed*.22;
    const inward=Math.max(0,normalSpeed),slideX=v.x+(vel.x-cx*inward)*dt,slideY=v.y+(vel.y-cy*inward)*dt;if(!blocked(slideX,slideY)){v.x=slideX;v.y=slideY;}
    v.stuck += dt;
    return;
  }
  v.x = nx; v.y = ny; v.stuck = Math.max(0, v.stuck - dt);
}

export function snapToLane(sim: Simulation, v: Vehicle): boolean {
  if(sim.world.mapped)return snapMappedVehicle(sim,v);
  const w = sim.world;
  // find a lane through a nearby road tile, aligned to the closest cardinal heading
  const dir = ((Math.round(v.heading / (Math.PI / 2)) % 4) + 4) % 4;
  const horizontal = dir % 2 === 0;
  const lineC = horizontal ? roadOf(v.y) : roadOf(v.x);
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
const laneChangedAt = new WeakMap<Vehicle, number>();
const obstacleWait = new WeakMap<Vehicle, number>();
/** The intersection a car has already picked its turn for (c * 64 + r). */
const decidedAt = new WeakMap<Vehicle, number>();
/** Forget lane and turn plans (after a car is teleported, towed or snapped back into traffic). */
export function clearLaneState(v: Vehicle): void { laneWant.delete(v); decidedAt.delete(v); laneChangedAt.delete(v); obstacleWait.delete(v); }

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
  const [ux, uy] = DIRS[v.dir], d = vehicleGeometry(v);
  const tc = laneCoord(v.dir, roadOf(crossCoord(v)), lane);
  for (const o of vehicleIndex(sim).query(v.x,v.y,24,nearby)) {
    if (o === v || o.state === "parked" && sim.world.tile(Math.floor(o.x), Math.floor(o.y)) === T.PARKING) continue;
    const rel = (o.x - v.x) * ux + (o.y - v.y) * uy, reach = (d.length + vehicleGeometry(o).length) / 2;
    // Reserve the target lane during the whole merge, including cars still between lane centres.
    if(o.state==='drive'&&o.dir===v.dir&&laneWant.get(o)===lane&&Math.abs(rel)<reach+2)return false;
    if (Math.abs((v.dir % 2 === 0 ? o.y : o.x) - tc) > 0.75) continue;
    if (rel > -(reach + 1.2 + Math.max(0, o.speed - v.speed) * 1.4) && rel < reach + 1.5 + Math.max(0,v.speed-o.speed)*.8) return false;
  }
  return true;
}

/** Turning right across oncoming traffic: is anything coming that has right of way? */
function oncomingConflict(sim: Simulation, v: Vehicle, c: number, r: number): boolean {
  const od = (v.dir + 2) % 4, [oux, ouy] = DIRS[od];
  const bx = c * P + ROAD_W / 2, by = r * P + ROAD_W / 2;
  for (const o of vehicleIndex(sim).query(bx,by,18,nearby)) {
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
  const w = sim.world, d = { ...VEHICLES[v.cls], ...vehicleGeometry(v) }, maxL = w.maxLine;
  const availableBrake = Math.max(.1,Math.min(d.brake, tyreGrip(sim,v)));
  const [ux, uy] = DIRS[v.dir];
  const tx = Math.floor(v.x), ty = Math.floor(v.y);
  const inX = w.isRoadLine(tx) && w.isRoadLine(ty);
  const pursuing = v.siren,fleeing=(v.evadingUntil??0)>sim.tick;
  let target = v.parkingBrake?0:Math.min(d.topSpeed, pursuing||fleeing ? d.topSpeed : CITY_SPEED) * (1 - v.damage * 0.5);
  /** fastest speed that still stops within `gap` tiles at a comfortable deceleration */
  const stopFor = (gap: number) => (gap <= 0.05 ? 0 : Math.sqrt(2 * availableBrake * 0.55 * gap));

  // the intersection we are in or approaching, and front bumper -> box distance
  const along = v.dir % 2 === 0 ? v.x : v.y, pos = v.dir === 0 || v.dir === 1;
  let ic = -1, ir = -1, dist = 99;
  if (inX) { ic = lineOf(tx); ir = lineOf(ty); dist = 0; }
  else {
    const L = pos ? Math.ceil(along / P) : Math.floor((along - ROAD_W) / P);
    if (L >= 0 && L <= maxL) {
      dist = (pos ? L * P - along : along - (L * P + ROAD_W)) - d.length / 2;
      const other = roadOf(crossCoord(v));
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
      else if(fleeing){const patrol=sim.vehicles[v.evadingFrom??-1];v.nextDir=opts.sort((a,b)=>{const A=DIRS[a],B=DIRS[b];return patrol?Math.hypot(v.x+B[0]*8-patrol.x,v.y+B[1]*8-patrol.y)-Math.hypot(v.x+A[0]*8-patrol.x,v.y+A[1]*8-patrol.y):0;})[0]??v.dir;}
      else if (pursuing && (v.driver >= 0 || v.rescueTarget!==undefined)) {
        // head toward the suspect
        const cop = sim.chars[v.driver], s = v.rescueTarget!==undefined?sim.chars[v.rescueTarget]:cop ? sim.chars[cop.pursuing] : undefined;
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
    const turnSpeed = Math.min(TURN_SPEED, Math.sqrt(tyreGrip(sim,v)*Math.max(.7,d.wheelbase)*.65));
    target = Math.min(target, inX ? turnSpeed : turnSpeed + Math.max(0, distStop) * 0.9);
  }

  // Leave the receiving lane clear before entering the box, rather than queueing across it.
  if(!inX&&ic>=0&&distStop>=-.1&&distStop<9&&!pursuing){
    const nd=v.nextDir>=0?v.nextDir:v.dir,[ex,ey]=DIRS[nd],lane=nd===v.dir?curLane:turnLane;
    const edge=(nd===0?ic*P+ROAD_W:nd===1?ir*P+ROAD_W:nd===2?ic*P:ir*P);
    const exitAlong=edge+(nd<2?1:-1)*(CROSS_W+d.length*.5+.8),exitCross=laneCoord(nd,nd%2===0?ir:ic,lane);
    const exitX=nd%2===0?exitAlong:exitCross,exitY=nd%2===0?exitCross:exitAlong;
    const blocked=vehicleIndex(sim).query(exitX,exitY,d.length+3,nearby).some(o=>{if(o===v||Math.abs(o.speed)>2)return false;const dx=o.x-exitX,dy=o.y-exitY;return Math.abs(dx*ex+dy*ey)<(d.length+vehicleGeometry(o).length)*.5+.6&&Math.abs(-dx*ey+dy*ex)<.7;});
    if(blocked)target=Math.min(target,stopFor(distStop-.15));
  }
  let holdPed = false;
  if (ic >= 0 && !pursuing) {
    // (a car that has crept onto the crossing but not into the junction still waits for green)
    if (!inX && (distStop > -0.4 || (v.speed < 1.5 && dist > -0.2))) {
      // traffic lights: stop at the line on red, and on amber when there is room to stop
      const l = lightGreenFor(v.dir, ic, ir, sim.tick);
      // amber or red: stop at the line if we still can; a car too close to stop (it committed on
      // amber) clears the junction instead of stopping on the crossing
      const brakeDist = (v.speed * v.speed) / (2 * availableBrake * 0.85);
      if ((l.amber || !l.green) && (brakeDist < distStop + 0.2 || v.speed < 1.5)) target = Math.min(target, stopFor(distStop - 0.15));
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
  if(!inX&&ic>=0&&distStop<3&&distStop>-.5&&target>.2&&lightGreenFor(v.dir,ic,ir,sim.tick).green&&!holdPed&&!junctionAvailable(sim,v,ic,ir,vehicleIndex(sim).query(ic*P+ROAD_W/2,ir*P+ROAD_W/2,10,nearby)))target=Math.min(target,stopFor(distStop-.2));
  // keep distance from cars ahead and anything crossing in front
  let leadGap = 99, leadSpeed = 99, staticObstacle = false;
  const lookAhead = Math.max(10,d.length/2+3+v.speed*v.speed/(2*Math.max(.1,availableBrake)));
  for (const o of vehicleIndex(sim).query(v.x+ux*lookAhead/2,v.y+uy*lookAhead/2,lookAhead/2+2,nearby)) {
    if (o === v || o.state === "parked" && w.tile(Math.floor(o.x), Math.floor(o.y)) === T.PARKING) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const ahead = dx * ux + dy * uy, lateral = Math.abs(dx * -uy + dy * ux);
    const hd = Math.abs(angDiff(o.heading, v.heading));
    // same lane ahead, or anything crossing/turning in front of us (not oncoming or side-by-side traffic)
    const crossing = ahead > 0 && ahead < 2.6 && lateral < 1.6 && hd > 0.5 && hd < 2.4;
    const otherGeometry=vehicleGeometry(o);
    const sameLane = ahead > 0 && ahead < lookAhead+otherGeometry.length/2 && lateral < (d.width+otherGeometry.width)/2+.04;
    if (crossing || sameLane) {
      const gap = ahead - (d.length + otherGeometry.length) / 2 - 0.4;
      const leaderSpeed=Math.max(0,Math.cos(o.heading)*o.speed*ux+Math.sin(o.heading)*o.speed*uy);
      target = Math.min(target, followingSpeed(gap, crossing?0:leaderSpeed, availableBrake*.75));
      if (sameLane && !crossing && gap < leadGap) { leadGap = gap; leadSpeed = Math.abs(o.speed); staticObstacle=o.state==='parked'||o.state==='crashed'; }
    }
  }
  // stuck behind something slow mid-block (a breakdown, someone parking)? overtake in the other lane
  const wait=staticObstacle&&leadGap<8?(obstacleWait.get(v)??0)+dt:0;
  obstacleWait.set(v,wait);
  const bypass=staticObstacle&&wait>.5;
  const canContinue=ic>=0&&validDirs(ic,ir,v.dir,maxL).includes(v.dir);
  if (!inX && (!turning||bypass&&canContinue) && distStop > 4+d.length*.3 && leadGap < Math.max(6,v.speed*v.speed/(2*availableBrake)+1.5) && leadSpeed < 1.5 && want === curLane && sim.tick-(laneChangedAt.get(v)??-1000)>180 && laneClear(sim, v, 1 - curLane)) {
    want = 1 - curLane; laneChangedAt.set(v,sim.tick);
    if(turning)v.nextDir=v.dir; // Miss this turn and route around the incident on the next block.
  }
  laneWant.set(v, want);

  // pedestrians in front (look as far as the stopping distance): stop, and honk if they dawdle
  const look = d.length / 2 + 0.6 + (v.speed * v.speed) / (2 * Math.max(.1,availableBrake));
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
  v.speed += dv > 0 ? Math.min(dv, d.accel * dt) : Math.max(dv, -availableBrake * dt);
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
  const off = laneCoord(v.dir, roadOf(cc), lw) - cc;
  const latMax = dt * (Math.abs(off) > 0.3 ? 0.3 + 0.2 * v.speed : 3);
  const lat = clamp(off * Math.min(1, dt * 6), -latMax, latMax);
  if (nux) v.y += lat; else v.x += lat;
  // ease heading toward the lane direction, yawing a little into a lane change
  const latComp = nux ? lat * nux : lat * -nuy;
  const yaw = clamp(Math.atan2(latComp / Math.max(dt, 1e-4), Math.max(1, v.speed)), -0.35, 0.35);
  v.heading += angDiff(v.dir * Math.PI / 2 + yaw, v.heading) * Math.min(1, dt * 10);
  const advance=Math.min(v.speed*dt,Math.max(0,leadGap-.15));
  if(advance<v.speed*dt)v.speed=advance/Math.max(dt,.001);
  v.x += nux * advance; v.y += nuy * advance;
  // wrap protection: off the map -> turn around
  if (v.x < 0.3 || v.y < 0.3 || v.x > w.size - 0.3 || v.y > w.size - 0.3) {
    // should never happen (turns are forced at the edge), but if it does: U-turn into the correct lane
    v.dir = (v.dir + 2) % 4; v.nextDir = -1; clearLaneState(v);
    v.x = clamp(v.x, 0.5, w.size - 0.5); v.y = clamp(v.y, 0.5, w.size - 0.5);
    if (v.dir % 2 === 0) v.y = laneCoord(v.dir, roadOf(v.y)); else v.x = laneCoord(v.dir, roadOf(v.x));
    v.heading = v.dir * Math.PI / 2;
  }
}

/** Car footprint hits: people get knocked (fake blood at speed); cars crash into each other. */
function collisions(sim: Simulation,fleet=sim.vehicles): void {
  for (const v of fleet) {
    if (v.state === "parked") continue;
    const sp = Math.abs(v.speed);
    const d = vehicleGeometry(v);
    const n = sim.charHash.query(v.x, v.y, d.length / 2 + 0.6 + Math.min(4, sp * 0.45), tmp);
    const cos = Math.cos(v.heading), sin = Math.sin(v.heading);
    for (let i = 0; i < n; i++) {
      const c = sim.chars[tmp[i]];
      if (c.inCar >= 0 || c.inside >= 0 || c.id === v.driver) continue;
      // lane traffic never mounts the kerb; only free-driven cars can hit people on the footpath
      if (v.state === "drive" && !sim.world.drivable(c.x, c.y)) continue;
      const dx = c.x - v.x, dy = c.y - v.y;
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
      if (lx > d.length / 2 && Math.abs(ly) < d.width / 2 + 0.5) { dodge(sim, v, c, lx - d.length / 2, ly, sp); continue; }
      if (Math.abs(lx) > d.length / 2 + c.radius * 0.5 || Math.abs(ly) > d.width / 2 + c.radius * 0.5) continue;
      if (sp < 1.4) {
        // nudge people out of the way at walking pace
        const push = Math.sign(ly || 1) * 0.06; c.x += -sin * push; c.y += cos * push; continue;
      }
      sim.onCarHit(v, c, sp);
    }
  }
  const crashContacts=new Set<Vehicle>();
  const vs = fleet;
  for (let i = 0; i < vs.length; i++) {
    if(vs[i].state==="parked")continue;
    for (const b of vehicleIndex(sim).query(vs[i].x,vs[i].y,vehicleGeometry(vs[i]).radius+Math.hypot(vs[i].x-vs[i].px,vs[i].y-vs[i].py)+.5,collisionCandidates)) {
    const a = vs[i];
    if(a===b||b.state!=="parked"&&a.id>=b.id)continue;
    const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
    const ga=vehicleGeometry(a),gb=vehicleGeometry(b);
    const r = (ga.radius+gb.radius)+Math.hypot(a.x-a.px,a.y-a.py)+Math.hypot(b.x-b.px,b.y-b.py);
    if (dd > r * r) continue;
    let contact = chassisContact(a,b);
    if(!contact){
      const sweep=sweptChassisContact(a,b);
      if(sweep){
        // Stop at first touch, slightly inside the face so the same contact-point solver applies.
        const t=Math.min(1,sweep.t+1e-5);
        a.x=a.px+(a.x-a.px)*t;a.y=a.py+(a.y-a.py)*t;
        b.x=b.px+(b.x-b.px)*t;b.y=b.py+(b.y-b.py)*t;
        contact=chassisContact(a,b);
      }
    }
    if (!contact) continue;
    const ordinary=(v:Vehicle)=>v.state==='drive'&&!v.siren&&(v.evadingUntil??0)<=sim.tick;
    if(a.state==='drive'&&b.state==='drive'||ordinary(a)&&b.state==='parked'||ordinary(b)&&a.state==='parked'){
      // Normal drivers brake and yield; they do not enter the crash/sideways shove physics used for a player impact.
      const yieldCar=a.state==='parked'?b:b.state==='parked'?a:a.id>b.id?a:b;
      yieldCar.x=yieldCar.px;yieldCar.y=yieldCar.py;yieldCar.speed=0;yieldCar.vx=0;yieldCar.vy=0;yieldCar.nextDir=-1;
      // Recover overlapping lane cars from older saves without shoving them sideways into other lanes.
      if(bodiesTouch(a,b)){
        const bx=yieldCar.x,by=yieldCar.y,g=vehicleGeometry(yieldCar);
        vehicleIndex(sim).query(bx,by,6+g.radius,recoveryCandidates);
        for(let back=.25;back<=6;back+=.25){
          const x=bx-Math.cos(yieldCar.heading)*back,y=by-Math.sin(yieldCar.heading)*back;
          if(!sim.world.drivable(x,y))break;
          yieldCar.x=x;yieldCar.y=y;
          if(!recoveryCandidates.some(o=>o!==yieldCar&&bodiesTouch(yieldCar,o))){yieldCar.px=x;yieldCar.py=y;break;}
          yieldCar.x=bx;yieldCar.y=by;
        }
      }
      continue;
    }
    const va = carVel(sim, a), vb = carVel(sim, b);
    crashContacts.add(a);crashContacts.add(b);
    // A handbrake supplies tyre friction, not infinite mass. Hard impacts release parked bodies into the crash solver.
    if((va.x-vb.x)*contact.nx+(va.y-vb.y)*contact.ny>2.5)for(const v of [a,b])if(v.state==='parked'){v.state='crashed';v.crashedUntil=sim.tick+180;v.vx=0;v.vy=0;v.dynT=sim.tick;}
    const invA=a.state==='parked'?0:1/crashMass(a),invB=b.state==='parked'?0:1/crashMass(b);
    const push=contact.depth/(invA+invB);
    if (invA) { a.x -= contact.nx * push*invA; a.y -= contact.ny * push*invA; }
    if (invB) { b.x += contact.nx * push*invB; b.y += contact.ny * push*invB; }
    let nx=contact.nx,ny=contact.ny;
    // Old saves or spawned cars can already be deeply interpenetrating. Recover an incoming impact normal.
    const separation=Math.sqrt(dd);
    if (contact.depth>0.2 && Math.abs((va.x-vb.x)*nx+(va.y-vb.y)*ny)<0.01 && separation>0.01 && (va.x-vb.x)*dx+(va.y-vb.y)*dy>0) { nx=dx/separation;ny=dy/separation; }
    const closing = (va.x-vb.x)*nx+(va.y-vb.y)*ny;
    if (closing > 0) crashImpulse(sim, a, b, va, vb, nx, ny,contact.x,contact.y);
    if (closing > 2.5) sim.onCarCrash(a, b, closing,{x:contact.x,y:contact.y});
  }
  }
  settleCrashIsland(sim,crashContacts);
}

/** Bounded position iterations prevent a resolved pair being pushed into another wreck. No extra impact damage. */
export function settleCrashIsland(sim:Simulation,seeds:ReadonlySet<Vehicle>):void{
 if(!seeds.size)return;const island:Vehicle[]=[];const seen=new Set<Vehicle>();for(const seed of seeds){if(!seen.has(seed)){seen.add(seed);island.push(seed);}for(const v of vehicleIndex(sim).query(seed.x,seed.y,vehicleGeometry(seed).radius+4,recoveryCandidates)){if(!seen.has(v)&&island.length<32){seen.add(v);island.push(v);}}if(island.length>=32)break;}
 for(let pass=0;pass<8;pass++){let moved=false;for(let i=0;i<island.length;i++)for(let j=i+1;j<island.length;j++){const a=island[i],b=island[j],oldWrecks=a.state==='parked'&&b.state==='parked'&&(a.damage>0||b.damage>0||!!a.components?.dents?.length||!!b.components?.dents?.length);if(!oldWrecks&&!['free','crashed'].includes(a.state)&&!['free','crashed'].includes(b.state))continue;const contact=chassisContact(a,b);if(!contact||contact.depth<.001)continue;const ia=a.state==='parked'&&!oldWrecks?0:1/crashMass(a),ib=b.state==='parked'&&!oldWrecks?0:1/crashMass(b),total=ia+ib;if(!total)continue;const shift=(contact.depth+.001)/total*.9;a.x-=contact.nx*shift*ia;a.y-=contact.ny*shift*ia;b.x+=contact.nx*shift*ib;b.y+=contact.ny*shift*ib;moved=true;
 const va=carVel(sim,a),vb=carVel(sim,b),closing=(va.x-vb.x)*contact.nx+(va.y-vb.y)*contact.ny;if(closing>0){const impulse=closing/total;for(const [v,vel,inv,sign] of [[a,va,ia,-1],[b,vb,ib,1]] as const){if(!inv)continue;v.vx=vel.x+sign*contact.nx*impulse*inv;v.vy=vel.y+sign*contact.ny*impulse*inv;v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);v.dynT=sim.tick;}}
 }if(!moved)break;}
 // Keep seated drivers at the corrected chassis position during this substep.
 for(const v of island){const c=sim.chars[v.driver];if(c){c.x=v.x;c.y=v.y;}}
}

/**
 * Momentum exchange in a crash: an impulse along the line between the cars, shared by mass (a parked car has its
 * handbrake on, so it counts as much heavier), and an off-centre hit spins the car round.
 */
function crashMass(v:Vehicle):number{return utilityDynamics(v).mass*(1+(v.lifeMods?.length??0)*.08);}
function crashImpulse(sim: Simulation, a: Vehicle, b: Vehicle, va: { x: number; y: number }, vb: { x: number; y: number }, nx: number, ny: number, cx: number, cy: number): void {
  const ma = crashMass(a) * (a.state === "parked" ? 3 : 1), mb = crashMass(b) * (b.state === "parked" ? 3 : 1);
  const ga=vehicleGeometry(a),gb=vehicleGeometry(b);
  const avx=va.x-(a.yaw??0)*(cy-a.y),avy=va.y+(a.yaw??0)*(cx-a.x);
  const bvx=vb.x-(b.yaw??0)*(cy-b.y),bvy=vb.y+(b.yaw??0)*(cx-b.x);
  const vn=(bvx-avx)*nx+(bvy-avy)*ny;
  if (vn >= 0) return;
  const ra=(cx-a.x)*ny-(cy-a.y)*nx,rb=(cx-b.x)*ny-(cy-b.y)*nx;
  const ia=ma*(ga.length**2+ga.width**2)/12,ib=mb*(gb.length**2+gb.width**2)/12;
  const ima=a.state==='parked'?0:1/ma,imb=b.state==='parked'?0:1/mb;
  const iia=a.state==='parked'?0:1/ia,iib=b.state==='parked'?0:1/ib;
  // High-energy metal crushes rather than bouncing like rubber.
  const restitution=.08+.2*Math.exp(-Math.abs(vn)/5);
  const j = -(1 + restitution) * vn / (ima + imb + ra*ra*iia + rb*rb*iib);
  const tx=-ny,ty=nx,rta=(cx-a.x)*ty-(cy-a.y)*tx,rtb=(cx-b.x)*ty-(cy-b.y)*tx;
  const tangentSpeed=(bvx-avx)*tx+(bvy-avy)*ty;
  const friction=clamp(-tangentSpeed/(ima+imb+rta*rta*iia+rtb*rtb*iib),-j*.32,j*.32);
  const impulseX=nx*j+tx*friction,impulseY=ny*j+ty*friction;
  for (const [v, vel, m, sgn] of [[a, va, ma, -1], [b, vb, mb, 1]] as [Vehicle, { x: number; y: number }, number, number][]) {
    // The handbrake resists motion, not deformation: parked targets take component damage too.
    bump(v,-sgn*nx,-sgn*ny,Math.min(.4,j*.03/m));
    impactComponents(v,-sgn*nx,-sgn*ny,Math.min(Math.abs(vn),j/m),m,sim.tick,{x:cx,y:cy});
    if(v.state==='parked')continue;
    v.vx=vel.x+sgn*impulseX/m;v.vy=vel.y+sgn*impulseY/m;v.dynT=sim.tick;
    // the hit lands off the car's centre line: that lever arm turns into spin
    const geometry=vehicleGeometry(v),rx=cx-v.x,ry=cy-v.y;
    const inertia=m*(geometry.length**2+geometry.width**2)/12;
    v.yaw = clamp((v.yaw ?? 0) + sgn*(rx*impulseY-ry*impulseX)/inertia,-8,8);
    v.speed=v.vx*Math.cos(v.heading)+v.vy*Math.sin(v.heading);
    v.slip=-v.vx*Math.sin(v.heading)+v.vy*Math.cos(v.heading);
  }
}

/** Oriented chassis envelopes match the rendered body, including chassis modifications. */
function bodiesTouch(a: Vehicle, b: Vehicle): boolean {
  return chassisContact(a,b) !== null;
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
