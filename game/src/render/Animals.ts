/**
 * Procedural zoo animals in the stick-figure neon line style: thick round-capped outlines in a neon
 * colour over dark fills, simple shapes, a slight bob. Everything is drawn in "animal space"
 * (x forward, y up, 1 unit = Z_PX px at zoom 1) and mapped to the screen by a tiny inline
 * transform (mirror + optional rotation), so no canvas save/restore per animal. No shadowBlur.
 */
import { INK, PAPER, GOLD, PINK, CYAN } from "./palette";
import { TILE_W, TILE_H, Z_PX } from "../world/iso";

export type AnimalKind = "giraffe" | "elephant" | "zebra" | "lion" | "tiger" | "penguin" | "flamingo" | "peacock" | "parrot" | "kea" | "kiwi" | "toucan" | "owl" | "whale" | "dolphin" | "monkey" | "kangaroo" | "panda";

export interface AnimalDef { kind: AnimalKind; name: string; price: number; habitat: "land" | "water" | "air"; speed: number; blurb: string }

/** Prices in NZD. speed = tiles per second when walking / swimming / flying. */
export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  giraffe: { kind: "giraffe", name: "Giraffe", price: 180_000, habitat: "land", speed: 1.6, blurb: "Sees over the motorway. Still can't find a park." },
  elephant: { kind: "elephant", name: "Elephant", price: 350_000, habitat: "land", speed: 1.0, blurb: "Never forgets. Especially that you owe it a bun." },
  zebra: { kind: "zebra", name: "Zebra", price: 45_000, habitat: "land", speed: 2.2, blurb: "A horse that got really into barcodes." },
  lion: { kind: "lion", name: "Lion", price: 120_000, habitat: "land", speed: 1.8, blurb: "King of the jungle. Sleeps 20 hours. Relatable." },
  tiger: { kind: "tiger", name: "Tiger", price: 150_000, habitat: "land", speed: 1.9, blurb: "Grrreat for security. Terrible for the cat flap." },
  penguin: { kind: "penguin", name: "Little Penguin", price: 25_000, habitat: "water", speed: 0.6, blurb: "Wears a tux to every occasion. Even the beach." },
  flamingo: { kind: "flamingo", name: "Flamingo", price: 6_000, habitat: "land", speed: 1.0, blurb: "Pink from eating prawns. You are what you eat, bro." },
  peacock: { kind: "peacock", name: "Peacock", price: 2_500, habitat: "land", speed: 0.9, blurb: "Influencer. Shows the fan whether you asked or not." },
  parrot: { kind: "parrot", name: "Macaw", price: 4_000, habitat: "air", speed: 1.2, blurb: "Repeats everything you say. Especially the swears." },
  kea: { kind: "kea", name: "Kea", price: 1_800, habitat: "air", speed: 1.4, blurb: "Alpine genius. Will remove your windscreen wipers for free." },
  kiwi: { kind: "kiwi", name: "Kiwi", price: 15_000, habitat: "land", speed: 0.8, blurb: "Can't fly, won't fly. A national treasure with a nose for worms." },
  toucan: { kind: "toucan", name: "Toucan", price: 9_000, habitat: "air", speed: 1.1, blurb: "Ninety percent beak, ten percent attitude." },
  owl: { kind: "owl", name: "Morepork", price: 3_500, habitat: "air", speed: 1.0, blurb: "Says 'more pork' all night. Never says please." },
  whale: { kind: "whale", name: "Blue Whale", price: 4_500_000, habitat: "water", speed: 0.8, blurb: "Biggest animal ever. Needs a bigger tank. And a bigger tank." },
  dolphin: { kind: "dolphin", name: "Dolphin", price: 650_000, habitat: "water", speed: 2.5, blurb: "Smarter than your landlord. Better at backflips, too." },
  monkey: { kind: "monkey", name: "Monkey", price: 30_000, habitat: "land", speed: 1.5, blurb: "Steals sunnies. Has no regrets. No refunds." },
  kangaroo: { kind: "kangaroo", name: "Kangaroo", price: 12_000, habitat: "land", speed: 2.6, blurb: "Imported from across the ditch. Will box you for it." },
  panda: { kind: "panda", name: "Giant Panda", price: 1_200_000, habitat: "land", speed: 0.7, blurb: "Diplomatic loan. Eats bamboo, naps, costs a fortune." },
};

const T = 6.2832;
const SHADOW = "rgba(0,0,0,.35)";

// ---------------------------------------------------------------------------------------------
// Tiny local->screen transform (module state; set per animal, no allocations).
let G!: CanvasRenderingContext2D;
let OX = 0, OY = 0, U = 26, D = 1, ROT = 0, CR = 1, SR = 0, LW = 1.6;
const X = (x: number, y: number) => OX + (x * CR - y * SR) * U * D;
const Y = (x: number, y: number) => OY - (x * SR + y * CR) * U;
function rot(a: number): void { ROT = a; CR = Math.cos(a); SR = Math.sin(a); }
function M(x: number, y: number): void { G.moveTo(X(x, y), Y(x, y)); }
function L(x: number, y: number): void { G.lineTo(X(x, y), Y(x, y)); }
function Q(cx: number, cy: number, x: number, y: number): void { G.quadraticCurveTo(X(cx, cy), Y(cx, cy), X(x, y), Y(x, y)); }
function Bz(ax: number, ay: number, bx: number, by: number, x: number, y: number): void { G.bezierCurveTo(X(ax, ay), Y(ax, ay), X(bx, by), Y(bx, by), X(x, y), Y(x, y)); }
function C(x: number, y: number, r: number): void { const px = X(x, y), py = Y(x, y); G.moveTo(px + r * U, py); G.arc(px, py, r * U, 0, T); }
function E(x: number, y: number, rx: number, ry: number, a = 0): void {
  const px = X(x, y), py = Y(x, y), ang = D > 0 ? -(a + ROT) : a + ROT;
  G.moveTo(px + Math.cos(ang) * rx * U, py + Math.sin(ang) * rx * U);
  G.ellipse(px, py, rx * U, ry * U, ang, 0, T);
}
const B = () => G.beginPath();
function S(col: string, m = 1): void { G.strokeStyle = col; G.lineWidth = LW * m; G.stroke(); }
function F(col: string): void { G.fillStyle = col; G.fill(); }
function FS(fill: string, col: string, m = 1): void { F(fill); S(col, m); }
const sm = (a: number) => (a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a));

