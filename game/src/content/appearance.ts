import { Rng } from "../core/rng";
import type { Face, Look, BodyKind, HatStyle, HairStyle } from "../entities/types";
import { PALETTE } from "./cast";

/**
 * Procedural appearance with guaranteed uniqueness: every person's combination of face, hair, hat
 * and colours is different (about 30 million combinations; collisions are re-rolled).
 */
const EYES: Face["eyes"][] = ["shades", "round", "dots", "visor", "aviator", "happy", "wide", "sleepy", "wink", "shutter", "cateye"];
const BROWS: Face["brows"][] = ["none", "straight", "angry", "raised", "thick", "worried"];
const MOUTHS: Face["mouth"][] = ["smile", "grin", "flat", "o", "smirk", "teeth", "frown", "tongue"];
const NOSES: Face["nose"][] = ["none", "dot", "line", "hook"];
const FACIAL: Face["facial"][] = ["none", "none", "none", "mustache", "goatee", "beard", "stubble", "soulpatch"];
const EXTRAS: Face["extra"][] = ["none", "none", "freckles", "earrings", "nosering", "blush", "tattoo", "scar", "mole"];
const HEADS: Face["head"][] = ["round", "round", "oval", "wide"];
const HAIR_GUY: HairStyle[] = ["none", "afro", "mohawk", "buzz", "curly", "spiky", "sidepart", "long", "topknot", "braids"];
const HAIR_GIRL: HairStyle[] = ["big", "bun", "pony", "long", "braids", "curly", "bob", "pigtails", "afro", "topknot", "buzz"];
const HATS: HatStyle[] = ["none", "none", "none", "cap", "beanie", "bandana", "bucket", "beret", "headphones", "snapback", "hood", "cowboy"];
const OUTFITS = [...PALETTE, "#ff9a3d", "#b0641c", "#2d6b24", "#7a2bd6", "#1c6bd6"];

export const lookKey = (l: Look): string => {
  const f = l.face!;
  return [l.kind, l.color, l.accent, l.hat, l.hair, f.eyes, f.brows, f.mouth, f.nose, f.facial, f.extra, f.head].join("|");
};

export function randomFace(rng: Rng, kind: BodyKind): Face {
  return {
    eyes: rng.chance(0.18) ? "shades" : rng.pick(EYES),
    brows: rng.pick(BROWS), mouth: rng.pick(MOUTHS), nose: rng.pick(NOSES),
    facial: kind === "guy" ? rng.pick(FACIAL) : "none",
    extra: rng.pick(EXTRAS), head: rng.pick(HEADS),
  };
}

export function uniqueLook(rng: Rng, kind: BodyKind, background: boolean, used: Set<string>, forced: Partial<Look> = {}): Look {
  for (let i = 0; i < 60; i++) {
    let color = rng.pick(PALETTE), accent = rng.pick(OUTFITS);
    if (accent === color) accent = OUTFITS[(OUTFITS.indexOf(color) + 3) % OUTFITS.length];
    const l: Look = {
      kind, color, accent,
      hat: rng.pick(HATS), hair: kind === "guy" ? rng.pick(HAIR_GUY) : rng.pick(HAIR_GIRL),
      scale: background ? rng.range(0.74, 0.88) : rng.range(0.88, 1.06),
      build: rng.range(0.85, 1.2),
      face: randomFace(rng, kind),
      ...forced,
    };
    const k = lookKey(l);
    if (!used.has(k)) { used.add(k); return l; }
  }
  // practically unreachable; fall back to a guaranteed-unique tweak
  const l = { kind, color: rng.pick(PALETTE), accent: rng.pick(OUTFITS), hat: "none" as HatStyle, hair: "none" as HairStyle, scale: 1, build: 1, face: randomFace(rng, kind), ...forced };
  used.add(lookKey(l) + used.size);
  return l;
}

/** The Mosaics never take their sunglasses off (same as the footer crew). */
export const MOSAIC_FACE = (mouth: Face["mouth"] = "smile", extra: Face["extra"] = "none"): Face => ({ eyes: "shades", brows: "none", mouth, nose: "none", facial: "none", extra, head: "round" });
