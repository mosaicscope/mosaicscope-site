import type { Vehicle } from "../entities/types";
import type { Simulation } from "./Simulation";
import { vehicleGeometry } from "./VehicleGeometry";

/** Footprint broad phase. Reused buckets keep fleet queries local as the catalogue grows. */
export class VehicleIndex {
  private cells = new Map<string, Vehicle[]>();
  private seen = new Set<Vehicle>();
  rebuild(vehicles: Vehicle[], swept = false): void {
    if(this.cells.size>2048)this.cells.clear();else for(const bucket of this.cells.values())bucket.length=0;
    for (const v of vehicles) {
      const g = vehicleGeometry(v), r = Math.hypot(g.length, g.width) / 2;
      const x0 = swept ? Math.min(v.px, v.x) : v.x, y0 = swept ? Math.min(v.py, v.y) : v.y;
      const x1 = swept ? Math.max(v.px, v.x) : v.x, y1 = swept ? Math.max(v.py, v.y) : v.y;
      for (let x = Math.floor((x0-r)/8); x <= Math.floor((x1+r)/8); x++) {
        for (let y = Math.floor((y0-r)/8); y <= Math.floor((y1+r)/8); y++) {
          const key = `${x},${y}`;
          let bucket = this.cells.get(key);
          if (!bucket) { bucket = []; this.cells.set(key, bucket); }
          bucket.push(v);
        }
      }
    }
  }
  query(x: number, y: number, radius: number, out: Vehicle[]): Vehicle[] {
    out.length = 0; this.seen.clear();
    for (let cx = Math.floor((x-radius)/8); cx <= Math.floor((x+radius)/8); cx++) {
      for (let cy = Math.floor((y-radius)/8); cy <= Math.floor((y+radius)/8); cy++) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const v of bucket) if (!this.seen.has(v)) { this.seen.add(v); out.push(v); }
      }
    }
    return out;
  }
}
const indices = new WeakMap<Simulation, VehicleIndex>();
export function vehicleIndex(sim: Simulation): VehicleIndex {
  let index = indices.get(sim);
  if (!index) { index = new VehicleIndex(); indices.set(sim, index); }
  return index;
}
