import type { Character, Face, HairStyle, HatStyle, Look } from "../entities/types";

/**
 * CHARACTER MODELS: 25 chunky street archetypes in the spirit of a gritty beat-'em-up cover
 * (thick ink outlines, wrist wraps, singlets, stubble, wild hair, fun-but-scary). A model is
 * cosmetic and derived from the character id (no RNG drawn, nothing saved), so the sim is untouched.
 * It re-skins the stick skeleton: filled torso, chunky limbs, shoes, props. Only mid-tier people get
 * one; the Mosaics, the player, named mission characters and uniformed jobs keep their own look.
 */
export type TopStyle = "tank" | "tee" | "long" | "hoodie" | "coat" | "vest" | "bare" | "poncho" | "dress" | "suit" | "jersey" | "apron" | "hawaiian";
export type BottomStyle = "jeans" | "shorts" | "ripped" | "trackies" | "skirt" | "kilt" | "slacks" | "boardies";
export type ShoeStyle = "boots" | "sneakers" | "bare" | "jandals" | "heels" | "workboots" | "sandals";
export type Prop = "bottle" | "can" | "cig" | "sign" | "cane" | "bag" | "crutch" | "camera" | "cup";
export type Gear = "wraps" | "backpack" | "chain" | "eyepatch" | "bandage" | "scarf" | "toolbelt" | "lanyard" | "tie" | "sash" | "headband" | "medals" | "tattoo" | "studs" | "blanket" | "cone";

export interface ModelSpec {
  id: string;
  label: string;
  kind: "guy" | "girl" | "any";
  skin: string;
  top: TopStyle; topColor: string; trim: string;
  bottom: BottomStyle; bottomColor: string;
  shoes: ShoeStyle; shoeColor: string;
  /** torso half-width at the shoulders (px at k=1) and extra belly bulge */
  sw: number; belly: number;
  /** limb thickness multiplier */
  limb: number;
  hair: HairStyle; hairColor: string; hat: HatStyle; hatColor?: string;
  face: Partial<Face>;
  prop?: Prop; gear: Gear[];
}

const INK = "#150f0d";
const SK = { fair: "#f1c9a5", tan: "#d9a173", olive: "#c78d5f", brown: "#a06a43", dark: "#6e452b", pale: "#efe3d6", ruddy: "#dd9a7c" };

const M = (id: string, label: string, kind: ModelSpec["kind"], skin: string, top: TopStyle, topColor: string, bottom: BottomStyle, bottomColor: string, shoes: ShoeStyle, shoeColor: string, sw: number, belly: number, limb: number, hair: HairStyle, hairColor: string, hat: HatStyle, face: Partial<Face>, gear: Gear[], prop?: Prop, trim = "#f2ead8", hatColor?: string): ModelSpec =>
  ({ id, label, kind, skin, top, topColor, trim, bottom, bottomColor, shoes, shoeColor, sw, belly, limb, hair, hairColor, hat, hatColor, face, prop, gear });

