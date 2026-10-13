/**
 * Interior floor plans: pure, DOM-free, JSON-serialisable data. One entry per building kind (or a
 * declared fallback). Coordinates are floor-plan TILES: x runs east, y runs south, origin at the
 * north-west corner. A prop's (x, y) is its top-left corner, (w, h) its footprint.
 *
 * Rendering lives in src/render/InteriorView.ts, movement/overlay in src/ui/InteriorOverlay.ts and
 * the collision/path helpers in src/content/interiorNav.ts.
 *
 * ---------------------------------------------------------------------------------------------
 * COVERAGE. Hand-built interiors: hospital, mentalhealth (Putahi), police, bank, office, apartments,
 * house, hotel (this file) and the high-street kinds in interiorsShops.ts: cafe, bakery, pizza,
 * sushi, fishchips, dairy, toyshop, sports, pawn, records, garage, barber, gym, nightclub, gallery,
 * dealership.
 *
 * NOT COVERED (these use FALLBACK, a generic shopfront): studio (MosaicScope Studio has its own
 * flow). Specialised overlays reached BEFORE the interior (Game.enterPlace): casino, airport,
 * stripclub, velvet, diner. They still work and need no interior.
 * Kinds that do not exist in buildings.ts (so nothing to cover): fire station, civic centre, town
 * hall, library, school, university.
 *
 * HOW TO ADD A KIND: write a def (or a `shopfront()` in interiorsShops.ts) and add it to the INTERIORS table below, using the
 * `p()` / `wp()` prop helpers, then delete the kind from the list above. tests/interiors.test.ts
 * checks bounds, zones, door-to-everything reachability, spots and JSON round-trip for you.
 *  - Wall-mounted props (poster, sign, clock, screen, board, window, vent) go on the visible
 *    north wall (y = 0, h = 0) or west wall (x = 0, w = 0); `wp()` does this for you.
 *  - Every interactable stands on a walkable, reachable (x, y). `launch` reuses an existing panel.
 *  - `spots` are where people stand/sit. `work` spots are for staff; the rest for visitors.
 *  - Keep copy PG-13, adult, no real brands or people.
 * ---------------------------------------------------------------------------------------------
 */
import type { BuildingKind } from "./buildings";

export type FloorMat = "tile" | "lino" | "carpet" | "wood" | "concrete" | "marble" | "grass" | "pavers" | "rubber";

export type PropType =
  | "partition" | "counter" | "desk" | "chair" | "sofa" | "bed" | "curtain" | "table" | "cabinet" | "shelf" | "plant"
  | "vending" | "machine" | "locker" | "bars" | "bench" | "lift" | "stairs" | "bath" | "fridge" | "tree" | "fountain"
  | "rug" | "mat" | "trolley" | "bin" | "lamp" | "pillar" | "stanchion" | "vault" | "rack" | "flower"
  | "poster" | "sign" | "clock" | "screen" | "board" | "window" | "vent";

export interface PropInfo { ht: number; solid: boolean; flat?: boolean; wall?: boolean; elev?: number }
/** Shared by renderer, collision and tests. `ht` is height in tiles. Flat props are walkable floor art. */
export const PROP_INFO: Record<PropType, PropInfo> = {
  partition: { ht: 1.35, solid: true }, counter: { ht: 0.95, solid: true }, desk: { ht: 0.78, solid: true }, chair: { ht: 0.55, solid: true },
  sofa: { ht: 0.7, solid: true }, bed: { ht: 0.62, solid: true }, curtain: { ht: 1.7, solid: false }, table: { ht: 0.75, solid: true },
  cabinet: { ht: 1.1, solid: true }, shelf: { ht: 1.6, solid: true }, plant: { ht: 1.05, solid: true }, vending: { ht: 1.7, solid: true },
  machine: { ht: 1.0, solid: true }, locker: { ht: 1.5, solid: true }, bars: { ht: 1.35, solid: true }, bench: { ht: 0.5, solid: true },
  lift: { ht: 1.9, solid: true }, stairs: { ht: 1.3, solid: true }, bath: { ht: 0.5, solid: true }, fridge: { ht: 1.5, solid: true },
  tree: { ht: 2.5, solid: true }, fountain: { ht: 0.45, solid: true }, rug: { ht: 0, solid: false, flat: true }, mat: { ht: 0, solid: false, flat: true },
  trolley: { ht: 0.7, solid: true }, bin: { ht: 0.5, solid: true }, lamp: { ht: 1.5, solid: true }, pillar: { ht: 1.9, solid: true },
  stanchion: { ht: 0.85, solid: true }, vault: { ht: 1.9, solid: true }, rack: { ht: 0.8, solid: true }, flower: { ht: 0.5, solid: false, flat: true },
  poster: { ht: 0, solid: false, wall: true, elev: 0.75 }, sign: { ht: 0, solid: false, wall: true, elev: 1.45 }, clock: { ht: 0, solid: false, wall: true, elev: 1.5 },
  screen: { ht: 0, solid: false, wall: true, elev: 0.95 }, board: { ht: 0, solid: false, wall: true, elev: 0.7 }, window: { ht: 0, solid: false, wall: true, elev: 0.55 },
  vent: { ht: 0, solid: false, wall: true, elev: 1.25 },
};

export interface Prop { type: PropType; x: number; y: number; w: number; h: number; color: string; material?: FloorMat | "metal" | "glass" | "fabric" | "wood"; label?: string }
export interface Zone { id: string; name: string; x: number; y: number; w: number; h: number; floor: FloorMat; color: string }
export type Launch = "legacy" | "police" | "putahi" | "shop" | "dealership" | "gallery";
export type Effect = "treat" | "vend" | "rest" | "cuppa";
export interface Interactable { id: string; label: string; x: number; y: number; text: string; launch?: Launch; effect?: Effect; cost?: number }
export type SpotDoing = "queue" | "sit" | "stand" | "work" | "browse" | "lie" | "phone" | "talk";
export interface Spot { x: number; y: number; doing: SpotDoing; face: "n" | "e" | "s" | "w"; group?: string }
export type LightTone = "cool" | "warm" | "dim" | "soft" | "neon";
export interface InteriorDef {
  kind: BuildingKind | "fallback";
  title: string;
  size: { w: number; h: number };
  /** Entrance on the west wall; `x`,`y` is where you appear (and the exit sits). */
  door: { x: number; y: number };
  light: LightTone;
  ambience: string[];
  /** 0..1: how full it tends to be (scales ambient visitors). */
  busy: number;
  /** Look of staff drawn at `work` spots when no real worker is inside. */
  staff: { color: string; hat?: string };
  zones: Zone[];
  props: Prop[];
  interactables: Interactable[];
  spots: Spot[];
  flavour: string[];
}

import { p, wp, z, wallV, wallH, row, spot } from "./interiorKit";
import { SHOP_INTERIORS } from "./interiorsShops";

