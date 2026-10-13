import { World, T, PERIOD, ROAD_W } from "../world/World";
import { hash01 } from "./noir";

/**
 * Street dressing for the iso view: kerb trees, planters, bollards, bike racks and cafe tables.
 * Purely visual (no collision, nothing saved): the layout is a pure function of the world, so it is
 * the same every load, and it lives in one byte per tile so the renderer only looks at tiles on screen.
 * Follows game/docs/LOOK.md (v2, the website is the look): ink ground, neon line work, string bulbs, one red accent.
 */
export const enum D { NONE = 0, TREE = 1, PLANTER = 2, BOLLARDS = 3, BIKES = 4, CAFE = 5 }

const cache = new WeakMap<World, Uint8Array>();

/** Decor kind per tile (index = ty * size + tx). Built once per world. */
export function decorGrid(w: World): Uint8Array {
  let g = cache.get(w);
  if (g) return g;
  const S = w.size;
  g = new Uint8Array(S * S);
  // keep clear of anything a person walks up to: doors, crossings and every point of interest
  const busy = new Uint8Array(S * S);
  const mark = (x: number, y: number, r: number) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S && Y < S) busy[Y * S + X] = 1; } };
  for (const p of w.pois) mark(Math.floor(p.x), Math.floor(p.y), p.kind === "door" ? 2 : 1);
  for (let i = 0; i < S * S; i++) if (w.tiles[i] === T.CROSSWALK) mark(i % S, Math.floor(i / S), 2);
  const shopLike = (tx: number, ty: number): boolean => {
    const b = w.buildingAt(tx, ty);
    return !!b && (b.kind === "cafe" || b.kind === "diner" || b.kind === "pizza" || b.kind === "sushi" || b.kind === "bakery" || b.kind === "fishchips");
  };
  for (let ty = 1; ty < S - 1; ty++) for (let tx = 1; tx < S - 1; tx++) {
    const i = ty * S + tx;
    if (w.tiles[i] !== T.SIDEWALK || busy[i]) continue;
    const roadS = w.isRoadLine(ty + 1) && !w.isRoadLine(tx), roadN = w.isRoadLine(ty - 1) && !w.isRoadLine(tx);
    const roadE = w.isRoadLine(tx + 1) && !w.isRoadLine(ty), roadW = w.isRoadLine(tx - 1) && !w.isRoadLine(ty);
    const kerbX = roadS || roadN, kerbY = roadE || roadW; // kerb runs along x (road to the north/south) or along y
    const h = hash01(tx * 7919 + ty * 104729 + w.size);
    if (kerbX || kerbY) {
      const along = kerbX ? tx : ty, m = along % PERIOD;
      if (m < ROAD_W + 3 || m > PERIOD - 3) continue; // not at the corners
      const k = (along + (kerbX ? 3 : 1)) % 7;
      if (k === 3 && h < 0.9) g[i] = D.TREE;
      else if (k === 0 && h < 0.3) g[i] = D.BOLLARDS;
      else if (k === 5 && h < 0.35) g[i] = D.PLANTER;
      else if (k === 6 && along % 14 < 7 && h < 0.2) g[i] = D.BIKES;
      continue;
    }
    // the footpath beside a building: cafe tables outside eateries, a bike rack or planter elsewhere
    const wall = w.tile(tx, ty + 1) === T.BUILDING ? [tx, ty + 1] : w.tile(tx + 1, ty) === T.BUILDING ? [tx + 1, ty] : null;
    if (!wall) continue;
    if (shopLike(wall[0], wall[1]) && h < 0.22) g[i] = D.CAFE;
    else if (h > 0.97) g[i] = D.PLANTER;
    else if (h > 0.94) g[i] = D.BIKES;
  }
  cache.set(w, g);
  return g;
}

