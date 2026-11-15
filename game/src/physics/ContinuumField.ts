/** Sparse SI height/enthalpy/momentum field. One cell spans one game tile horizontally. */
export interface FieldCell {
  x: number; y: number; height: number; compaction: number; rubber: number;
  heat: number; ice: number; water: number; px: number; py: number; stamp: number;
  supportX: number; supportY: number; damage: number; fractureEnergy: number;
}
export interface FieldSnapshot { time: number; cells: FieldCell[] }
const LATENT_ICE = 334000; // J/kg; ice is at its melting point in this enthalpy closure.
export class ContinuumField {
  readonly cells = new Map<string, FieldCell>();
  time = 0;
  readonly capacity = 8192;
  private key(x: number, y: number) { return `${Math.floor(x)},${Math.floor(y)}`; }
  peek(x: number, y: number): FieldCell | undefined { return this.cells.get(this.key(x, y)); }
  /** Hard budget: never silently evict permanent ruts. Untouched cells remain analytic ground. */
  touch(x: number, y: number): FieldCell | undefined {
    const key = this.key(x, y), old = this.cells.get(key);
    if (old) { this.decay(old); return old; }
    if (this.cells.size >= this.capacity || !Number.isFinite(x + y)) return undefined;
    const cell: FieldCell = { x: Math.floor(x), y: Math.floor(y), height: 0, compaction: 0, rubber: 0,
      heat: 0, ice: 0, water: 0, px: 0, py: 0, stamp: this.time, supportX: 0, supportY: 0, damage: 0, fractureEnergy: 0 };
    this.cells.set(key, cell); return cell;
  }
  advance(dt: number): void { if (Number.isFinite(dt) && dt > 0) this.time += dt; }
  /** Lazy analytic wake/heat decay avoids walking the entire world every substep. */
  private decay(c: FieldCell): void {
    const age = Math.max(0, this.time - c.stamp);
    c.px *= Math.exp(-age * 1.5); c.py *= Math.exp(-age * 1.5); c.heat *= Math.exp(-age * .015); c.stamp = this.time;
  }
  wind(x: number, y: number, metresPerTile: number): { x: number; y: number } {
    const c = this.peek(x, y);
    const k = c ? Math.exp(-Math.max(0, this.time - c.stamp) * 1.5) / (1.225 * metresPerTile ** 2 * 2) : 0;
    return { x: (c?.px ?? 0) * k, y: (c?.py ?? 0) * k };
  }
  grip(x: number, y: number): number {
    const c = this.peek(x, y);
    return c ? Math.max(.2, (1 + .1 * c.rubber) / (1 + .25 * c.water + c.ice)) : 1;
  }
  heat(x: number, y: number, joules: number, rubberKg: number): void {
    const c = this.touch(x, y); if (!c) return;
    const q = Math.max(0, joules), melted = Math.min(c.ice, q / LATENT_ICE);
    c.ice -= melted; c.water += melted; c.heat += q - melted * LATENT_ICE;
    c.rubber = Math.min(1, c.rubber + Math.max(0, rubberKg));
  }
  /** Allocate all three cells before mutation, preserving displaced volume at the field budget. */
  rut(x: number, y: number, target: number, dt: number): void {
    if (!(target > 0) || !(dt > 0)) return;
    const c = this.touch(x, y); if (!c) return;
    const left = this.touch(c.x - 1, c.y), right = this.touch(c.x + 1, c.y);
    if (!left || !right) return;
    const dz = Math.max(0, Math.min(.35, target) - c.compaction) * -Math.expm1(-dt * 5);
    c.compaction += dz; c.height -= dz; left.height += dz * .5; right.height += dz * .5;
  }
  /** Bilinear vertex-height sampling makes ground normals finite and continuous within a cell. */
  height(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
    const h = (xx: number, yy: number) => this.peek(xx, yy)?.height ?? 0;
    return (1-u)*(1-v)*h(ix,iy)+u*(1-v)*h(ix+1,iy)+(1-u)*v*h(ix,iy+1)+u*v*h(ix+1,iy+1);
  }
  normal(x: number, y: number, metresPerTile: number) {
    const dx = (this.height(x + .05, y) - this.height(x - .05, y)) / (.1 * metresPerTile);
    const dy = (this.height(x, y + .05) - this.height(x, y - .05)) / (.1 * metresPerTile);
    const k = 1 / Math.hypot(dx, dy, 1); return { x: -dx*k, y: -dy*k, z: k };
  }
  snapshot(): FieldSnapshot {
    return { time: this.time, cells: [...this.cells.values()].map(c => ({ ...c })) };
  }
  restore(data?: FieldSnapshot): void {
    this.cells.clear(); this.time = 0;
    if (!data || !Number.isFinite(data.time) || data.time < 0 || !Array.isArray(data.cells)) return;
    this.time = data.time;
    for (const c of data.cells.slice(0, this.capacity)) {
      const keys: (keyof FieldCell)[] = ['x','y','height','compaction','rubber','heat','ice','water','px','py','stamp','supportX','supportY','damage','fractureEnergy'];
      if (!c || keys.some(k => typeof c[k] !== 'number' || !Number.isFinite(c[k]))) continue;
      if (!Number.isInteger(c.x) || !Number.isInteger(c.y) || Math.abs(c.height) > 10 || c.ice < 0 || c.water < 0 || c.heat < 0) continue;
      this.cells.set(this.key(c.x, c.y), { ...c });
    }
  }
}
