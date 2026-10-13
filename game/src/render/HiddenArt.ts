import type { Building } from "../world/World";
import { TILE_W, TILE_H } from "../world/iso";
import { STATIONS, GARDENERS, hash, mossCover, panelCount, panelAt, type HiddenSpot } from "../content/hiddenPlaces";

export interface HiddenCtx { time: number; dark: number; day: number; tags: number }
const TAU = 6.283;

/** Screen offset of a world delta (u east, v south) from an anchor, at zoom z. */
const off = (u: number, v: number, z: number): [number, number] => [(u - v) * (TILE_W / 2) * z, (u + v) * (TILE_H / 2) * z];
const glow = (g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) => {
  g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r, r * 0.5, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
};

/** One hidden place on the street, drawn at its ground point. */
export function drawHidden(g: CanvasRenderingContext2D, s: HiddenSpot, sx: number, sy: number, z: number, o: HiddenCtx): void {
  const night = o.dark > 0.3;
  switch (s.id) {
    case "ladder": ladder(g, sx, sy, z, o.time, night); break;
    case "subway": stairs(g, sx, sy, z, "#2f7d4a", "SUBWAY", o.time); break;
    case "station": station(g, s.station ?? 0, sx, sy, z, o); break;
    case "glitch": glitch(g, sx, sy, z, o.time); break;
    case "neon": mossWall(g, sx, sy, z, o); break;
  }
}

function ladder(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, time: number, night: boolean): void {
  const H = 92 * z;
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(sx, sy + z, 9 * z, 3.5 * z, 0, 0, TAU); g.fill();
  g.strokeStyle = "#8a8f98"; g.lineWidth = 2 * z; g.lineCap = "round";
  for (const dx of [-4, 4]) { g.beginPath(); g.moveTo(sx + dx * z, sy); g.lineTo(sx + dx * z, sy - H); g.stroke(); }
  g.lineWidth = 1.4 * z; g.strokeStyle = "#b6bbc4";
  for (let i = 1; i < 9; i++) { const y = sy - (H / 9) * i; g.beginPath(); g.moveTo(sx - 4 * z, y); g.lineTo(sx + 4 * z, y); g.stroke(); }
  // a bobbing lantern at the top so the ladder is findable
  const bob = Math.sin(time * 2.4) * 2 * z;
  if (night) glow(g, sx, sy - H - 4 * z + bob, 16 * z, "#ffd36a", 0.3);
  g.fillStyle = "#ffd36a"; g.beginPath(); g.arc(sx, sy - H - 4 * z + bob, 2.6 * z, 0, TAU); g.fill();
}