export const MODELS: readonly ModelSpec[] = [
  M("wrap-brawler", "Wrap Brawler", "guy", SK.fair, "tank", "#d9553f", "trackies", "#9fb4c8", "sneakers", "#e8e0cf", 10.5, 1, 1.25, "sidepart", "#c9c9c9", "none", { eyes: "dots", brows: "angry", mouth: "teeth", nose: "line", facial: "mustache", extra: "none", head: "wide" }, ["wraps"]),
  M("singlet-slugger", "Singlet Slugger", "guy", SK.ruddy, "tank", "#efe6d2", "ripped", "#d96a3a", "bare", "#000", 10, 2, 1.2, "spiky", "#3a2a22", "none", { eyes: "dots", brows: "angry", mouth: "grin", nose: "hook", facial: "beard", extra: "scar", head: "wide" }, ["wraps"]),
  M("pub-regular", "Pub Regular", "guy", SK.fair, "long", "#a33b2f", "jeans", "#3b4f73", "jandals", "#2b7bd6", 9, 3.5, 1.1, "buzz", "#6b5a45", "none", { eyes: "sleepy", brows: "worried", mouth: "smirk", nose: "dot", facial: "stubble", extra: "none", head: "round" }, [], "bottle"),
  M("can-collector", "Can Collector", "guy", SK.tan, "vest", "#f08a1c", "jeans", "#55657a", "workboots", "#3a2a1e", 8.5, 0, 1.05, "none", "#000", "cap", { eyes: "round", brows: "straight", mouth: "flat", nose: "dot", facial: "stubble", extra: "none", head: "round" }, ["backpack"], "bag", "#e8f2f0"),
  M("trolley-nomad", "Trolley Nomad", "any", SK.olive, "coat", "#5b4a3a", "slacks", "#3d3f4a", "boots", "#2a2018", 9.5, 1, 1.1, "curly", "#8a8a8a", "beanie", { eyes: "dots", brows: "worried", mouth: "frown", nose: "hook", facial: "none", extra: "none", head: "oval" }, ["scarf"], "bag", "#d1c6a8", "#47806b"),
  M("park-bench-sage", "Park Bench Sage", "guy", SK.pale, "coat", "#4c5848", "slacks", "#2f343c", "boots", "#241b14", 9, 2, 1.05, "long", "#d8d8d8", "bucket", { eyes: "sleepy", brows: "thick", mouth: "flat", nose: "hook", facial: "beard", extra: "none", head: "wide" }, ["blanket"], "cup", "#c9bd96", "#8c7a4a"),
  M("sign-holder", "Sign Holder", "any", SK.tan, "hoodie", "#6a6f78", "jeans", "#34425d", "sneakers", "#c9c4b8", 9, 0.5, 1.05, "buzz", "#2a1f1a", "none", { eyes: "dots", brows: "worried", mouth: "frown", nose: "dot", facial: "stubble", extra: "none", head: "round" }, [], "sign"),
  M("hoodie-kid", "Hoodie Kid", "any", SK.brown, "hoodie", "#3a3a52", "trackies", "#1f2330", "sneakers", "#e8e0cf", 8, 0, 0.95, "none", "#000", "hood", { eyes: "wide", brows: "raised", mouth: "smirk", nose: "dot", facial: "none", extra: "none", head: "round" }, ["headband"]),
  M("skate-punk", "Skate Punk", "any", SK.fair, "jersey", "#161418", "ripped", "#2a3350", "sneakers", "#d9382c", 8.5, 0, 1, "mohawk", "#3dd6ff", "none", { eyes: "wink", brows: "angry", mouth: "tongue", nose: "dot", facial: "none", extra: "nosering", head: "round" }, ["studs"], undefined, "#d9382c"),
  M("gym-bro", "Gym Bro", "guy", SK.tan, "tank", "#2f9e5b", "shorts", "#1c1f28", "sneakers", "#efefef", 12.5, 0, 1.3, "buzz", "#3a2a22", "snapback", { eyes: "dots", brows: "thick", mouth: "grin", nose: "line", facial: "stubble", extra: "none", head: "wide" }, ["chain"], undefined, "#efefef", "#2f9e5b"),
  M("surfie", "Surfie", "guy", SK.tan, "bare", "#d9a173", "boardies", "#19b3c4", "jandals", "#f0c21c", 9.5, 0, 1.1, "long", "#e8cf7a", "none", { eyes: "happy", brows: "none", mouth: "grin", nose: "dot", facial: "stubble", extra: "freckles", head: "round" }, ["chain"]),
  M("tradie", "Tradie", "guy", SK.ruddy, "vest", "#f08a1c", "jeans", "#3a4256", "workboots", "#5a3d22", 10.5, 2, 1.2, "none", "#000", "cap", { eyes: "dots", brows: "thick", mouth: "flat", nose: "line", facial: "stubble", extra: "none", head: "wide" }, ["toolbelt"], undefined, "#e8f2f0", "#3a4256"),
  M("op-shop-queen", "Op-Shop Queen", "girl", SK.dark, "dress", "#b0398e", "skirt", "#b0398e", "heels", "#f0c21c", 8, 0, 0.95, "afro", "#1a1210", "none", { eyes: "cateye", brows: "raised", mouth: "grin", nose: "dot", facial: "none", extra: "earrings", head: "round" }, ["chain"], "cup"),
  M("tartan-nan", "Tartan Nan", "girl", SK.pale, "long", "#7d6aa8", "skirt", "#4a6a4a", "boots", "#3b2c20", 9, 2.5, 1, "bun", "#e0e0e0", "none", { eyes: "round", brows: "worried", mouth: "smile", nose: "hook", facial: "none", extra: "mole", head: "round" }, ["scarf"], "bag", "#d9c9a0"),
  M("office-drone", "Office Drone", "any", SK.fair, "suit", "#2a3040", "slacks", "#2a3040", "boots", "#17120f", 9, 1, 1, "sidepart", "#4a382a", "none", { eyes: "round", brows: "straight", mouth: "flat", nose: "line", facial: "none", extra: "none", head: "oval" }, ["tie", "lanyard"], "cup", "#d9382c"),
  M("rugby-prop", "Rugby Prop", "guy", SK.ruddy, "jersey", "#16161c", "shorts", "#16161c", "boots", "#0e0b0a", 13, 2.5, 1.35, "buzz", "#5a4636", "none", { eyes: "dots", brows: "angry", mouth: "teeth", nose: "hook", facial: "none", extra: "scar", head: "wide" }, ["wraps"], undefined, "#efefef"),
  M("goth-student", "Goth Student", "any", SK.pale, "coat", "#14121a", "slacks", "#14121a", "boots", "#14121a", 8, 0, 0.95, "bob", "#14121a", "none", { eyes: "cateye", brows: "worried", mouth: "flat", nose: "dot", facial: "none", extra: "none", head: "oval" }, ["studs", "chain"], undefined, "#7a2bd6"),
  M("busker", "Busker", "any", SK.olive, "long", "#c9892a", "jeans", "#463a52", "sandals", "#6b4a2a", 8.5, 0.5, 1, "braids", "#2a1c14", "beret", { eyes: "happy", brows: "raised", mouth: "smile", nose: "dot", facial: "goatee", extra: "none", head: "round" }, ["scarf"], "cup", "#e8e0cf", "#b0398e"),
  M("smoko-chef", "Smoko Chef", "guy", SK.fair, "apron", "#efe6d2", "trackies", "#2a2f3a", "sneakers", "#f2f2f2", 10.5, 3, 1.15, "none", "#000", "bandana", { eyes: "sleepy", brows: "straight", mouth: "flat", nose: "line", facial: "mustache", extra: "none", head: "wide" }, [], "cig", "#d9d2bf", "#d9382c"),
  M("hens-night", "Hens Night", "girl", SK.tan, "dress", "#ff6fb5", "skirt", "#ff6fb5", "heels", "#efefef", 7.5, 0, 0.9, "pony", "#c9892a", "none", { eyes: "wink", brows: "raised", mouth: "tongue", nose: "dot", facial: "none", extra: "blush", head: "round" }, ["sash", "headband"], "can", "#f2ead8"),
  M("bogan-legend", "Bogan Legend", "guy", SK.ruddy, "tank", "#1a1a1e", "ripped", "#2c4a8a", "boots", "#17120f", 10, 2, 1.15, "long", "#6a4a2a", "cap", { eyes: "dots", brows: "thick", mouth: "smirk", nose: "line", facial: "mustache", extra: "tattoo", head: "wide" }, ["tattoo", "chain"], "can", "#f2ead8", "#d9382c"),
  M("old-digger", "Old Digger", "guy", SK.pale, "coat", "#4a5a3a", "slacks", "#3a3a30", "boots", "#17120f", 9, 1, 1, "buzz", "#e8e8e8", "beret", { eyes: "sleepy", brows: "thick", mouth: "flat", nose: "hook", facial: "mustache", extra: "none", head: "oval" }, ["medals"], "cane", "#d9c24a", "#5a1c24"),
  M("flower-hippie", "Flower Hippie", "any", SK.olive, "poncho", "#d9a12a", "slacks", "#6a8a4a", "bare", "#000", 9, 0.5, 1, "braids", "#6a4a2a", "none", { eyes: "round", brows: "raised", mouth: "smile", nose: "dot", facial: "none", extra: "freckles", head: "round" }, ["headband"], undefined, "#e8554f"),
  M("battered-scrapper", "Battered Scrapper", "guy", SK.fair, "tee", "#8aa0b4", "trackies", "#4a4f5a", "sneakers", "#c9c4b8", 10, 1, 1.2, "spiky", "#2a2018", "none", { eyes: "wide", brows: "worried", mouth: "o", nose: "hook", facial: "stubble", extra: "scar", head: "wide" }, ["bandage", "eyepatch"], "crutch", "#f2ead8"),
  M("holiday-tourist", "Holiday Tourist", "any", SK.pale, "hawaiian", "#19b3a8", "shorts", "#d9c9a0", "sandals", "#6b4a2a", 9.5, 2.5, 1.1, "sidepart", "#8a6a3a", "bucket", { eyes: "aviator", brows: "none", mouth: "grin", nose: "dot", facial: "none", extra: "blush", head: "round" }, [], "camera", "#ff6a4a", "#efe6d2"),
];

