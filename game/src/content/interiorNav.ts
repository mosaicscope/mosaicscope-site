/** Collision and pathing over an InteriorDef. Pure maths, DOM-free, shared by the overlay, NPC walkers and tests. */
import { PROP_INFO, type InteriorDef } from "./interiors";

export const GRID = 0.5;
export const RADIUS = 0.22;
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Pt { x: number; y: number }

const boxCache = new WeakMap<InteriorDef, Box[]>();
export function solidBoxes(def: InteriorDef): Box[] {
  let b = boxCache.get(def);
  if (!b) { b = def.props.filter((q) => PROP_INFO[q.type].solid).map((q) => ({ x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h })); boxCache.set(def, b); }
  return b;
}

/** True when a disc of radius r at (x, y) leaves the floor plan or touches a solid prop. */
export function blockedAt(def: InteriorDef, x: number, y: number, r = RADIUS): boolean {
  if (x < r || y < r || x > def.size.w - r || y > def.size.h - r) return true;
  for (const b of solidBoxes(def)) {
    const cx = Math.max(b.x0, Math.min(x, b.x1)), cy = Math.max(b.y0, Math.min(y, b.y1));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

/** Slide-move: tries each axis separately so you glide along counters instead of sticking. */
export function moveInside(def: InteriorDef, x: number, y: number, dx: number, dy: number): Pt {
  let nx = x, ny = y;
  if (!blockedAt(def, x + dx, y)) nx = x + dx;
  if (!blockedAt(def, nx, y + dy)) ny = y + dy;
  return { x: nx, y: ny };
}

interface Grid { nx: number; ny: number; blocked: Uint8Array }
const gridCache = new WeakMap<InteriorDef, Grid>();
function gridOf(def: InteriorDef): Grid {
  let g = gridCache.get(def);
  if (!g) {
    const nx = Math.round(def.size.w / GRID), ny = Math.round(def.size.h / GRID), blocked = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) blocked[j * nx + i] = blockedAt(def, (i + 0.5) * GRID, (j + 0.5) * GRID) ? 1 : 0;
    g = { nx, ny, blocked }; gridCache.set(def, g);
  }
  return g;
}
const cellOf = (g: Grid, p: Pt): number => Math.max(0, Math.min(g.ny - 1, Math.floor(p.y / GRID))) * g.nx + Math.max(0, Math.min(g.nx - 1, Math.floor(p.x / GRID)));

/** Breadth-first flood from a point over free cells (8-way, no corner cutting). Returns parent links, -2 = unreached. */
function flood(def: InteriorDef, from: Pt, to?: Pt): { g: Grid; parent: Int32Array; start: number } {
  const g = gridOf(def), parent = new Int32Array(g.nx * g.ny).fill(-2);
  const start = cellOf(g, from), goal = to ? cellOf(g, to) : -1;
  if (g.blocked[start]) return { g, parent, start };
  const queue = new Int32Array(g.nx * g.ny); let qh = 0, qt = 0;
  queue[qt++] = start; parent[start] = -1;
  while (qh < qt) {
    const c = queue[qh++]; if (c === goal) break;
    const cx = c % g.nx, cy = (c - cx) / g.nx;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) continue;
      const n = y * g.nx + x; if (g.blocked[n] || parent[n] !== -2) continue;
      if (dx && dy && (g.blocked[cy * g.nx + x] || g.blocked[y * g.nx + cx])) continue;
      parent[n] = c; queue[qt++] = n;
    }
  }
  return { g, parent, start };
}

/** Is (x, y) a free spot connected to `from`? */
export function reachable(def: InteriorDef, from: Pt, to: Pt): boolean {
  const { g, parent } = flood(def, from, to);
  const c = cellOf(g, to);
  return !g.blocked[c] && parent[c] !== -2;
}

/** Waypoints from `from` to `to` (cell centres, then the exact target), or null when not connected. */
export function findPath(def: InteriorDef, from: Pt, to: Pt): Pt[] | null {
  const { g, parent } = flood(def, from, to);
  let c = cellOf(g, to);
  if (g.blocked[c] || parent[c] === -2) return null;
  const out: Pt[] = [{ x: to.x, y: to.y }];
  while (parent[c] >= 0) { c = parent[c]; out.push({ x: ((c % g.nx) + 0.5) * GRID, y: (Math.floor(c / g.nx) + 0.5) * GRID }); }
  out.reverse(); out.shift(); // drop the start cell: we are already in it
  return out;
}

/** Zone containing a point (for captions); falls back to the first zone. */
export function zoneAt(def: InteriorDef, x: number, y: number) {
  return def.zones.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) ?? def.zones[0];
}