// ------------------------------------------------------------------ HOSPITAL (Christchurch Public Hospital)
const hospital: InteriorDef = {
  kind: "hospital", title: "Emergency Department", size: { w: 26, h: 16 }, door: { x: 1.5, y: 10.5 },
  light: "cool", ambience: ["fluorescent", "monitor-beeps", "hush", "sanitiser"], busy: 0.8, staff: { color: "#3dd6ff" },
  zones: [
    z("reception", "Triage & reception", 0, 0, 10, 4, "lino", "#cfd8dc"),
    z("waiting", "ED waiting room", 0, 4, 10, 12, "lino", "#c3ccd2"),
    z("bays", "ED treatment bays", 10, 0, 8, 8, "tile", "#d6e0e4"),
    z("imaging", "X-ray (Imaging)", 18, 0, 8, 8, "tile", "#b9c4cc"),
    z("corridor", "Main corridor", 10, 8, 16, 3, "lino", "#bcc6cc"),
    z("ward", "Short-stay ward", 10, 11, 8, 5, "tile", "#d6e0e4"),
    z("pharmacy", "Pharmacy", 18, 11, 8, 5, "lino", "#cfd8dc"),
  ],
  props: [
    // walls
    wallV(10, 0, 9), wallV(10, 12, 16), wallV(18, 0, 8), wallH(8, 18, 19.5), wallH(8, 22, 26),
    wallV(18, 11, 16), wallH(11, 18, 19.5), wallH(11, 22, 26), wallH(11, 10, 11.5), wallH(11, 14, 18),
    // reception / triage
    p("counter", 0.2, 3, 7.8, 1, "#e8e2d6", "Triage desk"),
    p("desk", 2, 1.1, 2, 0.8, "#b8c2c8", "Admin"), p("desk", 5, 1.1, 2, 0.8, "#b8c2c8", "Admin"),
    p("shelf", 7.6, 0.2, 2, 0.6, "#a9b4bb", "Forms & ID bands"),
    wp("sign", "n", 2.5, 5, "#1fae7a", "Kia ora - Nau mai, haere mai"),
    wp("screen", "n", 8, 1.6, "#2a3a4e", "Triage times: ~2 hrs"),
    // waiting room
    ...row("chair", 6, 2, 6.4, 1, 0, 0.9, 0.9, "#3a6e8f", "Waiting chairs"),
    ...row("chair", 5, 3, 13, 1, 0, 0.9, 0.9, "#3a6e8f"),
    p("table", 1.2, 8, 0.8, 1.4, "#9aa6ad", "Magazines"),
    p("rug", 0.3, 12.8, 2.5, 3, "#ff7ad9", "Kids' corner"), p("table", 0.8, 13.7, 1.5, 1, "#f6b62c", "Kids' table"),
    p("vending", 8.95, 13.4, 0.9, 0.9, "#ec2a1c", "Vending machine"), p("vending", 8.95, 14.7, 0.9, 0.9, "#3dd6ff", "Water & juice"),
    p("plant", 0.4, 4.3, 0.8, 0.8, "#3f8f4a"), p("plant", 8.7, 4.3, 0.8, 0.8, "#3f8f4a"),
    p("bin", 6.5, 9.2, 0.6, 0.6, "#556", "Sanitiser stand"),
    wp("poster", "w", 4.6, 1.3, "#ffffff", "Healthline 0800 611 116"),
    wp("clock", "w", 6.8, 0.8, "#eee4d3", "Clock"),
    wp("poster", "w", 13.2, 1.4, "#a8e0ff", "Wash your hands"),
    wp("poster", "w", 8, 1.2, "#6fe3b0", "1737: free call or text"),
    // ED bays
    p("bed", 10.8, 0.8, 1.3, 2.5, "#dfe6ea", "Bay 1"), p("bed", 12.9, 0.8, 1.3, 2.5, "#dfe6ea", "Bay 2"), p("bed", 15, 0.8, 1.3, 2.5, "#dfe6ea", "Bay 3"),
    p("curtain", 12.4, 0.2, 0.1, 4.3, "#79b8a6"), p("curtain", 14.5, 0.2, 0.1, 4.3, "#79b8a6"), p("curtain", 16.6, 0.2, 0.1, 4.3, "#79b8a6"),
    p("machine", 11.2, 3.5, 0.6, 0.5, "#223", "Obs monitor"), p("machine", 15.4, 3.5, 0.6, 0.5, "#223", "Obs monitor"),
    p("trolley", 13, 5.8, 1.3, 0.8, "#c33", "Resus trolley"), p("bin", 16.8, 6.8, 0.6, 0.6, "#e8b800", "Sharps bin"),
    p("trolley", 10.4, 6.8, 0.8, 0.8, "#9aa6ad", "Wheelchair"),
    // nurses' station island
    p("counter", 12.5, 9.1, 5.5, 0.9, "#e8e2d6", "Nurses' station"), p("machine", 13, 9.0, 0.7, 0.5, "#223", "Terminal"), p("machine", 15.6, 9.0, 0.7, 0.5, "#223", "Terminal"),
    // X-ray
    p("machine", 20.4, 0.3, 2.4, 0.8, "#cfd8dc", "X-ray tube"), p("bed", 21, 1.3, 1.4, 2.8, "#9aa8b0", "X-ray table"),
    p("desk", 24, 1, 1.6, 2.2, "#2a3a4e", "Control desk"), p("shelf", 18.3, 3.6, 0.7, 2.4, "#707c84", "Lead aprons"),
    wp("sign", "n", 19.3, 3, "#f6b62c", "RADIATION - Imaging"), wp("screen", "n", 24, 1.6, "#9be8ff", "Console"),
    // ward
    p("bed", 10.8, 12.6, 1.3, 2.5, "#dfe6ea", "Bed 1"), p("bed", 13.2, 12.6, 1.3, 2.5, "#dfe6ea", "Bed 2"), p("bed", 15.6, 12.6, 1.3, 2.5, "#dfe6ea", "Bed 3"),
    p("curtain", 12.5, 11.8, 0.1, 3.6, "#79b8a6"), p("curtain", 14.9, 11.8, 0.1, 3.6, "#79b8a6"),
    // pharmacy
    p("counter", 19, 13.2, 6, 0.9, "#e8e2d6", "Dispensary"), p("shelf", 18.6, 15.1, 7, 0.7, "#c9d4dc", "Medicines"),
    p("chair", 24.4, 11.4, 0.9, 0.9, "#3a6e8f", "Wait here"),
  ],
  interactables: [
    { id: "triage", label: "Triage nurse", x: 4.5, y: 4.9, effect: "treat", text: "Triage nurse: 'Kia ora. Name, then pain out of ten?' You are patched up. Public hospital care is free." },
    { id: "vend", label: "Vending machine", x: 8.4, y: 14.1, effect: "vend", cost: 3, text: "Thunk. A cheese scroll and a juice, $3." },
    { id: "bay", label: "Bay 2 curtain", x: 13.5, y: 4.9, text: "Behind the curtain someone is being told to stop doing push-ups on a ladder." },
    { id: "nurses", label: "Nurses' station", x: 15.2, y: 8.5, text: "A whiteboard of beds, initials and one plea: 'Whoever took the good stapler.'" },
    { id: "xray", label: "X-ray room", x: 21.5, y: 6.4, text: "Radiographer: 'Pop the belt buckle off and hold still.' It is a fractured pride." },
    { id: "pharm", label: "Pharmacy", x: 21.5, y: 12.3, text: "Pharmacist: 'Take with food. And do NOT drive the forklift.'" },
    { id: "bed", label: "Ward bed", x: 12.6, y: 13.4, effect: "rest", text: "You lie down on a very firm bed. The sheets smell like hope and bleach." },
  ],
  spots: [
    spot(3, 2.2, "work", "s"), spot(5.5, 2.2, "work", "s"), spot(13.5, 8.4, "work", "s"), spot(16.2, 10.5, "work", "n"), spot(20, 14.6, "work", "s", "pharm"), spot(23, 14.6, "work", "s"),
    spot(21.5, 5, "work", "n"), spot(22.5, 4.4, "work", "w"),
    spot(2.5, 5.7, "queue", "n", "triage"), spot(3.5, 5.7, "queue", "n", "triage"), spot(4.5, 5.7, "queue", "n", "triage"),
    spot(2.45, 6.9, "sit", "n"), spot(3.45, 6.9, "sit", "n"), spot(5.45, 6.9, "sit", "n"), spot(6.45, 6.9, "sit", "n"), spot(7.45, 6.9, "sit", "n"),
    spot(3.45, 13.5, "sit", "s"), spot(4.45, 13.5, "sit", "s"), spot(6.45, 13.5, "sit", "s"), spot(7.45, 13.5, "sit", "s"),
    spot(1.5, 12.4, "phone", "e"), spot(5.5, 10.2, "stand", "e"),
    spot(11.45, 2, "lie", "s", "bed"), spot(15.65, 2, "lie", "s", "bed"), spot(11.45, 13.8, "lie", "s", "bed"), spot(16.25, 13.8, "lie", "s", "bed"),
    spot(21.7, 2.7, "lie", "s", "bed"), spot(12, 4.9, "talk", "e"), spot(23, 12.2, "queue", "n", "pharm"), spot(21, 12.2, "queue", "n", "pharm"),
  ],
  flavour: [
    "Fluorescent lights hum over a waiting room that has seen everything: a cricket ball injury, a gumboot, a very ashamed man with a traffic cone.",
    "Triage is a patient art. Everyone is, officially, the sickest person in the building.",
    "A laminated sign says 'Kia ora, nau mai, haere mai'. A second one says the vending machine does not give change.",
  ],
};

