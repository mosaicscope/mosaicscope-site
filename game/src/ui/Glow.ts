import { ACID, GOLD } from "../render/palette";
import { TRAIL, CALM, trailAlpha } from "../app/sparks";

/**
 * Gilbert's two quiet glows on one tiny overlay canvas, in the website palette (Louis's LOOK.md v2):
 * an acid-green trail that fades behind the player in under a second, and a soft sodium-yellow pool
 * when you pause somewhere tidy. Half-resolution, at most TRAIL.max dots, and nothing is drawn (or
 * cleared) while both are idle, so it costs next to nothing at 60 fps.
 */
export class Glow {
  readonly el = document.createElement("canvas");
  private g = this.el.getContext("2d");
  private pts: { x: number; y: number; age: number }[] = [];
  private lx = NaN; private ly = NaN; private dirty = false; private w = 0; private h = 0;

  constructor() {
    this.el.className = "glow"; this.el.setAttribute("aria-hidden", "true");
  }

  private fit(): void {
    const w = Math.ceil(window.innerWidth / 2), h = Math.ceil(window.innerHeight / 2);
    if (w !== this.w || h !== this.h) { this.w = this.el.width = w; this.h = this.el.height = h; this.dirty = true; }
  }

  /** `sx, sy` are the player's CSS-pixel screen position; `step` is how far (in tiles) they moved since the last call. */
  update(dt: number, sx: number, sy: number, wx: number, wy: number, show: boolean, calm: number, reduce: boolean): void {
    const g = this.g; if (!g) return;
    if (!show) { this.pts.length = 0; this.lx = NaN; calm = 0; }
    else if (!reduce) {
      if (Number.isNaN(this.lx) || Math.hypot(wx - this.lx, wy - this.ly) >= TRAIL.step) {
        if (!Number.isNaN(this.lx) && Math.hypot(wx - this.lx, wy - this.ly) < 6) { // a teleport or a camera snap is not a stride
          this.pts.push({ x: sx, y: sy, age: 0 });
          if (this.pts.length > TRAIL.max) this.pts.shift();
        }
        this.lx = wx; this.ly = wy;
      }
    }
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[0].age >= TRAIL.life) this.pts.shift();
    if (!this.pts.length && calm <= 0.001 && !this.dirty) return; // idle: draw nothing
    this.fit();
    g.clearRect(0, 0, this.w, this.h);
    this.dirty = false;
    g.globalCompositeOperation = "lighter";
    for (const p of this.pts) {
      const a = trailAlpha(p.age); if (a <= 0.01) continue;
      const r = 3 + 5 * (1 - p.age / TRAIL.life), x = p.x / 2, y = p.y / 2;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, ACID); grad.addColorStop(1, "rgba(198,255,61,0)");
      g.globalAlpha = a; g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    if (calm > 0.001) {
      const x = sx / 2, y = sy / 2 + 4, r = 26, grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, GOLD); grad.addColorStop(1, "rgba(246,182,44,0)");
      g.globalAlpha = CALM.peak * calm; g.fillStyle = grad; g.beginPath(); g.ellipse(x, y, r, r * 0.5, 0, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    if (this.pts.length || calm > 0.001) this.dirty = true; // clear one last time once it all fades
  }
}
