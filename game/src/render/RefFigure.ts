import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { ModelSpec } from "./Models";
import { EYE_SHAPES } from "./Models";
import { drawFaceGenes } from "./FaceGenes";

/**
 * Street model drawn after the reference cartoon: a big round head with an ink outline, a black spiky tuft,
 * ears, big round eyes with pupils and a highlight, blush, an open expressive mouth, a narrow white body with a
 * navel and shorts, single-line arms and legs, mitten hands with fingers and black shoes.
 * The skeleton J comes from solve(), so poses, gaits and animation are unchanged. Each model keeps its own colours
 * and hair; the face follows the person's current emotion (c.emo) and knock-downs.
 */
type Ctx = CanvasRenderingContext2D;
const INK = "#121010", WHITE = "#f7f4ee";
/** Limbs are pale lines so they read on the night street (the drawing's black ink would vanish on dark ground). */
const LIMB = "#eee4d3";
const REAL_GENES = [1, 2, 3, 4, 9, 10, 11, 13] as const;

const SKINS = ["#f1c9a5", "#d9a173", "#c78d5f", "#a06a43", "#6e452b", "#efe3d6", "#dd9a7c", "#e8b48c"];
const SPECS = new WeakMap<Character, ModelSpec>();
/**
 * A reference-look spec for someone without a street model (the Mosaics, the player, the locals), built from their
 * own look: their line colour becomes their top, their accent their shorts, plus their hair, hat and face.
 */
export function lookSpec(c: Character): ModelSpec {
  let m = SPECS.get(c);
  if (m) return m;
  const L = c.look, h = Math.imul(c.id + 7, 0x9e3779b1) >>> 0, F = L.face;
  m = {
    id: `look-${c.id}`, label: c.name, kind: L.kind === "girl" ? "girl" : "guy",
    skin: SKINS[h % SKINS.length], top: "tee", topColor: L.color, trim: L.accent,
    bottom: "shorts", bottomColor: L.accent, shoes: "sneakers", shoeColor: L.accent,
    sw: 10, belly: (h >>> 8) % 3, limb: L.build ?? 1,
    hair: L.hair === "none" && L.hat === "none" ? "spiky" : L.hair, hairColor: ["#1a1410", "#3a2a1e", "#6b4a2a", "#c9a56a", "#2a2018", "#8a8a8a"][(h >>> 4) % 6],
    hat: L.hat, hatColor: L.accent,
    face: F ?? { eyes: "dots", brows: "none", mouth: "smile", nose: "none", facial: "none", extra: "none", head: "round" },
    gear: [],
  };
  SPECS.set(c, m);
  return m;
}

type Mood = "neutral" | "happy" | "sad" | "angry" | "scared" | "stunned";
export function moodOf(c: Character): Mood {
  const e = c.emo;
  if (c.phys === Phys.DOWN || (e && e.composure < 0.2)) return "stunned";
  if (!e) return "neutral";
  if (e.fear > 0.6) return "scared";
  if (e.frustration > 0.6) return "angry";
  if (e.mood > 0.4) return "happy";
  if (e.mood < -0.4) return "sad";
  return "neutral";
}