function setup(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, dir: number, scale: number): void {
  G = g; OX = sx; OY = sy; U = Z_PX * z * scale; D = dir < 0 ? -1 : 1; rot(0);
  LW = Math.max(1.1, 1.55 * z);
  g.lineCap = "round"; g.lineJoin = "round"; g.globalAlpha = 1;
}
function shadow(x: number, rx: number): void { B(); E(x, 0, rx, rx * 0.28); F(SHADOW); }

/** One two-segment leg from (x, top) of length len. w = gait phase, amp = 0..1 stride. knee: +1 knee forward, -1 back. */
function leg(x: number, top: number, len: number, w: number, amp: number, knee = 1): void {
  const sw = Math.sin(w) * 0.42 * amp, lift = Math.max(0, Math.cos(w)) * amp * 0.75, h = len / 2;
  const kx = x + Math.sin(sw) * h + knee * lift * 0.12, ky = top - Math.cos(sw) * h;
  const a2 = sw - knee * lift;
  M(x, top); L(kx, ky); L(kx + Math.sin(a2) * h, ky - Math.cos(a2) * h * (1 - lift * 0.15));
}
/** Far pair of a quadruped (dimmed, slightly up-and-back for depth). */
function farLegs(fx: number, bx: number, top: number, len: number, w: number, amp: number, col: string, m = 1): void {
  G.globalAlpha = 0.55; B(); leg(fx - 0.07, top + 0.03, len + 0.03, w + Math.PI, amp); leg(bx - 0.07, top + 0.03, len + 0.03, w, amp, -1); S(col, m); G.globalAlpha = 1;
}
function nearLegs(fx: number, bx: number, top: number, len: number, w: number, amp: number, col: string, m = 1): void {
  B(); leg(fx, top, len, w, amp); leg(bx, top, len, w + Math.PI, amp, -1); S(col, m);
}
function eye(x: number, y: number, r: number, col: string): void { B(); C(x, y, r); F(col); }

/** Periodic 0..1 pulse: "open" for `on` seconds out of every `period`, with `ramp` fades. */
function pulse(t: number, period: number, on: number, ramp: number): number {
  const c = ((t % period) + period) % period;
  return c < on ? sm(Math.min(c, on - c) / ramp) : 0;
}

// ---------------------------------------------------------------------------------------------
// Land mammals

function giraffe(t: number, ph: number, mv: number): void {
  const col = GOLD, fill = "#2a1a08", spot = "#b8661a";
  const w = ph + t * 6, bob = Math.sin(t * 1.7 + ph) * 0.02 - Math.abs(Math.cos(w)) * 0.05 * mv;
  OY -= bob * U;
  const sway = Math.sin(t * 0.8 + ph) * 0.09 * (1 - mv * 0.5) + mv * 0.08;
  const graze = pulse(t + ph * 3, 9, 2.6, 0.7) * (1 - mv);
  const hx = 0.98 + sway + graze * 0.25, hy = 3.0 - graze * 0.55;
  shadow(0.1, 0.8);
  farLegs(0.42, -0.42, 1.48, 1.48, w, mv, col);
  B(); M(-0.58, 1.68); Q(-0.7, 1.4, -0.66, 1.08); S(col, 0.7); B(); C(-0.66, 1.04, 0.05); F(col);
  B(); E(0, 1.62, 0.62, 0.3, 0.14); FS(fill, col);
  B(); M(0.2, 1.78); Q(0.55, 2.2, hx - 0.14, hy - 0.08); L(hx + 0.02, hy - 0.12); Q(0.8, 2.0, 0.6, 1.55); F(fill);
  B(); M(0.2, 1.78); Q(0.55, 2.2, hx - 0.14, hy - 0.08); M(hx + 0.02, hy - 0.12); Q(0.8, 2.0, 0.6, 1.55); S(col);
  B(); C(-0.3, 1.7, 0.1); C(0.05, 1.55, 0.09); C(0.32, 1.72, 0.08); C(-0.1, 1.82, 0.07); C(-0.42, 1.52, 0.07);
  C(0.5 + sway * 0.3, 2.0 - graze * 0.15, 0.06); C(0.66 + sway * 0.6, 2.3 - graze * 0.3, 0.055); C(0.78 + sway * 0.8, 2.6 - graze * 0.4, 0.05); F(spot);
  nearLegs(0.42, -0.42, 1.48, 1.48, w, mv, col);
  B(); E(hx, hy, 0.22, 0.1, -0.35 - graze * 0.6); FS(fill, col);
  B(); M(hx - 0.1, hy + 0.06); L(hx - 0.13, hy + 0.24); M(hx - 0.01, hy + 0.08); L(hx, hy + 0.25); M(hx - 0.16, hy + 0.03); L(hx - 0.3, hy + 0.1); S(col, 0.8);
  B(); C(hx - 0.13, hy + 0.25, 0.035); C(hx, hy + 0.26, 0.035); F(col);
  eye(hx - 0.02, hy + 0.03, 0.025, col);
  B(); M(0.16, 1.86); Q(0.5, 2.28, hx - 0.17, hy - 0.0); S("#b8661a", 1.1);
}

function elephant(t: number, ph: number, mv: number): void {
  const col = "#a9c1ff", fill = "#151a26";
  const w = ph + t * 4.2, bob = Math.sin(t * 1.5 + ph) * 0.015 - Math.abs(Math.cos(w)) * 0.04 * mv;
  OY -= bob * U;
  shadow(0.1, 1.0);
  farLegs(0.5, -0.5, 0.95, 0.95, w, mv * 0.7, col, 3.2);
  B(); M(-0.88, 1.35); Q(-1.0, 1.05, -0.96, 0.8); S(col, 0.6);
  B(); E(0, 1.3, 0.92, 0.62); FS(fill, col);
  nearLegs(0.5, -0.5, 0.95, 0.95, w, mv * 0.7, col, 3.6);
  B(); nearLegsInk(0.5, -0.5, 0.95, w, mv * 0.7); S(fill, 2.0);
  // head, trunk, tusk, ear
  const sw = Math.sin(t * 1.9 + ph) * 0.18 + mv * Math.sin(w) * 0.12, trumpet = pulse(t + ph * 5, 13, 1.6, 0.4);
  B(); C(0.88, 1.55, 0.42); FS(fill, col);
  B(); M(1.2, 1.45); Q(1.5 + sw, 1.1 + trumpet * 0.6, 1.38 + sw * 1.5 + trumpet * 0.5, 0.5 + trumpet * 1.35);
  Q(1.32 + sw * 1.6 + trumpet * 0.5, 0.36 + trumpet * 1.4, 1.24 + sw * 1.2 + trumpet * 0.45, 0.46 + trumpet * 1.4);
  S(col, 3.4); S(fill, 1.6);
  B(); M(1.12, 1.3); Q(1.32, 1.2, 1.38, 1.36); S(PAPER, 1.2);
  const flap = 0.85 + Math.sin(t * 3.2 + ph) * 0.15;
  B(); E(0.66, 1.48, 0.34 * flap, 0.48, 0.08); FS("#1d2436", col);
  eye(1.02, 1.66, 0.04, col);
}
/** Inner dark core for the elephant's near legs, so they read as pillars, not lines. */
function nearLegsInk(fx: number, bx: number, top: number, w: number, amp: number): void {
  leg(fx, top - 0.05, top - 0.1, w, amp); leg(bx, top - 0.05, top - 0.1, w + Math.PI, amp, -1);
}

