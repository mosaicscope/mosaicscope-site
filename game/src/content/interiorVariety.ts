/**
 * Per-building interiors. The tables in interiors.ts / interiorsShops.ts are one plan per KIND; this
 * file turns that plan into THIS building's room, so no two cafes (or banks, or flats) look or play
 * the same. Everything is seeded from the building id, so a place looks the same every visit.
 *
 *  - a decor theme (scandi, industrial, retro, neon, rustic, luxe, tropical, op-shop) tints floors,
 *    recolours furniture and can swap the lighting
 *  - extra dressing (plants, lamps, rugs, shelves, posters, clocks, windows) dropped only where it
 *    keeps every counter, seat and doorway reachable
 *  - the room's own sign, owner, posters and busyness
 *  - furniture that does something: beds, sofas, fridges, baths, arcade cabinets, gym kit, racks and
 *    a staff door where you can pick up a paid shift, all wired to the needs in interiorEffects.ts
 *
 * Pure data in, data out: DOM-free and Math.random-free, so tests can check every building.
 */
import { placeActions } from "./interiorActions";
import {buildingInterior} from './buildingInteriors';
import { Rng, hashString } from "../core/rng";
import { BUILDINGS, type BuildingKind } from "./buildings";
import { FIRST_GIRL, FIRST_GUY, SURNAMES } from "./names";
import { PROP_INFO, interiorFor, type Effect, type FloorMat, type InteriorDef, type LightTone, type Prop, type PropType } from "./interiors";
import { p } from "./interiorKit";
import { reachable, blockedAt, type Pt } from "./interiorNav";

export interface BuildingRef { id: number; kind: BuildingKind; name: string; usage?:string }

interface Theme { name: string; floors: FloorMat[]; floor: string; hue: number; sat: number; lit: number; light: LightTone | null; art: string[] }
const THEMES: Theme[] = [
  { name: "scandi", floors: ["wood"], floor: "#c9b291", hue: 0, sat: 0.55, lit: 1.15, light: "soft", art: ["Line drawing of a fern", "A print that just says 'hygge'", "Pale ceramic plates on a rail"] },
  { name: "industrial", floors: ["concrete"], floor: "#7d8085", hue: -15, sat: 0.6, lit: 0.85, light: "cool", art: ["Exposed ducting, painted black", "Blueprint of the old wool mill", "A neon arrow pointing at nothing"] },
  { name: "retro", floors: ["lino", "tile"], floor: "#d9c27a", hue: 25, sat: 1.25, lit: 1.0, light: "warm", art: ["1970s Lyttelton Harbour tourism poster", "A sunburst clock that runs fast", "Signed photo of a forgotten weatherman"] },
  { name: "neon", floors: ["rubber", "tile"], floor: "#2a2438", hue: 140, sat: 1.4, lit: 0.9, light: "neon", art: ["Pink neon that says 'yes'", "Glitch-art print of the Port Hills", "A cyan tube light hung crooked"] },
  { name: "rustic", floors: ["wood", "pavers"], floor: "#6a4a30", hue: 15, sat: 0.9, lit: 0.85, light: "warm", art: ["Old shearing comb in a frame", "Hand-painted 'est. 1987' board", "A hay-bale-coloured quilt on the wall"] },
  { name: "luxe", floors: ["marble"], floor: "#e6e0d6", hue: 40, sat: 0.8, lit: 1.05, light: "soft", art: ["Gold-framed oil of a racehorse", "Brass sconce with one moody bulb", "An abstract that cost more than your car"] },
  { name: "tropical", floors: ["tile", "pavers"], floor: "#b9d8c4", hue: 70, sat: 1.15, lit: 1.05, light: "warm", art: ["Palm-leaf wallpaper panel", "Postcard from Rarotonga", "A flamingo that has seen things"] },
  { name: "op-shop", floors: ["carpet", "lino"], floor: "#8a6a6a", hue: -30, sat: 0.85, lit: 0.95, light: "dim", art: ["Paint-by-numbers of a lighthouse", "A wonky cross-stitch: 'Home Sweet Ōtautahi'", "Mismatched frames, all of the same dog"] },
];
/** Places where the bones should stay institutional: tint only, no floor swaps or mood lighting. */
const STRICT: ReadonlySet<BuildingKind> = new Set(["hospital", "police", "mentalhealth", "bank"]);
const QUIRKS = [
  "who knows every regular by their order", "who is always on the phone to a supplier", "who laughs at their own jokes first",
  "who swears the plant in the corner is lucky", "who has strong opinions about the All Blacks' bench", "who keeps a jar of lollies for kids and adults alike",
  "who once nearly sold the place for a boat", "who learned the trade from their nan", "who runs a tight ship and a loose playlist", "who is quietly saving up for a second one",
];
const POSTERS = [
  "Garage sale Saturday, Bryndwr", "Lost: grey cat, answers to 'Toast'", "Kapa haka practice Tues 6pm", "Yoga in the Botanic Gardens", "Band wanted: must own van",
  "Flat for rent, no drama", "Sumner surf club quiz night", "Free firewood, you pick up", "Learn te reo: beginners welcome", "Lunar New Year market",
  "Photo walk with MosaicScope", "Blood drive, Thursday", "Pet rock adoption day", "Night noodle market", "Community garden working bee",
];