function stairs(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, col: string, text: string, time: number): void {
  // a dark stairwell mouth in the pavement with a round sign on a pole
  g.fillStyle = "#14140f"; g.beginPath(); const [a, b] = off(0.55, 0, z), [c, d] = off(0, 0.55, z), [e, f] = off(0.55, 0.55, z);
  g.moveTo(sx, sy - 6 * z); g.lineTo(sx + a, sy + b - 6 * z); g.lineTo(sx + e, sy + f - 6 * z); g.lineTo(sx + c, sy + d - 6 * z); g.closePath(); g.fill();
  g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = z;
  for (let i = 1; i < 5; i++) { const t = i / 5; g.beginPath(); g.moveTo(sx + a * t, sy + b * t - 6 * z); g.lineTo(sx + a * t + c, sy + b * t + d - 6 * z); g.stroke(); }
  g.strokeStyle = "#555"; g.lineWidth = 1.6 * z; g.beginPath(); g.moveTo(sx - 8 * z, sy + z); g.lineTo(sx - 8 * z, sy - 34 * z); g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(sx - 8 * z, sy - 38 * z, 7 * z, 0, TAU); g.fill();
  g.strokeStyle = "#eee4d3"; g.lineWidth = z; g.stroke();
  g.fillStyle = "#eee4d3"; g.font = `bold ${Math.max(6, 6 * z)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("▼", sx - 8 * z, sy - 38 * z + Math.sin(time * 3) * 0.5 * z);
  if (z >= 1) { g.fillStyle = "rgba(238,228,211,.9)"; g.font = `bold ${7 * z}px sans-serif`; g.fillText(text, sx - 8 * z, sy - 49 * z); }
  g.textAlign = "start"; g.textBaseline = "alphabetic";
}

/** Each station is its own little neighbourhood: a tinted pool of light, a sign and five themed props. */
function station(g: CanvasRenderingContext2D, i: number, sx: number, sy: number, z: number, o: HiddenCtx): void {
  const st = STATIONS[i];
  glow(g, sx, sy, 78 * z, st.tint, 0.1 + o.dark * 0.14);
  glow(g, sx, sy, 46 * z, st.tint, 0.1 + o.dark * 0.1);
  stairs(g, sx, sy, z, st.tint, st.name.toUpperCase(), o.time);
  if (z < 0.8) return;
  for (let k = 0; k < 5; k++) {
    const h = hash(i, k, 91), ang = (h % 628) / 100, r = 1.4 + (h >>> 8) % 20 / 10;
    const [dx, dy] = off(Math.cos(ang) * r, Math.sin(ang) * r, z), px = sx + dx, py = sy + dy;
    prop(g, st.prop, st.tint, px, py, z, o.time + k * 1.7, o.dark > 0.3);
  }
}

function prop(g: CanvasRenderingContext2D, kind: string, tint: string, x: number, y: number, z: number, t: number, night: boolean): void {
  g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y + z, 5 * z, 2 * z, 0, 0, TAU); g.fill();
  switch (kind) {
    case "lantern": { // paper lantern on a pole
      g.strokeStyle = "#444"; g.lineWidth = z; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 26 * z); g.stroke();
      const sw = Math.sin(t * 1.6) * 1.5 * z; if (night) glow(g, x + sw, y - 20 * z, 14 * z, tint, 0.35);
      g.fillStyle = tint; g.beginPath(); g.ellipse(x + sw, y - 20 * z, 4.5 * z, 5.5 * z, 0, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x + sw - 3 * z, y - 21 * z, 6 * z, z); break;
    }
    case "pigeon": { // a grey bird on a post, head bobbing
      g.fillStyle = "#555"; g.fillRect(x - z, y - 8 * z, 2 * z, 8 * z);
      const bob = Math.sin(t * 5) * 1.2 * z; g.fillStyle = tint; g.beginPath(); g.ellipse(x, y - 11 * z, 4.2 * z, 3 * z, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + 3.8 * z, y - 13 * z + bob, 1.9 * z, 0, TAU); g.fill();
      g.fillStyle = "#e8a23c"; g.fillRect(x + 5.4 * z, y - 13.3 * z + bob, 1.8 * z, 0.9 * z); break;
    }
    case "sign": { // an upside-down sign
      g.strokeStyle = "#444"; g.lineWidth = z; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 18 * z); g.stroke();
      g.fillStyle = tint; g.fillRect(x - 7 * z, y - 30 * z, 14 * z, 11 * z);
      g.save(); g.translate(x, y - 24.5 * z); g.rotate(Math.PI); g.fillStyle = "#14140f"; g.font = `bold ${5.5 * z}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SALE", 0, 0); g.restore();
      g.textAlign = "start"; g.textBaseline = "alphabetic"; break;
    }
    case "fern": { // fern fronds
      g.strokeStyle = tint; g.lineWidth = 1.6 * z; g.lineCap = "round";
      for (let f = -3; f <= 3; f++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + f * 3 * z, y - 12 * z, x + f * 5 * z + Math.sin(t + f) * z, y - 8 * z - Math.abs(f) * -1.5 * z); g.stroke(); }
      break;
    }
    case "tv": { // an old TV full of snow
      g.fillStyle = "#2b2b30"; g.fillRect(x - 7 * z, y - 15 * z, 14 * z, 12 * z);
      const n = hash(Math.floor(t * 8), Math.floor(x)); g.fillStyle = `rgb(${120 + n % 100},${130 + n % 90},${140 + n % 80})`; g.fillRect(x - 5.6 * z, y - 13.6 * z, 11.2 * z, 9 * z);
      g.fillStyle = "rgba(0,0,0,.18)"; for (let l = 0; l < 4; l++) g.fillRect(x - 5.6 * z, y - 13.6 * z + l * 2.4 * z, 11.2 * z, z);
      if (night) glow(g, x, y - 9 * z, 14 * z, tint, 0.25); break;
    }
    case "mushroom": { // a giant glowing mushroom
      g.fillStyle = "#e9dfc9"; g.fillRect(x - 2 * z, y - 10 * z, 4 * z, 10 * z);
      if (night) glow(g, x, y - 12 * z, 16 * z, tint, 0.3 + 0.1 * Math.sin(t * 2));
      g.fillStyle = tint; g.beginPath(); g.ellipse(x, y - 12 * z, 8 * z, 5 * z, 0, Math.PI, 0); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(x - 3 * z, y - 14 * z, 1.1 * z, 0, TAU); g.arc(x + 2 * z, y - 15 * z, 1.4 * z, 0, TAU); g.fill(); break;
    }
  }
}

