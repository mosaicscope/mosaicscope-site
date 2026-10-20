import {applySubstanceMotion,drawSubstanceProps} from './SubstanceMotion';
import {gunGrips} from './GunRig';
import {detailedCrowd} from './CrowdDetail';
import {visibleWeaponMotion} from './WeaponMotion';
import {drawDetachedLimb} from './DamageArt';
import {applyNegativeReaction} from './NegativeReactions';
import {drawDebris,drawFacadeDamage} from "./CivicArt";
import {setDamageBlood} from "./DamageArt";
import { ScreenBounds, beginSignFrame } from "./ScreenBounds";
import { drawUpgradeEffects } from "./UpgradeEffects";
import { drawStreetStories } from "./StreetStories";
import type { Simulation } from "../sim/Simulation";
import { Character, Lod, Phys, Toy } from "../entities/types";
import { TOYS } from "../content/toys";
import { drawLitter } from "./LitterArt";
import { T, TILE_HEIGHT, ROAD_W } from "../world/World";
import { Camera } from "./Camera";
import { Terrain, drawTallTile, drawPoi } from "./Terrain";
import { decorGrid, drawDecor } from "./StreetDecor";
import { Particles } from "./Particles";
import { Lighting, Rain } from "./Lighting";
import { NightFX } from "./NightFX";
import { pose, solve, drawFigure, pathSilhouette, J, gaitOf, applyGait, reachArm, Angles } from "./StickFigure";
import { drawToy, drawIsoBox } from "./ToyArt";
import { INK } from "./palette";
import { drawBuildingTile, GLOW } from "./Buildings";
import { ZooRenderer } from "./Zoo";
import { resetHdBudget } from "./StickFigure";
import { hurtOf } from "../sim/Life";
import { setTextureTier } from "./Textures";
import { AD_BOXES, AdBox } from "./Ads";
import { drawCar, headlights } from "./Cars";
import { lightGreenFor, Light } from "../sim/Traffic";
import type { Graffiti } from "../world/World";
import type { DebugFlags } from "../debug/flags";
import { friendship, hostility } from "../social/Social";
import { LOD_NAMES } from "../entities/types";
import { StreetView } from "./Street2D";

/** The side-on 2D street is switched off: the 3D city is the only view. Flip to true to bring it back. */
const STREET_2D = false;

export type Quality = 0 | 1 | 2 | 3; // low, medium, high, ultra
interface Item { d: number; kind: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; ref: number; sx: number; sy: number } // 0 char, 1 toy, 2 tall tile, 3 poi, 4 car, 5 traffic light, 6 litter, 7 street decor
interface Decal { x: number; y: number; r: number; color: string; born: number; life: number; rot: number }