// ------------------------------------------------------------------ colour
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex); if (!m) return null;
  const s = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number): string => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export function mix(a: string, b: string, k: number): string {
  const A = hexToRgb(a), B = hexToRgb(b); if (!A || !B) return a;
  return toHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}
/** Rotate hue (degrees), scale saturation and lightness. */
export function shiftColor(hex: string, dh: number, ks: number, kl: number): string {
  const c = hexToRgb(hex); if (!c) return hex;
  const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  h = (((h + dh) % 360) + 360) % 360; s = Math.min(1, s * ks); const L = Math.min(0.95, Math.max(0.05, l * kl));
  const q = L < 0.5 ? L * (1 + s) : L + s - L * s, P = 2 * L - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? P + (q - P) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? P + (q - P) * (2 / 3 - t) * 6 : P; };
  return toHex(f(h / 360 + 1 / 3) * 255, f(h / 360) * 255, f(h / 360 - 1 / 3) * 255);
}
const RECOLOUR: ReadonlySet<PropType> = new Set(["chair", "sofa", "table", "rug", "mat", "cabinet", "shelf", "counter", "desk", "bench", "curtain", "bed", "lamp", "stanchion", "trolley", "rack"]);

// ------------------------------------------------------------------ furniture that does something
interface Wire { effect: Effect; label: string; text: string; cost?: number }
/** What a prop is good for, by label keyword first, then by type. Null = it's just furniture. */
function wireFor(q: Prop, kind: BuildingKind): Wire | null {
  const L = (q.label ?? "").toLowerCase(), home = kind === "house" || kind === "apartments" || kind === "hotel";
  if (/arcade|pinball|claw|pokie|pool table|foosball|dartboard|console/.test(L)) return { effect: "play", label: q.label!, text: "You feed it a coin and lose yourself for a minute. Worth it.", cost: home ? 0 : 2 };
  if (/jukebox|turntable|piano|listening/.test(L)) return { effect: "music", label: q.label!, text: "You pick a track. Three people nod along without looking up.", cost: home ? 0 : 1 };
  if (/treadmill|bench press|rack|weights|bike|rower|bag/.test(L) && (kind === "gym" || kind === "sports")) return { effect: "workout", label: q.label!, text: "Ten honest minutes. Your arms will have something to say about it tomorrow." };
  if (/book|magazine|paper|crossword|notice|leaflet/.test(L)) return { effect: "read", label: q.label!, text: "You read three pages and one very strong opinion about parking." };
  if (/dance|floor|stage/.test(L) && kind === "nightclub") return { effect: "dance", label: q.label!, text: "The bass finds your knees before your brain agrees." };
  switch (q.type) {
    case "bed": return { effect: "rest", label: q.label ?? "Bed", text: "You lie down for a bit. The ceiling has a crack shaped like Banks Peninsula." };
    case "sofa": return { effect: "sit", label: q.label ?? "Sofa", text: "You sink in. Ten seconds of doing absolutely nothing." };
    case "bench": return kind === "police" ? null : { effect: "sit", label: q.label ?? "Bench", text: "You take the weight off for a minute." };
    case "fridge": return home ? { effect: "eat", label: q.label ?? "Fridge", text: "Leftovers, a lonely yoghurt and half a pie. Dinner is served." } : { effect: "eat", label: q.label ?? "Drinks fridge", text: "A cold drink and a pie from the warmer. Simple joys.", cost: 4 };
    case "vending": return { effect: "vend", label: q.label ?? "Vending machine", text: "Clunk. Something salty drops. Victory.", cost: 3 };
    case "bath": return { effect: "wash", label: q.label ?? "Bath", text: "A proper wash. You feel like a new person, or at least a cleaner one." };
    case "shelf": case "rack": return q.label && !/wall|aprons|medicines|bars/.test(L) ? { effect: "browse", label: q.label, text: "You browse. You don't need any of it. You want some of it." } : null;
    default: return null;
  }
}

