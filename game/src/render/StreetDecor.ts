import { World, T, PERIOD, ROAD_W } from "../world/World";
import { hash01 } from "./noir";

/**
 * Street dressing for the iso view: kerb trees, planters, bollards, bike racks and cafe tables.
 * Purely visual (no collision, nothing saved): the layout is a pure function of the world, so it is
 * the same every load, and it lives in one byte per tile so the renderer only looks at tiles on screen.
 * Follows game/docs/LOOK.md: warm-dark materials, accents small, greenery at the edges of concrete.
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
    const roadS = w.mapped?w.tile(tx,ty+1)===T.ROAD:w.isRoadLine(ty + 1) && !w.isRoadLine(tx), roadN = w.mapped?w.tile(tx,ty-1)===T.ROAD:w.isRoadLine(ty - 1) && !w.isRoadLine(tx);
    const roadE = w.mapped?w.tile(tx+1,ty)===T.ROAD:w.isRoadLine(tx + 1) && !w.isRoadLine(ty), roadW = w.mapped?w.tile(tx-1,ty)===T.ROAD:w.isRoadLine(tx - 1) && !w.isRoadLine(ty);
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

const INK = "#0e0b0a";
/** Warm-dark foliage, with the odd autumn tree so the canopy is not one flat green. */
const LEAF: [string, string, string][] = [["#183a1c", "#1f4a22", "#2a5f2a"], ["#1b3a22", "#245230", "#33663a"], ["#2a3a1a", "#3a4f1f", "#506a28"], ["#4a2a14", "#7a421a", "#a8651e"]];

