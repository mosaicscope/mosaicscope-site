import { h } from "./dom";
import type { Simulation } from "../sim/Simulation";
import type { Cue, CueKind } from "../sim/Pursuit";

/**
 * The dramatic beat for a crash or a crime, replacing the old "caught in the act" letterbox cam and the
 * crash snapshot. It never blocks play: a short slow-mo, a red edge flash and a stamped banner in the upper
 * middle of the screen (clear of the area name above and the dock below). It also draws the police search
 * zone and stinger strips over the world.
 */
const BIG: CueKind[] = ["wanted", "crash", "busted", "evaded"];

export class HeatCue {
  readonly el = h("div.heat-cue", { "aria-live": "assertive" });
  private flash = h("div.heat-flash");
  private stamp = h("div.heat-stamp", null, [h("b"), h("span")]);
  private overlay = document.createElement("canvas");
  private hideAt = 0;
  private slowTimer = 0;

  constructor(private opts: { reduceMotion: () => boolean; setSlow: (on: boolean) => void; project: (x: number, y: number, h?: number) => { x: number; y: number } }) {
    this.el.append(this.flash, this.stamp);
    this.overlay.className = "heat-overlay";
  }
  mountOverlay(after: HTMLElement): void { after.after(this.overlay); }

  /** Show one cue now. Big cues (wanted, crash, busted, evaded) get the full stamp and slow-mo. */
  show(kind: CueKind, title: string, sub: string): void {
    const big = BIG.includes(kind);
    (this.stamp.querySelector("b") as HTMLElement).textContent = title;
    (this.stamp.querySelector("span") as HTMLElement).textContent = sub;
    this.el.className = "heat-cue on " + (big ? "big" : "small") + " k-" + kind;
    void this.el.offsetWidth; // restart the animation
    this.el.classList.add("go");
    this.hideAt = performance.now() + (big ? 2100 : 1500);
    if (big && kind !== "evaded" && !this.opts.reduceMotion()) { this.opts.setSlow(true); clearTimeout(this.slowTimer); this.slowTimer = window.setTimeout(() => this.opts.setSlow(false), 650); }
  }

  /** Each frame: drain the sim's cue queue, end slow-mo, hide stamps, draw the search zone and stingers. */
  frame(sim: Simulation, now: number, visible: boolean): void {
    const q = sim.pursuit.cues;
    if (q.length && visible && now > this.hideAt - 900) { const c = q.shift() as Cue; this.show(c.kind, c.title, c.sub); }
    if (this.hideAt && now > this.hideAt) { this.hideAt = 0; this.el.classList.remove("on", "go"); }
    this.draw(sim, visible);
  }

