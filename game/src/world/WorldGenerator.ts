import { Rng } from "../core/rng";
import { World, T, Area, AreaKind, PoiKind, SOLID, DECOR } from "./World";

/**
 * Seeded generator for the Mosaics' block: a plaza in the middle, districts around it, a street ring
 * for the background crowd, and paths linking everything. After placement it validates connectivity
 * and removes any decoration that would cut an area off (see `ensureConnected`).
 */
export interface GenOptions { size: number; seed: number }

export function generateWorld(opts: GenOptions): World {
  const S = Math.max(48, opts.size);
  const rng = new Rng(opts.seed);
  const w = new World(S);
  const j = (n: number) => n + rng.int(-1, 1); // small seeded jitter
  const k = S / 64; // scale layout to world size

  const fill = (x0: number, y0: number, x1: number, y1: number, t: number, area?: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) {
      w.tiles[y * S + x] = t;
      if (area !== undefined) w.areaOf[y * S + x] = area;
    }
  };
  const addArea = (name: string, kind: AreaKind, x0: number, y0: number, x1: number, y1: number): Area => {
    const a: Area = { id: w.areas.length, name, kind, x0, y0, x1, y1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
    w.areas.push(a);
    return a;
  };
  const poi = (kind: PoiKind, x: number, y: number, area: Area) => w.pois.push({ id: w.pois.length, kind, x: x + 0.5, y: y + 0.5, area: area.id, on: kind === "lamp" });

  // 0: the street ring (background crowd lives here)
  const street = addArea("The Street", "street", 0, 0, S - 1, S - 1);
  fill(0, 0, S - 1, S - 1, T.GRASS, street.id);
  const ring = 3;
  fill(0, 0, S - 1, ring - 1, T.STREET); fill(0, S - ring, S - 1, S - 1, T.STREET);
  fill(0, 0, ring - 1, S - 1, T.STREET); fill(S - ring, 0, S - 1, S - 1, T.STREET);

  const r = (n: number) => Math.round(n * k);

  // Plaza
  const plaza = addArea("The Plaza", "plaza", r(24), r(24), r(39), r(39));
  fill(plaza.x0, plaza.y0, plaza.x1, plaza.y1, T.PAVE, plaza.id);
  const fx = Math.floor(plaza.cx) - 1, fy = Math.floor(plaza.cy) - 1;
  fill(fx, fy, fx + 1, fy + 1, T.FOUNTAIN);
  poi("fountain", fx + 1, fy + 1, plaza);
  for (const [bx, by] of [[plaza.x0 + 2, plaza.y0 + 2], [plaza.x1 - 2, plaza.y0 + 2], [plaza.x0 + 2, plaza.y1 - 2], [plaza.x1 - 2, plaza.y1 - 2]]) { poi("bench", bx, by, plaza); poi("lamp", bx + 1, by, plaza); }
  poi("toychest", plaza.x0 + 4, Math.floor(plaza.cy), plaza);

  // Park (west) with pond and trees
  const park = addArea("Kodak Park", "park", ring + 1, r(6), r(21), r(40));
  fill(park.x0, park.y0, park.x1, park.y1, T.GRASS, park.id);
  const pcx = j(r(11)), pcy = j(r(16)), prx = rng.int(3, 4), pry = rng.int(2, 4);
  for (let y = pcy - pry; y <= pcy + pry; y++) for (let x = pcx - prx; x <= pcx + prx; x++) {
    const dx = (x - pcx) / prx, dy = (y - pcy) / pry;
    if (dx * dx + dy * dy <= 1) w.tiles[y * S + x] = T.WATER;
  }
  for (let i = 0; i < r(26); i++) {
    const x = rng.int(park.x0, park.x1), y = rng.int(park.y0, park.y1);
    if (w.tiles[y * S + x] === T.GRASS) w.tiles[y * S + x] = T.TREE;
  }
  poi("bench", pcx + prx + 2, pcy, park); poi("bench", park.x0 + 3, r(30), park);
  poi("toychest", r(14), r(30), park); poi("lamp", pcx, pcy + pry + 2, park);

  // Court (NE): fenced ball court with two gates
  const court = addArea("The Court", "court", r(43), ring + 1, S - ring - 2, r(21));
  fill(court.x0, court.y0, court.x1, court.y1, T.COURT, court.id);
  for (let x = court.x0; x <= court.x1; x++) { w.tiles[court.y0 * S + x] = T.FENCE; w.tiles[court.y1 * S + x] = T.FENCE; }
  for (let y = court.y0; y <= court.y1; y++) { w.tiles[y * S + court.x0] = T.FENCE; w.tiles[y * S + court.x1] = T.FENCE; }
  const gateY = j(Math.floor(court.cy)), gateX = j(Math.floor(court.cx));
  fill(court.x0, gateY - 1, court.x0, gateY, T.COURT); fill(gateX - 1, court.y1, gateX, court.y1, T.COURT);
  poi("hoop", court.x0 + 2, Math.floor(court.cy), court); poi("hoop", court.x1 - 2, Math.floor(court.cy), court);
  poi("toychest", Math.floor(court.cx), court.y0 + 2, court); poi("lamp", gateX + 2, court.y1 - 1, court);

  // Market (N): rows of stalls with awnings that shelter the tiles in front
  const market = addArea("Flash Market", "market", r(23), ring + 1, r(40), r(20));
  fill(market.x0, market.y0, market.x1, market.y1, T.PATH, market.id);
  for (let row = market.y0 + 3; row <= market.y1 - 3; row += 5) {
    for (let x = market.x0 + 2; x <= market.x1 - 2; x += rng.int(3, 4)) {
      if (rng.chance(0.85)) {
        w.tiles[row * S + x] = T.STALL;
        for (const dy of [1, 2]) if (row + dy <= market.y1) w.shelter[(row + dy) * S + x] = 1;
      }
    }
  }
  poi("bench", market.x0 + 1, market.y1 - 1, market); poi("lamp", Math.floor(market.cx), market.y1 - 1, market);

  // Stage yard (E): the after-hours spot with the boombox
  const stage = addArea("After Hours Yard", "stage", r(43), r(25), S - ring - 2, r(42));
  fill(stage.x0, stage.y0, stage.x1, stage.y1, T.PAVE, stage.id);
  fill(stage.x0 + 6, stage.y0 + 4, stage.x1 - 1, stage.y1 - 4, T.STAGE);
  poi("boombox", stage.x0 + 5, Math.floor(stage.cy), stage);
  poi("lamp", stage.x0 + 2, stage.y0 + 1, stage); poi("lamp", stage.x0 + 2, stage.y1 - 1, stage);
  poi("toychest", stage.x0 + 2, Math.floor(stage.cy) + 3, stage);

  // Studio (S): a building with walls, doors, an inner partition and couches (crates)
  const studio = addArea("The Studio", "studio", r(23), r(44), r(41), S - ring - 2);
  fill(studio.x0, studio.y0, studio.x1, studio.y1, T.FLOOR, studio.id);
  for (let x = studio.x0; x <= studio.x1; x++) { w.tiles[studio.y0 * S + x] = T.WALL; w.tiles[studio.y1 * S + x] = T.WALL; }
  for (let y = studio.y0; y <= studio.y1; y++) { w.tiles[y * S + studio.x0] = T.WALL; w.tiles[y * S + studio.x1] = T.WALL; }
  const doorX = j(Math.floor(studio.cx));
  fill(doorX - 1, studio.y0, doorX, studio.y0, T.FLOOR); poi("door", doorX, studio.y0, studio);
  const sideDoorY = j(Math.floor(studio.cy));
  fill(studio.x0, sideDoorY, studio.x0, sideDoorY, T.FLOOR);
  const partX = Math.floor(studio.cx) + 3;
  for (let y = studio.y0 + 1; y < studio.y1; y++) if (Math.abs(y - Math.floor(studio.cy)) > 1) w.tiles[y * S + partX] = T.WALL;
  for (let y = studio.y0 + 1; y < studio.y1; y++) for (let x = studio.x0 + 1; x < studio.x1; x++) w.shelter[y * S + x] = 1;
  poi("bench", studio.x0 + 3, studio.y1 - 2, studio); poi("toychest", studio.x1 - 3, studio.y0 + 3, studio); poi("lamp", studio.x0 + 2, studio.y0 + 2, studio);
  w.tiles[(studio.y1 - 3) * S + studio.x1 - 4] = T.CRATE;

  // Playground (SW): sand with spring pads
  const play = addArea("Grain Playground", "playground", ring + 1, r(44), r(20), S - ring - 2);
  fill(play.x0, play.y0, play.x1, play.y1, T.SAND, play.id);
  for (let i = 0; i < 3; i++) poi("springpad", rng.int(play.x0 + 2, play.x1 - 2), rng.int(play.y0 + 2, play.y1 - 2), play);
  poi("toychest", Math.floor(play.cx), play.y0 + 2, play); poi("lamp", play.x1 - 1, play.y0 + 1, play);

  // Alley (SE): crates to push around
  const alley = addArea("Bando Alley", "alley", r(44), r(46), S - ring - 2, S - ring - 2);
  fill(alley.x0, alley.y0, alley.x1, alley.y1, T.PAVE, alley.id);
  for (let i = 0; i < r(7); i++) { const x = rng.int(alley.x0 + 1, alley.x1 - 1), y = rng.int(alley.y0 + 1, alley.y1 - 1); w.tiles[y * S + x] = T.CRATE; }
  poi("lamp", alley.x0 + 1, alley.y0 + 1, alley); poi("toychest", alley.x1 - 2, alley.y1 - 2, alley);

  // Paths from the plaza to each district (2 wide, L-shaped)
  const pathTo = (tx: number, ty: number) => {
    const sx = Math.floor(plaza.cx), sy = Math.floor(plaza.cy);
    const lay = (x: number, y: number) => {
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const xx = x + ox, yy = y + oy;
        if (!w.inBounds(xx, yy)) continue;
        const t = w.tiles[yy * S + xx];
        if (t === T.GRASS || DECOR.has(t) || t === T.WATER) w.tiles[yy * S + xx] = T.PATH;
        if (t === T.FENCE) w.tiles[yy * S + xx] = T.COURT;
      }
    };
    for (let x = Math.min(sx, tx); x <= Math.max(sx, tx); x++) lay(x, sy);
    for (let y = Math.min(sy, ty); y <= Math.max(sy, ty); y++) lay(tx, y);
  };
  pathTo(Math.floor(park.cx) + 4, Math.floor(park.y1) - 6);
  pathTo(court.x0 - 2, gateY - 1);
  pathTo(Math.floor(market.cx), market.y1 - 1);
  pathTo(stage.x0 + 2, Math.floor(stage.cy));
  pathTo(doorX - 1, studio.y0 - 1);
  pathTo(Math.floor(play.cx), play.y0 - 1);
  pathTo(Math.floor(alley.cx), alley.y0 - 1);
  pathTo(ring + 1, Math.floor(plaza.cy)); // to the street
  pathTo(Math.floor(plaza.cx), S - ring);

  // POIs must stand on walkable ground
  for (const p of w.pois) {
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (p.kind === "door" || p.kind === "fountain") continue;
    if (SOLID.has(w.tiles[ty * S + tx])) w.tiles[ty * S + tx] = w.areas[p.area].kind === "park" ? T.GRASS : T.PAVE;
  }

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
  for (let pass = 0; pass < 60; pass++) {
    const seen = reachableMask(w);
    let fixed = false;
    for (let i = 0; i < S * S && !fixed; i++) {
      if (seen[i] || SOLID.has(w.tiles[i])) continue;
      // unreachable walkable tile: find a decoration neighbour that touches the reachable set
      const x = i % S, y = (i - x) / S;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!w.inBounds(nx, ny)) continue;
        const ni = ny * S + nx;
        if (!DECOR.has(w.tiles[ni])) continue;
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => w.inBounds(nx + ex, ny + ey) && seen[(ny + ey) * S + nx + ex]);
        if (touches) { w.tiles[ni] = T.GRASS; removed++; fixed = true; break; }
      }
    }
    if (!fixed) break;
  }
  const seen = reachableMask(w);
  for (let i = 0; i < S * S; i++) if (!seen[i] && !SOLID.has(w.tiles[i])) { w.tiles[i] = T.HEDGE; sealed++; }
  return { removed, sealed };
}
