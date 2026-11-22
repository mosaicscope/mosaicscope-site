import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Character } from "../../entities/types";
import { casinoCompany } from "../CasinoFloorPlan";
import { carpet, dome, felt, marble, neon, paint, spark, wallpaper, wood } from "./LobbyTextures";
import { buildFigure, poseFigure, type Action, type Fig, type Role } from "./LobbyMosaic";
import { mergeStatic } from "./Merge";

/**
 * The Tessera lobby in 3D. The room, the tables and the machines are all procedural; the people are the game's own Mosaics
 * (see LobbyMosaic). Click a Mosaic or a table and it plays its gimmick; click again and you walk into the matching game.
 */
export interface LobbyHost { people(): readonly Character[]; go(id: string): void; meet(id?: number): void; cash(): number; setCash(n: number): void }
/** Thrown cash is real wallet money. Bills flutter down, land, and pile up where they fall. */
const BILL_MAX = 4000, CELL = .35, GX = 80, GZ = 68, BILL_THICK = .0045, BILL_SCALE = 2;
interface Bill { alive: boolean; flying: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; wob: number; ph: number; spin: number; cell: number; value: number }
interface Station { id: string; label: string; tab: string; at: THREE.Vector3; focus: THREE.Vector3; color: string; quips: string[]; group: THREE.Group; ring: THREE.Mesh; sign: THREE.Sprite; light: THREE.PointLight | null; gimmick: () => void }
interface Agent { fig: Fig; station: string; menu: readonly Action[]; next: number; action: Action; hold: number; walker?: { points: THREE.Vector3[]; i: number; moving: boolean; speed: number; pause: Action[] }; face: number; blob: THREE.Mesh; override?: { action: Action; until: number } }
interface Burst { pts: THREE.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; col: Float32Array; n: number; next: number; g: number }

const CARPET = "#3b1119";
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const SEATED_OK: readonly Action[] = ["slots", "cards", "sip", "chat", "phone", "think", "cheer", "facepalm", "clap", "idle", "toast"];
const MENUS: Record<Role, readonly Action[]> = {
  player: ["idle", "wave", "idle", "stretch"], dealer: ["deal", "deal", "deal", "shuffle", "chat", "bow"], croupier: ["spin", "spin", "spin", "chat", "point", "bow"],
  bartender: ["shake", "shake", "count", "chat", "sip", "point"], cashier: ["count", "count", "count", "chat", "wave", "phone"], host: ["bow", "wave", "point", "chat", "idle"], security: ["idle", "phone", "point", "idle", "think"],
  slot: ["slots", "slots", "slots", "slots", "cheer", "facepalm", "sip", "phone"], cards: ["cards", "cards", "cards", "think", "sip", "cheer", "facepalm", "chat"], roulette: ["cards", "cards", "think", "clap", "cheer", "sip", "chat"],
  highroller: ["toast", "chat", "sip", "think", "clap", "point"], lounge: ["chat", "sip", "chat", "phone", "toast", "think", "clap", "stretch"], walker: ["chat", "wave", "phone", "think", "dance", "clap", "stretch", "sip"], crash: ["cheer", "fistpump", "facepalm", "clap", "point", "think", "cheer"],
};

export class Lobby3D {
  readonly el: HTMLElement; failed = false;
  private renderer!: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(38, 1.6, .1, 120); private controls!: OrbitControls;
  private stations = new Map<string, Station>(); private agents: Agent[] = []; private pick: THREE.Object3D[] = []; private bursts: Burst[] = [];
  private hud!: { tip: HTMLElement; bubble: HTMLElement; title: HTMLElement; nav: HTMLElement; status: HTMLElement };
  private armed: { key: string; at: number; station: string; fig?: Fig } | null = null; private hover: string | null = null; private down = { x: 0, y: 0 };
  private tween: { t: number; from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3 } | null = null;
  private clock = new THREE.Clock(); private time = 0; private screens: { tex: THREE.CanvasTexture; draw: (t: number, spin: number) => void; spin: number; every: number; n: number }[] = [];
  private wheel: THREE.Object3D | null = null; private wheelSpin = 0; private ballPivot: THREE.Object3D | null = null; private crest: THREE.Object3D | null = null; private chandelier: THREE.Object3D | null = null; private dust!: THREE.Points;
  private billMesh!: THREE.InstancedMesh; private bills: Bill[] = []; private billNext = 0; private heights = new Float32Array(GX * GZ); private queue: { at: number; amount: number; n: number; v: number; done: number }[] = []; private thrown = 0; private muzzle = new THREE.Object3D(); private barrel: THREE.Object3D | null = null; private recoil = 0; private cannonUI!: { wallet: HTMLElement; msg: HTMLElement; chips: HTMLButtonElement[]; fire: HTMLButtonElement; floor: HTMLElement }; private amount = 1000; private walletAt = 0; private dummy = new THREE.Object3D(); private audio?: AudioContext;
  private rocket: { g: THREE.Group; t: number } | null = null; private raycaster = new THREE.Raycaster(); private ptr = new THREE.Vector2(); private attached = false;

  static create(host: LobbyHost): Lobby3D | null { const l = new Lobby3D(host); return l.failed ? null : l; }

