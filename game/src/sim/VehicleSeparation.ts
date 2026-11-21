import type { Simulation } from "./Simulation";
import { chassisContact } from "./VehicleGeometry";
import { nearbyVehiclePairs } from "./MappedTraffic";

/**
 * Stationary cars never sit inside each other. Parked, crashed or abandoned vehicles that end up overlapping (a spawn that landed
 * badly, a pushed car, a respawn) are eased apart a little each pass, so nothing is drawn through anything else in either view.
 * Moving traffic is left alone: it has its own collision avoidance.
 */
export function separateVehicles(sim: Simulation): void {
  if (sim.tick % 20 !== 9) return;
  const p = sim.player, near = sim.vehicles.filter((v) => Math.hypot(v.x - p.x, v.y - p.y) < 60);
  let moved = 0;
  for (const [i, j] of nearbyVehiclePairs(near)) {
    const a = near[i], b = near[j];
    if (Math.abs(a.speed) > 0.4 || Math.abs(b.speed) > 0.4) continue;
    if (a.state === "drive" || b.state === "drive" || a.driver === sim.playerId || b.driver === sim.playerId || a.state === "free" || b.state === "free") continue;
    const ct = chassisContact(a, b); if (!ct) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, push = Math.min(0.5, ct.depth / 2 + 0.05), ux = dx / d, uy = dy / d;
    const free = (v: typeof a, sx: number, sy: number) => sim.world.drivable(v.x + sx, v.y + sy) || sim.world.walkable(v.x + sx, v.y + sy);
    if (free(a, -ux * push, -uy * push)) { a.x -= ux * push; a.y -= uy * push; a.px = a.x; a.py = a.y; }
    if (free(b, ux * push, uy * push)) { b.x += ux * push; b.y += uy * push; b.px = b.x; b.py = b.y; }
    if (++moved > 12) return;
  }
}
