/**
 * Isometric projection. World space: x/y on the ground plane in tile units, z up in metres-ish units.
 * Screen space: pixels before camera transform. Kept pure so it is trivially testable.
 */
export const TILE_W = 64;
export const TILE_H = 32;
/** Pixels per world unit of height. */
export const Z_PX = 26;

export interface Pt { x: number; y: number }

export function worldToScreen(x: number, y: number, z = 0, out: Pt = { x: 0, y: 0 }): Pt {
  out.x = (x - y) * (TILE_W / 2);
  out.y = (x + y) * (TILE_H / 2) - z * Z_PX;
  return out;
}

/** Inverse for points on the ground plane (z = 0). */
export function screenToWorld(sx: number, sy: number, out: Pt = { x: 0, y: 0 }): Pt {
  const a = sx / (TILE_W / 2), b = sy / (TILE_H / 2);
  out.x = (a + b) / 2;
  out.y = (b - a) / 2;
  return out;
}

/** Painter's-order key: things further "down" the screen draw later. */
export const depthKey = (x: number, y: number, z = 0): number => x + y + z * 0.01;
