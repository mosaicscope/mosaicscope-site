import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { spark } from "../lobby/LobbyTextures";

/**
 * The Physics Arcade: one 3D room, four games that are really played by a physics engine.
 *  - Plinko and Pachinko run on Rapier (pegs, bumpers, spinners, gravity wells, wind, fever).
 *  - Dice and Coin flip run on cannon-es (rigid dice and a rigid coin; the result is read off the settled body).
 * This file is the shared shell: theme, particles, sound, the clean control bar and the wallet. Each game lives in its own module.
 */
export interface ArcadeHost { chips(): number; setChips(n: number): void; round(game: string, net: number): void; changed(): void }
export const PALETTE = { gold: 0xe5c566, rose: 0xe0428f, teal: 0x2ec4b6, ember: 0xff7a45, violet: 0x8a5be0, ivory: 0xf4ecd8, wine: 0x4a1220 };
export const hue = (h: number, s = .62, l = .58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l);
export const POP = [PALETTE.gold, PALETTE.rose, PALETTE.teal, PALETTE.ember, PALETTE.violet].map(c => new THREE.Color(c));

/** Particles, light flashes and camera shake shared by every game. */
export class Fx {
  readonly N = 3500; private i = 0; private pos = new Float32Array(this.N * 3); private col = new Float32Array(this.N * 3); private base = new Float32Array(this.N * 3); private vel = new Float32Array(this.N * 3); private life = new Float32Array(this.N); private grav = new Float32Array(this.N);
  readonly points: THREE.Points; readonly light = new THREE.PointLight(0xffffff, 0, 60); shake = 0; juice = 0; punch = 0; flashA = 0; later: [number, () => void][] = [];
  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: .5, map: spark("#fff"), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.points.frustumCulled = false; scene.add(this.points, this.light); this.pos.fill(-99);
  }
  emit(x: number, y: number, z: number, n: number, speed: number, c: THREE.Color, life: number, gravity: number, up = 0) {
    for (let k = 0; k < n; k++) { const i = this.i++ % this.N, a = Math.random() * 6.283, e = Math.acos(2 * Math.random() - 1), v = speed * (.3 + Math.random() * .7); this.pos.set([x, y, z], i * 3); this.vel.set([Math.sin(e) * Math.cos(a) * v, Math.cos(e) * v + up, Math.sin(e) * Math.sin(a) * v], i * 3); this.base.set([c.r, c.g, c.b], i * 3); this.life[i] = life * (.6 + Math.random() * .4); this.grav[i] = gravity; }
  }
  flash(color: number, intensity: number, x = 0, y = 2, z = 0) { this.light.color.set(color); this.light.intensity = intensity * 3; this.light.position.set(x, y + 3, z); this.flashA = Math.min(.45, this.flashA + intensity * .05); }
  burstWin(level: number, x: number, y: number, z: number) {
    for (let k = 0; k < level * 3; k++) this.later.push([k * .22, () => { const px = x + (Math.random() - .5) * 8, py = y + 3 + Math.random() * 4, pz = z + (Math.random() - .5) * 6, c = POP[Math.floor(Math.random() * POP.length)]; this.emit(px, py, pz, 90, 9, c, 1.5, -5); this.later.push([.25, () => this.emit(px, py, pz, 40, 4, c.clone().lerp(new THREE.Color("#fff"), .5), 1, -3)]); }]);
  }
  clear() { this.life.fill(0); this.pos.fill(-99); this.later = []; this.shake = this.juice = this.punch = this.flashA = 0; }
  step(dt: number, real: number) {
    for (let k = this.later.length - 1; k >= 0; k--) { this.later[k][0] -= real; if (this.later[k][0] <= 0) { const f = this.later[k][1]; this.later.splice(k, 1); f(); } }
    const d = 1 - Math.min(.9, dt * 1.3);
    for (let i = 0; i < this.N; i++) if (this.life[i] > 0) { this.life[i] -= dt; const f = this.life[i] > 0 ? Math.min(1, this.life[i] * 1.5) : 0; this.vel[i * 3 + 1] += this.grav[i] * dt; for (let k = 0; k < 3; k++) { this.vel[i * 3 + k] *= d; this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt; this.col[i * 3 + k] = this.base[i * 3 + k] * f; } }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.light.intensity *= .92; this.shake *= .88; this.juice *= .95; this.punch *= .9; this.flashA *= .9;
  }
}

