import * as THREE from "three";
import { arp, note, PALETTE, POP, tone, type ArcadeGame, type GameCtx } from "./ArcadeRoom";
import { felt, spark, wood } from "../lobby/LobbyTextures";

/**
 * Plinko and Pachinko, played by the Rapier physics engine. The engine settings, board layouts, bumper kicks, spinners, gravity wells,
 * wind and the Pachinko fever bonus follow the original Rapier arcade; the look follows the casino (wine felt, mahogany, brass, warm bulbs).
 * Payouts carry a small house edge so the arcade fits the rest of the casino.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
let RAPIER: Promise<any> | null = null;
const loadRapier = () => (RAPIER ??= import("@dimforge/rapier3d-compat").then(async m => { await m.default.init(); return m.default; }));
const PI = Math.PI, R = Math.random;
/** Payout scale per game, tuned by simulation so the arcade returns about 96% like the rest of the casino. */
export const EDGE = { plinko: 1, pachinko: 1 };
/** The engine pushes balls toward the outer lanes (bumpers, spinners, the well), so the table pays the rare centre lanes most. Tuned by simulation. */
const PLINKO = [.3, .5, .9, 1.4, 1.2, 3, 1.2, 1.4, .9, .5, .3].map(v => Math.round(v * .76 * 100) / 100);
const POCKETS: [number, number][] = [[0, 10], [1.4, 3], [2.8, .8]];
const binColor = (v: number) => (v >= 5 ? "#a3142b" : v >= 1.8 ? "#b8761f" : v >= 1 ? "#1f8a78" : "#3d3345");
const pick = () => POP[Math.floor(R() * POP.length)];

interface Ball { body: any; mesh: THREE.Mesh; age: number; bet: number; hits: number; col: THREE.Color; free: boolean }
interface Info { ball?: Ball; pm?: THREE.Mesh; kick?: number; gold?: boolean; x?: number; z?: number; used?: boolean }

class RapierBoard implements ArcadeGame {
  id: string; name: string; blurb: string;
  private ctx!: GameCtx; private RP: any; private world: any; private eq: any; private H = new Map<number, Info>(); private balls: Ball[] = []; private lit: THREE.Mesh[] = []; private spinners: { b: any; m: THREE.Mesh }[] = []; private wells: { x: number; z: number; s: number; r: number; g: THREE.Group }[] = []; private bulbs: THREE.Mesh[] = [];
  private fever = 0; private feverT = 0; private acc = 0; private wind = 0; private ts = 1; private slider!: HTMLInputElement; private dist = 24; private board!: THREE.Group; private alive = false;
  constructor(private mode: "plinko" | "pachinko") { this.id = mode; this.name = mode === "plinko" ? "Plinko" : "Pachinko"; this.blurb = mode === "plinko" ? "Golden pegs split your ball. Bumpers, spinners and a gravity well fight the drop." : "Launch it, work the wind, and hit the centre pocket for FEVER."; }

