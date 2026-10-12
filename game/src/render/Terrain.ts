import { World, T, TILE_HEIGHT, Poi } from "../world/World";
import { TILE_W, TILE_H, Z_PX } from "../world/iso";
import { GROUND } from "./palette";
import type { Camera } from "./Camera";
import { drawAd } from "./Ads";

/**
 * Ground is pre-rendered into 16x16-tile chunk canvases (only rebuilt when tiles change).
 * Tall tiles (walls, trees, stalls, fences...) are drawn per frame inside the depth-sorted pass.
 */
const CH = 16;

export class Terrain {
  private chunks = new Map<number, { cv: HTMLCanvasElement; ox: number; oy: number }>();
  chunksBuilt = 0;
  constructor(private world: World) {}

  invalidateAll(): void { this.chunks.clear(); }

  private noise(i: number): number { let h = (i * 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  private build(cx: number, cy: number) {
    const w = this.world, S = w.size;
    const x0 = cx * CH, y0 = cy * CH;
    const ox = (x0 - (y0 + CH)) * (TILE_W / 2), oy = (x0 + y0) * (TILE_H / 2);
    const cv = document.createElement("canvas");
    cv.width = CH * TILE_W + 2; cv.height = CH * TILE_H + 2;
    const g = cv.getContext("2d")!;
    for (let ty = y0; ty < Math.min(S, y0 + CH); ty++) for (let tx = x0; tx < Math.min(S, x0 + CH); tx++) {
      const t = w.tiles[ty * S + tx];
      const base = groundOf(w, tx, ty, t);
      const n = this.noise(ty * S + tx);
      const [c1, c2] = GROUND[base] ?? ["#1a1614", "#1e1a17"];
      const sx = (tx - ty) * (TILE_W / 2) - ox, sy = (tx + ty) * (TILE_H / 2) - oy;
      // diamond
      g.fillStyle = n < 0.5 ? c1 : c2;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2); g.lineTo(sx, sy + TILE_H); g.lineTo(sx - TILE_W / 2, sy + TILE_H / 2); g.closePath(); g.fill();
      detail(g, base, sx, sy, n, w, tx, ty);
    }
    this.chunksBuilt++;
    return { cv, ox, oy };
  }

  draw(g: CanvasRenderingContext2D, cam: Camera): void {
    const S = this.world.size, n = Math.ceil(S / CH);
    for (const i of this.world.dirtyTiles) { const tx = i % S, ty = Math.floor(i / S); this.chunks.delete(Math.floor(ty / CH) * n + Math.floor(tx / CH)); }
    this.world.dirtyTiles.clear();
    const z = cam.zoom, pt = { x: 0, y: 0 };
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
      const x0 = cx * CH, y0 = cy * CH;
      cam.toScreen(x0, y0 + CH, 0, pt); const left = pt.x;
      cam.toScreen(x0 + CH, y0, 0, pt); const right = pt.x;
      cam.toScreen(x0, y0, 0, pt); const top = pt.y;
      cam.toScreen(x0 + CH, y0 + CH, 0, pt); const bottom = pt.y;
      if (right < 0 || left > cam.viewW || bottom < 0 || top > cam.viewH) continue;
      const key = cy * n + cx;
      let ch = this.chunks.get(key);
      if (!ch) { ch = this.build(cx, cy); this.chunks.set(key, ch); }
      g.drawImage(ch.cv, left, top, ch.cv.width * z, ch.cv.height * z);
    }
  }
}

/** What ground to paint under a tile (solid tiles show their district's floor). */
function groundOf(w: World, tx: number, ty: number, t: number): number {
  if (GROUND[t] && t !== T.WATER) return t;
  if (t === T.WATER) return T.WATER;
  const a = w.areas[w.areaOf[ty * w.size + tx]];
  switch (a?.kind) { case "studio": return T.FLOOR; case "court": return T.COURT; case "market": return T.PATH; case "park": case "residential": return T.GRASS; default: return T.PAVE; }
}