function zebra(t: number, ph: number, mv: number): void {
  const col = PAPER, fill = "#ddd3c2", ink = "#141110";
  const w = ph + t * 7, bob = Math.sin(t * 2 + ph) * 0.012 - Math.abs(Math.cos(w)) * 0.05 * mv;
  OY -= bob * U;
  const graze = pulse(t + ph * 4, 8, 2.2, 0.5) * (1 - mv);
  const hx = 0.78 + graze * 0.12, hy = 1.48 - graze * 0.95;
  shadow(0.1, 0.7);
  farLegs(0.42, -0.42, 0.82, 0.82, w, mv, col, 1.3);
  B(); M(-0.55, 1.0); Q(-0.7, 0.8 + Math.sin(t * 3 + ph) * 0.05, -0.68, 0.6); S(col, 0.8);
  B(); C(-0.68, 0.58, 0.04); F(ink);
  // neck (wide wedge) + body
  B(); M(0.18, 1.12); L(hx - 0.06, hy + 0.06); L(hx + 0.12, hy - 0.06); L(0.58, 0.84); G.closePath(); FS(fill, col);
  B(); E(0, 0.97, 0.58, 0.25); FS(fill, col);
  B(); M(0.18, 1.12); L(0.58, 0.84); F(fill);
  // stripes: body, neck, rump chevrons
  B();
  for (let i = -3; i <= 4; i++) {
    const x = i * 0.115, hh = 0.25 * Math.sqrt(Math.max(0, 1 - (x / 0.58) ** 2)) * 0.88;
    M(x - 0.04, 0.97 + hh); Q(x + 0.03, 0.97, x + 0.01, 0.97 - hh);
  }
  M(-0.54, 1.02); L(-0.4, 0.92); L(-0.52, 0.85);
  for (let i = 1; i <= 4; i++) { const f = i / 5; M(0.18 + (hx - 0.24) * f, 1.12 + (hy - 1.06) * f); L(0.58 + (hx - 0.46) * f, 0.84 + (hy - 0.9) * f); }
  S(ink, 1.1);
  nearLegs(0.42, -0.42, 0.82, 0.82, w, mv, col, 1.3);
  B(); for (let i = 0; i < 2; i++) { const x = i ? -0.42 : 0.42; M(x - 0.05, 0.45); L(x + 0.05, 0.45); M(x - 0.05, 0.3); L(x + 0.05, 0.3); } S(ink, 0.6);
  // mane
  B(); M(0.16, 1.16); L(hx - 0.06, hy + 0.12); S(ink, 1.6);
  // head: points down-forward from the poll
  const ha = -1.0 - graze * 0.5, cx = hx + Math.cos(ha) * 0.17, cy = hy + Math.sin(ha) * 0.17;
  B(); E(cx, cy, 0.24, 0.09, ha); FS(fill, col);
  B(); E(hx + Math.cos(ha) * 0.34, hy + Math.sin(ha) * 0.34, 0.07, 0.07); F(ink);
  B(); M(hx - 0.04, hy + 0.04); L(hx - 0.08, hy + 0.2); M(hx + 0.03, hy + 0.04); L(hx + 0.04, hy + 0.2); S(col, 0.9);
  eye(cx - 0.02, cy + 0.05, 0.025, ink);
}

function bigCat(t: number, ph: number, mv: number, mane: boolean): void {
  const col = mane ? "#ffc23d" : "#ff7a1c", fill = mane ? "#2a1a06" : "#2a1204";
  const w = ph + t * 6.5, bob = Math.sin(t * 1.6 + ph) * 0.012 - Math.abs(Math.cos(w)) * 0.04 * mv;
  OY -= bob * U;
  const len = mane ? 0.5 : 0.48, top = len, bl = mane ? 0.55 : 0.62;
  shadow(0, 0.7);
  farLegs(0.4, -0.42, top, len, w, mv, col, 1.3);
  const flick = Math.sin(t * 2.3 + ph) * 0.12;
  B(); M(-bl, 0.72); Q(-bl - 0.35, 0.65 + (mane ? 0 : 0.4), -bl - 0.42, mane ? 0.42 + flick : 0.95 + flick); S(col, 0.9);
  if (mane) { B(); C(-bl - 0.42, 0.4 + flick, 0.06); F("#c25a12"); }
  B(); E(0, 0.68, bl, 0.22, 0.03); FS(fill, col);
  if (!mane) { B(); for (let i = -3; i <= 3; i++) { const x = i * 0.15; M(x - 0.04, 0.88); Q(x + 0.04, 0.72, x - 0.02, 0.58); } S(col, 0.75); }
  nearLegs(0.4, -0.42, top, len, w, mv, col, 1.3);
  const roar = pulse(t + ph * 6, 11, 1.3, 0.3), hx = 0.62, hy = 0.88 + roar * 0.05;
  if (mane) {
    B();
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * T, r = i % 2 ? 0.24 : 0.33; const x = hx - 0.04 + Math.cos(a) * r, y = hy + Math.sin(a) * r * 0.95; if (i) L(x, y); else M(x, y); }
    G.closePath(); FS("#7a300c", "#ff8a1c");
  } else {
    B(); C(hx - 0.06, hy + 0.15, 0.06); C(hx + 0.06, hy + 0.16, 0.06); FS(fill, col);
  }
  B(); C(hx + 0.03, hy, 0.16); FS(fill, col);
  if (!mane) { B(); M(hx - 0.06, hy + 0.13); L(hx - 0.03, hy + 0.06); M(hx + 0.12, hy + 0.12); L(hx + 0.09, hy + 0.05); S(col, 0.6); }
  B(); E(hx + 0.15, hy - 0.05, 0.08, 0.06); FS(fill, col);
  if (roar > 0.05) { B(); E(hx + 0.18, hy - 0.11, 0.05, 0.04 * roar + 0.005); F("#ff4a6a"); }
  eye(hx + 0.09, hy + 0.04, 0.025, col);
  B(); C(hx + 0.22, hy - 0.03, 0.022); F(INK);
}