/** Draw one decor piece centred on the tile at (sx, sy). `dark` is 0 (day) .. 1 (night); `n` a 0..1 per-tile seed. */
export function drawDecor(g: CanvasRenderingContext2D, kind: number, sx: number, sy: number, z: number, time: number, dark: number, n: number): void {
  switch (kind) {
    case D.TREE: {
      const pal = LEAF[n < 0.14 ? 3 : n < 0.5 ? 0 : n < 0.8 ? 1 : 2];
      const sway = Math.sin(time * 0.7 + n * 20) * 1.6 * z, r = (13 + n * 4) * z;
      g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(sx + 4 * z, sy + 2 * z, 17 * z, 7 * z, 0, 0, 6.283); g.fill();
      // iron tree guard on a patch of soil
      g.fillStyle = "#2a1f18"; g.beginPath(); g.ellipse(sx, sy, 9 * z, 4.5 * z, 0, 0, 6.283); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.2 * z; g.stroke();
      g.strokeStyle = "#4a3020"; g.lineWidth = 3.2 * z; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + sway * 0.1, sy - 24 * z); g.stroke(); g.lineCap = "butt";
      const cy = sy - 34 * z;
      g.fillStyle = pal[0]; g.beginPath(); g.arc(sx + sway * 0.5 - 7 * z, cy + 4 * z, r * 0.85, 0, 6.283); g.arc(sx + sway * 0.5 + 8 * z, cy + 3 * z, r * 0.8, 0, 6.283); g.fill();
      g.fillStyle = pal[1]; g.beginPath(); g.arc(sx + sway * 0.8, cy - 2 * z, r, 0, 6.283); g.fill();
      g.fillStyle = pal[2]; g.beginPath(); g.arc(sx + sway - 3 * z, cy - 7 * z, r * 0.55, 0, 6.283); g.fill();
      if (dark < 0.5) { g.fillStyle = "rgba(255,210,122,.1)"; g.beginPath(); g.arc(sx + sway - 5 * z, cy - 9 * z, r * 0.35, 0, 6.283); g.fill(); }
      break;
    }
    case D.PLANTER: {
      const w = 10 * z, h = 7 * z;
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(sx + 2 * z, sy + 1 * z, 11 * z, 4.5 * z, 0, 0, 6.283); g.fill();
      g.fillStyle = "#3a2c24"; g.fillRect(sx - w, sy - h, w * 2, h); g.fillStyle = "#4a382d"; g.fillRect(sx - w, sy - h, w * 2, 2 * z);
      g.fillStyle = "#1f4a22"; g.beginPath(); g.arc(sx - 5 * z, sy - h - 2 * z, 5.5 * z, 0, 6.283); g.arc(sx + 4 * z, sy - h - 3 * z, 6.5 * z, 0, 6.283); g.fill();
      g.fillStyle = "#2a5f2a"; g.beginPath(); g.arc(sx, sy - h - 6 * z, 4 * z, 0, 6.283); g.fill();
      // one small bloom, the colour picked per planter
      g.fillStyle = n < 0.4 ? "#f6b62c" : n < 0.7 ? "#ff7ad9" : "#eee4d3"; g.beginPath(); g.arc(sx + 2 * z, sy - h - 7 * z, 1.7 * z, 0, 6.283); g.arc(sx - 6 * z, sy - h - 4 * z, 1.4 * z, 0, 6.283); g.fill();
      break;
    }
    case D.BOLLARDS: {
      for (let i = -1; i <= 1; i++) {
        const bx = sx + i * 9 * z, by = sy + i * 4.5 * z;
        g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(bx + 2 * z, by + 1 * z, 4 * z, 2 * z, 0, 0, 6.283); g.fill();
        g.fillStyle = "#2a2630"; g.fillRect(bx - 2.2 * z, by - 11 * z, 4.4 * z, 11 * z);
        g.beginPath(); g.arc(bx, by - 11 * z, 2.2 * z, Math.PI, 0); g.fill();
        g.fillStyle = "#9a8d80"; g.fillRect(bx - 2.2 * z, by - 8 * z, 4.4 * z, 1.4 * z);
      }
      break;
    }
    case D.BIKES: {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 1.6 * z;
      for (let i = -1; i <= 1; i++) { const bx = sx + i * 8 * z, by = sy + i * 4 * z; g.beginPath(); g.moveTo(bx - 3 * z, by); g.lineTo(bx - 3 * z, by - 7 * z); g.arc(bx, by - 7 * z, 3 * z, Math.PI, 0); g.lineTo(bx + 3 * z, by); g.stroke(); }
      if (n < 0.6) { // one bike locked to the rack
        g.strokeStyle = n < 0.3 ? "#ec2a1c" : "#3dd6ff"; g.lineWidth = 1.2 * z;
        g.beginPath(); g.arc(sx - 3 * z, sy - 3 * z, 4 * z, 0, 6.283); g.moveTo(sx + 11 * z, sy - 1 * z); g.arc(sx + 7 * z, sy - 1 * z, 4 * z, 0, 6.283);
        g.moveTo(sx - 3 * z, sy - 3 * z); g.lineTo(sx + 1 * z, sy - 9 * z); g.lineTo(sx + 7 * z, sy - 1 * z); g.stroke();
      }
      break;
    }
    case D.CAFE: {
      const glow = dark > 0.3;
      for (const [dx, dy] of [[-8, -3], [9, 3]] as const) { // two chairs
        g.fillStyle = "#4a3020"; g.fillRect(sx + (dx - 3) * z, sy + (dy - 2) * z, 6 * z, 2 * z); g.fillRect(sx + (dx - 3) * z, sy + (dy - 8) * z, 6 * z, 1.6 * z);
      }
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(sx + 1 * z, sy + 1 * z, 9 * z, 4 * z, 0, 0, 6.283); g.fill();
      g.strokeStyle = "#2a2630"; g.lineWidth = 1.6 * z; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 9 * z); g.stroke();
      g.fillStyle = "#eee4d3"; g.strokeStyle = INK; g.lineWidth = 1 * z; g.beginPath(); g.ellipse(sx, sy - 9 * z, 8 * z, 3.6 * z, 0, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = glow ? "#ffd27a" : "#9a8d80"; g.beginPath(); g.arc(sx + 2 * z, sy - 10 * z, 1.6 * z, 0, 6.283); g.fill(); // a candle by night, a cup by day
      if (glow) { g.fillStyle = "rgba(255,210,122,.14)"; g.beginPath(); g.ellipse(sx, sy - 6 * z, 17 * z, 7 * z, 0, 0, 6.283); g.fill(); }
      break;
    }
  }
}
