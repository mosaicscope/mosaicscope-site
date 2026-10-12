import type { Vehicle } from "../entities/types";
import { VEHICLES, VehicleClass } from "../content/vehicles";
import type { Camera } from "./Camera";
import { GLOW } from "./Buildings";

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

function wheel(k: Ctx, lx: number, ly: number, r: number, near: boolean, spin: number, rim: string): void {
  const g = k.g, pts: number[][] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283; pts.push(W3(k, [lx + Math.cos(a) * r, ly, r + Math.sin(a) * r])); }
  g.fillStyle = "#121010"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
  if (!near) return;
  const ri = r * 0.62;
  g.fillStyle = rim; g.beginPath();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; const p = W3(k, [lx + Math.cos(a) * ri, ly + Math.sign(ly) * 0.01, r + Math.sin(a) * ri]); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  g.closePath(); g.fill();
  // spokes turn with the wheel
  g.strokeStyle = "rgba(14,11,10,.55)"; g.lineWidth = Math.max(1, 0.8 * k.cam.zoom); g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = spin + (i / 5) * 6.283;
    const A = W3(k, [lx + Math.cos(a) * ri * 0.25, ly, r + Math.sin(a) * ri * 0.25]), B = W3(k, [lx + Math.cos(a) * ri * 0.92, ly, r + Math.sin(a) * ri * 0.92]);
    g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
  }
  g.stroke();
}

const spinOf = new WeakMap<Vehicle, number>();