// ------------------------------------------------------------------ PUTAHI (mental health walk-in space)
const mentalhealth: InteriorDef = {
  kind: "mentalhealth", title: "Putahi walk-in space", size: { w: 24, h: 15 }, door: { x: 1.5, y: 8.5 },
  light: "soft", ambience: ["quiet", "birdsong", "kettle", "soft-music"], busy: 0.45, staff: { color: "#6fe3b0" },
  zones: [
    z("welcome", "Welcome & kai", 0, 0, 9, 6, "wood", "#c9b48f"),
    z("lounge", "Lounge", 0, 6, 9, 9, "carpet", "#a9b8a4"),
    z("hall", "Hall", 9, 0, 2, 15, "wood", "#c9b48f"),
    z("quiet", "Quiet room", 11, 0, 6, 5, "carpet", "#9fb3a8"),
    z("whanau", "Whanau room", 11, 5, 6, 5, "carpet", "#b3b09a"),
    z("korero", "Korero room", 11, 10, 6, 5, "carpet", "#9fb3a8"),
    z("garden", "Garden courtyard", 17, 0, 7, 15, "grass", "#55864c"),
  ],
  props: [
    wallV(9, 0, 6), wallV(9, 10, 15), wallV(11, 0, 1.2), wallV(11, 3.8, 6.2), wallV(11, 8.8, 11.2), wallV(11, 13.8, 15),
    wallH(5, 11, 17), wallH(10, 11, 17), wallV(17, 0, 1.5), wallV(17, 3.5, 6.5), wallV(17, 8.5, 11.5), wallV(17, 13.5, 15),
    // welcome
    p("counter", 1, 2.6, 3.6, 0.9, "#b9a07a", "Reception"), p("counter", 5.4, 0.3, 3, 0.8, "#b9a07a", "Kai & cuppa"), p("machine", 6, 0.2, 0.5, 0.5, "#c9c9c9", "Kettle"),
    wp("sign", "n", 1, 4, "#6fe3b0", "Nau mai, haere mai"), wp("poster", "n", 4.8, 0.7, "#ffffff", "1737: free call or text, any time"),
    p("plant", 0.4, 0.4, 0.9, 0.9, "#3f8f4a"),
    // lounge
    p("rug", 1.5, 8.8, 5.5, 4.4, "#6f8a7a", "Lounge rug"), p("sofa", 2, 7, 3, 1.1, "#8fa89a", "Sofa"), p("sofa", 6, 8.6, 1.1, 3, "#8fa89a"),
    p("table", 3.2, 10, 1.8, 1.2, "#b9a07a", "Tissues & tea"), p("chair", 2, 12.6, 1.1, 1.1, "#d1a96a", "Armchair"), p("chair", 4.6, 13, 1.1, 1.1, "#d1a96a", "Armchair"),
    p("shelf", 0.3, 13.3, 1, 1.5, "#a28660", "Books & puzzles"), p("lamp", 7.5, 7, 0.5, 0.5, "#f6e8a8"), p("plant", 7.8, 13.6, 0.9, 0.9, "#3f8f4a"),
    wp("poster", "w", 3.2, 1.3, "#9fd8ff", "Kia kaha"), wp("clock", "w", 5.3, 0.8, "#eee4d3", "Clock"), wp("board", "w", 11.5, 1.6, "#d6c7a1", "Groups & whanau support"),
    // quiet room
    p("sofa", 11.6, 0.6, 2.8, 1.1, "#7f9d90", "Quiet couch"), p("rug", 12, 2.4, 3.8, 2, "#58796b"), p("lamp", 15.8, 0.5, 0.5, 0.5, "#f6e8a8"), p("cabinet", 15.6, 3.6, 1, 1, "#a28660", "Weighted blankets"),
    // whanau room
    p("table", 12.4, 6.6, 2.6, 1.6, "#b9a07a", "Whanau table"), ...row("chair", 3, 12.5, 5.7, 1, 0, 0.8, 0.8, "#d1a96a"), ...row("chair", 3, 12.5, 8.4, 1, 0, 0.8, 0.8, "#d1a96a"),
    p("rug", 15.2, 8.5, 1.6, 1.2, "#ff7ad9", "Tamariki toys"), p("shelf", 11.3, 5.2, 0.7, 1.4, "#a28660", "Toys & books"),
    // korero room
    p("chair", 12, 11, 1.2, 1.2, "#d1a96a", "Armchair"), p("chair", 14.6, 11, 1.2, 1.2, "#d1a96a", "Armchair"), p("table", 13.2, 12.8, 1.4, 0.9, "#b9a07a", "Tissues"), p("plant", 15.7, 13.6, 0.9, 0.9, "#3f8f4a"),
    // garden
    p("rug", 17, 6.9, 7, 1.6, "#9a8d80", "Stone path"), p("tree", 19.6, 3.2, 2.2, 2.2, "#f6e24a", "Kowhai"),
    p("plant", 18, 0.8, 1.4, 1.4, "#3f8f4a", "Harakeke (flax)"), p("plant", 21.8, 1, 1.4, 1.4, "#3f8f4a", "Harakeke (flax)"),
    p("bench", 19, 9.6, 2.6, 0.8, "#8a6a40", "Garden bench"), p("fountain", 21, 11.2, 2, 2, "#3dd6ff", "Water feature"), p("flower", 18, 12, 2, 2, "#ff7ad9", "Native planting"),
  ],
  interactables: [
    { id: "reception", label: "Reception", x: 2.8, y: 4.4, launch: "putahi", text: "Kia ora, come in. No appointment, no judgement." },
    { id: "cuppa", label: "Kai & cuppa", x: 6.9, y: 2.2, effect: "cuppa", text: "A hot cuppa and a plate of biscuits. Kai helps." },
    { id: "poster", label: "1737 poster", x: 5.5, y: 2.2, text: "1737: free call or text, any time, to talk with a trained counsellor. Whanau are welcome here too." },
    { id: "quiet", label: "Quiet couch", x: 13, y: 2.8, effect: "rest", text: "You sit in the quiet room for a bit. Nobody needs anything from you." },
    { id: "whanau", label: "Whanau table", x: 15.7, y: 7.4, text: "A table big enough for the whole whanau, with a jug of water and a box of tissues." },
    { id: "bench", label: "Garden bench", x: 20.3, y: 8.6, effect: "rest", text: "A kowhai drops its petals. A tui, somewhere, is showing off." },
  ],
  spots: [
    spot(3, 1.7, "work", "s"), spot(6.5, 1.8, "work", "s"),
    spot(2.2, 8.8, "sit", "e"), spot(3.5, 8.8, "sit", "e"), spot(6.5, 9.5, "sit", "s"), spot(6.5, 11.2, "sit", "w"), spot(2.55, 13.15, "sit", "e"), spot(5.15, 13.55, "sit", "w"),
    spot(4.4, 5.2, "queue", "n", "reception"), spot(8, 3, "stand", "w"), spot(1.8, 11, "phone", "e"),
    spot(13, 3, "sit", "s"), spot(13.2, 6.2, "sit", "s"), spot(14.2, 6.2, "sit", "s"), spot(12.9, 9, "sit", "n"), spot(13.9, 9, "sit", "n"),
    spot(12.6, 11.6, "sit", "e"), spot(15.2, 11.6, "sit", "w"), spot(19, 9.1, "stand", "s"), spot(20.8, 10.1, "sit", "s"), spot(22, 8.2, "stand", "w"),
  ],
  flavour: [
    "A kettle clicks off somewhere. The room smells of toast and cut grass, and nobody is in a hurry.",
    "There is a poster for 1737 by the door: free call or text, any time. Another asks whanau to take a cuppa and stay a while.",
    "Through the glass doors a kowhai is dropping petals on the courtyard paving. The chairs are mismatched on purpose.",
  ],
};

