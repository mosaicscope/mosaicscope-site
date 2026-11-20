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

  constructor(private opts: { reduceMotion: () => boolean; setSlow: (on: boolean) => void; project: (x: number, y: number) => { x: number; y: number } }) {
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
    const show = visible && (ps.phase === "search" || ps.spikes.length > 0);
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
  }
}