/** Only there at 3:33: a door-shaped tear with split colour channels and noise. */
function glitch(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, time: number): void {
  const w = 22 * z, hgt = 54 * z, jit = (k: number) => (hash(Math.floor(time * 14), k) % 100 / 100 - 0.5);
  glow(g, sx, sy, 44 * z, "#3dd6ff", 0.2);
  g.fillStyle = "#06060c"; g.fillRect(sx - w / 2, sy - hgt, w, hgt);
  for (const [col, dx] of [["rgba(255,40,120,.55)", -3], ["rgba(60,230,255,.55)", 3]] as const) { g.fillStyle = col; g.fillRect(sx - w / 2 + dx * z + jit(1) * 4 * z, sy - hgt, w, hgt); }
  for (let i = 0; i < 9; i++) {
    const h = hash(Math.floor(time * 10), i), y = sy - hgt + (h % 100) / 100 * hgt, ww = (4 + h % 14) * z;
    g.fillStyle = h % 3 ? "rgba(255,255,255,.7)" : "rgba(198,255,61,.8)"; g.fillRect(sx - w / 2 + ((h >>> 8) % 12) * z * 0.8 + jit(i) * 5 * z, y, ww, 1.6 * z);
  }
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = z; g.strokeRect(sx - w / 2, sy - hgt, w, hgt);
}

/** A wall that keeps growing: neon strips, moss creeping up from the base, and panels that appear over the days. */
function mossWall(g: CanvasRenderingContext2D, sx: number, sy: number, z: number, o: HiddenCtx): void {
  const L = 3, wallH = 46 * z, [ex, ey] = off(L, 0, z), night = o.dark > 0.3;
  const x0 = sx - ex / 2, y0 = sy - ey / 2, cover = mossCover(o.day);
  g.fillStyle = "#3b3846"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ex, y0 + ey); g.lineTo(x0 + ex, y0 + ey - wallH); g.lineTo(x0, y0 - wallH); g.closePath(); g.fill();
  // neon strips
  const strip = (h: number, col: string) => { if (night) { g.globalAlpha = 0.35; g.strokeStyle = col; g.lineWidth = 6 * z; g.beginPath(); g.moveTo(x0, y0 - h); g.lineTo(x0 + ex, y0 + ey - h); g.stroke(); g.globalAlpha = 1; } g.strokeStyle = col; g.lineWidth = 1.6 * z; g.beginPath(); g.moveTo(x0, y0 - h); g.lineTo(x0 + ex, y0 + ey - h); g.stroke(); };
  strip(wallH - 3 * z, "#3dd6ff"); strip(5 * z, "#ff7ad9");
  // graffiti panels
  const n = panelCount(o.day, o.tags);
  for (let i = 0; i < n; i++) {
    const p = panelAt(i), row = Math.floor(i / 3), px = x0 + ex * p.u, py = y0 + ey * p.u - (9 + row * 12) * z;
    g.fillStyle = `hsl(${p.hue} 85% ${night ? 62 : 50}%)`; g.beginPath(); g.moveTo(px, py); g.lineTo(px + ex * p.w, py + ey * p.w); g.lineTo(px + ex * p.w, py + ey * p.w - 9 * z); g.lineTo(px, py - 9 * z); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(px + ex * p.w * 0.15, py + ey * p.w * 0.15 - 5.5 * z, ex * p.w * 0.6, 1.4 * z);
  }
  // moss: tufts along the base first, then up the wall as the days pass
  const tufts = Math.floor(6 + cover * 26);
  for (let k = 0; k < tufts; k++) {
    const h = hash(k, 5), u = (h % 1000) / 1000, climb = (h >>> 10) % 100 / 100 * cover * wallH * 0.8, r = (1.6 + (h >>> 20) % 3) * z;
    g.fillStyle = k % 3 ? "#3f7a3c" : "#5fae52"; g.beginPath(); g.ellipse(x0 + ex * u, y0 + ey * u - climb - r * 0.4, r * 1.3, r, 0, 0, TAU); g.fill();
  }
}