// ------------------------------------------------------------------ POLICE (Central Police Station)
const police: InteriorDef = {
  kind: "police", title: "Central Police Station", size: { w: 26, h: 16 }, door: { x: 1.5, y: 12.5 },
  light: "cool", ambience: ["radio-chatter", "fluorescent", "phones", "door-buzzer"], busy: 0.55, staff: { color: "#3dd6ff", hat: "police" },
  zones: [
    z("staff", "Front office (staff)", 0, 0, 10, 5, "carpet", "#5a6677"),
    z("foyer", "Public foyer", 0, 5, 10, 11, "lino", "#a7b0b8"),
    z("cells", "Holding cells", 10, 0, 16, 5, "concrete", "#6c747c"),
    z("custody", "Custody corridor", 10, 5, 16, 3, "concrete", "#7b838b"),
    z("interview", "Interview room", 10, 8, 6, 4, "carpet", "#58606c"),
    z("interview2", "Interview room 2", 10, 12, 6, 4, "carpet", "#58606c"),
    z("evidence", "Evidence store", 16, 8, 10, 8, "concrete", "#6c747c"),
  ],
  props: [
    wallV(10, 0, 9), wallV(10, 11.5, 16), wallH(12, 10, 16), wallH(8, 10, 16), wallV(16, 8, 16), wallH(8, 16, 26),
    // front counter + staff gate
    p("counter", 0.2, 4.9, 8.4, 1, "#3a4a5e", "Front counter"), p("partition", 8.6, 4.9, 1.3, 1, "#2b3340", "Staff gate"),
    p("desk", 1.5, 1.2, 2.2, 1, "#6b7a89"), p("desk", 4.5, 1.2, 2.2, 1, "#6b7a89"), p("desk", 7.2, 1.2, 2.2, 1, "#6b7a89"),
    ...row("chair", 3, 2.2, 2.4, 3, 0, 0.8, 0.8, "#2b3340"), p("cabinet", 0.3, 3, 0.9, 1.5, "#556", "Files"),
    wp("board", "n", 3, 5.5, "#f6b62c", "SEIZED CONES: 47. RETURNED: 0"),
    // foyer
    p("bench", 2.5, 14.6, 4, 0.8, "#6b7a89", "Waiting bench"), p("locker", 7.4, 14.2, 2.4, 1.5, "#4a5a6b", "Property lockers"), p("plant", 0.4, 14.5, 0.8, 0.8, "#3f8f4a"),
    wp("board", "w", 6.2, 2, "#d6c7a1", "Neighbourhood Support"), wp("poster", "w", 8.8, 1.4, "#9fd8ff", "Non-emergency: dial 105"),
    wp("clock", "w", 10.6, 0.8, "#eee4d3", "Clock"),
    // interview room 1 (reachable) and 2 (locked)
    p("table", 12.5, 9.2, 2, 1.3, "#6b7a89", "Interview table (recorder)"), p("chair", 11.4, 9.5, 0.8, 0.8, "#2b3340"), p("chair", 14.8, 9.5, 0.8, 0.8, "#2b3340"),
    p("table", 12.5, 13.2, 2, 1.3, "#6b7a89"), p("chair", 11.4, 13.5, 0.8, 0.8, "#2b3340"), p("chair", 14.8, 13.5, 0.8, 0.8, "#2b3340"),
    // custody
    p("desk", 22, 6, 3.4, 1, "#3a4a5e", "Custody desk"), p("bench", 11, 6.9, 3, 0.7, "#6b7a89"),
    // cells
    p("bars", 10, 4.7, 16, 0.2, "#aab4c0", "Cell doors"), wallV(14, 0, 4.7), wallV(18, 0, 4.7), wallV(22, 0, 4.7),
    p("bed", 10.4, 0.5, 1, 2.3, "#6b7a89", "Bunk"), p("bed", 14.4, 0.5, 1, 2.3, "#6b7a89", "Bunk"), p("bed", 18.4, 0.5, 1, 2.3, "#6b7a89", "Bunk"), p("bed", 22.4, 0.5, 1, 2.3, "#6b7a89", "Bunk"),
    p("bath", 12.6, 0.4, 0.7, 0.8, "#c9c9c9", "Toilet"), p("bath", 16.6, 0.4, 0.7, 0.8, "#c9c9c9", "Toilet"), p("bath", 20.6, 0.4, 0.7, 0.8, "#c9c9c9", "Toilet"), p("bath", 24.6, 0.4, 0.7, 0.8, "#c9c9c9", "Toilet"),
    // evidence store
    p("shelf", 16.5, 8.5, 0.8, 7, "#4a5a6b", "Evidence lockers"), p("locker", 19, 8.5, 6.5, 1, "#4a5a6b", "Evidence lockers"), p("shelf", 19, 12, 3, 0.8, "#4a5a6b"), p("rack", 23, 12.5, 2.4, 1.6, "#ff7a1c", "Seized cones"),
  ],
  interactables: [
    { id: "counter", label: "Front counter", x: 4.4, y: 6.4, launch: "police", text: "The desk sergeant looks up. 'Yes?'" },
    { id: "cones", label: "Cone board", x: 4.5, y: 6.4, text: "A corkboard of polaroids. Cones on roofs, cones on statues, a cone in the Avon wearing sunglasses. 'SEIZED THIS MONTH: 47.'" },
    { id: "lockers", label: "Property lockers", x: 8.6, y: 13.3, text: "Found property. Currently holding: one umbrella, three jandals (all left feet) and a traffic cone, again." },
    { id: "notice", label: "Notice board", x: 1.6, y: 8.2, text: "Neighbourhood Support: lock your car, say hi to your neighbours, report suspicious cones. Non-emergency: 105." },
    { id: "interview", label: "Interview room", x: 13.5, y: 11.1, effect: "rest", text: "You sit in the plastic chair. The table has a ring on it from someone's very long cuppa." },
    { id: "bench", label: "Waiting bench", x: 4.5, y: 13.7, effect: "rest", text: "You wait. Somewhere a printer jams. It is the loudest thing in the world." },
  ],
  spots: [
    spot(2.6, 3.6, "work", "n"), spot(5.6, 3.6, "work", "n"), spot(8.3, 3.6, "work", "n"), spot(4.4, 4.2, "work", "s", "counter"), spot(24, 7.5, "work", "s"),
    spot(12, 6.0, "talk", "e"), spot(13.2, 8.7, "work", "s"),
    spot(4, 6.4, "queue", "n", "counter"), spot(4, 7.3, "queue", "n", "counter"), spot(4, 8.2, "queue", "n", "counter"),
    spot(3.3, 14.3, "sit", "n"), spot(4.7, 14.3, "sit", "n"), spot(5.9, 14.3, "sit", "n"), spot(1.5, 7.2, "phone", "s"), spot(5.5, 10.5, "stand", "e"),
    spot(11.8, 9.9, "sit", "e"), spot(15.2, 9.9, "sit", "w"), spot(12.8, 6.0, "stand", "s"),
    spot(11.5, 3.3, "sit", "s", "cell"), spot(15.5, 3.3, "sit", "s", "cell"), spot(19.5, 3.3, "sit", "s", "cell"), spot(23.5, 3.3, "sit", "s", "cell"),
  ],
  flavour: [
    "The foyer smells of floor polish and burnt toast. A framed poster asks you to report suspicious cones.",
    "Radio chatter from behind the counter: a cat on a roof in Riccarton, a very polite car chase, a missing pair of jandals.",
    "The cells are on show through a wall of bars. Nobody in them looks especially bothered, just hungry.",
  ],
};

