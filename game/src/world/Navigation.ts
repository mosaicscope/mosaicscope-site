import { World, T } from "./World";

/**
 * Grid A* (8-way, no corner cutting) with a node budget, plus a request queue so only a few searches
 * run per tick. Paths are string-pulled with line-of-walk checks to avoid zig-zags.
 */
export interface PathRequest { id: number; fromX: number; fromY: number; toX: number; toY: number; cb: (path: Float32Array | null) => void }

export class Navigation {
  private world: World;
  private S: number;
  private g: Float32Array;
  private f: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private run = 0;
  private heap: Int32Array;
  private heapSize = 0;
  private queue: PathRequest[] = [];
  private nextId = 1;
  nodeBudget: number;
  /** Metrics */
  searchesThisTick = 0;
  expansionsThisTick = 0;
  failures = 0;

  constructor(world: World, nodeBudget = 3000) {
    this.world = world;
    this.S = world.mapped?192:world.size;
    const n = this.S * this.S;
    this.g = new Float32Array(n); this.f = new Float32Array(n);
    this.parent = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.heap = new Int32Array(n * 2);
    this.nodeBudget = world.mapped?Math.min(nodeBudget,3500):nodeBudget;
  }

  get queueLength(): number { return this.queue.length; }

  request(fromX: number, fromY: number, toX: number, toY: number, cb: PathRequest["cb"]): number {
    const id = this.nextId++;
    this.queue.push({ id, fromX, fromY, toX, toY, cb });
    return id;
  }

  cancel(id: number): void { const i = this.queue.findIndex((r) => r.id === id); if (i >= 0) this.queue.splice(i, 1); }

  /** Process up to `max` queued requests. */
  process(max: number): void {
    this.searchesThisTick = 0; this.expansionsThisTick = 0;
    for (let i = 0; i < max && this.queue.length; i++) {
      const r = this.queue.shift()!;
      r.cb(this.findPath(r.fromX, r.fromY, r.toX, r.toY));
    }
  }

  private push(i: number): void {
    const h = this.heap, f = this.f;
    let k = this.heapSize++;
    h[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (f[h[p]] <= f[h[k]]) break; const t = h[p]; h[p] = h[k]; h[k] = t; k = p; }
  }
  private pop(): number {
    const h = this.heap, f = this.f, top = h[0];
    h[0] = h[--this.heapSize];
    let k = 0;
    for (;;) {
      const l = k * 2 + 1, r = l + 1;
      let m = k;
      if (l < this.heapSize && f[h[l]] < f[h[m]]) m = l;
      if (r < this.heapSize && f[h[r]] < f[h[m]]) m = r;
      if (m === k) break;
      const t = h[m]; h[m] = h[k]; h[k] = t; k = m;
    }
    return top;
  }

  /** Synchronous search. Returns flat [x0,y0,x1,y1,...] waypoints (tile centres) or null. */
  findPath(fromX: number, fromY: number, toX: number, toY: number): Float32Array | null {
    this.searchesThisTick++;
    const w = this.world, S = this.S;
    const distance=Math.hypot(toX-fromX,toY-fromY),fraction=w.mapped?Math.min(1,80/Math.max(1,distance)):1;
    const goal = w.nearestWalkable(fromX+(toX-fromX)*fraction, fromY+(toY-fromY)*fraction);
    const ox=w.mapped?Math.floor(fromX)-96:0,oy=w.mapped?Math.floor(fromY)-96:0;
    const sx = Math.floor(fromX)-ox, sy = Math.floor(fromY)-oy, gx = Math.floor(goal.x)-ox, gy = Math.floor(goal.y)-oy;
    if (!w.inBounds(Math.floor(fromX),Math.floor(fromY))||gx<0||gy<0||gx>=S||gy>=S) return null;
    if (sx === gx && sy === gy) return new Float32Array([goal.x, goal.y]);
    if (this.walkLine(fromX, fromY, goal.x, goal.y)) return new Float32Array([goal.x, goal.y]);
    const run = ++this.run;
    const start = sy * S + sx, target = gy * S + gx;
    this.heapSize = 0;
    this.g[start] = 0; this.f[start] = this.h(sx, sy, gx, gy); this.parent[start] = -1; this.stamp[start] = run;
    this.push(start);
    let expansions = 0, found = false;
    while (this.heapSize > 0) {
      const cur = this.pop();
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      if (cur === target) { found = true; break; }
      if (++expansions > this.nodeBudget) break;
      const cx = cur % S, cy = (cur - cx) / S;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx<0||ny<0||nx>=S||ny>=S||!w.walkableTile(nx+ox, ny+oy)) continue;
        if (dx && dy && (!w.walkableTile(cx + dx+ox, cy+oy) || !w.walkableTile(cx+ox, cy + dy+oy))) continue; // no corner cutting
        const ni = ny * S + nx;
        if (this.closed[ni] === run) continue;
        const ng = this.g[cur] + (dx && dy ? 1.41421 : 1) * w.walkCost(nx+ox, ny+oy);
        if (this.stamp[ni] !== run || ng < this.g[ni]) {
          this.stamp[ni] = run; this.g[ni] = ng; this.parent[ni] = cur;
          this.f[ni] = ng + this.h(nx, ny, gx, gy);
          this.push(ni);
        }
      }
    }
    this.expansionsThisTick += expansions;
    if (!found) { this.failures++; return null; }
    // walk back
    const cells: number[] = [];
    for (let c = target; c !== -1; c = this.parent[c]) cells.push(c);
    cells.reverse();
    // string pulling
    const pts: number[] = [];
    let ax = fromX, ay = fromY, i = 1;
    while (i < cells.length) {
      let j = i;
      while (j + 1 < cells.length) {
        const c = cells[j + 1], x = (c % S) + 0.5+ox, y = Math.floor(c / S) + 0.5+oy;
        if (!this.walkLine(ax, ay, x, y)) break;
        j++;
      }
      const c = cells[j];
      ax = j === cells.length - 1 ? goal.x : (c % S) + 0.5+ox; ay = j === cells.length - 1 ? goal.y : Math.floor(c / S) + 0.5+oy;
      pts.push(ax, ay);
      i = j + 1;
    }
    return new Float32Array(pts);
  }

  private h(x: number, y: number, gx: number, gy: number): number {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return dx + dy + (1.41421 - 2) * Math.min(dx, dy);
  }

  /**
   * True when a body of radius ~0.3 can walk the straight segment (samples every 0.25 tiles).
   * Straight lines may not run along/across open road (people use crossings), unless they start on it.
   */
  walkLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
    const n = Math.ceil(d / 0.25);
    const w = this.world;
    const startOnRoad = w.tile(Math.floor(x0), Math.floor(y0)) === T.ROAD;
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0, x = x0 + dx * t, y = y0 + dy * t;
      if (!w.walkable(x, y) || !w.walkable(x + 0.28, y) || !w.walkable(x - 0.28, y) || !w.walkable(x, y + 0.28) || !w.walkable(x, y - 0.28)) return false;
      if (!startOnRoad && i > 0 && i < n && w.tile(Math.floor(x), Math.floor(y)) === T.ROAD) return false;
    }
    return true;
  }
}
