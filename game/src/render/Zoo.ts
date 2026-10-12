import type { Camera } from "./Camera";
import { ANIMALS, AnimalKind, drawAnimal, drawTank, TANK_WATER_Z } from "./Animals";
import { Z_PX, Pt } from "../world/iso";

/**
 * The player's private zoo: owned animals wander inside a world-space rectangle (tile coords) with
 * simple seek-and-pause steering. Water animals live in an isometric tank in the back corner.
 * Cheap: no shadowBlur, no per-frame allocations beyond a reused sort buffer.
 */

/** Animals are drawn a little under natural size so they sit well beside the stick figures. */
const SIZE = 0.7;
/** Approximate head height in animal units, for name tags. */
const TAG_Z: Record<AnimalKind, number> = {
  giraffe: 3.5, elephant: 2.6, zebra: 1.8, lion: 1.3, tiger: 1.2, penguin: 0.9, flamingo: 1.8, peacock: 1.2, parrot: 0.7,
  kea: 0.7, kiwi: 0.5, toucan: 0.7, owl: 0.8, whale: 1.0, dolphin: 0.9, monkey: 1.2, kangaroo: 1.6, panda: 1.2,
};

interface Mob {
  key: string; kind: AnimalKind; name: string; water: boolean;
  x: number; y: number; vx: number; vy: number; tx: number; ty: number;
  pause: number; ph: number; dir: number; mv: number; seen: number;
  sx: number; sy: number; depth: number;
}
interface Rect { x0: number; y0: number; x1: number; y1: number }

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

export class ZooRenderer {
  private mobs = new Map<string, Mob>();
  private order: Mob[] = [];
  private frame = 0;
  private p: Pt = { x: 0, y: 0 };
  private land: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private tank: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private hasTank = false;
  private vw = 800;
  private vh = 600;

  constructor() {}

