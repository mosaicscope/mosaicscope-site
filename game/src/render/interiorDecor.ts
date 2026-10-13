/**
 * Where Louis hangs wall lamps and framed pictures in an interior, so every room reads as lived-in
 * like the cutaway references (art-requests/007, 009, 010). Pure and deterministic: the same room
 * always gets the same decor, and nothing is placed over a wall prop or the doorway.
 */
import { PROP_INFO, type InteriorDef } from "../content/interiors";

export interface WallSpot { side: "n" | "w"; at: number; len: number; seed: number }

const PITCH = 3.4, MARGIN = 0.35;

/** Occupied stretches of each wall (wall props, plus the doorway on the west wall). */
function occupied(def: InteriorDef): Record<"n" | "w", [number, number][]> {
  const occ: Record<"n" | "w", [number, number][]> = { n: [], w: [[def.door.y - 1.0, def.door.y + 1.0]] };
  for (const p of def.props) {
    if (!PROP_INFO[p.type].wall) continue;
    if (p.y === 0) occ.n.push([p.x, p.x + p.w]); else occ.w.push([p.y, p.y + p.h]);
  }
  return occ;
}
const free = (occ: [number, number][], a: number, b: number): boolean => occ.every(([s, e]) => b + MARGIN <= s || a - MARGIN >= e);
const seedOf = (side: string, at: number): number => Math.round(at * 100) * 31 + (side === "n" ? 7 : 13);

function slots(def: InteriorDef, first: number, len: number, side: "n" | "w"): WallSpot[] {
  const wallLen = side === "n" ? def.size.w : def.size.h, occ = occupied(def)[side], out: WallSpot[] = [];
  for (let c = first; c + len / 2 < wallLen - 0.5; c += PITCH) {
    const a = c - len / 2, b = c + len / 2;
    if (a > 0.4 && free(occ, a, b)) out.push({ side, at: a, len, seed: seedOf(side, c) });
  }
  return out;
}

/** Wall lamps, one every PITCH tiles along both back walls. */
export const wallSconces = (def: InteriorDef): WallSpot[] => [...slots(def, PITCH / 2, 0.5, "n"), ...slots(def, PITCH / 2, 0.5, "w")];
/** Framed pictures, halfway between the lamps. */
export const wallPictures = (def: InteriorDef): WallSpot[] => [...slots(def, PITCH, 1.0, "n"), ...slots(def, PITCH, 1.0, "w")];
