/**
 * Hidden places: four secrets tucked into the city. Pure and DOM-free so tests can pin them down.
 *  - the rooftop garden, reached by a ladder, with its own residents
 *  - the subway, six stations that are each a weird little neighbourhood
 *  - the glitch alley, only there from 3:33 for half an hour and different every visit
 *  - the moss and neon alley, where the graffiti keeps growing over the days
 * Drawing lives in src/render/HiddenArt.ts and the panels in src/ui/HiddenPlaces.ts.
 */
import type { World, Building, Area } from "../world/World";

export type HiddenId = "ladder" | "subway" | "station" | "glitch" | "neon";
export interface HiddenSpot { id: HiddenId; x: number; y: number; label: string; /** station index */ station?: number; /** building index (ladder) */ building?: number }

export const hash = (...n: number[]): number => { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 15; } return h >>> 0; };

// ---------------------------------------------------------------- rooftop garden
export interface Gardener { name: string; role: string; lines: string[] }
export const GARDENERS: Gardener[] = [
  { name: "Auntie Fern", role: "tomato diplomat", lines: ["Eight storeys up and the tomatoes still sulk.", "Take one. They taste like sunshine and spite.", "The trick is talking to them. Rudely, mostly."] },
  { name: "Pita", role: "bee whisperer", lines: ["Don't wave. They think you're a very slow bee.", "The honey is mostly lavender and rumours.", "We don't have a queen. We have a committee."] },
  { name: "Old Gus", role: "watering can historian", lines: ["This can's older than the lift. Treat it kindly.", "Nobody finds the ladder by accident. You were invited.", "Sit. The sunset up here is free and has no ads."] },
];

/** Tallest block with a flat roof and a reachable south wall: the ladder goes there. */
export function pickGardenBuilding(w: World): Building | undefined {
  const cands = w.buildings.filter((b) => ["apartments", "office", "hotel", "bank"].includes(b.kind)).sort((a, b) => b.height - a.height || a.id - b.id);
  return cands.find((b) => ladderTile(w, b)) ?? cands[0];
}
function ladderTile(w: World, b: Building): { x: number; y: number } | null {
  const y = b.y1 + 1;
  for (let x = b.x0 + Math.floor((b.x1 - b.x0) / 2); x <= b.x1; x++) if (w.walkableTile(x, y)) return { x: x + 0.5, y: y + 0.5 };
  for (let x = b.x0; x <= b.x1; x++) if (w.walkableTile(x, y)) return { x: x + 0.5, y: y + 0.5 };
  return null;
}

// ---------------------------------------------------------------- subway
export type StationProp = "lantern" | "pigeon" | "sign" | "fern" | "tv" | "mushroom";
export interface Station { name: string; tint: string; prop: StationProp; blurb: string; quips: string[]; /** preferred area kinds, best first */ kinds: string[] }
export const STATIONS: Station[] = [
  { name: "Pigeon Terminus", tint: "#9fb0c8", prop: "pigeon", blurb: "The pigeons run the timetable. Every platform is a perch.", quips: ["Coo-ordinates, please.", "The 9:15 is a pigeon. It's always a pigeon."], kinds: ["plaza", "market"] },
  { name: "Lantern Row", tint: "#ff9a3d", prop: "lantern", blurb: "Paper lanterns on every pole and a noodle cart nobody can find twice.", quips: ["Lantern's lit, so the soup's on.", "Mind the glow. It gets in your hair."], kinds: ["food", "market"] },
  { name: "Upside-Down Mall", tint: "#ff7ad9", prop: "sign", blurb: "Every sign hangs upside down and the shoppers have given up complaining.", quips: ["The sale is on. Probably. I can't read it.", "Down is up here. Get used to it."], kinds: ["shops", "plaza"] },
  { name: "Moss Junction", tint: "#6fe3b0", prop: "fern", blurb: "Ferns push up through the tiles and the benches are soft with moss.", quips: ["Shh. The floor is sleeping.", "Even the timetable has leaves."], kinds: ["park", "playground"] },
  { name: "Static Heights", tint: "#3dd6ff", prop: "tv", blurb: "A hundred old TVs hum a single channel of pure snow.", quips: ["Channel zero's the good one.", "We're not watching it. It's watching the weather."], kinds: ["alley", "court"] },
  { name: "Glowcap Gardens", tint: "#b48cff", prop: "mushroom", blurb: "Giant mushrooms light the platform. Please do not lick the benches.", quips: ["Don't lick the benches.", "The blue ones are mood lamps. Probably."], kinds: ["residential", "office", "park"] },
];

/** One distinct area per station, preferring the themed kinds; falls back to any non-street area. */
export function stationAreas(w: World): Area[] {
  const pool = w.areas.filter((a) => a.kind !== "street" && a.kind !== "studio");
  const used = new Set<number>(), out: Area[] = [];
  for (const s of STATIONS) {
    let a = pool.find((x) => !used.has(x.id) && s.kinds.includes(x.kind)) ?? pool.find((x) => !used.has(x.id)) ?? pool[out.length % pool.length];
    used.add(a.id); out.push(a);
  }
  return out;
}