export interface RenderOptions { selected: number; hovered: number; debug: DebugFlags; reduceMotion: boolean; quality: Quality; showNames: boolean; quietInterface?:boolean }

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
  private glowCv = document.createElement("canvas");
  private glowG: CanvasRenderingContext2D | null = null;
  private rain = new Rain();
  private nightFx = new NightFX();
  private items: Item[] = [];
  private nItems = 0;
  private pt = { x: 0, y: 0 };
  private pt2 = { x: 0, y: 0 };
  private dpr = 1;
  private time = 0;
  private motion = new Map<number,{x:number;y:number;speed:number}>();
  private lastPose = new Map<number, string>();
  private gaits=new WeakMap<Character,ReturnType<typeof gaitOf>>();
  /** screen boxes of drawn figures for picking: id, x0, y0, x1, y1 */
  private pickBoxes: number[] = [];
  stats = { items: 0, figures: 0, silhouettes: 0, batches: 0, frameMs: 0 };
  /** ground stains (fake blood, paint, water) that fade out */
  private decals: Decal[] = [];
  /** smoothed speech-bubble opacity per character (graceful fade in/out) */
  private bubblePositions=new Map<number,{text:string;dx:number;dy:number}>();
  private bubbleAlpha = new Map<number, number>();
  private graffitiMap = new Map<string, Graffiti>();
  private graffitiStamp = -1;
  fakeBlood = true;
  selectedCar = -1;

  constructor(public canvas: HTMLCanvasElement, public sim: Simulation) {
    const g = canvas.getContext("2d", { alpha: false });
    if (!g) throw new Error("Canvas 2D is not available");
    this.g = g;
    this.terrain = new Terrain(sim.world);
    this.particles = new Particles(sim.cfg.maxParticles);
    this.cam.worldSize = sim.world.size;
    this.cam.lookAt(sim.player.x, sim.player.y, true);
    this.cam.follow = sim.playerId;
    sim.bus.on("fx", (f) => this.onFx(f));
  }

  setSim(sim: Simulation): void {
    this.bubblePositions.clear();
    this.sim = sim; this.terrain = new Terrain(sim.world); this.terrain.setUltra(this.qualityNow === 3); this.particles.clear(); this.lastPose.clear(); this.motion.clear();
    this.cam.worldSize = sim.world.size; this.cam.lookAt(sim.player.x, sim.player.y, true); this.cam.follow = sim.playerId;
    sim.bus.on("fx", (f) => this.onFx(f));
  }

  private onFx(f: { kind: string; x: number; y: number; z: number; n?: number; color?: string; text?: string }): void {
    if (Math.hypot(f.x - this.cam.x, f.y - this.cam.y) > 40 / Math.max(0.5, this.cam.zoom)) return;
    if (f.kind === "blood" && !this.fakeBlood) return;
    if (f.kind === "skid") {
      // two dark tyre stripes under the rear axle and a little tyre smoke
      for (let i = 0; i < 2; i++) this.decals.push({ x: f.x + (i - 0.5) * 0.35, y: f.y - (i - 0.5) * 0.35, r: 0.07, color: "rgba(14,11,10,.45)", born: this.time, life: 25, rot: 0 });
      if (this.decals.length > 220) this.decals.splice(0, this.decals.length - 220);
      this.particles.spawn("dust", f.x, f.y, 0.1, f.n ?? 2, "#cfc8c0");
      return;
    }
    this.particles.spawn(f.kind as any, f.x, f.y, f.z, f.n, f.color, f.text);
    if (f.kind === "blood" || f.kind === "paint" || f.kind === "water") {
      const n = f.kind === "blood" ? 3 : 2;
      for (let i = 0; i < n; i++) this.decals.push({ x: f.x + (Math.random() - 0.5) * 0.8, y: f.y + (Math.random() - 0.5) * 0.8, r: 0.12 + Math.random() * (f.kind === "water" ? 0.35 : 0.22), color: f.kind === "blood" ? "#7a0d12" : f.kind === "paint" ? f.color ?? "#ff7ad9" : "rgba(61,214,255,.5)", born: this.time, life: f.kind === "water" ? 6 : 35, rot: Math.random() * 3 });
      if (this.decals.length > 220) this.decals.splice(0, this.decals.length - 220);
    }
  }

  /** Bleeding characters leave drips (called by the renderer each frame for visible ones). */
  drip(x: number, y: number): void {
    if (!this.fakeBlood) return;
    this.decals.push({ x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4, r: 0.06 + Math.random() * 0.1, color: "#7a0d12", born: this.time, life: 40, rot: 0 });
    if (this.decals.length > 220) this.decals.shift();
  }

  resize(quality: Quality): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const native = window.devicePixelRatio || 1;
    // Never render below device pixels: a sub-native canvas is upscaled by the browser and reads as blur on the ground and figures.
    // Lower tiers cap the pixel count instead (fill-rate is the real cost on weak machines); ultra stays at full native sharpness.
    this.dpr = quality === 0 ? Math.min(1.5, native) : quality === 1 ? Math.min(1.5, native) : quality === 2 ? Math.min(2, native) : native;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.cam.resize(w, h);
    this.particles.scale = quality === 0 ? 0.35 : quality === 1 ? 0.7 : quality === 2 ? 1 : 1.4;
    // Ultra: richer textures (2x density, weathering, baked bump light) and supersampled ground
    setTextureTier(quality === 3); this.terrain.setUltra(quality === 3);
    this.qualityNow = quality;
  }

  private push(d: number, kind: Item["kind"], ref: number, sx: number, sy: number): void {
    let it = this.items[this.nItems];
    if (!it) { it = { d: 0, kind: 0, ref: 0, sx: 0, sy: 0 }; this.items[this.nItems] = it; }
    it.d = d; it.kind = kind; it.ref = ref; it.sx = sx; it.sy = sy;
    this.nItems++;
  }

  render(alpha: number, dt: number, o: RenderOptions): void {
    setDamageBlood(this.fakeBlood);
    const t0 = performance.now();
    beginSignFrame(this.cam.viewW,this.cam.viewH);
    const sim = this.sim, g = this.g, cam = this.cam;
    this.time += o.reduceMotion ? dt * 0.4 : dt;
    const time = this.time;
    // camera follow
    if (cam.follow >= 0 && sim.chars[cam.follow]) { const f = sim.chars[cam.follow]; cam.lookAt(f.x, f.y); }
    // zoomed right in: the camera drops to street level for a flat 2D side view; zoom out to go back to 3D
    // (hysteresis stops it flickering at the boundary mid-pinch; a quick crossfade hides the switch)
    const want2D = STREET_2D && (this.in2D ? cam.zoom > 2.8 : cam.zoom > 3.4);
    if (want2D !== this.in2D) { this.in2D = want2D; this.crossfade(); }
    if (want2D) { cam.update(dt, o.reduceMotion); this.render2D(alpha, dt, o); if (o.quality === 3) this.cinematic(sim); this.stats.frameMs = performance.now() - t0; return; }
    cam.update(dt, o.reduceMotion);
    const z=cam.zoom;
    sim.focus.x = cam.x; sim.focus.y = cam.y;

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = INK; g.fillRect(0, 0, cam.viewW, cam.viewH);
    this.terrain.draw(g, cam);
    // ground decals
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const dcl = this.decals[i], age = this.time - dcl.born;
      if (age > dcl.life) { this.decals.splice(i, 1); continue; }
      cam.toScreen(dcl.x, dcl.y, 0, this.pt);
      if (this.pt.x < -20 || this.pt.y < -20 || this.pt.x > cam.viewW + 20 || this.pt.y > cam.viewH + 20) continue;
      g.globalAlpha = Math.min(0.85, (1 - age / dcl.life) * 1.4);
      g.fillStyle = dcl.color;
      g.beginPath(); g.ellipse(this.pt.x, this.pt.y, dcl.r * 45 * z, dcl.r * 22 * z, dcl.rot * 0.2, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
    // graffiti lookup (rebuilt only when the list changes)
    const gs = sim.world.graffiti.length + (sim.world.graffiti[0]?.id ?? 0) * 1000;
    if (gs !== this.graffitiStamp) { this.graffitiStamp = gs; this.graffitiMap.clear(); for (const gr of sim.world.graffiti) this.graffitiMap.set(`${gr.tx},${gr.ty},${gr.face}`, gr); }

    // visible tile range (bounding box of the screen corners in world space)
    const c1 = cam.toWorld(0, 0), c2 = cam.toWorld(cam.viewW, 0), c3 = cam.toWorld(0, cam.viewH), c4 = cam.toWorld(cam.viewW, cam.viewH);
    const S = sim.world.size;
    const minX = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x)) - 2), maxX = Math.min(S - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)) + 12);
    const minY = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y)) - 2), maxY = Math.min(S - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)) + 12);
    const inView = (sx: number, sy: number, m: number) => sx > -m && sy > -m && sx < cam.viewW + m && sy < cam.viewH + m * 0.3;

    this.nItems = 0;
    this.viewB.clear();
    resetHdBudget(Math.abs(cam.targetZoom-z)>.025?12:o.quality === 3 ? 400 : o.quality === 2 ? 40 : o.quality === 1 ? 20 : 0);
    const pt = this.pt;
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      const t = sim.world.tiles[ty * S + tx];
      if (TILE_HEIGHT[t] === undefined && t !== T.TREE && t !== T.BUILDING) continue;
      if (t === T.STAGE) continue;
      cam.toScreen(tx, ty, 0, pt);
      // towers rise far above their footprint: keep tiles whose base is below the screen edge
      if (t === T.BUILDING ? !(pt.x > -140 * z && pt.x < cam.viewW + 140 * z && pt.y > -60 * z && pt.y < cam.viewH + 330 * z) : !inView(pt.x, pt.y, 140 * z)) continue;
      this.push(tx + ty + 1, 2, ty * S + tx, pt.x, pt.y);
      if (t === T.BUILDING) this.viewB.add(sim.world.buildingOf[ty * S + tx]);
    }
    for (const p of sim.world.pois) {
      cam.toScreen(p.x, p.y, 0, pt);
      if (!inView(pt.x, pt.y, 120 * z)) continue;
      this.push(p.x + p.y, 3, p.id, pt.x, pt.y);
    }
    // street dressing (kerb trees, planters, bollards, bike racks, cafe tables); skipped when zoomed far out
    if (z >= 0.5) {
      const dg = decorGrid(sim.world);
      for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
        if (!dg[ty * S + tx]) continue;
        cam.toScreen(tx + 0.5, ty + 0.5, 0, pt);
        if (inView(pt.x, pt.y, 70 * z)) this.push(tx + ty + 1, 7, ty * S + tx, pt.x, pt.y);
      }
    }
    // water: drifting ripple crests (continuous across tiles, driven by world position) and sun glints
    this.drawWater(g, sim, o, minX, maxX, minY, maxY, time);

    // real street names painted on the road between intersections
    this.streetLabels(g, sim, z, inView);

    // shadows + sortables for toys and characters (interpolated)
    g.fillStyle = "rgba(0,0,0,.35)";
    for (const t of sim.toys) {
      if (t.state === "broken" || t.state === "held") continue;
      const x = t.px + (t.x - t.px) * alpha, y = t.py + (t.y - t.py) * alpha;
      cam.toScreen(x, y, 0, pt);
      if (!inView(pt.x, pt.y, 60)) continue;
      const r = (TOYS[t.def].uses.includes("heavy") ? 16 : 7) * z / (1 + t.z * 0.3);
      g.beginPath(); g.ellipse(pt.x, pt.y, r, r * 0.5, 0, 0, 6.283); g.fill();
      this.push(this.behind(x, y, x + y + 0.01), 1, t.id, pt.x, pt.y);
    }
    for(const c of sim.chars){if(c.inside>=0)continue;for(let wi=0;wi<c.wounds.length;wi++){const l=c.wounds[wi].detached;if(!l)continue;cam.toScreen(l.x,l.y,l.z,pt);if(inView(pt.x,pt.y,45*z))this.push(this.behind(l.x,l.y,l.x+l.y+.01),8,c.id*8+wi,pt.x,pt.y);}}
    // litter on the ground: cans, bottles, wrappers and cups
    for (const l of sim.litter.pieces) {
      if (l.taken) continue;
      cam.toScreen(l.x, l.y, 0, pt);
      if (!inView(pt.x, pt.y, 30)) continue;
      this.push(this.behind(l.x, l.y, l.x + l.y - 0.02), 6, l.id, pt.x, pt.y);
    }
    this.pickBoxes.length = 0;
    AD_BOXES.length = 0;
    // cars and traffic lights
    for (const v of sim.vehicles) {
      cam.toScreen(v.x, v.y, 0, pt);
      if (!inView(pt.x, pt.y, 80 * z)) continue;
      this.push(this.behind(v.x, v.y, v.x + v.y + 0.03), 4, v.id, pt.x, pt.y);
    }
    // one signal pole per intersection, on the kerb at its south-east corner (ref = r * 64 + c)
    const LP = sim.world.period, nl = sim.world.maxLine;
    for (let r = 0; r <= nl; r++) for (let cc = 0; cc <= nl; cc++) {
      const lx = cc * LP + ROAD_W + 0.15, ly = r * LP + ROAD_W + 0.15;
      if (lx > S || ly > S) continue;
      cam.toScreen(lx, ly, 0, pt);
      if (!inView(pt.x, pt.y, 80 * z)) continue;
      this.push(lx + ly, 5, r * 64 + cc, pt.x, pt.y);
    }
    for (const c of sim.chars) {
      if (c.lod === Lod.SLEEP || c.inside >= 0 || c.inCar >= 0) continue;
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      cam.toScreen(x, y, 0, pt);
      if (!inView(pt.x, pt.y, 80 * z)) continue;
      const bg = c.tier === "background" && !c.promoted && z < 1.25 && c.emo.fear<.65 && c.emo.frustration<.7 && c.emo.mood>-.55;
      if (!bg || o.quality > 0) {
        const r = (bg ? 7 : 9) * z * c.look.scale;
        g.globalAlpha = bg ? 0.5 : 1;
        g.beginPath(); g.ellipse(pt.x, pt.y, r, r * 0.45, 0, 0, 6.283); g.fill();
        g.globalAlpha = 1;
      }
      if (c.id === o.selected) { g.strokeStyle = "#c6ff3d"; g.lineWidth = 2; g.beginPath(); g.ellipse(pt.x, pt.y, 16 * z, 7 * z, 0, 0, 6.283); g.stroke(); g.fillStyle = "rgba(0,0,0,.35)"; }
      if (c.id === o.hovered && c.id !== o.selected) { g.strokeStyle = "rgba(238,228,211,.5)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(pt.x, pt.y, 14 * z, 6 * z, 0, 0, 6.283); g.stroke(); g.fillStyle = "rgba(0,0,0,.35)"; }
      this.push(this.behind(x, y, x + y + 0.02), 0, c.id, pt.x, pt.y);
    }

    // what to keep visible behind buildings: the player (or whoever the camera follows)
    const focusC = sim.chars[cam.follow >= 0 ? cam.follow : sim.playerId];
    const fv = focusC && focusC.inCar >= 0 ? sim.vehicles[focusC.inCar] : null;
    const fx0 = fv ? fv.x : focusC?.x ?? 0, fy0 = fv ? fv.y : focusC?.y ?? 0;
    cam.toScreen(fx0, fy0, 0.8, this.pt2);
    const focusSX = this.pt2.x, focusSY = this.pt2.y;
    this.updateCutaway(fx0, fy0, focusSX, focusSY, z, dt);
    // depth sort
    const items = this.items, n = this.nItems;
    const view = items.slice(0, n).sort((a, b) => a.d - b.d);
    const detail=detailedCrowd(view.filter(i=>i.kind===0).map(i=>sim.chars[i.ref]),cam.x,cam.y,[20,32,48,72][o.quality],o.selected,o.hovered,cam.follow);
    const workingCrews=new Set(Object.values(sim.world.civicDamage).map(d=>d.crew));
    this.stats.items = n;

    // draw sorted, batching consecutive background silhouettes of the same colour
    let batchColor = "", batching = false, figs = 0, sils = 0, batches = 0;
    const flush = () => { if (batching) { g.stroke(); g.globalAlpha = 1; batching = false; batches++; } };
    const isDark = sim.isDark, party = sim.env.party;
    for (const it of view) {
      if (it.kind === 0) {
        const c = sim.chars[it.ref];
        const bg = !detail.has(c.id);
        const k = 0.44 * z * c.look.scale;
        const wx=c.px+(c.x-c.px)*alpha,wy=c.py+(c.y-c.py)*alpha;
        const previous=this.motion.get(c.id),distance=previous?Math.hypot(wx-previous.x,wy-previous.y):0;
        const instantaneous=distance<2?Math.min(9,distance/Math.max(dt,.001)):0;
        const spd=(previous?.speed??0)+(instantaneous-(previous?.speed??0))*(1-Math.exp(-dt*18));
        this.motion.set(c.id,{x:wx,y:wy,speed:spd});
        const moving=spd>.12;
        let G=this.gaits.get(c);if(!G){G=gaitOf(c.id);this.gaits.set(c,G);}
        c.anim.phase += Math.min(distance,.18)*Math.PI*2/1.65*G.cadence;
        const name = this.poseName(c, moving, spd);
        if (this.lastPose.get(c.id) !== name) { this.lastPose.set(c.id, name); c.anim.poseT = 0; } else c.anim.poseT += dt;
        if (c.anim.flash > 0) c.anim.flash -= dt;
        const dir = this.screenDir(c);
        const zOff = c.z * 26 * z;
        if (bg) {
          // background: cheap animation (sine idle, simple walk), batched strokes
          const a = pose(moving ? "walk" : c.anim.pose === "dance" ? "dance" : c.anim.pose === "panic" ? "panic" : "idle", "loose", time + c.seedPhase, c.anim.phase, spd, 0);
          applyGait(a, G);
          if (moving) this.foreshorten(a, c);
          solve(a, it.sx, it.sy - zOff, k, dir);
          const col = c.look.color;
          if (!batching || col !== batchColor) { flush(); g.strokeStyle = col; g.globalAlpha = 0.42; g.lineWidth = Math.max(0.9, 2.6 * k); g.lineCap = "round"; g.beginPath(); batching = true; batchColor = col; }
          pathSilhouette(g, k);
          sils++;
          this.pickBoxes.push(c.id, it.sx - 10 * z, it.sy - 50 * z, it.sx + 10 * z, it.sy);
          continue;
        }
        flush();
        const a = pose(name, c.style, time + c.seedPhase, c.anim.phase, spd, c.anim.poseT);
        applyGait(a, G);
        if (c.wounds.length && !a.lying) {
          // a bad leg barely swings and the body drops onto the good one; a hurt torso hunches; a head knock lolls
          const h = hurtOf(c);
          if (h.leg > 0 && moving) { const k = Math.min(0.7, h.leg * 0.25); a.thighR *= 1 - k; a.bendR *= 1 - k; a.bob += Math.max(0, Math.sin(c.anim.phase)) * 3 * k; }
          if (h.torso > 0) { a.lean += Math.min(0.35, h.torso * 0.1); a.armL = Math.max(a.armL, 0.6); a.foreL = Math.max(a.foreL, 1.6); }
          if (h.head >= 2) a.tilt += Math.sin(time * 1.3 + c.id) * Math.min(0.3, h.head * 0.08);
          if (h.arm > 0 && name !== "throw" && name !== "swing") { a.armR *= 0.3; a.foreR = Math.max(a.foreR, 1.4); }
        }
        applyNegativeReaction(a,c,time,spd,name,o.reduceMotion);
        if (moving && (name === "walk" || name === "run" || name === "panic")) this.foreshorten(a, c);
        applySubstanceMotion(a,c,sim.tick,time,o.reduceMotion);
        const held = c.hand >= 0 ? sim.toys[c.hand] : undefined;
        const gun = held && TOYS[held.def]?.weapon?.gun && !a.lying;
        if(gun){
          const angle=Math.atan2((Math.sin(c.facing)+Math.cos(c.facing))*.5,Math.abs(Math.cos(c.facing)-Math.sin(c.facing)));
          const ca=Math.cos(angle),sa=Math.sin(angle),shx=a.hipX+Math.sin(a.lean)*37*.93,shy=-61+a.bob-Math.cos(a.lean)*37*.93;
          const grip=(side:0|1,x:number,y:number)=>reachArm(a,side,shx,shy,shx+x*ca-y*sa,shy+x*sa+y*ca);
          const mechanism=visibleWeaponMotion(c.weaponAction,sim.tick,performance.now()/1000);
          const reloading=c.weaponAction?.weapon===held.def&&(c.weaponAction.reloadFrom??Infinity)<=sim.tick&&(c.weaponAction.reloadUntil??0)>sim.tick;
          const rig=gunGrips(held.def,mechanism,reloading);grip(1,rig.right.x,rig.right.y);grip(0,rig.left.x,rig.left.y);
        }
        solve(a, it.sx, it.sy - zOff, k, dir);
        // held toy behind or in front depending on hand
        drawFigure(g, c, it.sx, it.sy - zOff, k, dir, time, c.anim.flash, 1, undefined, !!gun || (c.substances?.actionUntil??0)>sim.tick);
        drawSubstanceProps(g,c,sim.tick,time,J,k);
        if(workingCrews.has(c.id)){g.fillStyle='#d4a04e';g.strokeStyle='#555d4b';g.lineWidth=k;g.beginPath();g.moveTo(J[6]-5*k,J[7]+3*k);g.lineTo(J[6]+5*k,J[7]+3*k);g.lineTo(J[0]+5*k,J[1]);g.lineTo(J[0]-5*k,J[1]);g.closePath();g.fill();g.stroke();g.strokeStyle='#e4ddbb';g.lineWidth=2*k;g.beginPath();g.moveTo(J[6]-4*k,J[7]+12*k);g.lineTo(J[6]+4*k,J[7]+12*k);g.stroke();}
        if (c.bleed > 0 && Math.random() < c.bleed * dt * 5) this.drip(c.x, c.y);
        // someone down and bleeding leaves a spreading pool
        if (c.phys === Phys.DOWN && c.bleed > 0 && this.fakeBlood && Math.random() < dt * 1.5) { this.decals.push({ x: c.x + (Math.random() - 0.5) * 0.2, y: c.y + (Math.random() - 0.5) * 0.2, r: 0.18 + Math.random() * 0.2, color: "#6a0a10", born: this.time, life: 60, rot: 0 }); if (this.decals.length > 220) this.decals.shift(); }
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
        if (t === T.BUILDING) {
          const tx = it.ref % S, ty = (it.ref - tx) / S;
          const b = sim.world.buildingAt(tx, ty)!;
          // buildings in front of the player dissolve in a soft circle around them (eased in and out)
          let a = 1;
          const occ = this.cut.get(b.id) ?? 0;
          if (occ > 0.01) {
            const H = b.height * 26 * z, dd = Math.hypot(it.sx - focusSX, (it.sy + 16 * z - H * 0.5) - focusSY) / z;
            const k = Math.min(1, Math.max(0, (dd - 70) / 120)), sm = k * k * (3 - 2 * k);
            a = 1 - occ * (1 - (0.1 + 0.9 * sm));
          }
          drawBuildingTile(g, sim.world, b, tx, ty, it.sx, it.sy, z, time, 1 - sim.daylight + (sim.env.power ? 0 : -0.5), a, this.graffitiMap);
          drawFacadeDamage(g,sim.world,b.id,tx,ty,it.sx,it.sy,z);
        } else drawTallTile(g, t, it.sx, it.sy, z, time, (it.ref * 0.618) % 1);
      } else if (it.kind === 4) {
        flush();
        // Share painter order with the car. Nearer building silhouettes erase these lights too.
        if (1 - sim.daylight > 0.3) {
          const vehicle = sim.vehicles[it.ref], strength = Math.min(1 - sim.daylight, sim.env.power ? 0.65 : 0.35);
          GLOW.push(layer => headlights(layer, cam, vehicle, strength, sim.world, sim.vehicles));
        }
        drawCar(g, cam, sim.vehicles[it.ref], alpha, time, 1 - sim.daylight, it.ref === this.selectedCar);
      } else if (it.kind === 5) {
        flush();
        this.drawLight(it.ref % 64, Math.floor(it.ref / 64), it.sx, it.sy, z);
      } else if (it.kind === 6) {
        flush();
        const l = sim.litter.pieces[it.ref];
        drawLitter(g, l.kind, l.tone, l.rot, it.sx, it.sy, z);
      } else if(it.kind===8){flush();const c=sim.chars[Math.floor(it.ref/8)],w=c?.wounds[it.ref%8];if(c&&w?.detached)drawDetachedLimb(g,c,w,it.sx,it.sy,.44*z*c.look.scale);
      } else if (it.kind === 7) {
        flush();
        if(drawDebris(g,sim.world.civicDamage[`d:${it.ref}`],it.sx,it.sy,z))continue;
        drawDecor(g, decorGrid(sim.world)[it.ref], it.sx, it.sy, z, time, 1 - sim.daylight, (it.ref * 0.618) % 1);
      } else {
        flush();
        if(drawDebris(g,sim.world.civicDamage[`p:${it.ref}`],it.sx,it.sy,z))continue;
        drawPoi(g, sim.world.pois[it.ref], it.sx, it.sy, z, time, party, isDark);
      }
    }
    flush();
    this.stats.figures = figs; this.stats.silhouettes = sils; this.stats.batches = batches;

    this.particles.update(dt);
    this.particles.draw(g, cam);
    if (party && !o.reduceMotion && Math.random() < dt * 6) this.particles.spawn("music", sim.stagePoint.x - 2 + Math.random() * 2, sim.stagePoint.y + Math.random() * 2, 1.5, 1, ["#c6ff3d", "#ff7ad9", "#3dd6ff"][Math.floor(Math.random() * 3)]);
    this.lighting.draw(g, sim, cam, time, o.quality, o.reduceMotion);
    drawStreetStories(g,sim,cam,time,o.reduceMotion);
    this.nightFx.draw(g, sim, cam, time, o.quality, o.reduceMotion, minX, maxX, minY, maxY);
    if (GLOW.length) {
      // emissive pass: windows, bloom and spill go on their own layer so nearer buildings can wipe what is behind them
      const cv = this.glowCv, W = this.canvas.width, H = this.canvas.height;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const lg = this.glowG ?? (this.glowG = cv.getContext("2d")!);
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H); lg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const f of GLOW) f(lg);
      GLOW.length = 0;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(cv, 0, 0); g.restore();
    }
    // the player's private zoo
    if (this.zooAnimals.length) {
      const a = sim.world.areas.find((x) => x.name === "Velvet Zoo") ?? sim.world.areas.find((x) => x.name === "Botanic Gardens");
      if (a) this.zoo.draw(g, cam, a, this.zooAnimals, time, dt);
    }
    this.drawHeli(g, sim, time, z);
    this.rain.draw(g, sim.env.rain, cam.viewW, cam.viewH, dt, o.quality === 0 ? 60 : o.quality === 1 ? 160 : 260, o.reduceMotion);

    drawUpgradeEffects(g, sim, cam, time, o.reduceMotion, o.quality);
    if(!o.quietInterface)this.drawBubbles(view, o);
    this.drawDebug(o.debug, alpha);
    if (o.quality === 3) this.cinematic(sim);
    this.stats.frameMs = performance.now() - t0;
  }

  /** Animated water. Low: the old soft shimmer. Higher tiers: two ripple layers, travelling glints, more on Ultra. */
  private drawWater(g: CanvasRenderingContext2D, sim: Simulation, o: RenderOptions, minX: number, maxX: number, minY: number, maxY: number, time: number): void {
    const S = sim.world.size, cam = this.cam, z = cam.zoom, pt = this.pt, q = o.quality, t = o.reduceMotion ? 0 : time;
    if (q === 0) {
      g.fillStyle = "rgba(61,214,255,.06)";
      for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
        if (sim.world.tiles[ty * S + tx] !== T.WATER || ((tx * 7 + ty * 3 + Math.floor(t * 1.5)) % 5) !== 0) continue;
        cam.toScreen(tx + 0.5, ty + 0.5, 0, pt);
        g.beginPath(); g.ellipse(pt.x, pt.y, 14 * z, 4 * z, 0, 0, 6.283); g.fill();
      }
      return;
    }
    const seg = q >= 3 ? 6 : q === 2 ? 4 : 3;
    g.lineCap = "round";
    for (let layer = 0; layer < (q >= 2 ? 2 : 1); layer++) {
      g.strokeStyle = layer ? "rgba(150,235,255,.2)" : "rgba(255,255,255,.14)"; g.lineWidth = Math.max(1, (layer ? 1 : 1.4) * z);
      g.beginPath();
      for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
        if (sim.world.tiles[ty * S + tx] !== T.WATER) continue;
        // each tile carries one wavy crest running along the iso x axis; phase comes from world position so crests line up neighbour to neighbour
        const v = 0.5 + 0.28 * Math.sin((tx + ty * 0.7) * 1.7 + layer * 2.1 + t * (0.9 + layer * 0.35));
        for (let i = 0; i <= seg; i++) {
          const u = i / seg, wob = Math.sin((tx + u) * 2.3 + t * 1.3 + layer * 1.7 + ty * 0.9) * 0.07;
          cam.toScreen(tx + u, ty + v + wob + layer * 0.18, 0, pt);
          if (i) g.lineTo(pt.x, pt.y); else g.moveTo(pt.x, pt.y);
        }
      }
      g.stroke();
    }
    // reflections of the lit shore: neon signs and street lamps smear down the water as wobbling, broken streaks (night) and a soft sky sheen (day)
    this.drawReflections(g, sim, minX, maxX, minY, maxY, t);
    // sun / street-light glints that twinkle and slide
    g.fillStyle = "rgba(255,255,255,.55)";
    const gl = q >= 3 ? 3 : 2;
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      if (sim.world.tiles[ty * S + tx] !== T.WATER) continue;
      for (let k = 0; k < gl; k++) {
        const ph = Math.sin(t * 1.6 + tx * 12.9898 + ty * 78.233 + k * 4.1);
        if (ph < 0.93) continue;
        cam.toScreen(tx + 0.2 + ((tx * 37 + ty * 17 + k * 29) % 60) / 100, ty + 0.2 + ((tx * 13 + ty * 41 + k * 11) % 60) / 100, 0, pt);
        const r = (1 + (ph - 0.93) * 18) * z;
        g.beginPath(); g.ellipse(pt.x, pt.y, r * 1.8, r * 0.7, 0, 0, 6.283); g.fill();
      }
    }
    g.lineCap = "butt";
  }

  /** Per water tile: how strongly and in what colour the nearest lit shore reflects (cached; the shoreline never moves). */
  private reflTiles: { idx: Int32Array; col: Uint8Array; str: Uint8Array; cols: string[] } | null = null; private reflFor: unknown = null;
  private reflCache(sim: Simulation) {
    if (this.reflTiles && this.reflFor === sim.world) return this.reflTiles;
    const w = sim.world, S = w.size, R = 3, idx: number[] = [], col: number[] = [], str: number[] = [], cols: string[] = ["#ffd88a"];
    for (let ty = 0; ty < S; ty++) for (let tx = 0; tx < S; tx++) {
      if (w.tiles[ty * S + tx] !== T.WATER) continue;
      let best = 0, bc = -1, bd = 99;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = tx + dx, y = ty + dy, d = Math.abs(dx) + Math.abs(dy);
        if (d >= bd || !w.inBounds(x, y)) continue;
        const t = w.tiles[y * S + x];
        if (t === T.WATER) continue;
        let c = -1;
        if (t === T.BUILDING) { const b = w.buildings[w.buildingOf[y * S + x]]; if (b) { c = cols.indexOf(b.sign); if (c < 0) { cols.push(b.sign); c = cols.length - 1; } } }
        else if (t === T.PAVE || t === T.STREET || t === T.PATH || t === T.ROAD) c = 0;
        if (c < 0) continue;
        bd = d; bc = c; best = 4 - Math.min(3, Math.floor(d / 2));
      }
      if (bc >= 0) { idx.push(ty * S + tx); col.push(bc); str.push(best); }
    }
    this.reflFor = w;
    return (this.reflTiles = { idx: Int32Array.from(idx), col: Uint8Array.from(col), str: Uint8Array.from(str), cols });
  }

  private drawReflections(g: CanvasRenderingContext2D, sim: Simulation, minX: number, maxX: number, minY: number, maxY: number, t: number): void {
    const cam = this.cam, z = cam.zoom, pt = this.pt, S = sim.world.size, night = 1 - Math.min(1, Math.max(0, (sim.daylight - 0.15) / 0.5));
    // day: a broad pale sheen band sliding across the surface
    if (night < 0.9) {
      g.fillStyle = `rgba(255,236,200,${(0.07 * (1 - night)).toFixed(3)})`;
      for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
        if (sim.world.tiles[ty * S + tx] !== T.WATER || Math.sin((tx - ty) * 0.9 + t * 0.4) < 0.55) continue;
        cam.toScreen(tx + 0.5, ty + 0.5, 0, pt);
        g.beginPath(); g.ellipse(pt.x, pt.y, 20 * z, 6 * z, 0, 0, 6.283); g.fill();
      }
    }
    if (night < 0.15) return;
    // moon and sky: pale slivers drifting over every water tile, so ponds with no lit shore still shimmer
    g.fillStyle = `rgba(200,225,255,${(0.7 * night).toFixed(3)})`;
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      if (sim.world.tiles[ty * S + tx] !== T.WATER) continue;
      const ph = Math.sin(t * 0.8 + tx * 5.3 + ty * 9.1);
      if (ph < 0.3) continue;
      cam.toScreen(tx + 0.5 + Math.sin(t * 0.5 + ty) * 0.15, ty + 0.5, 0, pt);
      g.beginPath(); g.ellipse(pt.x, pt.y, (4 + ph * 6) * z, (0.8 + ph) * z, 0, 0, 6.283); g.fill();
    }
    const rc = this.reflCache(sim), by = new Map<number, number[]>();
    for (let i = 0; i < rc.idx.length; i++) {
      const ty = (rc.idx[i] / S) | 0, tx = rc.idx[i] - ty * S;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) continue;
      let a = by.get(rc.col[i]); if (!a) by.set(rc.col[i], a = []);
      a.push(tx, ty, rc.str[i]);
    }
    g.lineCap = "round";
    for (const [c, a] of by) {
      g.strokeStyle = rc.cols[c]; g.globalAlpha = 0.5 * night;
      g.lineWidth = Math.max(1, 2 * z);
      g.beginPath();
      for (let i = 0; i < a.length; i += 3) {
        const tx = a[i], ty = a[i + 1], s = a[i + 2];
        const ph = t * 1.4 + tx * 2.1 + ty * 3.7;
        cam.toScreen(tx + 0.5, ty + 0.5, 0, pt);
        const x = pt.x + Math.sin(ph) * 3 * z, len = (3 + s * 2.2) * z;
        // broken into three dashes that shimmer in and out
        for (let k = 0; k < 3; k++) {
          if (Math.sin(ph * 1.7 + k * 2.3) < -0.35) continue;
          const y0 = pt.y - 8 * z + k * len * 1.2;
          g.moveTo(x + Math.sin(ph + k) * 2 * z, y0); g.lineTo(x + Math.sin(ph + k + 1) * 2 * z, y0 + len);
        }
      }
      g.stroke();
    }
    g.globalAlpha = 1; g.lineCap = "butt";
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
  /** The figures are drawn side-on, so a stride swings left and right across the screen. Someone walking toward or
   *  away from the camera would scissor their legs sideways like a star jump; shorten the swing by how end-on they are. */
  private foreshorten(a: Angles, c: Character): void {
    const dx = Math.cos(c.facing) - Math.sin(c.facing), dy = (Math.cos(c.facing) + Math.sin(c.facing)) * 0.5;
    const f = 0.25 + 0.75 * Math.abs(dx) / (Math.hypot(dx, dy) || 1);
    a.thighL *= f; a.thighR *= f; a.armL *= f; a.armR *= f;
  }

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
    if(def.weapon?.gun){
      const angle=Math.atan2((Math.sin(c.facing)+Math.cos(c.facing))*.5,Math.cos(c.facing)-Math.sin(c.facing));
      this.g.save();this.g.translate(J[14],J[15]);this.g.rotate(angle-(dir<0?Math.PI:0));
      const motion=visibleWeaponMotion(c.weaponAction,this.sim.tick,performance.now()/1000),rig=gunGrips(t.def,motion,false);
      drawToy(this.g,t.def,rig.originX*k*dir,rig.originY*k,k*rig.scale,0,t.color,1,dir,motion);
      // Wrapped fingers sit over the grip rather than an open palm floating below the receiver.
      this.g.strokeStyle='#eee4d3';this.g.lineWidth=1.5*k;this.g.lineCap='round';this.g.beginPath();
      for(let i=-1;i<=1;i++){this.g.moveTo(-1.8*k,i*1.1*k);this.g.quadraticCurveTo(1.8*k,(i+.4)*1.1*k,2.2*k,(i+1)*1.1*k);}this.g.stroke();
      this.g.restore();return;
    }
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
    const sim = this.sim, g = this.g, cam = this.cam,z=cam.zoom;
    const small = cam.viewW < 520, maxB = small ? 2 : 3; // a calm street: only the few conversations nearest you are 'heard'
    let shown = 0;
    const bounds=new ScreenBounds(cam.viewW,cam.viewH);
    g.textBaseline = "alphabetic";
    // nearest to the camera centre first
    // speech is only "heard" near you: bubbles fade in as you approach and out as you leave
    const me = sim.player, mx = me.inCar >= 0 ? sim.vehicles[me.inCar].x : me.x, my = me.inCar >= 0 ? sim.vehicles[me.inCar].y : me.y;
    // conversations carry a little further than muttering to yourself; shouts carry furthest
    const HEAR_TALK = 4.2, HEAR_SOLO = 2.4;
    const cands: Item[] = [];
    for (const it of view) {
      if (it.kind !== 0) continue;
      const c = sim.chars[it.ref];
      const talking = !!c.bubble && c.bubble.until > sim.tick;
      if(!talking)this.bubblePositions.delete(c.id);
      const d = Math.hypot(c.x - mx, c.y - my);
      const hear = (c.talkWith >= 0 ? HEAR_TALK : HEAR_SOLO) + (talking && c.bubble!.kind === "shout" ? 3 : 0);
      const target = talking && (c.id === me.id || c.id === o.selected || c.talkWith === me.id || d < hear) ? 1 : 0;
      const a0 = this.bubbleAlpha.get(c.id) ?? 0;
      const a1 = a0 + (target - a0) * Math.min(1, (o.reduceMotion ? 20 : 6) * (1 / 60));
      if (a1 < 0.02 && target === 0) this.bubbleAlpha.delete(c.id); else this.bubbleAlpha.set(c.id, a1);
      if (a1 > 0.02 || this.markers.has(c.id) || (o.showNames && (c.tier === "principal" || c.tier === "player") && d < 14) || c.id === o.selected || c.id === o.hovered) cands.push(it);
    }
    // nearest to you first, and anyone talking to you before everyone else
    const pri = (c: Character) => (c.id === me.id || c.talkWith === me.id ? -100 : 0) + Math.hypot(c.x - mx, c.y - my);
    cands.sort((a, b) => pri(sim.chars[a.ref]) - pri(sim.chars[b.ref]));
    for (const it of cands) {
      const c = sim.chars[it.ref];
      const headY = it.sy - (c.z * 26 + 56 * c.look.scale) * z;
      if ((o.showNames && (c.tier === "principal" || c.tier === "player") && z > 0.6 && Math.hypot(c.x - mx, c.y - my) < 14) || c.id === o.selected || c.id === o.hovered) {
        g.font = `600 ${Math.round(Math.max(10, 10 * Math.min(1.3, z)))}px "IBM Plex Mono", ui-monospace, monospace`;
        g.textAlign = "center";
        g.fillStyle = "rgba(14,11,10,.7)";
        const w = g.measureText(c.name).width + 8;
        const nameBox=bounds.place(it.sx-w/2,it.sy+4,w,18);
        if(nameBox){g.fillRect(nameBox.x,nameBox.y,w,18);
        g.fillStyle = c.tier === "player" ? "#ec2a1c" : c.look.color;
        g.fillText(c.name,nameBox.x+w/2,nameBox.y+13);}
        g.textAlign = "start";
      }
      if (this.markers.has(c.id)) {
        const markerBox=bounds.place(it.sx-70,headY-65,140,50);
        if(markerBox){const mx=markerBox.x+70,my=markerBox.y+33;
        g.fillStyle = "#b48cff"; g.beginPath(); g.moveTo(mx, my - 12); g.lineTo(mx + 9, my); g.lineTo(mx, my + 12); g.lineTo(mx - 9, my); g.closePath(); g.fill();
        g.fillStyle = "#0e0b0a"; g.font = "900 13px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center"; g.fillText("!", mx, my + 5);
        g.font = "700 11px 'IBM Plex Mono', monospace"; g.fillStyle = "#b48cff"; g.fillText(c.nickname ? `${c.name.split(" ")[0]} "${c.nickname}"` : c.name, mx, my - 17); g.textAlign = "start";
        }
      }
      const ba = this.bubbleAlpha.get(c.id) ?? 0;
      if (!c.bubble || ba < 0.02 || shown >= maxB) continue;
      shown++;
      const txt = c.bubble.text, kind = c.bubble.kind;
      const fs = small ? 12 : 13;
      g.font = `${kind === "shout" ? "700 " : "600 "}${fs}px ui-rounded, "SF Pro Rounded", "Nunito", "Trebuchet MS", system-ui, sans-serif`;
      const lines = wrap(g, txt, small ? 124 : 168);
      const padX = 10, padY = 7;
      const w = Math.min(small ? 150 : 196, Math.max(...lines.map((l) => g.measureText(l).width))) + padX * 2, h = lines.length * (fs + 3) + padY * 2 - 3;
      const fade = Math.min(1, Math.max(0, (c.bubble.until - sim.tick) / 20)) * ba;
      if (fade < 0.02) continue;
      // gentle pop-in: grows from the speaker's head as it fades up
      const pop = 1;
      const tipX = it.sx, tipY = headY - 6;
      const pinned=this.bubblePositions.get(c.id);
      let bubbleBox;
      if(pinned?.text===txt){const r={x:Math.max(8,Math.min(cam.viewW-w-8,tipX+pinned.dx)),y:Math.max(76,Math.min(cam.viewH-h-95,tipY+pinned.dy)),w,h:h+12};bubbleBox=bounds.reserve(r)?r:null;}
      else{bubbleBox=bounds.place(tipX-w/2,tipY-h-24,w,h+12);if(bubbleBox)this.bubblePositions.set(c.id,{text:txt,dx:bubbleBox.x-tipX,dy:bubbleBox.y-tipY});}
      if(!bubbleBox)continue;
      const bx=bubbleBox.x,by=bubbleBox.y+8;
      const body = kind === "shout" ? "#914f45" : kind === "think" ? "#efe9ff" : "#fff8ee", ink = kind === "shout" ? "#fff" : "#2a2430", edge = c.look.color;
      g.save();
      g.globalAlpha = fade;
      g.translate(tipX, tipY); g.scale(pop, pop); g.translate(-tipX, -tipY);
      // soft drop shadow
      g.fillStyle = "rgba(0,0,0,.22)"; roundRect(g, bx + 1.5, by + 3, w, h, 13); g.fill();
      // body + curved tail in one fill
      g.fillStyle = body; g.strokeStyle = edge; g.lineWidth = 2;
      roundRect(g, bx, by, w, h, 13); g.fill(); g.stroke();
      if (kind === "think") { for (const [r, dy, dx] of [[3.2, 6, 2], [2.2, 12, -1]] as const) { g.beginPath(); g.arc(tipX + dx, by + h + dy, r, 0, 6.283); g.fill(); g.stroke(); } }
      else {
        const tx = Math.max(bx + 14, Math.min(bx + w - 14, tipX));
        g.beginPath(); g.moveTo(tx - 6, by + h - 1); g.quadraticCurveTo(tx - 1, by + h + 4, tipX, tipY + 2); g.quadraticCurveTo(tx + 3, by + h + 2, tx + 6, by + h - 1); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(tx - 6, by + h); g.quadraticCurveTo(tx - 1, by + h + 4, tipX, tipY + 2); g.quadraticCurveTo(tx + 3, by + h + 2, tx + 6, by + h); g.stroke();
        g.fillStyle = body; g.fillRect(tx - 5, by + h - 3, 10, 4); // hide the seam under the body edge
      }
      // speaker tag in their colour
      if (ba > 0.6 && c.tier !== "background") {
        const nm = c.name.split(" ")[0]; g.font = `700 ${Math.max(9, fs - 3)}px ui-rounded, "Trebuchet MS", system-ui, sans-serif`;
        const tw = g.measureText(nm).width + 10;
        g.fillStyle = edge; roundRect(g, bx + 8, by - 8, tw, 14, 7); g.fill();
        g.fillStyle = "#0e0b0a"; g.textBaseline = "middle"; g.fillText(nm, bx + 13, by - 1); g.textBaseline = "alphabetic";
        g.font = `${kind === "shout" ? "700 " : "600 "}${fs}px ui-rounded, "SF Pro Rounded", "Nunito", "Trebuchet MS", system-ui, sans-serif`;
      }
      g.fillStyle = ink; g.textBaseline = "alphabetic";
      lines.forEach((l, i) => g.fillText(l, bx + padX, by + padY + (i + 1) * (fs + 3) - 5,w-padX*2));
      g.restore();
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

  private drawLight(c: number, r: number, sx: number, sy: number, z: number): void {
    const g = this.g;
    g.strokeStyle = "#3a3430"; g.lineWidth = 2 * z;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 40 * z); g.stroke();
    g.fillStyle = "#0e0b0a"; g.fillRect(sx - 3 * z, sy - 52 * z, 6 * z, 13 * z);
    const tick = this.sim.tick;
    const ew = lightGreenFor(0, c, r, tick), ns = lightGreenFor(1, c, r, tick);
    const col = (l: Light) => (l.green ? (l.amber ? "#f6b62c" : "#3dff7a") : "#ff3b2f");
    g.fillStyle = col(ew); g.beginPath(); g.arc(sx, sy - 48 * z, 2 * z, 0, 6.283); g.fill();
    g.fillStyle = col(ns); g.beginPath(); g.arc(sx, sy - 43 * z, 2 * z, 0, 6.283); g.fill();
    // pedestrian heads lower down the pole: green man to cross the road whose traffic is held,
    // flashing red man at the end of the phase, steady red man otherwise (one per road)
    const blink = Math.floor(tick / 20) % 2 === 0;
    const man = (l: Light, x: number) => {
      g.fillStyle = "#0e0b0a"; g.fillRect(x - 2.6 * z, sy - 32 * z, 5.2 * z, 6 * z);
      if (l.flash && !blink) return;
      g.fillStyle = l.walk ? "#3dff7a" : "#ff3b2f"; g.fillRect(x - 1.2 * z, sy - 31 * z, 2.4 * z, 4 * z);
    };
    man(ns, sx - 3.2 * z); man(ew, sx + 3.2 * z);
  }

  /** Character under a screen point (topmost), or -1. */
  /** Police helicopter circling a 3+ star player, with a searchlight that sweeps after dark. */
  private heliA = 0;
  private drawHeli(g: CanvasRenderingContext2D, sim: Simulation, time: number, z: number): void {
    const p = sim.player;
    if (p.wanted < 3) return;
    const px = p.inCar >= 0 ? sim.vehicles[p.inCar].x : p.x, py = p.inCar >= 0 ? sim.vehicles[p.inCar].y : p.y;
    this.heliA = time * 0.45;
    const hx = px + Math.cos(this.heliA) * 5, hy = py + Math.sin(this.heliA) * 5, alt = 9;
    const cam = this.cam, pt = this.pt;
    // searchlight: a soft ellipse on the ground that wobbles around you
    const lx = px + Math.cos(time * 1.3) * 0.8, ly = py + Math.sin(time * 1.7) * 0.8;
    cam.toScreen(lx, ly, 0, pt); const gx = pt.x, gy = pt.y;
    cam.toScreen(hx, hy, alt, pt); const sx = pt.x, sy = pt.y;
    if (sim.daylight < 0.7) {
      g.globalCompositeOperation = "lighter";
      g.fillStyle = "rgba(220,235,255,.08)";
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(gx - 46 * z, gy); g.lineTo(gx + 46 * z, gy); g.closePath(); g.fill();
      const grd = g.createRadialGradient(gx, gy, 0, gx, gy, 52 * z);
      grd.addColorStop(0, "rgba(235,245,255,.35)"); grd.addColorStop(1, "rgba(235,245,255,0)");
      g.fillStyle = grd; g.beginPath(); g.ellipse(gx, gy, 52 * z, 26 * z, 0, 0, 6.283); g.fill();
      g.globalCompositeOperation = "source-over";
    }
    // shadow on the ground
    cam.toScreen(hx, hy, 0, pt);
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(pt.x, pt.y, 26 * z, 11 * z, 0, 0, 6.283); g.fill();
    // body
    const dir = Math.cos(this.heliA + Math.PI / 2) > 0 ? 1 : -1, k = z;
    g.save(); g.translate(sx, sy); g.scale(dir, 1);
    g.fillStyle = "#1c2836"; g.beginPath(); g.ellipse(0, 0, 22 * k, 10 * k, 0, 0, 6.283); g.fill();
    g.fillStyle = "#3a5068"; g.beginPath(); g.ellipse(9 * k, -2 * k, 9 * k, 6 * k, 0, 0, 6.283); g.fill();
    g.strokeStyle = "#1c2836"; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(-18 * k, 0); g.lineTo(-44 * k, -5 * k); g.stroke();
    g.fillStyle = "#eee4d3"; g.font = `800 ${Math.max(6, 6 * k)}px monospace`; g.fillText("POLICE", -14 * k, 3 * k);
    g.strokeStyle = "#0e0b0a"; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(-14 * k, 11 * k); g.lineTo(14 * k, 11 * k); g.stroke();
    // rotor blur + tail rotor
    g.strokeStyle = "rgba(14,11,10,.55)"; g.lineWidth = 2 * k; g.beginPath(); g.ellipse(0, -12 * k, 40 * k, 5 * k, 0, 0, 6.283); g.stroke();
    const r = time * 40; g.strokeStyle = "rgba(14,11,10,.8)"; g.beginPath(); g.moveTo(Math.cos(r) * 40 * k, -12 * k + Math.sin(r) * 5 * k); g.lineTo(-Math.cos(r) * 40 * k, -12 * k - Math.sin(r) * 5 * k); g.stroke();
    g.beginPath(); g.arc(-44 * k, -5 * k, 6 * k, 0, 6.283); g.stroke();
    // beacon
    if (Math.floor(time * 3) % 2) { g.fillStyle = "#ff3b2f"; g.beginPath(); g.arc(0, 10 * k, 2.4 * k, 0, 6.283); g.fill(); }
    g.restore();
  }

  private street = new StreetView();
  /** Street-level 2D view: a gritty pixel-art alley, people side-on (see Street2D.ts). */
  private render2D(alpha: number, dt: number, o: RenderOptions): void {
    const sim = this.sim, cam = this.cam;
    const f = sim.chars[cam.follow >= 0 ? cam.follow : sim.playerId] ?? sim.player;
    this.street.draw(this.g, this.dpr, sim, f, cam.viewW, cam.viewH, cam.zoom, dt, this.time, (c, m, s) => this.poseName(c, m, s), alpha, o.reduceMotion);
  }

  private grain: HTMLCanvasElement | null = null; private vig: CanvasGradient | null = null; private vigKey = "";
  /**
   * Ultra finish: soft vignette, a warm/cool colour grade, fine film grain (animated, tiny) and a
   * wet-road sheen when it rains. All cached gradients/patterns, a handful of full-screen fills.
   */
  private cinematic(sim: Simulation): void {
    const g = this.g, W = this.cam.viewW, H = this.cam.viewH;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const key = `${W}x${H}`;
    if (this.vigKey !== key || !this.vig) { this.vig = g.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.35, W / 2, H * 0.52, Math.max(W, H) * 0.78); this.vig.addColorStop(0, "rgba(0,0,0,0)"); this.vig.addColorStop(1, "rgba(4,3,10,.55)"); this.vigKey = key; }
    g.fillStyle = this.vig; g.fillRect(0, 0, W, H);
    // colour grade: warm highlights by day, cool shadows at night (soft-light so it never crushes the neon)
    g.globalCompositeOperation = "soft-light";
    g.fillStyle = sim.daylight > 0.5 ? "rgba(255,196,120,.10)" : "rgba(70,110,255,.12)"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    if (sim.env.raining) { g.fillStyle = "rgba(150,180,220,.045)"; g.fillRect(0, 0, W, H); }
    if (!this.grain) {
      const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!, im = x.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) { const v = 118 + Math.random() * 20 | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      x.putImageData(im, 0, 0); this.grain = c;
    }
    const p = g.createPattern(this.grain, "repeat");
    if (p) { g.save(); g.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0); g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.07; g.fillStyle = p; g.fillRect(-128, -128, W + 256, H + 256); g.restore(); }
  }

  private qualityNow: Quality = 1;
  private in2D = false;
  /** true while the flat 2D street view is showing (audio uses a side-on mix) */
  get street2D(): boolean { return this.in2D; }
  private fadeEl: HTMLCanvasElement | null = null;
  /** Freeze the last frame on top of the canvas and fade it out, so 3D <-> 2D dissolves instead of cutting. */
  private crossfade(): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    if (!this.fadeEl) { this.fadeEl = document.createElement("canvas"); this.fadeEl.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:0"; host.insertBefore(this.fadeEl, this.canvas.nextSibling); }
    const f = this.fadeEl;
    f.width = this.canvas.width; f.height = this.canvas.height;
    f.getContext("2d")!.drawImage(this.canvas, 0, 0);
    f.style.transition = "none"; f.style.opacity = "1";
    requestAnimationFrame(() => { f.style.transition = "opacity .38s ease-out"; f.style.opacity = "0"; });
  }

  /** Animals the player has bought (drawn in the Velvet Zoo). */
  zooAnimals: { kind: import("./Animals").AnimalKind; name: string }[] = [];
  private zoo = new ZooRenderer();

  /** Buildings on screen this frame, and how much each is cut away (0..1, eased). */
  private viewB = new Set<number>();
  /** story contacts with a job: a bobbing marker and name above their head */
  markers = new Set<number>();
  private cut = new Map<number, number>();

  /** Is world point (x, y) behind building b (north or west of its footprint)? */
  private isBehind(b: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number): boolean {
    return (y < b.y0 && x < b.x1 + 1) || (x < b.x0 && y < b.y1 + 1);
  }

  /**
   * Depth key for a mover. Per-tile sorting draws a tall building's roof over things standing behind
   * it with a larger x+y; anything behind a nearby building is pulled in front of that building's
   * first tile (keeping relative order among such movers).
   */
  private behind(x: number, y: number, d: number): number {
    const w = this.sim.world;
    let out = d;
    for (const id of this.viewB) {
      const b = w.buildings[id];
      const base = b.x0 + b.y0;
      if (d <= base + 0.5 || d > b.x1 + b.y1 + 3 + b.height * 1.7) continue;
      if (!this.isBehind(b, x, y)) continue;
      // only if the roof can actually overlap it on screen
      const sx = x - y;
      if (sx < b.x0 - b.y1 - 2 || sx > b.x1 - b.y0 + 2) continue;
      const k = base + 0.45 * (1 - 1 / (1 + (d - base) * 0.1));
      if (k < out) out = k;
    }
    return out;
  }

  /** Ease each on-screen building towards cut away (it hides the focus) or solid. */
  private updateCutaway(fx: number, fy: number, fsx: number, fsy: number, z: number, dt: number): void {
    const w = this.sim.world, pt = this.pt, cam = this.cam;
    const ease = 1 - Math.exp(-dt * 7);
    for (const id of this.viewB) {
      const b = w.buildings[id];
      let target = 0;
      if (this.isBehind(b, fx, fy)) {
        cam.toScreen(b.x0, b.y1 + 1, 0, pt); const left = pt.x;
        cam.toScreen(b.x1 + 1, b.y0, 0, pt); const right = pt.x;
        cam.toScreen(b.x1 + 1, b.y1 + 1, 0, pt); const bottom = pt.y;
        cam.toScreen(b.x0, b.y0, b.height, pt); const topY = pt.y;
        if (fsx > left - 10 * z && fsx < right + 10 * z && fsy > topY - 10 * z && fsy < bottom) target = 1;
      }
      const cur = this.cut.get(id) ?? 0;
      const next = cur + (target - cur) * ease;
      if (next < 0.005 && target === 0) this.cut.delete(id); else this.cut.set(id, next);
    }
    for (const id of [...this.cut.keys()]) if (!this.viewB.has(id)) this.cut.delete(id);
  }

  /** Street names painted on the tarmac mid-block, aligned with the road in iso. */
  private streetLabels(g: CanvasRenderingContext2D, sim: Simulation, z: number, inView: (sx: number, sy: number, m: number) => boolean): void {
    const w = sim.world, P = w.period, cam = this.cam, pt = this.pt;
    if (!w.streetsX.length || z < 0.55) return;
    const k = (1 / 44) * this.dpr, d = this.dpr;
    g.save();
    g.fillStyle = "rgba(238,228,211,.42)";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `800 16px "Big Shoulders Display", Impact, sans-serif`;
    const n = w.maxLine;
    for (let line = 0; line <= n; line++) for (let blk = 0; blk < n; blk++) {
      const c = line * P + ROAD_W / 2, m = blk * P + ROAD_W + (P - ROAD_W) / 2; // on the centre line, mid-block
      // north-south road (x = c): text runs up-screen along -y
      cam.toScreen(c, m, 0, pt);
      if (inView(pt.x, pt.y, 60)) {
        const name = w.streetsX[line]?.toUpperCase();
        if (name) { g.setTransform(32 * z * k, -16 * z * k, 32 * z * k, 16 * z * k, pt.x * d, pt.y * d); g.fillText(name, 0, 0); }
      }
      // east-west road (y = c): text runs along +x
      cam.toScreen(m, c, 0, pt);
      if (inView(pt.x, pt.y, 60)) {
        const name = w.streetsY[line]?.toUpperCase();
        if (name) { g.setTransform(32 * z * k, 16 * z * k, -32 * z * k, 16 * z * k, pt.x * d, pt.y * d); g.fillText(name, 0, 0); }
      }
    }
    g.restore();
  }

  /** The clickable ad under a screen point (topmost first), if any. */
  pickAd(x: number, y: number): AdBox | null {
    for (let i = AD_BOXES.length - 1; i >= 0; i--) { const b = AD_BOXES[i]; if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b; }
    return null;
  }

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

