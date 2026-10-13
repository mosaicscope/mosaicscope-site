/**
 * Floor-plan builders shared by the interior tables (interiors.ts, interiorsShops.ts).
 * Types live in interiors.ts; this file only imports them as types so there is no import cycle.
 */
import type { Prop, PropType, Zone, FloorMat, Spot, SpotDoing } from "./interiors";

export const p = (type: PropType, x: number, y: number, w: number, h: number, color = "#888", label?: string, material?: Prop["material"]): Prop => ({ type, x, y, w, h, color, ...(label ? { label } : {}), ...(material ? { material } : {}) });
/** Wall-mounted prop. `side` n = north wall at position `at`, w = west wall. `len` is its width along the wall. */
export const wp = (type: PropType, side: "n" | "w", at: number, len: number, color: string, label?: string): Prop =>
  side === "n" ? p(type, at, 0, len, 0, color, label) : p(type, 0, at, 0, len, color, label);
export const z = (id: string, name: string, x: number, y: number, w: number, h: number, floor: FloorMat, color: string): Zone => ({ id, name, x, y, w, h, floor, color });
export const wallV = (x: number, y0: number, y1: number, color = "#2b3340"): Prop => p("partition", x - 0.1, y0, 0.2, y1 - y0, color);
export const wallH = (y: number, x0: number, x1: number, color = "#2b3340"): Prop => p("partition", x0, y - 0.1, x1 - x0, 0.2, color);
/** A row of n chairs starting at (x, y) stepping dx/dy. */
export const row = (type: PropType, n: number, x: number, y: number, dx: number, dy: number, w: number, h: number, color: string, label?: string): Prop[] =>
  Array.from({ length: n }, (_, i) => p(type, x + dx * i, y + dy * i, w, h, color, i === 0 ? label : undefined));
export const spot = (x: number, y: number, doing: SpotDoing, face: Spot["face"], group?: string): Spot => ({ x, y, doing, face, ...(group ? { group } : {}) });
