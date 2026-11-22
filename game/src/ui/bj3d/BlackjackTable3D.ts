/**
 * The Tessera's 3D blackjack table: emerald felt, a padded leather rail, a Mosaic dealer, and real objects.
 * Cards are thrown out of the shoe, land with a hop and slide, and are flipped by hand. Chips are dropped
 * onto the circle, bounce, and stack where they land; the dealer tosses winnings on top and rakes losses away.
 *
 * Motion uses the strip club's constants: gravity 14, a short ballistic flight solved to land on the exact spot,
 * then restitution and friction take over. The table only mirrors the Blackjack engine; it never decides anything.
 * One persistent WebGL view that the casino re-attaches on every render.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Blackjack } from "../../casino/blackjack";
import { isBlackjack, handValue } from "../../casino/blackjack";
import { rankLabel, isRed, type Card } from "../../casino/cards";
import type { Character } from "../../entities/types";
import { buildFigure, poseFigure, type Fig } from "../lobby/LobbyMosaic";
import { wood } from "../lobby/LobbyTextures";
import "./bj3d.css";

const G = 14, U = 0.3, TAU = Math.PI * 2;
const CW = 0.56, CH = 0.8, CT = 0.012, CR = 0.2, CHT = 0.06;
const SHOE = new THREE.Vector3(-3.0, 0.55, -2.15), DISCARD = new THREE.Vector3(3.15, 0.1, -2.2), TRAY = new THREE.Vector3(0, 0.1, -2.6), RAIL = new THREE.Vector3(0, 0.15, 2.4);
const CZ = -2.0, RX = 4.2, RZ = 4.3;
const SPOT_TH = [0.5, 0.33, 0.67, 0.17, 0.83], HAND_SLOT = [0, 1, 2, 3];
const spotPos = (slot: number) => { const t = SPOT_TH[slot] * Math.PI; return new THREE.Vector3(2.9 * Math.cos(t), 0, CZ + 2.95 * Math.sin(t)); };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

/** Chip colours: the casino's own palette, so the table matches the cage and the tray. */
const DENOMS: { v: number; c: string; t: string; e: string }[] = [
  { v: 1_000_000, c: "#7c7671", t: "#fff", e: "#e4e0dd" }, { v: 500_000, c: "#363131", t: "#e4e0dd", e: "#a6a09c" }, { v: 100_000, c: "#c5beb8", t: "#151515", e: "#57524f" },
  { v: 25_000, c: "#595451", t: "#fff", e: "#a7a29e" }, { v: 5_000, c: "#854d52", t: "#fff", e: "#b0aba7" }, { v: 1_000, c: "#948d88", t: "#111", e: "#e4e0dd" },
  { v: 500, c: "#b63943", t: "#f6f4f3", e: "#c74d57" }, { v: 100, c: "#181112", t: "#f6f4f3", e: "#e1ddda" }, { v: 25, c: "#2f7a4a", t: "#f6f4f3", e: "#f6f4f3" },
  { v: 5, c: "#b52d38", t: "#f6f4f3", e: "#f6f4f3" }, { v: 1, c: "#e4e1df", t: "#252020", e: "#a9353f" },
];
const label = (v: number) => (v >= 1e6 ? v / 1e6 + "M" : v >= 1000 ? v / 1000 + "K" : String(v));
function breakdown(amount: number): number[] {
  const out: number[] = []; let r = Math.round(amount * 100) / 100;
  for (const d of DENOMS) while (r >= d.v - 1e-9 && out.length < 40) { out.push(d.v); r -= d.v; }
  if (r >= 0.5 && out.length < 40) out.push(1);
  return out;
}

/* ------------------------------------------------------------------ textures and materials */
const canvas = (w: number, h: number, fn: (g: CanvasRenderingContext2D) => void, srgb = true) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
};
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

