/**
 * The Pink Pukeko in 3D (ported from the Velvet Lounge sandbox). Mosaics are the people: dancers, crowd, staff and the
 * Famiglia in the VIP booth. This view draws and reacts; Club.ts keeps every rule (cash, tips, affection, strikes).
 *
 * Consequences, not decoration: the club's live effects change the room and the room pushes back.
 *  - Cash is a real object (gravity and air drag from the game's PhysicsWorld). It lands, lies about, gets tipped over, soaked,
 *    stolen by the raccoon and the chicken, and swept by a staff Mosaic, whose haul goes to the till.
 *  - Flame jets and fireworks build heat. Scorch marks stay. Too much heat sets off the sprinklers: the crowd runs for the
 *    door, the cash is soaked, the floor stays slick.
 *  - Lightning can blow a spotlight. Blackouts make the crowd cower. The ghost spooks everyone it floats past.
 *  - The raccoon knocks over bar stools, the flamingo parts the crowd, Doris the chicken pecks tips off the stage.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Character } from "../../entities/types";
import { GRAVITY, gravityScale } from "../../physics/PhysicsWorld";
import { aggregate, PROPS, type Owned, type Shoot } from "./ClubProps";
import { createCarryGun, type CarryHooks } from "./CarryGun";
import { applyDance, autoMove, DANCES } from "./Dances";
import { buildMosaic, applyOutfit, applyRoutine, resetPose, paintBillboard, OUTFITS, ROUTINES, type Mosaic, type Routine, type Role, type DrawFn } from "./Mosaic3D";

export { ROUTINES, OUTFITS, DANCES };
export type { Routine };

const W = 960, H = 500, STAGE_Y = 0.65, TRUSS_Y = 6.2, TAU = Math.PI * 2;
const EXIT = new THREE.Vector3(10.6, 0, 7.4);
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export interface FxView { strobe: number; blackout: number; wash: number; lasers: number; disco: number; spot: number; spotX: number; uv: number; kaleido: number; fog: number; bolt: number; boltX: number; shake: number; slowmo: number; flash: number; flames: number }
export interface Frame { t: number; dt: number; reduce: boolean; hype: number; fx: FxView; crowd: string; showing: boolean; showT: number; showIndex: number; catwalkU: number; big: boolean; smoke: boolean; djPro: boolean; dancers: { name: string; hit: number; boost: string }[] }
export interface Roster { name: string; pole: boolean; needsStage: boolean }
export interface Club3DOptions { draw: DrawFn; cast: readonly Character[]; roster: Roster[]; accent: string; news(spec: string): void; swept(v: number): void }
export interface EmitOpts { vx?: number; vy?: number; sx?: number; sy?: number; life?: number; cols?: readonly string[]; sz?: number }
export interface Pt { x: number; y: number }
export type SpotId = "dj" | "vip" | "bar" | "bouncer";
export interface Club3D {
  el: HTMLCanvasElement; frame(f: Frame): void; project(name: string): Pt | null; anchor(who: string): Pt | null;
  spotRects(): { id: SpotId; x: number; y: number; w: number; h: number }[]; land(x: number, y: number, v: number, col: string): void;
  setTheme(name: string, accent: string, beams: string[], sky: [string, string], floor: string): void;
  setProps(o: Owned): void;
  setStyle(name: string, routine?: Routine, outfit?: string): void; getStyle(name: string): { routine: Routine; outfit: string };
  /** Clothed comic booth scene: the camera moves to the VIP booth and a Mosaic sways beside the seat. */
  booth(on: boolean, name?: string, kind?: string): void;
  setDance(name: string, idx: number): void; getDance(name: string): number;
  setView(preset: string): void; sink: { take(k: string, x: number, y: number, n: number, o: EmitOpts): boolean; creature(k: string, secs: number): boolean; note(k: string, n: number): void };
  /** Carry the money gun yourself: walk the floor, aim at the dancers, hold to fire. */
  carry(on: boolean, hooks?: CarryHooks): void; aim(nx: number, ny: number): void; trigger(on: boolean): void; carrying(): boolean; aimingAt(): string;
  litter(): number; dispose(): void;
}

// ---- cash and paper: the engine's gravity and quadratic air drag, with each material's own mass, radius, bounce and grip
const AIR_DRAG = 0.05;
interface Mat { mass: number; radius: number; rest: number; fric: number; lift: number }
const MATS: Record<string, Mat> = { bill: { mass: 0.03, radius: 0.12, rest: 0.05, fric: 3, lift: 0.9 }, coin: { mass: 0.2, radius: 0.03, rest: 0.4, fric: 1.2, lift: 0 }, conf: { mass: 0.01, radius: 0.05, rest: 0.02, fric: 4, lift: 0.92 }, feather: { mass: 0.005, radius: 0.08, rest: 0, fric: 4, lift: 0.96 } };
interface Bit { k: "bill" | "coin" | "conf" | "feather"; x: number; y: number; z: number; vx: number; vy: number; vz: number; ry: number; spin: number; ph: number; c: THREE.Color; v: number; age: number; life: number; landed: boolean; wet: boolean; s: number }
interface Pool { mesh: THREE.InstancedMesh; items: Bit[]; max: number }

function surfaceY(x: number, z: number): number {
  if (x > -4.8 && x < 4.8 && z > -3.4 && z < 1.0) return STAGE_Y;
  if (x > -1.6 && x < 1.6 && z >= 1.0 && z < 4.0) return STAGE_Y;
  if (Math.hypot(x, z - 4.0) < 1.6) return STAGE_Y;
  return 0;
}