// ------------------------------------------------------------------ BANK (Kiwibanc)
const bank: InteriorDef = {
  kind: "bank", title: "Kiwibanc branch", size: { w: 20, h: 14 }, door: { x: 1.5, y: 8.5 },
  light: "warm", ambience: ["marble-echo", "queue-murmur", "pen-on-chain", "air-con"], busy: 0.5, staff: { color: "#c6ff3d" },
  zones: [
    z("hall", "Banking hall", 0, 0, 14, 14, "marble", "#cfc6b4"),
    z("loans", "Loans office", 14, 5, 6, 9, "carpet", "#6a5a48"),
    z("vault", "Vault", 14, 0, 6, 5, "concrete", "#6c747c"),
  ],
  props: [
    wallV(14, 0, 8.5), wallV(14, 10.5, 14), wallH(5, 14, 16), wallH(5, 18, 20),
    p("counter", 4, 2.5, 9, 1, "#6a4a2a", "Teller line"), p("desk", 4.4, 1.2, 1.2, 0.8, "#3a3a48"), p("desk", 7.6, 1.2, 1.2, 0.8, "#3a3a48"), p("desk", 10.8, 1.2, 1.2, 0.8, "#3a3a48"),
    p("machine", 0.3, 1.2, 0.9, 0.9, "#2a3a4e", "ATM"), p("machine", 0.3, 2.5, 0.9, 0.9, "#2a3a4e", "ATM"),
    ...[[6, 5.4], [6, 7.2], [8, 5.4], [8, 7.2]].map(([x, y]) => p("stanchion", x, y, 0.3, 0.3, "#d4af37", "Queue post")),
    p("sofa", 2, 11, 2.6, 1, "#33252c", "Waiting sofa"), p("table", 5.5, 11.2, 1.4, 0.8, "#6a4a2a", "Brochures"), p("shelf", 8, 12.9, 3, 0.7, "#6a4a2a", "Brochure rack"),
    p("plant", 11.7, 10.6, 1, 1, "#3f8f4a"), p("plant", 0.4, 12.6, 1, 1, "#3f8f4a"), p("pillar", 12.3, 6, 0.8, 0.8, "#b9ad96"),
    p("vault", 15, 0.4, 4.5, 3.6, "#7a8794", "Time-locked vault"),
    p("desk", 15.5, 6.5, 3, 1.2, "#6a4a2a", "Loans desk"), p("chair", 16.5, 8, 0.8, 0.8, "#33252c"), p("chair", 17.8, 8, 0.8, 0.8, "#33252c"), p("plant", 18.7, 12.7, 0.9, 0.9, "#3f8f4a"),
    wp("sign", "n", 5, 7, "#c6ff3d", "Kiwibanc. Banking for a bit of a kiwi."), wp("board", "n", 0.7, 3, "#2a2a33", "Rates today"),
    wp("clock", "w", 3.4, 0.8, "#eee4d3", "Clock"), wp("poster", "w", 11, 1.6, "#f6b62c", "Beware of scams: if it sounds too good..."),
  ],
  interactables: [
    { id: "teller", label: "Teller", x: 8.5, y: 4.2, text: "Teller: 'Deposit or withdrawal? Both is allowed. Neither is called loitering.'" },
    { id: "atm", label: "ATM", x: 2, y: 2, text: "ATM: 'Balance: not enough. Would you like to see a less rude number?'" },
    { id: "loans", label: "Loans desk", x: 16.5, y: 9.4, text: "A lanyarded adviser: 'A flat white and a plan? We can do the plan.'" },
    { id: "vault", label: "Vault", x: 17, y: 4.4, text: "A round steel door with a timer. Opens at nine. The sign says 'Please do not lick the vault'." },
    { id: "brochure", label: "Brochures", x: 8.5, y: 12.2, text: "KiwiSaver, term deposits, 'Your first home' with a very small house." },
  ],
  spots: [
    spot(5, 2.2, "work", "s"), spot(8.2, 2.2, "work", "s"), spot(11.4, 2.2, "work", "s"), spot(17, 6.0, "work", "s"),
    spot(6.2, 4.3, "queue", "n", "teller"), spot(6.2, 5.9, "queue", "n", "teller"), spot(8.2, 5.9, "queue", "n", "teller"), spot(8.2, 4.3, "queue", "n", "teller"),
    spot(2, 4.2, "queue", "w", "atm"), spot(3, 12.2, "sit", "s"), spot(4.2, 12.3, "sit", "s"), spot(6, 10.3, "phone", "e"), spot(10, 9.5, "stand", "e"),
    spot(17.3, 9.2, "sit", "s"),
  ],
  flavour: [
    "Cool marble, a brass pen on a very short chain, and a queue that has learned acceptance.",
    "A wall display of term-deposit rates is lit like a museum exhibit. The vault door is in the corner, calmly being a vault.",
    "Someone is arguing politely with an ATM. The ATM is winning.",
  ],
};

// ------------------------------------------------------------------ OFFICE
const office: InteriorDef = {
  kind: "office", title: "Open-plan office", size: { w: 22, h: 14 }, door: { x: 1.5, y: 7.5 },
  light: "cool", ambience: ["keyboards", "air-con", "printer", "phone-ring"], busy: 0.6, staff: { color: "#9ad0ff" },
  zones: [
    z("lobby", "Reception & lobby", 0, 0, 7, 14, "carpet", "#4a5068"),
    z("floor", "Open-plan floor", 7, 0, 15, 9, "carpet", "#5a6078"),
    z("kitchen", "Kitchenette", 7, 9, 7, 5, "lino", "#b0b8bf"),
    z("meeting", "Meeting room", 14, 9, 8, 5, "carpet", "#4a5068"),
  ],
  props: [
    wallV(7, 0, 6.5), wallV(7, 8.5, 14), wallH(9, 7, 9), wallH(9, 11.5, 14), wallV(14, 9, 11), wallV(14, 13, 14), wallH(9, 14, 17), wallH(9, 19.5, 22),
    p("counter", 1, 2, 4, 1, "#8a7a68", "Reception"), p("sofa", 1, 11.5, 3, 1, "#2a3a4e"), p("table", 4.4, 11.6, 1.2, 0.8, "#8a7a68", "Magazines"), p("plant", 5.7, 0.5, 1, 1, "#3f8f4a"), p("plant", 0.4, 12.9, 0.9, 0.9, "#3f8f4a"),
    ...[8.5, 12.5, 16.5].flatMap((x) => [1.2, 5].flatMap((y) => [p("desk", x, y, 2.6, 1.1, "#8a7a68", "Desk"), p("chair", x + 0.9, y + 1.3, 0.8, 0.8, "#2a3a4e")])),
    p("machine", 20.4, 1.4, 1, 1, "#9aa6ad", "Printer"), p("machine", 20.4, 3.6, 0.8, 0.8, "#3dd6ff", "Water cooler"), p("shelf", 20.2, 6, 1.4, 0.8, "#8a7a68", "Filing"),
    p("counter", 7.4, 12.6, 5, 0.9, "#8a7a68", "Kitchen bench"), p("fridge", 12.3, 9.4, 1.2, 1, "#d8d8d8", "Fridge"), p("machine", 8, 12.4, 0.5, 0.4, "#c9c9c9", "Jug"), p("table", 8.2, 10.1, 2.2, 1.2, "#8a7a68", "Lunch table"),
    p("table", 16.5, 10.6, 4, 1.8, "#8a7a68", "Meeting table"), ...row("chair", 4, 16.7, 10, 1, 0, 0.8, 0.5, "#2a3a4e"), ...row("chair", 4, 16.7, 12.5, 1, 0, 0.8, 0.5, "#2a3a4e"),
    wp("board", "n", 8, 4, "#eee4d3", "Whiteboard: Q3 priorities (circled twice)"), wp("screen", "n", 14, 3, "#2a3a4e", "Dashboard"),
    wp("sign", "n", 1, 4, "#3dd6ff", "Welcome. Please sign in."), wp("clock", "w", 3.7, 0.8, "#eee4d3", "Clock"), wp("poster", "w", 10.5, 1.6, "#ec2a1c", "Evacuation plan: Assembly Point A"),
  ],
  interactables: [
    { id: "reception", label: "Reception", x: 3, y: 3.5, text: "Receptionist: 'Do you have a meeting? Of course you do. Everyone has a meeting.'" },
    { id: "desk", label: "Hot desk", x: 9.8, y: 4.1, effect: "rest", text: "You sit at a stranger's desk. Their screensaver is a photo of a very smug cat." },
    { id: "kitchen", label: "Kitchenette", x: 9, y: 11.8, effect: "cuppa", text: "A sign says: 'Wash your own mug.' Nobody has, ever. You make a cuppa anyway." },
    { id: "meeting", label: "Meeting room", x: 18.5, y: 9.5, text: "Whiteboard still says 'SYNERGY ???'. Someone has drawn a small, brave kiwi next to it." },
    { id: "printer", label: "Printer", x: 19.6, y: 2.4, text: "PC LOAD LETTER. In Christchurch, in 2026. Somewhere a printer is thinking about its choices." },
  ],
  spots: [
    spot(2.8, 1.3, "work", "s"), spot(9.8, 2.9, "sit", "n"), spot(13.8, 2.9, "sit", "n"), spot(9.8, 6.7, "sit", "n"), spot(17.8, 6.7, "sit", "n"), spot(17.8, 2.9, "sit", "n"), spot(13.8, 6.7, "sit", "n"),
    spot(2.5, 3.8, "queue", "n", "reception"), spot(1.5, 12.8, "sit", "s"), spot(3, 12.8, "phone", "s"), spot(20.5, 2.9, "talk", "w"),
    spot(9.5, 10.7, "sit", "s"), spot(11, 11.2, "talk", "n"), spot(17.1, 10.4, "sit", "s"), spot(19.1, 10.4, "sit", "s"), spot(17.1, 13.2, "sit", "n"), spot(19.1, 13.2, "sit", "n"),
  ],
  flavour: [
    "Quiet keyboards, a ficus that has outlived three managers, and a whiteboard of increasingly optimistic circles.",
    "The kitchenette fridge has a passive-aggressive note about yoghurt. The note has a second, ruder note.",
    "Out the window the Port Hills sit there looking calm, which is more than the Monday inbox can say.",
  ],
};