// ---------------------------------------------------------------- glitch alley
/** Opens at 3:33 game time and lasts half an hour (thirty real seconds at 1x). */
export const GLITCH_FROM = 3 + 33 / 60, GLITCH_TO = 4 + 3 / 60;
export const glitchOpen = (hour: number): boolean => hour >= GLITCH_FROM && hour < GLITCH_TO;
export interface GlitchVisit { title: string; lines: string[]; cash: number; tint: string }
const GLITCH: GlitchVisit[] = [
  { title: "The street, but earlier", lines: ["Every lamp is lit and nobody is home.", "A cat watches you walk in. It also walks in. Two cats."], cash: 0, tint: "#3dd6ff" },
  { title: "A vending machine for time", lines: ["It sells minutes in little cans.", "A can rolls out stamped 3:33. You put it back."], cash: 0, tint: "#ff7ad9" },
  { title: "Loose change from tomorrow", lines: ["The coins are warm and slightly future.", "You pocket $33 before it notices."], cash: 33, tint: "#c6ff3d" },
  { title: "Your own footsteps, late", lines: ["They arrive a second after you stop.", "They sound less sure than you do."], cash: 0, tint: "#b48cff" },
  { title: "The wall remembers", lines: ["Old posters peel themselves back on, then off.", "One says OPEN LATE. The shop it advertises isn't built yet."], cash: 0, tint: "#ff9a3d" },
  { title: "A door with no building", lines: ["It opens onto the same alley, a different year.", "Somebody left a $20 note in the frame."], cash: 20, tint: "#3dd6ff" },
  { title: "Rain that isn't wet", lines: ["It falls upward and smells of pennies.", "You feel strangely rested."], cash: 0, tint: "#6fe3b0" },
  { title: "The lamp winks", lines: ["Once for yes, twice for 3:34.", "It winks three times. You decide not to ask."], cash: 5, tint: "#ff7ad9" },
];
export const GLITCH_COUNT = GLITCH.length;
/** The n-th visit of a day. Consecutive visits always differ (3 is coprime to 8). */
export function glitchVisit(day: number, n: number): GlitchVisit { return GLITCH[(hash(day, 33) + n * 3) % GLITCH.length]; }

// ---------------------------------------------------------------- moss and neon alley
export const MOSS_WORDS = ["MOSS WAS HERE", "SOFT CONCRETE", "NO PARKING FOR GHOSTS", "GROW SLOWLY", "FERN CLUB", "BE KIND TO WALLS", "NEON NANA", "LOW TIDE LOVE", "LISTEN TO THE BRICKS", "STILL HERE"];
export const MAX_PANELS = 9;
/** Days of growth to full moss. */
export const MOSS_DAYS = 14;
export const mossCover = (day: number): number => Math.min(1, Math.max(0, day) / MOSS_DAYS);
/** Panels on the wall: one to start, one more every two days, plus any the player sprayed. */
export const panelCount = (day: number, tags = 0): number => Math.min(MAX_PANELS, 1 + Math.floor(Math.max(0, day) / 2) + tags);
export interface Panel { u: number; w: number; hue: number; word: string }
export function panelAt(i: number): Panel { return { u: (i % 3) / 3 + 0.02, w: 0.28, hue: hash(i, 7) % 360, word: MOSS_WORDS[i % MOSS_WORDS.length] }; }

// ---------------------------------------------------------------- placement
const mk = (id: HiddenId, p: { x: number; y: number }, label: string, extra: Partial<HiddenSpot> = {}): HiddenSpot => ({ id, x: p.x, y: p.y, label, ...extra });

/** Where the hidden places sit in this world. Deterministic: same world, same spots. */
export function placeHidden(w: World): HiddenSpot[] {
  const out: HiddenSpot[] = [];
  const g = pickGardenBuilding(w);
  if (g) { const t = ladderTile(w, g) ?? w.nearestWalkable(g.door.x + 0.5, g.door.y + 1.5); out.push(mk("ladder", t, "Climb the rooftop ladder", { building: g.id })); }
  const plaza = w.areas.find((a) => a.kind === "plaza") ?? w.areas.find((a) => a.kind !== "street");
  if (plaza) out.push(mk("subway", w.nearestWalkable(plaza.x1 - 1, plaza.y0 + 1), "Take the subway"));
  stationAreas(w).forEach((a, i) => out.push(mk("station", w.nearestWalkable(a.x0 + 2, a.y0 + 2), `Ride on from ${STATIONS[i].name}`, { station: i })));
  const alleys = w.areas.filter((a) => a.kind === "alley");
  const a0 = alleys[0] ?? w.areas.find((a) => a.kind !== "street")!, a1 = alleys[1] ?? a0;
  out.push(mk("glitch", w.nearestWalkable(a0.cx - 3, a0.y1 - 1), "Step into the glitch"));
  out.push(mk("neon", w.nearestWalkable(a1.cx + (a1 === a0 ? 3 : 0), a1.y1 - 1), "Read the moss wall"));
  return out;
}

const cache = new WeakMap<World, HiddenSpot[]>();
/** Spots for a world, computed once. */
export function hiddenSpots(w: World): HiddenSpot[] { let s = cache.get(w); if (!s) { s = placeHidden(w); cache.set(w, s); } return s; }
/** Is the spot usable right now? Only the glitch alley comes and goes. */
export const spotLive = (s: HiddenSpot, hour: number): boolean => s.id !== "glitch" || glitchOpen(hour);
export function nearestSpot(w: World, x: number, y: number, hour: number, r = 1.9): HiddenSpot | null {
  let best: HiddenSpot | null = null, bd = r;
  for (const s of hiddenSpots(w)) { if (!spotLive(s, hour)) continue; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return best;
}

/** Whole game days elapsed (day 0 is the first). */
export const dayOf = (startHour: number, tick: number, ticksPerHour: number): number => Math.floor((startHour + tick / ticksPerHour) / 24);

/** What the player has done here. Kept in localStorage so the moss wall remembers your tags. */
export const hiddenState = { tags: 0, tomatoDay: -1, glitchDay: -1, glitchVisits: 0, firstGift: false };
const KEY = "mosaics-world:hidden";
export function loadHidden(): void { try { Object.assign(hiddenState, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* private mode */ } }
export function saveHidden(): void { try { localStorage.setItem(KEY, JSON.stringify(hiddenState)); } catch { /* full */ } }
