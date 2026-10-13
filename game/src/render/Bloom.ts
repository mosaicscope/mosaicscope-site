import { T, World } from "../world/World";
import type { Camera } from "./Camera";

/**
 * Park flowers. Compost bins set `world.bloom[area]` (0..1); this draws that many little flowers
 * on the park's grass, so a park nobody tends is plain and a well-fed one is a meadow. Ground
 * decals only: no sorting, no allocation, and skipped when zoomed far out.
 */
const PETALS = ["#ff7ad9", "#f6b62c", "#fff6c8", "#3dd6ff", "#ec2a1c", "#c6a0ff"];
const hash = (a: number, b: number): number => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function drawBlooms(g: CanvasRenderingContext2D, world: World, cam: Camera, z: number, time: number, minX: number, maxX: number, minY: number, maxY: number): void {
  if (!world.bloom.size || z < 0.8) return;
  const S = world.size, pt = { x: 0, y: 0 };
  for (const [id, bloom] of world.bloom) {
    const a = world.areas[id];
    if (!a || a.x1 < minX || a.x0 > maxX || a.y1 < minY || a.y0 > maxY) continue;
    for (let ty = Math.max(a.y0, minY); ty <= Math.min(a.y1, maxY); ty++) for (let tx = Math.max(a.x0, minX); tx <= Math.min(a.x1, maxX); tx++) {
      if (world.tiles[ty * S + tx] !== T.GRASS) continue;
      const h = hash(tx, ty);
      if (h > bloom * 0.7) continue;
      const fx = tx + 0.2 + hash(ty, tx) * 0.6, fy = ty + 0.2 + hash(tx + 7, ty + 3) * 0.6;
      cam.toScreen(fx, fy, 0, pt);
      const sway = Math.sin(time * 1.6 + tx * 0.7 + ty) * 0.8 * z, big = bloom > 0.6 && h < 0.12;
      g.strokeStyle = "#2f7d2c"; g.lineWidth = Math.max(1, 0.9 * z); g.beginPath(); g.moveTo(pt.x, pt.y); g.lineTo(pt.x + sway, pt.y - (big ? 7 : 5) * z); g.stroke();
      g.fillStyle = PETALS[Math.floor(hash(tx * 3, ty * 5) * PETALS.length)];
      g.beginPath(); g.arc(pt.x + sway, pt.y - (big ? 7 : 5) * z, (big ? 2.4 : 1.7) * z, 0, 6.283); g.fill();
      g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(pt.x + sway, pt.y - (big ? 7 : 5) * z, 0.7 * z, 0, 6.283); g.fill();
    }
  }
}