function monkey(t: number, ph: number, mv: number): void {
  const col = "#e09a4e", fill = "#2a1708", face = "#e8c08a";
  const w = ph + t * 7, bob = Math.sin(t * 2.2 + ph) * 0.02 - Math.abs(Math.cos(w)) * 0.05 * mv;
  OY -= bob * U;
  shadow(0, 0.35);
  // arms swing in big loops when idle, counter-swing when walking
  const s = t * 3.2 + ph, aL = mv > 0.5 ? Math.sin(w) * 0.8 : Math.sin(s) * 1.5 + 1.2, aR = mv > 0.5 ? -Math.sin(w) * 0.8 : -Math.sin(s) * 1.5 + 1.2;
  const sx = 0.06, sy = 0.76;
  const arm = (a: number) => { const ex = sx + Math.sin(a) * 0.26, ey = sy - Math.cos(a) * 0.26, a2 = a + 0.5; M(sx, sy); L(ex, ey); L(ex + Math.sin(a2) * 0.26, ey - Math.cos(a2) * 0.26); };
  G.globalAlpha = 0.6; B(); arm(aR); leg(-0.06, 0.42, 0.42, w + Math.PI, mv); S(col, 1.1); G.globalAlpha = 1;
  B(); M(-0.1, 0.46); Q(-0.45, 0.35, -0.42, 0.72); Q(-0.4, 0.92, -0.28, 0.82); S(col, 0.9);
  B(); E(0.02, 0.6, 0.14, 0.22, -0.18); FS(fill, col);
  B(); leg(0.0, 0.42, 0.42, w, mv); S(col, 1.2);
  B(); C(0.1, 0.92, 0.13); C(-0.02, 0.96, 0.05); FS(fill, col);
  B(); E(0.16, 0.9, 0.08, 0.075); F(face);
  eye(0.15, 0.93, 0.018, INK); eye(0.21, 0.93, 0.018, INK);
  B(); M(0.14, 0.86); Q(0.18, 0.84, 0.22, 0.87); S(INK, 0.5);
  B(); arm(aL); S(col, 1.2);
}

function kangaroo(t: number, ph: number, mv: number): void {
  const col = "#e8a060", fill = "#2a160a";
  const w = ph + t * 5.5, air = Math.abs(Math.sin(w)) * mv, idleHop = (1 - mv) * pulse(t + ph * 2, 7, 0.5, 0.25);
  const lift = air * 0.42 + idleHop * 0.15;
  shadow(0.05, 0.5);
  OY -= (lift + Math.sin(t * 1.6 + ph) * 0.01) * U;
  rot(-air * 0.3);
  const e = air + idleHop * 0.5; // leg extension
  B(); M(-0.1, 0.5); Q(-0.45, 0.2 + e * 0.15, -0.85, 0.04 + e * 0.25); S(col, 2.2); S(fill, 0.9);
  B(); E(0.04, 0.8, 0.2, 0.36, -0.42); FS(fill, col);
  B(); E(-0.02, 0.5, 0.2, 0.15, 0.2); FS(fill, col);
  B(); M(0.02, 0.48); L(0.2 - e * 0.12, 0.3 - e * 0.05); L(-0.06 - e * 0.1, 0.06 - e * 0.04); L(0.26 - e * 0.15, 0 - e * 0.08); S(col, 1.3);
  B(); M(0.16, 0.98); L(0.3, 0.86); L(0.36, 0.9); M(0.14, 0.94); L(0.26, 0.8); S(col, 0.8);
  const tw = Math.sin(t * 4 + ph) > 0.92 ? 0.15 : 0;
  B(); E(0.14, 1.36, 0.045, 0.14, 0.35 + tw); E(0.06, 1.34, 0.045, 0.14, 0.55); FS(fill, col);
  B(); E(0.24, 1.2, 0.13, 0.09, -0.25); FS(fill, col);
  B(); C(0.36, 1.17, 0.025); F(INK);
  eye(0.24, 1.24, 0.022, col);
}

function panda(t: number, ph: number, mv: number): void {
  const col = PAPER, white = "#d9d1c2", black = "#141414";
  const w = ph + t * 4, bob = Math.sin(t * 1.4 + ph) * 0.015 - Math.abs(Math.cos(w)) * 0.04 * mv;
  OY -= bob * U;
  shadow(0, 0.7);
  farLegs(0.36, -0.36, 0.48, 0.48, w, mv * 0.8, col, 3.4);
  G.globalAlpha = 0.8; B(); leg(0.29, 0.46, 0.46, w + Math.PI, mv * 0.8); leg(-0.43, 0.46, 0.46, w, mv * 0.8, -1); S(black, 2.2); G.globalAlpha = 1;
  B(); E(0, 0.66, 0.56, 0.34); FS(white, col);
  B(); M(0.02, 0.99); Q(0.18, 0.6, 0.06, 0.33); L(0.34, 0.33); Q(0.42, 0.75, 0.28, 0.98); G.closePath(); F(black);
  nearLegs(0.36, -0.36, 0.48, 0.48, w, mv * 0.8, col, 3.6);
  B(); nearLegsInk(0.36, -0.36, 0.48, w, mv * 0.8); S(black, 2.9);
  const chew = Math.sin(t * 7 + ph) * 0.03 * (1 - mv), hx = 0.6, hy = 0.86;
  B(); C(hx - 0.14, hy + 0.2, 0.08); C(hx + 0.1, hy + 0.21, 0.08); FS(black, col);
  B(); C(hx, hy, 0.24); FS(white, col);
  B(); E(hx - 0.04, hy + 0.04, 0.06, 0.08, 0.5); E(hx + 0.13, hy + 0.04, 0.06, 0.08, -0.5); F(black);
  eye(hx - 0.03, hy + 0.05, 0.02, PAPER); eye(hx + 0.12, hy + 0.05, 0.02, PAPER);
  B(); C(hx + 0.06, hy - 0.06, 0.03); F(black);
  if (mv < 0.5) { B(); M(hx + 0.02, hy - 0.14 + chew); L(hx + 0.5, hy + 0.05 + chew); S("#5fdc4a", 1.2); B(); M(hx + 0.4, hy + 0.01 + chew); L(hx + 0.48, hy + 0.14 + chew); S("#5fdc4a", 0.8); }
}

// ---------------------------------------------------------------------------------------------
// Birds