// ------------------------------------------------------------------ APARTMENTS (lobby)
const apartments: InteriorDef = {
  kind: "apartments", title: "Apartment lobby", size: { w: 18, h: 12 }, door: { x: 1.5, y: 6.5 },
  light: "warm", ambience: ["lift-hum", "distant-tv", "mail-flap", "footsteps"], busy: 0.35, staff: { color: "#b48cff" },
  zones: [
    z("lobby", "Lobby", 0, 0, 10, 12, "tile", "#8a7e6e"),
    z("hall", "Corridor to flats", 10, 0, 8, 12, "carpet", "#4a3f4f"),
  ],
  props: [
    wallV(10, 0, 4.5), wallV(10, 8.5, 12),
    p("locker", 2, 0.2, 5, 0.7, "#8a8f96", "Letterboxes"), p("locker", 7.3, 0.2, 1.2, 0.7, "#9aa6ad", "Intercom"),
    p("lift", 11, 0.2, 3, 0.9, "#9aa6ad", "Lift"), p("stairs", 14.6, 0.2, 3, 1.2, "#6b6b73", "Stairs"),
    p("plant", 0.4, 0.4, 1, 1, "#3f8f4a"), p("plant", 8.6, 10.6, 1, 1, "#3f8f4a"), p("rack", 0.4, 9.5, 1.4, 2.2, "#2a2a33", "Bike rack"),
    p("table", 5.5, 9.6, 2.4, 1, "#8a6a40", "Parcels"), p("bench", 3, 10.8, 2, 0.6, "#8a6a40"),
    p("mat", 3.5, 5.4, 3, 2.4, "#ec2a1c", "Welcome"),
    ...[0, 1, 2, 3].map((i) => p("mat", 11 + i * 1.7, 11.0, 1.2, 0.9, "#3a3a48", `Flat ${i + 1}`)),
    p("cabinet", 16.8, 8, 0.8, 1.4, "#9a3a2a", "Fire hose reel"),
    wp("board", "n", 9, 1.2, "#d6c7a1", "Flat meeting: Thursday"), wp("poster", "w", 2.2, 1.4, "#f6b62c", "Please don't prop the fire door"),
    wp("sign", "n", 2, 5, "#eee4d3", "Avon Apartments"), wp("clock", "w", 9, 0.8, "#eee4d3", "Clock"),
  ],
  interactables: [
    { id: "mail", label: "Letterboxes", x: 4.5, y: 1.9, text: "A drift of takeaway menus and one letter addressed to 'The Occupier, again'." },
    { id: "lift", label: "Lift", x: 12.5, y: 2.2, text: "The lift is out of order. Again. A note says it is 'resting'." },
    { id: "stairs", label: "Stairs", x: 16.2, y: 2.4, text: "Eleven flights, no lights, one very confident possum." },
    { id: "board", label: "Notice board", x: 8.5, y: 2.2, text: "'Flat meeting Thursday. Bring snacks. Bring grievances.' Item 1: the bins." },
    { id: "parcels", label: "Parcels", x: 6.7, y: 8.6, text: "Three parcels for someone called Ngaire in Flat 7. One has been there since July." },
  ],
  spots: [
    spot(4.6, 8.9, "work", "e"), spot(5.5, 4.5, "stand", "n"), spot(4, 3, "phone", "n"), spot(12.5, 3.2, "queue", "n", "lift"), spot(13.4, 3.2, "queue", "n", "lift"), spot(8, 7, "talk", "e"), spot(14, 7, "talk", "w"),
    spot(3.8, 10.3, "sit", "s"), spot(12, 9, "stand", "s"),
  ],
  flavour: [
    "A tiled lobby with a pot plant that has seen things and a letterbox wall bulging with takeaway menus.",
    "Somewhere upstairs a bass line is being played at exactly the wrong hour. The lift hums, apologetically, out of order.",
    "The corridor smells of curry and fabric softener. Every door has a different doormat and a different story.",
  ],
};