  private mat(c: number | THREE.Color, m = .5, r = .4, e = 0) { return new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, emissive: e ? c : 0, emissiveIntensity: e }); }
  private collider(cd: any, body: any, rest = .5) { return this.world.createCollider(cd.setRestitution(rest).setFriction(.1).setActiveEvents(this.RP.ActiveEvents.COLLISION_EVENTS), body); }
  private fixed(cd: any, x: number, y: number, z: number, info?: Info, rest?: number) { const b = this.world.createRigidBody(this.RP.RigidBodyDesc.fixed().setTranslation(x, y, z)), c = this.collider(cd, b, rest); if (info) this.H.set(c.handle, info); return c; }
  private halo(c: THREE.Color | number, s: number) { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark("#fff"), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); h.scale.set(s, s, 1); return h; }
  private peg(x: number, y: number, r = .12, o: { c?: THREE.Color; gold?: boolean; kick?: number } = {}) {
    const c = o.c ?? new THREE.Color(PALETTE.gold), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.3, 20), this.mat(c, .85, .25, 0)); m.position.set(x, .65, -y); m.castShadow = m.receiveShadow = true; m.userData = { c, lit: 0 };
    if (o.gold || o.kick) { const h = this.halo(c, r * 10); h.position.y = .8; m.add(h); } this.board.add(m); this.fixed(this.RP.ColliderDesc.cylinder(.65, r), x, .65, -y, { pm: m, kick: o.kick, gold: o.gold, x, z: -y });
  }
  private wall(x: number, z: number, w: number, d: number, h = 1.6, _col = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xd8b898, map: wood([1, 1]), roughness: .4, metalness: .1 })); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; this.board.add(m); this.fixed(this.RP.ColliderDesc.cuboid(w / 2, h / 2, d / 2), x, h / 2, z, undefined, .3); }
  private spinner(x: number, y: number, len: number, w: number, c: THREE.Color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, .9, .2), this.mat(c, .6, .3, .1)); m.position.set(x, .45, -y); m.userData = { c, lit: 0, base: .1 }; m.castShadow = true; this.board.add(m);
    const b = this.world.createRigidBody(this.RP.RigidBodyDesc.kinematicVelocityBased().setTranslation(x, .45, -y).setAngvel({ x: 0, y: w, z: 0 })), c2 = this.collider(this.RP.ColliderDesc.cuboid(len / 2, .45, .1), b); this.H.set(c2.handle, { pm: m, kick: 0 }); this.spinners.push({ b, m });
  }
  private well(x: number, y: number, s: number, r: number, c: THREE.Color) { const g = new THREE.Group(); g.position.set(x, .5, -y); [0, 1].forEach(k => { const t = new THREE.Mesh(new THREE.TorusGeometry(r * (.5 + k * .35), .05, 8, 48), new THREE.MeshBasicMaterial({ color: c })); t.userData.k = k; g.add(t); }); g.add(this.halo(c, r * 2)); this.board.add(g); this.wells.push({ x, z: -y, s, r, g }); }
  private label(t: string, x: number, y: number, s: number, bg: string) { const cv = document.createElement("canvas"); cv.width = 128; cv.height = 64; const g = cv.getContext("2d")!; g.fillStyle = bg; g.fillRect(0, 0, 128, 64); g.strokeStyle = "#e5c566"; g.lineWidth = 4; g.strokeRect(2, 2, 124, 60); g.fillStyle = "#fff6e0"; g.font = "700 34px Georgia,serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 64, 34); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s / 2), new THREE.MeshBasicMaterial({ map: tex })); m.rotation.x = -PI / 2; m.position.set(x, .03, -y); this.board.add(m); }
  private tableBase() {
    const brass = this.mat(PALETTE.gold, .9, .25), top = new THREE.Mesh(new THREE.BoxGeometry(12.8, .5, 18), new THREE.MeshStandardMaterial({ map: felt("blank", "#2a0f1c"), roughness: .9 })); top.position.y = -.25; top.receiveShadow = true; this.board.add(top);
    this.fixed(this.RP.ColliderDesc.cuboid(6.4, .25, 9), 0, -.25, 0, undefined, .15); this.fixed(this.RP.ColliderDesc.cuboid(6.4, .2, 9), 0, 1.8, 0, undefined, .15);
    this.wall(-6.15, 0, .3, 18); this.wall(6.15, 0, .3, 18); this.wall(0, -8.85, 12.6, .3); this.wall(0, 8.85, 12.6, .3);
    for (const [x, z, w, d] of [[0, -9.05, 13.4, .14], [0, 9.05, 13.4, .14], [-6.45, 0, .14, 18.3], [6.45, 0, .14, 18.3]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .14, d), brass); m.position.set(x, 1.65, z); this.board.add(m); }
    for (let i = 0; i < 19; i++) for (const x of [-6.9, 6.9]) { const m = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshBasicMaterial()); m.position.set(x, 1.1, -9 + i); this.board.add(m); this.bulbs.push(m); }
  }

  async mount(ctx: GameCtx) {
    this.ctx = ctx; this.RP = await loadRapier(); this.alive = true; this.board = new THREE.Group(); ctx.group.add(this.board);
    this.world = new this.RP.World({ x: 0, y: -29.4, z: 17 }); this.world.timestep = 1 / 120; this.eq = new this.RP.EventQueue(true);
    this.tableBase();
    const rose = new THREE.Color(PALETTE.rose), teal = new THREE.Color(PALETTE.teal);
    if (this.mode === "plinko") {
      for (let r = 0; r < 10; r++) { const n = r + 4; for (let i = 0; i < n; i++) { const g = (r === 2 || r === 5 || r === 8) && i === Math.floor(n / 2) - (r === 5 ? 1 : 0); this.peg((i - (n - 1) / 2) * .95, 6.2 - r * .78, g ? .17 : .12, g ? { gold: true, c: teal } : {}); } }
      for (const x of [-4.2, 4.2]) this.peg(x, -2.4, .4, { kick: 12, c: rose });
      this.spinner(-2, -4.3, 2.2, 3, new THREE.Color(PALETTE.ember)); this.spinner(2, -4.3, 2.2, -3, new THREE.Color(PALETTE.violet)); this.well(0, -2.8, 26, 2.6, new THREE.Color(PALETTE.violet));
      const bw = 12 / 11; for (let k = 0; k <= 11; k++) this.wall(-6 + k * bw, 7.3, .12, 1.4, 1.2, 0x6a4a34); PLINKO.forEach((v, i) => this.label("×" + v, -6 + bw * (i + .5), -7.7, 1, binColor(v)));
      ctx.opts.append(this.sliderEl("Drop position", 0));
    } else {
      const bu: number[][] = [[-3.6, 3.2], [3.6, 3.2], [0, 1], [-3.4, -2.2], [3.4, -2.2]], sps: number[][] = [[0, 5.2, 2.2, 3], [-2.1, -4, 1.8, -3.5], [2.1, -4, 1.8, 3.5]], zone = bu.concat(sps.map(s => [s[0], s[1]]), [[0, -5.4]]);
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, pts: number[][] = [];
      for (let i = 0; i < 600 && pts.length < 80; i++) { const x = (rnd() - .5) * 11, y = -4.8 + rnd() * 11.2; if (pts.every(p => Math.hypot(p[0] - x, p[1] - y) > .85) && zone.every(z => Math.hypot(z[0] - x, z[1] - y) > 1.2)) { pts.push([x, y]); this.peg(x, y, .11, rnd() < .07 ? { gold: true, c: teal } : {}); } }
      bu.forEach(b => this.peg(b[0], b[1], .45, { kick: 14, c: rose })); sps.forEach((q, i) => this.spinner(q[0], q[1], q[2], q[3], new THREE.Color([PALETTE.ember, PALETTE.teal, PALETTE.violet][i]))); this.well(0, -5.4, 20, 2.4, new THREE.Color(PALETTE.violet));
      for (const [x, v] of POCKETS) for (const sx of x ? [-x, x] : [0]) this.label("×" + v, sx, -7.6, 1, binColor(v));
      for (let k = -3.5; k <= 3.6; k += 1.4) this.wall(k, 7.2, .12, 1.2, 1.2, 0x6a4a34);
      ctx.opts.append(this.sliderEl("Launch power", -.3));
    }
    ctx.primary(this.mode === "plinko" ? "Drop" : "Launch"); ctx.say(this.mode === "plinko" ? "Pick a spot, then drop." : "Set the power, then launch.");
  }
  private sliderEl(label: string, v: number) { const w = document.createElement("label"); w.className = "ar-slider"; const s = document.createElement("small"); s.textContent = label; const i = document.createElement("input"); i.type = "range"; i.min = "-1"; i.max = "1"; i.step = ".01"; i.value = String(v); i.setAttribute("aria-label", label); w.append(s, i); this.slider = i; return w; }

  private spawn(x: number, z: number, vx: number, vz: number, bet: number, free: boolean, col = pick()) {
    const body = this.world.createRigidBody(this.RP.RigidBodyDesc.dynamic().setTranslation(x, .4, z).setLinvel(vx, 0, vz).setLinearDamping(.01).setAngularDamping(.2).setCcdEnabled(true));
    const c = this.collider(this.RP.ColliderDesc.ball(.3).setDensity(1), body, .55), m = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), this.mat(col, .5, .2, .55)); m.castShadow = true; m.add(this.halo(col, 2.2)); this.board.add(m);
    const o: Ball = { body, mesh: m, age: 0, bet, hits: 0, col, free }; this.H.set(c.handle, { ball: o }); this.balls.push(o); this.ctx.busyChanged(); return o;
  }
  primary() {
    const ctx = this.ctx, v = Number(this.slider.value), bet = ctx.stake();
    if (!ctx.spend(bet)) return; ctx.fx.punch = .1;
    if (this.mode === "plinko") this.spawn(v * 5 + (R() - .5) * .1, -7.7, 0, 0, bet, false); else this.spawn(5.6, 6.2, -(1.5 + R() * 2.5), -(16 + (v + 1) * 7), bet, false);
    ctx.say(this.mode === "plinko" ? "Ball away…" : "Launched…");
  }
  busy() { return this.balls.length > 0 || this.fever > 0; }

  private hit(o: Ball, t: Info) {
    const u = t.pm!.userData, v = o.body.linvel(), sp = Math.hypot(v.x, v.y, v.z), p = o.body.translation(), fx = this.ctx.fx; o.hits++; if (!u.lit) this.lit.push(t.pm!); u.lit = 1;
    fx.emit(p.x, .6, p.z, (3 + Math.min(10, sp * .3)) | 0, 3 + sp * .15, u.c, .55, -9); tone(note(o.hits), .14, .03 + Math.min(sp, 28) * .0015);
    if (t.kick) { const dx = p.x - t.x!, dz = p.z - t.z!, d = Math.hypot(dx, dz) || 1; o.body.setLinvel({ x: v.x + dx / d * t.kick, y: v.y, z: v.z + dz / d * t.kick }, true); fx.shake = Math.max(fx.shake, .22); fx.flash(PALETTE.rose, 1.2, t.x, 1, t.z); fx.emit(t.x!, .8, t.z!, 24, 7, new THREE.Color(PALETTE.rose), .6, -4); }
    if (t.gold && !t.used && this.balls.length < 40) { t.used = true; setTimeout(() => { t.used = false; }, 1500); o.bet /= 3; /* a split shares the stake three ways: spectacle, not extra money */ for (let k = 0; k < 2; k++) this.spawn(t.x!, t.z! + (R() - .5), (k ? 1 : -1) * (2 + R() * 3), R() * 2, o.bet, true, new THREE.Color(PALETTE.teal)); fx.emit(t.x!, .8, t.z!, 50, 8, new THREE.Color(PALETTE.teal), .9, -4); fx.flash(PALETTE.teal, 1.6, t.x, 1, t.z); }
  }
  private payout(m: number, x: number, z: number, o: Ball) {
    const fx = this.ctx.fx, L = m >= 20 ? 3 : m >= 5 ? 2 : m >= 1.5 ? 1 : 0, win = o.bet * m * EDGE[this.mode];
    this.ctx.settle(this.name, o.free ? 0 : o.bet, win);
    if (m <= 0) { this.ctx.say("No win"); tone(150, .3, .05, "sawtooth"); return; }
    this.ctx.say(`×${(m * EDGE[this.mode]).toFixed(1)}  →  +$${Math.round(win).toLocaleString("en-NZ")}`); fx.emit(x, .8, z, 30 + L * 30, 6 + L * 2, pick(), 1, -7, 5);
    if (L >= 1) { arp(3 + L * 2); fx.flash(PALETTE.gold, 1.5 + L * 1.5, x, 1, z); fx.juice = Math.max(fx.juice, .3 * L); fx.shake = Math.max(fx.shake, .18 * L); this.ctx.big("NICE", "n"); }
    if (L >= 2) { fx.burstWin(L * 3, x, 0, 0); this.ts = .35; fx.punch = 1; this.ctx.big(L > 2 ? "JACKPOT" : "MEGA WIN", "m"); }
  }
  private settleBall(o: Ball) {
    const p = o.body.translation(); let m = 0;
    if (this.mode === "plinko") m = PLINKO[Math.max(0, Math.min(10, Math.floor((p.x + 6) / (12 / 11))))];
    else { const a = Math.abs(p.x); m = POCKETS.find(([x]) => Math.abs(a - x) < .65)?.[1] ?? 0; if (m === POCKETS[0][1] && !o.free) { this.fever = 6; this.feverT = 0; this.ctx.big("FEVER", "m"); this.ctx.say("FEVER: six bonus balls!"); } }
    this.payout(m, p.x, 7, o); this.world.removeRigidBody(o.body); this.board.remove(o.mesh); this.balls.splice(this.balls.indexOf(o), 1); this.ctx.busyChanged();
  }

  update(real: number, _r: number, t: number) {
    if (!this.alive) return; this.ts += (1 - this.ts) * Math.min(1, real * 1.5); const dt = real * this.ts; this.wind = Math.sin(t * .35) * 5 + Math.sin(t * .9) * 2;
    this.acc += dt; let n = 0;
    while (this.acc >= 1 / 120 && n++ < 8) {
      this.world.step(this.eq); this.acc -= 1 / 120;
      this.eq.drainCollisionEvents((h1: number, h2: number, started: boolean) => { if (!started) return; const a = this.H.get(h1), b = this.H.get(h2); if (!a || !b) return; if (a.ball && b.pm) this.hit(a.ball, b); else if (b.ball && a.pm) this.hit(b.ball, a); });
    }
    for (const s of this.spinners) { const q = s.b.rotation(); s.m.quaternion.set(q.x, q.y, q.z, q.w); }
    for (const o of this.balls.slice()) {
      const p = o.body.translation(), v = o.body.linvel(); let ax = this.wind * dt * .5, az = 0;
      for (const w of this.wells) { const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz); if (d < w.r && d > .05) { const f = w.s * (1 - d / w.r) * dt; ax += dx / d * f; az += dz / d * f; } }
      o.body.setLinvel({ x: v.x + ax, y: v.y, z: v.z + az }, true);
      const q = o.body.rotation(); o.mesh.position.set(p.x, p.y, p.z); o.mesh.quaternion.set(q.x, q.y, q.z, q.w); o.age += dt; this.ctx.fx.emit(p.x, .4, p.z, 1, .4, o.col, .5, 0);
      if ((o.age > .5 && p.z > 6.9) || p.z > 9.3 || p.z < -9.3 || Math.abs(p.x) > 7 || p.y > 3 || p.y < -2) this.settleBall(o);
    }
    if (this.fever > 0) { this.feverT -= dt; if (this.feverT <= 0) { this.feverT = .28; this.fever--; this.spawn((R() - .5) * 10, -7.8, 0, 0, this.ctx.stake() / 4, true); if (!this.fever) this.ctx.busyChanged(); } }
    for (const w of this.wells) w.g.children.forEach(c => { if (c.userData.k !== undefined) { c.rotation.x = t * (1 + c.userData.k) * 2; c.rotation.y = t * (2 - c.userData.k) * 1.5; } });
    for (let i = this.lit.length - 1; i >= 0; i--) { const m = this.lit[i], u = m.userData; u.lit -= real * 3; if (u.lit <= 0) { u.lit = 0; this.lit.splice(i, 1); } (m.material as THREE.MeshStandardMaterial).emissiveIntensity = (u.base || 0) + u.lit * 1.4; const sc = 1 + u.lit * .45; m.scale.set(sc, 1, sc); }
    const warm = new THREE.Color();
    this.bulbs.forEach((b, i) => { const l = Math.max(0, Math.sin(t * 5 - i * .7)); warm.setHSL(.1 + .02 * l, .8, Math.min(.78, .18 + .4 * l + this.ctx.fx.juice * .15)); (b.material as THREE.MeshBasicMaterial).color.copy(warm); });
  }
  camera(t: number, aspect: number) {
    const c = this.ctx.camera, fx = this.ctx.fx; this.dist = Math.max(23, 18.5 / aspect); const sx = Math.sin(t * .25) * 2.5 + (R() - .5) * fx.shake, sy = (R() - .5) * fx.shake;
    c.position.set(sx, this.dist * .82 + sy, this.dist * .62 + 1); c.lookAt(0, 0, 2.6);
  }
  unmount() { this.alive = false; try { this.world?.free(); } catch { /* already freed */ } this.balls = []; this.lit = []; this.spinners = []; this.wells = []; this.bulbs = []; this.H.clear(); }
}

export const plinkoGame = (): ArcadeGame => new RapierBoard("plinko");
export const pachinkoGame = (): ArcadeGame => new RapierBoard("pachinko");
