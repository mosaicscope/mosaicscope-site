import { paintActivity } from './WindowActivities';
/**
 * NIGHT GLOW: lit windows that actually glow, and the small domestic stories behind them.
 *
 * Louis read the SimCity Societies pictures (art-requests/014, 015): what makes those towns breathe at night is
 * not detail, it is warm light coming out of buildings, falling on the pavement, with the sense that somebody
 * lives behind every pane. Mosaics does that its own way: stick-figure silhouettes at the glass, a television
 * flickering blue, a cat on the sill, a plant, curtains half drawn. Christchurch parody, not a copy.
 *
 * Pure and deterministic (a hash of the window's seed): no RNG, nothing saved, the sim is untouched.
 * The painter runs after the darkness overlay (Buildings.GLOW), so windows stay bright and bloom.
 */
export type Story = "none" | "figure" | "couple" | "tv" | "curtains" | "cat" | "plant" | "lamp" | "walking" | "dancing" | "working";

const hash = (n: number): number => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

/** Stable room identities; most rooms now have a visible occupant or domestic detail. */
export function storyOf(seed: number): Story {
  const r = hash(seed);
  if (r < 0.22) return "none";
  const t = ["figure", "couple", "walking", "walking", "dancing", "working", "tv", "curtains", "cat", "plant", "lamp"] as const;
  return t[Math.floor(((r - 0.22) / 0.78) * t.length) % t.length];
}

export type Pt = [number, number];
/** A window as four screen corners: A bottom-left, B bottom-right, C top-right, D top-left. */
export interface Win { A: Pt; B: Pt; C: Pt; D: Pt; col: string; seed: number }

const at = (w: Win, u: number, v: number): Pt => [w.A[0] + (w.B[0] - w.A[0]) * u + (w.D[0] - w.A[0]) * v, w.A[1] + (w.B[1] - w.A[1]) * u + (w.D[1] - w.A[1]) * v];
const quadPath = (g: CanvasRenderingContext2D, w: Win, u0: number, u1: number, v0: number, v1: number): void => {
  const a = at(w, u0, v0), b = at(w, u1, v0), c = at(w, u1, v1), d = at(w, u0, v1);
  g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
};
const blob = (g: CanvasRenderingContext2D, w: Win, u: number, v: number, ru: number, rv: number): void => {
  const c = at(w, u, v), sx = Math.hypot(w.B[0] - w.A[0], w.B[1] - w.A[1]), sy = Math.hypot(w.D[0] - w.A[0], w.D[1] - w.A[1]);
  g.moveTo(c[0] + ru * sx, c[1]); g.ellipse(c[0], c[1], Math.max(0.6, ru * sx), Math.max(0.6, rv * sy), 0, 0, 6.283);
};

const INK = "rgba(18,13,22,.88)";

/** Draw one lit window's story inside it. */
function paintStory(g: CanvasRenderingContext2D, w: Win, story: Story, time: number): void {
  if (story === "none") return;
  g.save();g.beginPath();quadPath(g,w,0,1,0,1);g.clip();g.beginPath();
  if (story === "walking" || story === "dancing" || story === "working" || story === "figure" || story === "couple") {
    const width=Math.hypot(w.B[0]-w.A[0],w.B[1]-w.A[1]),height=Math.hypot(w.D[0]-w.A[0],w.D[1]-w.A[1]);
    const scale=Math.min(1,height/Math.max(1,width)*.8);
    paintActivity(g,(u,v)=>at(w,.5+(u-.5)*scale,v),w.seed,time);
    if(story==='couple')paintActivity(g,(u,v)=>at(w,.5+(u-.25)*scale*.55,v*.82),w.seed+101,time);
  } else if (story === "tv") {
    // a screen throwing blue-grey light, changing a few times a second
    const f = Math.floor(time * 3 + w.seed) % 3, cols = ["rgba(120,170,255,.55)", "rgba(190,150,255,.45)", "rgba(160,220,255,.5)"];
    quadPath(g, w, 0, 1, 0, 1); g.fillStyle = cols[f]; g.fill();
    g.beginPath(); quadPath(g, w, 0.3, 0.7, 0.18, 0.5); g.fillStyle = "rgba(235,245,255,.9)"; g.fill();
    g.beginPath(); blob(g, w, 0.18, 0.2, 0.08, 0.1); quadPath(g, w, 0.08, 0.28, 0, 0.18); g.fillStyle = INK; g.fill();   // the back of a head on the couch
  } else if (story === "curtains") {
    const sway=Math.sin(time*(.4+hash(w.seed+2)*.5)+w.seed)*.06;
    g.moveTo(...at(w, 0, 1)); g.lineTo(...at(w, 0.34, 1)); g.lineTo(...at(w, 0.08+sway, 0.1)); g.lineTo(...at(w, 0, 0.1)); g.closePath();
    g.moveTo(...at(w, 1, 1)); g.lineTo(...at(w, 0.66, 1)); g.lineTo(...at(w, 0.92+sway, 0.1)); g.lineTo(...at(w, 1, 0.1)); g.closePath();
    g.fillStyle = w.seed % 2 ? "rgba(150,48,40,.78)" : "rgba(60,96,120,.78)"; g.fill();
  } else if (story === "cat") {
    blob(g, w, 0.5, 0.2, 0.15, 0.17); blob(g, w, 0.66, 0.4, 0.07, 0.08);
    g.moveTo(...at(w, 0.6, 0.46)); g.lineTo(...at(w, 0.63, 0.62)); g.lineTo(...at(w, 0.67, 0.48)); g.moveTo(...at(w, 0.68, 0.48)); g.lineTo(...at(w, 0.72, 0.62)); g.lineTo(...at(w, 0.74, 0.46));
    g.fillStyle = INK; g.fill();
    g.strokeStyle=INK;g.lineWidth=1;g.beginPath();g.moveTo(...at(w,.4,.15));g.quadraticCurveTo(...at(w,.18,.2),...at(w,.24,.4+Math.sin(time*(.6+hash(w.seed)))*.1));g.stroke();
  } else if (story === "plant") {
    quadPath(g, w, 0.42, 0.58, 0, 0.16);
    g.fillStyle = "rgba(150,70,40,.9)"; g.fill();
    const sway=Math.sin(time*(.3+hash(w.seed)) + w.seed)*.035;
    g.beginPath(); blob(g, w, 0.4+sway, 0.3, 0.09, 0.1); blob(g, w, 0.6+sway, 0.32, 0.09, 0.1); blob(g, w, 0.5+sway, 0.42, 0.1, 0.12);
    g.fillStyle = "rgba(34,110,56,.92)"; g.fill();
  } else {
    // a standard lamp: shade glowing brighter than the room
    g.moveTo(...at(w, 0.78, 0)); g.lineTo(...at(w, 0.8, 0)); g.lineTo(...at(w, 0.8, 0.6)); g.lineTo(...at(w, 0.78, 0.6)); g.closePath();
    g.fillStyle = INK; g.fill();
    g.beginPath(); g.moveTo(...at(w, 0.68, 0.74)); g.lineTo(...at(w, 0.9, 0.74)); g.lineTo(...at(w, 0.85, 0.56)); g.lineTo(...at(w, 0.73, 0.56)); g.closePath();
    g.fillStyle = `rgba(255,244,214,${.8+Math.sin(time*(.2+hash(w.seed))+w.seed)*.12})`; g.fill();
  }
  g.restore();
}