function detail(g: CanvasRenderingContext2D, t: number, sx: number, sy: number, n: number, w: World, tx: number, ty: number): void {
  const hw = TILE_W / 2, hh = TILE_H / 2;
  switch (t) {
    case T.GRASS: {
      g.strokeStyle = "rgba(198,255,61,.07)"; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = (n * 7 + i * 0.37) % 1, b = (n * 13 + i * 0.61) % 1; const x = sx + (a - 0.5) * hw, y = sy + hh + (b - 0.5) * hh * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 3); g.stroke(); }
      break;
    }
    case T.PAVE: case T.PATH: {
      g.strokeStyle = t === T.PAVE ? "rgba(238,228,211,.05)" : "rgba(0,0,0,.18)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx - hw + 3, sy + hh); g.lineTo(sx, sy + 2); g.lineTo(sx + hw - 3, sy + hh); g.stroke();
      break;
    }
    case T.FLOOR: {
      g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx - hw / 2, sy + hh / 2); g.lineTo(sx + hw / 2, sy + hh * 1.5); g.stroke();
      break;
    }
    case T.COURT: {
      const edge = (dx: number, dy: number) => w.tile(tx + dx, ty + dy) !== T.COURT && w.tile(tx + dx, ty + dy) !== T.FENCE;
      g.strokeStyle = "rgba(238,228,211,.35)"; g.lineWidth = 1.5; g.beginPath();
      if (edge(0, -1)) { g.moveTo(sx, sy + 3); g.lineTo(sx + hw - 4, sy + hh); }
      if (edge(-1, 0)) { g.moveTo(sx, sy + 3); g.lineTo(sx - hw + 4, sy + hh); }
      g.stroke();
      break;
    }
    case T.SAND: g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 4; i++) g.fillRect(sx + ((n * (i + 3) * 17) % 1 - 0.5) * hw, sy + hh + ((n * (i + 5) * 11) % 1 - 0.5) * hh, 1.5, 1.5); break;
    case T.STREET: {
      const S = w.size;
      if ((ty === 1 || ty === S - 2) && tx % 3 === 0) { g.strokeStyle = "rgba(246,182,44,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - hw * 0.5, sy + hh * 0.5); g.lineTo(sx + hw * 0.5, sy + hh * 1.5); g.stroke(); }
      if ((tx === 1 || tx === S - 2) && ty % 3 === 0) { g.strokeStyle = "rgba(246,182,44,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx + hw * 0.5, sy + hh * 0.5); g.lineTo(sx - hw * 0.5, sy + hh * 1.5); g.stroke(); }
      break;
    }
    case T.ROAD: {
      const P = w.period;
      const vertical = w.isRoadLine(tx) && !w.isRoadLine(ty), horizontal = w.isRoadLine(ty) && !w.isRoadLine(tx);
      g.strokeStyle = "rgba(246,182,44,.55)"; g.lineWidth = 1.5; g.setLineDash([7, 7]);
      g.beginPath();
      // centre line sits between the two lanes
      if (horizontal && ty % P === 0) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy + TILE_H); }
      if (vertical && tx % P === 0) { g.moveTo(sx + hw, sy + hh); g.lineTo(sx, sy + TILE_H); }
      g.stroke(); g.setLineDash([]);
      break;
    }
    case T.CROSSWALK: {
      // zebra stripes running along the direction of travel; (u, v) are tile-local 0..1 coords
      const vertical = w.isRoadLine(tx);
      const a = (u: number, v: number) => [sx + (u - v) * hw, sy + (u + v) * hh];
      g.fillStyle = "rgba(238,228,211,.55)";
      for (let i = 0; i < 4; i++) {
        const t0 = 0.08 + i * 0.23, t1 = t0 + 0.12;
        const q = vertical ? [a(t0, 0.15), a(t1, 0.15), a(t1, 0.85), a(t0, 0.85)] : [a(0.15, t0), a(0.15, t1), a(0.85, t1), a(0.85, t0)];
        g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath(); g.fill();
      }
      break;
    }
    case T.SIDEWALK: {
      g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx - hw * 0.5, sy + hh * 0.5); g.lineTo(sx + hw * 0.5, sy + hh * 1.5); g.stroke();
      const kerb = (dx: number, dy: number) => { const t = w.tile(tx + dx, ty + dy); return t === T.ROAD || t === T.CROSSWALK; };
      g.strokeStyle = "rgba(238,228,211,.28)"; g.lineWidth = 2; g.beginPath();
      if (kerb(0, 1)) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy + TILE_H); }
      if (kerb(1, 0)) { g.moveTo(sx, sy + TILE_H); g.lineTo(sx + hw, sy + hh); }
      if (kerb(0, -1)) { g.moveTo(sx, sy); g.lineTo(sx + hw, sy + hh); }
      if (kerb(-1, 0)) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy); }
      g.stroke();
      break;
    }
    case T.PARKING: {
      if ((tx + ty) % 2 === 0) { g.strokeStyle = "rgba(238,228,211,.35)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx - hw * 0.8, sy + hh * 0.8); g.lineTo(sx - hw * 0.2, sy + hh * 0.2); g.stroke(); }
      break;
    }
    case T.STAGE: {
      const edge = (dx: number, dy: number) => w.tile(tx + dx, ty + dy) !== T.STAGE;
      g.strokeStyle = "rgba(255,122,217,.7)"; g.lineWidth = 2; g.beginPath();
      if (edge(0, -1)) { g.moveTo(sx, sy); g.lineTo(sx + hw, sy + hh); }
      if (edge(1, 0)) { g.moveTo(sx + hw, sy + hh); g.lineTo(sx, sy + TILE_H); }
      if (edge(0, 1)) { g.moveTo(sx, sy + TILE_H); g.lineTo(sx - hw, sy + hh); }
      if (edge(-1, 0)) { g.moveTo(sx - hw, sy + hh); g.lineTo(sx, sy); }
      g.stroke();
      g.fillStyle = "rgba(255,122,217,.05)"; g.fillRect(sx - 2, sy + hh - 1, 4, 2);
      break;
    }
  }
}