/** A few soft synth tones, only once the player has clicked. */
let AC: AudioContext | null = null;
export function tone(f: number, d = .1, v = .05, type: OscillatorType = "triangle") { try { AC ??= new AudioContext(); if (AC.state === "suspended") void AC.resume(); const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + d); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d); } catch { /* sound is optional */ } }
const SC = [0, 2, 4, 7, 9];
export const note = (n: number) => 261.6 * 2 ** ((SC[n % 5] + 12 * Math.floor(n / 5 % 3)) / 12);
export const arp = (n: number) => { for (let i = 0; i < n; i++) setTimeout(() => tone(note(i * 2 + 3), .25, .05, "square"), i * 70); };

export interface GameCtx {
  scene: THREE.Scene; group: THREE.Group; camera: THREE.PerspectiveCamera; fx: Fx; stake(): number; opts: HTMLElement;
  /** Spend the stake from the wallet. false = not enough chips. */ spend(n: number): boolean;
  /** Pay out a result for a stake already spent (win may be 0). `free` = no stake was spent, so a loss costs nothing. */ settle(game: string, stake: number, win: number): void;
  say(t: string): void; big(t: string, kind: "n" | "m"): void; primary(label: string, disabled?: boolean): void; busyChanged(): void;
}
export interface ArcadeGame { id: string; name: string; blurb: string; mount(ctx: GameCtx): Promise<void> | void; update(dt: number, real: number, t: number): void; unmount(): void; primary(): void; busy(): boolean; camera(t: number, aspect: number): void }

export class ArcadeRoom {
  readonly el: HTMLElement; failed = false;
  private renderer!: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(46, 1.6, .1, 200); private fx!: Fx; private group: THREE.Group | null = null;
  private games: ArcadeGame[]; private game: ArcadeGame | null = null; private loading = false; private stakeV = 50; private clock = new THREE.Clock(); private t = 0; private attached = false;
  private ui!: { chips: HTMLElement; say: HTMLElement; big: HTMLElement; primary: HTMLButtonElement; opts: HTMLElement; bets: HTMLButtonElement[]; tabs: HTMLButtonElement[]; blurb: HTMLElement; flash: HTMLElement; name: HTMLElement };
  static create(host: ArcadeHost, games: ArcadeGame[]): ArcadeRoom | null { const r = new ArcadeRoom(host, games); return r.failed ? null : r; }
  /** True while a round is in the air: the casino keeps you here so a stake is never abandoned. */
  get busy() { return !!this.game?.busy(); }