function penguin(t: number, ph: number, mv: number): void {
  const col = CYAN, fill = "#0b141c";
  const w = ph + t * 9;
  shadow(0, 0.24);
  rot(Math.sin(w) * 0.16 * mv + Math.sin(t * 1.2 + ph) * 0.03);
  OY -= (Math.abs(Math.sin(w)) * 0.03 * mv) * U;
  const fl = pulse(t + ph * 3, 6, 0.9, 0.2), flap = Math.sin(t * 18) * 0.35 * fl + mv * 0.15;
  B(); M(0.04 + Math.sin(w) * 0.06 * mv, 0.04); L(0.16, Math.max(0, Math.sin(w)) * 0.04 * mv); M(-0.06 - Math.sin(w) * 0.06 * mv, 0.04); L(0.06, Math.max(0, -Math.sin(w)) * 0.04 * mv); S(GOLD, 1.2);
  B(); E(0, 0.32, 0.18, 0.29); FS(fill, col);
  B(); E(0.06, 0.28, 0.11, 0.22); F(PAPER);
  B(); C(0.03, 0.62, 0.11); FS(fill, col);
  B(); M(0.12, 0.65); L(0.23, 0.6); L(0.12, 0.59); FS(GOLD, GOLD, 0.6);
  eye(0.07, 0.65, 0.022, PAPER);
  B(); M(-0.06, 0.48); L(-0.18 - flap * 0.25, 0.2 + flap * 0.2); S(col, 1.4);
}

function flamingo(t: number, ph: number, mv: number): void {
  const col = PINK, fill = "#3a0f26";
  const w = ph + t * 5;
  const bob = Math.sin(t * 1.4 + ph) * 0.015;
  OY -= bob * U;
  shadow(0, 0.25);
  const hipY = 0.86;
  B();
  if (mv > 0.15) { leg(0, hipY, hipY, w, mv, -1); leg(0, hipY, hipY, w + Math.PI, mv, -1); }
  else { M(0, hipY); L(0.02, hipY / 2); L(0, 0); M(0, hipY); L(0.13, 0.6); L(-0.04, 0.66); }
  S(col, 0.8);
  const dip = pulse(t + ph * 4, 10, 2.4, 0.6) * (1 - mv);
  B(); E(-0.02, 0.96, 0.27, 0.13, 0.12); FS(fill, col);
  B(); M(-0.24, 0.98); L(-0.36, 0.92); L(-0.22, 0.9); FS(fill, col, 0.7);
  const hx = 0.18 + dip * 0.25 + Math.sin(t * 0.9 + ph) * 0.03, hy = 1.56 - dip * 1.0;
  B(); M(0.2, 1.02); Bz(0.46, 1.12 + dip * 0.1, -0.05 + dip * 0.2, 1.38 - dip * 0.5, hx, hy - 0.04); S(col, 1.3);
  B(); C(hx, hy, 0.06); FS(fill, col);
  B(); M(hx + 0.04, hy + 0.02); L(hx + 0.15, hy - 0.04); L(hx + 0.13, hy - 0.13); S(PAPER, 0.8);
  B(); M(hx + 0.14, hy - 0.08); L(hx + 0.13, hy - 0.13); S(INK, 0.8);
  eye(hx + 0.015, hy + 0.015, 0.016, PAPER);
}

function peacock(t: number, ph: number, mv: number): void {
  const col = "#3d9bff", fill = "#0a1430", green = "#2ee6a0";
  const w = ph + t * 6, bob = Math.sin(t * 1.8 + ph) * 0.012;
  OY -= bob * U;
  const open = pulse(t + ph * 5, 12, 4.5, 0.8) * (1 - mv);
  shadow(0, 0.3 + open * 0.4);
  if (open > 0.03) {
    const R = 0.92 * open, cx = -0.12, cy = 0.45, n = 11, a0 = 0.2, a1 = Math.PI - 0.05;
    B(); M(cx, cy);
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); L(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
    G.closePath(); FS("#06231a", green);
    B(); for (let i = 1; i < n; i++) { const a = a0 + (a1 - a0) * (i / n); M(cx, cy); L(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); } S(green, 0.5);
    B(); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); C(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, 0.055 * open); } for (let i = 1; i < n; i += 2) { const a = a0 + (a1 - a0) * (i / n); C(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, 0.045 * open); } F("#3d7bff");
    B(); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); C(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, 0.022 * open); } F(GOLD);
  }
  if (open < 0.6) {
    const k = 1 - open;
    B(); M(-0.16, 0.44); Q(-0.6 * k, 0.32, -1.0 * k, 0.1 + open * 0.3); L(-0.95 * k, 0.2 + open * 0.3); Q(-0.5 * k, 0.42, -0.14, 0.5); G.closePath(); FS("#06231a", green);
    B(); C(-0.75 * k, 0.17 + open * 0.3, 0.035); C(-0.5 * k, 0.29, 0.035); F(GOLD);
  }
  B(); leg(0.02, 0.32, 0.32, w, mv, -1); leg(0.02, 0.32, 0.32, w + Math.PI, mv, -1); S("#9a8d80", 0.7);
  B(); E(0, 0.42, 0.22, 0.14, 0.25); FS(fill, col);
  const nod = Math.sin(w * 2) * 0.03 * mv;
  B(); M(0.14, 0.48); L(0.24 + nod, 0.82); S(col, 1.9);
  B(); C(0.25 + nod, 0.84, 0.06); FS(fill, col);
  B(); M(0.24 + nod, 0.9); L(0.2 + nod, 1.02); M(0.25 + nod, 0.9); L(0.26 + nod, 1.03); M(0.26 + nod, 0.9); L(0.31 + nod, 1.01); S(col, 0.5);
  B(); C(0.2 + nod, 1.03, 0.018); C(0.26 + nod, 1.04, 0.018); C(0.31 + nod, 1.02, 0.018); F(GOLD);
  B(); M(0.3 + nod, 0.86); L(0.37 + nod, 0.83); S(PAPER, 0.7);
  eye(0.27 + nod, 0.86, 0.014, PAPER);
}

interface BirdSpec { col: string; fill: string; wing: string; under: string; tail: number; tilt: number; beak: (hx: number, hy: number) => void }
const BIRDS: Partial<Record<AnimalKind, BirdSpec>> = {
  parrot: { col: "#ff3b3b", fill: "#2a0808", wing: "#3d7bff", under: GOLD, tail: 0.36, tilt: -0.55, beak: (x, y) => { B(); M(x + 0.05, y + 0.03); Q(x + 0.17, y + 0.02, x + 0.11, y - 0.09); L(x + 0.06, y - 0.04); G.closePath(); FS(PAPER, PAPER, 0.4); } },
  kea: { col: "#a6d84a", fill: "#151f08", wing: "#6f9a2a", under: "#ff6a1c", tail: 0.2, tilt: -0.3, beak: (x, y) => { B(); M(x + 0.05, y + 0.03); Q(x + 0.2, y + 0.03, x + 0.15, y - 0.12); L(x + 0.13, y - 0.07); L(x + 0.06, y - 0.03); G.closePath(); FS("#5c5650", "#c9c3b8", 0.5); } },
  toucan: { col: PAPER, fill: "#0c0c0c", wing: "#2a2a2a", under: "#ff4a3a", tail: 0.2, tilt: -0.5, beak: (x, y) => { B(); M(x + 0.04, y + 0.05); Q(x + 0.3, y + 0.07, x + 0.38, y - 0.02); Q(x + 0.22, y - 0.06, x + 0.04, y - 0.05); G.closePath(); FS("#ff9a1c", "#ffd23d", 0.6); B(); C(x + 0.35, y - 0.01, 0.025); F("#ec2a1c"); } },
};