  private draw(sim: Simulation, visible: boolean): void {
    const cv = this.overlay, ps = sim.pursuit;
    const show = visible && (ps.phase === "search" || ps.spikes.length > 0 || !!ps.blockAt || ps.helis.some((h) => h.on));
    cv.style.display = show ? "" : "none";
    if (!show) return;
    const r = cv.parentElement?.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round((r?.width ?? innerWidth) * dpr), hgt = Math.round((r?.height ?? innerHeight) * dpr);
    if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; }
    const g = cv.getContext("2d"); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hgt);
    if (ps.phase === "search") {
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, p = this.opts.project(ps.seenX + Math.cos(a) * ps.radius, ps.seenY + Math.sin(a) * ps.radius); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
      g.fillStyle = "rgba(179,52,60,.10)"; g.fill();
      g.setLineDash([10, 8]); g.lineWidth = 2; g.strokeStyle = "rgba(207,74,82,.85)"; g.stroke(); g.setLineDash([]);
    }
    for (const s of ps.spikes) {
      const a = this.opts.project(s.x - s.ax * s.len / 2, s.y - s.ay * s.len / 2), b = this.opts.project(s.x + s.ax * s.len / 2, s.y + s.ay * s.len / 2);
      g.lineCap = "butt"; g.lineWidth = 7; g.strokeStyle = "#111"; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.lineWidth = 4; g.setLineDash([4, 4]); g.strokeStyle = s.hit ? "#7d2229" : "#e9e6e1"; g.stroke(); g.setLineDash([]);
    }
    if (ps.blockAt) this.drawBlock(g, ps.blockAt);
    for (const hl of ps.helis) if (hl.on) this.drawHeli(g, hl, sim.tick);
  }

  /** Cones either side of the cruisers and a striped barrier in front of them. */
  private drawBlock(g: CanvasRenderingContext2D, b: { x: number; y: number; ax: number; ay: number }): void {
    const P = this.opts.project, fx = -b.ay, fy = b.ax; // a little in front of the cars
    for (const off of [-3.2, -2.6, 2.6, 3.2]) {
      const base = P(b.x + b.ax * off, b.y + b.ay * off), tip = P(b.x + b.ax * off, b.y + b.ay * off, 0.45), w = Math.max(3, Math.abs(tip.y - base.y) * 0.45);
      g.fillStyle = "#b3343c"; g.beginPath(); g.moveTo(base.x - w, base.y); g.lineTo(base.x + w, base.y); g.lineTo(tip.x, tip.y); g.closePath(); g.fill();
      g.fillStyle = "#f2efeb"; g.fillRect(base.x - w * 0.55, (base.y + tip.y) / 2 - 1, w * 1.1, 2.5);
    }
    for (const side of [-1, 1]) {
      const a = P(b.x + fx * 1.4 * side + b.ax * -2, b.y + fy * 1.4 * side + b.ay * -2, 0.35), c = P(b.x + fx * 1.4 * side + b.ax * 2, b.y + fy * 1.4 * side + b.ay * 2, 0.35);
      g.lineWidth = 5; g.strokeStyle = "#1b1919"; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke();
      g.lineWidth = 3; g.setLineDash([6, 6]); g.strokeStyle = "#e9e6e1"; g.stroke(); g.setLineDash([]);
    }
  }

  /** A helicopter at altitude: ground shadow, spotlight (police), body, tail and a spinning rotor. */
  private drawHeli(g: CanvasRenderingContext2D, hl: { kind: string; x: number; y: number; alt: number; heading: number }, tick: number): void {
    const P = this.opts.project, at = P(hl.x, hl.y, hl.alt), ground = P(hl.x, hl.y, 0), unit = Math.max(4, Math.hypot(P(hl.x + 1, hl.y, hl.alt).x - at.x, P(hl.x + 1, hl.y, hl.alt).y - at.y));
    if (at.x < -200 || at.y < -200 || at.x > innerWidth + 200 || at.y > innerHeight + 200) return;
    g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(ground.x, ground.y, unit * 1.6, unit * 0.8, 0, 0, 6.283); g.fill();
    if (hl.kind === "police") {
      const spot = unit * 4.5, grd = g.createRadialGradient(ground.x, ground.y, 0, ground.x, ground.y, spot);
      grd.addColorStop(0, "rgba(255,255,255,.34)"); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = "rgba(255,255,255,.07)"; g.beginPath(); g.moveTo(at.x - unit * 0.3, at.y); g.lineTo(ground.x - spot, ground.y); g.lineTo(ground.x + spot, ground.y); g.closePath(); g.fill();
      g.fillStyle = grd; g.beginPath(); g.ellipse(ground.x, ground.y, spot, spot * 0.55, 0, 0, 6.283); g.fill();
    }
    const ca = Math.cos(hl.heading), sa = Math.sin(hl.heading), dirx = P(hl.x + ca, hl.y + sa, hl.alt), hx = (dirx.x - at.x) / unit, hy = (dirx.y - at.y) / unit;
    const body = hl.kind === "police" ? "#1f2328" : "#f2efeb", stripe = hl.kind === "police" ? "#1c4fd6" : "#b3343c";
    g.lineCap = "round"; g.strokeStyle = body; g.lineWidth = unit * 0.28; g.beginPath(); g.moveTo(at.x, at.y); g.lineTo(at.x - hx * unit * 2.1, at.y - hy * unit * 2.1); g.stroke();
    g.fillStyle = body; g.strokeStyle = "#0b0a0a"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(at.x, at.y, unit * 1.05, unit * 0.62, Math.atan2(hy, hx), 0, 6.283); g.fill(); g.stroke();
    g.fillStyle = stripe; g.beginPath(); g.ellipse(at.x, at.y, unit * 0.95, unit * 0.18, Math.atan2(hy, hx), 0, 6.283); g.fill();
    g.fillStyle = "rgba(160,190,215,.9)"; g.beginPath(); g.ellipse(at.x + hx * unit * 0.55, at.y + hy * unit * 0.55, unit * 0.35, unit * 0.3, 0, 0, 6.283); g.fill();
    const spin = tick * 0.9; g.strokeStyle = "rgba(20,20,20,.55)"; g.lineWidth = Math.max(1.5, unit * 0.09);
    for (let i = 0; i < 2; i++) { const a = spin + i * Math.PI / 2, rx = Math.cos(a) * unit * 2.2, ry = Math.sin(a) * unit * 1.1; g.beginPath(); g.moveTo(at.x - rx, at.y - unit * 0.5 - ry); g.lineTo(at.x + rx, at.y - unit * 0.5 + ry); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.ellipse(at.x, at.y - unit * 0.5, unit * 2.2, unit * 1.1, 0, 0, 6.283); g.fill();
    if (hl.kind === "news") { g.fillStyle = "#b3343c"; g.font = `800 ${Math.round(unit * 0.55)}px "Barlow Condensed", sans-serif`; g.textAlign = "center"; g.fillText("7 NEWS", at.x, at.y + unit * 1.35); g.textAlign = "start"; }
    if (hl.kind === "police" && Math.floor(tick / 8) % 2) { g.fillStyle = "#ff3b2f"; g.beginPath(); g.arc(at.x - hx * unit * 2.1, at.y - hy * unit * 2.1, Math.max(2, unit * 0.16), 0, 6.283); g.fill(); }
  }
}