  private constructor(private host: ArcadeHost, games: ArcadeGame[]) {
    this.games = games; this.el = document.createElement("section"); this.el.className = "arcade3d"; this.el.setAttribute("aria-label", "Physics arcade: Plinko, Pachinko, Dice and Coin flip, all played by a real physics engine");
    try {
      const canvas = document.createElement("canvas"); canvas.className = "ar-canvas"; this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" }); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
      const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); this.scene.environmentIntensity = .35;
      this.scene.background = new THREE.Color("#0b0508"); this.scene.fog = new THREE.Fog("#0b0508", 38, 80);
      this.scene.add(new THREE.HemisphereLight("#ffe6c8", "#2a0f18", .75)); const key = new THREE.DirectionalLight("#fff0d8", 1.4); key.position.set(-6, 16, 8); key.castShadow = true; key.shadow.mapSize.set(1536, 1536); Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 }); this.scene.add(key);
      const rim = new THREE.DirectionalLight("#e0428f", .4); rim.position.set(8, 6, -8); this.scene.add(rim);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#120a0d", metalness: .5, roughness: .4 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.55; floor.receiveShadow = true; this.scene.add(floor);
      this.fx = new Fx(this.scene); this.buildUi(canvas); new ResizeObserver(() => this.resize()).observe(this.el); this.resize(); requestAnimationFrame(() => this.frame()); void this.select(games[0].id);
    } catch (e) { console.warn("Arcade needs WebGL", e); this.failed = true; }
  }

  private buildUi(canvas: HTMLCanvasElement) {
    const el = (t: string, c = "", x = "") => { const e = document.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; };
    const top = el("div", "ar-top"), title = el("div", "ar-title"), name = el("b", "", ""), blurb = el("small", "", ""), tabs = el("nav", "ar-tabs"), chips = el("div", "ar-chips"); title.append(el("small", "", "THE TESSERA · PHYSICS ARCADE"), name, blurb); top.append(title, tabs, chips);
    const tb: HTMLButtonElement[] = this.games.map(g => { const b = el("button", "ar-tab", g.name) as HTMLButtonElement; b.type = "button"; b.addEventListener("click", () => void this.select(g.id)); tabs.append(b); return b; });
    const bar = el("div", "ar-bar"), bets = el("div", "ar-bets"), opts = el("div", "ar-opts"), primary = el("button", "ar-primary") as HTMLButtonElement; primary.type = "button"; primary.addEventListener("click", () => { tone(520, .08, .03); this.game?.primary(); this.host.changed(); });
    const bb: HTMLButtonElement[] = [10, 50, 100, 500, 1000].map(v => { const b = el("button", "ar-bet", "$" + (v >= 1000 ? "1K" : v)) as HTMLButtonElement; b.type = "button"; b.dataset.v = String(v); b.addEventListener("click", () => { this.stakeV = v; this.refresh(); }); bets.append(b); return b; });
    const betWrap = el("div", "ar-betwrap"); betWrap.append(el("small", "", "STAKE"), bets); bar.append(betWrap, primary, opts);
    const say = el("p", "ar-say"); say.setAttribute("role", "status"); const big = el("div", "ar-big"), flash = el("div", "ar-flash");
    this.el.append(canvas, top, say, big, flash, bar); this.ui = { chips, say, big, primary, opts, bets: bb, tabs: tb, blurb, flash, name };
  }
  private resize() { const w = this.el.clientWidth, h = this.el.clientHeight; if (w < 2 || h < 2) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  private refresh() {
    const chips = Math.floor(this.host.chips()); this.ui.chips.textContent = "Chips  $" + chips.toLocaleString("en-NZ");
    for (const b of this.ui.bets) { const v = Number(b.dataset.v); b.classList.toggle("on", v === this.stakeV); b.disabled = this.busy || v > chips; }
    for (const [i, b] of this.ui.tabs.entries()) { b.classList.toggle("on", this.games[i] === this.game); b.disabled = this.busy && this.games[i] !== this.game; }
  }
  private ctx(): GameCtx {
    const room = this;
    return {
      scene: this.scene, group: this.group!, camera: this.camera, fx: this.fx, opts: this.ui.opts, stake: () => this.stakeV,
      spend: n => { if (this.host.chips() < n) { this.ui.say.textContent = "Not enough chips for that stake."; return false; } this.host.setChips(this.host.chips() - n); this.refresh(); return true; },
      settle: (game, stake, win) => { const w = Math.floor(win); if (w > 0) this.host.setChips(this.host.chips() + w); this.host.round(game, w - stake); this.refresh(); this.host.changed(); },
      say: t => { this.ui.say.textContent = t; }, big: (t, k) => { const e = this.ui.big; e.textContent = t; e.className = "ar-big"; void e.offsetWidth; e.className = "ar-big pop " + k; },
      primary: (label, disabled = false) => { this.ui.primary.textContent = label; this.ui.primary.disabled = disabled; }, busyChanged: () => room.refresh(),
    };
  }
  async select(id: string) {
    if (this.loading || (this.game && this.game.busy())) return; const next = this.games.find(g => g.id === id); if (!next || next === this.game) return; this.loading = true;
    this.game?.unmount(); this.fx.clear(); if (this.group) this.scene.remove(this.group); this.ui.opts.replaceChildren(); this.group = new THREE.Group(); this.scene.add(this.group); this.game = next;
    this.ui.name.textContent = next.name; this.ui.blurb.textContent = next.blurb; this.ui.say.textContent = "Loading the physics engine…"; this.ui.primary.disabled = true;
    try { await next.mount(this.ctx()); this.ui.say.textContent = ""; } catch (e) { console.warn(e); this.ui.say.textContent = "The physics engine did not start in this browser."; }
    this.loading = false; this.refresh();
  }
  private frame() {
    requestAnimationFrame(() => this.frame());
    if (!this.el.isConnected || document.hidden || this.el.closest(".hidden")) { this.attached = false; this.clock.getDelta(); return; }
    if (!this.attached) { this.attached = true; this.resize(); this.refresh(); }
    const real = Math.min(this.clock.getDelta(), .05); this.t += real; const fx = this.fx;
    fx.step(real, real); this.game?.update(real, real, this.t); this.game?.camera(this.t, this.camera.aspect);
    this.camera.fov = 46 - fx.punch * 6; this.camera.updateProjectionMatrix();
    this.ui.flash.style.opacity = String(fx.flashA); this.renderer.domElement.style.filter = fx.juice > .03 ? `saturate(${1 + fx.juice * .5}) brightness(${1 + fx.juice * .15})` : "none";
    if (Math.floor(this.t * 4) !== Math.floor((this.t - real) * 4)) this.refresh();
    this.renderer.render(this.scene, this.camera);
  }
}