function perchBird(kind: AnimalKind, t: number, ph: number, mv: number): void {
  const s = BIRDS[kind]!;
  const w = ph + t * 9, hop = mv > 0.05 ? Math.abs(Math.sin(w)) * 0.1 * mv : pulse(t + ph * 2, 4.5, 0.35, 0.17) * 0.07;
  const fl = Math.max(pulse(t + ph * 3, 6.5, 0.9, 0.2), mv * 0.6), flap = Math.sin(t * 22 + ph) * fl;
  shadow(0, 0.14);
  OY -= hop * U;
  B(); M(0.0, 0.14); L(0.02, 0.0); L(0.07, 0.0); M(0.04, 0.14); L(0.06, 0.0); S("#9a8d80", 0.6);
  B(); M(-0.06, 0.18); L(-0.06 - s.tail * 0.75, 0.18 - s.tail * 0.5); L(-0.04 - s.tail * 0.7, 0.2 - s.tail * 0.38); G.closePath(); FS(s.fill, s.col, 0.7);
  B(); E(0, 0.28, 0.1, 0.17, s.tilt + 0.55); FS(s.fill, s.col);
  if (kind === "toucan") { B(); E(0.06, 0.38, 0.05, 0.06); F(PAPER); }
  const hx = kind === "kea" ? 0.08 : 0.06, hy = 0.46;
  B(); C(hx, hy, 0.085); FS(s.fill, s.col);
  s.beak(hx, hy);
  eye(hx + 0.02, hy + 0.02, 0.018, kind === "toucan" ? CYAN : PAPER);
  if (fl > 0.05) {
    const tipY = 0.34 + flap * 0.28;
    B(); M(0.02, 0.36); L(-0.22, tipY); L(-0.06, 0.26); G.closePath(); FS(s.under, s.col, 0.6);
  } else { B(); E(-0.03, 0.27, 0.06, 0.13, s.tilt + 0.1); FS(s.wing, s.col, 0.6); }
}

function owl(t: number, ph: number, mv: number): void {
  const col = "#e0b678", fill = "#24180c";
  const w = ph + t * 8, hop = mv > 0.05 ? Math.abs(Math.sin(w)) * 0.08 * mv : 0;
  const fl = pulse(t + ph * 3, 9, 1.0, 0.25), flap = Math.abs(Math.sin(t * 16)) * fl;
  shadow(0, 0.16);
  OY -= hop * U;
  const look = Math.round(Math.sin(t * 0.5 + ph) * 1.4) * 0.025, blink = ((t + ph) % 4) < 0.14;
  B(); M(-0.13, 0.36); L(-0.3 - flap * 0.1, 0.18 + flap * 0.32); L(-0.12, 0.12); M(0.13, 0.36); L(0.3 + flap * 0.1, 0.18 + flap * 0.32); L(0.12, 0.12); FS(fill, col, 0.7);
  B(); E(0, 0.24, 0.15, 0.22); FS(fill, col);
  B(); E(0, 0.48, 0.16, 0.12); M(-0.12, 0.56); L(-0.15, 0.66); L(-0.05, 0.58); M(0.12, 0.56); L(0.15, 0.66); L(0.05, 0.58); FS(fill, col);
  B(); M(-0.06, 0.2); L(-0.03, 0.17); M(0.04, 0.24); L(0.07, 0.21); M(-0.05, 0.3); L(-0.02, 0.27); M(0.03, 0.12); L(0.06, 0.09); S(col, 0.5);
  if (blink) { B(); M(-0.12 + look, 0.48); L(-0.02 + look, 0.48); M(0.02 + look, 0.48); L(0.12 + look, 0.48); S(GOLD, 0.8); }
  else { B(); C(-0.065 + look, 0.48, 0.05); C(0.065 + look, 0.48, 0.05); FS(GOLD, col, 0.4); B(); C(-0.06 + look * 1.6, 0.48, 0.022); C(0.07 + look * 1.6, 0.48, 0.022); F(INK); }
  B(); M(-0.02 + look, 0.43); L(0.02 + look, 0.43); L(look, 0.39); G.closePath(); F(GOLD);
  B(); M(-0.06, 0.02); L(-0.06, 0); M(0.06, 0.02); L(0.06, 0); S(GOLD, 0.9);
}

function kiwi(t: number, ph: number, mv: number): void {
  const col = "#d8a868", fill = "#2a1c10";
  const w = ph + t * 13, bob = -Math.abs(Math.cos(w)) * 0.015 * mv;
  OY -= bob * U;
  const probe = pulse(t + ph * 3, 5, 1.6, 0.4) * (1 - mv), poke = probe * (0.7 + Math.sin(t * 9) * 0.15);
  shadow(0.05, 0.26);
  B(); leg(0.0, 0.08, 0.08, w, mv); leg(0.08, 0.08, 0.08, w + Math.PI, mv); M(0.04, 0); L(0.12, 0); S(GOLD, 1.0);
  B(); E(0, 0.2, 0.24, 0.17, 0.08 - poke * 0.15); FS(fill, col);
  B(); M(-0.14, 0.27); L(-0.08, 0.24); M(-0.05, 0.32); L(0.01, 0.29); M(-0.15, 0.16); L(-0.09, 0.14); M(0.03, 0.2); L(0.09, 0.18); S(col, 0.5);
  const hx = 0.2, hy = 0.25 - poke * 0.07;
  B(); C(hx, hy, 0.07); FS(fill, col);
  B(); M(hx + 0.06, hy - 0.01); Q(hx + 0.28, hy - 0.04 - poke * 0.05, hx + 0.33 - poke * 0.08, hy - 0.16 - poke * 0.1); S("#f0dcb0", 0.85);
  eye(hx + 0.03, hy + 0.02, 0.014, PAPER);
}