/** Draw one tall tile as an isometric block or object. (sx, sy) = screen position of the tile's north corner. */
export function drawTallTile(g: CanvasRenderingContext2D, t: number, sx: number, sy: number, z: number, time: number, n: number): void {
  const hw = (TILE_W / 2) * z, hh = (TILE_H / 2) * z, h = (TILE_HEIGHT[t] ?? 1) * Z_PX * z;
  const block = (top: string, left: string, right: string, hh2 = h, inset = 0) => {
    const ix = hw * inset, iy = hh * inset;
    const N = [sx, sy + iy * 2], E = [sx + hw - ix, sy + hh], S = [sx, sy + hh * 2 - iy * 2], W = [sx - hw + ix, sy + hh];
    g.fillStyle = left; g.beginPath(); g.moveTo(W[0], W[1]); g.lineTo(S[0], S[1]); g.lineTo(S[0], S[1] - hh2); g.lineTo(W[0], W[1] - hh2); g.closePath(); g.fill();
    g.fillStyle = right; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); g.lineTo(E[0], E[1] - hh2); g.lineTo(S[0], S[1] - hh2); g.closePath(); g.fill();
    g.fillStyle = top; g.beginPath(); g.moveTo(N[0], N[1] - hh2); g.lineTo(E[0], E[1] - hh2); g.lineTo(S[0], S[1] - hh2); g.lineTo(W[0], W[1] - hh2); g.closePath(); g.fill();
  };
  switch (t) {
    case T.WALL: block("#4a3a2e", "#30261f", "#272019"); g.strokeStyle = "rgba(198,255,61,.25)"; g.lineWidth = Math.max(1, z); g.beginPath(); g.moveTo(sx - hw, sy + hh - h); g.lineTo(sx, sy + hh * 2 - h); g.lineTo(sx + hw, sy + hh - h); g.stroke(); break;
    case T.STALL: {
      block("#4a3a2c", "#33281f", "#2a211a", h * 0.75, 0.12);
      // striped awning
      const ah = h * 1.05;
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? "#eee4d3" : "#ec2a1c";
        const a = i / 4, b = (i + 1) / 4;
        g.beginPath();
        g.moveTo(sx - hw + hw * 2 * a * 0.5 + 0, sy + hh - ah + hh * a); g.lineTo(sx - hw + hw * b, sy + hh - ah + hh * b);
        g.lineTo(sx - hw + hw * b + hw * 0.25, sy + hh - ah + hh * b + hh * 0.5); g.lineTo(sx - hw + hw * a + hw * 0.25, sy + hh - ah + hh * a + hh * 0.5);
        g.closePath(); g.fill();
      }
      break;
    }
    case T.TREE: {
      g.strokeStyle = "#4a3020"; g.lineWidth = 4 * z;
      g.beginPath(); g.moveTo(sx, sy + hh); g.lineTo(sx, sy + hh - 30 * z); g.stroke();
      const sway = Math.sin(time * 0.8 + n * 10) * 2 * z;
      const greens = ["#183a1c", "#1f4a22", "#2a5f2a"];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = greens[i];
        g.beginPath(); g.arc(sx + sway * (i + 1) / 3 + (i - 1) * 6 * z, sy + hh - (34 + i * 10) * z, (17 - i * 3) * z, 0, 6.283); g.fill();
      }
      g.fillStyle = "rgba(198,255,61,.12)"; g.beginPath(); g.arc(sx + sway - 4 * z, sy + hh - 58 * z, 6 * z, 0, 6.283); g.fill();
      break;
    }
    case T.FENCE: {
      g.strokeStyle = "rgba(154,141,128,.55)"; g.lineWidth = Math.max(1, 1.2 * z);
      g.beginPath();
      for (const [px, py] of [[sx - hw, sy + hh], [sx, sy + hh * 2], [sx + hw, sy + hh]]) { g.moveTo(px, py); g.lineTo(px, py - h); }
      g.moveTo(sx - hw, sy + hh - h); g.lineTo(sx, sy + hh * 2 - h); g.lineTo(sx + hw, sy + hh - h);
      g.moveTo(sx - hw, sy + hh - h * 0.5); g.lineTo(sx, sy + hh * 2 - h * 0.5); g.lineTo(sx + hw, sy + hh - h * 0.5);
      g.stroke();
      break;
    }
    case T.HEDGE: block("#1f4a22", "#163518", "#112a13", h, 0.05); break;
    case T.CRATE: block("#7a4a22", "#5a3618", "#4a2c14", h, 0.15); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = z; g.beginPath(); g.moveTo(sx - hw * 0.85, sy + hh - h * 0.5); g.lineTo(sx, sy + hh * 1.85 - h * 0.5); g.lineTo(sx + hw * 0.85, sy + hh - h * 0.5); g.stroke(); break;
    case T.FOUNTAIN: {
      block("#3a3430", "#2a2420", "#221d1a", h);
      g.fillStyle = `rgba(61,214,255,${0.35 + Math.sin(time * 2 + n * 6) * 0.08})`;
      g.beginPath(); g.moveTo(sx, sy + hh * 0.3 - h); g.lineTo(sx + hw * 0.8, sy + hh - h); g.lineTo(sx, sy + hh * 1.7 - h); g.lineTo(sx - hw * 0.8, sy + hh - h); g.closePath(); g.fill();
      break;
    }
  }
}