// ---------------------------------------------------------------- assignment

const hashId = (id: number): number => { let h = Math.imul(id + 1, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return h >>> 0; };
const CACHE = new WeakMap<Character, ModelSpec | null>();

/** The model this person wears, or undefined for the Mosaics, the player, named characters and uniformed jobs. */
export function modelOf(c: Character): ModelSpec | undefined {
  let m = CACHE.get(c);
  if (m === undefined) {
    m = null;
    const L = c.look;
    const eligible = (c.tier === "mid" || (c.tier === "background" && c.promoted)) && !L.main && c.id !== -1;
    if (eligible && !L.glam) {
      const h = hashId(c.id);
      const pool = MODELS.filter((x) => x.kind === "any" || x.kind === L.kind);
      m = pool[h % pool.length];
    }
    CACHE.set(c, m);
  }
  return m ?? undefined;
}

/** Pin a character to a model (or null for none): tests and the catalogue. */
export function setModel(c: Character, m: ModelSpec | null): void { CACHE.set(c, m); }

/** Look re-skinned for the head pass: hair colour in `color`, the model's face over their own. */
export function modelLook(L: Look, M_: ModelSpec): Look {
  return { ...L, color: M_.hairColor, accent: M_.hatColor ?? M_.trim, hat: M_.hat, hair: M_.hair, face: { ...(L.face ?? { eyes: "dots", brows: "none", mouth: "smile", nose: "none", facial: "none", extra: "none", head: "round" }), ...M_.face } };
}
export const MODEL_INK = INK;

// ---------------------------------------------------------------- drawing

type Ctx = CanvasRenderingContext2D;
const P = (g: Ctx, pts: number[]) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };

