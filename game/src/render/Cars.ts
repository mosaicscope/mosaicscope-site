import type { Vehicle } from "../entities/types";
import { VEHICLES, VehicleClass } from "../content/vehicles";
import type { Camera } from "./Camera";
import { GLOW } from "./Buildings";
import { patinaOf, weather } from "./CarPatina";
import { carMutationOf } from "./CarMutation";

/**
 * Cars are little lofted 3D models projected into the iso view: a rocker skirt, a body whose top
 * slopes from the bonnet to the boot deck, and a glasshouse whose roof is narrower and shorter than
 * its base (so windscreens and rear windows rake back). Each face is lit by its own normal, hidden
 * faces are culled, and wheels are real discs (far side behind the body, near side in the arches).
 * Per-class shapes give hatchbacks, sedans, utes, vans, tuners, muscle cars and supercars their own
 * silhouettes; liveries, light bars, wings and neon underglow sit on top.
 */
type V3 = [number, number, number];
const pt = { x: 0, y: 0 };
const VIEW: V3 = [1, 1, 1.23];            // towards the iso camera, in world units (x, y, up)
const LIGHT = norm([-0.45, 0.55, 1]);       // key light from the upper left of the screen

function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function rgb(hex: string): [number, number, number] {
  if (!hex.startsWith("#")) return [128, 128, 128];
  const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lit(c: [number, number, number], k: number, add = 0): string {
  return `rgb(${Math.min(255, Math.round(c[0] * k + add))},${Math.min(255, Math.round(c[1] * k + add))},${Math.min(255, Math.round(c[2] * k + add))})`;
}

/** Shape of each class, as fractions of the car's length (x, front = +0.5) and height. */
interface Shape {
  cf: number; cr: number;           // plan-view chamfer at the nose / tail (fraction of width)
  hood: number; deck: number;       // body top height at the nose / tail
  cab: [number, number];            // glasshouse base: rear, front (x fraction)
  roof: [number, number];           // roof: rear, front
  cw: number; rw: number;           // glasshouse base / roof width (fraction of width)
  wheel: number;                    // wheel radius (fraction of height)
  boxy?: boolean;                   // vans: painted glasshouse with only front windows
  tray?: boolean; wing?: boolean; scoop?: boolean;
  rh?: number;                      // roof height as a fraction of the car's height (default 1)
  open?: boolean;                   // convertible: windscreen only, seats showing
  pill?: number;                    // extra pillars along each side window (default 1)
  wb?: number;                      // wheel position as a fraction of length (default 0.31)
  bed?: string;                     // colour of the tray floor
  box?: { a: number; b: number; h: number; col: string };  // cargo body behind the cab (fraction of length, fraction of height)
}
const SEDAN: Shape = { cf: 0.24, cr: 0.16, hood: 0.5, deck: 0.56, cab: [-0.27, 0.17], roof: [-0.15, -0.02], cw: 0.88, rw: 0.74, wheel: 0.27 };
const SHAPES: Record<VehicleClass, Shape> = {
  hatch: { cf: 0.28, cr: 0.12, hood: 0.5, deck: 0.6, cab: [-0.47, 0.19], roof: [-0.43, -0.03], cw: 0.88, rw: 0.76, wheel: 0.27 },
  sedan: SEDAN,
  taxi: SEDAN,
  police: { ...SEDAN, hood: 0.52, deck: 0.58 },
  suv: { cf: 0.2, cr: 0.12, hood: 0.56, deck: 0.62, cab: [-0.46, 0.2], roof: [-0.44, 0.0], cw: 0.9, rw: 0.82, wheel: 0.26 },
  ute: { cf: 0.18, cr: 0.06, hood: 0.56, deck: 0.58, cab: [-0.1, 0.19], roof: [-0.08, 0.04], cw: 0.9, rw: 0.82, wheel: 0.25, tray: true },
  van: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true },
  ambulance: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.18], cw: 0.98, rw: 0.96, wheel: 0.2, boxy: true },
  jdm: { cf: 0.26, cr: 0.16, hood: 0.5, deck: 0.58, cab: [-0.3, 0.15], roof: [-0.2, -0.03], cw: 0.86, rw: 0.72, wheel: 0.3, wing: true },
  muscle: { cf: 0.14, cr: 0.12, hood: 0.58, deck: 0.58, cab: [-0.34, 0.05], roof: [-0.24, -0.09], cw: 0.84, rw: 0.72, wheel: 0.31, scoop: true },
  sports: { cf: 0.34, cr: 0.26, hood: 0.42, deck: 0.6, cab: [-0.4, 0.12], roof: [-0.2, -0.03], cw: 0.82, rw: 0.66, wheel: 0.33 },
  super: { cf: 0.4, cr: 0.2, hood: 0.36, deck: 0.56, cab: [-0.3, 0.24], roof: [-0.12, 0.03], cw: 0.8, rw: 0.62, wheel: 0.36, wing: true },
  mini: { cf: 0.3, cr: 0.14, hood: 0.46, deck: 0.62, cab: [-0.44, 0.14], roof: [-0.4, -0.02], cw: 0.9, rw: 0.8, wheel: 0.3 },
  wagon: { cf: 0.22, cr: 0.1, hood: 0.5, deck: 0.62, cab: [-0.47, 0.18], roof: [-0.46, -0.02], cw: 0.88, rw: 0.78, wheel: 0.26 },
  hothatch: { cf: 0.28, cr: 0.12, hood: 0.46, deck: 0.58, cab: [-0.46, 0.19], roof: [-0.42, -0.03], cw: 0.88, rw: 0.76, wheel: 0.31, wing: true },
  coupe: { cf: 0.3, cr: 0.2, hood: 0.46, deck: 0.56, cab: [-0.32, 0.1], roof: [-0.2, -0.04], cw: 0.84, rw: 0.68, wheel: 0.29 },
  roadster: { cf: 0.3, cr: 0.2, hood: 0.44, deck: 0.5, cab: [-0.2, 0.1], roof: [-0.18, 0.06], cw: 0.86, rw: 0.8, wheel: 0.3, rh: 0.74, open: true },
  limo: { cf: 0.2, cr: 0.12, hood: 0.5, deck: 0.54, cab: [-0.4, 0.2], roof: [-0.32, 0.0], cw: 0.88, rw: 0.8, wheel: 0.22, pill: 3, wb: 0.34 },
  hearse: { cf: 0.2, cr: 0.06, hood: 0.5, deck: 0.66, cab: [-0.5, 0.18], roof: [-0.5, 0.0], cw: 0.88, rw: 0.84, wheel: 0.25, boxy: true },
  minivan: { cf: 0.22, cr: 0.08, hood: 0.5, deck: 0.7, cab: [-0.48, 0.22], roof: [-0.47, 0.0], cw: 0.9, rw: 0.84, wheel: 0.24, pill: 2 },
  camper: { cf: 0.2, cr: 0.06, hood: 0.46, deck: 0.6, cab: [-0.5, 0.26], roof: [-0.5, 0.12], cw: 0.96, rw: 0.92, wheel: 0.21, boxy: true, wb: 0.33 },
  dcute: { cf: 0.18, cr: 0.06, hood: 0.56, deck: 0.58, cab: [-0.22, 0.19], roof: [-0.2, 0.04], cw: 0.9, rw: 0.82, wheel: 0.26, tray: true, pill: 2 },
  flatdeck: { cf: 0.16, cr: 0.04, hood: 0.6, deck: 0.62, cab: [0.0, 0.2], roof: [0.02, 0.08], cw: 0.94, rw: 0.88, wheel: 0.22, tray: true, bed: "#8a6a3a", wb: 0.33 },
  tradie: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },
  icecream: { cf: 0.2, cr: 0.06, hood: 0.42, deck: 0.5, cab: [-0.5, 0.3], roof: [-0.5, 0.16], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },
  post: { cf: 0.2, cr: 0.06, hood: 0.44, deck: 0.52, cab: [-0.5, 0.3], roof: [-0.5, 0.18], cw: 0.96, rw: 0.92, wheel: 0.2, boxy: true, wb: 0.33 },
  bus: { cf: 0.12, cr: 0.06, hood: 0.55, deck: 0.55, cab: [-0.5, 0.5], roof: [-0.5, 0.48], cw: 0.98, rw: 0.96, wheel: 0.17, pill: 6, wb: 0.32 },
  tow: { cf: 0.18, cr: 0.06, hood: 0.54, deck: 0.56, cab: [0.0, 0.2], roof: [0.0, 0.06], cw: 0.9, rw: 0.82, wheel: 0.24, tray: true, bed: "#3a3430", wb: 0.33 },
  fire: { cf: 0.14, cr: 0.04, hood: 0.55, deck: 0.6, cab: [0.1, 0.5], roof: [0.1, 0.46], cw: 0.96, rw: 0.94, wheel: 0.2, pill: 2, wb: 0.34, box: { a: -0.5, b: 0.08, h: 0.98, col: "#d4382a" } },
  bin: { cf: 0.14, cr: 0.04, hood: 0.55, deck: 0.6, cab: [0.12, 0.5], roof: [0.12, 0.46], cw: 0.96, rw: 0.94, wheel: 0.2, pill: 1, wb: 0.34, box: { a: -0.5, b: 0.1, h: 1.02, col: "#2d6b24" } },
  banger: SEDAN,
  retro: { cf: 0.36, cr: 0.34, hood: 0.4, deck: 0.5, cab: [-0.3, 0.22], roof: [-0.2, 0.05], cw: 0.9, rw: 0.72, wheel: 0.3 },
  lowrider: { ...SEDAN, hood: 0.44, deck: 0.48, wheel: 0.24 },
  fourby: { cf: 0.1, cr: 0.06, hood: 0.58, deck: 0.68, cab: [-0.48, 0.12], roof: [-0.47, 0.06], cw: 0.94, rw: 0.88, wheel: 0.3, pill: 2 },
  ev: { cf: 0.3, cr: 0.18, hood: 0.44, deck: 0.6, cab: [-0.44, 0.2], roof: [-0.4, 0.0], cw: 0.88, rw: 0.74, wheel: 0.27 },
  rally: { cf: 0.28, cr: 0.12, hood: 0.5, deck: 0.6, cab: [-0.46, 0.19], roof: [-0.42, -0.03], cw: 0.88, rw: 0.76, wheel: 0.31, wing: true, scoop: true },
  hotrod: { cf: 0.18, cr: 0.12, hood: 0.46, deck: 0.52, cab: [-0.22, 0.06], roof: [-0.14, -0.04], cw: 0.8, rw: 0.66, wheel: 0.33, scoop: true },
};

