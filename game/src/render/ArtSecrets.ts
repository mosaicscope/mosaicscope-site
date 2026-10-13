import { hash01 } from "./noir";
import { TICKS_PER_HOUR } from "../sim/Environment";

/**
 * Louis's art secrets, pure data and drawing helpers (all original work, no real brands or people):
 *   1. golden-hour murals: tile mosaics that only show on certain blank gable walls in the 2D street while the light is low
 *   2. the painting of the week: a small rotating show in the gallery, one canvas per in-game week
 *   3. comic-panel moments: which big events get a comic strip in 2D, and how the strip is laid out
 * The sim is never touched; everything is a function of the clock or of an event that already happened.
 */

// ------------------------------------------------------------------ the clock
const ramp = (h: number, a: number, b: number): number => { const t = Math.max(0, Math.min(1, (h - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0..1: how golden the light is. A soft evening peak (17:30 to 18:30) and a gentler dawn one. */
export function goldenHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const eve = ramp(h, 16.4, 17.5) * (1 - ramp(h, 18.5, 19.6));
  const dawn = 0.8 * ramp(h, 5.8, 6.4) * (1 - ramp(h, 7.0, 7.8));
  return Math.max(eve, dawn);
}

/** Whole in-game days since the world began, and the week they fall in (7 days). */
export function gameDay(startHour: number, tick: number): number { return Math.floor((startHour + tick / TICKS_PER_HOUR) / 24); }
export function gameWeek(startHour: number, tick: number): number { return Math.floor(gameDay(startHour, tick) / 7); }

// ------------------------------------------------------------------ murals
// Colours are the site's tokens (styles.css :root, see docs/LOOK.md): ink ground, paper, red, acid, sodium and the neon figure colours.
export const MURAL_WALL = "#1a1412", MURAL_GROUT = "#0e0b0a";
export const MURAL_W = 24, MURAL_H = 16;
export interface MuralDesign {
  id: string; name: string; palette: readonly string[];
  /** Palette index for the tile at (x, y), or -1 for bare wall. */
  tile(x: number, y: number): number;
}
const TAU = Math.PI * 2;
const flower = (x: number, y: number, cx: number, cy: number, s: number): number => {
  const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / s, a = Math.atan2(dy, dx);
  if (r < 0.28) return 3;
  if (r < 0.62 + 0.05 * Math.cos(5 * a)) return 1;
  return r < 1 + 0.42 * Math.cos(5 * a) ? 0 : -1;
};

export const MURALS: readonly MuralDesign[] = [
  {
    id: "sun-tide", name: "Sun and Tide", palette: ["#f6b62c", "#ff7ad9", "#ec2a1c", "#3dd6ff", "#b48cff", "#eee4d3"],
    tile(x, y) {
      if (y >= 11) { const row = y - 11; return (x + row * 2) % 4 < 2 ? 3 : 4; }
      const dx = x - 11.5, dy = (y - 10.5) * 1.15, r = Math.hypot(dx, dy);
      if (r < 3) return 0; if (r < 4.6) return 1; if (r < 6) return 2;
      const a = Math.atan2(dy, dx);
      return r < 11 && Math.floor((a + Math.PI) / (Math.PI / 10)) % 2 === 0 ? 5 : -1;
    },
  },
  {
    id: "kowhai-bloom", name: "Kowhai Bloom", palette: ["#f6b62c", "#eee4d3", "#c6ff3d", "#ec2a1c", "#3a6a10"],
    tile(x, y) {
      const f = flower(x, y, 12, 6.5, 5.6); if (f >= 0) return f;
      const f2 = flower(x, y, 4, 11.5, 2.8); if (f2 >= 0) return f2;
      const f3 = flower(x, y, 20, 10.5, 3.2); if (f3 >= 0) return f3;
      if (y >= 12 && x === 12) return 2;
      if (y >= 12 && Math.abs(x - 12) === y - 11 && Math.abs(x - 12) <= 3) return 4;
      return -1;
    },
  },
  {
    id: "koru-current", name: "Koru Current", palette: ["#3dd6ff", "#b48cff", "#eee4d3", "#ec2a1c"],
    tile(x, y) {
      const dx = x - 11.5, dy = (y - 7.5) * 1.25, r = Math.hypot(dx, dy);
      if (r > 9.5) return -1;
      if (r < 1.3) return 3;
      const p = (((r / 2.2 - Math.atan2(dy, dx) / TAU) % 1) + 1) % 1;
      return p < 0.52 ? (Math.floor(r / 4.4) % 2 === 0 ? 0 : 1) : (r > 8.2 ? 2 : -1);
    },
  },
];

/** Which gable walls hold a mural: a facade index maps to a design index, or -1 for none. Stable for every load. */
export function muralAt(facade: number): number {
  return hash01(facade * 29 + 5) < 0.16 ? Math.floor(hash01(facade * 41 + 9) * MURALS.length) : -1;
}

// ------------------------------------------------------------------ painting of the week
export type PaintStyle = "horizon" | "hills" | "moon" | "grid" | "circles" | "stripes" | "city" | "lines" | "waves";
export interface Painting {
  id: string; title: string; artist: string; medium: string; note: string;
  style: PaintStyle;
  /** Ground, then four colours the style picks from. */
  pal: readonly [string, string, string, string, string];
}

export const PAINTINGS: readonly Painting[] = [
  { id: "square-rain", title: "Cathedral Square, Seven Minutes After Rain", artist: "Dot Farrow", medium: "oil on board", note: "Everything is wet and slightly surprised.", style: "city", pal: ["#1a1412", "#9a8d80", "#ec2a1c", "#f6b62c", "#0e0b0a"] },
  { id: "blue-square", title: "Blue Square With Reservations", artist: "The Thursday Painters", medium: "acrylic on canvas", note: "The reservations are in the corner. They are very small.", style: "grid", pal: ["#eee4d3", "#3dd6ff", "#ec2a1c", "#f6b62c", "#0e0b0a"] },
  { id: "hill-opinions", title: "Hill With Opinions", artist: "Kit Penhale", medium: "gouache", note: "It has thoughts about the weather and it will share them.", style: "hills", pal: ["#f2d9a0", "#6a8a3a", "#4a6a4a", "#ec2a1c", "#3a2a3a"] },
  { id: "moon-chips", title: "The Moon Considers a Chip Shop", artist: "Mabel Tuck", medium: "oil on canvas", note: "Not tonight, the moon decides. Maybe Thursday.", style: "moon", pal: ["#1a1412", "#eee4d3", "#f6b62c", "#3dd6ff", "#b48cff"] },
  { id: "low-tide", title: "Low Tide at the Estuary", artist: "Pip and Wren", medium: "watercolour", note: "Painted standing in it. The shoes are still drying.", style: "horizon", pal: ["#cfd8dc", "#8fb3c0", "#d6a27c", "#4a6a7a", "#eee4d3"] },
  { id: "nine-lamps", title: "Nine Lamps", artist: "Old Hemi Quill", medium: "ink and gold leaf", note: "There are ten. One went home.", style: "lines", pal: ["#0e0b0a", "#f6b62c", "#c9a24a", "#9a8d80", "#1a1412"] },
  { id: "washing-windy", title: "Washing Line, Windy", artist: "Dot Farrow", medium: "oil on board", note: "Every sheet is a different opinion about the wind.", style: "stripes", pal: ["#bcd4e6", "#eee4d3", "#ec2a1c", "#3dd6ff", "#f6b62c"] },
  { id: "field-mostly", title: "A Field, Mostly", artist: "Kit Penhale", medium: "gouache", note: "Mostly field. The rest is a very patient fence.", style: "horizon", pal: ["#f2d9a0", "#a8c46a", "#6a8a3a", "#c9a24a", "#4a6a4a"] },
  { id: "orange-less", title: "Orange, Then Less Orange", artist: "The Thursday Painters", medium: "acrylic on canvas", note: "A study in giving up, gently.", style: "circles", pal: ["#f6e6c8", "#ec2a1c", "#f6b62c", "#f6b62c", "#ec2a1c"] },
  { id: "heron-thinking", title: "Heron, Thinking", artist: "Mabel Tuck", medium: "oil on canvas", note: "The heron has been thinking since the frame was bought.", style: "waves", pal: ["#3dd6ff", "#c6ff3d", "#eee4d3", "#1a1412", "#8fb3c0"] },
  { id: "roof-cat", title: "Roof Cat, Moonlit", artist: "Pip and Wren", medium: "ink on paper", note: "Somebody's cat, nobody's business.", style: "city", pal: ["#0e0b0a", "#1a1412", "#f6b62c", "#eee4d3", "#0e0b0a"] },
  { id: "bus-east", title: "Tuesday Bus, Eastbound", artist: "Anonymous (found in a skip)", medium: "house paint on a door", note: "Provenance: a skip. Condition: a door.", style: "stripes", pal: ["#1a1412", "#f6b62c", "#eee4d3", "#ec2a1c", "#3dd6ff"] },
];

/** The painting hanging in the gallery for a given in-game week. Rotates through the whole catalogue before it repeats. */
export function paintingOfWeek(week: number): Painting { return PAINTINGS[((week % PAINTINGS.length) + PAINTINGS.length) % PAINTINGS.length]; }

/** The little card beside it. */
export function paintingCard(p: Painting, week: number): string { return `Painting of the week ${week + 1}: “${p.title}”, ${p.artist}. ${p.medium[0].toUpperCase()}${p.medium.slice(1)}. ${p.note}`; }

/** Paint a picture into the rect (x, y, w, h). Plain shapes, seeded by the painting so it never shimmers. */
export function paintPainting(g: CanvasRenderingContext2D, p: Painting, x: number, y: number, w: number, h: number): void {
  const [bg, c1, c2, c3, c4] = p.pal;
  let seed = 0; for (let i = 0; i < p.id.length; i++) seed = (seed * 31 + p.id.charCodeAt(i)) | 0;
  const r = (n: number): number => hash01(seed + n * 977);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  switch (p.style) {
    case "horizon": {
      const hz = y + h * (0.5 + r(1) * 0.12);
      g.fillStyle = c1; g.fillRect(x, y, w, hz - y);
      g.fillStyle = c4; g.beginPath(); g.arc(x + w * (0.3 + r(2) * 0.4), hz - h * 0.12, h * 0.1, 0, TAU); g.fill();
      g.fillStyle = c2; g.fillRect(x, hz, w, y + h - hz);
      g.fillStyle = c3; for (let i = 0; i < 6; i++) g.fillRect(x + r(i + 3) * w * 0.8, hz + 3 + i * (y + h - hz) / 7, w * (0.1 + r(i + 9) * 0.2), Math.max(1, h * 0.03));
      break;
    }
    case "hills": {
      g.fillStyle = c4; g.beginPath(); g.arc(x + w * 0.75, y + h * 0.22, h * 0.1, 0, TAU); g.fill();
      for (let k = 0; k < 3; k++) {
        g.fillStyle = [c1, c2, c3][k]; g.beginPath(); g.moveTo(x, y + h);
        for (let i = 0; i <= 8; i++) g.lineTo(x + (w * i) / 8, y + h * (0.45 + k * 0.17) + Math.sin(i * 0.9 + k * 2 + r(k) * 3) * h * 0.09);
        g.lineTo(x + w, y + h); g.closePath(); g.fill();
      }
      break;
    }
    case "moon": {
      g.fillStyle = c4; for (let i = 0; i < 18; i++) g.fillRect(x + r(i) * w, y + r(i + 40) * h * 0.55, 1.2, 1.2);
      g.fillStyle = c1; g.beginPath(); g.arc(x + w * 0.62, y + h * 0.32, h * 0.2, 0, TAU); g.fill();
      g.fillStyle = bg; g.beginPath(); g.arc(x + w * 0.69, y + h * 0.28, h * 0.17, 0, TAU); g.fill();
      g.fillStyle = c4; g.fillRect(x, y + h * 0.74, w, h * 0.26);
      g.fillStyle = c3; g.fillRect(x + w * 0.2, y + h * 0.78, w * 0.3, h * 0.14); g.fillStyle = c2; g.fillRect(x + w * 0.24, y + h * 0.82, w * 0.06, h * 0.06);
      break;
    }
    case "grid": {
      const xs = [0.34 + r(1) * 0.1, 0.72], ys = [0.4, 0.78 - r(2) * 0.1];
      g.fillStyle = c1; g.fillRect(x, y, w * xs[0], h * ys[0]);
      g.fillStyle = c2; g.fillRect(x + w * xs[1], y + h * ys[1], w * (1 - xs[1]), h * (1 - ys[1]));
      g.fillStyle = c3; g.fillRect(x + w * xs[1], y, w * (1 - xs[1]), h * 0.18);
      g.fillStyle = c4; for (const px of xs) g.fillRect(x + w * px - 1, y, 2, h); for (const py of ys) g.fillRect(x, y + h * py - 1, w, 2);
      break;
    }
    case "circles": {
      for (let i = 0; i < 5; i++) { g.fillStyle = [c1, c2, c3, c4, c1][i]; g.globalAlpha = 0.9 - i * 0.1; g.beginPath(); g.arc(x + w * (0.25 + i * 0.12), y + h * (0.5 + Math.sin(i * 1.7) * 0.12), h * (0.34 - i * 0.05), 0, TAU); g.fill(); }
      g.globalAlpha = 1; break;
    }
    case "stripes": {
      const n = 8; for (let i = 0; i < n; i++) { g.fillStyle = [c1, c2, c3, c4][Math.floor(r(i + 5) * 4)]; const sw = w / n; g.fillRect(x + i * sw + 1, y + h * (0.05 + r(i) * 0.18), sw - 2, h * (0.5 + r(i + 20) * 0.35)); }
      g.fillStyle = c4; g.fillRect(x, y + h * 0.04, w, 2); break;
    }
    case "city": {
      g.fillStyle = c1; g.fillRect(x, y + h * 0.2, w, h * 0.5);
      g.fillStyle = c2; g.beginPath(); g.arc(x + w * 0.78, y + h * 0.28, h * 0.1, 0, TAU); g.fill();
      for (let i = 0; i < 9; i++) {
        const bw = w / 9, bh = h * (0.25 + r(i) * 0.4);
        g.fillStyle = c4; g.fillRect(x + i * bw, y + h - bh, bw - 1, bh);
        g.fillStyle = c3; for (let wy = 0; wy < bh - 8; wy += 8) if (r(i * 7 + wy) < 0.35) g.fillRect(x + i * bw + 3, y + h - bh + 4 + wy, 3, 4);
      }
      break;
    }
    case "lines": {
      g.fillStyle = c4; g.fillRect(x, y + h * 0.82, w, 2);
      for (let i = 0; i < 9; i++) {
        const lx = x + w * (0.08 + i * 0.105), top = y + h * (0.22 + r(i) * 0.16);
        g.fillStyle = c3; g.fillRect(lx - 1, top, 2, y + h * 0.82 - top);
        g.fillStyle = c1; g.globalAlpha = 0.2; g.beginPath(); g.arc(lx, top, h * 0.09, 0, TAU); g.fill(); g.globalAlpha = 1; g.fillStyle = c1; g.beginPath(); g.arc(lx, top, h * 0.03, 0, TAU); g.fill();
      }
      break;
    }
    case "waves": {
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = [c1, c2, c4, c1, c2, c4][k]; g.lineWidth = Math.max(1.5, h * 0.05); g.beginPath();
        for (let i = 0; i <= 12; i++) { const px = x + (w * i) / 12, py = y + h * (0.45 + k * 0.1) + Math.sin(i * 1.1 + k) * h * 0.04; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
      }
      g.fillStyle = c3; g.fillRect(x + w * 0.5, y + h * 0.12, 2, h * 0.34); g.fillRect(x + w * 0.5 - 2, y + h * 0.1, 7, 3);
      break;
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ comic moments
export interface Moment { word: string; hue: string; rank: number; verb: string }
const MOMENTS: Record<string, Moment> = {
  car_crash: { word: "KRAKOOM!", hue: "#f6b62c", rank: 5, verb: "Crash" },
  car_hit: { word: "WHUMP!", hue: "#ec2a1c", rank: 5, verb: "Ouch" },
  busted: { word: "BUSTED!", hue: "#3dd6ff", rank: 5, verb: "Nabbed" },
  arrest: { word: "CLINK!", hue: "#3dd6ff", rank: 4, verb: "Nabbed" },
  collapse: { word: "THUD.", hue: "#b48cff", rank: 4, verb: "Down" },
  caught_cheating: { word: "GASP!", hue: "#ff7ad9", rank: 4, verb: "Awkward" },
  blackout: { word: "FZZZT!", hue: "#eee4d3", rank: 4, verb: "Lights out" },
  knockdown: { word: "BONK!", hue: "#c6ff3d", rank: 3, verb: "Down" },
  melee_hit: { word: "BONK!", hue: "#c6ff3d", rank: 3, verb: "Wallop" },
  kiss: { word: "SMOOCH", hue: "#ff7ad9", rank: 3, verb: "Aww" },
  panic: { word: "EEEK!", hue: "#f6b62c", rank: 3, verb: "Panic" },
  party: { word: "WOOOO!", hue: "#3dd6ff", rank: 3, verb: "Party" },
};
export const COMIC_MIN_RANK = 3;

/** The comic treatment for a world event, or null if it is not a big moment. */
export function classifyMoment(type: string, severity: number): (Moment & { rank: number }) | null {
  const m = MOMENTS[type]; if (!m) return null;
  const rank = m.rank + (severity >= 4 ? 0.5 : 0);
  return rank >= COMIC_MIN_RANK ? { ...m, rank } : null;
}

export interface PanelRect { x: number; y: number; w: number; h: number; slant: number }
/** Three panels in a band across the scene (below the HUD on phones, clear of the cash readout on wide screens), never taller than a third of the screen. */
export function comicLayout(W: number, H: number): PanelRect[] {
  const margin = Math.max(8, Math.min(24, W * 0.02)), gut = 10, narrow = W < 760, top = narrow ? Math.max(215, H * 0.27) : Math.max(64, H * 0.1);
  const right = narrow ? margin : 190;   // wide screens keep the cash and health readout clear
  const h = narrow ? Math.min(Math.max(120, H * 0.24), 200) : Math.min(Math.max(120, H * 0.3), 260), avail = W - margin - right - gut * 2, slant = Math.min(22, h * 0.12);
  const weights = [1.3, 1, 1], sum = weights[0] + weights[1] + weights[2];
  const out: PanelRect[] = []; let cx = margin;
  for (const wt of weights) { const pw = (avail * wt) / sum; out.push({ x: cx, y: top, w: pw, h, slant }); cx += pw + gut; }
  return out;
}

/** How far panel `i` has popped in (0..1) at time `t` seconds into a strip that lasts `dur`; the whole strip fades at the end. */
export function panelProgress(i: number, t: number, dur: number): { pop: number; fade: number } {
  const pop = Math.max(0, Math.min(1, (t - i * 0.28) / 0.22)), fade = Math.max(0, Math.min(1, (dur - t) / 0.5));
  return { pop, fade };
}