// ------------------------------------------------------------------ HOUSE (a Christchurch weatherboard)
const house: InteriorDef = {
  kind: "house", title: "A Christchurch villa", size: { w: 18, h: 12 }, door: { x: 1.5, y: 6.5 },
  light: "warm", ambience: ["kettle", "heat-pump", "radio", "distant-lawnmower"], busy: 0.3, staff: { color: "#ffb84d" },
  zones: [
    z("hall", "Hallway", 0, 0, 4, 12, "wood", "#9a7650"),
    z("lounge", "Lounge", 4, 0, 7, 7, "carpet", "#8f6f58"),
    z("kitchen", "Kitchen & dining", 11, 0, 7, 7, "lino", "#c9bfa5"),
    z("bedroom", "Bedroom", 4, 7, 7, 5, "carpet", "#7d6a7f"),
    z("bathroom", "Bathroom", 11, 7, 3, 5, "tile", "#b9d0d8"),
    z("laundry", "Laundry", 14, 7, 4, 5, "lino", "#b7b3a0"),
  ],
  props: [
    wallV(4, 0, 2.5), wallV(4, 4.5, 8.5), wallV(4, 10.5, 12), wallH(7, 4, 18), wallV(11, 0, 2), wallV(11, 5, 7), wallV(11, 7, 8.2), wallV(11, 10, 12), wallV(14, 7, 8.2), wallV(14, 10, 12),
    // hall
    p("rack", 0.4, 8.6, 1.8, 0.7, "#6b4a2a", "Shoe rack (jandals)"), p("cabinet", 0.4, 0.4, 1, 1.4, "#6b4a2a", "Coats"), p("mat", 0.4, 5.2, 2.2, 2.6, "#ec2a1c", "Welcome mat"),
    wp("poster", "w", 2.5, 1.2, "#eee4d3", "Family photo"), wp("clock", "w", 9.5, 0.8, "#eee4d3", "Clock"),
    // lounge
    p("rug", 5.2, 2.2, 4.6, 3.4, "#7a3a3a", "Rug"), p("sofa", 5.4, 5.6, 3.6, 1, "#4a5a4a", "Couch"), p("table", 6.2, 3.4, 1.8, 1, "#6b4a2a", "Coffee table"), p("sofa", 4.4, 2.4, 0.9, 1.6, "#4a5a4a"),
    p("cabinet", 5.5, 0.3, 3, 0.8, "#6b4a2a", "TV unit"), p("machine", 9.2, 0.3, 1.4, 1, "#c55a1c", "Wood burner"), p("lamp", 4.5, 6.2, 0.4, 0.4, "#f6e8a8"),
    wp("screen", "n", 5.6, 2.6, "#10202c", "TV"), wp("vent", "n", 8.5, 0.9, "#eeeeee", "Heat pump"),
    // kitchen
    p("counter", 11.4, 0.3, 4.6, 0.9, "#c9b48f", "Bench"), p("fridge", 16.2, 0.3, 1.2, 1, "#d8d8d8", "Fridge"), p("counter", 17.1, 1.4, 0.7, 2.6, "#c9b48f", "Stove"),
    p("table", 12.6, 3.4, 2.6, 1.6, "#8a6a40", "Dining table"), ...row("chair", 3, 12.8, 2.7, 0.9, 0, 0.7, 0.6, "#6b4a2a"), ...row("chair", 3, 12.8, 5.1, 0.9, 0, 0.7, 0.6, "#6b4a2a"),
    p("machine", 14.2, 0.2, 0.5, 0.5, "#c9c9c9", "Jug"),
    wp("window", "n", 12, 2.4, "#9fd8ff", "Window over the sink"), wp("board", "n", 15.2, 0.8, "#eee4d3", "Fridge magnets"),
    // bedroom
    p("bed", 5.2, 8.2, 2.6, 2.1, "#7d5a8a", "Double bed"), p("cabinet", 8.4, 7.4, 1.6, 0.8, "#6b4a2a", "Wardrobe"), p("cabinet", 4.4, 8.2, 0.7, 0.8, "#6b4a2a", "Bedside"), p("desk", 8.6, 10.6, 1.8, 0.9, "#6b4a2a", "Desk"),
    // bathroom
    p("bath", 11.4, 10.6, 2.4, 1, "#e8e8e8", "Bath"), p("bath", 12.6, 8.5, 0.7, 0.8, "#e8e8e8", "Toilet"),
    // laundry
    p("machine", 14.3, 7.4, 1, 1, "#d8d8d8", "Washing machine"), p("cabinet", 16.2, 7.4, 1.4, 1.4, "#c9a07a", "Hot water cylinder"),
  ],
  interactables: [
    { id: "couch", label: "Couch", x: 7.2, y: 4.9, effect: "rest", text: "You sink into the couch. The dog (not yours) approves." },
    { id: "kettle", label: "Kettle", x: 14.3, y: 1.8, effect: "cuppa", text: "Jug on. Tea, with the good biscuits you were saving." },
    { id: "bed", label: "Bed", x: 6.5, y: 10.8, effect: "rest", text: "A neatly made bed with a hot-water bottle, which is the only reasonable thing at 3 degrees." },
    { id: "fridge", label: "Fridge", x: 16.7, y: 2.1, text: "Half a block of cheese, a jar of mystery chutney, and a note: 'Do NOT eat the lamb. It's for Sunday.'" },
    { id: "tv", label: "TV", x: 7, y: 2.2, text: "The rugby is on. Both teams are losing, somehow." },
  ],
  spots: [
    spot(7.2, 5.2, "sit", "n"), spot(5.6, 5.2, "sit", "n"), spot(4.8, 3.2, "sit", "e"), spot(7.5, 2.1, "stand", "s"), spot(14.5, 1.9, "work", "n"),
    spot(13.1, 3.1, "sit", "s"), spot(14.0, 3.1, "sit", "s"), spot(1.3, 9.5, "stand", "e"), spot(6.4, 10.9, "lie", "s", "bed"),
  ],
  flavour: [
    "A weatherboard villa, shoes at the door, jandals in a row. The heat pump ticks as it works against a Canterbury winter.",
    "The kitchen has a jug, a good knife and a calendar from the local vet. A woodburner glows in the corner.",
    "There is always one more cup of tea in this house.",
  ],
};

// ------------------------------------------------------------------ HOTEL
const hotel: InteriorDef = {
  kind: "hotel", title: "The Crowned Plaza", size: { w: 26, h: 16 }, door: { x: 1.5, y: 8.5 },
  light: "warm", ambience: ["lift-chime", "luggage-wheels", "piano", "murmur"], busy: 0.55, staff: { color: "#f6b62c" },
  zones: [
    z("lobby", "Lobby & reception", 0, 0, 12, 10, "marble", "#cfc6b4"),
    z("bar", "Lobby bar", 0, 10, 12, 6, "wood", "#6a4a2a"),
    z("lifts", "Lift lobby", 12, 0, 6, 10, "carpet", "#7a2a3a"),
    z("corridor", "Guest corridor", 18, 0, 8, 6, "carpet", "#7a2a3a"),
    z("room", "Room 412", 12, 10, 14, 6, "carpet", "#5a4a68"),
  ],
  props: [
    wallV(12, 0, 4), wallV(12, 6, 9.5), wallH(10, 12, 14), wallH(10, 17, 26), wallH(10, 0, 5), wallH(10, 8, 12), wallV(18, 0, 3),
    p("counter", 3, 1.2, 6.5, 1, "#3a2c22", "Reception"), p("machine", 3.4, 0.4, 0.5, 0.5, "#223", "Terminal"), p("machine", 7.4, 0.4, 0.5, 0.5, "#223", "Terminal"),
    p("rug", 3.5, 4.5, 5, 4, "#7a2a3a", "Lobby rug"), p("sofa", 4, 4.7, 3.6, 1.1, "#2a3a4e"), p("table", 4.6, 6.6, 1.8, 1.2, "#f6b62c", "Coffee table"), p("sofa", 4, 8.2, 3.6, 1.1, "#2a3a4e"),
    p("trolley", 1.4, 4.2, 1.2, 0.9, "#d4af37", "Luggage trolley"), p("plant", 0.4, 0.4, 1.1, 1.1, "#3f8f4a"), p("plant", 10.5, 0.4, 1.1, 1.1, "#3f8f4a"), p("pillar", 10, 5, 0.8, 0.8, "#b9ad96"),
    p("lift", 12.6, 0.2, 2.6, 0.9, "#9aa6ad", "Lift A"), p("lift", 15.4, 0.2, 2.6, 0.9, "#9aa6ad", "Lift B"), p("table", 14, 7.5, 1.4, 1.4, "#d4af37", "Flower table"),
    p("counter", 1, 11.2, 0.9, 4.2, "#3a2c22", "Bar"), ...row("chair", 4, 2.4, 11.4, 0, 1, 0.7, 0.7, "#ec2a1c", "Bar stools"), p("table", 5.5, 13.5, 1.5, 1.5, "#3a2c22"), p("table", 8.5, 13.5, 1.5, 1.5, "#3a2c22"),
    p("bed", 15.2, 12, 3.4, 2.7, "#eee4d3", "King bed"), p("cabinet", 14, 12.2, 1, 0.8, "#6a4a2a", "Bedside"), p("desk", 20.8, 10.4, 2.2, 0.9, "#6a4a2a", "Desk"), p("fridge", 24.2, 10.4, 0.9, 0.9, "#222", "Minibar"),
    p("table", 22.2, 13.8, 1.6, 1, "#6a4a2a", "Armchair table"), p("chair", 20.6, 13.8, 1.1, 1.1, "#2a3a4e", "Armchair"),
    wp("sign", "n", 3.8, 4.5, "#f6b62c", "The Crowned Plaza"), wp("clock", "n", 9.5, 0.7, "#eee4d3", "Clock"), wp("screen", "n", 18.4, 2, "#2a3a4e", "Events: Wedding, Rotary"),
    wp("window", "w", 1.2, 2.2, "#9fd8ff", "Window"), wp("poster", "w", 12, 1.6, "#f6b62c", "Breakfast 6:30-10"),
  ],
  interactables: [
    { id: "reception", label: "Reception", x: 6.2, y: 3.2, text: "Concierge: 'Welcome! I have a room with a view of... a different hotel.'" },
    { id: "lift", label: "Lifts", x: 14.2, y: 2.2, text: "Ding. Going up. The lift music is a saxophone covering a song you can't name." },
    { id: "bar", label: "Lobby bar", x: 3.9, y: 12.9, effect: "cuppa", text: "Bartender slides you a flat white at the bar. 'Fancy hotel, strong espresso.'" },
    { id: "bed", label: "Room 412 bed", x: 17, y: 11.3, effect: "rest", text: "A king bed with seven pillows. One of them is purely decorative and you will never be forgiven." },
    { id: "minibar", label: "Minibar", x: 23.5, y: 12.2, text: "A $9 packet of peanuts. A $14 bottle of water. You close the door slowly." },
  ],
  spots: [
    spot(5, 2.5, "work", "s"), spot(8, 2.5, "work", "s"), spot(0.55, 12.5, "work", "e"), spot(1.9, 5.6, "work", "s"),
    spot(4.5, 3.6, "queue", "n", "reception"), spot(5.7, 3.6, "queue", "n", "reception"), spot(5.4, 5.9, "sit", "s"), spot(6.4, 5.9, "sit", "s"), spot(5.2, 9.6, "sit", "n"),
    spot(2.75, 11.75, "sit", "w"), spot(2.75, 12.75, "sit", "w"), spot(6.1, 13, "sit", "e"), spot(9.3, 13, "sit", "w"), spot(14, 3.5, "queue", "n", "lift"), spot(15.5, 3.5, "queue", "n", "lift"),
    spot(16.9, 13.3, "lie", "s", "bed"), spot(21.6, 11.5, "sit", "n"), spot(7.5, 7, "phone", "w"),
  ],
  flavour: [
    "A lobby built to say 'we have a chandelier' with its whole chest. A bellhop is losing a quiet battle with a trolley.",
    "Marble, brass and a piano playing something that would be called 'jazz' by a committee.",
    "Room 412 has a view of a different hotel. The minibar has a view of your wallet.",
  ],
};