type Band = { u0: number; u1: number; cols: string[]; n?: number };
/** Paint, trim and fittings per class, on top of the shape. */
interface Style {
  paint?: string;                 // fixed paint (ignores the car's own colour)
  rim?: string;
  bands?: Band[];                 // stripes / checks along the long sides
  flames?: boolean; rust?: number;
  roof?: "rack" | "surf" | "pop" | "cone" | "beacon" | "bar" | "ladder" | "boom";
  neon?: boolean; spare?: boolean; crest?: string;
}
const STYLE: Partial<Record<VehicleClass, Style>> = {
  hothatch: { rim: "#c9c4bc", neon: true, bands: [{ u0: 0.28, u1: 0.34, cols: ["#0e0b0a"] }] },
  roadster: { rim: "#cfc8c0" },
  hearse: { paint: "#0e0b0a", rim: "#cfc8c0", bands: [{ u0: 0.42, u1: 0.47, cols: ["#cfc8c0"] }] },
  limo: { rim: "#cfc8c0", bands: [{ u0: 0.44, u1: 0.48, cols: ["#e6b422"] }] },
  camper: { rim: "#cfc8c0", bands: [{ u0: 0.58, u1: 1.0, cols: ["#f4f0e4"] }], roof: "pop" },
  minivan: { rim: "#a39d96" },
  wagon: { roof: "surf" },
  dcute: { rim: "#8a8580", roof: "bar" },
  flatdeck: { rim: "#8a8580" },
  tradie: { rim: "#8a8580", roof: "ladder", bands: [{ u0: 0.18, u1: 0.3, cols: ["#ff9a3d"] }] },
  icecream: { rim: "#8a8580", roof: "cone", bands: [{ u0: 0.22, u1: 0.78, cols: ["#ffc2e8", "#fff1d6"], n: 10 }] },
  post: { rim: "#8a8580", bands: [{ u0: 0.36, u1: 0.46, cols: ["#f6d32c"] }] },
  bus: { rim: "#8a8580", bands: [{ u0: 0.08, u1: 0.3, cols: ["#eee4d3"] }, { u0: 0.3, u1: 0.4, cols: ["#f6d32c"] }] },
  tow: { rim: "#8a8580", roof: "boom", bands: [{ u0: 0.05, u1: 0.2, cols: ["#f6d32c", "#0e0b0a"], n: 14 }] },
  fire: { paint: "#d4382a", rim: "#cfc8c0", roof: "ladder", bands: [{ u0: 0.3, u1: 0.4, cols: ["#f6d32c"] }] },
  bin: { rim: "#8a8580", roof: "beacon", bands: [{ u0: 0.05, u1: 0.18, cols: ["#0e0b0a"] }] },
  banger: { rust: 6, rim: "#8a8580" },
  retro: { rim: "#cfc8c0" },
  lowrider: { rim: "#e6b422", neon: true },
  fourby: { rim: "#8a8580", spare: true, roof: "rack" },
  ev: { rim: "#2a2a2a" },
  rally: { rim: "#e6b422", neon: false, bands: [{ u0: 0.25, u1: 0.33, cols: ["#e6b422"] }, { u0: 0.36, u1: 0.4, cols: ["#eee4d3"] }] },
  hotrod: { rim: "#cfc8c0", neon: true, flames: true },
};

/** Octagonal plan ring (counter-clockwise), centred on cx, with nose / tail chamfers. */
function ring(x0: number, x1: number, hw: number, cf: number, cr: number, h: (x: number) => number): V3[] {
  const f = hw * 2 * cf, r = hw * 2 * cr;
  const P: [number, number][] = [[x1, -hw + f], [x1, hw - f], [x1 - f * 0.8, hw], [x0 + r * 0.8, hw], [x0, hw - r], [x0, -hw + r], [x0 + r * 0.8, -hw], [x1 - f * 0.8, -hw]];
  return P.map(([x, y]) => [x, y, h(x)]);
}