const faceCache = new Map<string, THREE.CanvasTexture>();
const SUIT_COL = (c: Card) => (isRed(c) ? "#b3202f" : "#16151a");
function faceTex(c: Card): THREE.CanvasTexture {
  const key = c.rank + c.suit; let t = faceCache.get(key); if (t) return t;
  t = canvas(192, 272, (g) => {
    g.fillStyle = "#f7f1e3"; rr(g, 0, 0, 192, 272, 14); g.fill(); g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 3; g.stroke();
    const col = SUIT_COL(c), r = rankLabel(c.rank); g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 62px Georgia,serif"; g.fillText(r, 36, 46); g.font = "50px serif"; g.fillText(c.suit, 36, 100);
    g.save(); g.translate(192, 272); g.rotate(Math.PI); g.font = "700 62px Georgia,serif"; g.fillText(r, 36, 46); g.font = "50px serif"; g.fillText(c.suit, 36, 100); g.restore();
    if (c.rank >= 11 && c.rank <= 13) { g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(46, 50, 100, 172); g.font = "700 96px Georgia,serif"; g.fillText(r, 96, 132); g.font = "54px serif"; g.fillText(c.suit, 96, 200); }
    else { g.font = (c.rank === 14 ? 150 : 78) + "px serif"; if (c.rank === 14 || c.rank > 10 === false && c.rank > 3) { /* pips below */ } g.fillText(c.suit, 96, 138); if (c.rank !== 14) { g.font = "700 30px Georgia,serif"; g.fillText(r, 96, 196); } }
  });
  faceCache.set(key, t); return t;
}
let backT: THREE.CanvasTexture | null = null;
const backTex = () => backT ??= canvas(192, 272, (g) => {
  g.fillStyle = "#f7f1e3"; rr(g, 0, 0, 192, 272, 14); g.fill(); g.fillStyle = "#7d1a2c"; rr(g, 10, 10, 172, 252, 8); g.fill();
  g.strokeStyle = "#e5c566"; g.lineWidth = 2; for (let y = 0; y < 272; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < 192; x += 24) { g.beginPath(); g.moveTo(x + 12, y); g.lineTo(x + 24, y + 12); g.lineTo(x + 12, y + 24); g.lineTo(x, y + 12); g.closePath(); g.stroke(); }
  g.strokeStyle = "#e5c566"; g.lineWidth = 4; rr(g, 16, 16, 160, 240, 6); g.stroke(); g.fillStyle = "#e5c566"; g.font = "700 40px Georgia,serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("T", 96, 136);
});
const cardEdge = new THREE.MeshStandardMaterial({ color: "#efe7d5", roughness: 0.7 });
const cardMats = new Map<string, THREE.Material[]>();
const cardMat = (c: Card): THREE.Material[] => {
  const k = c.rank + c.suit; let m = cardMats.get(k);
  if (!m) { const top = new THREE.MeshStandardMaterial({ map: faceTex(c), roughness: 0.55 }), bot = new THREE.MeshStandardMaterial({ map: backTex(), roughness: 0.55 }); m = [cardEdge, cardEdge, top, bot, cardEdge, cardEdge]; cardMats.set(k, m); }
  return m;
};

const chipMats = new Map<number, THREE.Material[]>();
function chipMat(v: number): THREE.Material[] {
  let m = chipMats.get(v); if (m) return m;
  const d = DENOMS.find((x) => x.v === v) ?? DENOMS[DENOMS.length - 1];
  const top = canvas(128, 128, (g) => {
    g.fillStyle = d.c; g.fillRect(0, 0, 128, 128); g.strokeStyle = d.e; g.lineWidth = 10; g.setLineDash([16, 12]); g.beginPath(); g.arc(64, 64, 55, 0, TAU); g.stroke(); g.setLineDash([]);
    g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); g.fillStyle = d.t; g.font = "700 " + (label(v).length > 2 ? 26 : 34) + "px Georgia,serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label(v), 64, 66);
  });
  const side = canvas(128, 16, (g) => { g.fillStyle = d.c; g.fillRect(0, 0, 128, 16); g.fillStyle = d.e; for (let i = 0; i < 8; i++) g.fillRect(i * 16 + 3, 0, 8, 16); });
  side.wrapS = THREE.RepeatWrapping;
  const mt = new THREE.MeshStandardMaterial({ map: top, roughness: 0.4, metalness: 0.05 });
  m = [new THREE.MeshStandardMaterial({ map: side, roughness: 0.45 }), mt, mt]; chipMats.set(v, m); return m;
}
const CHIP_GEO = new THREE.CylinderGeometry(CR, CR, CHT, 24), CARD_GEO = new THREE.BoxGeometry(CW, CT, CH);

/* ------------------------------------------------------------------ bodies */
type Phase = "wait" | "fly" | "land" | "rest" | "reveal";
interface Body {
  mesh: THREE.Mesh; kind: "card" | "chip"; phase: Phase; t0: number; T: number; from: THREE.Vector3; to: THREE.Vector3; vel: THREE.Vector3;
  yaw0: number; yaw1: number; flip0: number; flip1: number; tilt: number; hop: number; e: number; slide: number; dispose: boolean; value: number;
  card?: Card; slot?: string; hole?: boolean; stack?: Stack; onLand?: () => void;
}
interface Stack { id: string; x: number; z: number; n: number; reserved: number; amount: number; chips: Body[] }
const topOf = (s: Stack) => 0.006 + s.reserved * CHT;