export function drawCar(g: CanvasRenderingContext2D, cam: Camera, v: Vehicle, alpha: number, time: number, dark: number, selected: boolean): void {
  const d = VEHICLES[v.cls], S = SHAPES[v.cls];
  const x = v.px + (v.x - v.px) * alpha, y = v.py + (v.y - v.py) * alpha;
  const z = cam.zoom, ang = v.heading;
  const k: Ctx = { g, cam, x, y, c: Math.cos(ang), s: Math.sin(ang) };
  const L = d.length, hw = d.width / 2, H = d.height * 1.08;
  const x0 = -L / 2, x1 = L / 2;
  const night = dark > 0.35;
  const paint = rgb(v.cls === "police" ? "#f2f2ee" : v.cls === "ambulance" ? "#f4f1e6" : v.color);
  const dmg = 1 - v.damage * 0.35;
  const spin = (spinOf.get(v) ?? 0) + v.speed * 0.016 / (S.wheel * H);
  spinOf.set(v, spin);

  // contact shadow (soft, two layers)
  cam.toScreen(x, y, 0, pt);
  g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(pt.x, pt.y + 2 * z, L * 24 * z, L * 12.5 * z, 0, 0, 6.283); g.fill();
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(pt.x, pt.y + 1 * z, L * 18 * z, L * 9 * z, 0, 0, 6.283); g.fill();

  // neon underglow on tuned cars at night (replayed over the darkness)
  if (night && (v.cls === "jdm" || v.cls === "sports" || v.cls === "super" || v.cls === "muscle")) {
    const hue = ["255,122,217", "61,214,255", "198,255,61", "180,140,255"][v.plate.charCodeAt(0) % 4];
    const sx = pt.x, sy = pt.y, rx = L * 26 * z, ry = L * 13 * z;
    GLOW.push(() => {
      g.globalCompositeOperation = "lighter";
      const grd = g.createRadialGradient(sx, sy, 0, sx, sy, rx);
      grd.addColorStop(0, `rgba(${hue},.38)`); grd.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = grd; g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, 6.283); g.fill();
      g.globalCompositeOperation = "source-over";
    });
  }

  // which side faces the camera
  const nearSign = dot(WN(k, [0, 1, 0]), VIEW) > 0 ? 1 : -1;
  const wr = S.wheel * H, wx = L * (v.cls === "van" || v.cls === "ambulance" ? 0.33 : 0.31), wy = hw - 0.02;
  const rimCol = v.cls === "police" || v.cls === "ambulance" || v.cls === "van" ? "#8a8580" : v.cls === "super" || v.cls === "sports" ? "#2a2a2a" : "#cfc8c0";
  for (const lx of [wx, -wx]) wheel(k, lx, -nearSign * wy, wr, false, spin, rimCol);

  // ---- lower skirt ----
  const hs = H * 0.3, ground = 0.08;
  const bodyTop = (lx: number) => { const t = (lx - x0) / L; return H * (S.deck + (S.hood - S.deck) * Math.max(0, Math.min(1, (t - 0.25) / 0.75))); };
  const rSk0 = ring(x0 + 0.04, x1 - 0.04, hw * 0.9, S.cf, S.cr, () => ground);
  const rSk1 = ring(x0, x1, hw, S.cf, S.cr, () => hs);
  const lower = (n: V3) => lit(paint, shadeFor(n) * 0.72 * dmg);
  loft(k, rSk0, rSk1, lower);
  for (const lx of [wx, -wx]) wheel(k, lx, nearSign * wy, wr, true, spin, rimCol);

  // ---- body sides (with a slight tumblehome) and the bonnet/boot deck ----
  const rTop = ring(x0 + 0.03, x1 - 0.02, hw * 0.95, S.cf * 1.05, S.cr * 1.05, bodyTop);
  const sides = loft(k, rSk1, rTop, (n) => lit(paint, shadeFor(n) * dmg), "rgba(255,255,255,.32)");
  // shoulder crease highlight (the "gloss" line)
  for (const f of sides) {
    const A = W3(k, onFace(f, 0, 0.62)), B = W3(k, onFace(f, 1, 0.62));
    g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = Math.max(1, 1.2 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  cap(k, rTop, paint.map((c) => c * dmg) as [number, number, number], 14);
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
  if (S.tray) {
    // open tray behind the cab
    const tx0 = x0 + 0.06, tx1 = S.cab[0] * L - 0.04, th = bodyTop(tx0);
    fillPoly(k, [[tx0, -hw * 0.82, th - 0.02], [tx1, -hw * 0.82, th - 0.02], [tx1, hw * 0.82, th - 0.02], [tx0, hw * 0.82, th - 0.02]], "#1c1816");
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
  const rCab1 = ring(rf0, rf1, hw * S.rw, 0.1, 0.08, () => H);
  const pillar = lit(paint, 0.75 * dmg);
  const glassFaces = loft(k, rCab0, rCab1, (n, i) => {
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
    if (Math.abs(f.a0[0] - f.b0[0]) > L * 0.25 && !S.boxy) { const E = W3(k, onFace(f, 0.5, 0)), F = W3(k, onFace(f, 0.5, 1)); g.moveTo(E[0], E[1]); g.lineTo(F[0], F[1]); }
  }
  g.stroke();
  // window reflections
  if (!night) for (const f of glassFaces) {
    if (S.boxy) continue;
    fillPoly(k, [onFace(f, 0.15, 0.15), onFace(f, 0.3, 0.15), onFace(f, 0.5, 0.9), onFace(f, 0.35, 0.9)], "rgba(220,235,255,.16)");
  }
  cap(k, rCab1, paint.map((c) => c * dmg) as [number, number, number], 8);
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
  if (S.wing) {
    const wx0 = x0 + 0.03, wx1 = x0 + 0.17, wh = bodyTop(x0) + (v.cls === "super" ? 0.16 : 0.13);
    g.strokeStyle = lit(paint, 0.4); g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
    for (const sy of [-hw * 0.6, hw * 0.6]) { const A = W3(k, [wx0 + 0.07, sy, bodyTop(x0)]), B = W3(k, [wx0 + 0.07, sy, wh]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
    fillPoly(k, [[wx0, -hw * 0.95, wh], [wx1, -hw * 0.95, wh + 0.02], [wx1, hw * 0.95, wh + 0.02], [wx0, hw * 0.95, wh]], lit(paint, v.cls === "super" ? 0.35 : 0.85));
  }

  // ---- lights (only on the ends that face the camera) ----
  const fwd = WN(k, [1, 0, 0]), frontVisible = dot(fwd, VIEW) > 0;
  const hl = night || v.siren ? "#fff8d8" : "#e8e2c8";
  const brake = v.speed < 0.5 && v.state === "drive" || v.speed < 0 || v.state === "crashed";
  const lampH = (S.hood + 0.02) * H * 0.82, tailH = S.deck * H * 0.8;
  for (const side of [-1, 1]) {
    if (frontVisible) {
      fillPoly(k, [[x1 + 0.005, side * hw * 0.42, lampH - 0.04], [x1 + 0.005, side * hw * 0.72, lampH - 0.03], [x1 + 0.005, side * hw * 0.72, lampH + 0.03], [x1 + 0.005, side * hw * 0.42, lampH + 0.03]], hl);
    } else {
      fillPoly(k, [[x0 - 0.005, side * hw * 0.45, tailH - 0.035], [x0 - 0.005, side * hw * 0.82, tailH - 0.035], [x0 - 0.005, side * hw * 0.82, tailH + 0.03], [x0 - 0.005, side * hw * 0.45, tailH + 0.03]], brake ? "#ff3b2f" : night ? "#c8241a" : "#8a1a14");
    }
  }
  // grille / plate
  if (frontVisible) fillPoly(k, [[x1 + 0.006, -hw * 0.3, lampH - 0.08], [x1 + 0.006, hw * 0.3, lampH - 0.08], [x1 + 0.006, hw * 0.3, lampH], [x1 + 0.006, -hw * 0.3, lampH]], "rgba(14,11,10,.75)");
  else fillPoly(k, [[x0 - 0.006, -hw * 0.22, tailH - 0.14], [x0 - 0.006, hw * 0.22, tailH - 0.14], [x0 - 0.006, hw * 0.22, tailH - 0.07], [x0 - 0.006, -hw * 0.22, tailH - 0.07]], "#eee4d3");
  if (night) {
    const tail = !frontVisible;
    const P0 = W3(k, [tail ? x0 : x1, 0, tail ? tailH : lampH]);
    const sx = P0[0], sy = P0[1], col = tail ? "255,59,47" : "255,246,210", r = (tail ? 14 : 18) * z;
    GLOW.push(() => { g.globalCompositeOperation = "lighter"; const grd = g.createRadialGradient(sx, sy, 0, sx, sy, r); grd.addColorStop(0, `rgba(${col},${tail && !brake ? 0.25 : 0.45})`); grd.addColorStop(1, `rgba(${col},0)`); g.fillStyle = grd; g.beginPath(); g.arc(sx, sy, r, 0, 6.283); g.fill(); g.globalCompositeOperation = "source-over"; });
  }

  if (v.forSale) {
    cam.toScreen(x, y, H + 0.55, pt);
    const fs = Math.max(8, Math.round(7 * z));
    g.font = `700 ${fs}px "IBM Plex Mono", monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    const label = `$${v.price.toLocaleString("en-NZ")}`;
    const w = g.measureText(label).width + fs;
    g.fillStyle = "#c6ff3d"; g.fillRect(pt.x - w / 2, pt.y - fs * 0.8, w, fs * 1.6);
    g.fillStyle = "#0e0b0a"; g.fillText(label, pt.x, pt.y + 1); g.textAlign = "start"; g.textBaseline = "alphabetic";
  }
  if (selected) { cam.toScreen(x, y, 0, pt); g.strokeStyle = "#c6ff3d"; g.lineWidth = 2; g.beginPath(); g.ellipse(pt.x, pt.y, L * 26 * z, L * 13 * z, 0, 0, 6.283); g.stroke(); }
}

/** Headlight beams (drawn in the lighting pass, additive). */
export function headlights(g: CanvasRenderingContext2D, cam: Camera, v: Vehicle, strength: number): void {
  if (strength < 0.1 || v.state === "parked" && v.driver < 0) return;
  const d = VEHICLES[v.cls];
  const fx = v.x + Math.cos(v.heading) * (d.length * 0.5 + 1.6), fy = v.y + Math.sin(v.heading) * (d.length * 0.5 + 1.6);
  cam.toScreen(fx, fy, 0, pt);
  const r = 46 * cam.zoom;
  const grd = g.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
  grd.addColorStop(0, `rgba(255,240,190,${0.22 * strength})`); grd.addColorStop(1, "rgba(255,240,190,0)");
  g.fillStyle = grd; g.fillRect(pt.x - r, pt.y - r, r * 2, r * 2);
}
