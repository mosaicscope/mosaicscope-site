import type { Simulation } from "../sim/Simulation";
import { Character, Lod, Phys, Toy } from "../entities/types";
import { TOYS } from "../content/toys";
import { T, TILE_HEIGHT } from "../world/World";
import { Camera } from "./Camera";
import { Terrain, drawTallTile, drawPoi } from "./Terrain";
import { Particles } from "./Particles";
import { Lighting, Rain } from "./Lighting";
import { pose, solve, drawFigure, pathSilhouette, J } from "./StickFigure";
import { drawToy, drawIsoBox } from "./ToyArt";
import { INK } from "./palette";
import type { DebugFlags } from "../debug/flags";
import { friendship, hostility } from "../social/Social";
import { LOD_NAMES } from "../entities/types";

export type Quality = 0 | 1 | 2; // low, medium, high
interface Item { d: number; kind: 0 | 1 | 2 | 3; ref: number; sx: number; sy: number } // 0 char, 1 toy, 2 tall tile, 3 poi

export interface RenderOptions { selected: number; hovered: number; debug: DebugFlags; reduceMotion: boolean; quality: Quality; showNames: boolean }

/**
 * Canvas 2D renderer. Rendering reads simulation state and never writes simulation state
 * (anim.phase/poseT are cosmetic and owned here). Draw order: ground chunks -> shadows ->
 * depth-sorted world (tiles, props, toys, figures; background figures batched by colour) ->
 * particles -> lighting -> rain -> bubbles/labels -> debug.
 */
export class Renderer {
  readonly cam = new Camera();
  readonly g: CanvasRenderingContext2D;
  terrain: Terrain;
  particles: Particles;
  private lighting = new Lighting();
  private rain = new Rain();
  private items: Item[] = [];
  private nItems = 0;
  private pt = { x: 0, y: 0 };
  private pt2 = { x: 0, y: 0 };
  private dpr = 1;
  private time = 0;
  private lastPose = new Map<number, string>();
  /** screen boxes of drawn figures for picking: id, x0, y0, x1, y1 */
  private pickBoxes: number[] = [];
  stats = { items: 0, figures: 0, silhouettes: 0, batches: 0, frameMs: 0 };

  constructor(public canvas: HTMLCanvasElement, public sim: Simulation) {
    const g = canvas.getContext("2d", { alpha: false });
    if (!g) throw new Error("Canvas 2D is not available");
    this.g = g;
    this.terrain = new Terrain(sim.world);
    this.particles = new Particles(sim.cfg.maxParticles);
    this.cam.worldSize = sim.world.size;
    this.cam.lookAt(sim.player.x, sim.player.y, true);
    this.cam.follow = sim.playerId;
    sim.bus.on("fx", (f) => {
      const near = Math.hypot(f.x - this.cam.x, f.y - this.cam.y) < 40 / Math.max(0.5, this.cam.zoom);
      if (near) this.particles.spawn(f.kind, f.x, f.y, f.z, f.n, f.color, f.text);
    });
  }

  setSim(sim: Simulation): void {
    this.sim = sim; this.terrain = new Terrain(sim.world); this.particles.clear(); this.lastPose.clear();
    this.cam.worldSize = sim.world.size; this.cam.lookAt(sim.player.x, sim.player.y, true); this.cam.follow = sim.playerId;
    sim.bus.on("fx", (f) => { if (Math.hypot(f.x - this.cam.x, f.y - this.cam.y) < 40) this.particles.spawn(f.kind, f.x, f.y, f.z, f.n, f.color, f.text); });
  }

