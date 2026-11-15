import type { Simulation } from './Simulation';
import type { Vehicle } from '../entities/types';
import { T } from '../world/World';
import { handlingProfile } from './VehicleHandling';
import { vehicleGeometry } from './VehicleGeometry';
import { utilityDynamics } from './VehicleUtility';
import { SAND, LOAM, soilContact, magicForce, frictionEllipse, relaxForce, vonMises } from '../physics/Continuum';

export interface ContactMemory { lateral: number; temperature: number }
export interface ContinuumVehicle { contacts: ContactMemory[]; heatJ: number }
export const metresPerTile = (sim: Simulation) => sim.world.mapped?.metresPerTile ?? 2;

/** Four patch quadrature with static normal loads; no vertical suspension DOFs exist in this engine. */
function patches(v: Vehicle, visit: (x: number, y: number, i: number, load: number) => void): void {
  const g = vehicleGeometry(v), two = handlingProfile(v.cls).twoWheeler, c = Math.cos(v.heading), s = Math.sin(v.heading);
  const count = two ? 2 : 4, load = utilityDynamics(v).mass * 1000 * 9.81 / count;
  for (let i = 0; i < count; i++) {
    const along = (i < count / 2 ? 1 : -1) * g.wheelbase / 2;
    const across = two ? 0 : (i % 2 ? 1 : -1) * g.width * .43;
    visit(v.x + along*c-across*s, v.y+along*s+across*c, i, load);
  }
}

/** Resistance acceleration in game units, derived from SI compaction work rather than a friction constant. */
export function terrainResistance(sim: Simulation, v: Vehicle, speed: number, dt: number): number {
  let force = 0;
  const field = sim.world.continuum, scale = metresPerTile(sim);
  patches(v, (x, y, _i, load) => {
    const tile = sim.world.tile(Math.floor(x), Math.floor(y));
    if (tile !== T.SAND && tile !== T.GRASS && tile !== T.PATH) return;
    const old = field.peek(x, y), soil = tile === T.SAND ? SAND : LOAM;
    // Plastic hardening: compacted soil supports greater pressure on subsequent passes.
    const hardened = { ...soil, kphi: soil.kphi * (1 + (old?.compaction ?? 0) * 8) };
    const contact = soilContact(hardened, load, .22, .18, Math.abs(v.slip ?? 0) * scale * dt);
    force += contact.compaction + contact.bulldozing;
    if (Math.abs(speed) > .01) field.rut(x, y, contact.sinkage, dt);
  });
  return force / (utilityDynamics(v).mass * 1000 * scale);
}

/** Drag evaluated against the local air momentum reservoir; equal opposite impulse is deposited in the wake. */
export function aerodynamicStep(sim: Simulation, v: Vehicle, vx: number, vy: number, dt: number): { x: number; y: number } {
  const scale = metresPerTile(sim), g = vehicleGeometry(v), mass = utilityDynamics(v).mass * 1000;
  const wx=v.x-Math.cos(v.heading)*g.length*.5,wy=v.y-Math.sin(v.heading)*g.length*.5;
  const wind = sim.world.continuum.wind(wx, wy, scale), ux = vx*scale-wind.x, uy = vy*scale-wind.y;
  const speed = Math.hypot(ux, uy), area = g.width*g.height*scale*scale;
  // Implicit quadratic drag against a frozen reservoir prevents overshoot at large relative velocity.
  const airMass=1.225*scale*scale*2;
  const k = .5*1.225*.32*area*speed, fraction = k*dt/(mass+k*dt*(1+mass/airMass));
  const dx = -ux*fraction/scale, dy = -uy*fraction/scale;
  const cell = sim.world.continuum.touch(wx,wy);
  if (cell) { cell.px -= mass*dx*scale; cell.py -= mass*dy*scale; }
  return { x: vx+dx, y: vy+dy };
}