/** Also used on daytime glass; the emissive pass repaints the same occupants at night. */
export function paintWindowStories(g: CanvasRenderingContext2D, wins: readonly Win[], time: number): void {
  for (const w of wins) {
    // Sub-pixel people add cost without adding readable detail at distant zoom levels.
    if (Math.hypot(w.B[0]-w.A[0],w.B[1]-w.A[1]) >= 5) paintStory(g,w,storyOf(w.seed),time);
  }
}

/** Repaint lit windows over the night overlay: the glass itself, a soft bloom, then whatever the household is doing. */
export function paintWindows(g: CanvasRenderingContext2D, wins: readonly Win[], strength: number, time: number, stories: boolean): void {
  if (!wins.length || strength <= 0.02) return;
  const a = Math.min(1, strength), prev = g.globalAlpha;
  g.globalAlpha = prev * a;
  for (const w of wins) { g.beginPath(); quadPath(g, w, 0, 1, 0, 1); g.fillStyle = w.col; g.fill(); }
  // bloom: additive halos, a wide faint one and a tight one
  g.globalCompositeOperation = "lighter";
  for (const [grow, al] of [[0.5, 0.05], [0.2, 0.09]] as const) {
    for (const w of wins) {
      const col = w.col, r = parseInt(col.slice(1, 3), 16), gg = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
      g.beginPath(); quadPath(g, w, -grow, 1 + grow, -grow, 1 + grow); g.fillStyle = `rgba(${r},${gg},${b},${al})`; g.fill();
    }
  }
  g.globalCompositeOperation = "source-over";
  if (stories) paintWindowStories(g, wins, time);
  g.globalAlpha = prev;
}

/** Warm light spilling out of a shop front or lobby onto the footpath: a fading parallelogram on the ground (additive). */
export function paintSpill(g: CanvasRenderingContext2D, near0: Pt, near1: Pt, far0: Pt, far1: Pt, col: string, strength: number): void {
  if (strength <= 0.02) return;
  const r = parseInt(col.slice(1, 3), 16), gg = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
  // iso-lines of "distance from the wall" run parallel to the wall edge, so the gradient axis is the screen normal to that edge
  const ex = near1[0] - near0[0], ey = near1[1] - near0[1], el = Math.hypot(ex, ey) || 1;
  let nx = -ey / el, ny = ex / el;
  const dist = (far0[0] - near0[0]) * nx + (far0[1] - near0[1]) * ny;
  if (dist < 0) { nx = -nx; ny = -ny; }
  const d = Math.abs(dist);
  const grd = g.createLinearGradient(near0[0], near0[1], near0[0] + nx * d, near0[1] + ny * d);
  grd.addColorStop(0, `rgba(${r},${gg},${b},${(0.3 * strength).toFixed(3)})`); grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = "lighter"; g.fillStyle = grd;
  g.beginPath(); g.moveTo(near0[0], near0[1]); g.lineTo(near1[0], near1[1]); g.lineTo(far1[0], far1[1]); g.lineTo(far0[0], far0[1]); g.closePath(); g.fill();
  g.globalCompositeOperation = prev;
}
