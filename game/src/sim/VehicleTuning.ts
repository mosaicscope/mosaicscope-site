import type { Simulation } from "./Simulation";
import type { Vehicle } from "../entities/types";
import { TUNING_BY_ID, combine, NEUTRAL, type Fx } from "../content/tuning";

/** Installed upgrades per car (by plate, saved in worldFun.tuning), combined into the effects the car step reads. */
const cache = new WeakMap<Vehicle, { key: string; fx: Fx }>();
export const installed = (sim: Simulation, v: Vehicle): string[] => sim.worldFun.tuning?.[v.plate] ?? [];
export function tuningEffects(sim: Simulation, v: Vehicle): Fx {
  const ids = sim.worldFun.tuning?.[v.plate]; if (!ids?.length) return NEUTRAL;
  const key = ids.join(","), c = cache.get(v); if (c && c.key === key) return c.fx;
  const fx = combine(ids); cache.set(v, { key, fx }); return fx;
}
export function install(sim: Simulation, v: Vehicle, id: string): string {
  const t = TUNING_BY_ID.get(id), p = sim.player; if (!t) return "Unknown upgrade.";
  const list = (sim.worldFun.tuning ??= {})[v.plate] ??= []; if (list.includes(id)) return "Already fitted.";
  const clash = t.conflicts?.find((c) => list.includes(c)); if (clash) return `Remove the ${TUNING_BY_ID.get(clash)?.name.toLowerCase()} first.`;
  if (p.cash < t.cost) return `${t.name} costs $${t.cost.toLocaleString()}.`;
  p.cash -= t.cost; list.push(id); return `${t.name} fitted for $${t.cost.toLocaleString()}. ${t.blurb}`;
}
export function remove(sim: Simulation, v: Vehicle, id: string): string {
  const list = sim.worldFun.tuning?.[v.plate], t = TUNING_BY_ID.get(id); if (!list || !t || !list.includes(id)) return "Not fitted.";
  list.splice(list.indexOf(id), 1); sim.player.cash += Math.round(t.cost * 0.5); return `${t.name} removed. The shop paid $${Math.round(t.cost * 0.5).toLocaleString()} for it.`;
}

/** Turbo spool and nitrous bursts, per car. Returns the power multiplier this instant. */
interface Boost { boost: number; charges: number; active: number; cool: number }
const state = new WeakMap<Vehicle, Boost>();
export function stepBoost(v: Vehicle, fx: Fx, throttle: number, speed: number, top: number, dt: number): number {
  if (!fx.boost && !fx.nitro) return 1;
  let b = state.get(v); if (!b) state.set(v, b = { boost: 0, charges: fx.nitro, active: 0, cool: 0 });
  let mult = 1;
  if (fx.boost) {   // the turbo builds while you are on it and bleeds off when you lift
    const spool = fx.lag > 0 ? 1 / fx.lag : 5;
    b.boost = Math.max(0, Math.min(1, b.boost + (throttle > 0.6 && speed > 1 ? dt * spool * throttle : -dt * 1.8)));
    mult *= 1 + fx.boost * b.boost;
  }
  if (fx.nitro) {
    b.cool = Math.max(0, b.cool - dt);
    if (b.active > 0) { b.active -= dt; mult *= 1.4; }
    else if (throttle > 0.95 && speed < top * 0.8 && b.charges > 0 && b.cool <= 0 && speed > 2) { b.active = 2.5; b.charges--; b.cool = 4; }
    if (b.charges < fx.nitro && b.active <= 0 && Math.random() < dt / 20) b.charges++;   // recharges over time
  }
  return mult;
}