// ---------------------------------------------------------------------------------------------
// Sea creatures. (sx, sy) is the point on the water surface; the submerged part is drawn faint.

function splash(x: number, s: number, t: number, col: string): void {
  if (s <= 0.01) return;
  G.globalAlpha = Math.min(1, s * 1.4);
  B(); E(x, 0, 0.35 + (1 - s) * 0.5, 0.1 + (1 - s) * 0.12); S(col, 0.8);
  B();
  for (let i = 0; i < 7; i++) { const a = 0.4 + i * 0.38, r = (1 - s) * 0.9 + 0.1; C(x + Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.9 * s + 0.05, 0.035 + ((i + Math.floor(t * 8)) % 3) * 0.01); }
  F(col); G.globalAlpha = 1;
}

/** Draw the shape twice: faint whole (under water) then full above the surface line. */
function surfaced(sx: number, sy: number, draw: () => void): void {
  G.globalAlpha = 0.3; draw(); G.globalAlpha = 1;
  const r = U * 8;
  G.save(); G.beginPath(); G.rect(sx - r, sy - r, r * 2, r); G.clip(); draw(); G.restore();
  G.lineCap = "round"; G.lineJoin = "round";
}

function whale(t: number, ph: number, mv: number): void {
  const col = "#4d8dff", fill = "#0a1430", sx = OX, sy = OY;
  const cyc = 12, c = ((t + ph * 4) % cyc + cyc) % cyc, dur = 2.6, p = c / dur;
  let cy = -0.28 + Math.sin(t * 0.9 + ph) * 0.05, a = Math.sin(t * 0.9 + ph + 1) * 0.05, cx = 0, spl = 0;
  if (p < 1) { cy = -1.1 + 2.0 * Math.sin(p * Math.PI); a = 1.25 * (1 - 2 * p) + 0.1; cx = (p - 0.5) * 0.8; spl = p < 0.25 ? 1 - p * 4 : 0; }
  else if (p < 1.5) spl = 1 - (p - 1) * 2;
  const spout = p >= 2 && pulse(t + ph * 4, 6, 1.1, 0.3) > 0;
  const body = () => {
    OX = sx; OY = sy; rot(0);
    // move origin to the whale centre then rotate around it
    OX += cx * U * D; OY -= cy * U; rot(a);
    const tail = Math.sin(t * 2.4 + ph) * 0.12 * (0.4 + mv);
    B(); M(1.8, 0.05); Q(1.6, 0.45, 0.6, 0.42); Q(-0.6, 0.38, -1.5, 0.08); L(-1.5, -0.02); Q(-0.4, -0.38, 0.9, -0.35); Q(1.7, -0.3, 1.8, 0.05); G.closePath(); FS(fill, col, 1.2);
    B(); M(-1.5, 0.03); L(-1.95, 0.3 + tail); L(-1.75, 0.03); L(-1.95, -0.24 + tail); G.closePath(); FS(fill, col, 1.1);
    B(); M(-0.6, 0.36); L(-0.74, 0.5); L(-0.82, 0.33); FS(fill, col, 0.8);
    B(); M(1.7, -0.08); Q(1.0, -0.22, 0.2, -0.2); M(1.6, -0.15); Q(1.0, -0.3, 0.4, -0.28); S(col, 0.5);
    B(); M(0.6, -0.15); L(0.25, -0.5); L(0.4, -0.18); FS(fill, col, 0.8);
    eye(1.25, 0.06, 0.04, PAPER);
  };
  surfaced(sx, sy, body);
  OX = sx; OY = sy; rot(0);
  if (spl > 0) splash(cx, spl, t, PAPER);
  if (spout) { const k = pulse(t + ph * 4, 6, 1.1, 0.3); B(); M(1.1, 0.0); L(1.1, 0.5 * k); M(1.1, 0.4 * k); Q(0.9, 0.6 * k, 0.8, 0.45 * k); M(1.1, 0.4 * k); Q(1.3, 0.6 * k, 1.4, 0.45 * k); S(CYAN, 0.8); }
}

function dolphin(t: number, ph: number, mv: number): void {
  const col = "#8fe0ff", fill = "#0b1c26", sx = OX, sy = OY;
  const cyc = mv > 0.3 ? 2.6 : 4.2, c = ((t + ph * 3) % cyc + cyc) % cyc, dur = 1.3, p = c / dur;
  let cy = -0.35 + Math.sin(t * 1.5 + ph) * 0.04, a = 0, cx = 0, spl = 0;
  if (p < 1) { cy = -0.5 + 1.15 * Math.sin(p * Math.PI); a = 1.1 * (1 - 2 * p); cx = (p - 0.5) * 1.1; spl = p < 0.2 ? 1 - p * 5 : 0; }
  else if (p < 1.4) { spl = 1 - (p - 1) * 2.5; cx = 0.55; }
  const body = () => {
    OX = sx + cx * U * D; OY = sy - cy * U; rot(a);
    const tail = Math.sin(t * 6 + ph) * 0.08;
    B(); M(0.72, 0.0); L(0.56, 0.04); Q(0.3, 0.2, -0.2, 0.14); Q(-0.45, 0.08, -0.55, 0.02); Q(-0.3, -0.1, 0.1, -0.12); Q(0.45, -0.1, 0.56, -0.02); G.closePath(); FS(fill, col, 1.1);
    B(); M(-0.55, 0.02); L(-0.75, 0.16 + tail); L(-0.66, 0.02); L(-0.75, -0.12 + tail); G.closePath(); FS(fill, col, 0.9);
    B(); M(0.0, 0.17); Q(-0.06, 0.32, -0.16, 0.3); L(-0.16, 0.14); FS(fill, col, 0.9);
    B(); M(0.15, -0.08); L(0.02, -0.22); L(-0.02, -0.1); FS(fill, col, 0.7);
    eye(0.45, 0.04, 0.022, PAPER);
  };
  surfaced(sx, sy, body);
  OX = sx; OY = sy; rot(0);
  if (spl > 0) splash(cx, spl * 0.8, t, PAPER);
}

// ---------------------------------------------------------------------------------------------

/** Natural scale multipliers (heights: giraffe ~3.2 units, elephant ~2.5, kiwi ~0.4). */
const SCALE: Record<AnimalKind, number> = {
  giraffe: 1, elephant: 1.25, zebra: 1, lion: 1, tiger: 1, penguin: 1, flamingo: 1, peacock: 1, parrot: 1,
  kea: 1, kiwi: 1, toucan: 1, owl: 1, whale: 1, dolphin: 1, monkey: 1, kangaroo: 1.05, panda: 1,
};