  resize(quality: Quality): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const native = window.devicePixelRatio || 1;
    this.dpr = quality === 0 ? Math.min(1, native) * 0.75 : quality === 1 ? Math.min(1.5, native) : Math.min(2, native);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.cam.resize(w, h);
    this.particles.scale = quality === 0 ? 0.35 : quality === 1 ? 0.7 : 1;
  }

  private push(d: number, kind: Item["kind"], ref: number, sx: number, sy: number): void {
    let it = this.items[this.nItems];
    if (!it) { it = { d: 0, kind: 0, ref: 0, sx: 0, sy: 0 }; this.items[this.nItems] = it; }
    it.d = d; it.kind = kind; it.ref = ref; it.sx = sx; it.sy = sy;
    this.nItems++;
  }

  render(alpha: number, dt: number, o: RenderOptions): void {
    const t0 = performance.now();
    const sim = this.sim, g = this.g, cam = this.cam, z = cam.zoom;
    this.time += o.reduceMotion ? dt * 0.4 : dt;
    const time = this.time;
    // camera follow
    if (cam.follow >= 0 && sim.chars[cam.follow]) { const f = sim.chars[cam.follow]; cam.lookAt(f.x, f.y); }
    cam.update(dt, o.reduceMotion);
    sim.focus.x = cam.x; sim.focus.y = cam.y;

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = INK; g.fillRect(0, 0, cam.viewW, cam.viewH);
    this.terrain.draw(g, cam);

    // visible tile range (bounding box of the screen corners in world space)
    const c1 = cam.toWorld(0, 0), c2 = cam.toWorld(cam.viewW, 0), c3 = cam.toWorld(0, cam.viewH), c4 = cam.toWorld(cam.viewW, cam.viewH);
    const S = sim.world.size;
    const minX = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x)) - 2), maxX = Math.min(S - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)) + 3);
    const minY = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y)) - 2), maxY = Math.min(S - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)) + 3);
    const inView = (sx: number, sy: number, m: number) => sx > -m && sy > -m && sx < cam.viewW + m && sy < cam.viewH + m * 0.3;

    this.nItems = 0;
    const pt = this.pt;
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      const t = sim.world.tiles[ty * S + tx];
      if (TILE_HEIGHT[t] === undefined && t !== T.TREE) continue;
      if (t === T.STAGE) continue;
      cam.toScreen(tx, ty, 0, pt);
      if (!inView(pt.x, pt.y, 140 * z)) continue;
      this.push(tx + ty + 1, 2, ty * S + tx, pt.x, pt.y);
    }
    for (const p of sim.world.pois) {
      cam.toScreen(p.x, p.y, 0, pt);
      if (!inView(pt.x, pt.y, 120 * z)) continue;
      this.push(p.x + p.y, 3, p.id, pt.x, pt.y);
    }
    // water shimmer (animated, cheap)
    g.fillStyle = "rgba(61,214,255,.06)";
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      if (sim.world.tiles[ty * S + tx] !== T.WATER) continue;
      if (((tx * 7 + ty * 3 + Math.floor(time * 1.5)) % 5) !== 0) continue;
      cam.toScreen(tx + 0.5, ty + 0.5, 0, pt);
      g.beginPath(); g.ellipse(pt.x, pt.y, 14 * z, 4 * z, 0, 0, 6.283); g.fill();
    }

    // shadows + sortables for toys and characters (interpolated)
    g.fillStyle = "rgba(0,0,0,.35)";
    for (const t of sim.toys) {
      if (t.state === "broken" || t.state === "held") continue;
      const x = t.px + (t.x - t.px) * alpha, y = t.py + (t.y - t.py) * alpha;
      cam.toScreen(x, y, 0, pt);
      if (!inView(pt.x, pt.y, 60)) continue;
      const r = (TOYS[t.def].uses.includes("heavy") ? 16 : 7) * z / (1 + t.z * 0.3);
      g.beginPath(); g.ellipse(pt.x, pt.y, r, r * 0.5, 0, 0, 6.283); g.fill();
      this.push(x + y + 0.01, 1, t.id, pt.x, pt.y);
    }
    this.pickBoxes.length = 0;
    for (const c of sim.chars) {
      if (c.lod === Lod.SLEEP) continue;
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      cam.toScreen(x, y, 0, pt);
      if (!inView(pt.x, pt.y, 80 * z)) continue;
      const bg = c.tier === "background" && !c.promoted;
      if (!bg || o.quality > 0) {
        const r = (bg ? 7 : 9) * z * c.look.scale;
        g.globalAlpha = bg ? 0.5 : 1;
        g.beginPath(); g.ellipse(pt.x, pt.y, r, r * 0.45, 0, 0, 6.283); g.fill();
        g.globalAlpha = 1;
      }
      if (c.id === o.selected) { g.strokeStyle = "#c6ff3d"; g.lineWidth = 2; g.beginPath(); g.ellipse(pt.x, pt.y, 16 * z, 7 * z, 0, 0, 6.283); g.stroke(); g.fillStyle = "rgba(0,0,0,.35)"; }
      if (c.id === o.hovered && c.id !== o.selected) { g.strokeStyle = "rgba(238,228,211,.5)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(pt.x, pt.y, 14 * z, 6 * z, 0, 0, 6.283); g.stroke(); g.fillStyle = "rgba(0,0,0,.35)"; }
      this.push(x + y + 0.02, 0, c.id, pt.x, pt.y);
    }

    // depth sort
    const items = this.items, n = this.nItems;
    const view = items.slice(0, n).sort((a, b) => a.d - b.d);
    this.stats.items = n;

    // draw sorted, batching consecutive background silhouettes of the same colour
    let batchColor = "", batching = false, figs = 0, sils = 0, batches = 0;
    const flush = () => { if (batching) { g.stroke(); g.globalAlpha = 1; batching = false; batches++; } };
    const isDark = sim.isDark, party = sim.env.party;
    for (const it of view) {
      if (it.kind === 0) {
        const c = sim.chars[it.ref];
        const bg = c.tier === "background" && !c.promoted;
        const k = 0.44 * z * c.look.scale;
        const moving = Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 0.0005;
        const spd = Math.hypot(c.x - c.px, c.y - c.py) * 60;
        c.anim.phase += spd * dt * 5.5;
        const name = this.poseName(c, moving, spd);
        if (this.lastPose.get(c.id) !== name) { this.lastPose.set(c.id, name); c.anim.poseT = 0; } else c.anim.poseT += dt;
        if (c.anim.flash > 0) c.anim.flash -= dt;
        const dir = this.screenDir(c);
        const zOff = c.z * 26 * z;
        if (bg) {
          // background: cheap animation (sine idle, simple walk), batched strokes
          const a = pose(moving ? "walk" : c.anim.pose === "dance" ? "dance" : c.anim.pose === "panic" ? "panic" : "idle", "loose", time + c.seedPhase, c.anim.phase, spd, 0);
          solve(a, it.sx, it.sy - zOff, k, dir);
          const col = c.look.color;
          if (!batching || col !== batchColor) { flush(); g.strokeStyle = col; g.globalAlpha = 0.42; g.lineWidth = Math.max(0.9, 2.6 * k); g.lineCap = "round"; g.beginPath(); batching = true; batchColor = col; }
          pathSilhouette(g, k);
          sils++;
          if (o.selected === c.id || o.debug.hitboxes) this.pickBoxes.push(c.id, it.sx - 10 * z, it.sy - 50 * z, it.sx + 10 * z, it.sy);
          continue;
        }
        flush();
        const a = pose(name, c.style, time + c.seedPhase, c.anim.phase, spd, c.anim.poseT);
        solve(a, it.sx, it.sy - zOff, k, dir);
        // held toy behind or in front depending on hand
        drawFigure(g, c, it.sx, it.sy - zOff, k, dir, time, c.anim.flash, 1);
        this.drawHeld(c, k, dir, a.armR);
        figs++;
        this.pickBoxes.push(c.id, it.sx - 14 * z, it.sy - zOff - 52 * z * c.look.scale, it.sx + 14 * z, it.sy + 4);
      } else if (it.kind === 1) {
        flush();
        const t = sim.toys[it.ref];
        this.drawWorldToy(t, it.sx, it.sy, z, alpha);
      } else if (it.kind === 2) {
        flush();
        const t = sim.world.tiles[it.ref];
        drawTallTile(g, t, it.sx, it.sy, z, time, (it.ref * 0.618) % 1);
      } else {
        flush();
        drawPoi(g, sim.world.pois[it.ref], it.sx, it.sy, z, time, party, isDark);
      }
    }
    flush();
    this.stats.figures = figs; this.stats.silhouettes = sils; this.stats.batches = batches;

    this.particles.update(dt);
    this.particles.draw(g, cam);
    if (party && !o.reduceMotion && Math.random() < dt * 6) this.particles.spawn("music", sim.stagePoint.x - 2 + Math.random() * 2, sim.stagePoint.y + Math.random() * 2, 1.5, 1, ["#c6ff3d", "#ff7ad9", "#3dd6ff"][Math.floor(Math.random() * 3)]);
    this.lighting.draw(g, sim, cam, time, o.quality, o.reduceMotion);
    this.rain.draw(g, sim.env.rain, cam.viewW, cam.viewH, dt, o.quality === 0 ? 60 : o.quality === 1 ? 160 : 260, o.reduceMotion);

    this.drawBubbles(view, o);
    this.drawDebug(o.debug, alpha);
    this.stats.frameMs = performance.now() - t0;
  }

  private poseName(c: Character, moving: boolean, spd: number): string {
    if (c.phys === Phys.DOWN) return "down";
    if (c.phys === Phys.RECOVER) return "recover";
    if (c.phys === Phys.STUMBLE) return "stumble";
    const p = c.anim.pose;
    if (p === "panic") return moving ? "panic" : "cheer";
    if (p && p !== "auto") {
      if (moving && (p === "watch" || p === "cheer" || p === "search" || p === "phone" || p === "think")) return spd > 2.6 ? "run" : "walk";
      return p;
    }
    if (c.talkWith >= 0) return "talk";
    if (moving) return spd > 2.6 ? "run" : "walk";
    return "idle";
  }

  /** +1 when the character faces screen-right, -1 for screen-left. */
  private screenDir(c: Character): number {
    const sx = Math.cos(c.facing) - Math.sin(c.facing);
    return sx >= 0 ? 1 : -1;
  }

  private drawHeld(c: Character, k: number, dir: number, armR: number): void {
    if (c.hand < 0) return;
    const t = this.sim.toys[c.hand];
    if (!t) return;
    const def = TOYS[t.def];
    if (def.uses.includes("shield")) { drawToy(this.g, t.def, J[10] + 3 * k * dir, J[11] - 4 * k, k, 0, t.color, 1, dir); return; }
    // melee toys extend along the forearm (elbow -> hand)
    const ang = Math.atan2(J[15] - J[13], J[14] - J[12]);
    drawToy(this.g, t.def, J[14], J[15], k, def.uses.includes("melee") ? ang : 0, t.color, 1, def.uses.includes("melee") ? 1 : dir);
    void armR;
  }

  private drawWorldToy(t: Toy, sx: number, sy: number, z: number, alpha: number): void {
    const g = this.g;
    const zz = t.pz + (t.z - t.pz) * alpha;
    const y = sy - zz * 26 * z;
    if (t.def === "box") { drawIsoBox(g, sx, sy, 10 * z, 5 * z, 12 * z, "#b07a3a", "#8a5a28", "#6b4420"); g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = z; g.beginPath(); g.moveTo(sx - 5 * z, sy - 14.5 * z); g.lineTo(sx + 5 * z, sy - 19.5 * z); g.stroke(); return; }
    if (t.def === "crate") { drawIsoBox(g, sx, sy, 14 * z, 7 * z, 18 * z, "#7a4a22", "#5a3618", "#4a2c14"); return; }
    drawToy(g, t.def, sx, y - 4 * z, 0.41 * z, t.angle, t.color, 1, 1);
    // yo-yo string
    if (t.tether >= 0) {
      const c = this.sim.chars[t.tether];
      if (c) { this.cam.toScreen(c.x, c.y, c.z + 1, this.pt2); g.strokeStyle = "rgba(238,228,211,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(this.pt2.x, this.pt2.y); g.lineTo(sx, y - 4 * z); g.stroke(); }
    }
  }

  private drawBubbles(view: Item[], o: RenderOptions): void {
    const sim = this.sim, g = this.g, cam = this.cam, z = cam.zoom;
    const maxB = o.quality === 0 ? 4 : 8;
    let shown = 0;
    g.textBaseline = "alphabetic";
    // nearest to the camera centre first
    const cands: Item[] = [];
    for (const it of view) if (it.kind === 0) { const c = sim.chars[it.ref]; if ((c.bubble && c.bubble.until > sim.tick) || (o.showNames && (c.tier === "principal" || c.tier === "player")) || c.id === o.selected || c.id === o.hovered) cands.push(it); }
    cands.sort((a, b) => Math.hypot(a.sx - cam.viewW / 2, a.sy - cam.viewH / 2) - Math.hypot(b.sx - cam.viewW / 2, b.sy - cam.viewH / 2));
    for (const it of cands) {
      const c = sim.chars[it.ref];
      const headY = it.sy - (c.z * 26 + 56 * c.look.scale) * z;
      if ((o.showNames && (c.tier === "principal" || c.tier === "player") && z > 0.6) || c.id === o.selected || c.id === o.hovered) {
        g.font = `600 ${Math.round(Math.max(10, 10 * Math.min(1.3, z)))}px "IBM Plex Mono", ui-monospace, monospace`;
        g.textAlign = "center";
        g.fillStyle = "rgba(14,11,10,.7)";
        const w = g.measureText(c.name).width + 8;
        g.fillRect(it.sx - w / 2, it.sy + 4, w, 14);
        g.fillStyle = c.tier === "player" ? "#ec2a1c" : c.look.color;
        g.fillText(c.name, it.sx, it.sy + 15);
        g.textAlign = "start";
      }
      if (!c.bubble || c.bubble.until <= sim.tick || shown >= maxB) continue;
      if (c.tier !== "player" && c.id !== o.selected && Math.hypot(it.sx - cam.viewW / 2, it.sy - cam.viewH / 2) > Math.min(cam.viewW, cam.viewH) * 0.55) continue;
      shown++;
      const txt = c.bubble.text;
      const fs = Math.round(Math.max(11, Math.min(14, 12 * z)));
      g.font = `${c.bubble.kind === "shout" ? "700 " : ""}${fs}px "IBM Plex Mono", ui-monospace, monospace`;
      const lines = wrap(g, txt, 190);
      const w = Math.min(200, Math.max(...lines.map((l) => g.measureText(l).width))) + 14, h = lines.length * (fs + 3) + 10;
      const bx = Math.max(4, Math.min(cam.viewW - w - 4, it.sx - w / 2)), by = Math.max(4, headY - h - 10);
      const fade = Math.min(1, (c.bubble.until - sim.tick) / 20);
      g.globalAlpha = fade;
      g.fillStyle = c.bubble.kind === "shout" ? "#ec2a1c" : "#eee4d3";
      roundRect(g, bx, by, w, h, 6); g.fill();
      g.beginPath(); g.moveTo(it.sx - 5, by + h); g.lineTo(it.sx + 5, by + h); g.lineTo(it.sx, by + h + 7); g.closePath(); g.fill();
      g.fillStyle = c.bubble.kind === "shout" ? "#eee4d3" : "#0e0b0a";
      lines.forEach((l, i) => g.fillText(l, bx + 7, by + 5 + (i + 1) * (fs + 3) - 3));
      g.globalAlpha = 1;
    }
  }

  private drawDebug(d: DebugFlags, alpha: number): void {
    const sim = this.sim, g = this.g, cam = this.cam, z = cam.zoom, pt = this.pt, p2 = this.pt2;
    const any = Object.values(d).some(Boolean);
    if (!any) return;
    g.lineWidth = 1; g.font = "10px ui-monospace, monospace";
    const vis = (c: Character) => { cam.toScreen(c.x, c.y, 0, pt); return pt.x > -40 && pt.y > -40 && pt.x < cam.viewW + 40 && pt.y < cam.viewH + 40; };
    if (d.grid) {
      const h = sim.charHash, cs = h.cellSize;
      g.strokeStyle = "rgba(61,214,255,.25)";
      h.forEachCell((cx, cy, n) => {
        const x0 = cx * cs, y0 = cy * cs;
        cam.toScreen(x0, y0, 0, pt);
        g.beginPath(); g.moveTo(pt.x, pt.y);
        cam.toScreen(x0 + cs, y0, 0, pt); g.lineTo(pt.x, pt.y);
        cam.toScreen(x0 + cs, y0 + cs, 0, pt); g.lineTo(pt.x, pt.y);
        cam.toScreen(x0, y0 + cs, 0, pt); g.lineTo(pt.x, pt.y); g.closePath(); g.stroke();
        cam.toScreen(x0 + cs / 2, y0 + cs / 2, 0, pt); g.fillStyle = "rgba(61,214,255,.8)"; g.fillText(String(n), pt.x - 3, pt.y + 3);
      });
    }
    for (const c of sim.chars) {
      if (c.lod === Lod.SLEEP || !vis(c)) continue;
      const sx = pt.x, sy = pt.y;
      if (d.collision) { g.strokeStyle = "rgba(198,255,61,.7)"; g.beginPath(); g.ellipse(sx, sy, c.radius * 45 * z, c.radius * 22 * z, 0, 0, 6.283); g.stroke(); }
      if (d.hitboxes && c.tier !== "background") { g.strokeStyle = "rgba(236,42,28,.7)"; g.strokeRect(sx - 9 * z, sy - (c.z * 26 + 46) * z, 18 * z, 46 * z); }
      if (d.perception && (c.tier === "principal")) { g.strokeStyle = "rgba(246,182,44,.35)"; g.beginPath(); g.ellipse(sx, sy, 10 * 45 * z, 10 * 22 * z, 0, 0, 6.283); g.stroke(); }
      if (d.tiers) { g.fillStyle = ["#c6ff3d", "#3dd6ff", "#b48cff", "#9a8d80", "#555"][c.lod]; g.fillRect(sx - 3, sy + 2, 6, 6); }
      if (d.labels && c.tier !== "background") { g.fillStyle = "#eee4d3"; g.fillText(`${c.mode}${c.goal ? ":" + c.goal.id + "/" + (c.goal.plan[c.goal.stepIdx]?.kind ?? "") : ""}`, sx + 8, sy - 4); }
      if (d.labels && c.tier === "background") { g.fillStyle = "rgba(238,228,211,.5)"; g.fillText(LOD_NAMES[c.lod][0] + (c.promoted ? "+" : ""), sx + 5, sy); }
      if (d.velocity && (c.vx || c.vy || c.kx || c.ky)) { cam.toScreen(c.x + (c.vx + c.kx) * 0.5, c.y + (c.vy + c.ky) * 0.5, 0, p2); g.strokeStyle = "#ff7ad9"; g.beginPath(); g.moveTo(sx, sy); g.lineTo(p2.x, p2.y); g.stroke(); }
      if (d.paths && c.path && c.tier !== "background") {
        g.strokeStyle = "rgba(61,214,255,.6)"; g.beginPath(); g.moveTo(sx, sy);
        for (let i = c.pathIdx; i * 2 < c.path.length; i++) { cam.toScreen(c.path[i * 2], c.path[i * 2 + 1], 0, p2); g.lineTo(p2.x, p2.y); }
        g.stroke();
      }
      if (d.social && c.tier === "principal") {
        for (const [id, r] of c.rel) {
          const o = sim.chars[id];
          if (!o || o.tier === "background") continue;
          const f = friendship(r), h = hostility(r);
          if (f < 0.3 && h < 0.3) continue;
          cam.toScreen(o.x, o.y, 0, p2);
          g.strokeStyle = h > f ? `rgba(236,42,28,${h})` : `rgba(198,255,61,${f * 0.8})`;
          g.beginPath(); g.moveTo(sx, sy - 20 * z); g.lineTo(p2.x, p2.y - 20 * z); g.stroke();
        }
      }
    }
    if (d.velocity || d.collision) for (const t of sim.toys) {
      if (t.state === "broken" || t.state === "held") continue;
      cam.toScreen(t.x, t.y, t.z, pt);
      if (d.collision) { g.strokeStyle = "rgba(198,255,61,.7)"; g.beginPath(); g.ellipse(pt.x, pt.y, t.radius * 45 * z, t.radius * 22 * z, 0, 0, 6.283); g.stroke(); }
      if (d.velocity && (t.vx || t.vy)) { cam.toScreen(t.x + t.vx * 0.3, t.y + t.vy * 0.3, t.z + t.vz * 0.3, p2); g.strokeStyle = "#f6b62c"; g.beginPath(); g.moveTo(pt.x, pt.y); g.lineTo(p2.x, p2.y); g.stroke(); }
    }
    if (d.contacts) { g.fillStyle = "#ec2a1c"; for (const c of sim.physics.contactPoints) { cam.toScreen(c.x, c.y, c.z, pt); g.fillRect(pt.x - 2, pt.y - 2, 4, 4); } }
    if (d.events) {
      for (const e of sim.events.history.slice(-30)) {
        const age = (sim.tick - e.tick) / 60;
        if (age > 15) continue;
        cam.toScreen(e.x, e.y, 0, pt);
        g.strokeStyle = `rgba(236,42,28,${1 - age / 15})`; g.beginPath(); g.ellipse(pt.x, pt.y, e.radius * 32 * z, e.radius * 16 * z, 0, 0, 6.283); g.stroke();
        g.fillStyle = `rgba(238,228,211,${1 - age / 15})`; g.fillText(e.type + (e.cause >= 0 ? " ←" + e.cause : "") + " #" + e.id, pt.x + 4, pt.y - 4);
      }
    }
    void alpha;
  }

  /** Character under a screen point (topmost), or -1. */
  pickCharacter(sx: number, sy: number): number {
    const b = this.pickBoxes;
    let best = -1, bd = Infinity;
    for (let i = 0; i < b.length; i += 5) {
      if (sx >= b[i + 1] && sx <= b[i + 3] && sy >= b[i + 2] && sy <= b[i + 4]) {
        const cx = (b[i + 1] + b[i + 3]) / 2, d = Math.abs(sx - cx) - b[i + 4] * 0.001; // prefer nearer the camera (lower on screen)
        if (d < bd) { bd = d; best = b[i]; }
      }
    }
    return best;
  }

  pickToy(sx: number, sy: number): number {
    let best = -1, bd = 22 * Math.max(0.6, this.cam.zoom);
    for (const t of this.sim.toys) {
      if (t.state === "broken" || t.state === "held") continue;
      this.cam.toScreen(t.x, t.y, t.z, this.pt);
      const d = Math.hypot(this.pt.x - sx, this.pt.y - 4 - sy);
      if (d < bd) { bd = d; best = t.id; }
    }
    return best;
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(" "), out: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (g.measureText(test).width > max && cur) { out.push(cur); cur = w; } else cur = test;
  }
  if (cur) out.push(cur);
  return out.slice(0, 4);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