const INK2 = "#1a1412", PAPER = "#eee4d3", DIM = "#9a8d80", RED = "#ec2a1c", ACID = "#c6ff3d", SODIUM = "#f6b62c";
const NEON = [ACID, "#ff7ad9", "#3dd6ff", SODIUM, RED, PAPER, "#b48cff"];
/** Dark ink-green canopies with a thin neon rim (the website's line-on-black look); the odd tree turns sodium for autumn. */
const LEAF: [string, string, string, string][] = [["#10201a", "#14281c", "#1a3321", ACID], ["#0f1e1c", "#132a26", "#193630", "#3dd6ff"], ["#151f12", "#1b2a14", "#24391a", ACID], ["#2a1a0e", "#3a2410", "#4a2e12", SODIUM]];
const BULBS = [SODIUM, RED, ACID];

/** Draw one decor piece centred on the tile at (sx, sy). `dark` is 0 (day) .. 1 (night); `n` a 0..1 per-tile seed. */
export function drawDecor(g: CanvasRenderingContext2D, kind: number, sx: number, sy: number, z: number, time: number, dark: number, n: number): void {
  const lw = Math.max(1, 1.1 * z);
  switch (kind) {
    case D.TREE: {
      const pal = LEAF[n < 0.14 ? 3 : n < 0.5 ? 0 : n < 0.8 ? 1 : 2];
      const sway = Math.sin(time * 0.7 + n * 20) * 1.6 * z, r = (13 + n * 4) * z;
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx + 4 * z, sy + 2 * z, 17 * z, 7 * z, 0, 0, 6.283); g.fill();
      g.fillStyle = INK2; g.beginPath(); g.ellipse(sx, sy, 9 * z, 4.5 * z, 0, 0, 6.283); g.fill();
      g.strokeStyle = DIM; g.lineWidth = lw; g.stroke(); // tree guard ring
      g.strokeStyle = "#3a2a22"; g.lineWidth = 3.2 * z; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + sway * 0.1, sy - 24 * z); g.stroke(); g.lineCap = "butt";
      const cy = sy - 34 * z;
      const blob = (col: string, x: number, y: number, rr: number) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); };
      blob(pal[0], sx + sway * 0.5 - 7 * z, cy + 4 * z, r * 0.85); blob(pal[0], sx + sway * 0.5 + 8 * z, cy + 3 * z, r * 0.8);
      blob(pal[1], sx + sway * 0.8, cy - 2 * z, r); blob(pal[2], sx + sway - 3 * z, cy - 7 * z, r * 0.55);
      // neon rim light on the lamp side
      g.strokeStyle = pal[3]; g.globalAlpha = 0.55; g.lineWidth = lw; g.beginPath(); g.arc(sx + sway * 0.8, cy - 2 * z, r, Math.PI * 1.05, Math.PI * 1.7); g.stroke(); g.globalAlpha = 1;
      // a few string bulbs twinkling on a staggered clock, brighter at night
      const on = 0.35 + dark * 0.65;
      for (let i = 0; i < 3; i++) {
        const tw = 0.6 + 0.4 * Math.sin(time * 2.2 + n * 30 + i * 2.1), bx = sx + sway * 0.8 + (i - 1) * 9 * z, by = cy + 7 * z + Math.abs(i - 1) * -3 * z;
        g.globalAlpha = on * tw; g.fillStyle = BULBS[(i + Math.floor(n * 3)) % 3]; g.beginPath(); g.arc(bx, by, 1.7 * z, 0, 6.283); g.fill();
        if (dark > 0.3) { g.globalAlpha = on * tw * 0.18; g.beginPath(); g.arc(bx, by, 5 * z, 0, 6.283); g.fill(); }
      }
      g.globalAlpha = 1;
      break;
    }
    case D.PLANTER: {
      const w = 10 * z, h = 7 * z, bloom = NEON[Math.floor(n * 5) % 5];
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx + 2 * z, sy + 1 * z, 11 * z, 4.5 * z, 0, 0, 6.283); g.fill();
      g.fillStyle = INK2; g.fillRect(sx - w, sy - h, w * 2, h);
      g.strokeStyle = PAPER; g.globalAlpha = 0.55; g.lineWidth = lw; g.strokeRect(sx - w, sy - h, w * 2, h); g.globalAlpha = 1;
      g.fillStyle = "#14281c"; g.beginPath(); g.arc(sx - 5 * z, sy - h - 2 * z, 5.5 * z, 0, 6.283); g.arc(sx + 4 * z, sy - h - 3 * z, 6.5 * z, 0, 6.283); g.arc(sx, sy - h - 6 * z, 4 * z, 0, 6.283); g.fill();
      g.strokeStyle = ACID; g.globalAlpha = 0.5; g.lineWidth = lw; g.beginPath(); g.arc(sx + 4 * z, sy - h - 3 * z, 6.5 * z, Math.PI * 1.1, Math.PI * 1.75); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = bloom; g.beginPath(); g.arc(sx + 2 * z, sy - h - 7 * z, 1.7 * z, 0, 6.283); g.arc(sx - 6 * z, sy - h - 4 * z, 1.4 * z, 0, 6.283); g.fill();
      break;
    }
    case D.BOLLARDS: {
      for (let i = -1; i <= 1; i++) {
        const bx = sx + i * 9 * z, by = sy + i * 4.5 * z;
        g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(bx + 2 * z, by + 1 * z, 4 * z, 2 * z, 0, 0, 6.283); g.fill();
        g.fillStyle = INK2; g.fillRect(bx - 2.2 * z, by - 11 * z, 4.4 * z, 11 * z);
        g.beginPath(); g.arc(bx, by - 11 * z, 2.2 * z, Math.PI, 0); g.fill();
        g.fillStyle = dark > 0.3 ? RED : DIM; g.fillRect(bx - 2.2 * z, by - 8 * z, 4.4 * z, 1.4 * z); // a reflective band that catches the light
      }
      break;
    }
    case D.BIKES: {
      g.strokeStyle = PAPER; g.globalAlpha = 0.7; g.lineWidth = Math.max(1, 1.5 * z);
      for (let i = -1; i <= 1; i++) { const bx = sx + i * 8 * z, by = sy + i * 4 * z; g.beginPath(); g.moveTo(bx - 3 * z, by); g.lineTo(bx - 3 * z, by - 7 * z); g.arc(bx, by - 7 * z, 3 * z, Math.PI, 0); g.lineTo(bx + 3 * z, by); g.stroke(); }
      g.globalAlpha = 1;
      if (n < 0.6) { // one neon bike locked to the rack
        g.strokeStyle = NEON[Math.floor(n * 10) % 5]; g.lineWidth = lw;
        g.beginPath(); g.arc(sx - 3 * z, sy - 3 * z, 4 * z, 0, 6.283); g.moveTo(sx + 11 * z, sy - 1 * z); g.arc(sx + 7 * z, sy - 1 * z, 4 * z, 0, 6.283);
        g.moveTo(sx - 3 * z, sy - 3 * z); g.lineTo(sx + 1 * z, sy - 9 * z); g.lineTo(sx + 7 * z, sy - 1 * z); g.stroke();
      }
      break;
    }
    case D.CAFE: {
      const glow = dark > 0.3;
      g.strokeStyle = PAPER; g.globalAlpha = 0.6; g.lineWidth = lw;
      for (const [dx, dy] of [[-8, -3], [9, 3]] as const) { g.beginPath(); g.moveTo(sx + (dx - 3) * z, sy + (dy - 8) * z); g.lineTo(sx + (dx - 3) * z, sy + dy * z); g.lineTo(sx + (dx + 3) * z, sy + dy * z); g.stroke(); } // two chairs, line drawn
      g.globalAlpha = 1;
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(sx + 1 * z, sy + 1 * z, 9 * z, 4 * z, 0, 0, 6.283); g.fill();
      g.strokeStyle = DIM; g.lineWidth = Math.max(1, 1.4 * z); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 9 * z); g.stroke();
      g.fillStyle = INK2; g.strokeStyle = PAPER; g.lineWidth = lw; g.beginPath(); g.ellipse(sx, sy - 9 * z, 8 * z, 3.6 * z, 0, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = glow ? SODIUM : DIM; g.beginPath(); g.arc(sx + 2 * z, sy - 10 * z, 1.6 * z, 0, 6.283); g.fill(); // a candle by night, a cup by day
      if (glow) { g.fillStyle = "rgba(246,182,44,.14)"; g.beginPath(); g.ellipse(sx, sy - 6 * z, 17 * z, 7 * z, 0, 0, 6.283); g.fill(); }
      break;
    }
  }
}