export function drawRefFigure(g: Ctx, J: Float32Array, c: Character, M: ModelSpec, k: number, dir: number, alpha: number, hd: boolean, flash: boolean): void {
  const lw = Math.max(1.1, 2.3 * k);
  const ink = flash ? "#ffffff" : INK;
  g.globalAlpha = alpha; g.lineCap = "round"; g.lineJoin = "round";
  const line = (pts: number[], w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  // a soft pale halo under every line, so the black ink reads on the night street
  const halo = (pts: number[], w: number) => { if (!hd) return; line(pts, w + 1.6 * k, INK); }; // thin dark edge under each pale limb
  const limbCol = flash ? "#ffffff" : LIMB;

  // body frame: spine direction and its perpendicular (screen sideways for an upright figure)
  const hx = J[0], hy = J[1], sx = J[6], sy = J[7];
  const ux = sx - hx, uy = sy - hy, len = Math.hypot(ux, uy) || 1, px = -uy / len, py = ux / len;
  const bw = 5.2 * k * (0.9 + M.belly * 0.08); // half width

  // A limb point relative to its root: keep the part along the spine, send the sideways part out to its own side,
  // so the figure stands open and front-facing like the drawing while poses still move it.
  const splay = (rx: number, ry: number, x: number, y: number, side: number, out: number): [number, number] => {
    const dx = x - rx, dy = y - ry, along = dx * ux / len + dy * uy / len, lat = dx * px + dy * py;
    const l = side * (Math.abs(lat) + out);
    return [rx + (ux / len) * along + px * l, ry + (uy / len) * along + py * l];
  };

  // ---- legs and shoes (behind the body): hips apart, feet a little wider, as in the drawing
  for (const [kn, ft, side] of [[16, 18, -1], [20, 22, 1]] as const) {
    const o = bw * 0.55 * side, ox = px * o, oy = py * o;
    const rx = hx + ox, ry = hy + oy;
    const kp = splay(rx, ry, J[kn] + ox, J[kn + 1] + oy, side, bw * 0.15), fp = splay(rx, ry, J[ft] + ox, J[ft + 1] + oy, side, bw * 0.35);
    const pts = [rx, ry, kp[0], kp[1], fp[0], fp[1]];
    halo(pts, lw); line(pts, lw, limbCol);
    g.fillStyle = flash ? "#ffffff" : INK;
    const fx0 = pts[4], fy0 = pts[5];
    g.beginPath(); g.ellipse(fx0 + 2.5 * k * side, fy0 + 0.5 * k, 5.2 * k, 2.6 * k, 0, 0, 6.283); g.fill();
    g.strokeStyle = flash ? "#ffffff" : M.shoeColor; g.lineWidth = Math.max(0.7, 0.9 * k); g.stroke(); // shoe edge in the model's shoe colour
    if (hd) { // little motion ticks at the feet, as in the drawing
      g.strokeStyle = "rgba(238,228,211,.55)"; g.lineWidth = Math.max(0.6, 0.8 * k); g.beginPath();
      for (const a of side < 0 ? [-2.4, -2.0, -1.6] : [-1.5, -1.1, -0.7]) { g.moveTo(fx0 + Math.cos(a) * 7 * k, fy0 + Math.sin(a) * 4 * k); g.lineTo(fx0 + Math.cos(a) * 10 * k, fy0 + Math.sin(a) * 6 * k); }
      g.stroke();
    }
  }

  // ---- body: narrow rounded torso, navel, shorts
  const body = (inset: number) => {
    g.beginPath();
    g.moveTo(sx + px * (bw - inset) * 0.85, sy + py * (bw - inset) * 0.85);
    g.quadraticCurveTo(hx + ux * 0.5 + px * (bw - inset) * 1.15, hy + uy * 0.5 + py * (bw - inset) * 1.15, hx + px * (bw - inset), hy + py * (bw - inset) + 2 * k);
    g.lineTo(hx - px * (bw - inset), hy - py * (bw - inset) + 2 * k);
    g.quadraticCurveTo(hx + ux * 0.5 - px * (bw - inset) * 1.15, hy + uy * 0.5 - py * (bw - inset) * 1.15, sx - px * (bw - inset) * 0.85, sy - py * (bw - inset) * 0.85);
    g.quadraticCurveTo(sx + ux * 0.12, sy + uy * 0.12, sx + px * (bw - inset) * 0.85, sy + py * (bw - inset) * 0.85);
    g.closePath();
  };
  if (hd) { g.globalAlpha = alpha * 0.35; g.strokeStyle = "#eee4d3"; g.lineWidth = lw + 3 * k; body(0); g.stroke(); g.globalAlpha = alpha; }
  g.fillStyle = flash ? "#ffffff" : M.top === "bare" ? M.skin : M.topColor === "#f4f1ea" ? WHITE : M.topColor;
  body(0); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.9; g.stroke();
  // shorts: the lower third of the body in the model's bottom colour
  g.save(); body(0); g.clip();
  g.fillStyle = flash ? "#ffffff" : M.bottomColor;
  const cut = 0.32;
  g.beginPath(); g.moveTo(hx + ux * cut + px * bw * 2, hy + uy * cut + py * bw * 2); g.lineTo(hx + ux * cut - px * bw * 2, hy + uy * cut - py * bw * 2);
  g.lineTo(hx - px * bw * 2 - ux * 0.3, hy - py * bw * 2 - uy * 0.3); g.lineTo(hx + px * bw * 2 - ux * 0.3, hy + py * bw * 2 - uy * 0.3); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = ink; g.lineWidth = lw * 0.9; body(0); g.stroke();
  // navel
  g.fillStyle = ink; g.beginPath(); g.ellipse(hx + ux * 0.42, hy + uy * 0.42, 0.9 * k, 0.6 * k, 0, 0, 6.283); g.fill();

  // ---- arms and mitten hands
  for (const [el, hn, side] of [[8, 10, -1], [12, 14, 1]] as const) { // arms leave from each shoulder and splay outward
    const o = bw * 0.85 * side, ox = px * o, oy = py * o;
    const rx = sx + ox, ry = sy + oy;
    const ep = splay(rx, ry, J[el] + ox, J[el + 1] + oy, side, bw * 0.6), hp = splay(rx, ry, J[hn] + ox, J[hn + 1] + oy, side, bw * 1.4);
    const pts = [rx, ry, ep[0], ep[1], hp[0], hp[1]];
    halo(pts, lw); line(pts, lw, limbCol);
    const ax = pts[4] - pts[2], ay = pts[5] - pts[3], al = Math.hypot(ax, ay) || 1, dx = ax / al, dy = ay / al;
    const cx = pts[4] + dx * 2 * k, cy = pts[5] + dy * 2 * k;
    g.fillStyle = limbCol; g.strokeStyle = INK; g.lineWidth = Math.max(0.6, 0.8 * k); g.beginPath(); g.arc(cx, cy, 2.8 * k, 0, 6.283); g.fill(); g.stroke();
    g.strokeStyle = limbCol; g.lineWidth = Math.max(0.8, 1.5 * k); g.beginPath();
    for (const a of [-0.9, -0.3, 0.3, 0.9]) { // four splayed fingers
      const fa = Math.atan2(dy, dx) + a, fl = 4.2 * k;
      g.moveTo(cx + Math.cos(fa) * 2 * k, cy + Math.sin(fa) * 2 * k); g.lineTo(cx + Math.cos(fa) * fl, cy + Math.sin(fa) * fl);
    }
    g.stroke();
  }

  // ---- neck and head
  const nx = J[2], ny = J[3];
  const hdx = J[4] - nx, hdy = J[5] - ny, hl = Math.hypot(hdx, hdy) || 1;
  const P = facePlan(c.look.face?.gene ?? c.id * 2654435761);
  const r = 15 * k * P.size; // big round head, as in the drawing
  const x = nx + (hdx / hl) * (r + 2 * k), y = ny + (hdy / hl) * (r + 2 * k);
  halo([nx, ny, x - (hdx / hl) * r, y - (hdy / hl) * r], lw); line([nx, ny, x - (hdx / hl) * r, y - (hdy / hl) * r], lw, limbCol);
  drawRefHead(g, c, M, P, moodOf(c), x, y, r, k, dir, lw, alpha, hd, flash);
  g.globalAlpha = alpha;
}

/**
 * Continuous face proportions for one person, from their face gene (or id): eye size, spacing, height and tilt,
 * pupil size, brow weight, lift and length, nose type and size, mouth width and lip, ears, head width and jaw,
 * cheek colour, freckles and hair density. About 20 continuous values, so the pool of faces is effectively endless;
 * the model's own traits and the 14-slot face genes (FaceGenes.ts) layer on top.
 */
export interface FacePlan {
  size: number; wide: number; tall: number; jaw: number;
  eyeR: number; eyeSep: number; eyeY: number; eyeTilt: number; pupil: number; lid: number;
  browW: number; browY: number; browLen: number; browTilt: number;
  nose: number; noseSize: number; mouthW: number; mouthY: number; lip: number;
  ear: number; blush: number; freckles: number; spikes: number; spikeLen: number;
}
export function facePlan(seed: number): FacePlan {
  let h = (seed | 0) ^ 0x2545f491;
  const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const span = (a: number, b: number) => a + r() * (b - a);
  return {
    size: span(0.92, 1.08), wide: span(0.88, 1.08), tall: span(0.95, 1.12), jaw: span(0, 1),
    eyeR: span(0.22, 0.34), eyeSep: span(0.32, 0.42), eyeY: span(-0.08, 0.08), eyeTilt: span(-0.18, 0.18), pupil: span(0.38, 0.56), lid: span(0, 0.25),
    browW: span(0.7, 1.6), browY: span(1.5, 2.0), browLen: span(0.45, 0.75), browTilt: span(-0.25, 0.25),
    nose: Math.floor(r() * 5), noseSize: span(0.8, 1.3), mouthW: span(0.42, 0.56), mouthY: span(0.5, 0.58), lip: span(0, 1),
    ear: span(0.15, 0.24), blush: span(0, 0.35), freckles: r() < 0.25 ? span(0.3, 1) : 0, spikes: 5 + Math.floor(r() * 7), spikeLen: span(0.7, 1.3),
  };
}

function drawRefHead(g: Ctx, c: Character, M: ModelSpec, P: FacePlan, mood: Mood, x: number, y: number, r: number, k: number, dir: number, lw: number, alpha: number, hd: boolean, flash: boolean): void {
  const ink = flash ? "#ffffff" : INK, skin = flash ? "#ffffff" : M.skin, hairCol = flash ? "#ffffff" : M.hairColor;
  const F = M.face, ES = EYE_SHAPES[M.id];
  const rx = r * P.wide * (F.head === "wide" ? 1.08 : 1), ry = r * P.tall * (F.head === "oval" ? 1.1 : 1);
  const dot = (px: number, py: number, rr: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(px, py, rr, 0, 6.283); g.fill(); };
  // ears
  for (const s of [-1, 1]) {
    g.fillStyle = skin; g.strokeStyle = ink; g.lineWidth = lw * 0.8;
    g.beginPath(); g.ellipse(x + s * rx * 0.98, y + ry * 0.08, r * P.ear, r * P.ear * 1.25, 0, 0, 6.283); g.fill(); g.stroke();
    if (F.extra === "earrings") { g.strokeStyle = "#f6b62c"; g.lineWidth = lw * 0.6; g.beginPath(); g.arc(x + s * rx * 0.98, y + ry * 0.08 + r * P.ear * 1.4, r * 0.07, 0, 6.283); g.stroke(); }
  }
  // head: round top, jaw from soft (0) to square (1)
  const headPath = () => {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, Math.PI, 0);
    const jw = rx * (0.72 + P.jaw * 0.2);
    g.bezierCurveTo(x + rx, y + ry * 0.75, x + jw, y + ry * (0.95 + P.jaw * 0.08), x, y + ry * (1.0 + P.jaw * 0.05));
    g.bezierCurveTo(x - jw, y + ry * (0.95 + P.jaw * 0.08), x - rx, y + ry * 0.75, x - rx, y);
    g.closePath();
  };
  if (hd) { g.globalAlpha = alpha * 0.35; g.strokeStyle = "#eee4d3"; g.lineWidth = lw + 3 * k; headPath(); g.stroke(); g.globalAlpha = alpha; }
  g.fillStyle = skin; g.strokeStyle = ink; g.lineWidth = lw; headPath(); g.fill(); g.stroke();
  if (hd) { g.save(); headPath(); g.clip(); g.fillStyle = "rgba(0,0,0,.1)"; g.beginPath(); g.ellipse(x - rx * 0.55 * dir, y + ry * 0.2, rx * 0.7, ry * 1.1, 0, 0, 6.283); g.fill(); g.restore(); } // soft shade on the far side

  // hair: a spiky tuft in the model's hair colour, density and length per person; hats replace the tuft
  const hatted = M.hat !== "none";
  if (M.hair !== "none" && !hatted) {
    const n = M.hair === "buzz" ? P.spikes + 2 : P.spikes;
    const len = (M.hair === "buzz" ? 0.14 : M.hair === "spiky" || M.hair === "mohawk" ? 0.5 : M.hair === "curly" || M.hair === "afro" ? 0.3 : 0.38) * P.spikeLen;
    g.fillStyle = hairCol; g.beginPath();
    g.moveTo(x - rx * 0.9, y - ry * 0.42);
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (1.12 + (i / n) * 0.76), tip = a + 0.12 * dir;
      g.lineTo(x + Math.cos(tip) * rx * (1 + len), y + Math.sin(tip) * ry * (1 + len));
      const b = Math.PI * (1.12 + ((i + 0.5) / n) * 0.76);
      if (i < n) g.lineTo(x + Math.cos(b) * rx * 0.92, y + Math.sin(b) * ry * 0.92);
    }
    g.lineTo(x + rx * 0.9, y - ry * 0.42);
    g.quadraticCurveTo(x + rx * 0.2 * dir, y - ry * 0.72, x - rx * 0.9, y - ry * 0.42);
    g.closePath(); g.fill();
  }
  if (M.hair === "long" || M.hair === "braids" || M.hair === "bob" || M.hair === "pony" || M.hair === "pigtails") { g.strokeStyle = hairCol; g.lineWidth = lw * 1.6; g.beginPath(); g.moveTo(x - rx * 0.95, y - ry * 0.2); g.lineTo(x - rx * 1.02, y + ry * (M.hair === "bob" ? 0.6 : 1.1)); g.moveTo(x + rx * 0.95, y - ry * 0.2); g.lineTo(x + rx * 1.02, y + ry * (M.hair === "bob" ? 0.6 : 1.1)); g.stroke(); }
  if (hatted) drawHat(g, M, x, y, rx, ry, dir, lw, ink, flash);

  // face, shifted a touch toward where they look
  const fx = x + r * 0.06 * dir, ey = y + r * (0.02 + P.eyeY), sep = r * P.eyeSep;
  const eR = r * P.eyeR * (ES ? 0.85 + ES.w * 0.15 : 1);
  // cheeks and freckles
  g.fillStyle = F.extra === "blush" ? "rgba(255,110,140,.45)" : `rgba(220,120,120,${(0.12 + P.blush * 0.4).toFixed(2)})`;
  for (const s of [-1, 1]) { g.beginPath(); g.arc(fx + s * r * 0.56, y + r * 0.34, r * 0.14, 0, 6.283); g.fill(); }
  if (P.freckles > 0 || F.extra === "freckles") { const n = F.extra === "freckles" ? 5 : Math.round(P.freckles * 4); for (const s of [-1, 1]) for (let i = 0; i < n; i++) dot(fx + s * r * (0.4 + (i % 3) * 0.08), y + r * (0.2 + Math.floor(i / 3) * 0.08 + (i % 2) * 0.03), r * 0.025, "rgba(120,60,40,.7)"); }

  // eyes: per-person size, spacing and tilt; the model's eye kind sets a resting lid; the mood can override it all
  const restLid = Math.max(P.lid, ES ? (ES.kind === "heavy" ? ES.lid + 0.15 : ES.kind === "closed" ? 0.5 : ES.kind === "cross" ? 0.25 : 0) : 0);
  const eyeH = ES ? (ES.kind === "slit" ? 0.7 : ES.kind === "almond" ? 0.8 : 1) * (0.85 + ES.h * 0.15) : 1;
  for (const s of [-1, 1]) {
    const ex = fx + s * sep;
    if (F.eyes === "shades" || F.eyes === "aviator") { g.fillStyle = ink; g.beginPath(); g.ellipse(ex, ey, eR * 1.2, eR * 0.85, 0, 0, 6.283); g.fill(); if (s > 0) { g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(fx - sep + eR, ey); g.lineTo(fx + sep - eR, ey); g.stroke(); } continue; }
    if (mood === "stunned") {
      g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.moveTo(ex - eR * 0.6, ey - eR * 0.6); g.lineTo(ex + eR * 0.6, ey + eR * 0.6); g.moveTo(ex + eR * 0.6, ey - eR * 0.6); g.lineTo(ex - eR * 0.6, ey + eR * 0.6); g.stroke();
      continue;
    }
    if (mood === "happy") { g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.arc(ex, ey + eR * 0.3, eR * 0.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
    const open = (mood === "scared" ? 1.15 : mood === "angry" ? 0.85 : 1) * eyeH;
    const tilt = s * (P.eyeTilt + (ES ? ES.tilt * 0.5 : 0));
    g.fillStyle = flash ? "#ffffff" : WHITE; g.strokeStyle = ink; g.lineWidth = lw * 0.85;
    g.beginPath(); g.ellipse(ex, ey, eR, eR * open, tilt, 0, 6.283); g.fill(); g.stroke();
    const pr = eR * (mood === "scared" ? 0.3 : P.pupil), pdx = r * 0.05 * dir + (ES ? ES.pupil * eR * 0.3 * dir : 0), pdy = mood === "sad" ? eR * 0.2 : 0;
    dot(ex + pdx, ey + pdy, pr, ink);
    dot(ex + pdx - pr * 0.35, ey + pdy - pr * 0.35, pr * 0.3, WHITE);
    // lids: resting lid per person, deeper for angry and sad
    const lidIn = mood === "angry" ? 0.45 : mood === "sad" ? 0.1 : mood === "scared" ? 0 : restLid;
    const lidOut = mood === "angry" ? 0.1 : mood === "sad" ? 0.45 : mood === "scared" ? 0 : restLid;
    if (lidIn > 0.02 || lidOut > 0.02) {
      g.save(); g.beginPath(); g.ellipse(ex, ey, eR, eR * open, tilt, 0, 6.283); g.clip();
      g.fillStyle = skin; g.beginPath();
      g.moveTo(ex - s * eR * 1.2, ey - eR * open + lidIn * 2 * eR * open); g.lineTo(ex + s * eR * 1.2, ey - eR * open + lidOut * 2 * eR * open);
      g.lineTo(ex + s * eR * 1.2, ey - eR * 3); g.lineTo(ex - s * eR * 1.2, ey - eR * 3); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(ex - s * eR * 1.2, ey - eR * open + lidIn * 2 * eR * open); g.lineTo(ex + s * eR * 1.2, ey - eR * open + lidOut * 2 * eR * open); g.stroke();
      g.restore();
    }
    if (ES?.lash) { g.strokeStyle = ink; g.lineWidth = lw * 0.5; g.beginPath(); for (const t of [0, 0.35, 0.7]) { const a = -Math.PI / 2 + s * (0.6 + t * 0.6); g.moveTo(ex + Math.cos(a) * eR, ey + Math.sin(a) * eR * open); g.lineTo(ex + Math.cos(a) * eR * 1.35, ey + Math.sin(a) * eR * open * 1.35); } g.stroke(); }
  }
  // brows: weight, height, length and slant per person; the model's brow style and the mood bend them
  const browStyle = mood === "angry" ? "angry" : mood === "sad" || mood === "scared" ? "worried" : F.brows;
  g.strokeStyle = flash ? "#ffffff" : M.hair === "none" ? ink : hairCol; g.lineWidth = lw * P.browW * (F.brows === "thick" ? 1.4 : 1); g.beginPath();
  for (const s of [-1, 1]) {
    const bx = fx + s * sep, by = ey - eR * P.browY - (mood === "scared" ? eR * 0.3 : 0), L = eR * P.browLen * 1.4;
    const inner = browStyle === "angry" ? eR * 0.45 : browStyle === "worried" ? -eR * 0.4 : browStyle === "raised" ? -eR * 0.15 : P.browTilt * eR;
    const outer = browStyle === "raised" ? -eR * 0.15 : 0;
    g.moveTo(bx - s * L, by + inner); g.quadraticCurveTo(bx, by - eR * 0.15 + (inner + outer) * 0.3, bx + s * L, by + outer);
  }
  g.stroke();
  // nose: five shapes, sized per person, or the model's own
  const nT = F.nose === "dot" ? 0 : F.nose === "line" ? 1 : F.nose === "hook" ? 2 : P.nose;
  const nx = fx + r * 0.05 * dir, ny = y + r * 0.3, ns = r * 0.09 * P.noseSize;
  g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.beginPath();
  switch (nT) {
    case 0: g.moveTo(nx - ns, ny + ns * 0.4); g.quadraticCurveTo(nx, ny + ns * 1.2, nx + ns, ny + ns * 0.4); break;            // button
    case 1: g.moveTo(nx, ny - ns * 1.6); g.lineTo(nx + ns * 0.8 * dir, ny + ns * 0.6); g.lineTo(nx - ns * 0.2 * dir, ny + ns * 0.7); break; // straight
    case 2: g.moveTo(nx, ny - ns * 1.8); g.quadraticCurveTo(nx + ns * 1.8 * dir, ny + ns * 0.2, nx, ny + ns * 0.8); break;      // hooked
    case 3: g.moveTo(nx - ns * 0.9, ny + ns * 0.3); g.arc(nx, ny + ns * 0.3, ns * 0.9, Math.PI, 0, true); break;               // round
    default: g.moveTo(nx - ns * 0.6, ny + ns * 0.5); g.lineTo(nx + ns * 0.6, ny + ns * 0.5);                                    // flat bridge
  }
  g.stroke();
  if (F.extra === "nosering") { g.strokeStyle = "#f6b62c"; g.lineWidth = lw * 0.5; g.beginPath(); g.arc(nx + ns * 0.6 * dir, ny + ns * 0.9, ns * 0.4, 0, Math.PI); g.stroke(); }

  // mouth: width and lip per person; the mood sets the shape
  const mx = fx, my = y + r * P.mouthY, mw = r * P.mouthW;
  g.lineWidth = lw * (0.75 + P.lip * 0.4);
  switch (mood) {
    case "scared": case "stunned": {
      g.fillStyle = ink; g.beginPath(); g.ellipse(mx, my, mw * 0.85, mw * 0.65, 0, 0, 6.283); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.ellipse(mx, my - mw * 0.42, mw * 0.55, mw * 0.16, 0, 0, Math.PI, true); g.fill();
      g.fillStyle = "#e0505a"; g.beginPath(); g.ellipse(mx, my + mw * 0.32, mw * 0.45, mw * 0.25, 0, 0, Math.PI, true); g.fill();
      break;
    }
    case "happy": {
      g.fillStyle = ink; g.beginPath(); g.moveTo(mx - mw, my - mw * 0.3); g.quadraticCurveTo(mx, my + mw * 1.3, mx + mw, my - mw * 0.3); g.closePath(); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.moveTo(mx - mw * 0.8, my - mw * 0.22); g.lineTo(mx + mw * 0.8, my - mw * 0.22); g.lineTo(mx + mw * 0.6, my + mw * 0.05); g.lineTo(mx - mw * 0.6, my + mw * 0.05); g.closePath(); g.fill();
      break;
    }
    case "angry": {
      g.fillStyle = WHITE; g.strokeStyle = ink; g.beginPath(); g.rect(mx - mw * 0.8, my - mw * 0.3, mw * 1.6, mw * 0.6); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(mx - mw * 0.8, my); g.lineTo(mx + mw * 0.8, my); for (const t of [-0.4, 0, 0.4]) { g.moveTo(mx + mw * t, my - mw * 0.3); g.lineTo(mx + mw * t, my + mw * 0.3); } g.stroke();
      break;
    }
    case "sad": { g.strokeStyle = ink; g.beginPath(); g.moveTo(mx - mw * 0.7, my + mw * 0.3); g.quadraticCurveTo(mx, my - mw * 0.45, mx + mw * 0.7, my + mw * 0.3); g.stroke(); break; }
    default: { // the model's resting mouth
      g.strokeStyle = ink; g.beginPath();
      if (F.mouth === "flat") { g.moveTo(mx - mw * 0.6, my); g.lineTo(mx + mw * 0.6, my); }
      else if (F.mouth === "smirk") { g.moveTo(mx - mw * 0.6, my + mw * 0.05); g.quadraticCurveTo(mx + mw * 0.1, my + mw * 0.2, mx + mw * 0.7, my - mw * 0.25); }
      else if (F.mouth === "frown") { g.moveTo(mx - mw * 0.6, my + mw * 0.2); g.quadraticCurveTo(mx, my - mw * 0.25, mx + mw * 0.6, my + mw * 0.2); }
      else if (F.mouth === "o") { g.arc(mx, my, mw * 0.3, 0, 6.283); }
      else { // the comic resting mouth: a big open smile with teeth and a tongue, like the reference
        g.fillStyle = ink; g.moveTo(mx - mw * 0.85, my - mw * 0.2); g.quadraticCurveTo(mx, my + mw * 1.3, mx + mw * 0.85, my - mw * 0.2); g.closePath(); g.fill();
        g.save(); g.clip();
        g.fillStyle = WHITE; g.fillRect(mx - mw, my - mw * 0.3, mw * 2, mw * 0.28);
        dot(mx, my + mw * 0.62, mw * 0.42, "#e0505a");
        g.restore();
        g.beginPath();
      }
      g.stroke();
      if (F.mouth === "tongue") dot(mx + mw * 0.1, my + mw * 0.3, mw * 0.22, "#e0505a");
    }
  }
  // facial hair in the hair colour
  g.fillStyle = hairCol; g.strokeStyle = hairCol;
  switch (F.facial) {
    case "mustache": g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(mx - mw * 0.8, my - mw * 0.25); g.quadraticCurveTo(mx, my - mw * 0.65, mx + mw * 0.8, my - mw * 0.25); g.stroke(); break;
    case "goatee": g.beginPath(); g.moveTo(mx - mw * 0.35, my + mw * 0.5); g.lineTo(mx + mw * 0.35, my + mw * 0.5); g.lineTo(mx, my + mw * 1.3); g.closePath(); g.fill(); break;
    case "soulpatch": g.fillRect(mx - mw * 0.12, my + mw * 0.4, mw * 0.24, mw * 0.3); break;
    case "beard": g.save(); headPath(); g.clip(); g.globalAlpha = alpha * 0.9; g.beginPath(); g.ellipse(x, y + ry * 0.95, rx * 1.05, ry * 0.55, 0, Math.PI, 0, true); g.lineTo(x + rx * 1.05, y + ry * 0.35); g.fill(); g.globalAlpha = alpha; g.fillStyle = skin; g.beginPath(); g.ellipse(mx, my, mw * 0.8, mw * 0.4, 0, 0, 6.283); g.fill(); g.restore(); break;
    case "stubble": g.globalAlpha = alpha * 0.55; for (let i = 0; i < 14; i++) dot(x + (i / 13 - 0.5) * rx * 1.4, y + ry * (0.62 + Math.abs(i / 13 - 0.5) * -0.35 + (i % 2) * 0.05), r * 0.02, hairCol); g.globalAlpha = alpha; break;
  }
  // marks
  if (F.extra === "scar") { g.strokeStyle = "#b03030"; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(fx + sep - eR * 0.4, ey - eR * 2); g.lineTo(fx + sep + eR * 0.5, ey + eR * 1.6); g.stroke(); }
  if (F.extra === "mole") dot(mx + mw * 0.9 * dir, my - mw * 0.4, r * 0.03, ink);
  if (F.extra === "tattoo") { g.strokeStyle = "#2a8ab0"; g.lineWidth = lw * 0.5; g.beginPath(); g.moveTo(fx - sep - eR, y + r * 0.2); g.lineTo(fx - sep - eR * 0.6, y + r * 0.35); g.lineTo(fx - sep - eR * 1.1, y + r * 0.45); g.stroke(); }
  // head gear from the model
  if (M.gear.includes("eyepatch")) { const ex = fx + sep; g.fillStyle = ink; g.beginPath(); g.ellipse(ex, ey, eR * 1.15, eR * 0.95, 0, 0, 6.283); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(ex - eR, ey - eR * 0.6); g.lineTo(x - rx, y - ry * 0.4); g.moveTo(ex + eR, ey - eR * 0.6); g.lineTo(x + rx, y - ry * 0.3); g.stroke(); }
  if (M.gear.includes("bandage")) { g.strokeStyle = "#f2ead8"; g.lineWidth = r * 0.16; g.beginPath(); g.moveTo(x - rx * 0.95, y - ry * 0.55); g.lineTo(x + rx * 0.95, y - ry * 0.7); g.stroke(); }
  if (M.gear.includes("headband")) { g.strokeStyle = M.trim === "#f2ead8" ? "#e8554f" : M.trim; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - rx * 0.98, y - ry * 0.5); g.quadraticCurveTo(x, y - ry * 0.8, x + rx * 0.98, y - ry * 0.5); g.stroke(); }
  // the 14-slot face genes (glasses, liner, piercings, paint, tattoos, age marks...) layered on top
  const gene = c.look.face?.gene;
  if (gene !== undefined && hd) {
    const kk = r / 10.5;
    // realistic slots only (liner, glasses, brow piercing, nose bit, ear, chin, scar, age), at most three per face
    drawFaceGenes(g, gene, { x, y, k: kk, dir, lw: lw * 0.8, col: ink, alpha, fx, ey, my, rx, ry, covered: F.eyes === "shades" || F.eyes === "aviator" }, { allow: REAL_GENES, max: 3 });
  }
  g.globalAlpha = alpha;
}