export class BlackjackTable3D {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  private world = new THREE.Group(); private dealer: Fig | null = null; private hud: HTMLElement;
  private bodies: Body[] = []; private cards = new Map<Card, Body>(); private stacks = new Map<string, Stack>();
  private now = 0; private next = 0; private dealUntil = 0; private settleEnd = 0; private round: unknown = null; private settleRound: unknown = null;
  private want = { phase: "betting", bet: 0, hands: [] as number[] }; private insWant = 0; private tasks: { at: number; fn: () => void }[] = [];
  private az = 0; private el0 = 0.84; private dist = 3.05; private drag: { x: number; y: number } | null = null;
  private labels: { el: HTMLElement; at: THREE.Vector3; on: boolean }[] = [];
  private raf = 0; private prev = 0; private idleSince = 0; private spot = new THREE.SpotLight(0xfff0d8, 70, 14, 0.9, 0.6, 1.2);

  static create(dealer?: Character | null): BlackjackTable3D | null { try { return new BlackjackTable3D(dealer ?? null); } catch { return null; } }

  private constructor(dealer: Character | null) {
    const cv = document.createElement("canvas"); cv.className = "bj3d-canvas"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Blackjack table in 3D. Drag to look around, scroll to zoom.");
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.scene.environmentIntensity = 0.35;
    this.hud = document.createElement("div"); this.hud.className = "bj3d-hud"; this.hud.setAttribute("aria-hidden", "true");
    this.el = document.createElement("div"); this.el.className = "bj3d"; this.el.append(cv, this.hud);
    this.build(dealer); this.bind(cv);
    new ResizeObserver(() => this.resize()).observe(this.el); this.wake();
  }