/**
 * Draw the body of a model over the solved skeleton J (hip 0, neck 2, head 4, shoulder 6, armL 8/10,
 * armR 12/14, legL 16/18, legR 20/22). `hd` adds thick ink outlines, folds and gear; the cheap pass
 * is filled shapes only.
 */
export function drawModelBody(g: Ctx, J: Float32Array, _c: Character, M_: ModelSpec, k: number, dir: number, alpha: number, hd: boolean, flash: boolean): void {
  const top = flash ? "#ffffff" : M_.topColor, bot = flash ? "#ffffff" : M_.bottomColor, skin = flash ? "#ffffff" : M_.skin;
  const lb = Math.max(1.4, 4.2 * k * M_.limb);
  const ink = (w: number) => { g.strokeStyle = INK; g.lineWidth = w; };
  const limb = (a: number, b: number, cc: number, col: string, w: number) => {
    if (hd) { g.strokeStyle = INK; g.lineWidth = w + 2.6 * k; g.beginPath(); g.moveTo(J[a], J[a + 1]); g.lineTo(J[b], J[b + 1]); if (cc >= 0) g.lineTo(J[cc], J[cc + 1]); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(J[a], J[a + 1]); g.lineTo(J[b], J[b + 1]); if (cc >= 0) g.lineTo(J[cc], J[cc + 1]); g.stroke();
  };
  g.globalAlpha = alpha; g.lineCap = "round"; g.lineJoin = "round";
  const hx = J[0], hy = J[1], sx = J[6], sy = J[7];
  const ux = sx - hx, uy = sy - hy, len = Math.hypot(ux, uy) || 1, px = -uy / len, py = ux / len; // perpendicular to the spine
  const sw = M_.sw * 1.22 * k, hw = (M_.sw * 0.95 + M_.belly * 0.6) * k, bl = M_.belly * k;

  // ---- back props
  if (M_.gear.includes("backpack")) { g.fillStyle = "#4a5a3a"; P(g, [hx + px * sw - ux * 0.05 - dir * 6 * k, hy + py * sw, sx + px * sw - dir * 7 * k, sy + py * sw, sx - px * sw - dir * 7 * k, sy - py * sw, hx - px * sw - dir * 6 * k, hy - py * sw]); g.fill(); if (hd) { ink(1.4 * k); g.stroke(); } }
  if (M_.gear.includes("blanket")) { g.fillStyle = "#8c4a3a"; P(g, [sx + px * sw * 1.25, sy + py * sw * 1.25, sx - px * sw * 1.25, sy - py * sw * 1.25, hx - px * sw * 1.5 - ux * 0.25, hy - py * sw * 1.5 - uy * 0.25, hx + px * sw * 1.5 - ux * 0.25, hy + py * sw * 1.5 - uy * 0.25]); g.fill(); if (hd) { ink(1.4 * k); g.stroke(); } }

  // ---- legs: pants, bare skin, shoes
  const legW = lb * 1.15;
  const shorty = M_.bottom === "shorts" || M_.bottom === "ripped" || M_.bottom === "boardies";
  const skirty = M_.bottom === "skirt" || M_.bottom === "kilt" || M_.top === "dress";
  for (const [kn, ft] of [[16, 18], [20, 22]] as const) {
    if (shorty || skirty) {
      limb(kn, ft, -1, skin, legW * 0.85);
      const cut = skirty ? 0.35 : 0.9;
      const mx = hx + (J[kn] - hx) * cut, my = hy + (J[kn + 1] - hy) * cut;
      if (!skirty) limb(0, kn, -1, bot, legW * (M_.bottom === "boardies" ? 1.45 : 1.3));
      if (!skirty) { g.strokeStyle = bot; g.lineWidth = legW * 1.3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(mx, my); g.stroke(); }
    } else limb(0, kn, ft, bot, legW);
  }
  // shoes
  const sh = flash ? "#ffffff" : M_.shoeColor;
  for (const f of [18, 22]) {
    const fx = J[f], fy = J[f + 1];
    if (M_.shoes === "bare") { g.fillStyle = skin; g.beginPath(); g.ellipse(fx + 2 * k * dir, fy, 4.5 * k, 2.2 * k, 0, 0, 6.283); g.fill(); if (hd) { ink(1.2 * k); g.stroke(); } continue; }
    if (M_.shoes === "heels") { g.strokeStyle = sh; g.lineWidth = lb * 0.9; g.beginPath(); g.moveTo(fx - 1 * k * dir, fy); g.lineTo(fx + 5 * k * dir, fy); g.stroke(); continue; }
    if (M_.shoes === "jandals" || M_.shoes === "sandals") { g.fillStyle = skin; g.beginPath(); g.ellipse(fx + 2 * k * dir, fy, 4.4 * k, 1.9 * k, 0, 0, 6.283); g.fill(); g.strokeStyle = sh; g.lineWidth = Math.max(1, 1.5 * k); g.beginPath(); g.moveTo(fx + 1 * k * dir, fy - 1 * k); g.lineTo(fx + 4 * k * dir, fy + 0.5 * k); g.stroke(); continue; }
    const big = M_.shoes === "boots" || M_.shoes === "workboots";
    g.fillStyle = sh; g.beginPath(); g.ellipse(fx + 2.5 * k * dir, fy - 0.5 * k, (big ? 6.2 : 5.6) * k, (big ? 3.4 : 2.9) * k, 0, 0, 6.283); g.fill();
    if (hd) { ink(1.3 * k); g.stroke(); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(fx - 3.4 * k, fy + 1.4 * k, 11.6 * k, 0.9 * k); }
  }

  // ---- back arm (L), torso, front arm (R)
  const sleeve = M_.top === "tank" || M_.top === "bare" || M_.top === "dress" || M_.top === "vest" || M_.top === "apron" ? 0 : M_.top === "tee" || M_.top === "hawaiian" || M_.top === "jersey" ? 1 : 2;
  const arm = (e: number, h: number) => {
    limb(6, e, h, skin, lb);
    if (sleeve === 2) limb(6, e, h, top, lb * 1.15);
    else if (sleeve === 1) { const mx = J[6] + (J[e] - J[6]) * 0.85, my = J[7] + (J[e + 1] - J[7]) * 0.85; g.strokeStyle = top; g.lineWidth = lb * 1.25; g.beginPath(); g.moveTo(J[6], J[7]); g.lineTo(mx, my); g.stroke(); }
    // fist / hand
    const r = lb * (M_.gear.includes("wraps") ? 0.95 : 0.78);
    g.fillStyle = skin; g.beginPath(); g.arc(J[h], J[h + 1], r, 0, 6.283); g.fill(); if (hd) { ink(1.3 * k); g.stroke(); }
    if (M_.gear.includes("wraps")) { // the white hand wraps
      g.strokeStyle = "#f2ead8"; g.lineWidth = lb * 1.35; g.beginPath(); const bx = J[e] + (J[h] - J[e]) * 0.35, by = J[e + 1] + (J[h + 1] - J[e + 1]) * 0.35; g.moveTo(bx, by); g.lineTo(J[h] + (J[e] - J[h]) * 0.1, J[h + 1] + (J[e + 1] - J[h + 1]) * 0.1); g.stroke();
      if (hd) { g.strokeStyle = INK; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(bx - 1.6 * k, by); g.lineTo(bx + 1.6 * k, by + 1.2 * k); g.stroke(); }
    }
    if (M_.gear.includes("tattoo") && hd) { g.strokeStyle = "#2a6a8a"; g.lineWidth = 1.1 * k; g.beginPath(); g.moveTo(J[6] + (J[e] - J[6]) * 0.2, J[7] + (J[e + 1] - J[7]) * 0.2); g.lineTo(J[e], J[e + 1]); g.stroke(); }
  };
  arm(8, 10);

  // torso silhouette: shoulders wide, hips a little narrower, belly bulging out front
  const nx = J[2], ny = J[3];
    const fx = dir * (bl); // belly pokes toward the facing side
  const pts = [sx + px * sw, sy + py * sw, sx - px * sw, sy - py * sw, hx - px * hw + fx * 0.3, hy - py * hw, hx - px * hw * 1.05 + fx, hy - py * hw * 1.05 + 5 * k, hx + px * hw * 1.05 + fx, hy + py * hw * 1.05 + 5 * k, hx + px * hw + fx * 0.3, hy + py * hw];
  if (M_.top === "dress" || M_.top === "poncho" || M_.top === "coat") { // long cuts flare to the thigh
    const flare = M_.top === "poncho" ? 1.5 : M_.top === "dress" ? 1.35 : 1.1, drop = M_.top === "coat" ? 15 : 10;
    pts[6] = hx - px * hw * flare; pts[8] = hx - px * hw * flare * 1.1; pts[9] = hy - py * hw * flare * 1.1 + drop * k; pts[10] = hx + px * hw * flare * 1.1; pts[11] = hy + py * hw * flare * 1.1 + drop * k;
  }
  // skin behind the bare/tank neckline
  if (M_.top === "tank" || M_.top === "bare" || M_.top === "vest") { g.fillStyle = skin; P(g, pts); g.fill(); }
  g.fillStyle = M_.top === "bare" ? skin : top;
  if (M_.top === "tank" || M_.top === "vest") { // straps and a scooped front only
    P(g, [sx + px * sw * 0.7, sy + py * sw * 0.7, sx + px * sw * 0.2 + ux * -0.1, sy + py * sw * 0.2 - 3 * k, sx - px * sw * 0.2, sy - py * sw * 0.2 - 3 * k, sx - px * sw * 0.7, sy - py * sw * 0.7, pts[4], pts[5], pts[6], pts[7], pts[8], pts[9], pts[10], pts[11]]); g.fill();
    g.fillStyle = skin; g.beginPath(); g.ellipse(sx - ux * 0.08, sy - uy * 0.08, sw * 0.32, sw * 0.28, Math.atan2(uy, ux), 0, 6.283); g.fill(); g.fillStyle = top;
  } else { P(g, pts); g.fill(); }
  if (hd) {
    g.strokeStyle = INK; g.lineWidth = 2 * k; P(g, pts); g.stroke();
    // shading down the back side, a hem line, and a collar
    g.fillStyle = "rgba(0,0,0,.22)"; P(g, [sx - px * sw, sy - py * sw, sx - px * sw * 0.35, sy - py * sw * 0.35, hx - px * hw * 0.35 + fx * 0.3, hy - py * hw * 0.35, hx - px * hw + fx * 0.3, hy - py * hw]); g.fill();
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(hx - px * hw + fx * 0.3, hy - py * hw + 3 * k); g.lineTo(hx + px * hw + fx * 0.3, hy + py * hw + 3 * k); g.stroke();
    if (M_.top === "bare" || M_.top === "tank") { g.strokeStyle = "rgba(90,40,30,.55)"; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(sx - ux * 0.25 + px * 2 * k, sy - uy * 0.25 + py * 2 * k); g.lineTo(sx - ux * 0.25 + px * 4.5 * k, sy - uy * 0.25 + py * 4.5 * k); g.moveTo(sx - ux * 0.25 - px * 2 * k, sy - uy * 0.25 - py * 2 * k); g.lineTo(sx - ux * 0.25 - px * 4.5 * k, sy - uy * 0.25 - py * 4.5 * k); g.stroke(); } // chest lines
  }
  // top-specific details
  const mid = (t: number, w: number): [number, number] => [hx + ux * t + px * w * sw, hy + uy * t + py * w * sw];
  switch (M_.top) {
    case "vest": { g.strokeStyle = M_.trim; g.lineWidth = Math.max(0.9, 1.8 * k); for (const t of [0.35, 0.6]) { const a = mid(t, 0.75), b = mid(t, -0.75); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } break; }
    case "suit": { g.strokeStyle = "#e8e0cf"; g.lineWidth = Math.max(0.9, 1.6 * k); const a = mid(0.97, 0.18), b = mid(0.45, 0), c2 = mid(0.97, -0.18); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.stroke(); break; }
    case "hoodie": { g.strokeStyle = top; g.lineWidth = lb * 1.4; g.beginPath(); g.arc(nx, ny, 4 * k, 0, 6.283); g.stroke(); if (hd) { g.strokeStyle = M_.trim; g.lineWidth = 0.9 * k; const a = mid(0.55, 0.12), b = mid(0.7, 0.12); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } break; }
    case "coat": { if (hd) { g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 1.2 * k; const a = mid(0.97, 0), b = mid(0.02, 0); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1] + 9 * k); g.stroke(); g.fillStyle = M_.trim; for (let t = 0.3; t < 0.8; t += 0.22) { const q = mid(t, 0.1); g.beginPath(); g.arc(q[0], q[1], 0.9 * k, 0, 6.283); g.fill(); } } break; }
    case "hawaiian": { if (hd) { g.fillStyle = "#ff6a4a"; for (let i = 0; i < 6; i++) { const q = mid(0.15 + (i % 3) * 0.28, ((i < 3 ? -0.5 : 0.45) + (i % 2) * 0.1)); g.beginPath(); g.arc(q[0], q[1], 1.5 * k, 0, 6.283); g.fill(); } } break; }
    case "jersey": { g.strokeStyle = M_.trim; g.lineWidth = Math.max(1, 2.2 * k); g.beginPath(); const a = mid(0.55, 1), b = mid(0.55, -1); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); break; }
    case "apron": { g.fillStyle = M_.trim; g.globalAlpha = alpha * 0.9; const a = mid(0.82, 0.55), b = mid(0.82, -0.55), c2 = mid(0, -0.9), d = mid(0, 0.9); P(g, [a[0], a[1], b[0], b[1], c2[0], c2[1] + 6 * k, d[0], d[1] + 6 * k]); g.fill(); g.globalAlpha = alpha; break; }
    case "poncho": { if (hd) { g.strokeStyle = M_.trim; g.lineWidth = 1.2 * k; for (let i = -2; i <= 2; i++) { const a = mid(0.9, i * 0.38), b = mid(0.05, i * 0.5); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1] + 8 * k); g.stroke(); } } break; }
    default:
  }
  // bottoms' hem and rips
  if (M_.bottom === "ripped" && hd) { g.fillStyle = skin; for (const kn of [16, 20]) { const mx = hx + (J[kn] - hx) * 0.9, my = hy + (J[kn + 1] - hy) * 0.9; g.beginPath(); g.moveTo(mx - 2.4 * k, my - 0.5 * k); g.lineTo(mx - 0.8 * k, my + 2.6 * k); g.lineTo(mx + 0.6 * k, my - 0.4 * k); g.lineTo(mx + 1.8 * k, my + 2.2 * k); g.lineTo(mx + 3 * k, my - 0.4 * k); g.fill(); } }
  if (M_.bottom === "kilt" || M_.bottom === "skirt") { g.fillStyle = bot; P(g, [hx - px * hw * 1.05, hy - py * hw * 1.05, hx + px * hw * 1.05, hy + py * hw * 1.05, hx + px * hw * 1.5, hy + py * hw * 1.5 + 11 * k, hx - px * hw * 1.5, hy - py * hw * 1.5 + 11 * k]); g.fill(); if (hd) { ink(1.6 * k); g.stroke(); } }
  arm(12, 14);
  // belt
  if (hd && M_.top !== "dress") { g.strokeStyle = "#1a1210"; g.lineWidth = 1.7 * k; g.beginPath(); g.moveTo(hx - px * hw, hy - py * hw); g.lineTo(hx + px * hw, hy + py * hw); g.stroke(); }

  // ---- gear on the body
  const G = M_.gear;
  if (G.includes("toolbelt")) { g.strokeStyle = "#5a3d22"; g.lineWidth = 2.6 * k; g.beginPath(); g.moveTo(hx - px * hw, hy - py * hw); g.lineTo(hx + px * hw, hy + py * hw); g.stroke(); g.fillStyle = "#8a8a8a"; g.fillRect(hx + px * hw * 0.5 - 1.5 * k, hy + py * hw * 0.5, 3 * k, 6 * k); }
  if (G.includes("chain")) { g.strokeStyle = "#f6c21c"; g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(nx - 4 * k, ny + 2 * k); g.quadraticCurveTo(nx, ny + 9 * k, nx + 4 * k, ny + 2 * k); g.stroke(); }
  if (G.includes("tie")) { g.fillStyle = M_.trim; P(g, [nx - 1.2 * k, ny + 3 * k, nx + 1.2 * k, ny + 3 * k, nx + 1.8 * k, ny + 13 * k, nx, ny + 15 * k, nx - 1.8 * k, ny + 13 * k]); g.fill(); }
  if (G.includes("lanyard")) { g.strokeStyle = "#2b7bd6"; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(nx - 3 * k, ny + 1 * k); g.lineTo(nx, ny + 11 * k); g.lineTo(nx + 3 * k, ny + 1 * k); g.stroke(); g.fillStyle = "#efefef"; g.fillRect(nx - 2 * k, ny + 11 * k, 4 * k, 3 * k); }
  if (G.includes("scarf")) { g.strokeStyle = M_.trim; g.lineWidth = lb * 1.35; g.beginPath(); g.moveTo(nx - 4 * k, ny + 1 * k); g.lineTo(nx + 4 * k, ny + 1 * k); g.stroke(); if (hd) { g.lineWidth = lb * 0.9; g.beginPath(); g.moveTo(nx - 2 * k * dir, ny + 2 * k); g.lineTo(nx - 3 * k * dir, ny + 11 * k); g.stroke(); } }
  if (G.includes("sash")) { g.strokeStyle = M_.trim; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(sx + px * sw * 0.8, sy + py * sw * 0.8); g.lineTo(hx - px * hw * 0.7, hy - py * hw * 0.7); g.stroke(); }
  if (G.includes("medals") && hd) { g.fillStyle = "#e0b43a"; for (let i = 0; i < 3; i++) { const q = mid(0.7 - i * 0.04, 0.35 - i * 0.14); g.beginPath(); g.arc(q[0], q[1], 1.4 * k, 0, 6.283); g.fill(); } }
  if (G.includes("studs") && hd) { g.fillStyle = "#d8dce4"; for (let i = 0; i < 5; i++) { const q = mid(0.93, 0.8 - i * 0.4); g.beginPath(); g.arc(q[0], q[1], 0.9 * k, 0, 6.283); g.fill(); } }

  // ---- held prop in the back hand (the front hand stays free for whatever the sim puts there)
  const hxL = J[10], hyL = J[11];
  switch (M_.prop) {
    case "bottle": g.fillStyle = "#7a4a1c"; g.fillRect(hxL - 1.6 * k, hyL - 9 * k, 3.2 * k, 9 * k); g.fillRect(hxL - 0.7 * k, hyL - 13 * k, 1.4 * k, 4 * k); if (hd) { g.fillStyle = "#e8d9a8"; g.fillRect(hxL - 1.6 * k, hyL - 6 * k, 3.2 * k, 2.4 * k); } break;
    case "can": g.fillStyle = "#c9c9d1"; g.fillRect(hxL - 2 * k, hyL - 7 * k, 4 * k, 7 * k); g.fillStyle = "#d9382c"; g.fillRect(hxL - 2 * k, hyL - 5.2 * k, 4 * k, 2.4 * k); break;
    case "cig": g.strokeStyle = "#efe6d2"; g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(hxL, hyL - 1 * k); g.lineTo(hxL + 4 * k * dir, hyL - 4 * k); g.stroke(); g.fillStyle = "#ff7a2a"; g.fillRect(hxL + 4 * k * dir - 0.6 * k, hyL - 4.8 * k, 1.2 * k, 1.2 * k); break;
    case "sign": g.fillStyle = "#c9a56a"; g.fillRect(hxL - 8 * k, hyL - 22 * k, 16 * k, 12 * k); g.strokeStyle = INK; g.lineWidth = 1.2 * k; g.strokeRect(hxL - 8 * k, hyL - 22 * k, 16 * k, 12 * k); g.beginPath(); g.moveTo(hxL - 5 * k, hyL - 18 * k); g.lineTo(hxL + 5 * k, hyL - 18 * k); g.moveTo(hxL - 5 * k, hyL - 14.5 * k); g.lineTo(hxL + 2 * k, hyL - 14.5 * k); g.stroke(); g.beginPath(); g.moveTo(hxL, hyL - 10 * k); g.lineTo(hxL, hyL); g.stroke(); break;
    case "cane": g.strokeStyle = "#6b4a2a"; g.lineWidth = 1.8 * k; g.beginPath(); g.moveTo(hxL, hyL + 28 * k); g.lineTo(hxL, hyL - 2 * k); g.arc(hxL + 2 * k * dir, hyL - 2 * k, 2 * k, Math.PI, Math.PI * 1.9); g.stroke(); break;
    case "crutch": g.strokeStyle = "#a0a0a8"; g.lineWidth = 1.8 * k; g.beginPath(); g.moveTo(hxL - 2 * k * dir, hyL + 26 * k); g.lineTo(hxL, hyL - 2 * k); g.moveTo(hxL - 3 * k, hyL - 5 * k); g.lineTo(hxL + 3 * k, hyL - 5 * k); g.stroke(); break;
    case "bag": g.strokeStyle = "#cfd4e8"; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(hxL, hyL); g.lineTo(hxL - 3 * k, hyL + 7 * k); g.moveTo(hxL, hyL); g.lineTo(hxL + 3 * k, hyL + 7 * k); g.stroke(); g.fillStyle = M_.trim; P(g, [hxL - 6 * k, hyL + 7 * k, hxL + 6 * k, hyL + 7 * k, hxL + 5 * k, hyL + 17 * k, hxL - 5 * k, hyL + 17 * k]); g.fill(); if (hd) { ink(1.2 * k); g.stroke(); } break;
    case "camera": g.fillStyle = "#23262e"; g.fillRect(hxL - 4 * k, hyL - 5 * k, 8 * k, 5.5 * k); g.fillStyle = "#9fb4c8"; g.beginPath(); g.arc(hxL, hyL - 2.2 * k, 1.8 * k, 0, 6.283); g.fill(); break;
    case "cup": g.fillStyle = "#efe6d2"; P(g, [hxL - 2.4 * k, hyL - 6 * k, hxL + 2.4 * k, hyL - 6 * k, hxL + 1.7 * k, hyL, hxL - 1.7 * k, hyL]); g.fill(); g.fillStyle = "#6b4a2a"; g.fillRect(hxL - 2.4 * k, hyL - 6.8 * k, 4.8 * k, 1 * k); break;
    default:
  }
  g.globalAlpha = alpha;
}