function drawHat(g: Ctx, M: ModelSpec, x: number, y: number, rx: number, ry: number, dir: number, lw: number, ink: string, flash: boolean): void {
  const col = flash ? "#ffffff" : M.hat === "police" ? "#1c2836" : M.hatColor ?? M.trim;
  g.fillStyle = col; g.strokeStyle = ink; g.lineWidth = lw * 0.8;
  const dome = (ext: number, top = 1) => { g.beginPath(); g.ellipse(x, y - ry * 0.25, rx * ext, ry * 0.85 * ext * top, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); };
  switch (M.hat) {
    case "cap": case "police": dome(1.04); g.beginPath(); g.ellipse(x + rx * 0.8 * dir, y - ry * 0.27, rx * 0.65, ry * 0.12, 0, 0, 6.283); g.fill(); g.stroke(); if (M.hat === "police") { g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(x, y - ry * 0.7, rx * 0.12, 0, 6.283); g.fill(); } break;
    case "snapback": dome(1.04); g.beginPath(); g.ellipse(x - rx * 0.8 * dir, y - ry * 0.3, rx * 0.55, ry * 0.12, 0, 0, 6.283); g.fill(); g.stroke(); break;
    case "beanie": dome(1.08, 1.15); g.beginPath(); g.arc(x, y - ry * 1.3, rx * 0.17, 0, 6.283); g.fill(); g.stroke(); g.beginPath(); g.rect(x - rx * 1.08, y - ry * 0.4, rx * 2.16, ry * 0.2); g.fill(); g.stroke(); break;
    case "bucket": dome(0.98, 1.05); g.beginPath(); g.ellipse(x, y - ry * 0.25, rx * 1.45, ry * 0.2, 0, 0, 6.283); g.fill(); g.stroke(); break;
    case "bandana": dome(1.03); g.beginPath(); g.moveTo(x - rx * 0.95 * dir, y - ry * 0.3); g.lineTo(x - rx * 1.5 * dir, y - ry * 0.05); g.lineTo(x - rx * 1.35 * dir, y - ry * 0.45); g.closePath(); g.fill(); g.stroke(); break;
    case "beret": g.beginPath(); g.ellipse(x - rx * 0.15 * dir, y - ry * 0.75, rx * 1.15, ry * 0.42, -0.15 * dir, 0, 6.283); g.fill(); g.stroke(); break;
    case "cowboy": g.beginPath(); g.ellipse(x, y - ry * 0.35, rx * 1.75, ry * 0.22, 0, 0, 6.283); g.fill(); g.stroke(); g.beginPath(); g.rect(x - rx * 0.75, y - ry * 1.35, rx * 1.5, ry * 1.0); g.fill(); g.stroke(); break;
    case "helmet": dome(1.12, 1.1); break;
    case "hood": g.lineWidth = lw * 3; g.strokeStyle = col; g.beginPath(); g.ellipse(x, y + ry * 0.05, rx * 1.18, ry * 1.18, 0, Math.PI * 0.85, Math.PI * 2.15); g.stroke(); break;
    case "headphones": g.strokeStyle = ink; g.lineWidth = lw * 1.1; g.beginPath(); g.ellipse(x, y - ry * 0.05, rx * 1.1, ry * 1.1, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = col; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * rx * 1.02, y, rx * 0.2, ry * 0.3, 0, 0, 6.283); g.fill(); g.stroke(); } break;
    default: dome(1.04);
  }
}