  /** draw owned animals wandering inside a world-space rectangle (tile coords), using the iso camera */
  draw(g: CanvasRenderingContext2D, cam: Camera, area: { x0: number; y0: number; x1: number; y1: number }, animals: { kind: AnimalKind; name: string }[], time: number, dt: number): void {
    if (!animals.length) { if (this.mobs.size) this.mobs.clear(); return; }
    const ax0 = Math.min(area.x0, area.x1), ax1 = Math.max(area.x0, area.x1), ay0 = Math.min(area.y0, area.y1), ay1 = Math.max(area.y0, area.y1);
    const W = ax1 - ax0, H = ay1 - ay0;
    if (!(W > 0.5 && H > 0.5)) return;
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.frame++;
    this.vw = cam.viewW; this.vh = cam.viewH;

    // layout: tank in the back (x0, y0) corner when there are water animals
    this.hasTank = animals.some((a) => ANIMALS[a.kind]?.habitat === "water");
    if (this.hasTank) {
      const tw = Math.max(1.5, Math.min(5, W * 0.5)), th = Math.max(1.5, Math.min(4, H * 0.5));
      this.tank.x0 = ax0 + 0.2; this.tank.y0 = ay0 + 0.2; this.tank.x1 = this.tank.x0 + tw; this.tank.y1 = this.tank.y0 + th;
    }
    const m = Math.min(0.4, W * 0.1, H * 0.1);
    this.land.x0 = ax0 + m; this.land.y0 = ay0 + m; this.land.x1 = ax1 - m; this.land.y1 = ay1 - m;

    // sync animal states
    const order = this.order; order.length = 0;
    const counts = new Map<string, number>();
    for (const a of animals) {
      const def = ANIMALS[a.kind]; if (!def) continue;
      const base = a.kind + ":" + a.name, n = counts.get(base) ?? 0; counts.set(base, n + 1);
      const key = base + ":" + n;
      let mob = this.mobs.get(key);
      if (!mob) {
        const water = def.habitat === "water";
        const r = this.areaFor(water);
        const u = hash(key), v = hash(key + "y");
        const x = r.x0 + (r.x1 - r.x0) * u, y = r.y0 + (r.y1 - r.y0) * v;
        mob = { key, kind: a.kind, name: a.name, water, x, y, vx: 0, vy: 0, tx: x, ty: y, pause: u * 3, ph: u * 10, dir: v < 0.5 ? -1 : 1, mv: 0, seen: 0, sx: 0, sy: 0, depth: 0 };
        if (!water) this.pushOutOfTank(mob);
        this.mobs.set(key, mob);
      }
      mob.seen = this.frame;
      order.push(mob);
    }
    for (const [k, mob] of this.mobs) if (mob.seen !== this.frame) this.mobs.delete(k);

    // steer
    for (const mob of order) this.step(mob, dt);
    // soft separation between neighbours (small n, O(n²) is fine)
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
      const a = order[i], b = order[j]; if (a.water !== b.water) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, R = 0.7;
      if (d2 > R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = (R - d) * 0.5 * Math.min(1, dt * 6) / d;
      a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    }
    for (const mob of order) { this.clamp(mob); if (!mob.water) this.pushOutOfTank(mob); }

    // project + cull
    const z = cam.zoom, p = this.p, pad = 160 * z;
    let visible = 0;
    for (const mob of order) {
      cam.toScreen(mob.x, mob.y, mob.water ? TANK_WATER_Z : 0, p);
      mob.sx = p.x; mob.sy = p.y; mob.depth = mob.x + mob.y;
      if (p.x > -pad && p.x < cam.viewW + pad && p.y > -pad && p.y < cam.viewH + pad * 1.5) visible++;
    }

    let tankDrawn = false;
    const tcx = (this.tank.x0 + this.tank.x1) / 2, tcy = (this.tank.y0 + this.tank.y1) / 2, tDepth = this.tank.x1 + this.tank.y1;
    if (this.hasTank) {
      cam.toScreen(tcx, tcy, 0, p);
      const tsx = p.x, tsy = p.y, tw = this.tank.x1 - this.tank.x0, th = this.tank.y1 - this.tank.y0;
      const onScreen = tsx > -400 * z && tsx < cam.viewW + 400 * z && tsy > -300 * z && tsy < cam.viewH + 300 * z;
      if (onScreen) {
        // the tank is one depth slot: land animals behind it draw first, then tank + swimmers, then the rest
        order.sort((a, b) => a.depth - b.depth);
        let i = 0;
        for (; i < order.length; i++) { const mob = order[i]; if (!mob.water && mob.depth < tDepth - 0.5) this.drawMob(g, mob, z, time); else if (!mob.water) break; }
        drawTank(g, tsx, tsy, z, tw, th, time, "back");
        for (const mob of order) if (mob.water) this.drawMob(g, mob, z, time);
        drawTank(g, tsx, tsy, z, tw, th, time, "front");
        tankDrawn = true;
        for (; i < order.length; i++) { const mob = order[i]; if (!mob.water) this.drawMob(g, mob, z, time); }
      }
    }
    if (!tankDrawn && visible) {
      order.sort((a, b) => a.depth - b.depth);
      for (const mob of order) if (!mob.water) this.drawMob(g, mob, z, time);
    }

    // name tags (only when zoomed in enough to read them)
    if (z >= 1.1 && visible) {
      const fs = Math.round(Math.min(14, 8 + z * 2));
      g.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
      g.textAlign = "center"; g.textBaseline = "middle";
      for (const mob of order) {
        if (mob.water && !tankDrawn) continue;
        const ty = mob.sy - (TAG_Z[mob.kind] * SIZE + 0.35) * Z_PX * z;
        if (mob.sx < -100 || mob.sx > cam.viewW + 100 || ty < -20 || ty > cam.viewH + 20) continue;
        const w = g.measureText(mob.name).width + 10, hh = fs + 6;
        g.fillStyle = "rgba(14,11,10,.72)"; g.fillRect(mob.sx - w / 2, ty - hh / 2, w, hh);
        g.fillStyle = "#f6b62c"; g.fillRect(mob.sx - w / 2, ty + hh / 2 - 1.5, w, 1.5);
        g.fillStyle = "#eee4d3"; g.fillText(mob.name, mob.sx, ty + 0.5);
      }
    }
    g.globalAlpha = 1;
  }