/** Face-level gear (drawn after the head): eyepatch, bandage, headband, studs. */
export function drawModelHeadGear(g: Ctx, M_: ModelSpec, x: number, y: number, k: number, dir: number, hd: boolean): void {
  const r = 10.5 * k, G = M_.gear;
  if (G.includes("bandage")) { g.strokeStyle = "#f2ead8"; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(x - r * 0.98, y - r * 0.35); g.lineTo(x + r * 0.98, y - r * 0.55); g.stroke(); if (hd) { g.strokeStyle = "#d9382c"; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(x + 2 * k * dir, y - r * 0.5); g.lineTo(x + 3 * k * dir, y - r * 0.4); g.stroke(); } }
  if (G.includes("eyepatch")) { const ex = x + 2.2 * k * dir + 4 * k, ey = y - 0.2 * k; g.fillStyle = INK; g.beginPath(); g.ellipse(ex, ey, 3 * k, 2.4 * k, 0, 0, 6.283); g.fill(); g.strokeStyle = INK; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(ex - 3 * k, ey - 1 * k); g.lineTo(x - r, y - 3 * k); g.moveTo(ex + 3 * k, ey - 1 * k); g.lineTo(x + r, y - 3 * k); g.stroke(); }
  if (G.includes("headband")) { g.strokeStyle = M_.trim === "#f2ead8" ? "#e8554f" : M_.trim; g.lineWidth = 2.4 * k; g.beginPath(); g.moveTo(x - r * 0.98, y - r * 0.5); g.quadraticCurveTo(x, y - r * 0.8, x + r * 0.98, y - r * 0.5); g.stroke(); if (hd) { g.fillStyle = M_.trim; g.beginPath(); g.arc(x + r * 0.5 * dir, y - r * 0.72, 1.6 * k, 0, 6.283); g.fill(); } }
  if (G.includes("studs") && hd) { g.fillStyle = "#d8dce4"; g.beginPath(); g.arc(x - r * 1.0, y + 3 * k, 0.9 * k, 0, 6.283); g.arc(x - r * 1.0, y + 6 * k, 0.9 * k, 0, 6.283); g.fill(); }
}