/** Points of interest (benches, lamps, boombox, chests, hoops, spring pads). */
export function drawPoi(g: CanvasRenderingContext2D, p: Poi, sx: number, sy: number, z: number, time: number, party: boolean, dark: boolean): void {
  switch (p.kind) {
    case "bench": {
      g.strokeStyle = "#9a5a1c"; g.lineWidth = 3 * z; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx - 14 * z, sy - 5 * z); g.lineTo(sx + 14 * z, sy + 2 * z); g.stroke();
      g.lineWidth = 2 * z; g.beginPath(); g.moveTo(sx - 14 * z, sy - 13 * z); g.lineTo(sx + 14 * z, sy - 6 * z); g.moveTo(sx - 12 * z, sy - 5 * z); g.lineTo(sx - 12 * z, sy + 2 * z); g.moveTo(sx + 12 * z, sy + 2 * z); g.lineTo(sx + 12 * z, sy + 8 * z); g.stroke();
      break;
    }
    case "lamp": {
      g.strokeStyle = "#3a3430"; g.lineWidth = 2.5 * z;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 66 * z); g.lineTo(sx + 8 * z, sy - 66 * z); g.stroke();
      g.fillStyle = p.on ? (dark ? "#fff6c8" : "#d8d0b0") : "#3a3430";
      g.beginPath(); g.arc(sx + 8 * z, sy - 63 * z, 4 * z, 0, 6.283); g.fill();
      break;
    }
    case "boombox": {
      const pulse = party ? 1 + Math.abs(Math.sin(time * 7.5)) * 0.12 : 1;
      const w = 22 * z * pulse, h = 13 * z * pulse;
      g.fillStyle = "#1a1614"; g.strokeStyle = party ? "#c6ff3d" : "#9a8d80"; g.lineWidth = 1.5 * z;
      g.beginPath(); g.rect(sx - w / 2, sy - h - 3 * z, w, h); g.fill(); g.stroke();
      g.beginPath(); g.arc(sx - w * 0.25, sy - h / 2 - 3 * z, h * 0.32, 0, 6.283); g.arc(sx + w * 0.25, sy - h / 2 - 3 * z, h * 0.32, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(sx - w * 0.3, sy - h - 3 * z); g.lineTo(sx - w * 0.2, sy - h - 8 * z); g.lineTo(sx + w * 0.2, sy - h - 8 * z); g.lineTo(sx + w * 0.3, sy - h - 3 * z); g.stroke();
      break;
    }
    case "toychest": {
      g.fillStyle = "#6b3a12"; g.strokeStyle = "#f6b62c"; g.lineWidth = 1.2 * z;
      g.beginPath(); g.rect(sx - 11 * z, sy - 12 * z, 22 * z, 12 * z); g.fill(); g.stroke();
      g.fillStyle = "#7a4a22"; g.beginPath(); g.ellipse(sx, sy - 12 * z, 11 * z, 4 * z, 0, Math.PI, 0); g.fill(); g.stroke();
      break;
    }
    case "hoop": {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 2 * z;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 58 * z); g.stroke();
      g.fillStyle = "rgba(238,228,211,.8)"; g.fillRect(sx - 9 * z, sy - 70 * z, 18 * z, 12 * z);
      g.strokeStyle = "#ff9a3d"; g.beginPath(); g.ellipse(sx, sy - 56 * z, 6 * z, 2.5 * z, 0, 0, 6.283); g.stroke();
      break;
    }
    case "springpad": {
      g.strokeStyle = "#c6ff3d"; g.lineWidth = 1.5 * z;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(sx, sy - i * 2.5 * z, 12 * z, 6 * z, 0, 0, 6.283); g.stroke(); }
      break;
    }
    case "busstop": {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 2 * z;
      g.beginPath(); g.moveTo(sx - 12 * z, sy); g.lineTo(sx - 12 * z, sy - 34 * z); g.moveTo(sx + 12 * z, sy + 4 * z); g.lineTo(sx + 12 * z, sy - 30 * z); g.stroke();
      g.fillStyle = "rgba(61,214,255,.25)"; g.beginPath(); g.moveTo(sx - 14 * z, sy - 34 * z); g.lineTo(sx + 14 * z, sy - 30 * z); g.lineTo(sx + 14 * z, sy - 26 * z); g.lineTo(sx - 14 * z, sy - 30 * z); g.closePath(); g.fill();
      g.fillStyle = "#f6b62c"; g.fillRect(sx - 12 * z, sy - 44 * z, 8 * z, 10 * z);
      g.fillStyle = "#0e0b0a"; g.font = `700 ${Math.max(5, Math.round(6 * z))}px monospace`; g.fillText("BUS", sx - 11.5 * z, sy - 37 * z);
      break;
    }
    case "foodtruck": {
      g.fillStyle = "#eee4d3"; g.fillRect(sx - 20 * z, sy - 26 * z, 40 * z, 20 * z);
      g.fillStyle = "#ec2a1c"; g.fillRect(sx - 20 * z, sy - 30 * z, 40 * z, 5 * z);
      g.fillStyle = "#0e0b0a"; g.fillRect(sx - 12 * z, sy - 22 * z, 18 * z, 8 * z);
      g.fillStyle = "#0e0b0a"; g.beginPath(); g.arc(sx - 12 * z, sy - 4 * z, 4 * z, 0, 6.283); g.arc(sx + 12 * z, sy - 4 * z, 4 * z, 0, 6.283); g.fill();
      if (p.name) { g.fillStyle = "#ec2a1c"; g.font = `700 ${Math.max(6, Math.round(7 * z))}px "IBM Plex Mono", monospace`; g.textAlign = "center"; g.fillText(p.name, sx, sy - 33 * z); g.textAlign = "start"; }
      break;
    }
    case "atm": g.fillStyle = "#3a3430"; g.fillRect(sx - 6 * z, sy - 22 * z, 12 * z, 22 * z); g.fillStyle = "#c6ff3d"; g.fillRect(sx - 4 * z, sy - 19 * z, 8 * z, 5 * z); break;
    case "hydrant": g.fillStyle = "#ec2a1c"; g.fillRect(sx - 3 * z, sy - 10 * z, 6 * z, 10 * z); g.beginPath(); g.arc(sx, sy - 10 * z, 3 * z, Math.PI, 0); g.fill(); break;
    case "light": {
      g.strokeStyle = "#9a8d80"; g.lineWidth = 1.5 * z;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 40 * z); g.moveTo(sx - 6 * z, sy); g.lineTo(sx, sy - 10 * z); g.lineTo(sx + 6 * z, sy); g.stroke();
      g.fillStyle = "#eee4d3"; g.fillRect(sx - 7 * z, sy - 52 * z, 14 * z, 12 * z);
      break;
    }
    case "billboard": {
      g.strokeStyle = "#3a3430"; g.lineWidth = 3 * z; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 40 * z); g.stroke();
      drawAd(g, p.name === "cars" ? "cars" : "mosaic", sx, sy - 38 * z, 84 * z, 30 * z, p.id + Math.floor(time / 10), dark ? 1 : 0);
      break;
    }
    case "plane": {
      // a parked widebody on the apron, nose to the east; world x = (32, 16) px, world y = (-32, 16) px, up = 26 px
      const W = (wx: number, wy: number, h: number) => [sx + (wx - wy) * 32 * z, sy + (wx + wy) * 16 * z - h * 26 * z];
      const line = (pts: number[][], lw: number, col: string) => { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round"; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.lineCap = "butt"; };
      const polyF = (pts: number[][], col: string) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); };
      // shadow
      polyF([W(-3.6, -0.4, 0), W(3.6, -0.4, 0), W(3.6, 0.4, 0), W(-3.6, 0.4, 0)], "rgba(0,0,0,.25)");
      polyF([W(-0.6, -3.4, 0), W(0.6, -0.3, 0), W(0.6, 0.3, 0), W(-0.6, 3.4, 0)], "rgba(0,0,0,.2)");
      // far wing + engine
      polyF([W(0.7, -0.3, 1.0), W(-0.7, -3.4, 0.95), W(-1.1, -3.4, 0.95), W(-0.4, -0.3, 1.0)], "#b8b0a4");
      line([W(0.3, -1.4, 0.75), W(-0.3, -1.4, 0.75)], 7 * z, "#6a6560");
      // gear
      line([W(1.8, 0, 0), W(1.8, 0, 0.8)], 2 * z, "#3a3430"); line([W(-0.2, 0.3, 0), W(-0.2, 0.3, 0.8)], 2 * z, "#3a3430");
      // fuselage
      line([W(-3.4, 0, 1.25), W(3.2, 0, 1.25)], 20 * z, "#eee4d3");
      line([W(-3.4, 0, 1.0), W(3.2, 0, 1.0)], 8 * z, "#d0c8bc");
      line([W(-3.2, 0, 1.12), W(2.9, 0, 1.12)], 3 * z, "#1c4f6b");
      // nose cone + cockpit
      const n = W(3.55, 0, 1.25); g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(n[0], n[1], 9 * z, 0, 6.283); g.fill();
      polyF([W(3.3, -0.2, 1.45), W(3.55, -0.1, 1.42), W(3.55, 0.1, 1.42), W(3.3, 0.2, 1.45)], "#1c2a3e");
      // windows
      g.fillStyle = "#3a5068"; for (let i = 0; i < 18; i++) { const q = W(-2.8 + i * 0.32, 0.2, 1.38); g.fillRect(q[0] - 1.2 * z, q[1] - 1.2 * z, 2.4 * z, 2.4 * z); }
      // near wing + engine
      polyF([W(0.7, 0.3, 1.0), W(-0.7, 3.4, 0.95), W(-1.1, 3.4, 0.95), W(-0.4, 0.3, 1.0)], "#d8d0c4");
      line([W(0.4, 1.5, 0.72), W(-0.3, 1.5, 0.72)], 8 * z, "#8a8580");
      // tail fin with a koru-ish swoosh in the crew's neon
      polyF([W(-2.6, 0, 1.6), W(-3.5, 0, 3.0), W(-3.9, 0, 3.0), W(-3.6, 0, 1.5)], "#0e0b0a");
      line([W(-3.0, 0, 2.0), W(-3.5, 0, 2.6)], 2.5 * z, "#3dd6ff");
      // tailplane
      polyF([W(-3.2, -0.1, 1.5), W(-3.8, -1.1, 1.5), W(-3.9, 1.1, 1.5), W(-3.2, 0.1, 1.5)], "#c8c0b4");
      break;
    }
    case "mural": break;
    case "door": {
      if (p.building === -2) {
        g.font = `700 ${Math.round(11 * z)}px "Big Shoulders Display", Impact, sans-serif`;
        g.textAlign = "center";
        g.fillStyle = "#ff7ad9"; g.shadowColor = "#ff7ad9"; g.shadowBlur = dark ? 10 * z : 0;
        g.fillText("MOSAICSCOPE STUDIO", sx, sy - 70 * z);
        g.shadowBlur = 0; g.textAlign = "start";
      }
      break;
    }
  }
}