/** The garden on the roof: grass, planters, string lights, three neighbours having a quiet time. */
export function drawRoofGarden(g: CanvasRenderingContext2D, b: Building, sx: number, sy: number, z: number, time: number, dark: number): void {
  const w = b.x1 + 1 - b.x0, d = b.y1 + 1 - b.y0, hw = w / 2 - 0.35, hd = d / 2 - 0.35, night = dark > 0.3;
  const P = (u: number, v: number): [number, number] => { const [a, c] = off(u, v, z); return [sx + a, sy + c]; };
  g.fillStyle = "#3f8a3c"; g.beginPath(); const c = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)]; g.moveTo(c[0][0], c[0][1]); for (const q of c.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.fill();
  g.strokeStyle = "#6a4a2a"; g.lineWidth = 1.5 * z; g.stroke();
  // planters
  const n = Math.max(4, Math.floor(w * d / 2));
  for (let k = 0; k < n; k++) {
    const h = hash(b.id, k, 3), u = ((h % 100) / 100 - 0.5) * hw * 1.6, v = (((h >>> 8) % 100) / 100 - 0.5) * hd * 1.6, [px, py] = P(u, v);
    g.fillStyle = "#7a4a2a"; g.fillRect(px - 4 * z, py - 4 * z, 8 * z, 4 * z);
    g.fillStyle = k % 2 ? "#2f6b2c" : "#4f9a46"; g.beginPath(); g.ellipse(px, py - 6 * z, 4.6 * z, 3.6 * z, 0, 0, TAU); g.fill();
    g.fillStyle = k % 3 === 0 ? "#e84a3a" : k % 3 === 1 ? "#f6b62c" : "#ff7ad9"; g.beginPath(); g.arc(px - 1.6 * z, py - 7 * z, 1.1 * z, 0, TAU); g.arc(px + 2 * z, py - 5.6 * z, 1 * z, 0, TAU); g.fill();
  }
  // three gardeners, tiny and relaxed
  GARDENERS.forEach((_gd, k) => {
    const [px, py] = P(-hw * 0.5 + k * hw * 0.55, hd * 0.35), sway = Math.sin(time * 1.3 + k) * 0.8 * z;
    g.fillStyle = ["#e8a23c", "#6fe3b0", "#b48cff"][k]; g.fillRect(px - 2 * z + sway, py - 9 * z, 4 * z, 7 * z);
    g.fillStyle = "#e8c9a0"; g.beginPath(); g.arc(px + sway, py - 11 * z, 2.2 * z, 0, TAU); g.fill();
  });
  // string lights across the middle
  const [l0x, l0y] = P(-hw, 0), [l1x, l1y] = P(hw, 0);
  g.strokeStyle = "rgba(20,20,15,.7)"; g.lineWidth = 0.8 * z; g.beginPath(); g.moveTo(l0x, l0y - 16 * z); g.quadraticCurveTo((l0x + l1x) / 2, (l0y + l1y) / 2 - 8 * z, l1x, l1y - 16 * z); g.stroke();
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, x = l0x + (l1x - l0x) * t, y = l0y + (l1y - l0y) * t - 16 * z + Math.sin(t * Math.PI) * 8 * z;
    g.fillStyle = ["#ffd36a", "#ff7ad9", "#3dd6ff"][k % 3];
    if (night) { g.globalAlpha = 0.28; g.beginPath(); g.arc(x, y, 5 * z, 0, TAU); g.fill(); g.globalAlpha = 1; }
    g.beginPath(); g.arc(x, y, 1.5 * z, 0, TAU); g.fill();
  }
}