// ------------------------------------------------------------------ geometry
const centre = (q: Prop): Pt => ({ x: q.x + q.w / 2, y: q.y + q.h / 2 });
function overlaps(def: InteriorDef, x: number, y: number, w: number, h: number, pad: number): boolean {
  for (const q of def.props) {
    const info = PROP_INFO[q.type]; if (info.wall) continue;
    if (x < q.x + q.w + pad && x + w + pad > q.x && y < q.y + q.h + pad && y + h + pad > q.y) return true;
  }
  return false;
}
/** A walkable point next to a prop that you can get to from the door, or null. */
function standPoint(def: InteriorDef, q: Prop): Pt | null {
  const c = centre(q), o = 0.5;
  const cands: Pt[] = [{ x: c.x, y: q.y + q.h + o }, { x: q.x + q.w + o, y: c.y }, { x: c.x, y: q.y - o }, { x: q.x - o, y: c.y }];
  for (const s of cands) if (!blockedAt(def, s.x, s.y) && reachable(def, def.door, s)) return s;
  return null;
}

// ------------------------------------------------------------------ build
const cache = new Map<string, InteriorDef>();
/** This building's interior. Cached per building, so the nav grid and the look are stable between visits. */
export function interiorForBuilding(b: BuildingRef): InteriorDef {
  const key = `${b.id}:${b.kind}:${b.name}:${b.usage??''}`;
  let d = cache.get(key);
  if (!d) { d = placeActions(vary(buildingInterior(b.kind,b.name,b.usage)??interiorFor(b.kind), b)); cache.set(key, d);while(cache.size>96)cache.delete(cache.keys().next().value!); }
  return d;
}