  private constructor(private host: LobbyHost) {
    this.el = document.createElement("section"); this.el.className = "lobby3d"; this.el.setAttribute("aria-label", "The Tessera lobby in 3D: click a Mosaic or a table, then click again to go there");
    try {
      const canvas = document.createElement("canvas"); canvas.className = "lb-canvas"; canvas.tabIndex = 0;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
      const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); this.scene.environmentIntensity = .5;
      this.scene.background = new THREE.Color("#0b0508"); this.scene.fog = new THREE.FogExp2("#0b0508", .017);
      const tip = el("div", "lb-tip"), bubble = el("div", "lb-bubble"), title = el("div", "lb-title"), nav = el("nav", "lb-nav"), status = el("p", "lb-status"); status.setAttribute("role", "status");
      title.append(el("small", "", "THE TESSERA"), el("b", "", "Grand Lobby")); this.el.append(canvas, title, nav, tip, bubble, status); this.hud = { tip, bubble, title, nav, status };
      this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.dampingFactor = .07; this.controls.minDistance = 7; this.controls.maxDistance = 34; this.controls.maxPolarAngle = Math.PI * .46; this.controls.minPolarAngle = .35; this.controls.target.set(0, .8, 0); this.camera.position.set(14, 11.5, 14.5); this.controls.update();
      (window as unknown as Record<string, unknown>).__lobby = this; this.buildRoom(); this.buildStations(); this.buildCannon(); this.populate(); mergeStatic(this.scene); this.bindInput(canvas);
      new ResizeObserver(() => this.resize()).observe(this.el); this.resize(); requestAnimationFrame(() => this.frame());
    } catch (e) { console.warn("Lobby needs WebGL", e); this.failed = true; }
  }

  /* ------------------------------------------------------------ small builders */
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  /** Materials are shared by look, so the merge pass can fold everything of one look into a single draw. */
  private mat(c: THREE.ColorRepresentation, rough = .6, metal = 0, map?: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) { const key = [new THREE.Color(c).getHexString(), rough, metal, map?.uuid ?? "", JSON.stringify(extra, (_k, v) => (v && v.isColor ? v.getHexString() : v))].join("|"); let m = this.mats.get(key); if (!m) this.mats.set(key, m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, map, ...extra })); return m; }
  private add<T extends THREE.Object3D>(o: T, p: THREE.Object3D = this.scene, x = 0, y = 0, z = 0): T { o.position.set(x, y, z); p.add(o); return o; }
  private box(w: number, h: number, d: number, m: THREE.Material, p: THREE.Object3D, x: number, y: number, z: number, shadow = false) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = shadow; o.receiveShadow = true; return this.add(o, p, x, y, z); }
  private cyl(rt: number, rb: number, h: number, m: THREE.Material, p: THREE.Object3D, x: number, y: number, z: number, seg = 24, shadow = false) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.castShadow = shadow; o.receiveShadow = true; return this.add(o, p, x, y, z); }
  private glow(color: string, p: THREE.Object3D, x: number, y: number, z: number, size: number, op = .8) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: op })); s.scale.setScalar(size); return this.add(s, p, x, y, z); }
  private signOf(text: string, color: string, p: THREE.Object3D, x: number, y: number, z: number, w = 3.4) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: neon(text, color), transparent: true, depthWrite: false })); s.scale.set(w, w * .31, 1); return this.add(s, p, x, y, z); }

  /* ------------------------------------------------------------ the room */
  private buildRoom() {
    const S = this.scene, brass = this.mat("#d4af37", .25, .9), wallM = this.mat("#fff", .85, 0, wallpaper([7, 1]));
    S.add(new THREE.HemisphereLight("#ffe6c8", "#2a0f18", .75)); S.add(new THREE.AmbientLight("#ffd9b0", .22));
    const key = new THREE.DirectionalLight("#fff0d8", 1.9); key.position.set(9, 16, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 13; sc.bottom = -13; sc.near = 2; sc.far = 46; key.shadow.bias = -.0004; key.shadow.normalBias = .04; S.add(key);
    const rim = new THREE.DirectionalLight("#8aa8ff", .5); rim.position.set(-12, 7, -6); S.add(rim);
    // floor: polished marble under carpets, a gold-inlaid medallion at the centre
    const floor = this.add(new THREE.Mesh(new THREE.PlaneGeometry(26, 22), new THREE.MeshPhysicalMaterial({ map: marble([6, 5], true), roughness: .22, metalness: .05, clearcoat: .7, clearcoatRoughness: .15 })), S, 0, 0, 0); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const rug = (w: number, d: number, x: number, z: number, base: string, rep: [number, number]) => { const r = this.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat("#fff", .95, 0, carpet(rep, base))), S, x, .012, z); r.rotation.x = -Math.PI / 2; r.receiveShadow = true; const b = this.add(new THREE.Mesh(new THREE.PlaneGeometry(w + .16, d + .16), this.mat("#8a6a3a", .5, .5)), S, x, .008, z); b.rotation.x = -Math.PI / 2; };
    // one calm colour throughout: deep wine with a tone-on-tone weave, no competing hues
    rug(12.5, 7, -2.5, -4.6, CARPET, [5, 3]); rug(8.5, 7.5, 6.2, 1.5, CARPET, [3.4, 3]); rug(10, 5, -3, 5.4, CARPET, [4, 2]);
    const med = this.add(new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), this.mat("#fff", .9, 0, carpet([2.2, 2.2], CARPET))), S, 0, .016, 0); med.rotation.x = -Math.PI / 2; med.receiveShadow = true;
    for (const [r, w] of [[4.2, .09], [4.45, .05]] as const) { const rg = this.add(new THREE.Mesh(new THREE.RingGeometry(r, r + w, 96), brass), S, 0, .02, 0); rg.rotation.x = -Math.PI / 2; }
    // walls: damask over oak wainscot, pilasters, mouldings, art
    const wall = (len: number, x: number, z: number, ry: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
      const w = this.box(len, 7, .3, wallM, g, 0, 3.5, 0); (w.material as THREE.MeshStandardMaterial).map!.repeat.set(len / 3.4, 1);
      this.box(len, 1.3, .36, this.mat("#fff", .35, 0, wood([len / 2, 1])), g, 0, .65, .03, true); this.box(len, .08, .42, brass, g, 0, 1.34, .05); this.box(len, .14, .44, brass, g, 0, 6.9, .06);
      for (let i = -Math.floor(len / 5); i <= Math.floor(len / 5); i++) { const px = i * 4.6; this.box(.7, 7, .22, this.mat("#efe4cc", .4, 0, marble([.5, 2.5])), g, px, 3.5, .22, true); this.box(.9, .3, .3, brass, g, px, .15, .26); this.box(.9, .4, .3, brass, g, px, 6.7, .26); }
      return g;
    };
    wall(26, 0, -10.6, 0); wall(22, -12.6, 0, Math.PI / 2);
    const art = (x: number, y: number, z: number, ry: number, k: number) => {
      const t = paint("art" + k, 256, 320, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); const P = [["#12294d", "#d4af37", "#c0273d"], ["#2a0f3a", "#ff7ab6", "#ffd36a"], ["#0d3a30", "#e8c15a", "#7fd0ff"], ["#3a0d14", "#f2a05a", "#e8e0d0"]][k % 4]; gr.addColorStop(0, P[0]); gr.addColorStop(1, "#0a0a0f"); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { g.globalAlpha = .55; g.fillStyle = P[1 + i % 2]; g.beginPath(); g.arc(30 + (i * 53) % 200, 40 + (i * 71) % 240, 18 + (i * 13) % 50, 0, 7); g.fill(); } g.globalAlpha = .8; g.strokeStyle = P[1]; g.lineWidth = 3; g.beginPath(); g.moveTo(10, h * .7); g.bezierCurveTo(w * .3, h * .2, w * .6, h * 1.1, w, h * .4); g.stroke(); });
      const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; S.add(f); this.box(2.1, 2.7, .12, brass, f, 0, 0, 0); this.box(1.8, 2.4, .14, this.mat("#fff", .4, 0, t), f, 0, 0, .02); this.add(new THREE.SpotLight("#ffe2b0", 12, 6, .5, .6, 1.5), f, 0, 2.2, 1.2).target.position.set(0, 0, -1);
    };
    art(-7, 3.9, -10.3, 0, 0); art(-2.5, 3.9, -10.3, 0, 1); art(2, 3.9, -10.3, 0, 2); art(-12.3, 3.9, -6, Math.PI / 2, 3); art(-12.3, 3.9, 6.8, Math.PI / 2, 1);
    // grand halo and chandelier over the medallion
    const halo = this.add(new THREE.Mesh(new THREE.RingGeometry(3.1, 4.5, 64), new THREE.MeshBasicMaterial({ map: dome(), side: THREE.DoubleSide, transparent: true, opacity: .9 })), S, 0, 8.4, 0); halo.rotation.x = -Math.PI / 2;
    const ch = new THREE.Group(); ch.position.set(0, 6.2, 0); S.add(ch); this.chandelier = ch;
    const crystal = new THREE.MeshPhysicalMaterial({ color: "#fff", transmission: .9, roughness: .02, thickness: .4, ior: 1.5, transparent: true, opacity: .9, emissive: "#ffe6b0", emissiveIntensity: .25 });
    for (let r = 0; r < 3; r++) { const ring = this.add(new THREE.Mesh(new THREE.TorusGeometry(.8 + r * .55, .04, 8, 48), brass), ch, 0, -r * .35, 0); ring.rotation.x = Math.PI / 2; const n = 10 + r * 6; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, c = this.add(new THREE.Mesh(new THREE.OctahedronGeometry(.1 + r * .015, 0), crystal), ch, Math.cos(a) * (.8 + r * .55), -r * .35 - .2, Math.sin(a) * (.8 + r * .55)); c.scale.y = 2; this.glow("#ffe9b8", ch, Math.cos(a) * (.8 + r * .55), -r * .35, Math.sin(a) * (.8 + r * .55), .5, .7); } }
    this.add(new THREE.PointLight("#ffd9a0", 55, 20, 1.6), ch, 0, -1, 0);
    // dust motes drifting in the light
    const n = 360, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([rnd(-12, 12), rnd(.5, 8), rnd(-10, 10)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); this.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: .09, map: spark("#ffe6b0"), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); this.dust.frustumCulled = false; S.add(this.dust);
    // velvet ropes along the open front
    const post = (x: number, z: number) => { this.cyl(.05, .07, 1, brass, S, x, .5, z, 10); this.add(new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), brass), S, x, 1.05, z); };
    for (let i = -5; i <= 5; i++) { post(i * 2.2, 10.2); if (i < 5) { const rope = this.add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 8), this.mat("#a3142b", .8)), S, i * 2.2 + 1.1, .9, 10.2); rope.rotation.z = Math.PI / 2; } }
    for (let i = -4; i <= 4; i++) if (i) { post(12.4, i * 2.2); }
    // red entrance runner and welcome sign
    const run = this.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7), this.mat("#fff", .9, 0, carpet([1.2, 3], CARPET))), S, 0, .02, 7.2); run.rotation.x = -Math.PI / 2; run.receiveShadow = true;
    this.signOf("WELCOME", "#ffcf6a", S, 0, 3.2, 10.2, 5); this.signOf("THE TESSERA", "#ff5aa0", S, -5.2, 6.4, -10.1, 5.4);
    for (const [x, z] of [[-10.4, 9], [10.8, -8.4], [10.8, 8.6], [-10.4, -9.4]]) this.plant(x, z);
  }

  private plant(x: number, z: number) { const g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g); this.cyl(.38, .3, .7, this.mat("#efe4cc", .3, 0, marble([1, 1])), g, 0, .35, 0, 20, true); const leaf = this.mat("#2e8b4a", .55); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, l = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), leaf); l.scale.set(.5, 1.6, .5); l.position.set(Math.cos(a) * .3, 1.4 + (i % 3) * .3, Math.sin(a) * .3); l.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); l.castShadow = true; g.add(l); } }

  /* ------------------------------------------------------------ stations */
  private station(id: string, label: string, tab: string, at: THREE.Vector3, focus: THREE.Vector3, color: string, quips: string[], size: [number, number], gimmick: () => void, signY = 4.2): THREE.Group {
    const group = new THREE.Group(); group.position.copy(at); this.scene.add(group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(size[0], size[1]) * .5 + .1, Math.max(size[0], size[1]) * .5 + .3, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; group.add(ring);
    const sign = this.signOf(label.toUpperCase(), color, group, 0, signY, 0, Math.max(2.6, label.length * .36));
    const light = new THREE.PointLight(color, 9, 8, 1.7); light.position.set(0, 3, 0); group.add(light);
    const pickBox = new THREE.Mesh(new THREE.BoxGeometry(size[0], 2.2, size[1]), new THREE.MeshBasicMaterial({ visible: false })); pickBox.userData.keep = true; ring.userData.keep = true; pickBox.position.y = 1.1; pickBox.userData.station = id; group.add(pickBox); this.pick.push(pickBox);
    this.stations.set(id, { id, label, tab, at, focus, color, quips, group, ring, sign, light, gimmick }); return group;
  }

  private buildStations() {
    const brass = this.mat("#d4af37", .25, .9), leather = this.mat("#2a1218", .5, .05), chrome = this.mat("#cfd3da", .15, 1), dark = this.mat("#15131a", .5, .3);
    const stool = (p: THREE.Object3D, x: number, z: number, c = "#7a1426") => { this.cyl(.26, .26, .08, this.mat(c, .5, 0), p, x, .66, z, 20, true); this.cyl(.05, .05, .6, chrome, p, x, .33, z, 10); this.cyl(.24, .24, .03, chrome, p, x, .02, z, 20); };
    const chipStack = (p: THREE.Object3D, x: number, y: number, z: number, n: number, c: string) => { for (let i = 0; i < n; i++) this.cyl(.075, .075, .02, this.mat(c, .4), p, x, y + i * .022, z, 14); };
    const cardsOn = (p: THREE.Object3D, x: number, y: number, z: number, n: number, ry = 0) => { for (let i = 0; i < n; i++) { const c = this.box(.16, .004, .23, this.mat("#f7f4ea", .5), p, x + i * .2, y, z); c.rotation.y = ry + (i - n / 2) * .08; } };

    // ---- Kiwi Gold slots
    const slots = this.station("pokies", "Kiwi Gold", "pokies", V(-6.2, 0, -8.6), V(-4.5, 1.6, -6), "#ff3da8", ["Three kiwis and the roof comes off.", "It's due. It's definitely due.", "Spin it once more for luck!"], [6.4, 2.4], () => this.slotGimmick());
    const names = ["#ff3da8", "#ffd36a", "#46e0ff", "#9bff6a", "#ff8a3d", "#b46bff"];
    for (let i = 0; i < 6; i++) {
      const x = -2.5 + i * 1.0, cab = new THREE.Group(); cab.position.set(x, 0, 0); slots.add(cab); const col = names[i];
      this.box(.86, 1.9, .8, this.mat("#1a1220", .35, .5), cab, 0, .95, 0, true); this.box(.9, .06, .84, chrome, cab, 0, 1.1, 0); this.box(.8, .5, .7, this.mat("#0e0a14", .4, .3), cab, 0, 2.1, 0);
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 192; const g = cv.getContext("2d")!, tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const syms = ["7", "BAR", "★", "♣", "◆", "🍒", "🔔"], draw = (t: number, spin: number) => { const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, "#1b0f2e"); gr.addColorStop(1, "#08050f"); g.fillStyle = gr; g.fillRect(0, 0, 256, 192); for (let r = 0; r < 3; r++) { g.fillStyle = "#f7f1e1"; g.fillRect(14 + r * 78, 26, 70, 130); g.save(); g.beginPath(); g.rect(14 + r * 78, 26, 70, 130); g.clip(); const off = spin > 0 ? (t * 600 * (1 + r * .3)) % 130 : 0; for (let k = -1; k < 3; k++) { const y = 26 + k * 65 + off % 65, s = syms[(Math.floor((t * 6 + r + k + i) * (spin > 0 ? 1 : 0) + i + r * 2 + k + 8)) % syms.length]; g.font = "800 40px Georgia,serif"; g.textAlign = "center"; g.fillStyle = s === "7" || s === "🍒" ? "#c0273d" : s === "BAR" ? "#111" : "#c8961c"; g.fillText(s, 49 + r * 78, y + 47); } g.restore(); } g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(10, 22, 236, 138); g.fillStyle = col; g.font = "700 15px system-ui"; g.textAlign = "center"; g.fillText(spin > 1.2 ? "JACKPOT!" : "KIWI GOLD", 128, 182); tex.needsUpdate = true; };
      draw(0, 0); this.screens.push({ tex, draw, spin: 0, every: 4, n: i });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.74, .56), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#fff", emissiveIntensity: .9, roughness: .3 })); scr.position.set(0, 1.58, .41); scr.rotation.x = -.16; cab.add(scr); cab.userData.screen = this.screens.length - 1;
      this.box(.82, .08, .06, this.mat(col, .3, 0, undefined, { emissive: col, emissiveIntensity: 1.6 }), cab, 0, 2.38, .36); this.box(.05, 1.7, .05, this.mat(col, .3, 0, undefined, { emissive: col, emissiveIntensity: 1.2 }), cab, -.45, .95, .4); this.box(.05, 1.7, .05, this.mat(col, .3, 0, undefined, { emissive: col, emissiveIntensity: 1.2 }), cab, .45, .95, .4);
      this.cyl(.04, .04, .45, chrome, cab, .52, 1.3, .1, 10); this.add(new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), this.mat("#c0273d", .2, .2)), cab, .52, 1.55, .1); this.box(.6, .12, .3, this.mat("#2a1c3a", .4, .4), cab, 0, 1.02, .5); stool(slots, x, 1.1, ["#7a1426", "#14405a", "#5a2a7a", "#1c5a3a", "#8a4a14", "#7a1448"][i]);
      this.glow(col, cab, 0, 2.5, .3, 1.2, .6);
    }
    // ---- Blackjack
    const bj = this.station("blackjack", "Blackjack", "blackjack", V(-5.4, 0, -2.2), V(-4.2, 1.4, 1), "#ff5a5a", ["Dealer shows a six. Stand!", "Double down? Bold. I like it.", "Twenty-one pays three to two."], [4.8, 4], () => this.bjGimmick());
    const half = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, .1, 48, 1, false, -Math.PI / 2 - Math.PI * .5 + Math.PI, Math.PI), [this.mat("#fff", .9, 0, felt("blackjack", "#0f5a3a")), leather, leather] as THREE.Material[]); half.rotation.y = Math.PI * .0; half.position.y = .92; half.castShadow = half.receiveShadow = true; bj.add(half);
    this.cyl(1.9, 1.7, .86, this.mat("#2a1410", .4, .1, wood([1, 1])), bj, 0, .45, 0, 32, true).scale.set(1, 1, 1); const rim = new THREE.Mesh(new THREE.TorusGeometry(2.05, .1, 10, 48, Math.PI), leather); rim.rotation.set(-Math.PI / 2, 0, 0); rim.position.y = .98; bj.add(rim); this.box(1.5, .06, .5, brass, bj, 0, .96, -.2); this.box(2, .1, .36, this.mat("#2a1410", .4, .1, wood([1, 1])), bj, 0, .93, 0);
    for (let i = 0; i < 5; i++) { const a = (i / 4) * Math.PI * .8 + Math.PI * .1; chipStack(bj, Math.cos(a) * 1.3, .98, Math.sin(a) * 1.3, 3 + i % 3, ["#c0273d", "#1c4fa3", "#1f8a50", "#111", "#7a1b9a"][i]); cardsOn(bj, Math.cos(a) * .95 - .2, .98, Math.sin(a) * .95, 2, a); }
    for (let i = 0; i < 4; i++) { const a = i / 3 * Math.PI * .86 + Math.PI * .07; stool(bj, Math.cos(a) * 2.5, Math.sin(a) * 2.5); }
    // ---- Roulette
    const ro = this.station("roulette", "Roulette", "roulette", V(5.6, 0, 1.4), V(4.2, 1.6, 4), "#9bff6a", ["Red twenty-three. Trust me.", "No more bets, please!", "The ball knows nothing. I know everything."], [5.4, 3], () => this.rouletteGimmick());
    this.box(4.4, .12, 1.9, this.mat("#fff", .9, 0, felt("roulette", "#0b5a35")), ro, .4, .92, 0, true); this.box(4.6, .86, 2.1, this.mat("#2a1410", .35, .1, wood([2, 1])), ro, .4, .43, 0, true);
    this.box(4.7, .1, .12, leather, ro, .4, .98, 1.02); this.box(4.7, .1, .12, leather, ro, .4, .98, -1.02); this.box(.12, .1, 2.14, leather, ro, 2.7, .98, 0); this.box(.12, .1, 2.14, leather, ro, -1.9, .98, 0);
    this.cyl(.95, .8, .22, this.mat("#2a1410", .25, .2, wood([1, 1])), ro, -1.2, 1.05, 0, 40, true); const wtex = paint("wheel", 512, 512, (g, w) => { const c = w / 2; g.translate(c, c); const order = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]; for (let i = 0; i < 37; i++) { const a0 = i / 37 * Math.PI * 2, a1 = (i + 1) / 37 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, c - 10, a0, a1); g.closePath(); g.fillStyle = order[i] === 0 ? "#1d8a4a" : i % 2 ? "#12121a" : "#b3122c"; g.fill(); g.strokeStyle = "#d4af37"; g.lineWidth = 2; g.stroke(); g.save(); g.rotate((a0 + a1) / 2); g.fillStyle = "#fff"; g.font = "700 22px Georgia"; g.textAlign = "center"; g.fillText(String(order[i]), c * .8, 7); g.restore(); } g.fillStyle = "#1b1218"; g.beginPath(); g.arc(0, 0, c * .55, 0, 7); g.fill(); g.strokeStyle = "#d4af37"; g.lineWidth = 6; g.stroke(); g.beginPath(); g.arc(0, 0, c * .2, 0, 7); g.fillStyle = "#d4af37"; g.fill(); });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.86, 64), new THREE.MeshStandardMaterial({ map: wtex, roughness: .3, metalness: .2 })); disc.rotation.x = -Math.PI / 2; disc.position.set(0, .125, 0); const spinner = new THREE.Group(); spinner.add(disc); spinner.position.set(-1.2, 1.17, 0); ro.add(spinner); this.wheel = spinner;
    const piv = new THREE.Group(); piv.position.set(-1.2, 1.22, 0); ro.add(piv); this.ballPivot = piv; const ball = new THREE.Mesh(new THREE.SphereGeometry(.05, 14, 10), this.mat("#fff", .1, .2)); ball.position.set(.72, 0, 0); piv.add(ball);
    this.cyl(.1, .1, .3, brass, ro, -1.2, 1.28, 0, 12); for (let i = 0; i < 3; i++) chipStack(ro, 1.6 + i * .4, .98, -.3 + i * .35, 4 + i, ["#c0273d", "#1c4fa3", "#111"][i]); for (let i = 0; i < 3; i++) stool(ro, .2 + i * 1.3, 1.65, "#5a2a7a");
    // ---- Texas hold'em
    const ho = this.station("holdem", "Poker Tables", "holdem", V(-1.6, 0, 6.2), V(-1.6, 1.5, 8.6), "#ffcf6a", ["I'm not bluffing. Probably.", "Raise it. Make them pay.", "Read the table, not the cards."], [4.6, 3.6], () => this.holdemGimmick());
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, .12, 48), [this.mat("#fff", .9, 0, felt("poker", "#14305a")), leather, leather] as THREE.Material[]); top.scale.set(1.35, 1, 1); top.position.y = .93; top.castShadow = true; ho.add(top);
    const prail = new THREE.Mesh(new THREE.TorusGeometry(1.6, .12, 10, 48), leather); prail.rotation.x = Math.PI / 2; prail.scale.set(1.35, 1, 1); prail.position.y = .97; ho.add(prail); const pbase = this.cyl(1.2, 1.5, .88, this.mat("#2a1410", .4, .1, wood([1, 1])), ho, 0, .44, 0, 32, true); pbase.scale.set(1.35, 1, 1);
    cardsOn(ho, -.5, .99, 0, 5); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; chipStack(ho, Math.cos(a) * 1.5, .99, Math.sin(a) * .95, 2 + i % 4, ["#c0273d", "#1c4fa3", "#1f8a50", "#111", "#7a1b9a", "#d4af37"][i]); }
    for (let i = 0; i < 5; i++) { const a = Math.PI * .85 + i / 4 * Math.PI * 1.3; stool(ho, Math.cos(a) * 2.35 * 1.0, Math.sin(a) * 1.85); }
    // ---- Crash kiosk
    const ck = this.station("flight", "Sky High", "flight", V(10, 0, -3.4), V(8.4, 2.4, -1.2), "#46aaff", ["Cash out before it blinks!", "Ten times? Get out! Get OUT!", "I'm riding it to the moon."], [2.2, 2.6], () => this.crashGimmick(), 5.6);
    this.cyl(1.1, 1.3, .3, dark, ck, 0, .15, 0, 40, true); this.box(.5, 3.4, .5, this.mat("#0e1526", .4, .5), ck, 0, 1.9, 0, true);
    const kcv = document.createElement("canvas"); kcv.width = 512; kcv.height = 320; const kg = kcv.getContext("2d")!, ktex = new THREE.CanvasTexture(kcv); ktex.colorSpace = THREE.SRGBColorSpace;
    const kdraw = (t: number) => { const c = t % 9, mult = Math.exp(.3 * Math.min(c, 7)), blink = c > 7; const gr = kg.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, "#05030f"); gr.addColorStop(1, "#3a1850"); kg.fillStyle = gr; kg.fillRect(0, 0, 512, 320); for (let i = 0; i < 40; i++) { kg.fillStyle = "rgba(255,255,255,.7)"; kg.fillRect((i * 97 + t * 30) % 512, (i * 53 + t * 50) % 320, 2, 2); } if (!blink) { const rx = 80 + c * 50, ry = 280 - c * 28; kg.save(); kg.translate(rx, ry); kg.rotate(-.7); kg.fillStyle = "#ffd36a"; kg.beginPath(); kg.moveTo(-30, 8); kg.lineTo(-60 - Math.random() * 20, 0); kg.lineTo(-30, -8); kg.fill(); kg.fillStyle = "#f4f6fa"; kg.beginPath(); kg.ellipse(0, 0, 36, 14, 0, 0, 7); kg.fill(); kg.fillStyle = "#ee4f9c"; kg.beginPath(); kg.moveTo(-14, 10); kg.lineTo(-30, 28); kg.lineTo(0, 12); kg.fill(); kg.beginPath(); kg.moveTo(-14, -10); kg.lineTo(-30, -28); kg.lineTo(0, -12); kg.fill(); kg.fillStyle = "#46aaff"; kg.beginPath(); kg.arc(14, 0, 6, 0, 7); kg.fill(); kg.restore(); } kg.font = "800 74px system-ui"; kg.textAlign = "center"; kg.fillStyle = blink ? "#ff465a" : mult < 2 ? "#8cffbe" : mult < 5 ? "#ffe9a6" : "#ff9a4a"; kg.fillText(blink ? "BLINK!" : mult.toFixed(2) + "×", 256, 90); ktex.needsUpdate = true; };
    kdraw(0); this.screens.push({ tex: ktex, draw: (t) => kdraw(t), spin: 0, every: 3, n: 99 });
    const kscr = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.44), new THREE.MeshStandardMaterial({ map: ktex, emissiveMap: ktex, emissive: "#fff", emissiveIntensity: 1, roughness: .2 })); kscr.position.set(-.34, 2.6, .1); kscr.rotation.y = -Math.PI / 2 + .3; ck.add(kscr); this.box(.12, 1.6, 2.5, chrome, ck, -.28, 2.6, .1, true).rotation.y = .3;
    const ring2 = this.add(new THREE.Mesh(new THREE.TorusGeometry(1.15, .05, 8, 48), this.mat("#46aaff", .3, 0, undefined, { emissive: "#46aaff", emissiveIntensity: 2 })), ck, 0, .32, 0); ring2.rotation.x = Math.PI / 2;
    // ---- Bar
    const bar = this.station("bar", "The Bar", "bar", V(-9.6, 0, 4), V(-7, 1.8, 4.2), "#ffb44a", ["Shaken, never stirred. Obviously.", "House special. You'll thank me.", "Another round for the table!"], [3.4, 7], () => this.barGimmick(), 4.6);
    bar.rotation.y = 0; for (let i = 0; i < 6; i++) { const a = -.7 + i * .28, x = 1.4 - Math.cos(a) * 1.0, z = Math.sin(a) * 5.2 * .62; const seg = this.box(.9, 1.1, 1.0, this.mat("#2a1410", .3, .1, wood([1, 1])), bar, x - .2, .55, z, true); seg.rotation.y = -a * .35; this.box(1.0, .08, 1.1, this.mat("#3a1c10", .15, .1, wood([1, 1])), bar, x - .2, 1.14, z).rotation.y = -a * .35; this.cyl(.03, .03, .9, brass, bar, x + .35, .2, z, 8); stool(bar, x + .95, z * 1.02, "#8a4a14"); }
    for (let r = 0; r < 3; r++) { this.box(.3, .05, 6.4, this.mat("#3a1c10", .3, .1, wood([2, 1])), bar, -1.7, 1.5 + r * .55, 0); for (let i = 0; i < 18; i++) { const c = ["#ff8a3d", "#7be08a", "#d81b60", "#46e0ff", "#f4d777", "#b46bff"][(i + r) % 6]; const b = this.cyl(.05, .06, .3 + (i % 3) * .06, this.mat(c, .15, 0, undefined, { transparent: true, opacity: .8, emissive: c, emissiveIntensity: .45 }), bar, -1.7, 1.7 + r * .55, -3 + i * .35, 10); b.castShadow = false; } }
    this.box(.1, 3.2, 6.6, this.mat("#ffcf8a", .4, 0, undefined, { emissive: "#ffb44a", emissiveIntensity: .35 }), bar, -2.0, 2.3, 0);
    // ---- Cashier cage
    const ca = this.station("cashier", "Cashier", "cashier", V(9.6, 0, -8.1), V(8, 1.8, -5), "#f4d777", ["Chips in, cash out, no questions.", "Marker approved. Don't make me regret it.", "Count it twice. Always twice."], [3.2, 2.2], () => this.cashierGimmick());
    this.box(3, .12, 1.2, this.mat("#2a1410", .3, .1, wood([1, 1])), ca, 0, 1.0, .5, true); this.box(3, 1, 1.1, this.mat("#2a1410", .4, .1, wood([1, 1])), ca, 0, .5, .5, true); for (let i = -7; i <= 7; i++) this.cyl(.022, .022, 1.7, brass, ca, i * .2, 1.9, .05, 8); this.box(3.1, .1, .12, brass, ca, 0, 2.78, .05); this.box(3.1, .1, .12, brass, ca, 0, 1.05, .05);
    for (let i = 0; i < 4; i++) chipStack(ca, -1 + i * .35, 1.06, .75, 6 + i, ["#c0273d", "#1c4fa3", "#1f8a50", "#111"][i]);
    // ---- Physics arcade: two cabinets showing a live-looking plinko board
    const ar = this.station("arcade", "Physics Arcade", "arcade", V(-10.1, 0, -3.4), V(-8.2, 1.6, -3.4), "#8a5be0", ["Real physics, real bounces.", "Drop it dead centre and pray.", "The coin never lies."], [2.4, 3.8], () => this.arcadeGimmick(), 4.2);
    for (let i = 0; i < 2; i++) {
      const z = -1.0 + i * 2.0, cab = new THREE.Group(); cab.position.set(0, 0, z); ar.add(cab); this.box(1.0, 2.1, 1.1, this.mat("#1a1028", .35, .5), cab, 0, 1.05, 0, true); this.box(.9, .5, 1.0, this.mat("#0e0818", .4, .3), cab, 0, 2.3, 0);
      const tex = paint("arcadeScreen" + i, 256, 192, (g, w, h) => { g.fillStyle = "#14091f"; g.fillRect(0, 0, w, h); g.fillStyle = "#e5c566"; for (let r = 0; r < 7; r++) for (let c = 0; c <= r + 2; c++) { g.beginPath(); g.arc(w / 2 + (c - (r + 2) / 2) * 24, 26 + r * 18, 3, 0, 7); g.fill(); } g.fillStyle = "#e0428f"; g.beginPath(); g.arc(70 + i * 60, 150, 8, 0, 7); g.fill(); g.fillStyle = ["#a3142b", "#b8761f", "#1f8a78", "#3d3345", "#1f8a78", "#b8761f", "#a3142b"][0]; for (let k = 0; k < 7; k++) { g.fillStyle = ["#a3142b", "#b8761f", "#1f8a78", "#3d3345", "#1f8a78", "#b8761f", "#a3142b"][k]; g.fillRect(14 + k * 33, 172, 30, 14); } });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.8, .6), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#fff", emissiveIntensity: .9 })); scr.position.set(.51, 1.55, 0); scr.rotation.y = Math.PI / 2; cab.add(scr);
      this.box(.06, 1.8, .06, this.mat("#8a5be0", .3, 0, undefined, { emissive: "#8a5be0", emissiveIntensity: 1.6 }), cab, .5, 1.05, -.5); this.box(.06, 1.8, .06, this.mat("#8a5be0", .3, 0, undefined, { emissive: "#8a5be0", emissiveIntensity: 1.6 }), cab, .5, 1.05, .5); stool(ar, 1.1, z, "#4a2a7a");
    }
    // ---- Lounge
    const lo = new THREE.Group(); lo.position.set(8.6, 0, 6.4); this.scene.add(lo); const velvet = this.mat("#6a1230", .75, 0, undefined, { sheen: 1, sheenColor: new THREE.Color("#ff7a9a") } as THREE.MeshStandardMaterialParameters);
    for (const [x, z, ry] of [[-1.2, 0, 0], [1.4, -1.6, -Math.PI / 2]] as const) { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; lo.add(s); this.box(2.4, .5, .95, velvet, s, 0, .3, 0, true); this.box(2.4, .75, .28, velvet, s, 0, .75, -.4, true); this.box(.28, .6, .95, velvet, s, -1.1, .55, 0); this.box(.28, .6, .95, velvet, s, 1.1, .55, 0); for (let k = 0; k < 6; k++) this.add(new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), brass), s, -1 + k * .4, .78, -.26); }
    this.cyl(.55, .5, .06, this.mat("#cfe8f5", .05, 0, undefined, { transparent: true, opacity: .5 }), lo, .1, .5, -.2, 28); this.cyl(.06, .06, .5, brass, lo, .1, .25, -.2, 10); this.add(new THREE.PointLight("#ffb48a", 8, 7, 1.7), lo, 0, 2.6, -.4);
    const lamp = (x: number, z: number) => { this.cyl(.03, .05, 1.8, brass, this.scene, x, .9, z, 8); const sh = this.add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, .36, 18, 1, true), this.mat("#ffe0b0", .8, 0, undefined, { emissive: "#ffb870", emissiveIntensity: .9, side: THREE.DoubleSide })), this.scene, x, 1.95, z); sh.castShadow = false; this.glow("#ffd9a0", this.scene, x, 1.95, z, 1.5, .5); };
    lamp(10.8, 3); lamp(6.3, 8.7);
    // ---- Central jackpot sculpture
    const cs = this.station("holdem_center", "Jackpot", "holdem", V(0, 0, 0), V(0, 2, 0), "#ffd36a", ["Eighteen thousand and climbing.", "Somebody's walking out rich tonight.", "Make a wish. Toss a chip."], [3, 3], () => this.jackpotGimmick(), 5.4);
    this.cyl(1.7, 1.9, .3, this.mat("#efe4cc", .3, 0, marble([1, 1])), cs, 0, .15, 0, 48, true); this.cyl(1.2, 1.4, .4, brass, cs, 0, .5, 0, 48, true); this.cyl(.7, 1.0, .5, this.mat("#efe4cc", .3, 0, marble([1, 1])), cs, 0, .95, 0, 32, true);
    const crest = new THREE.Group(); crest.position.y = 2.4; cs.add(crest); this.crest = crest; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, p = this.add(new THREE.Mesh(new THREE.BoxGeometry(.12, .9, .06), brass), crest, Math.cos(a) * .6, 0, Math.sin(a) * .6); p.rotation.y = -a; }
    const orb = this.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 2), this.mat("#ffd36a", .12, 1, undefined, { emissive: "#ffb830", emissiveIntensity: .55 })), crest, 0, 0, 0); orb.castShadow = true; this.glow("#ffd36a", crest, 0, 0, 0, 3.4, .55);
    const centre = this.stations.get("holdem_center")!; this.stations.delete("holdem_center"); this.stations.set("jackpot", { ...centre, id: "jackpot" }); (this.pick[this.pick.length - 1] as THREE.Object3D).userData.station = "jackpot";
    // station nav chips
    const nav = this.hud.nav; for (const id of ["pokies", "blackjack", "roulette", "holdem", "flight", "arcade", "bar", "cashier"] as const) { const s = this.stations.get(id)!, b = el("button", "lb-chip") as HTMLButtonElement; b.type = "button"; b.textContent = s.label; b.style.setProperty("--c", s.color); b.addEventListener("click", () => this.activate(id)); nav.append(b); }
  }

  /* ------------------------------------------------------------ cash cannon: real wallet money */
  private buildCannon() {
    const brass = this.mat("#d4af37", .22, .95), dark = this.mat("#17131c", .4, .5), at = V(-7.4, 0, 8.7), target = V(-3.4, 0, 3.6);
    const g = this.station("cannon", "Cash Cannon", "", at, V(-6.4, 1.6, 7.4), "#7dff9a", ["Load it. Aim it. Make it rain.", "It's only paper. Expensive paper.", "Go on, see how far it goes."], [2.8, 2.8], () => { this.recoil = 1; this.burst("sparkle", this.muzzleWorld(), 40, 2, 4); }, 4.3);
    this.cyl(1.0, 1.2, .35, this.mat("#efe4cc", .3, 0, marble([1, 1])), g, 0, .18, 0, 40, true); this.cyl(.7, .9, .3, brass, g, 0, .5, 0, 32, true);
    const yawG = new THREE.Group(); yawG.position.set(0, 1.45, 0); yawG.rotation.y = Math.atan2(target.x - at.x, target.z - at.z); g.add(yawG);
    for (const s of [-1, 1]) { const w = this.add(new THREE.Mesh(new THREE.TorusGeometry(.5, .09, 10, 28), brass), yawG, s * .62, -.45, -.1); w.rotation.y = Math.PI / 2; this.box(.12, .9, 1.1, dark, yawG, s * .5, -.2, -.1, true); }
    const pit = new THREE.Group(); pit.rotation.x = -.95; yawG.add(pit); this.barrel = pit;
    const tube = this.add(new THREE.Mesh(new THREE.CylinderGeometry(.36, .46, 2.5, 28), brass), pit, 0, 0, .75); tube.rotation.x = Math.PI / 2; tube.castShadow = true;
    for (const z of [-.4, .6, 1.6]) { const r = this.add(new THREE.Mesh(new THREE.TorusGeometry(.43 - (z + .4) * .03, .05, 8, 28), this.mat("#fff2b0", .15, 1)), pit, 0, 0, z); r.scale.setScalar(1); }
    const bell = this.add(new THREE.Mesh(new THREE.CylinderGeometry(.62, .45, .35, 28, 1, true), brass), pit, 0, 0, 2.1); bell.rotation.x = Math.PI / 2; (bell.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    this.add(this.muzzle, pit, 0, 0, 2.35); this.glow("#7dff9a", pit, 0, 0, 2.2, 1.2, .35);
    const hop = this.box(1.2, 1.1, .5, this.mat("#cfe8f5", .05, 0, undefined, { transparent: true, opacity: .35 }), yawG, 0, .6, -1.15); hop.castShadow = false; for (let i = 0; i < 14; i++) { const b = this.box(.5, .05, .24, this.mat("#8fd8a0", .6), yawG, rnd(-.12, .12), .1 + i * .07, -1.15); b.rotation.y = rnd(-.3, .3); }
    this.glow("#7dff9a", g, 0, 3.6, 0, 2.4, .35);
    // all the bills ever thrown share one instanced mesh
    const tex = paint("bill", 256, 112, (c, w, h) => { c.fillStyle = "#f3f6ee"; c.fillRect(0, 0, w, h); c.strokeStyle = "#5a7a62"; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.lineWidth = 2; c.strokeRect(16, 16, w - 32, h - 32); c.fillStyle = "#d6e4d3"; c.beginPath(); c.ellipse(w / 2, h / 2, 40, 34, 0, 0, 7); c.fill(); c.strokeStyle = "#5a7a62"; c.stroke(); c.fillStyle = "#3d5a45"; c.font = "800 46px Georgia,serif"; c.textAlign = "center"; c.fillText("$", w / 2, h / 2 + 16); c.font = "700 18px Georgia,serif"; c.fillText("TESSERA", 66, 36); c.fillText("TESSERA", w - 66, h - 24); });
    this.billMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.17 * BILL_SCALE, BILL_THICK, .075 * BILL_SCALE), new THREE.MeshStandardMaterial({ map: tex, roughness: .7 }), BILL_MAX); this.billMesh.count = 0; this.billMesh.frustumCulled = false; this.billMesh.receiveShadow = true; this.billMesh.setColorAt(0, new THREE.Color("#fff")); this.scene.add(this.billMesh);
    // the controls: pick an amount, fire it from your wallet
    const ui = el("div", "lb-cannon"), head = el("div", "lb-cn-head"), floor = el("small", "", "Thrown: $0"), wallet = el("div", "lb-cn-wallet"), msg = el("p", "lb-cn-msg"), row = el("div", "lb-cn-chips"), fire = el("button", "lb-cn-fire") as HTMLButtonElement; fire.type = "button";
    head.append(el("b", "", "CASH CANNON"), floor); const chips: HTMLButtonElement[] = [];
    for (const v of [10, 100, 1000, 10000, 100000, 0]) { const b = el("button", "lb-cn-chip", v ? "$" + (v >= 1000 ? v / 1000 + "K" : v) : "ALL") as HTMLButtonElement; b.type = "button"; b.dataset.v = String(v); b.addEventListener("click", () => { this.amount = v; this.refreshCannon(); }); chips.push(b); row.append(b); }
    fire.addEventListener("click", () => this.fire(this.amount || Math.floor(this.host.cash()))); ui.append(head, wallet, row, fire, msg); this.el.append(ui); this.cannonUI = { wallet, msg, chips, fire, floor };
    const s = this.stations.get("cannon")!, b = el("button", "lb-chip", s.label) as HTMLButtonElement; b.type = "button"; b.style.setProperty("--c", s.color); b.addEventListener("click", () => this.activate("cannon")); this.hud.nav.append(b); this.refreshCannon();
  }
  private muzzleWorld() { return this.muzzle.getWorldPosition(new THREE.Vector3()); }
  private say(t: string) { this.cannonUI.msg.textContent = t; }
  private refreshCannon() {
    const u = this.cannonUI, cash = Math.floor(this.host.cash()), amt = this.amount || cash;
    u.wallet.textContent = "Wallet  $" + cash.toLocaleString("en-NZ"); u.floor.textContent = "Thrown: $" + this.thrown.toLocaleString("en-NZ");
    for (const c of u.chips) { const v = Number(c.dataset.v); c.classList.toggle("on", v === this.amount); c.disabled = v ? v > cash : cash < 1; }
    u.fire.disabled = amt < 1 || amt > cash; u.fire.textContent = cash < 1 ? "Wallet empty" : amt > cash ? "Not enough cash" : "Fire  $" + amt.toLocaleString("en-NZ");
    if (cash < 1 && !u.msg.textContent) this.say("You're out of money to throw.");
  }
  /** Spend wallet cash and let the bills fly. Count scales with the amount, and so does the heap they leave behind. */
  private fire(amount: number) {
    const cash = Math.floor(this.host.cash()); amount = Math.floor(amount);
    if (amount < 1) { this.say("Nothing to throw."); return; } if (amount > cash) { this.say("That's more than you have."); return; }
    this.host.setCash(cash - amount); this.thrown += amount;
    const n = Math.min(420, Math.max(3, Math.ceil(Math.pow(amount, .62) * .6)));
    this.queue.push({ at: this.time, amount, n, v: amount / n, done: 0 }); this.recoil = 1; this.thump(); this.burst("sparkle", this.muzzleWorld(), 50, 2.2, 5);
    this.say(`$${amount.toLocaleString("en-NZ")} in ${n} bills. ${cash - amount < 1 ? "That was the last of it." : "Nice throw."}`); this.refreshCannon();
  }
  private thump() { try { this.audio ??= new AudioContext(); const a = this.audio, n = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(150, n); o.frequency.exponentialRampToValueAtTime(40, n + .25); g.gain.setValueAtTime(.1, n); g.gain.exponentialRampToValueAtTime(.001, n + .3); o.connect(g).connect(a.destination); o.start(); o.stop(n + .32); } catch { /* sound is optional */ } }
  private cellOf(x: number, z: number) { return Math.max(0, Math.min(GZ - 1, Math.floor(z / CELL + GZ / 2))) * GX + Math.max(0, Math.min(GX - 1, Math.floor(x / CELL + GX / 2))); }
  private spawnBill(job: { amount: number; n: number; v: number }) {
    const idx = this.billNext; this.billNext = (this.billNext + 1) % BILL_MAX; const old = this.bills[idx]; if (old?.alive && !old.flying) this.heights[old.cell] = Math.max(0, this.heights[old.cell] - BILL_THICK * .45);
    const M = this.muzzleWorld(), T = V(-3.4, 0, 3.6), sig = .9 + .12 * Math.log10(Math.max(10, job.amount)), g1 = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
    const P = V(Math.max(-11, Math.min(11, T.x + g1() * sig)), 0, Math.max(-9, Math.min(9.6, T.z + g1() * sig))), vy0 = rnd(5, 8.5), k = 1.5, kv = 5.5;
    let y = M.y, vy = vy0, t = 0, Ih = 0; while (t < 8) { vy += (-9.8 - kv * vy) * (1 / 60); y += vy / 60; Ih += Math.exp(-k * t) / 60; t += 1 / 60; if (y <= .05 && t > .15) break; }
    const dx = P.x - M.x, dz = P.z - M.z, d = Math.hypot(dx, dz) || 1, sp = d / Ih;
    this.bills[idx] = { alive: true, flying: true, x: M.x, y: M.y, z: M.z, vx: dx / d * sp, vy: vy0, vz: dz / d * sp, yaw: rnd(0, 6.28), wob: rnd(.5, 1.1), ph: rnd(0, 6.28), spin: rnd(-4, 4), cell: 0, value: job.v };
    this.billMesh.count = Math.max(this.billMesh.count, idx + 1); this.billMesh.setColorAt(idx, new THREE.Color(job.v < 20 ? "#a9dcae" : job.v < 100 ? "#9bd6dc" : job.v < 1000 ? "#c2aaf0" : job.v < 10000 ? "#f5da78" : "#ff9fd0")); if (this.billMesh.instanceColor) this.billMesh.instanceColor.needsUpdate = true;
  }
  private updateBills(dt: number) {
    for (const j of this.queue) { const want = Math.min(j.n, Math.ceil((this.time - j.at) / (.25 + j.n * .004) * j.n)); while (j.done < want) { this.spawnBill(j); j.done++; } }
    this.queue = this.queue.filter(j => j.done < j.n);
    let dirty = false; const D = this.dummy, kv = 5.5;
    for (let i = 0; i < this.bills.length; i++) {
      const b = this.bills[i]; if (!b || !b.alive || !b.flying) continue; dirty = true;
      b.ph += dt; b.vy += (-9.8 - kv * b.vy) * dt; b.vx *= Math.exp(-1.5 * dt); b.vz *= Math.exp(-1.5 * dt); b.x += (b.vx + Math.sin(b.ph * 3.1) * .5) * dt; b.z += (b.vz + Math.cos(b.ph * 2.7) * .5) * dt; b.y += b.vy * dt; b.yaw += b.spin * dt;
      const c = this.cellOf(b.x, b.z), ground = this.heights[c];
      if (b.y <= ground + BILL_THICK && b.vy < 0) {
        let cell = c; for (let k = 0; k < 5; k++) { const cx = cell % GX, cz = Math.floor(cell / GX), nb = [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]].filter(([x, z]) => x >= 0 && x < GX && z >= 0 && z < GZ).map(([x, z]) => z * GX + x).sort((p, q) => this.heights[p] - this.heights[q])[0]; if (nb !== undefined && this.heights[nb] < this.heights[cell] - .014) { cell = nb; } else break; }
        b.cell = cell; b.x = ((cell % GX) + .5 + rnd(-.4, .4)) * CELL - GX * CELL / 2; b.z = (Math.floor(cell / GX) + .5 + rnd(-.4, .4)) * CELL - GZ * CELL / 2; this.heights[cell] += BILL_THICK * .45; b.y = this.heights[cell] + BILL_THICK * .6; b.flying = false;
        D.position.set(b.x, b.y, b.z); D.rotation.set(rnd(-.05, .05), b.yaw, rnd(-.05, .05)); D.updateMatrix(); this.billMesh.setMatrixAt(i, D.matrix); continue;
      }
      D.position.set(b.x, b.y, b.z); D.rotation.set(Math.sin(b.ph * 7) * b.wob, b.yaw, Math.cos(b.ph * 6) * b.wob); D.updateMatrix(); this.billMesh.setMatrixAt(i, D.matrix);
    }
    if (dirty || this.queue.length) this.billMesh.instanceMatrix.needsUpdate = true;
  }

  /* ------------------------------------------------------------ the people */
  private populate() {
    const all = this.host.people(), player = all.find(c => c.tier === "player"), pool = casinoCompany(all, player ? [player.id] : [], 34); let n = 0;
    const take = (): Character => pool[n++ % Math.max(1, pool.length)] ?? all[n % all.length];
    const spawn = (role: Role, station: string, x: number, z: number, face: number, opt: { seated?: boolean; menu?: readonly Action[]; c?: Character; walk?: THREE.Vector3[]; pause?: Action[]; y?: number } = {}) => {
      const c = opt.c ?? take(); if (!c) return; const fig = buildFigure(c, role, (c.name.split(" ")[0] || "Mosaic"), { seated: opt.seated });
      fig.root.position.set(x, opt.y ?? 0, z); fig.root.rotation.y = face; this.scene.add(fig.root);
      const blob = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ map: spark("rgba(0,0,0,.6)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.set(x, .03, z); this.scene.add(blob);
      const box = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.9, .8), new THREE.MeshBasicMaterial({ visible: false })); box.userData.keep = true; box.position.y = opt.seated ? .75 : .95; box.userData.fig = fig; box.userData.station = station; fig.root.add(box); this.pick.push(box);
      const menu = (opt.menu ?? MENUS[role]).filter(a => !opt.seated || SEATED_OK.includes(a)); const ag: Agent = { fig, station, menu: menu.length ? menu : ["idle"], next: 0, action: menu[0] ?? "idle", hold: rnd(2, 6), face, blob, walker: opt.walk ? { points: opt.walk, i: 0, moving: true, speed: rnd(.9, 1.3), pause: opt.pause ?? MENUS.walker as Action[] } : undefined };
      this.agents.push(ag); return ag;
    };
    // slots: players seated at four of the six machines, one watcher standing behind
    for (const i of [0, 1, 3, 4]) spawn("slot", "pokies", -8.7 + i * 1.0, -7.4, Math.PI, { seated: true });
    spawn("slot", "pokies", -5.2, -6.1, Math.PI * .9, { menu: ["chat", "clap", "cheer", "sip", "phone"] });
    // blackjack
    spawn("dealer", "blackjack", -5.4, -1.0, 0, { menu: ["deal", "deal", "deal", "shuffle", "chat"] }); for (let i = 0; i < 3; i++) { const a = (i + .5) / 3 * Math.PI * .86 + Math.PI * .07; spawn("cards", "blackjack", -5.4 + Math.cos(a) * 2.5, -2.2 + Math.sin(a) * 2.5 + .1, Math.PI + (a - Math.PI / 2) * -1 + Math.PI * 0, { seated: true }); }
    // roulette
    spawn("croupier", "roulette", 4.4, 0.25, Math.PI * 1.5 + .3, { menu: ["spin", "spin", "spin", "point", "chat"] }); for (let i = 0; i < 2; i++) spawn("roulette", "roulette", 5.8 + i * 1.3, 3.05, Math.PI, { seated: true }); spawn("highroller", "roulette", 9.0, 1.6, Math.PI * 1.5, { menu: ["toast", "clap", "cheer", "chat"] });
    // hold'em
    spawn("dealer", "holdem", -1.6, 6.2 - 1.3, 0, { menu: ["shuffle", "deal", "deal", "chat"] }); for (let i = 0; i < 4; i++) { const a = Math.PI * .85 + (i + .5) / 4 * Math.PI * 1.3 + .1; spawn(i % 2 ? "highroller" : "cards", "holdem", -1.6 + Math.cos(a) * 2.35, 6.2 + Math.sin(a) * 1.85, Math.atan2(-Math.cos(a) * 2.35, -Math.sin(a) * 1.85), { seated: true, menu: ["cards", "think", "cheer", "sip", "facepalm"] }); }
    // crash spectators
    spawn("crash", "flight", 8.5, -2.0, Math.PI * 1.5 - .6); spawn("crash", "flight", 8.7, -4.7, Math.PI * 1.5 + .5);
    // bar
    spawn("bartender", "bar", -10.9, 4, Math.PI / 2, { menu: ["shake", "shake", "count", "chat", "point"] }); for (let i = 0; i < 4; i++) spawn("lounge", "bar", -8.35, 1.9 + i * 1.35, -Math.PI / 2, { seated: true, menu: ["sip", "chat", "phone", "toast", "think", "clap"] });
    // physics arcade
    spawn("cards", "arcade", -8.9, -4.4, -Math.PI / 2, { seated: true, menu: ["cards", "cheer", "think", "facepalm"] }); spawn("slot", "arcade", -8.9, -2.4, -Math.PI / 2, { seated: true, menu: ["cards", "cheer", "clap", "sip"] });
    // cashier
    spawn("cashier", "cashier", 9.6, -9.1, 0, { menu: ["count", "count", "chat", "wave", "phone"] }); spawn("walker", "cashier", 9.1, -6.8, Math.PI * 1.1, { menu: ["chat", "wave", "think", "clap"] });
    // lounge
    spawn("lounge", "bar", 8.3, 6.2, Math.PI * 1.6, { seated: true, y: .22, menu: ["chat", "sip", "toast", "clap"] }); spawn("lounge", "bar", 9.4, 6.2, Math.PI * 1.45, { seated: true, y: .22, menu: ["chat", "sip", "phone", "think"] }); spawn("highroller", "bar", 6.3, 7.8, Math.PI * 1.2, { menu: ["toast", "chat", "think", "stretch"] });
    // people on the move: host, security, high roller and friends
    spawn("host", "roulette", 1.8, 9.0, Math.PI, { menu: ["bow", "wave", "point", "bow", "chat"] });
    spawn("security", "cashier", 0, 0, 0, { walk: [V(-8, 0, 8), V(-2, 0, 8.5), V(5, 0, 5.2), V(7, 0, -1), V(2, 0, -5.4), V(-8, 0, -4.8), V(-9, 0, 1)], pause: ["idle", "phone", "point", "think"] });
    spawn("walker", "holdem", 0, 0, 0, { walk: [V(-3, 0, 2.6), V(2.9, 0, 3.1), V(3.8, 0, -3.8), V(-1.5, 0, -5.4), V(-6, 0, 2)], pause: ["chat", "wave", "phone", "dance", "clap", "sip"] });
    spawn("highroller", "blackjack", 0, 0, 0, { walk: [V(6, 0, 7.2), V(1.5, 0, 3.2), V(-3.3, 0, 3.2), V(-7.2, 0, 7.6), V(-1.4, 0, 8.6)], pause: ["toast", "chat", "stretch", "think"] });
    spawn("walker", "pokies", 0, 0, 0, { walk: [V(-3.2, 0, -5.6), V(-0.4, 0, -4.4), V(2.2, 0, -5.2), V(-5, 0, -5.9)], pause: ["chat", "cheer", "phone", "dance"] });
    // a crowd that really moves: loops round the medallion, the front aisle, the back aisle and the bar side
    const ring = (r: number, n: number, a0: number, dir: number) => Array.from({ length: n }, (_, i) => V(Math.cos(a0 + dir * i / n * Math.PI * 2) * r, 0, Math.sin(a0 + dir * i / n * Math.PI * 2) * r));
    const front = [V(-8, 0, 8.6), V(-3, 0, 8.9), V(3, 0, 8.9), V(8.5, 0, 8.4), V(3, 0, 8.1), V(-3, 0, 8.1)], back = [V(-3, 0, -5.9), V(1.5, 0, -5.4), V(6, 0, -5.8), V(7.6, 0, -2.4), V(5.4, 0, -5.6), V(-1, 0, -5.9)], barSide = [V(-6.3, 0, 1.2), V(-6.3, 0, 4), V(-6.3, 0, 7.6), V(-6.3, 0, 4)], right = [V(7.4, 0, -3.8), V(7.2, 0, 3.4), V(8.6, 0, 7.4), V(7.2, 0, 3.4)];
    const pauses: Action[][] = [["chat", "wave", "phone"], ["dance", "clap", "cheer", "toast"], ["think", "sip", "stretch"], ["chat", "point", "wave", "sip"]];
    ([["walker", ring(3.7, 8, 0, 1), 0], ["lounge", ring(3.9, 8, 3.1, -1), 1], ["highroller", ring(3.5, 8, 1.6, 1), 3], ["walker", front, 0], ["slot", front.slice().reverse(), 2], ["lounge", back, 1], ["cards", back.slice().reverse(), 3], ["walker", barSide, 0], ["lounge", right, 2], ["walker", ring(4.1, 8, 4.6, -1), 1], ["highroller", right.slice().reverse(), 3]] as [Role, THREE.Vector3[], number][]).forEach(([role, pts, pi], k) => { const a = spawn(role, "jackpot", pts[0].x, pts[0].z, 0, { walk: pts, pause: pauses[pi] }); if (a?.walker) { a.walker.i = (k * 2) % pts.length; a.walker.speed = rnd(.85, 1.4); } });
    if (player) spawn("player", "jackpot", 1.0, 8.2, Math.PI, { c: player, menu: ["idle", "wave", "idle", "stretch"] });
    const you = this.agents.find(a => a.fig.role === "player"); if (you) { const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .6, 40), new THREE.MeshBasicMaterial({ color: "#f4d777", transparent: true, opacity: .8, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(1, .04, 8.2); this.scene.add(ring); }
  }

  /* ------------------------------------------------------------ particles & gimmicks */
  private burst(kind: "coin" | "confetti" | "sparkle" | "bill", at: THREE.Vector3, n = 80, spread = 4, up = 6) {
    let b = this.bursts.find(x => x.g === (kind === "coin" ? 0 : kind === "bill" ? 2 : 1)); const key = kind === "coin" ? 0 : kind === "bill" ? 2 : 1;
    if (!b) { const N = 500, pos = new Float32Array(N * 3).fill(-50), col = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: key === 0 ? .22 : key === 2 ? .3 : .2, map: spark("#fff"), vertexColors: true, transparent: true, blending: key === 1 ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; this.scene.add(pts); b = { pts, pos, vel: new Float32Array(N * 3), life: new Float32Array(N), col, n: N, next: 0, g: key }; this.bursts.push(b); }
    const pal = kind === "coin" ? [[1, .8, .25], [1, .9, .5]] : kind === "bill" ? [[.5, .9, .6], [.7, 1, .75]] : [[1, .3, .6], [.3, .8, 1], [1, .85, .3], [.6, 1, .5], [.8, .5, 1]];
    for (let i = 0; i < n; i++) { const k = b.next = (b.next + 1) % b.n, a = rnd(0, 6.28), s = rnd(.3, 1) * spread; b.pos.set([at.x, at.y, at.z], k * 3); b.vel.set(kind === "bill" ? [rnd(-1, 1), rnd(-.5, 1), rnd(-1, 1)] : [Math.cos(a) * s, rnd(.4, 1) * up, Math.sin(a) * s], k * 3); b.life[k] = rnd(1.4, 2.6); b.col.set(pal[i % pal.length], k * 3); }
    (b.pts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
  private agentsAt(id: string) { return this.agents.filter(a => a.station === id); }
  private perform(a: Agent, action: Action, secs: number) { a.override = { action, until: this.time + secs }; }
  private slotGimmick() { const st = this.stations.get("pokies")!; const i = [0, 1, 3, 4][Math.floor(rnd(0, 4))]; const sc = this.screens[i]; if (sc) sc.spin = 3.2; this.agentsAt("pokies").forEach((a, k) => this.perform(a, k % 2 ? "cheer" : "fistpump", 3.4)); setTimeout(() => { const p = st.at.clone().add(V(-2.5 + i, 2.3, .6)); this.burst("coin", p, 140, 3.2, 8); this.burst("confetti", p, 60, 3, 6); if (this.screens[i]) this.screens[i].spin = 0; }, 1600); }
  private bjGimmick() { const st = this.stations.get("blackjack")!; this.agentsAt("blackjack").forEach(a => this.perform(a, a.fig.role === "dealer" ? "deal" : "cheer", 3.4)); this.burst("confetti", st.at.clone().add(V(0, 1.6, .5)), 70, 2.8, 5); for (let k = 0; k < 4; k++) setTimeout(() => this.burst("sparkle", st.at.clone().add(V(rnd(-1.5, 1.5), 1.1, rnd(.2, 1.4))), 24, 1.2, 3), k * 300); }
  private rouletteGimmick() { this.wheelSpin = 7; const st = this.stations.get("roulette")!; this.agentsAt("roulette").forEach(a => this.perform(a, a.fig.role === "croupier" ? "spin" : "clap", 4)); setTimeout(() => { this.burst("coin", st.at.clone().add(V(0, 1.4, 1)), 100, 3, 7); this.agentsAt("roulette").forEach(a => this.perform(a, "cheer", 2.4)); }, 3800); }
  private holdemGimmick() { const st = this.stations.get("holdem")!; this.agentsAt("holdem").forEach(a => this.perform(a, a.fig.role === "dealer" ? "shuffle" : "fistpump", 3)); for (let k = 0; k < 3; k++) setTimeout(() => this.burst("confetti", st.at.clone().add(V(rnd(-1, 1), 1.2, rnd(-.6, .6))), 40, 2.4, 5), k * 350); this.burst("coin", st.at.clone().add(V(0, 1.1, 0)), 80, 2.6, 6); }
  private crashGimmick() { const st = this.stations.get("flight")!, g = new THREE.Group(), pink = this.mat("#ee4f9c", .3, .2), white = this.mat("#f4f6fa", .25, .3); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .8, 6, 12), white), nose = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 14), pink); nose.position.y = .72; const fl = new THREE.Mesh(new THREE.ConeGeometry(.16, .7, 10), this.mat("#ffb347", .3, 0, undefined, { emissive: "#ff8a1c", emissiveIntensity: 2 })); fl.position.y = -.85; fl.rotation.x = Math.PI; g.add(body, nose, fl); for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(.04, .4, .3), pink); f.position.set(s * .24, -.4, 0); g.add(f); } g.position.copy(st.at).add(V(0, 3, .4)); g.rotation.z = -.15; this.scene.add(g); this.rocket = { g, t: 0 }; this.agentsAt("flight").forEach(a => this.perform(a, "cheer", 3)); }
  private barGimmick() { const st = this.stations.get("bar")!; this.agentsAt("bar").forEach(a => this.perform(a, a.fig.role === "bartender" ? "shake" : "toast", 3.4)); for (let k = 0; k < 4; k++) setTimeout(() => this.burst("sparkle", st.at.clone().add(V(1.4, 1.6, rnd(-1.4, 1.4))), 40, 1.6, 4), k * 380); }
  private cashierGimmick() { const st = this.stations.get("cashier")!; this.agentsAt("cashier").forEach(a => this.perform(a, a.fig.role === "cashier" ? "count" : "cheer", 3.4)); this.burst("bill", st.at.clone().add(V(0, 4.4, 1)), 120, 2.6, 1); }
  private arcadeGimmick() { const st = this.stations.get("arcade")!; for (let k = 0; k < 4; k++) setTimeout(() => this.burst("coin", st.at.clone().add(V(.7, 1.9, rnd(-1.4, 1.4))), 40, 1.8, 5), k * 260); this.burst("confetti", st.at.clone().add(V(.7, 2.2, 0)), 50, 2.4, 5); this.agentsAt("arcade").forEach(a => this.perform(a, "cheer", 3)); }
  private jackpotGimmick() { const c = V(0, 3, 0); this.burst("coin", c, 220, 4, 9); this.burst("confetti", c, 140, 5, 8); this.agentsAt("jackpot").forEach(a => this.perform(a, "cheer", 3)); }

  /* ------------------------------------------------------------ input and flow */
  private ndc(e: PointerEvent | MouseEvent) { const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  private pickAt(e: PointerEvent | MouseEvent): { station: string; fig?: Fig } | null { this.ndc(e); this.raycaster.setFromCamera(this.ptr, this.camera); const hit = this.raycaster.intersectObjects(this.pick, false)[0]; if (!hit) return null; const u = hit.object.userData; return { station: String(u.station), fig: u.fig as Fig | undefined }; }
  private bindInput(c: HTMLCanvasElement) {
    c.addEventListener("pointerdown", e => { this.down = { x: e.clientX, y: e.clientY }; });
    c.addEventListener("pointermove", e => { const h = this.pickAt(e), tip = this.hud.tip; this.hover = h?.station ?? null; c.style.cursor = h ? "pointer" : "grab"; if (h) { const s = this.stations.get(h.station); tip.textContent = h.fig ? `${h.fig.name} · ${roleLabel(h.fig.role)}` : s?.label ?? ""; tip.style.opacity = "1"; const r = this.el.getBoundingClientRect(); tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`; } else tip.style.opacity = "0"; });
    c.addEventListener("pointerleave", () => { this.hover = null; this.hud.tip.style.opacity = "0"; });
    c.addEventListener("pointerup", e => { if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return; const h = this.pickAt(e); if (h) this.activate(h.station, h.fig); });
    c.addEventListener("keydown", e => { if (e.key === "Enter" && this.armed) this.enter(this.armed.station); });
  }
  /** First click: the gimmick and a closer look. Second click on the same thing: go to the game. */
  private activate(id: string, fig?: Fig) {
    const s = this.stations.get(id); if (!s) return; const key = fig ? "f" + fig.id : "s" + id, now = performance.now();
    if (this.armed && this.armed.key === key && now - this.armed.at < 9000) { this.enter(id, fig); return; }
    this.armed = { key, at: now, station: id, fig }; this.focusOn(fig ? fig.root.position.clone().add(V(0, 1.2, 0)) : s.focus, s);
    s.gimmick(); if (fig) { const ag = this.agents.find(a => a.fig === fig); if (ag && !ag.walker) this.perform(ag, fig.role === "player" ? "wave" : ag.menu.includes("cheer") ? "cheer" : "wave", 2.6); else if (ag) this.perform(ag, "wave", 2.6); }
    const quip = s.quips[Math.floor(Math.random() * s.quips.length)], who = fig ? `${fig.name} · ${roleLabel(fig.role)}` : s.label;
    this.hud.bubble.innerHTML = ""; const t = el("b", "", who), q = el("span", "", `“${quip}”`), go = el("button", "lb-go", `Click again to enter ${s.label} →`) as HTMLButtonElement; go.type = "button"; go.style.setProperty("--c", s.color); go.addEventListener("click", ev => { ev.stopPropagation(); this.enter(id, fig); }); this.hud.bubble.append(t, q, go); this.hud.bubble.classList.add("on");
    this.hud.status.textContent = `${who}: ${quip} Click again to enter ${s.label}.`;
  }
  private enter(id: string, fig?: Fig) {
    const s = this.stations.get(id); if (!s) return; this.armed = null; this.hud.bubble.classList.remove("on");
    if (!s.tab) { this.cannonUI.fire.focus(); this.cannonUI.fire.parentElement?.classList.add("pulse"); setTimeout(() => this.cannonUI.fire.parentElement?.classList.remove("pulse"), 1400); return; }
    if (s.tab === "bar") { this.host.meet(fig && fig.role !== "bartender" ? fig.c.id : undefined); return; }
    this.host.go(s.tab);
  }
  private focusOn(target: THREE.Vector3, s: Station) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize(), to = target.clone().add(dir.multiplyScalar(11 - (s.id === "jackpot" ? 0 : 3.5)));
    to.y = Math.max(5.5, to.y); this.tween = { t: 0, from: this.camera.position.clone(), to, tf: this.controls.target.clone(), tt: target.clone() };
  }

  /* ------------------------------------------------------------ frame */
  private resize() { const w = this.el.clientWidth, h = this.el.clientHeight; if (w < 2 || h < 2) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < .9 ? 56 : 38; this.camera.updateProjectionMatrix(); }
  private frame() {
    requestAnimationFrame(() => this.frame());
    if (!this.el.isConnected || document.hidden || this.el.closest(".hidden")) { this.attached = false; this.clock.getDelta(); return; }
    if (!this.attached) { this.attached = true; this.resize(); }
    const dt = Math.min(this.clock.getDelta(), .05); this.time += dt; const t = this.time;
    if (this.tween) { this.tween.t = Math.min(1, this.tween.t + dt / .9); const k = this.tween.t * this.tween.t * (3 - 2 * this.tween.t); this.camera.position.lerpVectors(this.tween.from, this.tween.to, k); this.controls.target.lerpVectors(this.tf(), this.tween.tt, k); if (this.tween.t >= 1) this.tween = null; }
    this.controls.update();
    for (const a of this.agents) this.stepAgent(a, dt);
    for (const s of this.screens) { if (s.spin > 0) s.spin -= dt; if (++s.n % s.every === 0 || s.spin > 0) s.draw(t, s.spin); }
    if (this.wheel) { this.wheelSpin = Math.max(0, this.wheelSpin - dt); const w = .4 + this.wheelSpin * 2.2; this.wheel.rotation.y += dt * w; if (this.ballPivot) this.ballPivot.rotation.y -= dt * (1.2 + this.wheelSpin * 6); }
    this.updateBills(dt); if (this.barrel) { this.recoil = Math.max(0, this.recoil - dt * 2.5); this.barrel.position.z = -this.recoil * .4; } if (t - this.walletAt > .5) { this.walletAt = t; this.refreshCannon(); }
    if (this.crest) { this.crest.rotation.y += dt * .8; this.crest.position.y = 2.4 + Math.sin(t * 1.4) * .08; } if (this.chandelier) this.chandelier.rotation.y += dt * .08;
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * .1; if (y > 8.5) y = .5; dp.setY(i, y); dp.setX(i, dp.getX(i) + Math.sin(t * .3 + i) * dt * .05); } dp.needsUpdate = true;
    for (const [id, s] of this.stations) { const on = this.hover === id || this.armed?.station === id; (s.ring.material as THREE.MeshBasicMaterial).opacity += ((on ? .75 : 0) - (s.ring.material as THREE.MeshBasicMaterial).opacity) * Math.min(1, dt * 8); if (s.light) s.light.intensity = (on ? 18 : 9) + Math.sin(t * 2 + s.at.x) * 1.5; s.sign.material.opacity = .85 + Math.sin(t * 3 + s.at.z) * .1; }
    for (const b of this.bursts) { for (let i = 0; i < b.n; i++) { if (b.life[i] <= 0) { b.pos[i * 3 + 1] = -50; continue; } b.life[i] -= dt; b.vel[i * 3 + 1] -= (b.g === 2 ? 1.4 : 9) * dt; b.pos[i * 3] += b.vel[i * 3] * dt; b.pos[i * 3 + 1] += b.vel[i * 3 + 1] * dt; b.pos[i * 3 + 2] += b.vel[i * 3 + 2] * dt; if (b.pos[i * 3 + 1] < .05 && b.g !== 2) { b.pos[i * 3 + 1] = .05; b.vel[i * 3 + 1] *= -.35; b.vel[i * 3] *= .7; b.vel[i * 3 + 2] *= .7; } } (b.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; }
    if (this.rocket) { const r = this.rocket; r.t += dt; r.g.position.y += dt * (2 + r.t * 9); r.g.position.x += dt * .5; r.g.rotation.z = -.15 - r.t * .08; this.burst("sparkle", r.g.position.clone().add(V(0, -1.1, 0)), 3, .6, -1); if (r.g.position.y > 16) { this.scene.remove(r.g); this.rocket = null; this.burst("confetti", V(r.g.position.x, 9, r.g.position.z), 90, 5, 3); } }
    if (this.armed) { const age = performance.now() - this.armed.at; if (age > 9000) { this.armed = null; this.hud.bubble.classList.remove("on"); } else this.placeBubble(); }
    this.renderer.render(this.scene, this.camera);
  }
  private tf() { return this.tween ? this.tween.tf : this.controls.target; }
  private placeBubble() { const a = this.armed!, p = (a.fig ? a.fig.root.position.clone().add(V(0, 2.2, 0)) : this.stations.get(a.station)!.at.clone().add(V(0, 4.6, 0))).project(this.camera), r = this.el.getBoundingClientRect(); const x = (p.x * .5 + .5) * r.width, y = (-p.y * .5 + .5) * r.height; this.hud.bubble.style.transform = `translate(${Math.max(130, Math.min(r.width - 130, x))}px,${Math.max(110, Math.min(r.height - 20, y))}px) translate(-50%,-100%)`; }
  private stepAgent(a: Agent, dt: number) {
    const f = a.fig, w = a.walker; let action = a.action, speed = 0;
    if (a.override && a.override.until > this.time) action = a.override.action; else { a.override = undefined; a.hold -= dt; if (a.hold <= 0) { a.next = (a.next + 1 + Math.floor(rnd(0, 3))) % a.menu.length; a.action = a.menu[a.next]; a.hold = rnd(3.5, 8); action = a.action; } else action = a.action; }
    if (w) {
      const target = w.points[w.i];
      if (w.moving) { const to = target.clone().sub(f.root.position); to.y = 0; const d = to.length(); if (d < .15) { w.moving = false; a.hold = rnd(3, 6.5); a.action = w.pause[Math.floor(rnd(0, w.pause.length))]; a.override = undefined; } else { to.normalize(); const want = Math.atan2(to.x, to.z); f.root.rotation.y += Math.atan2(Math.sin(want - f.root.rotation.y), Math.cos(want - f.root.rotation.y)) * Math.min(1, dt * 6); f.root.position.addScaledVector(to, w.speed * dt); action = "walk"; speed = w.speed; } }
      else { action = a.override && a.override.until > this.time ? a.override.action : a.action; a.hold -= dt; if (a.hold <= 0) { w.moving = true; w.i = (w.i + 1) % w.points.length; } }
      a.blob.position.set(f.root.position.x, .03, f.root.position.z);
    }
    if (f.seated && !SEATED_OK.includes(action)) action = "idle";
    poseFigure(f, action, dt, speed);
  }
}

const el = (tag: string, cls = "", text = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const roleLabel = (r: Role) => ({ player: "You", dealer: "Dealer", croupier: "Croupier", bartender: "Bartender", cashier: "Cashier", host: "Host", security: "Security", slot: "Kiwi Gold player", cards: "Card player", roulette: "Roulette player", highroller: "High roller", lounge: "Lounge guest", walker: "Guest", crash: "Sky High spectator" } as Record<Role, string>)[r];
