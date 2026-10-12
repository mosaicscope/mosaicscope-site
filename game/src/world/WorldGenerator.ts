import { Rng } from "../core/rng";
import { World, T, Area, AreaKind, PoiKind, SOLID, DECOR, PERIOD, ROAD_W, SIDEWALK_W, CROSS_W } from "./World";
import { BUILDINGS, BuildingKind, GROUND_H, FLOOR_H } from "../content/buildings";

/**
 * Seeded city generator. A road grid (four lanes, two each way, left-hand traffic) divides the map
 * into 8x8 blocks, each with a two-tile sidewalk ring around a 12x12 interior. Blocks are zoned (plaza, MosaicScope studio, casino, food street, shops,
 * police, homes, offices...) and filled with buildings, open spaces and street furniture. Afterwards
 * connectivity is validated and anything that would cut an area off is removed.
 */
export interface GenOptions { size: number; seed: number }

type Plan = "houses" | "apartments" | "playground" | "office" | "bank" | "hotel" | "dealership" | "park" | "market" | "mosaicscope" | "stage" | "court"
  | "police" | "plaza" | "food" | "food2" | "shops" | "shops2" | "alley" | "casino" | "hospital" | "garage" | "river" | "airport"
  | "stripclub" | "velvet" | "zoo";

/**
 * Central Christchurch inside the Four Avenues, on the game's 8x8 block grid. Streets keep their
 * real order (west to east: Deans Ave ... Madras St; north to south: Bealey Ave ... Moorhouse Ave)
 * and landmarks sit in the block they really occupy: Hagley Park and the Botanic Gardens to the
 * west, the hospital at Hagley's south-east corner, Cathedral Square on Colombo St between Worcester
 * and Hereford, Victoria Square and the Avon, the casino on Victoria St, Cashel Mall, the Riverside
 * Market, the car yards on Moorhouse Ave, the central police station on the south side and the
 * SALT District laneways. Source: OpenStreetMap (c) OpenStreetMap contributors, ODbL; simplified to
 * the grid. The airport (really 10 km north-west) is pulled in as the north-west block.
 */
export const STREETS_X = ["Deans Ave", "Rolleston Ave", "Montreal St", "Durham St", "Colombo St", "Manchester St", "Madras St", "Barbadoes St", "Fitzgerald Ave"];
export const STREETS_Y = ["Bealey Ave", "Salisbury St", "Kilmore St", "Armagh St", "Worcester St", "Hereford St", "Cashel St", "Tuam St", "Moorhouse Ave"];

const PLAN: Plan[][] = [
  ["airport", "houses", "apartments", "food2", "houses", "apartments", "houses", "houses"],
  ["park", "houses", "casino", "stage", "office", "apartments", "river", "houses"],
  ["zoo", "court", "apartments", "river", "office", "playground", "houses", "apartments"],
  ["park", "velvet", "hotel", "bank", "food", "apartments", "houses", "houses"],
  ["river", "mosaicscope", "food", "plaza", "office", "shops2", "park", "houses"],
  ["hospital", "houses", "market", "shops", "food", "apartments", "apartments", "houses"],
  ["houses", "apartments", "dealership", "alley", "shops", "stripclub", "apartments", "houses"],
  ["houses", "dealership", "garage", "police", "alley", "office", "houses", "houses"],
];
const NAMES: string[][] = [
  ["Christchurch Airport", "Bealey Ave", "Salisbury Flats", "Victoria St", "Peterborough St", "Salisbury Lofts", "Barbadoes St", "Fitzgerald Ave"],
  ["Hagley Park North", "Park Terrace", "The Tessera Casino", "Town Hall", "Kilmore Offices", "Kilmore Apartments", "Avon Loop", "Dallington Edge"],
  ["Velvet Zoo", "Cranmer Square", "Montreal Apartments", "Victoria Square", "Te Pae", "Margaret Mahy Playground", "Madras St", "Barbadoes Apartments"],
  ["Botanic Gardens", "The Velvet Rooms", "Worcester Boulevard", "Gloucester Bank Corner", "New Regent St", "Gloucester Apartments", "Gloucester St", "Fitzgerald Homes"],
  ["Hagley Park South", "Arts Centre", "The Terrace", "Cathedral Square", "Hereford Offices", "High St", "Latimer Square", "Hereford St East"],
  ["Christchurch Hospital", "Antigua St", "Riverside Market", "Cashel Mall", "Eat Street", "Lichfield Apartments", "St Asaph Lofts", "Phillipstown North"],
  ["Addington", "Hagley Ave Flats", "Moorhouse Motors", "SALT District", "Tuam St Shops", "The Pink Pukeko", "St Asaph Apartments", "Waltham"],
  ["Sydenham", "Moorhouse Car Yards", "Moorhouse Fuel", "Central Police Station", "Tuam Laneways", "Moorhouse Offices", "Phillipstown", "Linwood"],
];