export function vary(base: InteriorDef, b: BuildingRef): InteriorDef {
  const rng = new Rng(hashString(`${b.kind}#${b.id}#${b.name}`));
  const strict = STRICT.has(b.kind);
  const theme = rng.pick(THEMES);
  const dh = theme.hue + rng.range(-25, 25), ks = theme.sat * rng.range(0.85, 1.15), kl = theme.lit * rng.range(0.92, 1.08);
  const def: InteriorDef = JSON.parse(JSON.stringify(base));
  def.kind = base.kind;

  // floors and lighting
  for (const zn of def.zones) {
    zn.color = shiftColor(mix(zn.color, theme.floor, strict ? 0.2 : 0.5), rng.range(-8, 8), 1, rng.range(0.94, 1.06));
    if (!strict && zn.floor !== "grass" && rng.chance(0.55)) zn.floor = rng.pick(theme.floors);
  }
  if (!strict && theme.light && rng.chance(0.45)) def.light = theme.light;
  def.busy = Math.max(0.1, Math.min(1, base.busy * rng.range(0.6, 1.4)));

  // furniture recolour: one shift per building, a little jitter per piece so sets still read as sets
  for (const q of def.props) {
    if (q.type === "partition") { if (!strict) q.color = shiftColor(q.color, dh * 0.4, 1, kl); continue; }
    if (!RECOLOUR.has(q.type)) continue;
    q.color = shiftColor(q.color, (strict ? dh * 0.3 : dh) + rng.range(-6, 6), strict ? 1 : ks, kl);
  }

  // its own name on the main sign, local posters, the owner's taste on the walls
  const sign = def.props.find((q) => q.type === "sign" && q.y === 0 && q.h === 0);
  if (sign && !strict) sign.label = b.name;
  for (const q of def.props) if (q.type === "poster" && rng.chance(0.6) && !/0800|1737|healthline|wash your hands/i.test(q.label ?? "")) q.label = rng.pick(POSTERS);

  const baseline = [...def.interactables.map((i) => ({ x: i.x, y: i.y })), ...def.spots.map((s) => ({ x: s.x, y: s.y }))].filter((pt) => reachable(def, def.door, pt));
  const okStill = (cand: InteriorDef) => baseline.every((pt) => reachable(cand, cand.door, pt));
  const keepClear = (x: number, y: number, w: number, h: number): boolean => {
    const cx = x + w / 2, cy = y + h / 2;
    if (Math.hypot(cx - def.door.x, cy - def.door.y) < 2.4) return false;
    for (const pt of baseline) if (pt.x > x - 0.8 && pt.x < x + w + 0.8 && pt.y > y - 0.8 && pt.y < y + h + 0.8) return false;
    return true;
  };

  // extra dressing on the floor
  const DRESS: [PropType, number, number, string, string?][] = [
    ["plant", 0.8, 0.8, "#3f8f4a"], ["plant", 1, 1, "#2f7a3d", "Monstera"], ["lamp", 0.5, 0.5, "#f6b62c", "Floor lamp"], ["rug", 2.2, 1.6, "#a0522d"],
    ["flower", 0.7, 0.7, "#ff7ad9"], ["bin", 0.5, 0.5, "#556"], ["shelf", 1.8, 0.6, "#6b4a2a", "Bookshelf"], ["machine", 0.9, 0.8, "#3a2f5a", "Arcade cabinet"],
    ["machine", 0.9, 0.7, "#b0641c", "Jukebox"], ["table", 1.2, 0.8, "#6b4a2a", "Paper & crossword"],
  ];
  const want = strict ? rng.int(2, 3) : rng.int(3, 7);
  let placed = 0;
  for (let tries = 0; tries < 60 && placed < want; tries++) {
    const [type, w, h, col, label] = rng.pick(DRESS);
    if (strict && (type === "machine" || type === "rug")) continue;
    if (type === "machine" && def.props.some((q) => q.label === label)) continue;
    const alongWall = type === "shelf" || type === "machine" || rng.chance(0.5);
    const x = alongWall && rng.chance(0.5) ? 0.15 : rng.range(0.3, def.size.w - w - 0.3);
    const y = alongWall && x !== 0.15 ? 0.15 : rng.range(0.3, def.size.h - h - 0.3);
    if (x + w > def.size.w - 0.1 || y + h > def.size.h - 0.1) continue;
    const flat = PROP_INFO[type].flat;
    if (overlaps(def, x, y, w, h, flat ? 0.05 : 0.3)) continue;
    if (!flat && !keepClear(x, y, w, h)) continue;
    const color = type === "rug" ? shiftColor(col, dh, ks, kl) : type === "plant" || type === "flower" ? shiftColor(col, rng.range(-20, 20), 1, rng.range(0.85, 1.15)) : shiftColor(col, dh * 0.5, 1, kl);
    const prop = p(type, +x.toFixed(2), +y.toFixed(2), w, h, color, label);
    def.props.push(prop);
    if (!flat && !okStill(def)) { def.props.pop(); continue; }
    placed++;
  }

  // wall art: posters, clocks, windows and the theme's statement piece
  const used: Record<"n" | "w", [number, number][]> = { n: [], w: [] };
  for (const q of def.props) if (PROP_INFO[q.type].wall) { if (q.y === 0 && q.h === 0) used.n.push([q.x, q.x + q.w]); else used.w.push([q.y, q.y + q.h]); }
  const WALL: [PropType, number, string, string][] = [["poster", 1.4, "#f6b62c", ""], ["clock", 0.7, "#eee4d3", "Clock"], ["window", 2, "#9fd8ff", "Window"], ["board", 1.8, "#2a2a33", ""], ["poster", 1.2, "#ff7ad9", ""]];
  const art = strict ? 1 : rng.int(2, 4);
  for (let i = 0, tries = 0; i < art && tries < 30; tries++) {
    const [type, len, col, lab] = i === 0 ? (["poster", 1.6, shiftColor("#eee4d3", dh, ks, kl), rng.pick(theme.art)] as [PropType, number, string, string]) : rng.pick(WALL);
    const side: "n" | "w" = rng.chance(0.6) ? "n" : "w";
    const max = (side === "n" ? def.size.w : def.size.h) - len - 0.3;
    const at = +rng.range(0.4, max).toFixed(2);
    if (side === "w" && Math.abs(at + len / 2 - def.door.y) < 1.6) continue;
    if (used[side].some(([a, z]) => at < z + 0.3 && at + len + 0.3 > a)) continue;
    used[side].push([at, at + len]);
    def.props.push(side === "n" ? p(type, at, 0, len, 0, col, lab || rng.pick(POSTERS)) : p(type, 0, at, 0, len, col, lab || rng.pick(POSTERS)));
    i++;
  }

  // wire furniture to needs: one interactable per useful thing, at a reachable spot beside it
  const wired = new Set<Effect>(def.interactables.map((i) => i.effect).filter((e): e is Effect => !!e));
  let auto = 0;
  for (const q of def.props) {
    if (auto >= 6) break;
    const w = wireFor(q, b.kind); if (!w) continue;
    const c = centre(q);
    if (def.interactables.some((i) => Math.hypot(i.x - c.x, i.y - c.y) < 1.8)) continue;
    if (wired.has(w.effect) && w.effect !== "play" && w.effect !== "music") continue;
    const at = standPoint(def, q); if (!at) continue;
    def.interactables.push({ id: `auto-${auto}`, label: w.label, x: +at.x.toFixed(2), y: +at.y.toFixed(2), text: w.text, effect: w.effect, ...(w.cost ? { cost: w.cost } : {}) });
    wired.add(w.effect); auto++;
  }

  // a staff door: pick up a paid shift wherever someone works
  const job = BUILDINGS[b.kind]?.job;
  if (job || b.kind === "office" || b.kind === "cafe" || b.kind === "bakery") {
    const ws = def.spots.find((s) => s.doing === "work");
    if (ws) {
      const cands: Pt[] = [{ x: ws.x, y: ws.y }, { x: ws.x + 0.6, y: ws.y }, { x: ws.x - 0.6, y: ws.y }, { x: ws.x, y: ws.y + 0.6 }];
      const at = cands.find((c) => !blockedAt(def, c.x, c.y) && reachable(def, def.door, c));
      if (at) def.interactables.push({ id: "shift", label: "Staff only: pick up a shift", x: at.x, y: at.y, effect: "work", text: "The manager tosses you an apron. 'You're on. Don't touch the good knife.'" });
    }
  }

  // who runs it
  const first = rng.pick(rng.chance(0.5) ? FIRST_GIRL : FIRST_GUY), last = rng.pick(SURNAMES);
  const owner = strict ? `On duty today: ${first} ${last}.` : `Run by ${first} ${last}, ${rng.pick(QUIRKS)}.`;
  const look = strict ? "" : ` Done out ${theme.name === "op-shop" ? "like a much-loved op shop" : `in a ${theme.name} style`}.`;
  def.flavour = base.flavour.map((f) => `${f} ${owner}${look}`);
  return def;
}

/** Which need an effect feeds (for the "wants" hint). */
export const FEEDS: Record<Effect, "hunger" | "energy" | "social" | "fun" | "curiosity" | "health" | "cash"> = {
  treat: "health", vend: "hunger", eat: "hunger", cuppa: "social", rest: "energy", sit: "energy", wash: "energy", workout: "fun",
  play: "fun", music: "fun", dance: "fun", browse: "curiosity", read: "curiosity", work: "cash",
};