/** Returns lateral acceleration. Longitudinal demand comes from the existing engine/brake controller. */
export function contactStep(sim: Simulation, v: Vehicle, lon: number, lat: number, longitudinal: number, lateralLimit: number, dt: number): {lateral:number;longitudinal:number} {
  const state = v.continuum ??= { contacts: [], heatJ: 0 }, scale = metresPerTile(sim), field = sim.world.continuum;
  const mass = utilityDynamics(v).mass * 1000, two = handlingProfile(v.cls).twoWheeler, count = two ? 2 : 4;
  let force = 0, longForce = 0;
  patches(v, (x, y, i, load) => {
    const memory = state.contacts[i] ??= { lateral: 0, temperature: 293.15 };
    const wheelIndex = two ? i*2 : i, wheel = v.components?.wheels[wheelIndex];
    if (wheel?.missing) { memory.lateral = 0; return; }
    const thermalGrip = Math.max(.5, 1 - Math.max(0, memory.temperature-373.15)*.004);
    let limit = lateralLimit*mass*scale/count*thermalGrip;
    const tile = sim.world.tile(Math.floor(x), Math.floor(y));
    if (tile === T.SAND || tile === T.GRASS || tile === T.PATH) {
      // Material travels through a patch for l/|vx| seconds: j = v_slide * residence time.
      const shear = Math.hypot(lat*scale, (v.wheelspin??0)*scale*.1, Math.abs(longitudinal)*scale*.08)*.18/Math.max(.1, Math.abs(lon)*scale);
      limit = Math.min(limit, soilContact(tile === T.SAND ? SAND : LOAM, load, .22, .18, shear).shearForce);
    }
    const alpha = Math.atan2(lat, Math.max(.4, Math.abs(lon)));
    memory.lateral = relaxForce(memory.lateral, -magicForce(alpha, limit), lon*scale, .25, dt);
    // Re-project after relaxation: stored carcass forces cannot exceed a suddenly wet/low-load patch.
    const demand = longitudinal*mass*scale/count;
    const f = frictionEllipse(demand, memory.lateral, Math.max(limit, .001), Math.max(limit, .001));
    // At very low speed the existing solver's stopping constraint bounds a dissipative patch force.
    const fy = lat === 0 ? 0 : -Math.sign(lat)*Math.min(Math.abs(f.fy), Math.abs(lat)*mass*scale/(count*dt));
    force += fy;
    longForce += f.fx;
    const slide = Math.abs(lat)*scale, rollingSlip = (v.wheelspin??0)*scale*.1;
    const q = (Math.abs(fy)*slide + Math.abs(f.fx)*rollingSlip)*dt;
    state.heatJ += q;
    // Half into a 4 kg rubber thermal reservoir, half into the surface; cooling is analytic.
    memory.temperature = 293.15 + (memory.temperature-293.15)*Math.exp(-dt*.08) + .5*q/(4*1800);
    field.heat(x, y, .5*q, tile === T.ROAD || tile === T.STREET ? q*1e-10 : 0);
    const c = field.touch(x,y);
    if (c) {
      const heading = v.heading;
      c.supportX -= (Math.cos(heading)*f.fx-Math.sin(heading)*fy)*dt;
      c.supportY -= (Math.sin(heading)*f.fx+Math.cos(heading)*fy)*dt;
    }
  });
  return {lateral:force/(mass*scale),longitudinal:longForce/(mass*scale)};
}

/** Reaction ledger for a fixed-world contact. This consumes collision loss; it does not apply another impulse. */
export function structuralImpact(sim: Simulation, x: number, y: number, ix: number, iy: number, energy: number, duration: number): void {
  const c = sim.world.continuum.touch(x, y); if (!c) return;
  c.supportX += ix; c.supportY += iy;
  const area = .04, stress = Math.hypot(ix,iy)/(Math.max(1/240,duration)*area);
  const tile = sim.world.tile(Math.floor(x),Math.floor(y));
  // Uniaxial contact-stress proxy; a full structural solver must supply all six stress components.
  const yieldStress = tile === T.TREE || tile === T.FENCE ? 25e6 : 40e6;
  const yielded = vonMises(stress,0,0,0,0,0)>yieldStress;
  const loss = Math.max(0,energy), fracture = yielded ? loss*.35 : 0;
  c.fractureEnergy += fracture; c.damage = Math.min(1,c.damage+fracture/50000);
  c.heat += loss-fracture;
}