const AREA_KIND: Record<Plan, AreaKind> = {
  houses: "residential", apartments: "residential", playground: "playground", office: "office", bank: "office", hotel: "office", dealership: "dealership",
  park: "park", market: "market", mosaicscope: "studio", stage: "stage", court: "court", police: "police", plaza: "plaza", food: "food", food2: "food",
  shops: "shops", shops2: "shops", alley: "alley", casino: "casino", hospital: "hospital", garage: "shops", river: "park", airport: "airport",
  stripclub: "nightlife", velvet: "nightlife", zoo: "park",
};

export function generateWorld(opts: GenOptions): World {
  const P = PERIOD, BLOCKS = PLAN.length;
  const S = BLOCKS * P + ROAD_W; // 164: roads on every side
  const rng = new Rng(opts.seed);
  const w = new World(S);
  const idx = (x: number, y: number) => y * S + x;
  const set = (x: number, y: number, t: number) => { if (w.inBounds(x, y)) w.tiles[idx(x, y)] = t; };
  const fill = (x0: number, y0: number, x1: number, y1: number, t: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const poi = (kind: PoiKind, x: number, y: number, area: Area, extra: Partial<{ building: number; menu: string[]; name: string; dir: number }> = {}) =>
    w.pois.push({ id: w.pois.length, kind, x: x + 0.5, y: y + 0.5, area: area.id, on: kind === "lamp", ...extra });

  // --- streets: every road and sidewalk tile belongs to area 0
  const street: Area = { id: 0, name: "The Streets", kind: "street", x0: 0, y0: 0, x1: S - 1, y1: S - 1, cx: S / 2, cy: S / 2 };
  w.areas.push(street);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const rx = w.isRoadLine(x), ry = w.isRoadLine(y);
    if (rx || ry) {
      // zebra crossings on each arm of every intersection, in line with the sidewalks
      const mx = x % P, my = y % P;
      const nearX = (m: number) => m >= ROAD_W && m < ROAD_W + CROSS_W || m >= P - CROSS_W;
      const cross = (rx && !ry && nearX(my)) || (ry && !rx && nearX(mx));
      set(x, y, cross ? T.CROSSWALK : T.ROAD);
    } else set(x, y, T.SIDEWALK);
  }

  // --- blocks
  const usedNames = new Set<string>();
  // Christchurch street names give second branches a real-sounding name ("Hereford Superette")
  const STREETS = ["Hereford", "Worcester", "Gloucester", "Armagh", "Kilmore", "Salisbury", "Cashel", "Lichfield", "Tuam", "St Asaph", "Colombo", "Manchester", "Madras", "Durham", "Victoria", "Riccarton", "Papanui", "Lincoln", "Ferry", "Sumner"];
  w.streetsX = STREETS_X; w.streetsY = STREETS_Y;
  const nameFor = (k: BuildingKind) => {
    const opts = BUILDINGS[k].names.filter((n) => !usedNames.has(n));
    let n = opts.length ? rng.pick(opts) : "";
    for (let i = 0; !n && i < 40; i++) { const st = rng.pick(STREETS), base = rng.pick(BUILDINGS[k].names).replace(/^The /, ""); const c = `${st} ${base}`; if (!usedNames.has(c) && !base.includes(st)) n = c; }
    if (!n) n = `${rng.pick(BUILDINGS[k].names)} on ${rng.pick(STREETS)}`;
    usedNames.add(n);
    return n;
  };

  const building = (kind: BuildingKind, x0: number, y0: number, x1: number, y1: number, area: Area, face?: "n" | "s" | "e" | "w") => {
    const def = BUILDINGS[kind];
    const floors = rng.int(def.floors[0], def.floors[1]);
    const id = w.buildings.length;
    // door on the side facing the closest block edge (or the requested face)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const dists = { n: y0 - area.y0, s: area.y1 - y1, w: x0 - area.x0, e: area.x1 - x1 } as const;
    const f = face ?? (Object.entries(dists).sort((a, b) => a[1] - b[1])[0][0] as "n" | "s" | "e" | "w");
    const door = f === "s" ? { x: Math.floor(cx), y: y1 + 1 } : f === "n" ? { x: Math.floor(cx), y: y0 - 1 } : f === "e" ? { x: x1 + 1, y: Math.floor(cy) } : { x: x0 - 1, y: Math.floor(cy) };
    w.buildings.push({
      id, kind, name: kind === "house" ? `${rng.int(1, 240)} ${rng.pick(["Hereford", "Worcester", "Gloucester", "Armagh", "Kilmore", "Salisbury", "Peterborough", "Durham", "Madras", "Barbadoes"])} St` : nameFor(kind),
      x0, y0, x1, y1, floors, height: GROUND_H + (floors - 1) * FLOOR_H, color: rng.pick(def.colors), roof: def.roof, sign: def.sign,
      door: { ...door, face: f }, area: area.id, billboard: floors >= 3 && rng.chance(0.35),
    });
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { set(x, y, T.BUILDING); w.buildingOf[idx(x, y)] = id; }
    if (w.tile(door.x, door.y) === T.BUILDING || SOLID.has(w.tile(door.x, door.y))) set(door.x, door.y, T.PAVE);
    poi("door", door.x, door.y, area, { building: id, name: w.buildings[id].name, menu: def.menu });
    return w.buildings[id];
  };

  for (let by = 0; by < BLOCKS; by++) for (let bx = 0; bx < BLOCKS; bx++) {
    const plan = PLAN[by][bx];
    const SW = SIDEWALK_W;
    const x0 = bx * P + ROAD_W, y0 = by * P + ROAD_W, x1 = x0 + P - ROAD_W - 1, y1 = y0 + P - ROAD_W - 1; // outer block incl. sidewalk ring
    const a: Area = { id: w.areas.length, name: NAMES[by][bx], kind: AREA_KIND[plan], x0: x0 + SW, y0: y0 + SW, x1: x1 - SW, y1: y1 - SW, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
    w.areas.push(a);
    const ix0 = x0 + SW, iy0 = y0 + SW, ix1 = x1 - SW, iy1 = y1 - SW; // 12x12 interior
    for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) w.areaOf[idx(x, y)] = a.id;
    // street lamps on the kerb at the sidewalk corners
    poi("lamp", x0, y0 + SW, street); poi("lamp", x1, y1 - SW, street);
    if (rng.chance(0.5)) poi("busstop", x0 + 8, y1, street);
    if (rng.chance(0.4)) poi("hydrant", x1, y0 + 6, street);

    switch (plan) {
      case "plaza": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        const fx = Math.floor(a.cx) - 1, fy = Math.floor(a.cy) - 1;
        fill(fx, fy, fx + 1, fy + 1, T.FOUNTAIN); poi("fountain", fx + 1, fy + 1, a);
        for (const [px, py] of [[ix0 + 1, iy0 + 1], [ix1 - 1, iy0 + 1], [ix0 + 1, iy1 - 1], [ix1 - 1, iy1 - 1]]) { poi("bench", px, py, a); poi("lamp", px + 1, py, a); }
        poi("toychest", ix0 + 3, Math.floor(a.cy), a);
        poi("foodtruck", ix1 - 2, iy0 + 3, a, { name: "Mr Whippee", menu: ["hokey_pokey", "lp", "donut"] });
        poi("atm", ix0 + 1, iy1 - 3, a);
        for (const [tx, ty] of [[ix0 + 4, iy0 + 1], [ix1 - 4, iy1 - 1], [ix0 + 1, iy0 + 6], [ix1 - 1, iy0 + 6]]) set(tx, ty, T.TREE);
        break;
      }
      case "river": {
        // the Avon / Ōtākaro winds through: grass banks, willows, a footbridge
        fill(ix0, iy0, ix1, iy1, T.GRASS);
        const wob = (t: number) => Math.sin(t * 0.55 + bx) * 2.2;
        for (let x = ix0; x <= ix1; x++) {
          const cyR = Math.round(iy0 + 2 + ((x - ix0) / (ix1 - ix0)) * (iy1 - iy0 - 4) + wob(x));
          for (let y = cyR - 1; y <= cyR + 1; y++) if (y >= iy0 && y <= iy1) set(x, y, T.WATER);
        }
        // footbridge across the middle
        const bxm = Math.floor(a.cx);
        for (let y = iy0; y <= iy1; y++) if (w.tile(bxm, y) === T.WATER) set(bxm, y, T.PATH);
        for (let y = iy0; y <= iy1; y++) if (w.tile(bxm, y) === T.GRASS) set(bxm, y, T.PATH);
        for (let i = 0; i < 9; i++) { const x = rng.int(ix0, ix1), y = rng.int(iy0, iy1); if (w.tile(x, y) === T.GRASS && x !== bxm) set(x, y, T.TREE); }
        poi("bench", bxm + 2, iy0 + 1, a); poi("bench", bxm - 2, iy1 - 1, a); poi("lamp", bxm + 1, Math.floor(a.cy), a);
        if (by === 1) poi("foodtruck", ix0 + 1, iy1 - 1, a, { name: "Coffee Cart", menu: ["flat_white", "donut", "lp"] });
        break;
      }
      case "airport": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("airport", ix0, iy0, ix0 + 4, iy0 + 3, a, "s");
        // apron with a parked jet clear of the terminal; its footprint is solid (you walk round it)
        const jx = ix0 + 8, jy = iy0 + 3;
        poi("plane", jx, jy, a, { name: "Aotearoa Air 787" });
        if (!w.blocked.length) w.blocked = new Uint8Array(S * S);
        for (let x = jx - 2; x <= jx + 2; x++) w.blocked[idx(x, jy)] = 1;          // fuselage
        for (let y = jy - 2; y <= jy + 2; y++) w.blocked[idx(jx, y)] = 1;          // wings at the root
        fill(ix0, iy0 + 8, ix1, iy1, T.PARKING);
        fill(ix0 - SW, iy0 + 9, ix0 - 1, iy0 + 10, T.PARKING); // driveway
        poi("busstop", ix0 + 3, iy0 + 6, a, { name: "Airport shuttle" });
        poi("lamp", ix1 - 1, iy0 + 7, a);
        break;
      }
      case "park": {
        fill(ix0, iy0, ix1, iy1, T.GRASS);
        const pcx = Math.floor(a.cx) + rng.int(-2, 1), pcy = Math.floor(a.cy) + rng.int(-2, 1), prx = rng.int(2, 3), pry = rng.int(2, 3);
        for (let y = pcy - pry; y <= pcy + pry; y++) for (let x = pcx - prx; x <= pcx + prx; x++) { const dx = (x - pcx) / prx, dy = (y - pcy) / pry; if (dx * dx + dy * dy <= 1) set(x, y, T.WATER); }
        for (let i = 0; i < 14; i++) { const x = rng.int(ix0, ix1), y = rng.int(iy0, iy1); if (w.tile(x, y) === T.GRASS) set(x, y, T.TREE); }
        for (let x = ix0; x <= ix1; x++) if (w.tile(x, Math.floor(a.cy) + 4) === T.GRASS || w.tile(x, Math.floor(a.cy) + 4) === T.TREE) set(x, Math.floor(a.cy) + 4, T.PATH);
        poi("bench", ix0 + 2, Math.floor(a.cy) + 3, a); poi("bench", ix1 - 2, Math.floor(a.cy) + 5, a);
        poi("toychest", ix0 + 4, Math.floor(a.cy) + 5, a); poi("lamp", Math.floor(a.cx), Math.floor(a.cy) + 5, a);
        break;
      }
      case "court": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        const cx0 = ix0, cx1 = ix1, cy0 = iy0, cy1 = iy0 + 8;
        fill(cx0, cy0, cx1, cy1, T.COURT);
        for (let x = cx0; x <= cx1; x++) { set(x, cy0, T.FENCE); set(x, cy1, T.FENCE); }
        for (let y = cy0; y <= cy1; y++) { set(cx0, y, T.FENCE); set(cx1, y, T.FENCE); }
        const gx = Math.floor((cx0 + cx1) / 2);
        set(gx, cy1, T.COURT); set(gx + 1, cy1, T.COURT); set(cx0, cy0 + 4, T.COURT);
        poi("hoop", cx0 + 2, cy0 + 4, a); poi("hoop", cx1 - 2, cy0 + 4, a); poi("toychest", gx, cy0 + 2, a); poi("lamp", gx + 3, cy1 - 1, a);
        building("gym", ix0 + 1, iy1 - 2, ix0 + 6, iy1, a, "n");
        break;
      }
      case "market": {
        fill(ix0, iy0, ix1, iy1, T.PATH);
        for (let row = iy0 + 2; row <= iy1 - 2; row += 4) for (let x = ix0 + 1; x <= ix1 - 1; x += rng.int(3, 4)) {
          if (rng.chance(0.85)) { set(x, row, T.STALL); for (const dy of [1, 2]) if (row + dy <= iy1) w.shelter[idx(x, row + dy)] = 1; }
        }
        poi("bench", ix0, iy1, a); poi("lamp", Math.floor(a.cx), iy1, a);
        poi("foodtruck", ix1 - 1, iy1 - 1, a, { name: "Bao Wow truck", menu: ["bao", "kebab", "lp"] });
        break;
      }
      case "stage": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        fill(ix0 + 5, iy0 + 2, ix1 - 1, iy0 + 7, T.STAGE);
        poi("boombox", ix0 + 4, iy0 + 4, a);
        poi("lamp", ix0 + 1, iy0 + 1, a); poi("lamp", ix0 + 1, iy0 + 8, a); poi("toychest", ix0 + 1, iy0 + 5, a);
        building("nightclub", ix0 + 1, iy1 - 2, ix1 - 1, iy1, a, "n");
        break;
      }
      case "playground": {
        fill(ix0, iy0, ix1, iy1, T.SAND);
        fill(ix0, iy0, ix1, iy0 + 4, T.PAVE); // skate bowl area
        for (let i = 0; i < 3; i++) poi("springpad", rng.int(ix0 + 1, ix1 - 1), rng.int(iy0 + 6, iy1 - 1), a);
        poi("toychest", Math.floor(a.cx), iy0 + 6, a); poi("lamp", ix1, iy0 + 5, a); poi("mural", ix0, iy0 + 2, a, { name: "skate wall" });
        break;
      }
      case "alley": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        for (let i = 0; i < 6; i++) { const x = rng.int(ix0 + 1, ix1 - 1), y = rng.int(iy0 + 5, iy1 - 1); set(x, y, T.CRATE); }
        // the legal wall of fame: a long low wall for murals
        for (let x = ix0 + 1; x <= ix1 - 1; x++) set(x, iy0 + 3, T.WALL);
        set(Math.floor(a.cx), iy0 + 3, T.PAVE);
        poi("mural", ix0 + 3, iy0 + 4, a, { name: "wall of fame" }); poi("lamp", ix0 + 1, iy0 + 5, a); poi("toychest", ix1 - 2, iy1 - 2, a);
        building("records", ix0, iy0, ix0 + 4, iy0 + 2, a, "s");
        building("barber", ix1 - 4, iy0, ix1, iy0 + 2, a, "s");
        break;
      }
      case "mosaicscope": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        // the walk-in studio (left half): walls, a door, lights inside
        const sx0 = ix0, sx1 = ix0 + 7, sy0 = iy0, sy1 = iy1 - 1;
        fill(sx0, sy0, sx1, sy1, T.FLOOR);
        for (let x = sx0; x <= sx1; x++) { set(x, sy0, T.WALL); set(x, sy1, T.WALL); }
        for (let y = sy0; y <= sy1; y++) { set(sx0, y, T.WALL); set(sx1, y, T.WALL); }
        const dy = Math.floor((sy0 + sy1) / 2);
        set(sx1, dy, T.FLOOR); set(sx1, dy + 1, T.FLOOR);
        poi("door", sx1 + 1, dy, a, { name: "MosaicScope Studio", building: -2 });
        for (let y = sy0 + 1; y < sy1; y++) for (let x = sx0 + 1; x < sx1; x++) w.shelter[idx(x, y)] = 1;
        poi("light", sx0 + 2, sy0 + 2, a); poi("light", sx0 + 5, sy0 + 2, a); poi("bench", sx0 + 2, sy1 - 2, a);
        const studioId = w.areas.length; // a sub-area so "studio" logic (shelter, shoots) has a tight rect
        w.areas.push({ id: studioId, name: "MosaicScope Studio", kind: "studio", x0: sx0 + 1, y0: sy0 + 1, x1: sx1 - 1, y1: sy1 - 1, cx: (sx0 + sx1 + 1) / 2, cy: (sy0 + sy1 + 1) / 2 });
        for (let y = sy0 + 1; y < sy1; y++) for (let x = sx0 + 1; x < sx1; x++) w.areaOf[idx(x, y)] = studioId;
        a.kind = "gallery";
        building("gallery", ix0 + 9, iy0 + 1, ix1, iy0 + 6, a, "w");
        poi("billboard", ix0 + 10, iy1 - 2, a, { name: "mosaicscope" });
        break;
      }
      case "casino": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("casino", ix0 + 1, iy0, ix1 - 1, iy0 + 6, a, "s");
        fill(ix0, iy0 + 9, ix1, iy1, T.PARKING);
        fill(ix0, iy1 + 1, ix0 + 1, iy1 + SW, T.PARKING); // driveway
        poi("lamp", ix0, iy0 + 8, a); poi("lamp", ix1, iy0 + 8, a); poi("atm", ix1 - 1, iy0 + 7, a);
        break;
      }
      case "dealership": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("dealership", ix0, iy0, ix0 + 6, iy0 + 4, a, "s");
        fill(ix0, iy0 + 7, ix1, iy1, T.PARKING);
        fill(ix1 + 1, iy1 - 1, ix1 + SW, iy1, T.PARKING); // driveway
        poi("lamp", ix1, iy0 + 6, a); poi("billboard", ix1 - 2, iy0 + 2, a, { name: "cars" });
        break;
      }
      case "police": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("police", ix0, iy0, ix0 + 7, iy0 + 6, a, "s");
        fill(ix0 + 9, iy0, ix1, iy0 + 6, T.PARKING);
        fill(ix1 + 1, iy0 + 1, ix1 + SW, iy0 + 2, T.PARKING); // driveway
        building("bakery", ix0, iy1 - 3, ix0 + 4, iy1, a, "n");
        poi("lamp", ix0 + 8, iy0 + 8, a);
        break;
      }
      case "hospital": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("hospital", ix0, iy0, ix1 - 3, iy0 + 7, a, "s");
        fill(ix1 - 2, iy0, ix1, iy0 + 7, T.PARKING);
        fill(ix1 + 1, iy0 + 2, ix1 + SW, iy0 + 3, T.PARKING); // driveway
        building("cafe", ix0, iy1 - 2, ix0 + 4, iy1, a, "n");
        poi("bench", ix0 + 7, iy0 + 9, a);
        break;
      }
      case "food": case "food2": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        const kinds: BuildingKind[] = plan === "food" ? ["diner", "pizza", "sushi", "fishchips", "cafe", "dairy"] : ["bakery", "pizza", "diner", "sushi", "cafe", "dairy"];
        let k = 0;
        for (const ly of [iy0, iy0 + 7]) for (const lx of [ix0, ix0 + 4, ix0 + 8]) building(kinds[k++], lx, ly, lx + 3, ly + 4, a, ly === iy0 ? "s" : "n");
        poi("foodtruck", Math.floor(a.cx), Math.floor(a.cy) + 0, a, { name: "Kebab Kingz", menu: ["kebab", "lp", "energy_drink"] });
        poi("bench", ix0 + 2, iy0 + 6, a); poi("lamp", ix1 - 1, iy0 + 6, a);
        break;
      }
      case "shops": case "shops2": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        const kinds: BuildingKind[] = plan === "shops" ? ["toyshop", "sports", "pawn", "records", "dairy", "barber"] : ["toyshop", "sports", "pawn", "cafe", "dairy", "pizza"];
        let k = 0;
        for (const ly of [iy0, iy0 + 7]) for (const lx of [ix0, ix0 + 4, ix0 + 8]) building(kinds[k++], lx, ly, lx + 3, ly + 4, a, ly === iy0 ? "s" : "n");
        poi("bench", ix0 + 5, iy0 + 6, a); poi("atm", ix1 - 1, iy0 + 6, a);
        break;
      }
      case "garage": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("garage", ix0, iy0, ix0 + 5, iy0 + 3, a, "s");
        fill(ix0, iy0 + 5, ix1, iy0 + 8, T.PARKING);
        fill(ix0 - SW, iy0 + 6, ix0 - 1, iy0 + 7, T.PARKING); // driveway
        building("dairy", ix1 - 4, iy0, ix1, iy0 + 3, a, "s");
        building("house", ix0, iy1 - 2, ix0 + 3, iy1, a, "n"); building("house", ix1 - 3, iy1 - 2, ix1, iy1, a, "n");
        break;
      }
      case "office": case "bank": case "hotel": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        const main: BuildingKind = plan === "bank" ? "bank" : plan === "hotel" ? "hotel" : "office";
        building(main, ix0, iy0, ix0 + 5, iy0 + 5, a, "s");
        building("office", ix1 - 5, iy0, ix1, iy0 + 5, a, "s");
        building(plan === "bank" ? "cafe" : plan === "hotel" ? "sushi" : "office", ix0, iy1 - 4, ix0 + 5, iy1, a, "n");
        set(ix1 - 2, iy1 - 2, T.TREE); set(ix1 - 4, iy1 - 3, T.TREE);
        poi("bench", ix1 - 3, iy1 - 1, a); poi("lamp", ix1 - 1, iy0 + 7, a);
        break;
      }
      case "apartments": {
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("apartments", ix0, iy0, ix0 + 4, iy0 + 5, a, "s");
        building("apartments", ix1 - 4, iy0, ix1, iy0 + 5, a, "s");
        building("apartments", ix0, iy1 - 4, ix0 + 4, iy1, a, "n");
        fill(ix1 - 4, iy1 - 4, ix1, iy1, T.GRASS);
        poi("bench", ix1 - 2, iy1 - 2, a); set(ix1 - 1, iy1 - 4, T.TREE);
        break;
      }
      case "stripclub": {
        // Tuam St nightlife: the club fronting the street, a smokers' courtyard, staff parking out back
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("stripclub", ix0, iy0, ix0 + 7, iy0 + 5, a, "s");
        building("bakery", ix1 - 3, iy0, ix1, iy0 + 3, a, "s");
        fill(ix0, iy1 - 3, ix1, iy1, T.PARKING);
        fill(ix1 + 1, iy1 - 2, ix1 + SW, iy1 - 1, T.PARKING); // driveway
        poi("lamp", ix0 + 2, iy0 + 7, a); poi("lamp", ix0 + 6, iy0 + 7, a); poi("bench", ix1 - 2, iy0 + 6, a); poi("atm", ix0 + 8, iy0 + 6, a);
        break;
      }
      case "velvet": {
        // The Velvet Rooms: a members' lounge off Worcester Boulevard with a hedged garden and a valet lot
        fill(ix0, iy0, ix1, iy1, T.PAVE);
        building("velvet", ix0 + 2, iy0, ix1, iy0 + 6, a, "s");
        fill(ix0, iy0 + 9, ix1 - 6, iy1, T.GRASS);
        for (let x = ix0; x <= ix1 - 6; x++) { if (x !== ix0 + 3) set(x, iy0 + 9, T.HEDGE); }
        set(ix0 + 1, iy1 - 1, T.TREE); set(ix1 - 7, iy1 - 1, T.TREE);
        poi("fountain", ix0 + 3, iy1 - 1, a); set(ix0 + 3, iy1 - 1, T.FOUNTAIN);
        fill(ix1 - 4, iy0 + 9, ix1, iy1, T.PARKING);
        fill(ix1 + 1, iy1 - 1, ix1 + SW, iy1, T.PARKING); // driveway
        poi("lamp", ix0 + 2, iy0 + 8, a); poi("lamp", ix1 - 1, iy0 + 8, a); poi("bench", ix0 + 1, iy0 + 11, a);
        break;
      }
      case "zoo": {
        // Hagley Park's zoo corner: open grass, a cross of paths, three fenced enclosures with keeper gates
        fill(ix0, iy0, ix1, iy1, T.GRASS);
        const mx = ix0 + 5, my = iy0 + 5;
        for (let x = ix0; x <= ix1; x++) set(x, my, T.PATH);
        for (let y = iy0; y <= iy1; y++) set(mx, y, T.PATH);
        const pen = (x0p: number, y0p: number, x1p: number, y1p: number, gx: number, gy: number) => {
          for (let x = x0p; x <= x1p; x++) { set(x, y0p, T.FENCE); set(x, y1p, T.FENCE); }
          for (let y = y0p; y <= y1p; y++) { set(x0p, y, T.FENCE); set(x1p, y, T.FENCE); }
          set(gx, gy, T.PATH); // keeper gate
        };
        pen(ix0, iy0, ix0 + 4, iy0 + 4, ix0 + 4, iy0 + 2);          // giraffe paddock
        set(ix0 + 2, iy0 + 1, T.TREE);
        pen(ix0 + 6, iy0, ix1, iy0 + 4, ix0 + 6, iy0 + 2);          // penguin pool
        fill(ix0 + 8, iy0 + 2, ix0 + 9, iy0 + 2, T.WATER);
        pen(ix0, iy0 + 6, ix0 + 4, iy1, ix0 + 4, iy0 + 8);          // kea aviary
        set(ix0 + 2, iy1 - 1, T.TREE);
        // the open lawn: picnic benches, a kiosk and somewhere to sit and watch Kevin
        for (let i = 0; i < 3; i++) { const x = rng.int(ix0 + 7, ix1), y = rng.int(iy0 + 8, iy1); if (w.tile(x, y) === T.GRASS) set(x, y, T.TREE); }
        poi("bench", ix0 + 6, my + 1, a); poi("bench", ix0 + 9, my - 1, a); poi("lamp", mx, my, a);
        poi("foodtruck", ix0 + 8, my + 2, a, { name: "Zoo Kiosk", menu: ["hokey_pokey", "lp", "donut"] });
        poi("toychest", ix1 - 1, my + 4, a);
        break;
      }
      case "houses": default: {
        fill(ix0, iy0, ix1, iy1, T.GRASS);
        for (const ly of [iy0, iy0 + 4, iy0 + 8]) for (const lx of [ix0, ix0 + 4, ix0 + 8]) {
          if (lx === ix0 + 4 && ly === iy0 + 4) { fill(lx, ly, lx + 3, ly + 3, T.PATH); continue; }
          building("house", lx, ly, lx + 2, ly + 2, a, lx === ix0 ? "w" : lx === ix0 + 8 ? "e" : ly === iy0 ? "n" : "s");
        }
        // paths so every front door is reachable
        for (let x = ix0; x <= ix1; x++) { if (w.tile(x, iy0 + 3) === T.GRASS) set(x, iy0 + 3, T.PATH); if (w.tile(x, iy0 + 7) === T.GRASS) set(x, iy0 + 7, T.PATH); }
        for (let y = iy0; y <= iy1; y++) { if (w.tile(ix0 + 3, y) === T.GRASS) set(ix0 + 3, y, T.PATH); if (w.tile(ix0 + 7, y) === T.GRASS) set(ix0 + 7, y, T.PATH); }
        break;
      }
    }
  }

  // POIs must stand on walkable ground (except decorative ones that sit on solids)
  for (const p of w.pois) {
    if (p.kind === "fountain" || p.kind === "mural" || p.kind === "billboard") continue;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (SOLID.has(w.tile(tx, ty)) && w.tile(tx, ty) !== T.BUILDING && w.tile(tx, ty) !== T.WALL) set(tx, ty, T.PAVE);
  }
  // shelter: awnings in front of shops and the area just inside doors
  for (const b of w.buildings) if (w.inBounds(b.door.x, b.door.y)) w.shelter[idx(b.door.x, b.door.y)] = 1;

  ensureConnected(w);
  w.dirtyTiles.clear();
  return w;
}