/** Draw an animal standing at screen point (sx, sy) (feet on the ground), facing dir (+1 right, -1 left), zoom z, time t in seconds, phase ph (per-animal offset), moving 0..1 (walk cycle amount). */
export function drawAnimal(g: CanvasRenderingContext2D, kind: AnimalKind, sx: number, sy: number, z: number, dir: number, t: number, ph: number, moving: number): void {
  setup(g, sx, sy, z, dir, SCALE[kind]);
  const mv = moving < 0 ? 0 : moving > 1 ? 1 : moving;
  switch (kind) {
    case "giraffe": giraffe(t, ph, mv); break;
    case "elephant": elephant(t, ph, mv); break;
    case "zebra": zebra(t, ph, mv); break;
    case "lion": bigCat(t, ph, mv, true); break;
    case "tiger": bigCat(t, ph, mv, false); break;
    case "penguin": penguin(t, ph, mv); break;
    case "flamingo": flamingo(t, ph, mv); break;
    case "peacock": peacock(t, ph, mv); break;
    case "parrot": case "kea": case "toucan": perchBird(kind, t, ph, mv); break;
    case "owl": owl(t, ph, mv); break;
    case "kiwi": kiwi(t, ph, mv); break;
    case "whale": whale(t, ph, mv); break;
    case "dolphin": dolphin(t, ph, mv); break;
    case "monkey": monkey(t, ph, mv); break;
    case "kangaroo": kangaroo(t, ph, mv); break;
    case "panda": panda(t, ph, mv); break;
  }
  g.globalAlpha = 1;
}

/** Height of the water surface inside a tank, in world units (draw sea animals at sy - TANK_WATER_Z * Z_PX * z). */
export const TANK_WATER_Z = 0.75;
const TANK_WALL_Z = 0.95;

/**
 * Draw a water tank / pool (for whales, dolphins, penguins) as an isometric box whose footprint is
 * centred on ground point (sx, sy), wTiles along world x and hTiles along world y.
 * part: "back" = floor, back walls and water (draw before the animals), "front" = front glass and rim
 * (draw after), "all" = both (default).
 */
export function drawTank(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, wTiles: number, hTiles: number, t: number, part: "all" | "back" | "front" = "all"): void {
  const axx = (TILE_W / 4) * wTiles * z, axy = (TILE_H / 4) * wTiles * z, ayx = -(TILE_W / 4) * hTiles * z, ayy = (TILE_H / 4) * hTiles * z;
  const nX = sx - axx - ayx, nY = sy - axy - ayy, eX = sx + axx - ayx, eY = sy + axy - ayy;
  const sX = sx + axx + ayx, sY = sy + axy + ayy, wX = sx - axx + ayx, wY = sy - axy + ayy;
  const H = TANK_WALL_Z * Z_PX * z, Wz = TANK_WATER_Z * Z_PX * z, lw = Math.max(1.1, 1.55 * z);
  g.lineCap = "round"; g.lineJoin = "round"; g.globalAlpha = 1;
  const quad = (ax: number, ay: number, bx: number, by: number, h0: number, h1: number) => { g.moveTo(ax, ay - h0); g.lineTo(bx, by - h0); g.lineTo(bx, by - h1); g.lineTo(ax, ay - h1); g.closePath(); };
  if (part !== "front") {
    g.beginPath(); quad(wX, wY, nX, nY, 0, H); quad(nX, nY, eX, eY, 0, H); g.fillStyle = "#0c1b26"; g.fill();
    g.beginPath(); g.moveTo(nX, nY); g.lineTo(eX, eY); g.lineTo(sX, sY); g.lineTo(wX, wY); g.closePath(); g.fillStyle = "#071722"; g.fill();
    g.beginPath(); g.moveTo(wX, wY - H); g.lineTo(nX, nY - H); g.lineTo(eX, eY - H); g.moveTo(nX, nY); g.lineTo(nX, nY - H); g.strokeStyle = "#2a6f8a"; g.lineWidth = lw; g.stroke();
    // water surface
    g.beginPath(); g.moveTo(nX, nY - Wz); g.lineTo(eX, eY - Wz); g.lineTo(sX, sY - Wz); g.lineTo(wX, wY - Wz); g.closePath();
    g.fillStyle = "rgba(30,140,200,.38)"; g.fill(); g.strokeStyle = "rgba(61,214,255,.7)"; g.lineWidth = lw * 0.8; g.stroke();
    // ripples: short dashes drifting across the surface
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const u = ((i * 0.37 + t * 0.06) % 1), v = (i * 0.61 + 0.15) % 1, wob = Math.sin(t * 2 + i) * 0.04;
      const px = nX + (eX - nX) * u + (wX - nX) * v, py = nY + (eY - nY) * u + (wY - nY) * v - Wz;
      const len = (8 + (i % 3) * 4) * z;
      g.moveTo(px - len, py + wob * 10 * z); g.quadraticCurveTo(px, py - 3 * z, px + len, py + wob * 10 * z);
    }
    g.strokeStyle = "rgba(160,235,255,.45)"; g.lineWidth = lw * 0.6; g.stroke();
  }
  if (part !== "back") {
    g.beginPath(); quad(wX, wY, sX, sY, 0, Wz); quad(sX, sY, eX, eY, 0, Wz); g.fillStyle = "rgba(20,110,170,.42)"; g.fill();
    g.beginPath(); quad(wX, wY, sX, sY, Wz, H); quad(sX, sY, eX, eY, Wz, H); g.fillStyle = "rgba(61,214,255,.08)"; g.fill();
    g.beginPath(); g.moveTo(wX, wY - Wz); g.lineTo(sX, sY - Wz); g.lineTo(eX, eY - Wz); g.strokeStyle = "rgba(61,214,255,.8)"; g.lineWidth = lw * 0.8; g.stroke();
    g.beginPath(); g.moveTo(wX, wY); g.lineTo(sX, sY); g.lineTo(eX, eY); g.moveTo(wX, wY - H); g.lineTo(sX, sY - H); g.lineTo(eX, eY - H);
    g.moveTo(wX, wY); g.lineTo(wX, wY - H); g.moveTo(sX, sY); g.lineTo(sX, sY - H); g.moveTo(eX, eY); g.lineTo(eX, eY - H);
    g.strokeStyle = CYAN; g.lineWidth = lw; g.stroke();
    // glass glint
    g.beginPath(); g.moveTo(sX - (sX - wX) * 0.25, sY - (sY - wY) * 0.25 - H * 0.8); g.lineTo(sX - (sX - wX) * 0.15, sY - (sY - wY) * 0.15 - H * 0.3);
    g.strokeStyle = "rgba(238,228,211,.35)"; g.lineWidth = lw; g.stroke();
  }
}