// ------------------------------------------------------------------ FALLBACK (generic shopfront, until a kind gets its own plan)
const fallback: InteriorDef = {
  kind: "fallback", title: "Inside", size: { w: 14, h: 10 }, door: { x: 1.5, y: 6.5 },
  light: "warm", ambience: ["shop-bell", "radio", "murmur"], busy: 0.4, staff: { color: "#eee4d3" },
  zones: [z("shop", "Shopfloor", 0, 0, 14, 10, "wood", "#7a6048")],
  props: [
    p("counter", 5, 2, 6, 1, "#4a3a2e", "Counter"), p("shelf", 1.5, 0.2, 3, 0.7, "#6b4a2a", "Shelves"), p("shelf", 11.8, 0.2, 2, 0.7, "#6b4a2a", "Shelves"),
    p("table", 3, 5, 2.4, 1.2, "#6b4a2a", "Display"), p("table", 8, 6, 2.4, 1.2, "#6b4a2a", "Display"), p("shelf", 0.2, 2.5, 0.7, 3, "#6b4a2a", "Shelves"), p("plant", 12.4, 8, 1, 1, "#3f8f4a"),
    p("mat", 0.4, 5.8, 2, 1.6, "#ec2a1c", "Welcome"), wp("sign", "n", 5, 4, "#f6b62c", "Open"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock"),
  ],
  interactables: [{ id: "counter", label: "Counter", x: 8, y: 3.5, launch: "legacy", text: "Hello there. What can I get you?" }],
  spots: [spot(6.5, 1.4, "work", "s"), spot(8.5, 1.4, "work", "s"), spot(7.5, 3.6, "queue", "n", "counter"), spot(7.5, 4.5, "queue", "n", "counter"), spot(4.2, 7, "browse", "n"), spot(9.2, 8, "browse", "n"), spot(2.2, 4.5, "browse", "w")],
  flavour: ["A bell over the door, a radio on low, and the smell of someone's lunch.", "Shelves, a counter and a person who has seen it all."],
};

// ------------------------------------------------------------------ RECYCLING CENTRE (cans and bottles for cash)
const recycling: InteriorDef = {
  kind: "recycling", title: "Avon Recycling Centre", size: { w: 14, h: 10 }, door: { x: 1.5, y: 6.5 },
  light: "cool", ambience: ["clatter", "radio", "murmur"], busy: 0.35, staff: { color: "#6fe3b0", hat: "cap" },
  zones: [z("depot", "Sorting floor", 0, 0, 14, 10, "concrete", "#8a9088")],
  props: [
    p("counter", 5, 2, 6, 1, "#3a4a32", "Weigh-in counter"), p("machine", 11.6, 1.2, 1.6, 1.2, "#6fe3b0", "Reverse vending machine"),
    p("bin", 0.4, 0.4, 1.4, 1.2, "#2d6b24", "Glass"), p("bin", 2, 0.4, 1.4, 1.2, "#c4453a", "Cans"), p("bin", 3.6, 0.4, 1.4, 1.2, "#5a8fc4", "Paper"),
    p("rack", 0.4, 3.2, 1, 3, "#6b6b60", "Crates"), p("rack", 11.8, 4, 1.4, 3.4, "#6b6b60", "Pallets"), p("table", 5, 6, 3.4, 1.4, "#58604f", "Sorting bench"),
    p("mat", 0.4, 5.8, 2, 1.6, "#2d6b24", "Welcome"), wp("sign", "n", 5, 4, "#6fe3b0", "Cash for cans"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock"),
  ],
  interactables: [
    { id: "counter", label: "Weigh-in counter", x: 8, y: 3.5, launch: "legacy", text: "Tip your sack on the scale. Cans ten cents, bottles twenty. A big haul earns a tidy-up bonus." },
    { id: "rvm", label: "Return machine", x: 12.4, y: 3, launch: "legacy", text: "The machine hums, hungry for cans." },
  ],
  spots: [spot(6.5, 1.4, "work", "s"), spot(8.5, 1.4, "work", "s"), spot(7.5, 3.6, "queue", "n", "counter"), spot(7.5, 4.5, "queue", "n", "counter"), spot(4.2, 8, "browse", "n"), spot(10, 8, "stand", "n")],
  flavour: ["Glass clinks somewhere in the back. The whole place smells faintly of old beer and wet cardboard.", "A tidy sign above the counter: \"Every can counts.\""],
};

/** Hand-built plans by kind. Anything missing resolves to FALLBACK (see header for who is missing). */
export const INTERIORS: Partial<Record<BuildingKind, InteriorDef>> = { hospital, mentalhealth, police, bank, office, apartments, house, hotel, recycling, ...SHOP_INTERIORS };
export const FALLBACK: InteriorDef = fallback;
export function interiorFor(kind: BuildingKind): InteriorDef { return INTERIORS[kind] ?? FALLBACK; }
export function hasOwnInterior(kind: BuildingKind): boolean { return !!INTERIORS[kind]; }