/** Flood fill from the plaza; returns a mask of reachable walkable tiles. */
export function reachableMask(w: World): Uint8Array {
  const S = w.size, seen = new Uint8Array(S * S);
  const plaza = w.areas.find((a) => a.kind === "plaza")!;
  const start = w.nearestWalkable(plaza.cx, plaza.cy);
  const stack = [Math.floor(start.y) * S + Math.floor(start.x)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!, x = i % S, y = (i - x) / S;
    const nb = [i - 1, i + 1, i - S, i + S];
    const ok = [x > 0, x < S - 1, y > 0, y < S - 1];
    for (let n = 0; n < 4; n++) {
      if (!ok[n]) continue;
      const j = nb[n];
      if (!seen[j] && !SOLID.has(w.tiles[j])) { seen[j] = 1; stack.push(j); }
    }
  }
  return seen;
}

/**
 * Guarantee that every walkable tile is reachable from the plaza: remove decoration that separates
 * regions, and as a last resort turn unreachable pockets into hedges so nothing ever spawns there.
 */
export function ensureConnected(w: World): { removed: number; sealed: number } {
  const S = w.size;
  let removed = 0, sealed = 0;
  for (let pass = 0; pass < 200; pass++) {
    const seen = reachableMask(w);
    let fixed = false;
    for (let i = 0; i < S * S && !fixed; i++) {
      if (seen[i] || SOLID.has(w.tiles[i])) continue;
      const x = i % S, y = (i - x) / S;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!w.inBounds(nx, ny)) continue;
        const ni = ny * S + nx;
        if (!DECOR.has(w.tiles[ni]) && w.tiles[ni] !== 11 /* fence */) continue;
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => w.inBounds(nx + ex, ny + ey) && seen[(ny + ey) * S + nx + ex]);
        if (touches) { w.tiles[ni] = w.tiles[ni] === 11 ? 4 : T.GRASS; removed++; fixed = true; break; }
      }
    }
    if (!fixed) break;
  }
  const seen = reachableMask(w);
  for (let i = 0; i < S * S; i++) if (!seen[i] && !SOLID.has(w.tiles[i])) { w.tiles[i] = T.HEDGE; sealed++; }
  return { removed, sealed };
}