interface Ctx { g: CanvasRenderingContext2D; cam: Camera; x: number; y: number; c: number; s: number }
const W3 = (k: Ctx, p: V3) => { k.cam.toScreen(k.x + p[0] * k.c - p[1] * k.s, k.y + p[0] * k.s + p[1] * k.c, p[2], pt); return [pt.x, pt.y]; };
/** Local -> world normal. */
const WN = (k: Ctx, n: V3): V3 => [n[0] * k.c - n[1] * k.s, n[0] * k.s + n[1] * k.c, n[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function fillPoly(k: Ctx, pts: V3[], col: string): void {
  const g = k.g; g.fillStyle = col; g.beginPath();
  pts.forEach((p, i) => { const q = W3(k, p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
  g.closePath(); g.fill();
}
const shadeFor = (n: V3) => 0.5 + 0.62 * Math.max(0, dot(norm(n), LIGHT));

/** Draw the visible side faces of a loft between two rings. Returns the faces drawn (for liveries). */
function loft(k: Ctx, r0: V3[], r1: V3[], colorOf: (n: V3, i: number) => string, edge?: string): { a0: V3; b0: V3; a1: V3; b1: V3; n: V3 }[] {
  const out: { a0: V3; b0: V3; a1: V3; b1: V3; n: V3 }[] = [];
  const cx = r0.reduce((s, p) => s + p[0], 0) / r0.length, cy = r0.reduce((s, p) => s + p[1], 0) / r0.length;
  for (let i = 0; i < r0.length; i++) {
    const j = (i + 1) % r0.length;
    const a0 = r0[i], b0 = r0[j], a1 = r1[i], b1 = r1[j];
    const e: V3 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
    const f: V3 = [(a1[0] + b1[0] - a0[0] - b0[0]) / 2, (a1[1] + b1[1] - a0[1] - b0[1]) / 2, (a1[2] + b1[2] - a0[2] - b0[2]) / 2];
    let n = cross(e, f);
    const mx = (a0[0] + b0[0]) / 2 - cx, my = (a0[1] + b0[1]) / 2 - cy;
    if (n[0] * mx + n[1] * my < 0) n = [-n[0], -n[1], -n[2]];
    const wn = WN(k, n);
    if (dot(wn, VIEW) <= 0) continue;
    fillPoly(k, [a0, b0, b1, a1], colorOf(wn, i));
    if (edge) { const g = k.g, A = W3(k, a1), B = W3(k, b1); g.strokeStyle = edge; g.lineWidth = Math.max(1, k.cam.zoom); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    out.push({ a0, b0, a1, b1, n: wn });
  }
  return out;
}
function cap(k: Ctx, r: V3[], col: [number, number, number], add = 0): void {
  // plane normal from two diagonals
  const a = r[0], b = r[Math.floor(r.length / 2)], c = r[Math.floor(r.length / 4)], d = r[Math.floor((3 * r.length) / 4)];
  let n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]]);
  if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
  fillPoly(k, r, lit(col, shadeFor(WN(k, n)) * 1.05, add));
}
/** Point on a face: t along the edge, u up the face. */
const onFace = (f: { a0: V3; b0: V3; a1: V3; b1: V3 }, t: number, u: number): V3 => {
  const lo: V3 = [f.a0[0] + (f.b0[0] - f.a0[0]) * t, f.a0[1] + (f.b0[1] - f.a0[1]) * t, f.a0[2] + (f.b0[2] - f.a0[2]) * t];
  const hi: V3 = [f.a1[0] + (f.b1[0] - f.a1[0]) * t, f.a1[1] + (f.b1[1] - f.a1[1]) * t, f.a1[2] + (f.b1[2] - f.a1[2]) * t];
  return [lo[0] + (hi[0] - lo[0]) * u, lo[1] + (hi[1] - lo[1]) * u, lo[2] + (hi[2] - lo[2]) * u];
};

function wheel(k: Ctx, lx: number, ly: number, r: number, near: boolean, spin: number, rim: string, flat = false): void {
  const g = k.g, pts: number[][] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283; pts.push(W3(k, [lx + Math.cos(a) * r, ly, r * (flat ? 0.55 : 1) + Math.sin(a) * r * (flat ? 0.55 : 1)])); }
  g.fillStyle = "#121010"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
  if (!near) return;
  const ri = r * 0.62;
  g.fillStyle = rim; g.beginPath();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; const p = W3(k, [lx + Math.cos(a) * ri, ly + Math.sign(ly) * 0.01, r * (flat ? 0.55 : 1) + Math.sin(a) * ri * (flat ? 0.55 : 1)]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  g.closePath(); g.fill();
  // spokes turn with the wheel
  g.strokeStyle = "rgba(14,11,10,.55)"; g.lineWidth = Math.max(1, 0.8 * k.cam.zoom); g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = spin + (i / 5) * 6.283;
    const A = W3(k, [lx + Math.cos(a) * ri * 0.25, ly, r * (flat ? 0.55 : 1) + Math.sin(a) * ri * 0.25 * (flat ? 0.55 : 1)]), B = W3(k, [lx + Math.cos(a) * ri * 0.92, ly, r * (flat ? 0.55 : 1) + Math.sin(a) * ri * 0.92 * (flat ? 0.55 : 1)]);
    g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
  }
  g.stroke();
}

const spinOf = new WeakMap<Vehicle, number>();

export function drawCar(g: CanvasRenderingContext2D, cam: Camera, v: Vehicle, alpha: number, time: number, dark: number, selected: boolean): void {
  const d = VEHICLES[v.cls], S = SHAPES[v.cls], M = carMutationOf(v.plate, v.cls);
  const x = v.px + (v.x - v.px) * alpha, y = v.py + (v.y - v.py) * alpha;
  const z = cam.zoom, ang = v.heading;
  const k: Ctx = { g, cam, x, y, c: Math.cos(ang), s: Math.sin(ang) };
  // drawn size only: the simulation still uses the class dimensions, so movement and collisions are unchanged
  const L = d.length * M.scale, hw = (d.width / 2) * M.scale, H = d.height * 1.08 * M.scale;
  // crumple zones: a hit end is pushed in (Traffic.bump records where the car was hit)
  const dF = v.dmgF ?? 0, dR = v.dmgR ?? 0, dL = v.dmgL ?? 0, dS = v.dmgS ?? 0;
  const x0 = -L / 2 + dR * 0.16 * L, x1 = L / 2 - dF * 0.18 * L;
  const deadLamp = dF > 0.35 ? (v.plate.charCodeAt(1) % 2 ? 1 : -1) : 0, deadTail = dR > 0.35 ? (v.plate.charCodeAt(2) % 2 ? 1 : -1) : 0;
  const night = dark > 0.35;
  const ST = STYLE[v.cls] ?? {};
  const PT = patinaOf(v.cls, v.plate, d.price, v.damage);   // this car's own story: age, rust, dents, stickers (CarPatina.ts)
  const paint = weather(rgb(v.cls === "police" ? "#f2f2ee" : v.cls === "ambulance" ? "#f4f1e6" : ST.paint ?? v.color), PT);
  const roofPaint = PT.roof ? rgb(PT.roof) : paint;
  const dmg = 1 - v.damage * 0.35;
  const spin = (spinOf.get(v) ?? 0) + v.speed * 0.016 / (S.wheel * H);
  spinOf.set(v, spin);

  // contact shadow (soft, two layers)
  cam.toScreen(x, y, 0, pt);
  g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(pt.x, pt.y + 2 * z, L * 24 * z, L * 12.5 * z, 0, 0, 6.283); g.fill();
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(pt.x, pt.y + 1 * z, L * 18 * z, L * 9 * z, 0, 0, 6.283); g.fill();

  // neon underglow on tuned cars at night (replayed over the darkness); off on a parked car nobody is in
  if (night && !(v.state === "parked" && v.driver < 0) && (v.cls === "jdm" || v.cls === "sports" || v.cls === "super" || v.cls === "muscle" || ST.neon)) {
    const hue = ["255,122,217", "61,214,255", "198,255,61", "180,140,255"][v.plate.charCodeAt(0) % 4];
    // a ring of light on the tarmac around the car: the glow layer sits on top of the body, so the middle stays clear
    // (no coloured wash over the paint) and the gradient is squashed into the ground ellipse so it fades with no hard rim
    const sx = pt.x, sy = pt.y + 2 * z, rx = L * 22 * z, sq = 0.5;
    GLOW.push(() => {
      g.save(); g.globalCompositeOperation = "lighter";
      g.translate(sx, sy); g.scale(1, sq);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, `rgba(${hue},0)`); grd.addColorStop(0.62, `rgba(${hue},0)`);
      grd.addColorStop(0.8, `rgba(${hue},.2)`); grd.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, rx, 0, 6.283); g.fill();
      g.restore();
    });
  }

  // which side faces the camera
  const nearSign = dot(WN(k, [0, 1, 0]), VIEW) > 0 ? 1 : -1;
  const wr = S.wheel * H, wx = L * (S.wb ?? (v.cls === "van" || v.cls === "ambulance" ? 0.33 : 0.31)), wy = hw - 0.02;
  const rimCol = ST.rim ?? (v.cls === "police" || v.cls === "ambulance" || v.cls === "van" ? "#8a8580" : v.cls === "super" || v.cls === "sports" ? "#2a2a2a" : "#cfc8c0");
  const axles = M.axles === 1 ? [0] : M.axles === 2 ? [wx, -wx] : [wx, 0, -wx];
  for (const lx of axles) wheel(k, lx, -nearSign * wy, wr, false, spin, rimCol, -nearSign < 0 ? !!v.flatLeft : !!v.flatRight);

  // ---- lower skirt ----
  const hs = H * 0.3, ground = 0.08;
  const bodyTop = (lx: number) => { const t = (lx - x0) / L; return H * (S.deck + (S.hood - S.deck) * Math.max(0, Math.min(1, (t - 0.25) / 0.75))); };
  const rSk0 = ring(x0 + 0.04, x1 - 0.04, hw * 0.9, S.cf, S.cr, () => ground);
  const rSk1 = ring(x0, x1, hw, S.cf, S.cr, () => hs);
  const lower = (n: V3) => lit(paint, shadeFor(n) * 0.72 * dmg);
  loft(k, rSk0, rSk1, lower);
  for (const lx of axles) wheel(k, lx, nearSign * wy, wr, true, spin, rimCol, nearSign < 0 ? !!v.flatLeft : !!v.flatRight);

  // ---- body sides (with a slight tumblehome) and the bonnet/boot deck ----
  const rTop = ring(x0 + 0.03, x1 - 0.02, hw * 0.95, S.cf * 1.05, S.cr * 1.05, bodyTop);
  const sides = loft(k, rSk1, rTop, (n) => lit(paint, shadeFor(n) * dmg), "rgba(255,255,255,.32)");
  // shoulder crease highlight (the "gloss" line)
  for (const f of sides) {
    const A = W3(k, onFace(f, 0, 0.62)), B = W3(k, onFace(f, 1, 0.62));
    g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = Math.max(1, 1.2 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  cap(k, rTop, paint.map((c) => c * dmg) as [number, number, number], 14);
  // extra glasshouse pods stacked on the bonnet and boot of the big ones (multi-cabin monstrosities)
  if (M.cabins > 1) {
    const pods: [number, number][] = M.cabins === 2 ? [[x1 - L * 0.44, x1 - L * 0.2]] : [[x1 - L * 0.44, x1 - L * 0.24], [x0 + L * 0.08, x0 + L * 0.34]];
    for (const [a, b] of pods) {
      const base = (bodyTop(a) + bodyTop(b)) / 2, top = base + H * 0.34;
      const p0 = ring(a, b, hw * 0.72, 0.08, 0.08, () => base), p1 = ring(a + (b - a) * 0.14, b - (b - a) * 0.14, hw * 0.46, 0.08, 0.08, () => top);
      loft(k, p0, p1, (n) => lit(roofPaint, shadeFor(n) * dmg));
      cap(k, p1, roofPaint.map((c) => c * dmg) as [number, number, number], 18);
    }
  }
  // top-plane patina: sun-bleached paint, rust blotches and a racing stripe over bonnet and boot
  if (!S.tray) {
    const sh = (lx: number) => bodyTop(lx) + 0.006, regions: [number, number][] = [[S.cab[1] * L, x1 - 0.07], [x0 + 0.07, S.cab[0] * L]];
    const at = (r: number, t: number, s: number): V3 => { const [a, b] = regions[r]; const lx = a + (b - a) * t; return [lx, s * hw * 0.8, sh(lx)]; };
    if (PT.bleach > 0.02) for (let r = 0; r < 2; r++) fillPoly(k, [at(r, 0.05, -0.85), at(r, 0.95, -0.85), at(r, 0.95, 0.85), at(r, 0.05, 0.85)], `rgba(255,238,215,${(PT.bleach * 0.55).toFixed(3)})`);
    for (const [r, t, sx, sz] of PT.topRust) { const w = sz, c0 = at(r, Math.min(0.9, t), sx); const [lx, ly, lz] = c0; fillPoly(k, [[lx, ly - w * hw * 2, lz], [lx + w * L * 0.7, ly, lz], [lx, ly + w * hw * 2, lz], [lx - w * L * 0.7, ly, lz]], "rgba(132,64,26,.8)"); fillPoly(k, [[lx, ly - w * hw, lz], [lx + w * L * 0.3, ly, lz], [lx, ly + w * hw, lz], [lx - w * L * 0.3, ly, lz]], "rgba(204,112,44,.8)"); }
    if (PT.stripe) for (const off of [-0.16, 0.16]) for (let r = 0; r < 2; r++) fillPoly(k, [at(r, 0, off - 0.09), at(r, 1, off - 0.09), at(r, 1, off + 0.09), at(r, 0, off + 0.09)], PT.stripe);
  }
  // liveries on the long sides
  const longSides = sides.filter((f) => Math.abs(f.a0[0] - f.b0[0]) > L * 0.4);
  if (v.cls === "police" || v.cls === "ambulance" || v.cls === "taxi") {
    const cols = v.cls === "police" ? ["#1c4fd6", "#f6d32c"] : v.cls === "ambulance" ? ["#2d8a3a", "#f6d32c"] : ["#0e0b0a", "#f6d32c"];
    const n = v.cls === "taxi" ? 14 : 8, u0 = v.cls === "taxi" ? 0.55 : 0.18, u1 = v.cls === "taxi" ? 0.72 : 0.78;
    for (const f of longSides) for (let i = 0; i < n; i++) {
      const t0 = 0.06 + (i / n) * 0.88, t1 = 0.06 + ((i + 1) / n) * 0.88;
      fillPoly(k, [onFace(f, t0, u0), onFace(f, t1, u0), onFace(f, t1, u1), onFace(f, t0, u1)], cols[i % 2]);
    }
  } else if (v.cls === "muscle" || v.cls === "super") {
    // racing stripes over the bonnet
    const sh = (lx: number) => bodyTop(lx) + 0.005;
    for (const off of [-0.09, 0.09]) fillPoly(k, [[x1 - 0.05, off - 0.04, sh(x1 - 0.05)], [x1 - 0.05, off + 0.04, sh(x1 - 0.05)], [S.cab[1] * L, off + 0.04, sh(S.cab[1] * L)], [S.cab[1] * L, off - 0.04, sh(S.cab[1] * L)]], v.cls === "super" ? "rgba(14,11,10,.55)" : "rgba(238,228,211,.8)");
  }
  for (const b of ST.bands ?? []) {
    const n = b.n ?? 1;
    for (const f of longSides) for (let i = 0; i < n; i++) {
      const t0 = n > 1 ? 0.04 + (i / n) * 0.92 : 0.02, t1 = n > 1 ? 0.04 + ((i + 1) / n) * 0.92 : 0.98;
      fillPoly(k, [onFace(f, t0, b.u0), onFace(f, t1, b.u0), onFace(f, t1, b.u1), onFace(f, t0, b.u1)], b.cols[i % b.cols.length]);
    }
  }
  if (ST.flames) {
    // tongues of flame licking back from the front wheel arch
    for (const f of longSides) for (let i = 0; i < 4; i++) {
      const t = 0.12 + i * 0.13;
      fillPoly(k, [onFace(f, t, 0.12), onFace(f, t + 0.12, 0.12), onFace(f, t + 0.01, 0.62 - i * 0.1)], i % 2 ? "#f6b62c" : "#ff6a1c");
    }
  }
  if (ST.rust) {
    // rust bloom and a mismatched door
    const seed = v.plate.charCodeAt(1) + v.plate.charCodeAt(2);
    for (const f of longSides) {
      for (let i = 0; i < ST.rust; i++) {
        const t = ((seed * (i + 3) * 37) % 90) / 100 + 0.04, u = ((seed * (i + 5) * 17) % 40) / 100 + 0.05, w = 0.05 + (i % 3) * 0.03;
        fillPoly(k, [onFace(f, t, u), onFace(f, t + w, u + 0.04), onFace(f, t + w * 1.2, u + 0.16), onFace(f, t - 0.01, u + 0.1)], i % 2 ? "rgba(122,62,22,.8)" : "rgba(90,48,20,.75)");
      }
      fillPoly(k, [onFace(f, 0.4, 0.2), onFace(f, 0.6, 0.2), onFace(f, 0.6, 0.95), onFace(f, 0.4, 0.95)], lit(rgb(seed % 2 ? "#9a8d80" : "#4a6a7a"), shadeFor(f.n) * dmg));
    }
  }
  // patina on the near long side only (the far one shows when the car turns)
  {
    const nearIdx = longSides.findIndex((f) => dot(WN(k, f.n), VIEW) > 0);
    const f = nearIdx >= 0 ? longSides[nearIdx] : undefined;
    if (f) for (const m of PT.marks) {
      const t0 = m.t, t1 = m.t + m.w, u0 = m.u, u1 = m.u + m.h, F = (t: number, u: number) => onFace(f, t, u);
      if (m.kind === "rust") {
        fillPoly(k, [F(t0, u0), F(t1, u0 + m.h * 0.3), F(t1 - m.w * 0.2, u1), F(t0 - 0.01, u0 + m.h * 0.7)], m.col);
        fillPoly(k, [F(t0 + m.w * 0.3, u0 + m.h * 0.2), F(t0 + m.w * 0.55, u0 + m.h * 0.25), F(t0 + m.w * 0.45, u0 + m.h * 0.5)], "rgba(190,100,40,.7)");   // a bright orange bloom in the middle
      } else if (m.kind === "dent") {
        fillPoly(k, [F(t0, u0 + m.h * 0.5), F(t0 + m.w * 0.5, u0), F(t1, u0 + m.h * 0.5), F(t0 + m.w * 0.5, u1)], m.col);
        fillPoly(k, [F(t0, u0 + m.h * 0.5), F(t0 + m.w * 0.5, u1), F(t0 + m.w * 0.5, u1 - m.h * 0.12), F(t0 + m.w * 0.05, u0 + m.h * 0.5)], "rgba(255,255,255,.22)");
      } else if (m.kind === "scratch") {
        const A = W3(k, F(t0, u0)), B = W3(k, F(t1, u1)); g.strokeStyle = m.col; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      } else if (m.kind === "primer") {
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u0 + m.h), F(t0, u0 + m.h)], lit(rgb("#7a6f68"), shadeFor(f.n) * dmg));
        fillPoly(k, [F(t0, u0), F(t0 + 0.012, u0), F(t0 + 0.012, u0 + m.h), F(t0, u0 + m.h)], "rgba(122,62,22,.7)");
      } else if (m.kind === "mud") {
        fillPoly(k, [F(t0, 0), F(t1, 0), F(t1, u1), F(t0, u0 + m.h * 0.55)], m.col);
      } else if (m.kind === "sticker") {
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u1), F(t0, u1)], m.col);
        fillPoly(k, [F(t0 + m.w * 0.2, u0 + m.h * 0.25), F(t1 - m.w * 0.2, u0 + m.h * 0.25), F(t1 - m.w * 0.2, u0 + m.h * 0.45), F(t0 + m.w * 0.2, u0 + m.h * 0.45)], "rgba(14,11,10,.7)");
      } else if (m.kind === "sill") {
        // a jagged rust line eating up from the sill, the whole length of the car
        const top: [number, number][] = []; for (let k = 0; k <= 10; k++) top.push([t0 + (m.w * k) / 10, u0 + m.h * (0.55 + 0.45 * Math.abs(Math.sin(k * 2.3 + m.h * 40)))]);
        fillPoly(k, [F(t0, u0), F(t1, u0), ...top.reverse().map(([a, b]) => F(a, b))], m.col);
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u0 + m.h * 0.3), F(t0, u0 + m.h * 0.3)], "rgba(70,30,12,.55)");
      } else if (m.kind === "door") {
        fillPoly(k, [F(t0, u0), F(t1, u0), F(t1, u1), F(t0, u1)], lit(rgb(m.col), shadeFor(f.n) * dmg));
        g.strokeStyle = "rgba(14,11,10,.85)"; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath();
        for (const [a, b] of [[t0, u0], [t0, u1], [t1, u1], [t1, u0]] as const) { const q = W3(k, F(a, b)); g.lineTo(q[0], q[1]); } g.closePath(); g.stroke();
      } else if (m.kind === "stripe") {
        fillPoly(k, [F(t0, u0), F(t0 + m.w, u0), F(t0 + m.w, u0 + m.h), F(t0, u0 + m.h)], m.col);
      }
    }
  }
  if (S.tray) {
    // open tray behind the cab
    const tx0 = x0 + 0.06, tx1 = S.cab[0] * L - 0.04, th = bodyTop(tx0);
    fillPoly(k, [[tx0, -hw * 0.82, th - 0.02], [tx1, -hw * 0.82, th - 0.02], [tx1, hw * 0.82, th - 0.02], [tx0, hw * 0.82, th - 0.02]], S.bed ?? "#1c1816");
    g.strokeStyle = lit(paint, 1.15); g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
    const c = [[tx0, -hw * 0.9], [tx1, -hw * 0.9], [tx1, hw * 0.9], [tx0, hw * 0.9]].map(([a, b]) => W3(k, [a, b, th + 0.03]));
    c.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
  }
  if (S.scoop) {
    const sx0 = x1 - L * 0.32, sx1 = x1 - L * 0.16, sh = bodyTop(sx1);
    fillPoly(k, [[sx0, -0.08, sh], [sx1, -0.08, sh], [sx1, 0.08, sh + 0.05], [sx0, 0.08, sh + 0.05]], lit(paint, 0.55));
  }

  // ---- glasshouse ----
  const glassBase = rgb(night ? "#141c28" : "#2c4058");
  const cb0 = S.cab[0] * L, cb1 = S.cab[1] * L, rf0 = S.roof[0] * L, rf1 = S.roof[1] * L;
  const rCab0 = ring(cb0, cb1, hw * S.cw, 0.12, 0.1, (lx) => bodyTop(lx) - 0.01);
  const roofZ = H * (S.rh ?? 1);
  const rCab1 = ring(rf0, rf1, hw * S.rw, 0.1, 0.08, () => roofZ);
  const seat = rgb("#2a1c16");
  const pillar = lit(paint, 0.75 * dmg);
  const fwdW = WN(k, [1, 0, 0]), frontVisible = dot(fwdW, VIEW) > 0;
  const drawBox = () => {
    const B = S.box!, bx0 = B.a * L, bx1 = B.b * L, base = bodyTop(bx0) - 0.02, col = rgb(B.col);
    const rb0 = ring(bx0, bx1, hw * 0.97, 0.03, 0.03, () => base), rb1 = ring(bx0 + 0.02, bx1 - 0.02, hw * 0.95, 0.03, 0.03, () => H * B.h);
    loft(k, rb0, rb1, (n) => lit(col, shadeFor(n) * dmg), "rgba(255,255,255,.28)");
    cap(k, rb1, col.map((c) => c * dmg) as [number, number, number], 10);
    if (v.cls === "bin") { // lift arm and hopper lip
      const A = W3(k, [bx0 + 0.05, -hw * 0.5, H * B.h + 0.02]), C = W3(k, [bx0 + 0.05, hw * 0.5, H * B.h + 0.02]);
      g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 1.5 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(C[0], C[1]); g.stroke();
    }
  };
  if (S.box && frontVisible) drawBox(); // the cab is nearer the camera, so the body goes down first
  const glassFaces = loft(k, rCab0, rCab1, (n, i) => {
    if (S.open) return i === 0 || i === 1 || i === 7 ? lit(glassBase, shadeFor(n) * 1.1, 26) : lit(seat, shadeFor(n) * 1.1);
    // vans: painted sides, glass only at the front
    if (S.boxy && !(i === 0 || i === 1 || i === 7)) return lit(paint, shadeFor(n) * dmg);
    const sky = n[2] > 0.4 ? 26 : 0; // raked glass catches the sky
    return lit(glassBase, shadeFor(n) * 1.1, sky + (night ? 0 : 10));
  });
  // pillars: the edges between glass panels, plus a B-pillar in the side windows
  g.strokeStyle = pillar; g.lineWidth = Math.max(1, 1.6 * z); g.beginPath();
  for (const f of glassFaces) {
    const A = W3(k, f.a0), B = W3(k, f.a1); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
    const C = W3(k, f.b0), D = W3(k, f.b1); g.moveTo(C[0], C[1]); g.lineTo(D[0], D[1]);
    if (Math.abs(f.a0[0] - f.b0[0]) > L * 0.25 && !S.boxy && !S.open) {
      const np = S.pill ?? 1;
      for (let j = 1; j <= np; j++) { const E = W3(k, onFace(f, j / (np + 1), 0)), F = W3(k, onFace(f, j / (np + 1), 1)); g.moveTo(E[0], E[1]); g.lineTo(F[0], F[1]); }
    }
  }
  g.stroke();
  // window reflections
  if (!night) for (const f of glassFaces) {
    if (S.boxy) continue;
    fillPoly(k, [onFace(f, 0.15, 0.15), onFace(f, 0.3, 0.15), onFace(f, 0.5, 0.9), onFace(f, 0.35, 0.9)], "rgba(220,235,255,.16)");
  }
  cap(k, rCab1, (S.open ? seat : roofPaint).map((c) => c * dmg) as [number, number, number], S.open ? 4 : 8);
  if (S.box && !frontVisible) drawBox();
  if (S.boxy) { // window line on vans
    for (const f of glassFaces) if (Math.abs(f.a0[0] - f.b0[0]) > L * 0.4) fillPoly(k, [onFace(f, 0.66, 0.35), onFace(f, 0.95, 0.35), onFace(f, 0.95, 0.85), onFace(f, 0.66, 0.85)], lit(glassBase, 1.1, night ? 0 : 12));
  }

  // ---- roof furniture ----
  const roofMid = (rf0 + rf1) / 2;
  if (v.cls === "police" || v.cls === "ambulance") {
    const on = v.siren && Math.floor(time * 6) % 2 === 0;
    const bar = (lx0: number, lx1: number, w: number, col: string) => fillPoly(k, [[lx0, -w, H + 0.07], [lx1, -w, H + 0.07], [lx1, w, H + 0.07], [lx0, w, H + 0.07]], col);
    bar(roofMid - 0.06, roofMid + 0.06, hw * 0.7, "#222");
    fillPoly(k, [[roofMid - 0.05, -hw * 0.66, H + 0.08], [roofMid + 0.05, -hw * 0.66, H + 0.08], [roofMid + 0.05, 0, H + 0.08], [roofMid - 0.05, 0, H + 0.08]], v.siren ? (on ? "#ff3b2f" : "#5a1410") : "#6a2a26");
    fillPoly(k, [[roofMid - 0.05, 0, H + 0.08], [roofMid + 0.05, 0, H + 0.08], [roofMid + 0.05, hw * 0.66, H + 0.08], [roofMid - 0.05, hw * 0.66, H + 0.08]], v.siren ? (!on ? "#3d7bff" : "#10204a") : "#26386a");
    if (v.siren) {
      cam.toScreen(x + k.c * roofMid, y + k.s * roofMid, H + 0.1, pt);
      const sx = pt.x, sy = pt.y, col = on ? "236,42,28" : "28,107,214";
      GLOW.push(() => { g.globalCompositeOperation = "lighter"; const grd = g.createRadialGradient(sx, sy, 0, sx, sy, 34 * z); grd.addColorStop(0, `rgba(${col},.55)`); grd.addColorStop(1, `rgba(${col},0)`); g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, 34 * z, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over"; });
    }
  }
  if (v.cls === "taxi") {
    cam.toScreen(x + k.c * roofMid, y + k.s * roofMid, H + 0.1, pt);
    g.fillStyle = "#0e0b0a"; g.fillRect(pt.x - 7 * z, pt.y - 5 * z, 14 * z, 5 * z);
    g.fillStyle = "#f6d32c"; g.font = `800 ${Math.max(5, Math.round(4.5 * z))}px monospace`; g.textAlign = "center"; g.fillText("TAXI", pt.x, pt.y - 1.2 * z); g.textAlign = "start";
  }
  if (v.cls === "suv") { // roof rails
    g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 1.3 * z); g.beginPath();
    for (const sy of [-hw * 0.7, hw * 0.7]) { const A = W3(k, [rf0 + 0.05, sy, H + 0.04]), B = W3(k, [rf1 - 0.05, sy, H + 0.04]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
  }
  if (ST.roof) {
    const rm = roofMid, hz = (S.box ? H * S.box.h : H) + 0.04;
    if (ST.roof === "rack" || ST.roof === "ladder") {
      const r0 = S.box ? S.box.a * L : rf0, r1 = S.box ? S.box.b * L : rf1;
      g.strokeStyle = ST.roof === "ladder" ? "#c9c4bc" : "#1c1816"; g.lineWidth = Math.max(1, 1.3 * z); g.beginPath();
      for (const sy of [-hw * 0.6, hw * 0.6]) { const A = W3(k, [r0 + 0.04, sy, hz]), B = W3(k, [r1 - 0.04, sy, hz]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
      for (let i = 0; i < 5; i++) { const t = r0 + 0.04 + (r1 - r0 - 0.08) * (i / 4), A = W3(k, [t, -hw * 0.6, hz]), B = W3(k, [t, hw * 0.6, hz]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
      g.stroke();
    } else if (ST.roof === "surf") {
      fillPoly(k, [[rf0 + 0.02, -0.07, hz + 0.01], [rf1 - 0.02, -0.04, hz + 0.01], [rf1, 0, hz + 0.01], [rf1 - 0.02, 0.04, hz + 0.01], [rf0 + 0.02, 0.07, hz + 0.01]], lit(rgb(["#3dd6ff", "#ff7ad9", "#c6ff3d"][v.plate.charCodeAt(0) % 3]), 1.05));
    } else if (ST.roof === "pop") {
      const rp0 = ring(rf0 + 0.05, rf1 - 0.05, hw * 0.7, 0.1, 0.1, () => H), rp1 = ring(rf0 + 0.08, rf1 - 0.08, hw * 0.66, 0.1, 0.1, () => H + 0.12);
      loft(k, rp0, rp1, (n) => lit(rgb("#f4f0e4"), shadeFor(n) * dmg));
      cap(k, rp1, rgb("#f4f0e4"), 8);
    } else if (ST.roof === "cone") {
      cam.toScreen(x + k.c * rm, y + k.s * rm, H + 0.12, pt);
      g.fillStyle = "#c98a3a"; g.beginPath(); g.moveTo(pt.x - 3.5 * z, pt.y); g.lineTo(pt.x + 3.5 * z, pt.y); g.lineTo(pt.x, pt.y + 8 * z); g.closePath(); g.fill();
      g.fillStyle = "#ffc2e8"; g.beginPath(); g.arc(pt.x, pt.y - 1.5 * z, 4.2 * z, 0, 6.283); g.fill();
      g.fillStyle = "#fff1d6"; g.beginPath(); g.arc(pt.x, pt.y - 5 * z, 3 * z, 0, 6.283); g.fill();
    } else if (ST.roof === "beacon" || ST.roof === "bar" || ST.roof === "boom") {
      const blink = Math.floor(time * 5) % 2 === 0;
      cam.toScreen(x + k.c * (ST.roof === "boom" ? rm : rm + 0.05), y + k.s * (ST.roof === "boom" ? rm : rm + 0.05), H + 0.1, pt);
      g.fillStyle = blink ? "#ffb02a" : "#7a5410"; g.fillRect(pt.x - 3 * z, pt.y - 3 * z, 6 * z, 3.5 * z);
      if (ST.roof === "boom") { // winch arm over the bed
        g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 1.6 * z); g.beginPath();
        const A = W3(k, [x0 + 0.5, 0, bodyTop(x0) + 0.02]), B = W3(k, [x0 + 0.1, 0, bodyTop(x0) + 0.3]);
        g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      }
      if (night && blink) { const sx = pt.x, sy = pt.y; GLOW.push(() => { g.globalCompositeOperation = "lighter"; const grd = g.createRadialGradient(sx, sy, 0, sx, sy, 22 * z); grd.addColorStop(0, "rgba(255,176,42,.5)"); grd.addColorStop(1, "rgba(255,176,42,0)"); g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, 22 * z, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over"; }); }
    }
  }
  if (PT.aerial && !S.open) {   // a whip aerial off the back corner
    const A = W3(k, [rf0 + 0.05, hw * 0.7, roofZ]), B = W3(k, [rf0 - 0.12, hw * 0.78, roofZ + 0.3]);
    g.strokeStyle = "#1c1816"; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  if (ST.spare && !frontVisible) {
    const sp: number[][] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; sp.push(W3(k, [x0 - 0.04, Math.cos(a) * 0.12, H * 0.55 + Math.sin(a) * 0.12])); }
    g.fillStyle = "#121010"; g.beginPath(); sp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.fillStyle = "#8a8580"; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, p = W3(k, [x0 - 0.045, Math.cos(a) * 0.06, H * 0.55 + Math.sin(a) * 0.06]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.closePath(); g.fill();
  }
  if (S.wing) {
    const wx0 = x0 + 0.03, wx1 = x0 + 0.17, wh = bodyTop(x0) + (v.cls === "super" ? 0.16 : 0.13);
    g.strokeStyle = lit(paint, 0.4); g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
    for (const sy of [-hw * 0.6, hw * 0.6]) { const A = W3(k, [wx0 + 0.07, sy, bodyTop(x0)]), B = W3(k, [wx0 + 0.07, sy, wh]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
    fillPoly(k, [[wx0, -hw * 0.95, wh], [wx1, -hw * 0.95, wh + 0.02], [wx1, hw * 0.95, wh + 0.02], [wx0, hw * 0.95, wh]], lit(paint, v.cls === "super" ? 0.35 : 0.85));
  }

  // ---- lights (only on the ends that face the camera) ----
  const hl = night || v.siren ? (PT.yellowLamps ? "#f2d27a" : "#fff8d8") : PT.yellowLamps ? "#cdb878" : "#e8e2c8";
  const brake = v.speed < 0.5 && v.state === "drive" || v.speed < 0 || v.state === "crashed";
  const lampH = (S.hood + 0.02) * H * 0.82, tailH = S.deck * H * 0.8;
  for (const side of [-1, 1]) {
    if (frontVisible) {
      fillPoly(k, [[x1 + 0.005, side * hw * 0.42, lampH - 0.04], [x1 + 0.005, side * hw * 0.72, lampH - 0.03], [x1 + 0.005, side * hw * 0.72, lampH + 0.03], [x1 + 0.005, side * hw * 0.42, lampH + 0.03]], side === deadLamp ? "#2a2622" : hl);
    } else {
      fillPoly(k, [[x0 - 0.005, side * hw * 0.45, tailH - 0.035], [x0 - 0.005, side * hw * 0.82, tailH - 0.035], [x0 - 0.005, side * hw * 0.82, tailH + 0.03], [x0 - 0.005, side * hw * 0.45, tailH + 0.03]], brake ? "#ff3b2f" : night ? "#c8241a" : "#8a1a14");
    }
  }
  // grille / plate
  if (frontVisible) fillPoly(k, [[x1 + 0.006, -hw * 0.3, lampH - 0.08], [x1 + 0.006, hw * 0.3, lampH - 0.08], [x1 + 0.006, hw * 0.3, lampH], [x1 + 0.006, -hw * 0.3, lampH]], "rgba(14,11,10,.75)");
  else fillPoly(k, [[x0 - 0.006, -hw * 0.22, tailH - 0.14], [x0 - 0.006, hw * 0.22, tailH - 0.14], [x0 - 0.006, hw * 0.22, tailH - 0.07], [x0 - 0.006, -hw * 0.22, tailH - 0.07]], "#eee4d3");
  // lamp glow at night: a small halo on each lamp (not one big ball over the bonnet); a parked car nobody is in stays dark
  if (night && !(v.state === "parked" && v.driver < 0)) {
    const tail = !frontVisible;
    const col = tail ? "255,59,47" : PT.yellowLamps ? "255,222,140" : "255,246,210", r = (tail ? 6 : 8) * M.scale * z, a = tail && !brake ? 0.3 : 0.55;
    for (const side of [-1, 1]) {
      if (side === (tail ? deadTail : deadLamp)) continue; // smashed lamp: no light
      const P0 = W3(k, [tail ? x0 : x1, side * hw * (tail ? 0.63 : 0.57), tail ? tailH : lampH]);
      const sx = P0[0], sy = P0[1];
      GLOW.push(() => { g.globalCompositeOperation = "lighter"; const grd = g.createRadialGradient(sx, sy, 0, sx, sy, r); grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(1, `rgba(${col},0)`); g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, r, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over"; });
    }
  }

  // crash damage you can read: creases along a hit side, a hanging bumper, and a smoking bonnet once the front is bad
  for (const [sd, amt] of [[-1, dL], [1, dS]] as [number, number][]) {
    if (amt < 0.2) continue;
    g.strokeStyle = `rgba(14,11,10,${Math.min(0.8, 0.35 + amt * 0.5).toFixed(2)})`; g.lineWidth = Math.max(1, 1.3 * z);
    for (let i = 0; i < 1 + Math.round(amt * 3); i++) {
      const u = -0.25 + i * 0.18, zz = H * (0.32 + (i % 2) * 0.08);
      const A = W3(k, [u * L, sd * hw * 1.01, zz]), B = W3(k, [(u + 0.06) * L, sd * hw * 1.01, zz + 0.05]), C = W3(k, [(u + 0.12) * L, sd * hw * 1.01, zz - 0.02]);
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.stroke();
    }
  }
  if (dF > 0.5 && frontVisible) {
    const A = W3(k, [x1 + 0.01, -hw * 0.7, 0.1]), B = W3(k, [x1 + 0.04, hw * 0.5, 0.03]);
    g.strokeStyle = "#1a1714"; g.lineWidth = Math.max(1.5, 2.2 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  if (dF > 0.45 || v.damage > 0.75) {
    for (let i = 0; i < 4; i++) {
      const ph = (time * 0.5 + i / 4) % 1;
      const p = W3(k, [x1 - L * 0.18, (i % 2 ? 0.08 : -0.08), bodyTop(x1 - L * 0.18) + ph * 0.9]);
      g.fillStyle = `rgba(${dF > 0.75 ? "40,36,34" : "190,186,180"},${((1 - ph) * 0.35).toFixed(3)})`;
      g.beginPath(); g.arc(p[0] + Math.sin(time * 2 + i) * 3 * z, p[1], (0.06 + ph * 0.16) * z * 10, 0, 6.283); g.fill();
    }
  }

  // Glass fractures remain fixed to panels; leaks and loose trim sit on the road.
  if ((v.glassDamage ?? 0) > 0.35) {
    for (const f of glassFaces.slice(0, 4)) {
      const C = W3(k, onFace(f, 0.5, 0.5));
      g.strokeStyle = (v.glassDamage ?? 0) > 0.8 ? "#111" : "rgba(235,245,255,.8)";
      g.lineWidth = Math.max(1, z);
      for (let i=0;i<5;i++) { const E=W3(k,onFace(f,(i%2)*0.9+0.05,i/5)); g.beginPath();g.moveTo(C[0],C[1]);g.lineTo(E[0],E[1]);g.stroke(); }
    }
  }
  if (v.leak) { const P=W3(k,[-L*.2,0,.01]);g.fillStyle="rgba(12,8,10,.75)";g.beginPath();g.ellipse(P[0],P[1]+8*z,12*z*v.leak,4*z,0,0,Math.PI*2);g.fill(); }
  if (v.bumperLost || v.mirrorLost) { const P=W3(k,[-L*.65,hw*1.3,.03]);g.strokeStyle="#aaa";g.lineWidth=2*z;g.beginPath();g.moveTo(P[0]-5*z,P[1]);g.lineTo(P[0]+5*z,P[1]+3*z);g.stroke(); }
  if (v.burning) { for(let i=0;i<5;i++){const P=W3(k,[x1-L*.2,(i-2)*.06,H*.7]);g.fillStyle=i%2?"#ffb52e":"#ec3b12";g.beginPath();g.moveTo(P[0]-4*z,P[1]);g.lineTo(P[0]+Math.sin(time*9+i)*3*z,P[1]-(10+Math.sin(time*7+i)*5)*z);g.lineTo(P[0]+4*z,P[1]);g.fill();} }
  if (v.burnt && (v.burntAge ?? 0) < 0.8) { const P=W3(k,[0,0,H]); const r=(12+(v.burntAge??0)*40)*z; g.fillStyle="rgba(255,170,30,.6)";g.beginPath();g.arc(P[0],P[1],r,0,Math.PI*2);g.fill(); }
  if (v.flatLeft || v.flatRight || v.burnt) { const P=W3(k,[0,0,H+.2]);g.font=`${Math.max(9,10*z)}px monospace`;g.fillStyle="#f6b62c";g.fillText(v.burnt?"BURNT OUT":v.flatLeft&&v.flatRight?"FLAT TYRES":"FLAT TYRE",P[0]-25*z,P[1]); }

  if (v.forSale) {
    cam.toScreen(x, y, H + 0.55, pt);
    const fs = Math.max(8, Math.round(7 * z));
    g.font = `700 ${fs}px "IBM Plex Mono", monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    const label = `$${v.price.toLocaleString("en-NZ")}`;
    const w = g.measureText(label).width + fs;
    g.fillStyle = "#c6ff3d"; g.fillRect(pt.x - w / 2, pt.y - fs * 0.8, w, fs * 1.6);
    g.fillStyle = "#0e0b0a"; g.fillText(label, pt.x, pt.y + 1); g.textAlign = "start"; g.textBaseline = "alphabetic";
  }
  // brake glow at night: a soft halo over the tail lamps while braking
  if (brake && night && !frontVisible) {
    const bp = W3(k, [x0, 0, S.deck * H * 0.8]), br = 14 * M.scale * z;
    GLOW.push(() => {
      g.globalCompositeOperation = "lighter";
      const grd = g.createRadialGradient(bp[0], bp[1], 0, bp[0], bp[1], br);
      grd.addColorStop(0, "rgba(255,59,47,.45)"); grd.addColorStop(1, "rgba(255,59,47,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(bp[0], bp[1], br, 0, 6.283); g.fill();
      g.globalCompositeOperation = "source-over";
    });
  }
  // exhaust: three puffs rising from the back of a moving car, bigger for bigger engines
  if (Math.abs(v.speed) > 0.3 || v.state === "drive") {
    for (let i = 0; i < 3; i++) {
      const ph = (time * 0.9 + i / 3 + spin * 0.01) % 1;
      const p = W3(k, [x0 - 0.04 - ph * 0.5 * M.scale, (i % 2 ? 1 : -1) * hw * 0.45, 0.06 + ph * 0.4 * M.scale]);
      g.fillStyle = `rgba(200,196,190,${((1 - ph) * 0.28).toFixed(3)})`;
      g.beginPath(); g.arc(p[0], p[1], (0.035 + ph * 0.12) * M.scale * z * 10, 0, 6.283); g.fill();
    }
  }
  if (selected) { cam.toScreen(x, y, 0, pt); g.strokeStyle = "#c6ff3d"; g.lineWidth = 2; g.beginPath(); g.ellipse(pt.x, pt.y, L * 26 * z, L * 13 * z, 0, 0, 6.283); g.stroke(); }
}

/** Headlight beams (drawn in the lighting pass, additive): a beam from each lamp fanning onto a lit pool of road ahead. */
export function headlights(g: CanvasRenderingContext2D, cam: Camera, v: Vehicle, strength: number): void {
  if (strength < 0.1 || v.state === "parked" && v.driver < 0) return;
  const d = VEHICLES[v.cls], M = carMutationOf(v.plate, v.cls);
  const ca = Math.cos(v.heading), sa = Math.sin(v.heading);
  const L = d.length * M.scale, hw = d.width * M.scale * 0.36, reach = 9 * M.scale, spread = 1.5 * M.scale;
  const nx = v.x + ca * (L * 0.5 + 0.1), ny = v.y + sa * (L * 0.5 + 0.1);
  const p = { x: 0, y: 0 }, q = { x: 0, y: 0 }, c = { x: 0, y: 0 }, e = { x: 0, y: 0 };
  // the lit pool on the road: brightest a few metres ahead, soft at the edges
  const px = nx + ca * reach * 0.55, py = ny + sa * reach * 0.55;
  cam.toScreen(px, py, 0, p); cam.toScreen(px + ca * reach * 0.5, py + sa * reach * 0.5, 0, q); cam.toScreen(px - sa * spread, py + ca * spread, 0, c);
  const rL = Math.hypot(q.x - p.x, q.y - p.y), rW = Math.hypot(c.x - p.x, c.y - p.y);
  g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(q.y - p.y, q.x - p.x)); g.scale(1, rW / Math.max(rL, 1));
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, rL);
  pool.addColorStop(0, `rgba(255,236,180,${0.26 * strength})`); pool.addColorStop(0.6, `rgba(255,236,180,${0.1 * strength})`); pool.addColorStop(1, "rgba(255,236,180,0)");
  g.fillStyle = pool; g.beginPath(); g.arc(0, 0, rL, 0, 6.283); g.fill(); g.restore();
  // one cone per lamp, slightly toed out, so the beams read as two
  for (const s of [-1, 1]) {
    const lx = nx - sa * hw * s, ly = ny + ca * hw * s;
    const fx = lx + ca * reach - sa * s * 0.6, fy = ly + sa * reach + ca * s * 0.6;
    cam.toScreen(lx - sa * 0.08, ly + ca * 0.08, 0, p); cam.toScreen(lx + sa * 0.08, ly - ca * 0.08, 0, q);
    cam.toScreen(fx + sa * spread * 0.6, fy - ca * spread * 0.6, 0, c); cam.toScreen(fx - sa * spread * 0.6, fy + ca * spread * 0.6, 0, e);
    const grd = g.createLinearGradient((p.x + q.x) / 2, (p.y + q.y) / 2, (c.x + e.x) / 2, (c.y + e.y) / 2);
    grd.addColorStop(0, `rgba(255,246,210,${0.32 * strength})`); grd.addColorStop(0.5, `rgba(255,240,190,${0.12 * strength})`); grd.addColorStop(1, "rgba(255,240,190,0)");
    g.fillStyle = grd; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.lineTo(q.x, q.y); g.closePath(); g.fill();
    // a tight hot core at the lamp itself
    cam.toScreen(lx, ly, 0.35, p);
    const r = 4 * M.scale * cam.zoom;
    const core = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    core.addColorStop(0, `rgba(255,255,240,${0.75 * strength})`); core.addColorStop(0.35, `rgba(255,248,215,${0.3 * strength})`); core.addColorStop(1, "rgba(255,248,215,0)");
    g.fillStyle = core; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fill();
  }
}
