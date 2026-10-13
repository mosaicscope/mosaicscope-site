import { worldToScreen, screenToWorld, Pt } from "../world/iso";
import { clamp } from "../core/math";

/** World-space camera: looks at (x, y) on the ground plane with a zoom; smooth follow and bounds. */
export class Camera {
  x = 32; y = 32; zoom = 1.1;
  targetX = 32; targetY = 32; targetZoom = 1.1;
  follow = -1;           // character id to follow (-1 = free)
  viewW = 800; viewH = 600;
  minZoom = 0.35; maxZoom = 6;
  worldSize = 64;
  private s: Pt = { x: 0, y: 0 };
  private c: Pt = { x: 0, y: 0 };

  resize(w: number, h: number): void { this.viewW = w; this.viewH = h; }

  update(dt: number, reduceMotion: boolean): void {
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 10));
    const S = this.worldSize;
    this.x = clamp(this.x, 0, S); this.y = clamp(this.y, 0, S);
  }

  setZoom(z: number): void { this.targetZoom = clamp(z, this.minZoom, this.maxZoom); }
  lookAt(x: number, y: number, snap = false): void {
    this.targetX = clamp(x, 0, this.worldSize); this.targetY = clamp(y, 0, this.worldSize);
    if (snap) { this.x = this.targetX; this.y = this.targetY; }
  }

  /** World -> CSS pixel screen coordinates. */
  toScreen(wx: number, wy: number, wz: number, out: Pt): Pt {
    worldToScreen(wx, wy, wz, this.s);
    worldToScreen(this.x, this.y, 0, this.c);
    out.x = (this.s.x - this.c.x) * this.zoom + this.viewW / 2;
    out.y = (this.s.y - this.c.y) * this.zoom + this.viewH / 2;
    return out;
  }

  /** CSS pixel screen -> world ground point. */
  toWorld(sx: number, sy: number, out: Pt = { x: 0, y: 0 }): Pt {
    worldToScreen(this.x, this.y, 0, this.c);
    return screenToWorld((sx - this.viewW / 2) / this.zoom + this.c.x, (sy - this.viewH / 2) / this.zoom + this.c.y, out);
  }

  /** Pan by a screen-space delta (drag). */
  panBy(dx: number, dy: number): void {
    const a = this.toWorld(this.viewW / 2, this.viewH / 2), b = this.toWorld(this.viewW / 2 - dx, this.viewH / 2 - dy);
    this.lookAt(this.targetX + (b.x - a.x), this.targetY + (b.y - a.y), true);
    this.follow = -1;
  }
}