// ---- procedural textures (carpet, marble, velvet, brick, neon)
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!]; }
function tex(c: HTMLCanvasElement, rx: number, ry: number, srgb = true): THREE.CanvasTexture { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function carpetTex(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256); g.fillStyle = "#280710"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() > 0.5 ? "rgba(80,15,30,.35)" : "rgba(15,2,6,.35)"; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = "rgba(186,142,62,.45)"; g.lineWidth = 2;
  for (let y = 0; y <= 256; y += 64) for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, y - 32); g.lineTo(x + 32, y); g.lineTo(x, y + 32); g.lineTo(x - 32, y); g.closePath(); g.stroke(); g.fillStyle = "rgba(120,18,42,.55)"; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
  return tex(c, 9, 9);
}
function marbleTex(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, "#0a0a0f"); gr.addColorStop(0.5, "#14111a"); gr.addColorStop(1, "#08080c"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let v = 0; v < 18; v++) { let x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * TAU; g.strokeStyle = v % 3 === 0 ? "rgba(218,175,85,.32)" : "rgba(180,185,205,.16)"; g.lineWidth = 0.6 + Math.random() * 1.6; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 12; s++) { a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * 20; y += Math.sin(a) * 20; g.lineTo(x, y); } g.stroke(); }
  return tex(c, 3, 2);
}
function velvetTex(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128); g.fillStyle = "#5a0c24"; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) { const r = g.createRadialGradient(x + 16, y + 16, 2, x + 16, y + 16, 20); r.addColorStop(0, "#851638"); r.addColorStop(1, "#3b0616"); g.fillStyle = r; g.fillRect(x, y, 32, 32); }
  g.strokeStyle = "rgba(20,2,8,.7)"; g.lineWidth = 2; for (let i = -128; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke(); }
  return tex(c, 4, 2);
}
function brickTex(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256); g.fillStyle = "#0c0b10"; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) for (let k = -1; k <= 8; k++) { const s = 70 + Math.floor(Math.random() * 40); g.fillStyle = `rgb(${s},${s - 6},${s + 12})`; g.fillRect(k * 32 + (r % 2) * 16 + 2, r * 16 + 2, 28, 12); }
  return tex(c, 6, 2.5);
}
function neonTex(text: string, hex: string): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256); g.fillStyle = "rgba(10,6,14,.55)"; g.strokeStyle = hex; g.lineWidth = 6; g.shadowColor = hex; g.shadowBlur = 24; g.beginPath(); g.roundRect(24, 24, 976, 208, 28); g.fill(); g.stroke();
  let size = 120; g.font = `bold ${size}px 'Big Shoulders Display', Impact, sans-serif`; while (g.measureText(text).width > 900 && size > 30) { size -= 6; g.font = `bold ${size}px 'Big Shoulders Display', Impact, sans-serif`; }
  g.textAlign = "center"; g.textBaseline = "middle"; g.shadowBlur = 40; g.fillStyle = hex; g.fillText(text, 512, 134); g.shadowBlur = 10; g.fillStyle = "#fff"; g.fillText(text, 512, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

interface Dancer { recoil: number; rdx: number; rdz: number; dance: number; m: Mosaic; slot: THREE.Vector3; pole: boolean; routine: Routine; outfit: string; needsStage: boolean; pos: THREE.Vector3; hop: number; scoop: number }
interface Npc { st: string; m: Mosaic; base: THREE.Vector3; pos: THREE.Vector3; ph: number; fall: number; face: number; i: number }
interface Critter { k: string; g: THREE.Group; until: number; dir: number; x: number; z: number; age: number; take: number }
interface Stool { g: THREE.Group; tilt: number; until: number }

export async function mountClub3D(o: Club3DOptions): Promise<Club3D> {
  const reduceMq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const el = renderer.domElement; el.className = "cl-gl";
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b050a); scene.fog = new THREE.FogExp2(0x0b050a, 0.04);
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35; pm.dispose(); }
  const composer = new EffectComposer(renderer); let bloom: UnrealBloomPass | null = null;
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 60);
  const VIEWS: Record<string, [number[], number[]]> = { free: [[0, 3.8, 11.6], [0, 1.5, 0.6]], stage: [[0, 2.3, 7.2], [0, 1.7, 0.4]], pole: [[1.9, 2.0, 3.6], [0, 1.6, 1.0]], vip: [[6.8, 2.2, 5.6], [8.6, 1.2, -0.6]], dj: [[-3.6, 3.6, -3.4], [0, 1.8, -7.8]], cine: [[7, 3.2, 8], [0, 1.6, 0.6]] };
  camera.position.set(...(VIEWS.free[0] as [number, number, number]));
  const controls = new OrbitControls(camera, el); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 1.5; controls.maxDistance = 17;
  controls.target.set(...(VIEWS.free[1] as [number, number, number])); controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE }; controls.enablePan = false;
  let tween: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; k: number } | null = null, cine = false;
  // booth scene state: who is dancing, what kind, and where the camera was before it moved in
  let popT = 0, cellarFlash: THREE.PointLight | null = null; let boothOn = false, boothKind = "lap", boothM: Mosaic | null = null, boothT = 0; const boothCache = new Map<string, Mosaic>(); let boothPrev: { p: THREE.Vector3; t: THREE.Vector3; cine: boolean } | null = null;

  // ------------------------------------------------------------------ materials and the room
  const accentC = new THREE.Color(o.accent);
  const carpet = new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 0.92, metalness: 0.02 });
  const marble = new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.16, metalness: 0.18 });
  const velvet = new THREE.MeshStandardMaterial({ map: velvetTex(), roughness: 0.82, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.85, metalness: 0.08 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xeef2f8, metalness: 0.96, roughness: 0.08 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x16161d, metalness: 0.78, roughness: 0.38 });
  const led = new THREE.MeshStandardMaterial({ color: accentC, emissive: accentC, emissiveIntensity: 2.2, roughness: 0.2 });
  const add = <T extends THREE.Object3D>(o3: T, parent: THREE.Object3D = scene): T => { parent.add(o3); return o3; };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, shadow = true): THREE.Mesh => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; return add(b, parent); };
  const RW = 24, RD = 22, RH = 7.4;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), carpet); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  for (const [w, h, x, y, z, ry] of [[RW, RH, 0, RH / 2, -RD / 2, 0], [RW, RH, 0, RH / 2, RD / 2, Math.PI], [RD, RH, -RW / 2, RH / 2, 0, Math.PI / 2], [RD, RH, RW / 2, RH / 2, 0, -Math.PI / 2]] as number[][]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); wl.position.set(x, y, z); wl.rotation.y = ry; wl.receiveShadow = true; scene.add(wl); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ color: 0x07060a, roughness: 0.95 })); ceil.position.y = RH; ceil.rotation.x = Math.PI / 2; scene.add(ceil);
  // stage, catwalk, tip, LED edging, steps
  box(9.6, STAGE_Y, 4.4, marble, 0, STAGE_Y / 2, -1.2); box(3.2, STAGE_Y, 3.6, marble, 0, STAGE_Y / 2, 2.2);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.65, STAGE_Y, 32), marble); tip.position.set(0, STAGE_Y / 2, 4.0); tip.receiveShadow = true; scene.add(tip);
  const ledMeshes: THREE.Mesh[] = [];
  const strip = (w: number, h: number, d: number, x: number, y: number, z: number): void => { ledMeshes.push(box(w, h, d, led, x, y, z, undefined, false)); };
  strip(9.68, 0.05, 0.06, 0, STAGE_Y - 0.04, 1.02); strip(9.68, 0.05, 0.06, 0, 0.06, 1.02); strip(0.06, 0.05, 4.46, -4.82, STAGE_Y - 0.04, -1.2); strip(0.06, 0.05, 4.46, 4.82, STAGE_Y - 0.04, -1.2); strip(0.06, 0.05, 3, -1.62, STAGE_Y - 0.04, 2.5); strip(0.06, 0.05, 3, 1.62, STAGE_Y - 0.04, 2.5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.032, 8, 40, Math.PI), led); ring.rotation.x = Math.PI / 2; ring.position.set(0, STAGE_Y - 0.04, 4.0); scene.add(ring); ledMeshes.push(ring);
  for (const sx of [-5.25, 5.25]) for (let i = 0; i < 3; i++) { const sh = (STAGE_Y / 3) * (i + 1); box(0.9, sh, 1.3, marble, sx + (sx < 0 ? -0.35 : 0.35) * (2 - i), sh / 2, -2.5, undefined, false); }
  // poles + truss
  for (const [px, pz] of [[0, 1.0], [-3.3, -0.8], [3.3, -0.8]]) {
    const ph = TRUSS_Y - STAGE_Y; const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, ph, 16), chrome); pole.position.set(px, STAGE_Y + ph / 2, pz); pole.castShadow = true; scene.add(pole);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 20), chrome); fl.position.set(px, STAGE_Y + 0.025, pz); scene.add(fl);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 8, 28), led); halo.rotation.x = Math.PI / 2; halo.position.set(px, STAGE_Y + 0.01, pz); scene.add(halo); ledMeshes.push(halo);
  }
  for (const [len, x, z, ry] of [[15, 0, -1.2, 0], [15, 0, 3.8, 0], [11, -7.2, 1.3, Math.PI / 2], [11, 7.2, 1.3, Math.PI / 2], [11, 0, 1.3, Math.PI / 2]]) { const t = new THREE.Group(); for (const [yy, zz] of [[0.14, 0.14], [0.14, -0.14], [-0.14, 0.14], [-0.14, -0.14]]) t.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), dark)).position.set(0, yy, zz); t.position.set(x, TRUSS_Y, z); t.rotation.y = ry; scene.add(t); }
  // VIP booths (right wall and rear)
  const booths: THREE.Group[] = []; const hotspots: Record<SpotId, THREE.Object3D[]> = { dj: [], vip: [], bar: [], bouncer: [] };
  const bottleCols = [0xff1e56, 0x00f0ff, 0xffbe0b, 0x06d6a0, 0x9b5de5, 0xfb5607];
  const mkBooth = (x: number, z: number, ry: number): void => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; scene.add(b); booths.push(b);
    box(3.4, 0.45, 0.9, velvet, 0, 0.25, -0.9, b); box(3.4, 1.05, 0.28, velvet, 0, 0.72, -1.25, b);
    for (const sx of [-1.4, 1.4]) { box(0.75, 0.45, 1.9, velvet, sx, 0.25, 0.1, b); box(0.24, 0.85, 2.2, velvet, sx + (sx < 0 ? -0.28 : 0.28), 0.62, 0, b); }
    box(1.5, 0.08, 0.95, marble, 0, 0.52, 0.18, b); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.5, 12), brass); base.position.set(0, 0.25, 0.18); b.add(base);
    for (let d = 0; d < 3; d++) { const gm = new THREE.MeshStandardMaterial({ color: bottleCols[d], emissive: bottleCols[d], emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }); const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.032, 0.13, 10), gm); gl.position.set(-0.42 + d * 0.42, 0.62, 0.24 + (d % 2) * 0.12); b.add(gl); }
    for (const px of [-1.7, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.95, 8), brass); p.position.set(px, 0.475, 1.45); b.add(p); }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.7, 0.88, 1.45), new THREE.Vector3(0, 0.56, 1.45), new THREE.Vector3(1.7, 0.88, 1.45)), 14, 0.024, 6, false), new THREE.MeshStandardMaterial({ color: 0x8b0024, roughness: 0.7 })); b.add(rope);
  };
  mkBooth(9.4, -1.5, -Math.PI / 2); mkBooth(9.4, 4.2, -Math.PI / 2); mkBooth(-4.6, 8.8, Math.PI); mkBooth(4.6, 8.8, Math.PI);
  hotspots.vip.push(booths[0]);
  // THE CELLAR: the private lounge under the stage (a separate little room the camera visits for bottle service)
  const CX = 34; const cellar = new THREE.Group(); cellar.position.set(CX, 0, 0); cellar.visible = false; scene.add(cellar);
  box(10, 0.2, 8, velvet, 0, -0.1, 0, cellar); box(10, 0.2, 8, dark, 0, 3.4, 0, cellar); box(10, 3.4, 0.3, wallMat, 0, 1.7, -4, cellar); box(0.3, 3.4, 8, wallMat, -5, 1.7, 0, cellar); box(0.3, 3.4, 8, wallMat, 5, 1.7, 0, cellar);
  box(3.8, 0.5, 0.95, velvet, -0.8, 0.25, -3.3, cellar); box(3.8, 1.0, 0.25, velvet, -0.8, 0.8, -3.75, cellar); box(0.95, 0.5, 3.0, velvet, -4.3, 0.25, 0.2, cellar); box(0.25, 1.0, 3.0, velvet, -4.75, 0.8, 0.2, cellar);
  box(1.6, 0.08, 0.95, marble, 1.3, 0.55, 0.4, cellar); { const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.5, 12), brass); tb.position.set(1.3, 0.28, 0.4); cellar.add(tb); }
  for (let i = 0; i < 4; i++) { const bm2 = new THREE.MeshStandardMaterial({ color: bottleCols[i], emissive: bottleCols[i], emissiveIntensity: 0.8, transparent: true, opacity: 0.88 }); const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), bm2); bt.position.set(0.85 + i * 0.32, 0.74, 0.4 + (i % 2) * 0.2); cellar.add(bt); const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 8), bm2); nk.position.set(0.85 + i * 0.32, 0.95, 0.4 + (i % 2) * 0.2); cellar.add(nk); }
  for (const [bx, bz] of [[0.6, 1.0], [2.0, 1.0]]) { const ib = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14), brass); ib.position.set(bx, 0.7, bz - 0.4); cellar.add(ib); }
  { const ca = new THREE.PointLight(0xff3d8d, 6, 11); ca.position.set(-1.2, 2.8, 0.6); cellar.add(ca); const cb = new THREE.PointLight(0xffb347, 5, 10); cb.position.set(2.4, 2.6, 1.2); cellar.add(cb); cellarFlash = new THREE.PointLight(0xffe8b0, 0, 9); cellarFlash.position.set(1.3, 1.6, 0.4); cellar.add(cellarFlash); const cs = new THREE.PointLight(0xffffff, 2.5, 12); cs.position.set(0, 3.0, 2.0); cellar.add(cs); }
  // bar (left wall) with stools that can be knocked over
  const bar = new THREE.Group(); bar.position.set(-9.4, 0, 1.6); scene.add(bar);
  box(1.1, 1.05, 8.4, new THREE.MeshStandardMaterial({ color: 0x16111c, roughness: 0.55, metalness: 0.25 }), 0.6, 0.525, 0, bar); box(1.4, 0.08, 8.6, marble, 0.65, 1.09, 0, bar);
  const barLed = box(0.05, 0.05, 8.4, led, 1.18, 1.01, 0, bar, false); ledMeshes.push(barLed);
  box(0.12, 3.2, 8, new THREE.MeshStandardMaterial({ color: 0x220c2c, emissive: 0x3a0ca3, emissiveIntensity: 0.65, roughness: 0.3 }), -2.3, 1.9, 0, bar, false);
  for (let s = 0; s < 3; s++) { const sy = 1.25 + s * 0.72; box(0.42, 0.05, 7.6, dark, -2.05, sy, 0, bar, false); for (let b = 0; b < 18; b++) { const c = bottleCols[(b + s * 2) % 6], bh = 0.24 + (b % 3) * 0.05; const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, bh, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.15 })); bt.position.set(-2.05, sy + bh / 2 + 0.025, -3.4 + b * 0.4); bar.add(bt); } }
  const stools: Stool[] = [];
  for (let s = 0; s < 6; s++) { const g = new THREE.Group(); g.position.set(1.85, 0, -3.2 + s * 1.28); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.74, 8), chrome); st.position.y = 0.38; const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.1, 16), velvet); cu.position.y = 0.78; const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 14), chrome); bs.position.y = 0.015; g.add(st, cu, bs); bar.add(g); stools.push({ g, tilt: 0, until: 0 }); }
  const barLight = new THREE.PointLight(0x9b5de5, 3, 11); barLight.position.set(0.2, 3.2, 0); bar.add(barLight); hotspots.bar.push(bar);
  // DJ booth with a live equaliser
  const dj = new THREE.Group(); dj.position.set(0, 0, -7.8); scene.add(dj); hotspots.dj.push(dj);
  box(5.6, 0.9, 2.8, dark, 0, 0.45, 0, dj); box(3.4, 1.15, 1, dark, 0, 1.45, 0.45, dj);
  for (const dx of [-0.85, 0.85]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x00f0ff, emissiveIntensity: 0.7 })); p.position.set(dx, 2.04, 0.45); dj.add(p); }
  const eq: { mesh: THREE.Mesh; ph: number }[] = [];
  for (let i = 0; i < 14; i++) { const c = new THREE.Color().setHSL(0.92 - (i / 14) * 0.45, 0.95, 0.55), b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.06), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.8 })); b.position.set(-1.35 + i * 0.21, 1.45, 0.97); dj.add(b); eq.push({ mesh: b, ph: i * 0.55 }); }
  const woofers: THREE.Mesh[] = [];
  for (const sx of [-3.8, 3.8]) { box(1.3, 3.2, 1.1, dark, sx, 1.6, 0.2, dj); for (const wy of [0.95, 2.15]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 20), chrome); rim.position.set(sx, wy, 0.76); dj.add(rim); const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.16, 0.15, 20), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 })); cone.rotation.x = Math.PI / 2; cone.position.set(sx, wy, 0.71); dj.add(cone); woofers.push(cone); } }
  // exit door
  box(0.2, 2.3, 1.4, new THREE.MeshStandardMaterial({ color: 0x100e0e, roughness: 0.6 }), 11.85, 1.15, 7.4, undefined, false);
  const mkSign = (text: string, w: number, h: number, x: number, y: number, z: number, ry: number): THREE.Mesh => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neonTex(text, o.accent), transparent: true, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  mkSign("THE CELLAR", 3.6, 0.95, CX - 1.4, 2.5, -3.8, 0); mkSign("UNDER THE STAGE", 2.6, 0.6, CX + 4.8, 2.4, -0.6, -Math.PI / 2);
  let mainSign = mkSign("THE PINK PUKEKO", 7.4, 1.85, 0, 5.0, -10.85, 0); const sideSign = mkSign("VIP · FAMIGLIA", 4.6, 1.15, 11.85, 4.3, 1.2, -Math.PI / 2), barSign = mkSign("BAR · L&P $14", 4.6, 1.15, -11.85, 4.6, 1.6, Math.PI / 2);
  void sideSign; void barSign;

  // ------------------------------------------------------------------ lights
  const ambient = new THREE.AmbientLight(0x260c18, 0.9); scene.add(ambient);
  const fill = new THREE.PointLight(accentC, 3.2, 15); fill.position.set(0, 4.4, 2.6); scene.add(fill);
  const flash = new THREE.PointLight(0xffffff, 0, 40); flash.position.set(0, 5, 1.5); scene.add(flash);
  const flameLight = new THREE.PointLight(0xff8a30, 0, 14); flameLight.position.set(0, 1.6, 1.2); scene.add(flameLight);
  const follow = new THREE.SpotLight(0xfff4c8, 0, 22, 0.28, 0.5, 1.2); follow.position.set(0, TRUSS_Y - 0.2, 5.5); const followT = new THREE.Object3D(); scene.add(follow, followT); follow.target = followT;
  const beamMat = (c: number, up: boolean): THREE.ShaderMaterial => new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(c) }, uOpacity: { value: 0.3 }, uUp: { value: up ? 1 : 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uUp; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float fade = uUp > 0.5 ? 1.0 - smoothstep(0.0, 1.8, vY) : smoothstep(-7.6, 0.0, vY); fade *= fade; gl_FragColor = vec4(uColor * (1.0 + fade), f * fade * uOpacity * 2.2); }` });
  const setBeam = (m: THREE.Mesh, c: THREE.Color, op: number): void => { const u = (m.material as THREE.ShaderMaterial).uniforms; (u.uColor.value as THREE.Color).copy(c); u.uOpacity.value = op; };
  interface Spot { pivot: THREE.Group; light: THREE.SpotLight; cone: THREE.Mesh; phase: number; dead: number }
  const spots: Spot[] = [];
  [[-4.2, 3.8, true], [4.2, 3.8, false], [0, 3.8, true], [-5, -1.2, false], [5, -1.2, false], [0, -1.2, false]].forEach(([x, z, shadow], i) => {
    const pivot = new THREE.Group(); pivot.position.set(x as number, TRUSS_Y - 0.2, z as number); const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.32, 10), dark); hs.rotation.x = Math.PI / 2; pivot.add(hs);
    const light = new THREE.SpotLight(0xff1e56, 24, 18, Math.PI / 6.5, 0.55, 1.3); const tg = new THREE.Object3D(); tg.position.set(0, -6, 0); pivot.add(tg); light.target = tg; pivot.add(light);
    if (shadow && i < 3) { light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.0005; }
    const cg = new THREE.ConeGeometry(1.9, 7.6, 56, 1, true); cg.translate(0, -3.8, 0);
    const cone = new THREE.Mesh(cg, beamMat(0xff1e56, false)); pivot.add(cone);
    scene.add(pivot); spots.push({ pivot, light, cone, phase: i * 1.15, dead: 0 });
  });
  const dustGeo = new THREE.BufferGeometry(); { const p = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) { p[i * 3] = rnd(-9, 9); p[i * 3 + 1] = rnd(0.5, 6.3); p[i * 3 + 2] = rnd(-8, 8); } dustGeo.setAttribute("position", new THREE.BufferAttribute(p, 3)); }
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffb3c6, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(dust);
  // lasers, mirror ball, flame jets, scorch, sprinklers, bolt
  const lasers: THREE.Mesh[] = []; for (let k = 0; k < 9; k++) { const g = new THREE.CylinderGeometry(0.012, 0.012, 14, 4); g.translate(0, -7, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: k % 2 ? 0x50ffa0 : 0xff3c78, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(-4.8 + k * 1.2, TRUSS_Y - 0.1, 1.3); m.visible = false; scene.add(m); lasers.push(m); }
  const ball = new THREE.Group(); ball.position.set(0, 7.6, 1.4); scene.add(ball); ball.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 1, roughness: 0.12, flatShading: true })));
  const flecks = (() => { const n = 60, p = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd(0, TAU), r = rnd(2.5, 8), y = rnd(-5.6, -1.2); p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = y; p[i * 3 + 2] = Math.sin(a) * r; new THREE.Color().setHSL(Math.random(), 0.9, 0.7).toArray(c, i * 3); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); ball.add(pts); return pts; })();
  void flecks; ball.visible = false;
  const JETS = [-4.5, -2, 2, 4.5].map((x) => new THREE.Vector3(x, STAGE_Y, 0.75)); const jets: THREE.Group[] = []; const scorch: THREE.Mesh[] = []; const scorchAmt = [0, 0, 0, 0];
  JETS.forEach((p, i) => { const g = new THREE.Group(); g.position.copy(p); for (const [r, h, c] of [[0.32, 1.8, 0xff7a20], [0.18, 1.3, 0xffd84a]] as number[][]) { const cg = new THREE.ConeGeometry(r, h, 10, 1, true); cg.translate(0, h / 2, 0); { const fm = beamMat(c, true); (fm.uniforms.uOpacity as { value: number }).value = 0.9; g.add(new THREE.Mesh(cg, fm)); } } g.visible = false; scene.add(g); jets.push(g);
    const sc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); sc.rotation.x = -Math.PI / 2; sc.position.set(p.x, STAGE_Y + 0.006 + i * 0.0005, p.z); scene.add(sc); scorch.push(sc); });
  const drops = (() => { const n = 160, g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.7 })); l.visible = false; l.frustumCulled = false; scene.add(l); const xs = Array.from({ length: n }, () => [rnd(-9, 9), rnd(0, 6), rnd(-8, 8)]); return { l, xs }; })();
  let boltMesh: THREE.Line | null = null, boltT = 0, prevBolt = 0;

  // ------------------------------------------------------------------ cash and paper (instanced; physics from PhysicsWorld)
  const dummy = new THREE.Object3D();
  const mkPool = (geo: THREE.BufferGeometry, m: THREE.Material, max: number): Pool => { const mesh = new THREE.InstancedMesh(geo, m, max); mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.receiveShadow = false; scene.add(mesh); return { mesh, items: [], max }; };
  const flat = new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide });
  const pools: Record<Bit["k"], Pool> = { bill: mkPool(new THREE.PlaneGeometry(0.17, 0.075), flat, 800), coin: mkPool(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 10), new THREE.MeshStandardMaterial({ color: 0xf6b62c, metalness: 0.9, roughness: 0.25 }), 300), conf: mkPool(new THREE.PlaneGeometry(0.05, 0.032), flat, 700), feather: mkPool(new THREE.PlaneGeometry(0.16, 0.03), flat, 200) };
  const colCache = new Map<string, THREE.Color>(); const colOf = (s: string): THREE.Color => { let c = colCache.get(s); if (!c) { try { c = new THREE.Color(s); } catch { c = new THREE.Color(0x7dcf94); } colCache.set(s, c); } return c; };
  const spawn = (k: Bit["k"], x: number, y: number, z: number, vx: number, vy: number, vz: number, c: THREE.Color, v: number, life = 60, sz = 1): void => {
    const p = pools[k]; if (p.items.length >= p.max) { const i = p.items.findIndex((b) => b.landed); p.items.splice(i < 0 ? 0 : i, 1); }
    p.items.push({ k, x, y, z, vx, vy, vz, ry: rnd(0, TAU), spin: rnd(-8, 8), ph: rnd(0, TAU), c, v, age: 0, life, landed: false, wet: false, s: sz });
  };
  const worldOf = (x2: number, y2: number, plane: number): THREE.Vector3 => { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((x2 / W) * 2 - 1, -(y2 / H) * 2 + 1), camera); const r = rc.ray, t = Math.abs(r.direction.y) < 1e-4 ? 8 : (plane - r.origin.y) / r.direction.y; return r.at(clamp(t, 0.5, 30), new THREE.Vector3()); };

  // ------------------------------------------------------------------ people
  const cast = o.cast.slice(), used = new Set<number>();
  const pool = (girl: boolean): Character[] => cast.filter((c) => !used.has(c.id) && (girl ? c.look.kind === "girl" : true));
  const hashOf = (s: string): number => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const takeChar = (girl: boolean, seed: number): Character | null => { const p = pool(girl); const q = p.length ? p : pool(false); if (!q.length) return null; const c = q[seed % q.length]; used.add(c.id); return c; };
  const SLOTS = [new THREE.Vector3(0, STAGE_Y, 1.0), new THREE.Vector3(-3.3, STAGE_Y, -0.8), new THREE.Vector3(3.3, STAGE_Y, -0.8), new THREE.Vector3(-1.7, STAGE_Y, 0.2), new THREE.Vector3(1.7, STAGE_Y, 0.2)];
  const DEFAULT_R: Routine[] = ["poleSpin", "hipSway", "clubFreestyle", "hipSway", "clubFreestyle"];
  const saved: Record<string, { routine: Routine; outfit: string; dance?: number }> = (() => { try { return JSON.parse(localStorage.getItem("club3d.styles") ?? "{}"); } catch { return {}; } })();
  const dancers: Dancer[] = o.roster.map((r, i) => {
    const m = buildMosaic(takeChar(true, hashOf(r.name)), "dancer", r.name, o.accent); const slot = SLOTS[i % SLOTS.length], st = saved[r.name];
    const d: Dancer = { recoil: 0, rdx: 0, rdz: 0, dance: st?.dance ?? (r.pole || i < 3 ? -1 : -2), m, slot, pole: r.pole || i < 3, routine: st?.routine ?? DEFAULT_R[i % 5], outfit: st?.outfit ?? "own", needsStage: r.needsStage, pos: slot.clone(), hop: 0, scoop: 0 };
    m.root.position.copy(slot); scene.add(m.root); applyOutfit(m, d.outfit); return d;
  });
  const mkNpc = (role: Role, x: number, z: number, y = 0, face = 0, name = ""): Npc => { const m = buildMosaic(takeChar(false, Math.floor(rnd(0, 999))), role, name || role, o.accent); m.root.position.set(x, y, z); m.root.rotation.y = face; scene.add(m.root); return { st: "idle", m, base: new THREE.Vector3(x, y, z), pos: new THREE.Vector3(x, y, z), ph: rnd(0, TAU), fall: 0, face, i: 0 }; };
  const PATRONS = [[-5.4, 6.0], [-3.8, 7.0], [-2.4, 5.8], [-2.6, 7.4], [2.6, 6.4], [3.6, 7.4], [4.8, 6.0], [6.2, 7.0], [-6.8, 4.6]];
  const patrons = PATRONS.map(([x, z], i) => { const n = mkNpc("patron", x, z, 0, Math.PI + rnd(-0.3, 0.3)); n.i = i; return n; });
  const bouncer = mkNpc("bouncer", 9.4, 7.3, 0, -Math.PI / 2 - 0.3, "Tiny"), djN = mkNpc("dj", 0, -8.5, 0.9, 0, "DJ"), bartender = mkNpc("bartender", -10.2, 1.6, 0, Math.PI / 2, "Bartender"), mc = mkNpc("mc", -2.7, 3.8, 0, 0.35, "MC");
  const fam = [-0.8, 0, 0.8].map((dz) => mkNpc("famiglia", 10.1, -1.5 + dz, 0.0, -Math.PI / 2, "Famiglia")); fam.forEach((f) => { f.m.root.position.y = 0; });
  hotspots.bouncer.push(bouncer.m.root); hotspots.vip.push(...fam.map((f) => f.m.root)); hotspots.dj.push(djN.m.root); hotspots.bar.push(bartender.m.root);
  const cleaner = mkNpc("cleaner", EXIT.x, EXIT.z, 0, 0, "Staff"); cleaner.m.root.visible = false;
  const boxes: Record<SpotId, THREE.Box3> = { dj: new THREE.Box3(), vip: new THREE.Box3(), bar: new THREE.Box3(), bouncer: new THREE.Box3() };
  scene.updateMatrixWorld(true); (Object.keys(hotspots) as SpotId[]).forEach((k) => hotspots[k].forEach((ob) => boxes[k].union(new THREE.Box3().setFromObject(ob))));

  // ------------------------------------------------------------------ carried money gun
  let carryHooks: CarryHooks | null = null, carryFig: Mosaic | null = null;
  const carryGun = createCarryGun({
    scene, camera, accent: o.accent, floorY: surfaceY, blocked: (x, z) => surfaceY(x, z) > 0,
    targets: () => dancers.filter((d) => d.m.root.visible).map((d) => ({ name: d.m.name, base: d.m.root.position, chest: new THREE.Vector3(d.m.root.position.x, d.m.root.position.y + 1.25, d.m.root.position.z), radius: 0.42, height: 1.95 })),
    burst: (p, n) => { for (let i = 0; i < n * 2; i++) spawn("conf", p.x, p.y, p.z, rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1), colOf("#ffd27a"), 0, 3, 0.5); },
    miss: (p, v) => { for (let i = 0; i < 3; i++) spawn("bill", p.x + rnd(-0.1, 0.1), p.y + 0.05, p.z + rnd(-0.1, 0.1), rnd(-1.2, 1.2), rnd(0.4, 1.4), rnd(-1.2, 1.2), colOf("#7dcf94"), v, 60); },
    hit: (name, p, dir, v) => {
      const d = dancers.find((q) => q.m.name === name); if (!d) return;
      // her body takes it: knocked back along the shot, flashed, doubled over, and the cash bursts off her
      d.recoil = 1; d.rdx = dir.x; d.rdz = dir.z; d.scoop = Math.max(d.scoop, 0.6);
      for (let i = 0; i < 12; i++) spawn("bill", p.x, p.y, p.z, dir.x * rnd(0.5, 2.5) + rnd(-2, 2), rnd(0.6, 3), dir.z * rnd(0.5, 2.5) + rnd(-2, 2), colOf(["#7dcf94", "#e5c566", "#9ad0ff"][i % 3]), v, 60);
      for (let i = 0; i < 6; i++) spawn("coin", p.x, p.y, p.z, rnd(-2.2, 2.2), rnd(1, 3.4), rnd(-2.2, 2.2), colOf("#f6b62c"), v * 2, 60);
      for (let i = 0; i < 14; i++) spawn("conf", p.x, p.y, p.z, rnd(-2, 2), rnd(0.8, 3), rnd(-2, 2), colOf(["#ff4fa0", "#ffd27a", "#9ad0ff"][i % 3]), 0, 3, 0.6);
      popT = 0.25; carryHooks?.tipped(name, v);
      if (Math.random() < 0.35) o.news(`${name.toUpperCase().split(" ")[0]}|${["Ow! My ribs! They were loose notes!", "Hey! That's a lot of money to the face!", "Ooof. Worth it. Do it again.", "I felt that in my soul and my knees."][Math.floor(Math.random() * 4)]}`);
    },
    setFigure: (on, p, moving, t) => {
      if (!carryFig && on) { const you = o.cast.find((c) => c.tier === "player") ?? o.cast[0] ?? null; carryFig = buildMosaic(you, "patron", "You", o.accent); scene.add(carryFig.root); }
      if (!carryFig) return; carryFig.root.visible = on; if (!on) return;
      carryFig.root.position.set(p.x, p.y + (moving ? Math.abs(Math.sin(t * 9)) * 0.04 : 0), p.z); carryFig.rig.hips.visible = false; paintBillboard(carryFig, o.draw, t, moving ? "dance" : "idle", 0, undefined, 0.09);
    },
  });

  // ------------------------------------------------------------------ state of the room
  const v3 = new THREE.Vector3();
  const toPt = (p: THREE.Vector3): Pt => { v3.copy(p).project(camera); return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H }; };
  let beams: THREE.Color[] = [accentC.clone()], phase = 0, elapsed = 0, heat = 0, alarm = 0, wetUntil = 0, flameOn = 0, lastW = 0, lastH = 0, sweptTotal = 0, nextClean = 0, cleanState = 0, cleanT = 0, ghostSpook = 0;
  const critters: Critter[] = []; let nowT = 0, lightNews = 0, stoleTotal = 0, alarmNews = false;
  const hue = new THREE.Color(), tmpC = new THREE.Color();
  const costs = (): number => pools.bill.items.filter((b) => b.landed).length + pools.coin.items.filter((b) => b.landed).length;

  const takeNear = (x: number, z: number, r: number, cap: number): number => {
    let got = 0, n = 0; for (const k of ["bill", "coin"] as const) { const it = pools[k].items; for (let i = it.length - 1; i >= 0 && n < cap; i--) { const b = it[i]; if (b.landed && Math.hypot(b.x - x, b.z - z) < r) { got += b.v; it.splice(i, 1); n++; } } } return got;
  };

  // critters from primitives
  const part = (g: THREE.Group, geo: THREE.BufferGeometry, c: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, trans = false): THREE.Mesh => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, transparent: trans, opacity: trans ? 0.6 : 1 })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  const sph = new THREE.SphereGeometry(0.5, 12, 10), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  const makeCritter = (k: string): THREE.Group => {
    const g = new THREE.Group();
    if (k === "raccoon") { part(g, sph, 0x6a6f78, 0, 0.22, 0, 0.55, 0.32, 0.3); part(g, sph, 0x6a6f78, 0.3, 0.3, 0, 0.26, 0.24, 0.24); part(g, cyl, 0x2b2d33, 0.34, 0.33, 0, 0.1, 0.06, 0.26); part(g, cyl, 0x4a4d55, -0.42, 0.26, 0, 0.5, 0.12, 0.12).rotation.z = 1.4; }
    else if (k === "chicken") { part(g, sph, 0xf4efe2, 0, 0.3, 0, 0.5, 0.42, 0.34); part(g, sph, 0xf4efe2, 0.26, 0.55, 0, 0.2, 0.2, 0.2); part(g, sph, 0xc74d57, 0.28, 0.7, 0, 0.1, 0.1, 0.05); part(g, cyl, 0xf6b62c, 0.4, 0.54, 0, 0.1, 0.04, 0.04).rotation.z = 1.57; }
    else if (k === "flamingo") { part(g, sph, 0xff6fa5, 0, 1.0, 0, 1.0, 1.1, 0.8); part(g, cyl, 0xff6fa5, 0.45, 1.6, 0, 0.14, 0.9, 0.14).rotation.z = -0.4; part(g, sph, 0xff6fa5, 0.7, 2.1, 0, 0.3, 0.26, 0.26); part(g, cyl, 0xf6b62c, 0.92, 2.08, 0, 0.3, 0.06, 0.06).rotation.z = 1.57; for (const lz of [-0.15, 0.15]) part(g, cyl, 0xff8fbd, 0, 0.35, lz, 0.05, 0.7, 0.05); }
    else if (k === "pigeon") { part(g, sph, 0x8b93a3, 0, 0, 0, 0.3, 0.18, 0.16); part(g, sph, 0x8b93a3, 0.16, 0.05, 0, 0.12, 0.12, 0.12); part(g, cyl, 0x8b93a3, 0, 0.05, 0.16, 0.3, 0.02, 0.22); part(g, cyl, 0x8b93a3, 0, 0.05, -0.16, 0.3, 0.02, 0.22); }
    else { part(g, new THREE.ConeGeometry(0.4, 1.3, 12, 1, true), 0xe8eef8, 0, 1.3, 0, 1, 1, 1, true).rotation.x = Math.PI; part(g, sph, 0xe8eef8, 0, 1.7, 0, 0.5, 0.5, 0.5, true); part(g, sph, 0x111111, -0.08, 1.74, 0.2, 0.08, 0.1, 0.05); part(g, sph, 0x111111, 0.08, 1.74, 0.2, 0.08, 0.1, 0.05); }
    scene.add(g); return g;
  };

  // ------------------------------------------------------------------ props: real objects that change how the club behaves
  let agg = aggregate({}), extStock = 0, vacT = 0, messT = 0;
  const propGroup = new THREE.Group(); scene.add(propGroup); const propAnims: ((t: number, dt: number) => void)[] = []; const hostNpcs: Npc[] = []; const shooters: { s: Shoot; pos: THREE.Vector3; t: number; col: THREE.Color; n: number }[] = [];
  const pslots: THREE.Vector3[] = []; for (let x = -10; x <= 10.5; x += 1.7) for (let z = -9.5; z <= 10; z += 1.7) { const stg = x > -5.6 && x < 5.6 && z > -4 && z < 1.6, cat = Math.abs(x) < 2.4 && z > 0 && z < 6, djz = Math.abs(x) < 5.2 && z < -5.6, barz = x < -6.6, bth = x > 8.4 && z < 6, pat = Math.abs(x) < 7.2 && z > 5.2 && z < 8.2; if (!(stg || cat || djz || barz || bth || pat)) pslots.push(new THREE.Vector3(x, 0, z)); }
  const pm = (c: number, em = 0, rough = 0.5, metal = 0.2, op = 1): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, emissive: em ? c : 0x000000, emissiveIntensity: em, roughness: rough, metalness: metal, transparent: op < 1, opacity: op });
  const pb = (g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = false; g.add(me); return me; };
  const BX = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d), CY = (r: number, h: number, r2 = r): THREE.BufferGeometry => new THREE.CylinderGeometry(r2, r, h, 16), SP = (r: number): THREE.BufferGeometry => new THREE.SphereGeometry(r, 16, 12);
  const cabinet = (g: THREE.Group, c: number, w = 0.8, h = 1.7): void => { pb(g, BX(w, h, 0.7), pm(0x16161d, 0, 0.5, 0.6), 0, h / 2, 0); pb(g, BX(w * 0.8, h * 0.35, 0.02), pm(c, 1.4, 0.3, 0), 0, h * 0.68, 0.36); pb(g, BX(w, 0.06, 0.74), pm(c, 0.8), 0, h, 0); };
  const buildProp = (kind: string, c: number): THREE.Group => {
    const g = new THREE.Group();
    switch (kind) {
      case "lamp": pb(g, CY(0.12, 0.1), pm(0x222222), 0, 0.05, 0); pb(g, new THREE.CapsuleGeometry(0.14, 0.4, 6, 12), pm(c, 1.5, 0.2, 0, 0.85), 0, 0.4, 0); break;
      case "tile": { const t = pb(g, BX(1.3, 0.04, 1.3), pm(c, 1.2), 0, 0.02, 0); propAnims.push((tt) => { (t.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.abs(Math.sin(tt * 3)) * 1.2; }); break; }
      case "fan": { pb(g, CY(0.03, 1.4), pm(0xaaaaaa), 0, 5.5, 0); const b = new THREE.Group(); b.position.y = 4.8; for (let i = 0; i < 4; i++) { const bl = pb(b, BX(1.1, 0.02, 0.18), pm(0xcccccc), 0.6, 0, 0); bl.rotation.y = 0; bl.position.set(Math.cos(i * 1.57) * 0.6, 0, Math.sin(i * 1.57) * 0.6); bl.rotation.y = -i * 1.57; } g.add(b); propAnims.push((_t, dt) => { b.rotation.y += dt * 9; }); break; }
      case "cooler": pb(g, BX(0.4, 1.0, 0.4), pm(0xeeeeee), 0, 0.5, 0); pb(g, CY(0.17, 0.4), pm(c, 0.9, 0.1, 0, 0.7), 0, 1.2, 0); break;
      case "vend": case "arcade": case "atm": case "juke": case "booth": case "cashm": case "safe": cabinet(g, c, kind === "booth" ? 1.2 : 0.8, kind === "safe" || kind === "cashm" ? 1.1 : 1.8); break;
      case "cart": pb(g, BX(1.1, 0.8, 0.6), pm(c, 0.3), 0, 0.5, 0); pb(g, BX(1.2, 0.08, 0.7), pm(0xeeeeee), 0, 0.95, 0); pb(g, SP(0.3), pm(c, 0.8, 0.3, 0, 0.6), 0, 1.25, 0); break;
      case "neon": { const t = pb(g, new THREE.TorusGeometry(0.4, 0.04, 8, 28), pm(c, 2.4), 0, 1.6, 0); pb(g, CY(0.03, 1.4), pm(0x333333), 0, 0.7, 0); propAnims.push((tt) => { (t.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(tt * 9) * 0.6 * (Math.sin(tt * 0.7) > 0.8 ? 1 : 0); }); break; }
      case "bucket": pb(g, CY(0.22, 0.4, 0.28), pm(c), 0, 0.2, 0); pb(g, CY(0.015, 1.4), pm(0x8a6a3a), 0.15, 0.8, 0).rotation.z = 0.15; break;
      case "ac": pb(g, BX(1.2, 0.5, 0.4), pm(0xdde6ee, 0, 0.4, 0.3), 0, 3.2, -0.2); pb(g, BX(1.0, 0.05, 0.02), pm(c, 1), 0, 3.1, 0.02); break;
      case "ext": pb(g, CY(0.09, 0.5), pm(c, 0.2, 0.3), 0, 0.3, 0); pb(g, CY(0.03, 0.1), pm(0x222222), 0, 0.6, 0); break;
      case "cam": pb(g, CY(0.02, 1.8), pm(0x333333), 0, 3.6, 0); { const cm = pb(g, BX(0.3, 0.15, 0.15), pm(0x111111), 0, 2.7, 0); propAnims.push((tt) => { cm.rotation.y = Math.sin(tt * 0.6) * 0.8; }); pb(cm as unknown as THREE.Group, SP(0.03), pm(0xff0000, 2), 0.14, 0, 0); } break;
      case "robot": { const r = pb(g, CY(0.28, 0.1), pm(0xeeeeee, 0.2), 0, 0.06, 0); propAnims.push((tt) => { r.position.x = Math.sin(tt * 0.5) * 1.2; r.position.z = Math.cos(tt * 0.35) * 0.9; }); break; }
      case "table": pb(g, BX(1.6, 0.1, 0.9), pm(c, 0.1, 0.8, 0), 0, 0.85, 0); for (const [x, z] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) pb(g, CY(0.05, 0.85), pm(0x3a2a1a), x, 0.42, z); for (let i = 0; i < 4; i++) pb(g, SP(0.05), pm([0xff3333, 0xffee33, 0x3366ff, 0xffffff][i], 0.4), -0.3 + i * 0.2, 0.95, 0); break;
      case "tank": pb(g, BX(1.6, 0.9, 0.6), pm(c, 0.8, 0.1, 0, 0.45), 0, 0.9, 0); pb(g, BX(1.7, 0.9, 0.7), pm(0x111111), 0, 0.2, 0); for (let i = 0; i < 4; i++) { const f = pb(g, SP(0.07), pm([0xff8a30, 0xffe040, 0xff3d8d, 0x40ffd0][i], 1.2), 0, 0.9, 0); propAnims.push((tt) => { f.position.set(Math.sin(tt * (0.5 + i * 0.2) + i) * 0.65, 0.9 + Math.sin(tt * 0.9 + i) * 0.25, Math.cos(tt * 0.4 + i) * 0.2); }); } break;
      case "fogm": pb(g, BX(0.7, 0.35, 0.5), pm(0x222222, 0, 0.4, 0.6), 0, 0.2, 0); { const b = pb(g, SP(0.18), pm(c, 0.5, 0.3, 0, 0.35), 0, 0.7, 0); propAnims.push((tt) => { b.scale.setScalar(1 + Math.sin(tt * 2) * 0.35); b.position.y = 0.6 + ((tt * 0.5) % 1) * 0.9; }); } break;
      case "piano": pb(g, BX(1.5, 0.9, 1.2), pm(0x0d0d0d, 0, 0.2, 0.5), 0, 0.5, 0); pb(g, BX(1.4, 0.05, 0.4), pm(0xf5f5f5), 0, 0.97, 0.5); pb(g, BX(1.5, 0.05, 1), pm(0x0d0d0d, 0, 0.2, 0.5), 0, 1.5, -0.1).rotation.x = -0.5; break;
      case "ice": { const m = pb(g, new THREE.IcosahedronGeometry(0.5, 1), pm(c, 0.4, 0.05, 0.1, 0.65), 0, 1.1, 0); pb(g, CY(0.3, 0.7), pm(0x666666), 0, 0.35, 0); propAnims.push((tt) => { m.rotation.y = tt * 0.2; }); break; }
      case "bull": { const b = new THREE.Group(); b.position.y = 0.8; pb(b, new THREE.CapsuleGeometry(0.3, 0.8, 6, 12), pm(c), 0, 0, 0).rotation.z = 1.57; pb(b, SP(0.2), pm(c), 0.65, 0.1, 0); g.add(b); pb(g, CY(0.5, 0.6, 0.6), pm(0x333333), 0, 0.3, 0); propAnims.push((tt) => { b.rotation.z = Math.sin(tt * 3) * 0.25; b.rotation.x = Math.sin(tt * 2.3) * 0.2; }); break; }
      case "fire": pb(g, BX(1.6, 1.2, 0.5), pm(0x4a3a2a, 0, 0.9, 0), 0, 0.6, 0); { const f = pb(g, new THREE.ConeGeometry(0.3, 0.7, 8), pm(0xff7a20, 2.4, 0.5, 0, 0.9), 0, 0.5, 0.15); propAnims.push((tt) => { f.scale.set(1, 0.8 + Math.sin(tt * 14) * 0.2 + Math.random() * 0.1, 1); }); } break;
      case "valve": pb(g, CY(0.05, 1), pm(0x888888), 0, 0.5, 0); { const w = pb(g, new THREE.TorusGeometry(0.2, 0.03, 8, 16), pm(c, 0.2), 0, 1.05, 0); w.rotation.x = Math.PI / 2; } break;
      case "chand": { const ch = new THREE.Group(); ch.position.y = 5.3; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; pb(ch, SP(0.07), pm(c, 2.2, 0.1, 0.1, 0.9), Math.cos(a) * 0.6, -0.1 - (i % 3) * 0.2, Math.sin(a) * 0.6); } pb(ch, SP(0.14), pm(c, 2.6), 0, -0.2, 0); pb(ch, CY(0.01, 0.8), pm(0xcccccc), 0, 0.4, 0); g.add(ch); propAnims.push((tt) => { ch.rotation.y = tt * 0.3; }); break; }
      case "tower": for (let i = 0; i < 4; i++) for (let k = 0; k < 4 - i; k++) pb(g, CY(0.07, 0.18, 0.05), pm(c, 0.7, 0.1, 0, 0.8), (k - (3 - i) / 2) * 0.2, 0.2 + i * 0.2, 0); pb(g, CY(0.4, 0.15), pm(0x222222), 0, 0.07, 0); break;
      case "statue": pb(g, BX(0.6, 0.5, 0.6), pm(0x222222), 0, 0.25, 0); pb(g, new THREE.CapsuleGeometry(0.22, 0.9, 6, 12), pm(c, 0.2, 0.25, 0.9), 0, 1.1, 0); pb(g, SP(0.2), pm(c, 0.2, 0.25, 0.9), 0, 1.85, 0); break;
      case "fountain": pb(g, CY(0.7, 0.3), pm(0xdddddd, 0, 0.2, 0.1), 0, 0.15, 0); pb(g, CY(0.3, 0.7, 0.2), pm(0xdddddd), 0, 0.6, 0); { const w = pb(g, new THREE.ConeGeometry(0.4, 0.6, 12, 1, true), pm(c, 0.8, 0.1, 0, 0.5), 0, 1.2, 0); propAnims.push((tt) => { w.scale.y = 0.9 + Math.sin(tt * 4) * 0.1; }); } break;
      case "tramp": pb(g, CY(0.8, 0.05), pm(0x111111, 0, 0.5), 0, 0.5, 0); pb(g, CY(0.9, 0.04, 0.9), pm(c, 0.3), 0, 0.46, 0); for (let i = 0; i < 4; i++) pb(g, CY(0.04, 0.5), pm(0x888888), Math.cos(i * 1.57) * 0.7, 0.25, Math.sin(i * 1.57) * 0.7); break;
      case "harp": for (let i = 0; i < 8; i++) { const l = pb(g, CY(0.008, 1.8), pm(c, 3, 0.2, 0, 0.8), -0.5 + i * 0.14, 1.1, 0); propAnims.push((tt) => { l.visible = Math.sin(tt * 6 + i * 1.7) > -0.6; }); } pb(g, BX(1.3, 0.08, 0.1), pm(0x222222), 0, 0.1, 0); break;
      case "rig": for (let i = 0; i < 5; i++) pb(g, CY(0.07, 0.7), pm(i % 2 ? 0xcc4422 : 0x2244cc), -0.4 + i * 0.2, 0.35, 0); pb(g, BX(1.2, 0.08, 0.3), pm(0x222222), 0, 0.05, 0); break;
      case "pole": pb(g, CY(0.035, 3.2), pm(c, 0.2, 0.15, 1), 0, 1.6, 0); pb(g, CY(0.22, 0.05), pm(c, 0.2, 0.15, 1), 0, 0.03, 0); break;
      case "tub": pb(g, CY(0.8, 0.7), pm(0xeeeeee, 0, 0.3), 0, 0.35, 0); pb(g, CY(0.7, 0.05), pm(c, 1.1, 0.1, 0, 0.7), 0, 0.68, 0); { const st = pb(g, SP(0.25), pm(0xffffff, 0.3, 0.9, 0, 0.25), 0, 1.0, 0); propAnims.push((tt) => { st.position.y = 0.9 + ((tt * 0.4) % 1) * 0.8; st.scale.setScalar(0.6 + ((tt * 0.4) % 1)); }); } break;
      case "loo": pb(g, BX(0.5, 0.4, 0.6), pm(c, 0.3, 0.15, 1), 0, 0.2, 0); pb(g, BX(0.5, 0.6, 0.2), pm(c, 0.3, 0.15, 1), 0, 0.7, -0.25); break;
      case "ball": { const bl = pb(g, new THREE.IcosahedronGeometry(0.9, 2), new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: 0.1, flatShading: true, emissive: 0x444466, emissiveIntensity: 0.5 }), 0, 4.8, 0); pb(g, CY(0.01, 1.4), pm(0xcccccc), 0, 5.7, 0); propAnims.push((_t, dt) => { bl.rotation.y += dt * 0.8; }); break; }
      case "cashfount": { pb(g, CY(0.7, 0.3), pm(0x333333), 0, 0.15, 0); pb(g, new THREE.ConeGeometry(0.3, 0.9, 10), pm(c, 0.6), 0, 0.75, 0); let cd = 0; propAnims.push((_t, dt) => { cd += dt; if (cd > 0.12) { cd = 0; const w = g.getWorldPosition(new THREE.Vector3()); spawn("bill", w.x, 1.4, w.z, rnd(-0.8, 0.8), rnd(1, 2.4), rnd(-0.8, 0.8), colOf("#7dcf94"), 5, 40); } }); break; }
      case "car": pb(g, BX(2.2, 0.5, 1), pm(c, 0.1, 0.2, 0.8), 0, 0.5, 0); pb(g, BX(1.1, 0.4, 0.9), pm(c, 0.1, 0.2, 0.8, 0.9), -0.1, 0.9, 0); for (const [x, z] of [[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]]) pb(g, CY(0.22, 0.15), pm(0x111111), x, 0.22, z).rotation.x = Math.PI / 2; break;
      case "skull": { const sk = pb(g, new THREE.IcosahedronGeometry(0.4, 2), pm(c, 1.4, 0.05, 0.1, 0.8), 0, 1.4, 0); propAnims.push((tt) => { sk.rotation.y = tt * 0.6; sk.position.y = 1.4 + Math.sin(tt * 1.4) * 0.12; }); pb(g, CY(0.35, 0.8), pm(0x222222), 0, 0.4, 0); break; }
      case "shooter": pb(g, BX(0.7, 0.25, 0.7), pm(0x222222, 0, 0.4, 0.6), 0, 0.125, 0); pb(g, CY(0.13, 1.0, 0.09), pm(c, 0.6, 0.3, 0.5), 0, 0.75, 0).rotation.z = 0.45; pb(g, SP(0.17), pm(c, 1.2), 0, 0.3, 0); break;
      case "throne": for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) pb(g, BX(0.55, 0.13, 0.4), pm(i % 2 ? 0x7dcf94 : 0x5fb87a, 0.2), (k - 1) * 0.58, 0.07 + i * 0.14, 0); pb(g, BX(1.8, 0.2, 0.7), pm(c, 0.2, 0.2, 1), 0, 0.95, 0); pb(g, BX(1.8, 1.0, 0.15), pm(c, 0.2, 0.2, 1), 0, 1.5, -0.3); break;
      default: pb(g, BX(0.7, 0.8, 0.7), pm(c, 0.3), 0, 0.4, 0);
    }
    return g;
  };
  const makeHost = (i: number): Npc => { const n = mkNpc("bartender", 8.7, 0, 0, -Math.PI / 2, "Host"); n.base.set(8.7, 0, 4.2 + (i - 2.5) * 0.75); n.pos.copy(n.base); n.m.root.position.copy(n.base); return n; };
  const setProps = (owned: Owned): void => {
    propGroup.clear(); propAnims.length = 0; shooters.length = 0; agg = aggregate(owned); extStock = Math.floor(agg.extinguish);
    PROPS.forEach((p, i) => { const n = owned[p.id] ?? 0; if (!n || p.kind === "host") return; const sl = pslots[i % Math.max(1, pslots.length)]; if (!sl) return; for (let c = 0; c < Math.min(3, n); c++) { const m = buildProp(p.kind, p.color); m.position.set(sl.x + c * 0.55, 0, sl.z + c * 0.15); m.rotation.y = (sl.x > 0 ? -0.4 : 0.4) + Math.PI * (sl.z > 2 ? 1 : 0); m.scale.setScalar(1 + Math.min(3, n - 1) * 0.06); propGroup.add(m); if (p.shoot) shooters.push({ s: p.shoot, pos: new THREE.Vector3(m.position.x, 1.2, m.position.z), t: rnd(0, p.shoot.every), col: new THREE.Color(p.shoot.ammo === "bill" ? 0x7dcf94 : p.shoot.ammo === "coin" ? 0xf6b62c : p.color), n }); } });
    const want = Math.min(6, Math.round(agg.hosts)); while (hostNpcs.length < want) hostNpcs.push(makeHost(hostNpcs.length)); hostNpcs.forEach((h, i) => { h.m.root.visible = i < want; });
  };

  const sink = {
    take(k: string, x: number, y: number, n: number, op: EmitOpts): boolean {
      const kind: Bit["k"] | "" = k === "bill" ? "bill" : k === "coin" ? "coin" : k === "confetti" || k === "petal" ? "conf" : k === "feather" ? "feather" : ""; if (!kind) return false;
      const reduce = !!reduceMq?.matches; if (reduce && kind === "conf" && Math.random() < 0.6) return true;
      const cols = (op.cols && op.cols.length ? op.cols : kind === "coin" ? ["#f6b62c"] : kind === "bill" ? ["#7dcf94"] : ["#c74d57", "#f6b62c", "#7b2cff", "#1fd1b8", "#f6f4f3", "#3d8bff"]);
      for (let i = 0; i < n; i++) {
        const c = colOf(cols[Math.floor(Math.random() * cols.length)]);
        if (y < 80) spawn(kind, rnd(-7, 7), TRUSS_Y - 0.3 + rnd(0, 0.6), rnd(-3.4, 4), rnd(-0.5, 0.5), rnd(-0.6, 0), rnd(-0.5, 0.5), c, kind === "bill" ? 2 : 1, 60);
        else if (y > 400) spawn(kind, ((x - 480) / 480) * 3, 1.0, 6.8, rnd(-3, 3), rnd(5, 9), -rnd(4, 8), c, kind === "bill" ? 5 : 2, 60);
        else { const w = worldOf(x, y, STAGE_Y + 1.2); spawn(kind, w.x, w.y, w.z, ((op.vx ?? 0) + rnd(-1, 1) * (op.sx ?? 40)) / 70, -((op.vy ?? 0) + rnd(-1, 1) * (op.sy ?? 40)) / 70, rnd(-1, 1), c, kind === "bill" ? 2 : 1, 60); }
      }
      return true;
    },
    creature(k: string, secs: number): boolean {
      const dir = Math.random() < 0.5 ? 1 : -1, g = makeCritter(k), z = k === "chicken" ? 0.4 : k === "pigeon" ? 0 : k === "ghost" ? 3.4 : k === "flamingo" ? 5.2 : 4.8;
      critters.push({ k, g, until: nowT + secs, dir, x: dir > 0 ? -10 : 10, z, age: 0, take: 0 });
      if (k === "ghost") o.news("PATRON|Did the temperature just drop, or is that my bank balance?");
      return true;
    },
    note(k: string, n: number): void { if (k === "rocket") heat += 0.12 * n; },
  };

  const knock = (x: number, z: number, r: number): number => { let n = 0; for (const s of stools) { const wx = -9.4 + 1.85, wz = 1.6 + s.g.position.z; if (s.tilt === 0 && Math.hypot(wx - x, wz - z) < r) { s.tilt = 1; s.until = nowT + 22; n++; } } return n; };

  // ------------------------------------------------------------------ per-frame behaviour
  const seat = (m: Mosaic, bob: number, t: number): void => { const r = m.rig; r.hips.position.y = 0.56 + bob; r.legL.hipJoint.rotation.x = -1.5; r.legR.hipJoint.rotation.x = -1.5; r.legL.knee.rotation.x = 1.5; r.legR.knee.rotation.x = 1.5; r.chest.rotation.y = Math.sin(t * 0.4) * 0.1; };
  const armsUp = (m: Mosaic, a = 0): void => { m.rig.armL.shoulder.rotation.set(-2.6 + a, 0, 0.3); m.rig.armR.shoulder.rotation.set(-2.6 - a, 0, -0.3); };
  const cower = (m: Mosaic): void => { const r = m.rig; r.hips.position.y = 0.78; r.chest.rotation.x = 0.55; r.armL.shoulder.rotation.set(-2.5, 0, 0.5); r.armR.shoulder.rotation.set(-2.5, 0, -0.5); r.armL.elbow.rotation.x = -1.9; r.armR.elbow.rotation.x = -1.9; r.legL.hipJoint.rotation.x = -0.5; r.legR.hipJoint.rotation.x = -0.5; r.legL.knee.rotation.x = 1; r.legR.knee.rotation.x = 1; };
  const run = (m: Mosaic, t: number): void => { const r = m.rig, s = Math.sin(t * 11); r.legL.hipJoint.rotation.x = s * 0.9; r.legR.hipJoint.rotation.x = -s * 0.9; r.legL.knee.rotation.x = Math.max(0, -s) * 1.3; r.legR.knee.rotation.x = Math.max(0, s) * 1.3; r.armL.shoulder.rotation.x = -s * 0.9; r.armR.shoulder.rotation.x = s * 0.9; r.chest.rotation.x = 0.2; r.hips.position.y = 0.92 + Math.abs(s) * 0.05; };

  function frame(f: Frame): void {
    const dt = Math.min(0.05, f.dt) * (f.fx.slowmo > 0 ? 0.4 : 1), reduce = f.reduce; nowT = f.t; elapsed += dt;
    const w = el.clientWidth, h = el.clientHeight; if (w && h && (w !== lastW || h !== lastH)) { lastW = w; lastH = h; renderer.setSize(w, h, false); composer.setSize(w, h); bloom?.setSize(w / 2, h / 2); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const fx = f.fx, bpm = 112 + f.hype * 30, bpmK = bpm / 118; phase += dt * (bpm / 60) * Math.PI; const beat = Math.pow(Math.abs(Math.sin(phase)), 4);
    // camera: tween, cinematic orbit, shake
    if (tween) { tween.k = Math.min(1, tween.k + dt * 1.8); const e = 1 - Math.pow(1 - tween.k, 3); camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); if (tween.k >= 1) tween = null; }
    else if (cine) { const a = elapsed * 0.2; camera.position.set(Math.sin(a) * 9, 3 + Math.sin(elapsed * 0.4) * 0.6, Math.cos(a) * 8 + 1); controls.target.set(0, 1.6, 0.6); }
    if (carryGun.active) carryGun.update(dt, f.t); else controls.update(); const sh = !reduce && fx.shake > 0 ? fx.shake * 0.08 : 0; if (sh) camera.position.add(v3.set(rnd(-sh, sh), rnd(-sh, sh), 0));

    // ---- consequences: heat, scorch, sprinklers
    const flaming = fx.flames > 0; if (flaming) { heat += dt * 0.15; flameOn += dt; } if (heat < 0.8) heat += dt * agg.heat * 0.012; heat = Math.max(0, heat - dt * (0.05 + agg.cool * 0.05));
    jets.forEach((g, i) => { g.visible = flaming; if (flaming) { const k = 0.7 + Math.random() * 0.5; g.scale.set(1, k * Math.min(1, fx.flames), 1); scorchAmt[i] = Math.min(0.75, scorchAmt[i] + dt * 0.18); } (scorch[i].material as THREE.MeshBasicMaterial).opacity = scorchAmt[i]; });
    flameLight.intensity = flaming ? 14 + Math.random() * 6 : 0;
    if (alarm <= 0 && heat >= 1.0 && extStock > 0) { extStock--; heat = 0.3; o.news("BOUNCER|Extinguisher! Whoever bought that: good. Hold it like you mean it."); } else if (alarm <= 0 && heat >= 1.0) { alarm = 9; wetUntil = f.t + 45; heat = 0.25; alarmNews = true; o.news("MC|That's the sprinklers! Everybody out! Orderly! Not you, Gary, you can't run.||BOUNCER|Told you. Indoor fireworks. Nobody listens to the bouncer."); }
    if (alarm > 0) { alarm -= dt; for (const k of ["bill", "coin", "conf"] as const) for (const b of pools[k].items) b.wet = true; if (alarm <= 0 && alarmNews) { alarmNews = false; o.news("BARTENDER|Floor's slippery. And the tips are soggy. Soggy tips still count."); } }
    const wet = f.t < wetUntil; marble.roughness = wet ? 0.03 : 0.16; carpet.color.set(wet ? 0x777777 : ((carpet.userData.tint as number | undefined) ?? 0xffffff));
    drops.l.visible = alarm > 0; if (alarm > 0) { const pos = drops.l.geometry.attributes.position as THREE.BufferAttribute; drops.xs.forEach((d, i) => { d[1] -= dt * 11; if (d[1] < 0) d[1] = 6.2; pos.setXYZ(i * 2, d[0], d[1], d[2]); pos.setXYZ(i * 2 + 1, d[0], d[1] - 0.35, d[2]); }); pos.needsUpdate = true; }
    // ---- lightning: a bolt, a flash, and sometimes a dead spotlight
    if (fx.bolt > 0 && prevBolt <= 0) {
      const bx = ((fx.boltX - 480) / 480) * 4, pts: THREE.Vector3[] = []; let x = bx, y = TRUSS_Y; while (y > STAGE_Y) { pts.push(new THREE.Vector3(x, y, 0.8)); x += rnd(-0.4, 0.4); y -= rnd(0.4, 0.8); } pts.push(new THREE.Vector3(x, STAGE_Y, 0.8));
      if (boltMesh) scene.remove(boltMesh); boltMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe6ebff })); scene.add(boltMesh); boltT = 0.35;
      if (Math.random() < 0.7) { const s = spots[Math.floor(Math.random() * spots.length)]; s.dead = 25; o.news("DJ|Well, that's one spotlight gone. The other five are judging it."); }
    }
    prevBolt = fx.bolt; if (boltMesh) { boltT -= dt; if (boltT <= 0) { scene.remove(boltMesh); boltMesh = null; } }
    // ---- lighting rig
    const blackOn = fx.blackout > 0 && !(fx.strobe > 0 || Math.floor(f.t * 9) % 5 === 0), strobeOn = fx.strobe > 0 && (reduce ? true : Math.floor(f.t * 14) % 2 === 0);
    const lightsOut = fx.blackout > 0 ? (blackOn ? 0.03 : 0.35) : 1, sweep = fx.kaleido > 0 ? 3 : 1;
    ambient.intensity = (1.9 * lightsOut + agg.glow * 0.5) + (fx.uv > 0 ? 0.5 : 0) + (alarm > 0 ? 0.3 : 0); if (fx.uv > 0) ambient.color.set(0x5a14c8); else if (ghostSpook > 0) ambient.color.set(0x3a5a8a); else ambient.color.copy(accentC).multiplyScalar(0.55);
    spots.forEach((s, i) => {
      s.pivot.rotation.x = Math.sin(elapsed * 0.65 * sweep + s.phase) * 0.34 * (fx.kaleido > 0 ? 1.8 : 1); s.pivot.rotation.z = Math.cos(elapsed * 0.5 * sweep + s.phase) * 0.28 * (fx.kaleido > 0 ? 1.8 : 1);
      const c = alarm > 0 ? (Math.floor(f.t * 4) % 2 ? tmpC.set(0xff1010) : tmpC.set(0xffffff)) : fx.wash > 0 || fx.kaleido > 0 ? hue.setHSL(((f.t * 0.25 + i / 6) % 1), 0.9, 0.55) : beams[i % beams.length];
      s.light.color.copy(c);
      let inten = (22 + beat * 12) * lightsOut; if (strobeOn) inten = 40; if (s.dead > 0) { s.dead -= dt; inten = Math.random() < 0.15 && !reduce ? 30 : 0; } s.light.intensity = inten;
      setBeam(s.cone, c, (0.2 + beat * 0.1 + fx.fog * 0.12) * (inten > 0 ? 1 : 0) * (lightsOut > 0.5 ? 1 : 0.3));
      s.cone.visible = true;
    });
    fill.intensity = (7 + beat * 2) * lightsOut; led.emissiveIntensity = (1.6 + beat * 1.5) * (blackOn ? 1.5 : 1); flash.intensity = (fx.flash > 0 ? Math.min(60, fx.flash * 90) : 0) + (boltT > 0 ? 120 : 0) + (strobeOn ? 25 : 0);
    // follow spot
    follow.intensity = fx.spot > 0 ? 60 : 0; if (fx.spot > 0) { let best = dancers[0], bd = 1e9; for (const d of dancers) { if (!d.m.root.visible) continue; const p = toPt(d.m.root.position); const q = Math.abs(p.x - fx.spotX); if (q < bd) { bd = q; best = d; } } if (best) followT.position.set(best.m.root.position.x, best.m.root.position.y + 1, best.m.root.position.z); }
    // lasers, ball
    lasers.forEach((m, k) => { m.visible = fx.lasers > 0; if (fx.lasers > 0) { m.rotation.z = Math.sin(f.t * 1.7 + k) * 0.7 + (k - 4) * 0.12; m.rotation.x = Math.cos(f.t * 1.3 + k * 0.7) * 0.5 - 0.3; } });
    ball.visible = fx.disco > 0; if (ball.visible) { ball.rotation.y += dt * 0.9; ball.position.y = 7.6 - Math.min(1, (10 - fx.disco) / 1.5) * 1.6; ball.scale.setScalar(1); }
    // fog
    const baseFog = Math.max(0.018, 0.04 + (f.smoke ? 0.006 : 0) + Math.min(1, fx.fog) * 0.02 + (alarm > 0 ? 0.01 : 0) + agg.fog * 0.005 - agg.fan * 0.004); (scene.fog as THREE.FogExp2).density += (baseFog - (scene.fog as THREE.FogExp2).density) * Math.min(1, dt * 2);
    dust.rotation.y = elapsed * 0.025; barLight.intensity = 3 * lightsOut;
    // dj kit
    eq.forEach((e) => { e.mesh.scale.y = 0.18 + Math.abs(Math.sin(phase * 1.5 + e.ph)) * 0.85 * (0.65 + beat * 0.5); }); woofers.forEach((c) => { c.position.z = 0.71 + beat * 0.035; });
    mainSign.visible = !blackOn;

    // ---- dancers
    const vis = dancers.filter((d) => !(d.needsStage && !f.big)); const calmK = agg.calm >= 3, fear = !calmK && (fx.bolt > 0 || blackOn || ghostSpook > 0);
    dancers.forEach((d) => { d.m.root.visible = !(d.needsStage && !f.big); });
    vis.forEach((d, idx) => {
      const info = f.dancers.find((q) => q.name === d.m.name); const m = d.m; resetPose(m); m.root.position.copy(d.slot);
      let routine = d.routine, ox = 0, oz = 0, strut = false;
      if (f.showing) { routine = "clubFreestyle"; ox = -3.6 + idx * (7.2 / Math.max(1, vis.length - 1)) - d.slot.x; oz = 0.55 - d.slot.z; }
      else if (d.m.name === o.roster[1]?.name && f.catwalkU >= 0) { strut = true; routine = "hipSway"; ox = -d.slot.x; oz = -0.2 + f.catwalkU * 4.3 - d.slot.z; }
      const boost = info?.boost ?? "";
      if (d.dance !== -1 && !strut && !f.showing) applyDance(m, d.dance === -2 ? autoMove(d.m.name, elapsed) : d.dance, phase + idx * 0.7, bpmK * (fx.slowmo > 0 ? 0.4 : 1)); else applyRoutine(m, routine, f.showing ? phase : phase + idx * 0.7, elapsed, bpmK * (fx.slowmo > 0 ? 0.4 : 1), d.pole && !f.showing && !strut && routine === "poleSpin");
      m.root.position.x += ox; m.root.position.z += oz;
      if (strut) { const s = Math.sin(elapsed * 6); m.rig.legL.hipJoint.rotation.x = s * 0.5; m.rig.legR.hipJoint.rotation.x = -s * 0.5; m.root.rotation.y = 0; }
      if (f.showing && f.showIndex % 3 === 1) { const o2 = OUTFITS[(f.showIndex + idx + Math.floor(f.showT / 7)) % OUTFITS.length]; if (m.outfitId !== o2.id) applyOutfit(m, o2.id); } else if (m.outfitId !== d.outfit && !boost.startsWith("cost")) applyOutfit(m, d.outfit, fx.uv > 0 ? 1.2 : 0);
      if (fx.uv > 0) m.outfit.emissiveIntensity = Math.max(m.outfit.emissiveIntensity, 1.1);
      if (boost === "spin") { m.root.rotation.y += elapsed * 10; armsUp(m); d.hop = Math.max(d.hop, 0.25); }
      else if (boost === "kiss") { m.rig.armR.shoulder.rotation.set(-1.9, 0, -0.3); m.rig.armR.elbow.rotation.x = -1.4; m.rig.head.rotation.z = 0.15; }
      else if (boost === "bow") { m.rig.hips.rotation.x = 0.5; m.rig.chest.rotation.x = 0.7; }
      else if (boost === "jump") d.hop = Math.max(d.hop, 0.35); else if (boost === "pole" && d.pole) { m.rig.hips.position.y += Math.sin(elapsed * 6) * 0.1; }
      // tipped: a hop, and a scoop at the floor
      if (info && info.hit > 0) { d.scoop = Math.max(d.scoop, info.hit); } d.scoop = Math.max(0, d.scoop - dt * 0.9); d.hop = Math.max(0, d.hop - dt * 1.2);
      if (d.scoop > 0 && !f.showing && routine !== "poleSpin") { const s = Math.min(1, d.scoop * 2); m.rig.chest.rotation.x += 0.7 * s; m.rig.armR.shoulder.rotation.set(-0.3 - 1.4 * s, 0, -0.2); m.rig.hips.position.y -= 0.08 * s; }
      m.rig.hips.position.y += Math.abs(Math.sin(d.hop * 12)) * d.hop * 0.4;
      // hit by a carried shot: thrown back along the line of fire, dropped at the knees, then she gets her feet back
      if (d.recoil > 0) { const k = d.recoil; m.root.position.x += d.rdx * 0.34 * k; m.root.position.z += d.rdz * 0.34 * k; m.rig.hips.position.y -= 0.14 * k; if (m.bb) m.bb.sprite.material.rotation = d.rdx * 0.32 * k * (Math.sin(f.t * 40) > 0 ? 1 : 0.7); d.recoil = Math.max(0, d.recoil - dt * 1.5); } else if (m.bb && m.bb.sprite.material.rotation !== 0) m.bb.sprite.material.rotation = 0;
      if (fear) { m.rig.armL.shoulder.rotation.set(-2.5, 0, 0.5); m.rig.armR.shoulder.rotation.set(-2.5, 0, -0.5); m.rig.armL.elbow.rotation.x = -1.8; m.rig.armR.elbow.rotation.x = -1.8; }
      if (wet && Math.floor(f.t) % 9 === idx) { m.rig.hips.rotation.z += Math.sin(elapsed * 14) * 0.12; }
      // a tipped dancer picks up what is near her
      if (d.scoop > 0.2) { const got = takeNear(m.root.position.x, m.root.position.z, 0.9, 3); if (got > 0) sweptTotal += got; }
    });

    // ---- crowd
    const crowd = f.crowd, hype = f.hype, flee = alarm > 0, spook = !calmK && (fx.bolt > 0 || blackOn || ghostSpook > 0);
    patrons.forEach((p, i) => {
      const m = p.m, r = m.rig; resetPose(m); const tgt = p.base.clone(); let st = "idle"; const t = f.t;
      if (flee) { st = "flee"; tgt.copy(EXIT); tgt.x += rnd(-0.4, 0.4) * 0 + (i % 3) * 0.3; tgt.z += (i % 4) * 0.35 - 0.5; }
      else if (spook) st = "cower";
      else if (crowd === "conga") { st = "conga"; const u = (t * 0.7 + i * 0.16) % TAU; tgt.set(Math.cos(u) * 6.2, 0, 4.6 + Math.sin(u) * 2.2); }
      else if (crowd === "mosh") { st = "mosh"; tgt.x += Math.sin(t * 9 + p.ph * 3) * 0.45; tgt.z += Math.cos(t * 7 + p.ph) * 0.35; }
      else if (crowd === "drunk") { st = "drunk"; tgt.x += Math.sin(t * 1.3 + p.ph) * 0.5; if (i === Math.floor(t / 9) % 9 && t % 9 > 3 && t % 9 < 6.5) st = "fall"; }
      else if (crowd === "wave" || crowd === "chant" || crowd === "cheer") st = crowd; else if (hype > 0.3) st = "hype";
      critters.forEach((c) => { if (c.k === "flamingo" && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 1.8) { tgt.x += Math.sign(p.pos.x - c.x || 1) * 1.3; st = "dodge"; } if (c.k === "ghost" && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 3) { st = "cower"; } });
      const before = p.pos.clone(); p.pos.lerp(tgt, 1 - Math.exp(-dt * (st === "flee" ? 1.8 : st === "conga" ? 4 : 5))); m.root.position.copy(p.pos);
      const moving = p.pos.distanceTo(before) / Math.max(dt, 1e-3) > 0.8; if (moving) m.root.rotation.y = Math.atan2(p.pos.x - before.x, p.pos.z - before.z) + (st === "flee" || st === "conga" ? 0 : 0); else m.root.rotation.y = p.face;
      const ph = p.ph, tt = t; p.st = st;
      if (st === "flee") run(m, tt + ph); else if (st === "cower") cower(m);
      else if (st === "cheer" || st === "hype") { armsUp(m, Math.sin(tt * 6 + ph) * 0.3); r.hips.position.y = 0.94 + Math.abs(Math.sin(tt * 5 + ph)) * 0.07 * (0.4 + hype); }
      else if (st === "chant") { r.armL.shoulder.rotation.set(-2.2 + Math.sin(tt * 6 + ph) * 0.45, 0, 0.3); r.armR.shoulder.rotation.set(-2.2 + Math.sin(tt * 6 + ph) * 0.45, 0, -0.3); r.hips.position.y = 0.94 + Math.abs(Math.sin(tt * 6 + ph)) * 0.05; }
      else if (st === "wave") { if (Math.sin(tt * 3 - p.base.x * 0.35) > 0.2) { armsUp(m); r.hips.position.y = 1.0; } }
      else if (st === "mosh") { r.armL.shoulder.rotation.set(-1, 0, 0.8); r.armR.shoulder.rotation.set(-1, 0, -0.8); r.hips.position.y = 0.92 + Math.abs(Math.sin(tt * 11 + ph)) * 0.12; r.hips.rotation.y = Math.sin(tt * 9 + ph) * 0.5; r.legL.hipJoint.rotation.x = Math.sin(tt * 11) * 0.5; r.legR.hipJoint.rotation.x = -Math.sin(tt * 11) * 0.5; }
      else if (st === "conga") { r.hips.rotation.y = Math.sin(tt * 7 + ph) * 0.3; r.armL.shoulder.rotation.set(-0.3, 0, 0.9); r.armR.shoulder.rotation.set(-0.3, 0, -0.9); r.armL.elbow.rotation.x = -1.6; r.armR.elbow.rotation.x = -1.6; r.legL.hipJoint.rotation.x = Math.sin(tt * 7 + ph) * 0.6; r.legR.hipJoint.rotation.x = -Math.sin(tt * 7 + ph) * 0.6; r.hips.position.y = 0.94 + Math.abs(Math.sin(tt * 7 + ph)) * 0.05; }
      else if (st === "drunk") { r.spine.rotation.z = Math.sin(tt * 2 + ph) * 0.35; r.hips.rotation.z = Math.sin(tt * 1.6 + ph) * 0.2; r.head.rotation.z = Math.sin(tt * 2.4) * 0.3; r.armL.shoulder.rotation.set(Math.sin(tt * 2 + ph) * 0.6, 0, 0.5); r.armR.shoulder.rotation.set(-Math.sin(tt * 2 + ph) * 0.6, 0, -0.5); }
      else if (st === "fall") { m.root.rotation.x = -1.45; m.root.position.y = 0.16; }
      else if (st === "dodge") { r.spine.rotation.z = 0.3; r.armL.shoulder.rotation.set(-0.4, 0, 1.2); }
      else { r.hips.rotation.z = Math.sin(tt * 0.9 + ph) * 0.05; r.head.rotation.y = Math.sin(tt * 0.4 + ph) * 0.4; r.armL.shoulder.rotation.set(0, 0, 0.12); r.armR.shoulder.rotation.set(-0.5 - Math.sin(tt + ph) * 0.1, 0, -0.1); r.armR.elbow.rotation.x = -1.2; }
    });
    // staff
    { const t = f.t; let m = djN.m; resetPose(m); m.root.position.y = 0.9; m.rig.hips.position.y = 0.94 + beat * 0.03; m.rig.armL.shoulder.rotation.set(-1.1, 0, 0.1); m.rig.armR.shoulder.rotation.set(-1.1 + Math.sin(phase) * 0.3, 0, -0.1); m.rig.head.rotation.x = 0.15 + beat * 0.1; m.rig.head.rotation.z = Math.sin(phase * 0.5) * 0.15; if (spook) cower(m);
      m = bartender.m; resetPose(m); m.rig.armR.shoulder.rotation.set(-1.0, 0, -0.3 + Math.sin(t * 3) * 0.15); m.rig.armR.elbow.rotation.x = -1.2; m.rig.armL.shoulder.rotation.set(-0.8, 0, 0.3); m.rig.head.rotation.y = Math.sin(t * 0.5) * 0.5; if (flee || spook) cower(m);
      m = bouncer.m; resetPose(m); m.rig.armL.shoulder.rotation.set(-1.0, 0, -0.5); m.rig.armR.shoulder.rotation.set(-1.0, 0, 0.5); m.rig.armL.elbow.rotation.x = -1.9; m.rig.armR.elbow.rotation.x = -1.9; m.rig.head.rotation.y = Math.sin(t * 0.35) * 0.5;
      m = mc.m; resetPose(m); m.rig.armR.shoulder.rotation.set(-1.9, 0, -0.2); m.rig.armR.elbow.rotation.x = -1.5; m.rig.armL.shoulder.rotation.set(-0.5 + Math.sin(t * 2) * 0.4, 0, 0.7); m.rig.head.rotation.y = Math.sin(t * 0.6) * 0.3; if (flee || spook) cower(m);
      fam.forEach((n, i) => { const mm = n.m; resetPose(mm); seat(mm, beat * 0.01, t + i); mm.rig.armR.shoulder.rotation.set(-0.5, 0, -0.1); mm.rig.armR.elbow.rotation.x = -1.3; mm.rig.armL.shoulder.rotation.set(-0.2, 0, 0.15); mm.root.position.y = 0.0; if (spook) cower(mm); }); }
    hostNpcs.forEach((h, i) => { resetPose(h.m); h.m.rig.hips.position.y += Math.sin(f.t * 2 + i) * 0.01; h.m.root.rotation.y = -Math.PI / 2; });
    // ---- cleaner: arrives when the floor is a mess, sweeps, and the haul goes to the till
    const mess = costs(); const cm = cleaner.m;
    if (cleanState === 0 && mess > 90 && f.t > nextClean && alarm <= 0) { cleanState = 1; cm.root.visible = true; cleaner.pos.copy(EXIT); cleanT = 0; o.news("MC|Sweepers on! Mind your feet, the tips have been generous."); }
    if (cleanState > 0) {
      resetPose(cm); let tx = 0, tz = 0;
      if (cleanState === 1) { let sx = 0, sz = 0, n = 0; for (const it of [pools.bill.items, pools.coin.items]) for (const b of it) if (b.landed) { sx += b.x; sz += b.z; n++; } if (n) { tx = sx / n; tz = sz / n; } else cleanState = 3; if (Math.hypot(cleaner.pos.x - tx, cleaner.pos.z - tz) < 0.6) { cleanState = 2; cleanT = 0; } }
      if (cleanState === 2) { cleanT += dt; tx = cleaner.pos.x; tz = cleaner.pos.z; cm.rig.armR.shoulder.rotation.set(-1.0 + Math.sin(cleanT * 7) * 0.4, 0, -0.1); cm.rig.chest.rotation.x = 0.3; const got = takeNear(cleaner.pos.x, cleaner.pos.z, 2.6, 6); sweptTotal += got; if (cleanT > 5) cleanState = costs() > 15 ? 1 : 3; }
      if (cleanState === 3) { tx = EXIT.x; tz = EXIT.z; if (Math.hypot(cleaner.pos.x - tx, cleaner.pos.z - tz) < 0.5) { cleanState = 0; cm.root.visible = false; nextClean = f.t + 25; if (sweptTotal > 0) { o.news(`BARTENDER|Staff swept up $${Math.round(sweptTotal)} in tips tonight. The mop is unionised.`); o.swept(sweptTotal); sweptTotal = 0; } } }
      if (cleanState !== 2) { const dx = tx - cleaner.pos.x, dz = tz - cleaner.pos.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(d, dt * 2.2); cleaner.pos.x += (dx / d) * sp; cleaner.pos.z += (dz / d) * sp; cm.root.rotation.y = Math.atan2(dx, dz); run(cm, elapsed * 0.5); }
      cm.root.position.copy(cleaner.pos); cm.root.position.y = surfaceY(cleaner.pos.x, cleaner.pos.z);
    }
    // ---- critters and mischief
    for (let i = critters.length - 1; i >= 0; i--) {
      const c = critters[i]; c.age += dt; const speed = c.k === "raccoon" ? 3.4 : c.k === "chicken" ? 1.6 : c.k === "flamingo" ? 1.1 : c.k === "ghost" ? 1.4 : 5;
      c.x += c.dir * speed * dt; if (Math.abs(c.x) > 8.5 && c.age > 1) c.dir *= -1;
      let y = 0; const g = c.g;
      if (c.k === "raccoon") { c.z = 4.8 + Math.sin(c.age * 1.3) * 1.4; g.position.set(c.x, 0, c.z); g.rotation.y = c.dir > 0 ? 0 : Math.PI; const got = takeNear(c.x, c.z, 0.7, 2); if (got > 0) { c.take += got; stoleTotal += got; } if (knock(c.x, c.z, 0.9) > 0) o.news("BARTENDER|He's knocked over the stools! He's got my tip jar! That's MY tip jar!"); }
      else if (c.k === "chicken") { c.z = 0.4 + Math.sin(c.age * 0.9) * 1.6; y = STAGE_Y + Math.abs(Math.sin(c.age * 9)) * 0.06; g.position.set(c.x * 0.5, y, c.z); g.rotation.y = c.dir > 0 ? 0 : Math.PI; const got = takeNear(g.position.x, c.z, 0.6, 2); if (got > 0) c.take += got; if (Math.random() < dt * 2) spawn("feather", g.position.x, y + 0.3, c.z, rnd(-0.5, 0.5), 0.5, rnd(-0.5, 0.5), colOf("#f6f4f3"), 0, 20); dancers.forEach((d) => { if (Math.hypot(d.m.root.position.x - g.position.x, d.m.root.position.z - c.z) < 1.2) d.hop = Math.max(d.hop, 0.3); }); }
      else if (c.k === "flamingo") { g.position.set(c.x, 0, c.z); g.rotation.y = c.dir > 0 ? 0 : Math.PI; g.rotation.z = Math.sin(c.age * 1.5) * 0.06; knock(c.x, c.z, 1.1); }
      else if (c.k === "pigeon") { const a = c.age * 1.4; g.position.set(Math.cos(a) * 4.5, 4.6 + Math.sin(a * 2) * 0.4, 1 + Math.sin(a) * 3.5); g.rotation.y = -a; if (Math.random() < dt * 4) spawn("feather", g.position.x, g.position.y, g.position.z, rnd(-0.3, 0.3), -0.2, rnd(-0.3, 0.3), colOf("#cfd5e0"), 0, 12); }
      else { ghostSpook = 0.4; c.z = 3.4 + Math.sin(c.age * 0.6) * 2.4; g.position.set(c.x, 0.2 + Math.sin(c.age * 2) * 0.2, c.z); g.rotation.y = Math.sin(c.age) * 0.4; spots.forEach((s, k) => { if (k % 2 === 0 && !reduce) s.light.intensity *= 0.35 + 0.65 * Math.abs(Math.sin(f.t * 9 + k)); }); }
      if (f.t > c.until) { if (c.take > 0) o.news(`${c.k === "raccoon" ? "BOUNCER" : "MC"}|${c.k === "raccoon" ? "The raccoon left with" : "Doris pecked up"} $${Math.round(c.take)}. ${c.k === "raccoon" ? "He had a nice jacket and no receipts." : "She's declared it as seed."}`); scene.remove(c.g); critters.splice(i, 1); }
    }
    ghostSpook = Math.max(0, ghostSpook - dt);
    stools.forEach((s) => { if (s.tilt && f.t > s.until) s.tilt = 0; s.g.rotation.z += ((s.tilt ? 1.45 : 0) - s.g.rotation.z) * Math.min(1, dt * 8); s.g.position.y = s.tilt ? 0.12 : 0; });
    void stoleTotal; void lightNews;

    // ---- props: passive effects and animation
    propAnims.forEach((fn) => fn(f.t, dt));
    if (!boothOn) for (const sh of shooters) {
      sh.t -= dt; if (sh.t > 0) continue; const sp0 = sh.s; sh.t = (sp0.every * (0.7 + Math.random() * 0.6)) / (1 + Math.min(3, sh.n - 1) * 0.15);
      const dx = -sh.pos.x * 0.5, dz = 2 - sh.pos.z, dl = Math.hypot(dx, dz) || 1;
      for (let i = 0; i < sp0.n; i++) { const sp = sp0.power * rnd(0.6, 1.1); spawn(sp0.ammo, sh.pos.x, sh.pos.y, sh.pos.z, (dx / dl) * sp * 0.7 + rnd(-1, 1) * sp0.spread, sp * rnd(0.5, 0.9), (dz / dl) * sp * 0.7 + rnd(-1, 1) * sp0.spread, sh.col, sp0.ammo === "bill" ? 5 : sp0.ammo === "coin" ? 10 : 0, sp0.ammo === "feather" ? 14 : sp0.ammo === "conf" ? 40 : 70, 1); }
    }
    vacT += dt * agg.vac * 1.2; while (vacT >= 1) { vacT -= 1; const it = pools.bill.items.filter((b) => b.landed); const b = it[Math.floor(Math.random() * it.length)]; if (b) { pools.bill.items.splice(pools.bill.items.indexOf(b), 1); o.swept(b.v * (1 + agg.cashmult * 0.5)); } }
    messT += dt * agg.mess * 0.6; while (messT >= 1) { messT -= 1; spawn("conf", rnd(-8, 8), 0.5, rnd(-3, 9), 0, 0, 0, colOf("#f6f4f3"), 0, 40); }
    // ---- cash and paper: the engine's gravity and drag, per material
    const g = GRAVITY * gravityScale;
    for (const k of ["bill", "coin", "conf", "feather"] as const) {
      const p = pools[k], mat = MATS[k], it = p.items; const drag = AIR_DRAG * mat.radius / Math.max(0.15, mat.mass);
      for (let i = it.length - 1; i >= 0; i--) {
        const b = it[i]; b.age += dt;
        if (!b.landed) {
          b.vy -= g * (1 - mat.lift) * dt; const sp = Math.hypot(b.vx, b.vy, b.vz), kd = Math.max(0, 1 - (drag + (mat.lift ? 1.2 : 0)) * Math.max(0.5, sp) * dt); b.vx *= kd; b.vz *= kd; b.vy = mat.lift ? Math.max(b.vy * kd, -1.6) : b.vy * kd;
          if (mat.lift) { b.vx += Math.sin(b.age * 5 + b.ph) * 0.9 * dt; b.vz += Math.cos(b.age * 4 + b.ph) * 0.9 * dt; }
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.x = clamp(b.x, -11.5, 11.5); b.z = clamp(b.z, -10.5, 10.5); b.ry += b.spin * dt;
          const sy = surfaceY(b.x, b.z) + 0.012;
          if (b.y <= sy && b.vy < 0) { if (mat.rest > 0.2 && Math.abs(b.vy) > 1) { b.vy = -b.vy * mat.rest; b.y = sy; b.vx *= 0.7; b.vz *= 0.7; } else { b.landed = true; b.y = sy + (k === "bill" ? Math.random() * 0.006 : 0); b.vx = b.vy = b.vz = 0; } }
        } else { if (b.age > b.life) { it.splice(i, 1); continue; } if (alarm > 0 || wet) b.wet = true; }
        const sc = b.landed && b.age > b.life - 3 ? Math.max(0, (b.life - b.age) / 3) : 1;
        dummy.position.set(b.x, b.y, b.z); if (b.landed) dummy.rotation.set(-Math.PI / 2, 0, b.ry); else dummy.rotation.set(Math.sin(b.age * 6 + b.ph) * 1.1, b.ry, Math.cos(b.age * 5 + b.ph) * 0.9);
        dummy.scale.setScalar(b.s * sc); dummy.updateMatrix(); p.mesh.setMatrixAt(i, dummy.matrix); tmpC.copy(b.c); if (b.wet) tmpC.multiplyScalar(0.45); p.mesh.setColorAt(i, tmpC);
      }
      p.mesh.count = it.length; p.mesh.instanceMatrix.needsUpdate = true; if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
    // the people are the Mosaics themselves, drawn by the game's figure renderer, lit by the room
    const lt = clamp(0.22 + 0.78 * lightsOut, 0.15, 1), tintC = alarm > 0 ? tmpC.setRGB(1, 0.55, 0.55) : fx.uv > 0 ? tmpC.setRGB(0.75, 0.5, 1) : (fx.wash > 0 || fx.kaleido > 0) ? hue.setHSL((f.t * 0.2) % 1, 0.5, 0.8) : tmpC.setRGB(1, 0.94, 0.96);
    const paintAll = (m: Mosaic, doing: string, fr: number, col: string | undefined, every: number): void => { paintBillboard(m, o.draw, f.t, doing, fr, col, every); const b = m.bb; if (!b) return; b.sprite.material.color.copy(tintC).multiplyScalar(lt); b.sprite.position.y = Math.max(-0.4, m.rig.hips.position.y - 0.94); b.sprite.material.rotation = m.root.rotation.x; };
    const fr = fear ? 0.7 : 0;
    for (const d of vis) { paintAll(d.m, d.recoil > 0.3 ? "hurt" : d.routine === "stagePose" ? "idle" : "dance", fr, d.m.outfitId === "own" ? undefined : "#" + d.m.outfit.color.getHexString(), d.recoil > 0.3 ? 0.03 : 0.07); if (d.recoil > 0 && d.m.bb) d.m.bb.sprite.material.color.setRGB(1, 1 - 0.55 * d.recoil, 1 - 0.55 * d.recoil); }
    for (const p of patrons) { const st = p.st; paintAll(p.m, ["cheer", "hype", "wave", "chant", "mosh", "conga", "drunk"].includes(st) ? "dance" : "idle", st === "cower" || st === "flee" ? 0.7 : 0, undefined, 0.14); }
    paintAll(djN.m, "dance", 0, undefined, 0.16); paintAll(bartender.m, "talk", 0, undefined, 0.16); paintAll(bouncer.m, "idle", 0, undefined, 0.2); paintAll(mc.m, "talk", 0, undefined, 0.16); fam.forEach((n) => paintAll(n.m, "sit", 0, undefined, 0.25)); if (cleaner.m.root.visible) paintAll(cleaner.m, "idle", 0, undefined, 0.14);
    hostNpcs.forEach((h) => paintAll(h.m, "talk", 0, undefined, 0.22));
    // the booth scene: the Famiglia step out, the dancer sways beside the seat (side to side for the partner dance)
    fam.forEach((n) => { n.m.root.visible = !boothOn || (boothKind === "bottles" || boothKind === "spray"); }); controls.enabled = !boothOn; cellar.visible = boothOn && (boothKind === "bottles" || boothKind === "spray");
    if (boothM) {
      boothM.root.visible = boothOn;
      if (boothOn) {
        boothT += f.dt; const bm = boothM; resetPose(bm);
        const cel = boothKind === "bottles" || boothKind === "spray";
        if (cel) applyDance(bm, autoMove(bm.name, boothT + 3, 5), phase, 0.9); else applyRoutine(bm, boothKind === "partner" ? "clubFreestyle" : "hipSway", phase * (boothKind === "partner" ? 1.3 : 0.8), elapsed, 0.9, false);
        const sway = boothKind === "partner" ? Math.sin(boothT * 1.4) * 0.55 : Math.sin(boothT * 0.7) * 0.12;
        if (cel) bm.root.position.set(CX - 1.2 + bm.root.position.x * 0.5, 0, 0.2 + bm.root.position.z * 0.5); else bm.root.position.set(8.55 + bm.root.position.x * 0.2, 0, -1.5 + sway + bm.root.position.z * 0.2); bm.root.rotation.y = Math.PI / 2;
        if (cel && boothKind === "bottles") { popT -= f.dt; if (popT <= 0) { popT = 1.3; if (cellarFlash) cellarFlash.intensity = 9; spawn("coin", CX + 1.3, 1.0, 0.4, rnd(-1, 1), 5, rnd(-1, 1), colOf("#d4af37"), 0, 40, 0.7); for (let i = 0; i < 22; i++) spawn("conf", CX + 1.3, 1.05, 0.4, rnd(-3.4, -0.4), rnd(2, 5), rnd(-1.4, 1.2), colOf(i % 3 ? "#f6e7a0" : "#ffffff"), 0, 30, 0.8); for (let i = 0; i < 3; i++) spawn("bill", CX - 1, 2.4, 0.2, rnd(-1, 1), rnd(0, 1), rnd(-1, 1), colOf("#7dcf94"), 0, 40, 1); } }
        if (cel && boothKind === "spray") { for (let i = 0; i < 4; i++) spawn("conf", CX + 2.3, 1.1 + rnd(-0.1, 0.1), 1.0 + rnd(-0.2, 0.2), -rnd(3, 5), rnd(0.4, 1.4), -rnd(0.4, 0.9), colOf(i % 2 ? "#f6f1d8" : "#ffffff"), 0, 18, 1.4); if (cellarFlash) cellarFlash.intensity = 1.5 + Math.random(); }
        if (cellarFlash) cellarFlash.intensity *= Math.max(0, 1 - f.dt * 5);
        paintAll(bm, "dance", 0, undefined, 0.05); if (cel && boothKind === "spray" && bm.bb) bm.bb.sprite.material.color.setRGB(0.78, 0.9, 1);
      }
    }
    if (!bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(2, lastW / 2), Math.max(2, lastH / 2)), 0.55, 0.7, 0.78); composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(new OutputPass()); }
    bloom.strength = reduce ? 0.25 : 0.5 + beat * 0.25; composer.render();
  }
  const api: Club3D = {
    el, frame,
    project: (name) => { const d = dancers.find((q) => q.m.name === name); if (!d || !d.m.root.visible) return null; const p = d.m.root.position.clone(); p.y += 0.95; const q = toPt(p); return { x: q.x, y: q.y + 30 }; },
    anchor: (who) => { const u = who.toUpperCase(); const n = u === "DJ" ? djN : u === "BOUNCER" ? bouncer : u === "BARTENDER" ? bartender : u === "MC" ? mc : u === "PIMP" ? fam[1] : u === "PATRON" ? patrons[Math.floor(Math.random() * patrons.length)] : null; let p: THREE.Vector3; if (n) { p = n.m.root.getWorldPosition(new THREE.Vector3()); p.y += 1.9; } else { const d = dancers.find((q) => q.m.name.toUpperCase() === u); if (!d) return null; p = d.m.root.position.clone(); p.y += 1.95; } return toPt(p); },
    spotRects: () => (Object.keys(boxes) as SpotId[]).map((id) => { const b = boxes[id]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = toPt(v3.set(x, y, z)); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); } return { id, x: clamp(x0, 0, W), y: clamp(y0, 0, H), w: clamp(x1, 0, W) - clamp(x0, 0, W), h: clamp(y1, 0, H) - clamp(y0, 0, H) }; }),
    land: (x, y, v, c) => { const w = worldOf(x, y, STAGE_Y + 0.9); spawn(v >= 100 ? "bill" : "bill", w.x + rnd(-0.1, 0.1), w.y, w.z + rnd(-0.1, 0.1), rnd(-0.3, 0.3), 0.3, rnd(-0.3, 0.3), colOf(c), v, 70, v >= 100 ? 1.25 : 1); },
    setTheme: (name, accent, bm, sky, floorC) => {
      accentC.set(accent); beams = bm.map((c) => new THREE.Color(c)); led.color.copy(accentC); led.emissive.copy(accentC); fill.color.copy(accentC);
      carpet.userData.tint = new THREE.Color(floorC).lerp(new THREE.Color(0xffffff), 0.7).getHex(); carpet.color.set(carpet.userData.tint as number); wallMat.color.copy(accentC).lerp(new THREE.Color(0xffffff), 0.7);
      const bg = new THREE.Color(sky[1]).multiplyScalar(0.3); (scene.background as THREE.Color).copy(bg); (scene.fog as THREE.FogExp2).color.copy(bg);
      const old = mainSign; const t = (old.material as THREE.MeshBasicMaterial).map; scene.remove(old); mainSign = mkSign(name.toUpperCase(), 7.4, 1.85, 0, 5.0, -10.85, 0); t?.dispose();
    },
    setStyle: (name, r, out) => { const d = dancers.find((q) => q.m.name === name); if (!d) return; if (r) d.routine = r; if (out) { d.outfit = out; applyOutfit(d.m, out); } saved[name] = { routine: d.routine, outfit: d.outfit, dance: d.dance }; try { localStorage.setItem("club3d.styles", JSON.stringify(saved)); } catch { /* private mode */ } },
    setDance: (name, idx) => { const d = dancers.find((q) => q.m.name === name); if (!d) return; d.dance = idx; saved[name] = { routine: d.routine, outfit: d.outfit, dance: idx }; try { localStorage.setItem("club3d.styles", JSON.stringify(saved)); } catch { /* private mode */ } },
    getDance: (name) => dancers.find((q) => q.m.name === name)?.dance ?? -1,
    getStyle: (name) => { const d = dancers.find((q) => q.m.name === name); return { routine: d?.routine ?? "hipSway", outfit: d?.outfit ?? "own" }; },
    setView: (preset) => { cine = preset === "cine"; const v = VIEWS[preset]; if (!v) return; tween = { p0: camera.position.clone(), p1: new THREE.Vector3(...(v[0] as [number, number, number])), t0: controls.target.clone(), t1: new THREE.Vector3(...(v[1] as [number, number, number])), k: 0 }; },
    booth: (on, name = "", kind = "lap") => {
      if (on === boothOn) { boothKind = kind; return; }
      boothOn = on; boothKind = kind; boothT = 0;
      if (on) {
        boothPrev = { p: camera.position.clone(), t: controls.target.clone(), cine }; cine = false;
        let m = boothCache.get(name); if (!m) { const src = dancers.find((q) => q.m.name === name) ?? dancers[0]; m = buildMosaic(src ? src.m.c : null, "dancer", name || "Dancer", o.accent); m.root.visible = false; scene.add(m.root); if (src) applyOutfit(m, src.m.outfitId); boothCache.set(name, m); }
        boothM = m; m.root.visible = true;
        const cel = kind === "bottles" || kind === "spray"; tween = { p0: camera.position.clone(), p1: cel ? new THREE.Vector3(CX + 3.8, 1.55, 2.6) : new THREE.Vector3(11.4, 1.5, 1.0), t0: controls.target.clone(), t1: cel ? new THREE.Vector3(CX - 1.2, 1.3, 0.1) : new THREE.Vector3(8.4, 1.45, -1.5), k: 0 };
      } else if (boothPrev) {
        tween = { p0: camera.position.clone(), p1: boothPrev.p, t0: controls.target.clone(), t1: boothPrev.t, k: 0 }; cine = boothPrev.cine; boothPrev = null;
      }
    },
    sink, litter: costs, setProps,
    carry: (on, h) => { if (on && h) { carryHooks = h; controls.enabled = false; carryGun.start(h); } else { carryGun.stop(); controls.enabled = true; carryHooks = null; api.setView("free"); } },
    aim: (nx, ny) => carryGun.aim(nx, ny), trigger: (on) => carryGun.trigger(on), carrying: () => carryGun.active, aimingAt: () => carryGun.aimingAt,
    dispose: () => { controls.dispose(); renderer.dispose(); },
  };
  return api;
}