  private drawMob(g: CanvasRenderingContext2D, mob: Mob, z: number, time: number): void {
    const pad = 160 * z, vw = this.vw, vh = this.vh;
    if (mob.sx < -pad || mob.sy < -pad || mob.sx > vw + pad || mob.sy > vh + pad * 1.5) return;
    drawAnimal(g, mob.kind, mob.sx, mob.sy, z * SIZE, mob.dir, time, mob.ph, mob.mv);
  }

  private areaFor(water: boolean): Rect { return water && this.hasTank ? this.tank : this.land; }

  private pickTarget(mob: Mob): void {
    const r = this.areaFor(mob.water), inset = mob.water ? Math.min(0.6, (r.x1 - r.x0) * 0.3, (r.y1 - r.y0) * 0.3) : 0;
    for (let tries = 0; tries < 6; tries++) {
      // prefer nearby targets so animals amble rather than sprint across the paddock
      const reach = 1.5 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      let tx = mob.x + Math.cos(a) * reach, ty = mob.y + Math.sin(a) * reach;
      tx = Math.min(r.x1 - inset, Math.max(r.x0 + inset, tx)); ty = Math.min(r.y1 - inset, Math.max(r.y0 + inset, ty));
      mob.tx = tx; mob.ty = ty;
      if (mob.water || !this.inTank(tx, ty, 0.4)) return;
    }
    mob.tx = this.land.x1 - 0.3; mob.ty = this.land.y1 - 0.3;
  }

  private step(mob: Mob, dt: number): void {
    const speed = ANIMALS[mob.kind].speed * 0.6;
    let dvx = 0, dvy = 0;
    if (mob.pause > 0) {
      mob.pause -= dt;
      if (mob.pause <= 0) this.pickTarget(mob);
    } else {
      const dx = mob.tx - mob.x, dy = mob.ty - mob.y, d = Math.hypot(dx, dy);
      if (d < 0.25) {
        // arrived: graze / preen / sulk for a while (swimmers rest less)
        mob.pause = mob.water ? 0.5 + Math.random() * 1.5 : 1.5 + Math.random() * 4.5;
      } else {
        const arrive = Math.min(1, d / 0.8);
        dvx = (dx / d) * speed * arrive; dvy = (dy / d) * speed * arrive;
      }
    }
    const k = Math.min(1, dt * 3);
    mob.vx += (dvx - mob.vx) * k; mob.vy += (dvy - mob.vy) * k;
    mob.x += mob.vx * dt; mob.y += mob.vy * dt;
    const sp = Math.hypot(mob.vx, mob.vy);
    mob.mv = Math.min(1, sp / Math.max(0.01, speed * 0.6));
    const sdx = mob.vx - mob.vy; // screen-x direction of travel in iso
    if (Math.abs(sdx) > 0.08) mob.dir = sdx > 0 ? 1 : -1;
  }

  private clamp(mob: Mob): void {
    const r = this.areaFor(mob.water), inset = mob.water ? Math.min(0.4, (r.x1 - r.x0) * 0.25, (r.y1 - r.y0) * 0.25) : 0;
    mob.x = Math.min(r.x1 - inset, Math.max(r.x0 + inset, mob.x));
    mob.y = Math.min(r.y1 - inset, Math.max(r.y0 + inset, mob.y));
  }

  private inTank(x: number, y: number, margin: number): boolean {
    const t = this.tank;
    return this.hasTank && x > t.x0 - margin && x < t.x1 + margin && y > t.y0 - margin && y < t.y1 + margin;
  }

  /** Land animals never walk into the tank: nudge them out along the shortest axis. */
  private pushOutOfTank(mob: Mob): void {
    const mg = 0.35;
    if (!this.inTank(mob.x, mob.y, mg)) return;
    const t = this.tank;
    const ex = t.x1 + mg - mob.x, ey = t.y1 + mg - mob.y; // tank sits in the x0/y0 corner, so exit toward +x or +y
    if (ex < ey && t.x1 + mg <= this.land.x1) mob.x = t.x1 + mg;
    else if (t.y1 + mg <= this.land.y1) mob.y = t.y1 + mg;
    else mob.x = t.x1 + mg;
    if (mob.pause <= 0 && this.inTank(mob.tx, mob.ty, 0.4)) this.pickTarget(mob);
  }
}