  /* ---------------------------------------------------------------- scene */
  private build(dealer: Character | null): void {
    const S = this.scene; S.add(this.world); this.world.scale.setScalar(U);
    S.add(new THREE.HemisphereLight(0xffe9d6, 0x1a0c10, 0.55));
    this.spot.position.set(0, 4.2, 1.4); this.spot.target.position.set(0, 0, -0.2); this.spot.castShadow = true; this.spot.shadow.mapSize.set(1024, 1024); this.spot.shadow.bias = -0.0004; this.spot.shadow.radius = 4;
    S.add(this.spot, this.spot.target);
    const warm = new THREE.PointLight(0xff9d70, 6, 6, 1.6); warm.position.set(-2, 1.4, 2.2); S.add(warm);
    // floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: "#2a0f16", roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.95 * U; floor.receiveShadow = true; S.add(floor);
    // outline of the table top, in (x, z)
    const out: THREE.Vector2[] = [new THREE.Vector2(-RX, -2.7), new THREE.Vector2(RX, -2.7), new THREE.Vector2(RX, CZ)];
    for (let i = 1; i < 40; i++) { const a = (i / 40) * Math.PI; out.push(new THREE.Vector2(RX * Math.cos(a), CZ + RZ * Math.sin(a))); }
    out.push(new THREE.Vector2(-RX, CZ));
    const shape = new THREE.Shape(out.map((p) => new THREE.Vector2(p.x, -p.y)));
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.7, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 3, curveSegments: 40 });
    const skirt = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ map: wood([3, 1]), roughness: 0.4, metalness: 0.1 }));
    skirt.rotation.x = -Math.PI / 2; skirt.position.y = -2.95; skirt.receiveShadow = true; this.world.add(skirt);
    // padded leather rail
    const pts = out.map((p) => new THREE.Vector3(p.x, 0.02, p.y)); const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.02);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 280, 0.2, 12, true), new THREE.MeshStandardMaterial({ color: "#251013", roughness: 0.55, metalness: 0.05 }));
    rail.position.y = 0.04; rail.castShadow = true; this.world.add(rail);
    const trim = new THREE.Mesh(new THREE.TubeGeometry(curve, 280, 0.035, 6, true), new THREE.MeshStandardMaterial({ color: "#e5c566", roughness: 0.25, metalness: 0.9 }));
    trim.position.y = 0.2; trim.scale.set(1.03, 1, 1.03); this.world.add(trim);
    // felt
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 5.5), new THREE.MeshStandardMaterial({ map: this.feltTexture(), roughness: 0.95, alphaTest: 0.5 }));
    felt.rotation.x = -Math.PI / 2; felt.position.set(0, 0.002, -0.25); felt.receiveShadow = true; this.world.add(felt);
    // dealer's rack, shoe, discard tray
    const rack = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: "#14090b", roughness: 0.4, metalness: 0.2 })); rack.position.set(0, 0.07, -2.6); rack.receiveShadow = true; this.world.add(rack);
    [500, 100, 100, 25, 25, 25, 5, 5, 1].forEach((v, i) => { for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(CHIP_GEO, chipMat(v)); m.position.set(-1.28 + i * 0.32, 0.16 + k * CHT * 0.9, -2.6); this.world.add(m); } });
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.46, 0.62), new THREE.MeshStandardMaterial({ color: "#1b1115", roughness: 0.3, metalness: 0.5 })); shoe.position.set(SHOE.x, 0.22, SHOE.z); shoe.rotation.y = 0.35; shoe.castShadow = true; this.world.add(shoe);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.7), new THREE.MeshStandardMaterial({ color: "#1b1115", roughness: 0.35, metalness: 0.4 })); tray.position.set(DISCARD.x, 0.09, DISCARD.z); tray.castShadow = true; this.world.add(tray);
    // dealer
    const d = dealer ?? null;
    if (d) { const f = buildFigure(d, "dealer", d.name.split(" ")[0] || "Dealer"); f.root.position.set(0, -2.95 * U, -3.5 * U); f.root.scale.setScalar(0.92); S.add(f.root); this.dealer = f; }
    this.layoutCamera();
  }

  private feltTexture(): THREE.CanvasTexture {
    const W = 2048, H = 1224, K = 222.6, px = (x: number) => (x + 4.6) * K, pz = (z: number) => (z + 3.0) * K;
    return canvas(W, H, (g) => {
      g.clearRect(0, 0, W, H);
      // inside of the outline = felt
      g.save(); g.beginPath(); g.moveTo(px(-RX), pz(-2.7)); g.lineTo(px(RX), pz(-2.7)); g.lineTo(px(RX), pz(CZ));
      for (let i = 1; i <= 40; i++) { const a = (i / 40) * Math.PI; g.lineTo(px(RX * Math.cos(a)), pz(CZ + RZ * Math.sin(a))); } g.lineTo(px(-RX), pz(CZ)); g.closePath(); g.clip();
      const grad = g.createRadialGradient(W / 2, H * 0.55, 80, W / 2, H * 0.55, W * 0.6); grad.addColorStop(0, "#14684a"); grad.addColorStop(1, "#0a3b2a"); g.fillStyle = grad; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26000; i++) { g.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.06)"; g.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4); }
      g.restore();
      // curved print
      const arcText = (text: string, cz: number, R: number, size: number, col: string, spacing = 1) => {
        g.save(); g.fillStyle = col; g.font = `700 ${size * K}px Georgia,serif`; g.textAlign = "center"; g.textBaseline = "alphabetic";
        const widths = [...text].map((ch) => g.measureText(ch).width * spacing), total = widths.reduce((a, b) => a + b, 0) / (R * K); let a = -total / 2;
        [...text].forEach((ch, i) => { const w = widths[i] / (R * K); a += w / 2; g.save(); g.translate(px(0 + R * Math.sin(a)), pz(cz + R * Math.cos(a))); g.rotate(-a); g.fillText(ch, 0, 0); g.restore(); a += w / 2; });
        g.restore();
      };
      arcText("BLACKJACK PAYS 3 TO 2", -4.3, 2.9, 0.24, "#efd486", 1.12);
      arcText("DEALER MUST STAND ON SOFT 17", -4.0, 2.9, 0.15, "#d9cfa5", 1.2);
      arcText("INSURANCE PAYS 2 TO 1", -3.25, 2.6, 0.15, "#f0b3b3", 1.35);
      g.strokeStyle = "rgba(240,179,179,.7)"; g.lineWidth = 3;
      for (const [cz, R] of [[-3.25, 2.4], [-3.25, 2.2]]) { g.beginPath(); for (let i = -60; i <= 60; i++) { const a = (i / 60) * 0.95; const x = px(R * Math.sin(a)), y = pz(cz + R * Math.cos(a)); i === -60 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
      // betting circles
      g.strokeStyle = "#e5c566"; g.lineWidth = 5; g.fillStyle = "rgba(229,197,102,.12)";
      for (let s = 0; s < SPOT_TH.length; s++) { const p = spotPos(s); g.beginPath(); g.arc(px(p.x), pz(p.z), 0.42 * K, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(px(p.x), pz(p.z), 0.34 * K, 0, TAU); g.lineWidth = 2; g.stroke(); g.lineWidth = 5; }
      g.fillStyle = "rgba(229,197,102,.7)"; g.font = `600 ${0.13 * K}px Georgia,serif`; g.textAlign = "center"; g.fillText("THE TESSERA", px(0), pz(2.08));
    });
  }

  /* ---------------------------------------------------------------- camera and input */
  private layoutCamera(): void {
    const t = new THREE.Vector3(0, 0.38, -0.25), d = this.dist, c = this.camera;
    c.position.set(t.x + Math.sin(this.az) * Math.cos(this.el0) * d, t.y + Math.sin(this.el0) * d, t.z + Math.cos(this.az) * Math.cos(this.el0) * d); c.lookAt(t);
    this.spot.target.position.set(0, 0, -0.1);
  }
  private bind(cv: HTMLCanvasElement): void {
    cv.addEventListener("pointerdown", (e) => { this.drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => { if (!this.drag) return; this.az = clamp(this.az - (e.clientX - this.drag.x) * 0.006, -0.9, 0.9); this.el0 = clamp(this.el0 + (e.clientY - this.drag.y) * 0.004, 0.35, 1.25); this.drag = { x: e.clientX, y: e.clientY }; this.layoutCamera(); });
    const up = () => { this.drag = null; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); this.dist = clamp(this.dist * (e.deltaY > 0 ? 1.08 : 0.92), 2.4, 6.2); this.layoutCamera(); }, { passive: false });
  }
  private resize(): void {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 1.2 ? 52 : 38; this.camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- game sync */
  private schedule(dur: number, gap = 0): number { const t = Math.max(this.now, this.next); this.next = t + dur + gap; return t; }

  private slotOf(hand: number, j: number): THREE.Vector3 {
    const p = spotPos(HAND_SLOT[Math.min(hand, 3)]); return new THREE.Vector3(p.x - 0.15 + j * 0.24, 0.012 + j * 0.003, p.z - 0.95 - j * 0.02);
  }
  private dealerSlot(j: number): THREE.Vector3 { return new THREE.Vector3(-0.32 + j * 0.62, 0.012, -1.95); }

  private makeCard(c: Card): Body {
    const mesh = new THREE.Mesh(CARD_GEO, cardMat(c)); mesh.castShadow = mesh.receiveShadow = true; mesh.rotation.order = "YXZ"; mesh.visible = false; this.world.add(mesh);
    const b: Body = { mesh, kind: "card", phase: "wait", t0: 0, T: 0.42, from: new THREE.Vector3(), to: new THREE.Vector3(), vel: new THREE.Vector3(), yaw0: 0, yaw1: 0, flip0: Math.PI, flip1: 0, tilt: 0, hop: 0, e: 0.22, slide: 0.1, dispose: false, value: 0, card: c };
    this.bodies.push(b); this.cards.set(c, b); return b;
  }
  private throwTo(b: Body, to: THREE.Vector3, at: number, T: number, o: { from?: THREE.Vector3; yaw?: number; flip?: number } = {}): void {
    b.from.copy(o.from ?? (b.phase === "wait" ? (b.kind === "card" ? SHOE : TRAY) : b.mesh.position)); b.to.copy(to); b.t0 = at; b.T = T; b.phase = "wait";
    b.yaw0 = b.mesh.rotation.y; b.yaw1 = o.yaw ?? rnd(-0.09, 0.09); b.flip0 = b.mesh.rotation.z; b.flip1 = o.flip ?? b.flip1; b.tilt = 0.5;
  }

  sync(bj: Blackjack, bet: number): void {
    const hands = bj.hands, first = hands[0] ?? null;
    if (first !== this.round) { this.clearRound(); this.round = first; this.settleRound = null; }
    this.want = { phase: bj.phase, bet, hands: hands.map((h) => h.bet) }; if (bj.insurance > 0) this.insWant = bj.insurance; else if (bj.phase !== "settled") this.insWant = 0;
    // cards: deal what is new, re-slot what moved
    const fresh: { c: Card; slot: string; at: THREE.Vector3; hole?: boolean; player: boolean }[] = [];
    hands.forEach((h, hi) => h.cards.forEach((c, j) => { const slot = `p${hi}.${j}`, ex = this.cards.get(c); if (!ex) fresh.push({ c, slot, at: this.slotOf(hi, j), player: true }); else if (ex.slot !== slot) { ex.slot = slot; this.throwTo(ex, this.slotOf(hi, j), this.schedule(0.35), 0.35, { from: ex.mesh.position, flip: ex.hole ? Math.PI : 0 }); ex.phase = "wait"; } }));
    const dFresh: typeof fresh = []; bj.dealer.forEach((c, j) => { if (!this.cards.has(c)) dFresh.push({ c, slot: `d.${j}`, at: this.dealerSlot(j), hole: j === 1, player: false }); });
    const order = fresh.length === 2 && dFresh.length === 2 ? [fresh[0], dFresh[0], fresh[1], dFresh[1]] : [...fresh, ...dFresh];
    // the hole card flips before the dealer draws any more
    const hole = bj.dealer[1] ? this.cards.get(bj.dealer[1]) : undefined;
    const reveal = bj.holeRevealed && hole && hole.hole && hole.phase !== "reveal";
    const dealOrder = reveal ? order.filter((o) => o.player || o.c === bj.dealer[1]) : order, later = reveal ? order.filter((o) => !dealOrder.includes(o)) : [];
    const deal = (o: typeof fresh[number]) => { const b = this.makeCard(o.c); b.slot = o.slot; b.hole = !!o.hole; const at = this.schedule(0.26); this.throwTo(b, o.at, at, 0.42, { from: SHOE, flip: o.hole ? Math.PI : 0 }); b.flip0 = Math.PI; this.dealUntil = Math.max(this.dealUntil, at + 0.6); };
    dealOrder.forEach(deal);
    if (reveal) { const h = this.cards.get(bj.dealer[1])!; const at = this.schedule(0.55, 0.15); h.t0 = at; h.T = 0.55; h.phase = "reveal"; h.hole = false; h.from.copy(h.to); }
    later.forEach(deal);
    this.setLabels(bj);
    if (bj.phase === "settled" && this.settleRound !== this.round) { this.settleRound = this.round; this.runSettle(bj); }
    this.wake();
  }

  /** One clean label per hand and one for the dealer, placed just in front of the cards so nothing sits on top of anything. */
  private setLabels(bj: Blackjack): void {
    const txt = (cards: Card[], natural: boolean) => { const v = handValue(cards); return natural && isBlackjack(cards) ? "Blackjack" : v.total > 21 ? "Bust " + v.total : (v.soft && v.total < 21 ? "Soft " : "") + v.total; };
    const want: { t: string; at: THREE.Vector3; cls: string }[] = [];
    if (bj.dealer.length) { const up = bj.dealer[0]; want.push({ t: "Dealer " + (bj.holeRevealed ? txt(bj.dealer, true) : "shows " + (up.rank === 14 ? "A" : handValue([up]).total)), at: new THREE.Vector3(0, 0.02, -1.38), cls: "" }); }
    bj.hands.forEach((h, i) => { if (!h.cards.length) return; const p = spotPos(HAND_SLOT[Math.min(i, 3)]), res = bj.phase === "settled" && h.result ? " · " + h.result.toUpperCase() : ""; want.push({ t: txt(h.cards, !h.fromSplit) + res, at: new THREE.Vector3(p.x, 0.02, p.z - 0.42), cls: bj.phase === "player" && i === bj.active ? "on" : h.result === "win" || h.result === "blackjack" ? "win" : h.result === "lose" ? "lose" : "" }); });
    while (this.labels.length < want.length) { const el = document.createElement("span"); el.className = "bj3d-tag"; this.hud.append(el); this.labels.push({ el, at: new THREE.Vector3(), on: false }); }
    this.labels.forEach((l, i) => { const w = want[i]; l.on = !!w; l.el.hidden = !w; if (w) { l.el.textContent = w.t; l.el.className = "bj3d-tag" + (w.cls ? " " + w.cls : ""); l.at.copy(w.at).multiplyScalar(U); } });
  }
  private placeLabels(): void {
    const W = this.el.clientWidth, H = this.el.clientHeight, v = new THREE.Vector3(), boxes: [number, number, number, number][] = [];
    for (const l of this.labels) {
      if (!l.on) continue; v.copy(l.at).project(this.camera); let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const w = l.el.offsetWidth || 80, h = l.el.offsetHeight || 22; x = clamp(x, w / 2 + 6, W - w / 2 - 6); y = clamp(y, h / 2 + 6, H - h / 2 - 6);
      // nudge down until it clears every label already placed
      for (let k = 0; k < 6 && boxes.some(([bx, by, bw, bh]) => Math.abs(bx - x) < (bw + w) / 2 + 4 && Math.abs(by - y) < (bh + h) / 2 + 2); k++) y += h + 4;
      boxes.push([x, y, w, h]); l.el.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - h / 2)}px)`;
    }
  }

  private stack(id: string, x: number, z: number): Stack { let s = this.stacks.get(id); if (!s) this.stacks.set(id, s = { id, x, z, n: 0, reserved: 0, amount: 0, chips: [] }); return s; }
  private betStack(i: number): Stack { const p = spotPos(HAND_SLOT[i]); return this.stack("b" + i, p.x, p.z); }
  private winStack(i: number): Stack { const p = spotPos(HAND_SLOT[i]); return this.stack("w" + i, p.x + 0.46, p.z + 0.06); }

  /** Drop real chips onto a stack, one after another. Returns the time the last chip leaves the hand. */
  private drop(s: Stack, amount: number, from: THREE.Vector3, at = this.now): number {
    let t = Math.max(at, this.now);
    for (const v of breakdown(amount)) {
      const m = new THREE.Mesh(CHIP_GEO, chipMat(v)); m.castShadow = m.receiveShadow = true; m.visible = false; m.position.copy(from); this.world.add(m);
      const b: Body = { mesh: m, kind: "chip", phase: "wait", t0: t, T: 0.34, from: from.clone(), to: new THREE.Vector3(), vel: new THREE.Vector3(), yaw0: 0, yaw1: 0, flip0: 0, flip1: 0, tilt: 0.5, hop: 0, e: 0.32, slide: 0.05, dispose: false, value: v, stack: s };
      b.to.set(s.x + rnd(-0.012, 0.012), topOf(s) + CHT / 2, s.z + rnd(-0.012, 0.012)); s.reserved++; s.amount += v; s.chips.push(b); this.bodies.push(b); t += 0.07;
    }
    return t;
  }
  /** Send a share of a stack's chips away (to the rail or the dealer's tray). Chips fly from wherever they are now. */
  private sweep(s: Stack, to: THREE.Vector3, share = 1): number {
    const n = Math.ceil(s.chips.length * share), go = s.chips.splice(0, n); let t = this.now + 0.02;
    for (const b of go) { b.from.copy(b.mesh.position); b.to.copy(to).add(new THREE.Vector3(rnd(-0.3, 0.3), 0, rnd(-0.1, 0.1))); b.t0 = t; t += 0.035; b.T = 0.4 + rnd(0, 0.1); b.phase = "wait"; b.dispose = true; b.tilt = 0.8; b.flip0 = b.flip1 = 0; s.amount -= b.value; }
    s.reserved = s.chips.length; s.n = s.chips.length; if (!s.chips.length) s.amount = 0; return t;
  }
  private later(at: number, fn: () => void): void { this.tasks.push({ at, fn }); }

  private runSettle(bj: Blackjack): void {
    const hands = bj.hands, dealerBJ = isBlackjack(bj.dealer);
    let t = Math.max(this.now, this.next) + 0.9; // let the last card land and the hole card turn
    hands.forEach((h, i) => {
      const b = this.betStack(i), w = this.winStack(i);
      if (Math.abs(b.amount - h.bet) > 0.01) { this.later(t - 0.05, () => { this.sweep(b, RAIL); this.drop(b, h.bet, RAIL); }); }
      if (h.result === "win" || h.result === "blackjack") {
        const win = (h.payout ?? 0) - h.bet; this.later(t, () => { this.drop(w, win, TRAY); }); t += 0.7 + breakdown(win).length * 0.07 + 0.5;
        this.later(t, () => { this.sweep(b, RAIL); this.sweep(w, RAIL); }); t += 0.5;
      } else if (h.result === "push") { t += 0.4; this.later(t, () => { this.sweep(b, RAIL); }); t += 0.4; }
      else if (h.result === "surrender") { t += 0.3; this.later(t, () => { this.sweep(b, RAIL, 0.5); this.sweep(b, TRAY); }); t += 0.4; }
      else { t += 0.4; this.later(t, () => { this.sweep(b, TRAY); }); t += 0.4; }
    });
    const ins = this.stacks.get("ins");
    if (ins && ins.amount > 0) { const amt = ins.amount; if (dealerBJ) { const w = this.stack("insw", ins.x + 0.4, ins.z); this.later(t, () => { this.drop(w, amt * 2, TRAY); }); t += 1.2; this.later(t, () => { this.sweep(ins, RAIL); this.sweep(w, RAIL); }); t += 0.6; } else { this.later(t, () => { this.sweep(ins, TRAY); }); t += 0.5; } }
    this.settleEnd = t + 0.2;
  }

  /** Per-frame: keep the bet circles in step with the wallet and the engine. */
  private reconcile(): void {
    const w = this.want;
    if (w.phase === "settled" && this.now < this.settleEnd) return;
    for (let i = 0; i < 4; i++) {
      const s = this.betStack(i);
      const target = w.phase === "player" || w.phase === "insurance" || w.phase === "dealer" ? w.hands[i] ?? 0 : i === 0 ? w.bet : 0;
      if (Math.abs(s.amount - target) < 0.01) continue;
      if (target > s.amount && s.amount > 0) this.drop(s, target - s.amount, RAIL);
      else { if (s.amount > 0) this.sweep(s, RAIL); if (target > 0) this.drop(s, target, RAIL); }
    }
    const ins = this.stack("ins", 0, -0.55);
    if ((w.phase === "player" || w.phase === "insurance") && this.insWant > ins.amount + 0.01) this.drop(ins, this.insWant - ins.amount, RAIL);
  }

  /** New round: clear the old cards into the discard tray and any leftover chips back to the rail. */
  private clearRound(): void {
    let at = Math.max(this.now, this.next);
    for (const [, b] of this.cards) { b.from.copy(b.mesh.position); b.to.copy(DISCARD).add(new THREE.Vector3(rnd(-0.1, 0.1), 0, rnd(-0.1, 0.1))); b.t0 = at; at += 0.04; b.T = 0.5; b.phase = "wait"; b.dispose = true; b.flip1 = Math.PI; b.yaw1 = rnd(-0.3, 0.3); b.tilt = 0.4; }
    this.cards.clear(); this.next = Math.max(this.next, at);
    for (const [, s] of this.stacks) if (s.id !== "b0" && s.id !== "b1" && s.id !== "b2" && s.id !== "b3") this.sweep(s, RAIL); this.insWant = 0;
  }

  /* ---------------------------------------------------------------- animation */
  wake(): void { if (!this.raf) { this.prev = 0; this.raf = requestAnimationFrame((t) => this.frame(t)); } this.idleSince = 0; }

  private step(b: Body, dt: number): void {
    const m = b.mesh;
    if (b.phase === "wait") { if (this.now < b.t0) return; b.phase = "fly"; m.visible = true; b.from.copy(m.position); b.hop = 0; }
    if (b.phase === "fly") {
      const s = clamp((this.now - b.t0) / b.T, 0, 1), vy = (b.to.y - b.from.y) / b.T + 0.5 * G * b.T;
      m.position.x = b.from.x + (b.to.x - b.from.x) * s; m.position.z = b.from.z + (b.to.z - b.from.z) * s;
      const t = s * b.T; m.position.y = b.from.y + vy * t - 0.5 * G * t * t;
      m.rotation.y = b.yaw0 + (b.yaw1 - b.yaw0) * smooth(s); m.rotation.z = b.flip0 + (b.flip1 - b.flip0) * smooth(s); m.rotation.x = Math.sin(s * Math.PI) * b.tilt * (b.kind === "card" ? 0.6 : 1.1);
      if (s >= 1) { m.position.copy(b.to); b.vel.set((b.to.x - b.from.x) / b.T * b.slide, vy - G * b.T, (b.to.z - b.from.z) / b.T * b.slide); b.phase = "land"; b.tilt = (Math.random() - 0.5) * 0.12; }
      return;
    }
    if (b.phase === "land") {
      b.vel.y -= G * dt; m.position.addScaledVector(b.vel, dt); const f = b.to.y;
      if (m.position.y <= f) { m.position.y = f; if (Math.abs(b.vel.y) > 0.9) { b.vel.y = -b.vel.y * b.e; b.vel.x *= 0.6; b.vel.z *= 0.6; } else { b.phase = "rest"; b.vel.set(0, 0, 0); b.onLand?.(); } }
      const k = Math.exp(-6 * dt); b.vel.x *= k; b.vel.z *= k; b.tilt *= Math.exp(-9 * dt); m.rotation.x = b.tilt; m.rotation.z = m.rotation.z + (b.flip1 - m.rotation.z) * Math.min(1, dt * 18); m.rotation.y = b.yaw1;
      return;
    }
    if (b.phase === "reveal") {
      const s = clamp((this.now - b.t0) / b.T, 0, 1); m.position.copy(b.to); m.position.y = b.to.y + Math.sin(s * Math.PI) * 0.45; m.rotation.z = Math.PI * (1 - smooth(s)); m.rotation.x = Math.sin(s * Math.PI) * 0.35;
      if (s >= 1) { m.position.y = b.to.y; m.rotation.z = 0; m.rotation.x = 0; b.phase = "rest"; b.flip1 = 0; }
    }
  }

  private frame(t: number): void {
    const dt = clamp(this.prev ? (t - this.prev) / 1000 : 0.016, 0, 0.05); this.prev = t; this.now += dt;
    if (!this.el.isConnected) { if (!this.idleSince) this.idleSince = t; if (t - this.idleSince > 1500) { this.raf = 0; return; } }
    this.reconcile();
    for (let i = this.tasks.length - 1; i >= 0; i--) if (this.now >= this.tasks[i].at) this.tasks.splice(i, 1)[0].fn();
    for (const b of this.bodies) this.step(b, dt);
    // finished sweeps leave the table
    for (let i = this.bodies.length - 1; i >= 0; i--) { const b = this.bodies[i]; if (b.dispose && b.phase === "rest") { this.world.remove(b.mesh); this.bodies.splice(i, 1); } }
    if (this.dealer) poseFigure(this.dealer, this.now < this.dealUntil ? "deal" : "idle", dt);
    if (this.el.isConnected) { this.renderer.render(this.scene, this.camera); this.placeLabels(); }
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }
}
