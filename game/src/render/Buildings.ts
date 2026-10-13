import { paintWindows, paintSpill, type Win } from "./NightGlow";
import { World, Building, Graffiti } from "../world/World";
import { TILE_W, TILE_H, Z_PX } from "../world/iso";
import { drawAd } from "./Ads";
import { GROUND_H, FLOOR_H } from "../content/buildings";
import { fillTextured, type TexAnchor } from "./Textures";

/**
 * Buildings are drawn tile by tile (so depth sorting with people stays correct), but each tile knows
 * its place in the whole building: exposed walls get a facade (shopfront + awning at street level,
 * windows per storey, ledges, glass curtain walls on towers, brick on flats), houses get pitched
 * roofs with gable ends, flat roofs get a parapet and rooftop plant, and commercial buildings carry
 * neon trim that glows at night. Everything is flat-shaded vector art to match the stick figures.
 */
const hash = (a: number, b: number) => { let h = (a * 73856093) ^ (b * 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k))), g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k))), b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

type Style = "shop" | "tower" | "flats" | "house" | "civic" | "club" | "fuel";
const STYLE: Record<string, Style> = {
  office: "tower", hotel: "tower", bank: "tower", hospital: "civic", mentalhealth: "civic", police: "civic", gallery: "civic", studio: "civic",
  apartments: "flats", house: "house", nightclub: "club", casino: "club", garage: "fuel", gym: "civic",
};
const styleOf = (b: Building): Style => STYLE[b.kind] ?? "shop";
/** Emissive paint jobs (neon, signs) replayed by the renderer after the night overlay. */
export const GLOW: ((layer: CanvasRenderingContext2D) => void)[] = [];
const NEON = new Set(["casino", "nightclub", "diner", "pizza", "sushi", "fishchips", "records", "toyshop", "barber", "hotel", "dealership", "gallery", "studio", "cafe", "pawn", "recycling"]);

/** Pitched roof height above the eaves at a world point (0 for flat roofs). */
function roofRise(b: Building, wx: number, wy: number): number {
  if (styleOf(b) !== "house") return 0;
  const sx = b.x1 + 1 - b.x0, sy = b.y1 + 1 - b.y0;
  if (sx >= sy) { const d = Math.min(wy - b.y0, b.y1 + 1 - wy); return Math.max(0, d) * (Math.min(1.3, sy * 0.45) / (sy / 2)); }
  const d = Math.min(wx - b.x0, b.x1 + 1 - wx); return Math.max(0, d) * (Math.min(1.3, sx * 0.45) / (sx / 2));
}

export function drawBuildingTile(g: CanvasRenderingContext2D, w: World, b: Building, tx: number, ty: number, sx: number, sy: number, z: number, time: number, dark: number, alpha: number, graffiti: Map<string, Graffiti>): void {
  const hw = (TILE_W / 2) * z, hh = (TILE_H / 2) * z, zp = Z_PX * z, H = b.height;
  const same = (x: number, y: number) => w.buildingOf[y * w.size + x] === b.id;
  // a wall is exposed unless the neighbour tile is this building, or a building at least as tall (fully hidden)
  const blocked = (x: number, y: number) => { const o = w.buildingOf[y * w.size + x]; return o === b.id || o >= 0 && w.buildings[o].height >= b.height; };
  const southOpen = !blocked(tx, ty + 1), eastOpen = !blocked(tx + 1, ty);
  const southStreet = w.buildingOf[(ty + 1) * w.size + tx] < 0, eastStreet = w.buildingOf[ty * w.size + tx + 1] < 0;
  const st = styleOf(b);
  // screen point of a world position (wx, wy) at height h
  const P = (wx: number, wy: number, h: number): [number, number] => [sx + ((wx - tx) - (wy - ty)) * hw, sy + ((wx - tx) + (wy - ty)) * hh - h * zp];
  const top = (wx: number, wy: number) => H + roofRise(b, wx, wy);
  g.globalAlpha = alpha;
  const night = dark > 0.25;
  // textures are pinned to the world origin so they travel with the building as the camera moves
  const anchor: TexAnchor = { x: sx - (tx - ty) * hw, y: sy - (tx + ty) * hh, zoom: z };

  // nearer buildings hide the glow of the ones behind: this tile's silhouette wipes the glow layer before its own windows go on
  if (night && z >= 0.8 && dark > 0.27) {
    const T = H + (st === "house" ? 1.3 : 0.3), hull = [P(tx, ty + 1, 0), P(tx + 1, ty + 1, 0), P(tx + 1, ty, 0), P(tx + 1, ty, T), P(tx, ty, T), P(tx, ty + 1, T)];
    GLOW.push((c) => { c.globalCompositeOperation = "destination-out"; c.globalAlpha = 1; c.fillStyle = "#000"; poly(c, hull); c.fill(); c.globalCompositeOperation = "source-over"; });
  }

  // ---- walls ----
  // facades read brighter by day; at night the neon and windows do the work
  const day = Math.max(0, 1 - dark);
  const kS = 1.15 + 0.45 * day, kE = 0.8 + 0.3 * day;
  const lite = z < 0.8; // zoomed out: flat walls, no windows/awnings/props (keeps it smooth)
  if (lite) {
    const flat = (ax: number, ay: number, bx: number, by: number, k: number) => { g.fillStyle = shade(b.color, k); poly(g, [P(ax, ay, 0), P(bx, by, 0), P(bx, by, top(bx, by)), P(ax, ay, top(ax, ay))]); g.fill(); };
    if (southOpen) flat(tx, ty + 1, tx + 1, ty + 1, kS);
    if (eastOpen) flat(tx + 1, ty + 1, tx + 1, ty, kE);
    g.fillStyle = shade(b.roof, 0.45); poly(g, [P(tx, ty, top(tx, ty)), P(tx + 1, ty, top(tx + 1, ty)), P(tx + 1, ty + 1, top(tx + 1, ty + 1)), P(tx, ty + 1, top(tx, ty + 1))]); g.fill();
    g.globalAlpha = 1;
    return;
  }
  // ambient occlusion: soft contact shadow where the walls meet the pavement
  const ao = (x0: number, y0: number, x1: number, y1: number, ox: number, oy: number) => {
    const A = P(x0, y0, 0), B = P(x1, y1, 0), C = P(x1 + ox, y1 + oy, 0), D = P(x0 + ox, y0 + oy, 0);
    // two flat bands (no per-frame gradient objects): darker near the wall, lighter further out
    const k = 1 - dark * 0.5, M1 = [A[0] + (D[0] - A[0]) * 0.45, A[1] + (D[1] - A[1]) * 0.45], M2 = [B[0] + (C[0] - B[0]) * 0.45, B[1] + (C[1] - B[1]) * 0.45];
    g.fillStyle = `rgba(0,0,0,${0.16 * k})`; poly(g, [A, B, C, D]); g.fill();
    g.fillStyle = `rgba(0,0,0,${0.2 * k})`; poly(g, [A, B, M2, M1]); g.fill();
  };
  if (southOpen) ao(tx, ty + 1, tx + 1, ty + 1, 0, 0.55);
  if (eastOpen) ao(tx + 1, ty, tx + 1, ty + 1, 0.55, 0);
  if (southOpen) wall(g, b, P, top, tx, ty + 1, tx + 1, ty + 1, kS, "s", tx, ty, z, dark, night, time);
  if (eastOpen) wall(g, b, P, top, tx + 1, ty + 1, tx + 1, ty, kE, "e", tx, ty, z, dark, night, time);
  if (southOpen) paintGraffiti(g, graffiti.get(`${tx},${ty},s`), P(tx, ty + 1, 0), P(tx + 1, ty + 1, 0), Math.min(H, GROUND_H) * zp, z);
  if (southOpen && eastOpen) {
    // the building's front corner: a crisp edge so blocks read as solid volumes
    const A = P(tx + 1, ty + 1, 0), B = P(tx + 1, ty + 1, top(tx + 1, ty + 1));
    g.strokeStyle = "rgba(238,228,211,.16)"; g.lineWidth = Math.max(1, z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  }
  if (eastOpen) paintGraffiti(g, graffiti.get(`${tx},${ty},e`), P(tx + 1, ty + 1, 0), P(tx + 1, ty, 0), Math.min(H, GROUND_H) * zp, z);

  // ---- roof ----
  if (st === "house") {
    // split the tile along the ridge so each half is one flat plane
    const sxN = b.x1 + 1 - b.x0, syN = b.y1 + 1 - b.y0;
    const alongX = sxN >= syN, ridge = alongX ? (b.y0 + b.y1 + 1) / 2 : (b.x0 + b.x1 + 1) / 2;
    const lo = alongX ? ty : tx, hi = lo + 1;
    const parts: [number, number, boolean][] = ridge > lo && ridge < hi ? [[lo, ridge, true], [ridge, hi, false]] : [[lo, hi, (lo + hi) / 2 < ridge]];
    for (const [a0, a1, rising] of parts) {
      const pts = alongX ? [[tx, a0], [tx + 1, a0], [tx + 1, a1], [tx, a1]] : [[a0, ty], [a1, ty], [a1, ty + 1], [a0, ty + 1]];
      // slope facing +y / +x (towards the camera) is lit; the far slope is in shade
      g.fillStyle = shade(b.roof, rising ? 0.62 : alongX ? 0.95 : 0.8);
      g.beginPath();
      pts.forEach(([x, y], i) => { const p = P(x, y, top(x, y)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
      g.closePath(); g.fill();
      if (z >= 0.8) fillTextured(g, "roof", 0.8, anchor);
      // tile courses
      g.strokeStyle = "rgba(14,11,10,.22)"; g.lineWidth = Math.max(1, 0.8 * z); g.beginPath();
      for (let k = 1; k < 4; k++) {
        const f = a0 + (a1 - a0) * (k / 4);
        const [p, q] = alongX ? [[tx, f], [tx + 1, f]] : [[f, ty], [f, ty + 1]];
        const A = P(p[0], p[1], top(p[0], p[1])), B = P(q[0], q[1], top(q[0], q[1]));
        g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
      }
      g.stroke();
    }
    // ridge line + eaves
    g.strokeStyle = shade(b.roof, 1.25); g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
    if (ridge > (alongX ? ty : tx) && ridge < (alongX ? ty : tx) + 1) {
      const A = alongX ? P(tx, ridge, top(tx, ridge)) : P(ridge, ty, top(ridge, ty)), B = alongX ? P(tx + 1, ridge, top(tx + 1, ridge)) : P(ridge, ty + 1, top(ridge, ty + 1));
      g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
    }
    g.stroke();
    // chimney on one tile
    if (tx === b.x0 && ty === b.y0) prism(g, P, tx + 0.25, ty + 0.25, tx + 0.5, ty + 0.5, top(tx + 0.4, ty + 0.4) - 0.2, top(tx + 0.4, ty + 0.4) + 0.55, "#5a4034");
  } else {
    const R = [P(tx, ty, H), P(tx + 1, ty, H), P(tx + 1, ty + 1, H), P(tx, ty + 1, H)];
    g.fillStyle = shade(b.roof, 0.42 + hash(tx, ty) * 0.05);
    poly(g, R); g.fill();
    if (z >= 0.8) fillTextured(g, "concrete", 0.7, anchor);
    // (no seam lines: a diagonal per tile made a criss-cross on every flat roof)
    // parapet: inner faces on the far edges, outer cornice on the near edges
    const pH = 0.22;
    const lip = (x0: number, y0: number, x1: number, y1: number, col: string) => { g.fillStyle = col; poly(g, [P(x0, y0, H), P(x1, y1, H), P(x1, y1, H + pH), P(x0, y0, H + pH)]); g.fill(); };
    if (!same(tx, ty - 1)) lip(tx, ty, tx + 1, ty, shade(b.color, 0.55));
    if (!same(tx - 1, ty)) lip(tx, ty, tx, ty + 1, shade(b.color, 0.45));
    if (southOpen) lip(tx, ty + 1, tx + 1, ty + 1, shade(b.color, 1.25));
    if (eastOpen) lip(tx + 1, ty + 1, tx + 1, ty, shade(b.color, 0.9));
    // rooftop plant: AC units, vents, water tanks on towers
    const r = hash(tx * 3 + 1, ty * 5 + b.id);
    const interior = same(tx, ty - 1) && same(tx - 1, ty);
    if (interior && r < 0.07) prism(g, P, tx + 0.2, ty + 0.25, tx + 0.7, ty + 0.65, H, H + 0.35, "#8a8580");
    else if (interior && r < 0.1) prism(g, P, tx + 0.35, ty + 0.35, tx + 0.6, ty + 0.6, H, H + 0.6, "#5a5550");
    else if (interior && (st === "tower" || st === "flats") && r > 0.94) tank(g, P, tx + 0.5, ty + 0.5, H, z);
    // antenna on the tallest towers
    if (st === "tower" && b.floors >= 9 && tx === Math.floor((b.x0 + b.x1) / 2) && ty === b.y0 + 1) {
      const A = P(tx + 0.5, ty + 0.5, H), B = P(tx + 0.5, ty + 0.5, H + 2.4);
      g.strokeStyle = "#9a8d80"; g.lineWidth = Math.max(1, 1.5 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      if (Math.floor(time * 1.2) % 2 === 0) { g.fillStyle = "#ff3b2f"; g.beginPath(); g.arc(B[0], B[1], 2.2 * z, 0, 6.283); g.fill(); }
    }
  }

  // ---- neon trim along the roofline at night ----
  if (night && NEON.has(b.kind) && st !== "house" && (southStreet || eastStreet)) {
    const glowA = Math.min(1, (dark - 0.25) * 2.2), a0 = alpha;
    const S0 = P(tx, ty + 1, H + 0.22), S1 = P(tx + 1, ty + 1, H + 0.22), E1 = P(tx + 1, ty, H + 0.22), C0 = P(tx + 1, ty + 1, 0.1);
    const tube = southStreet && eastStreet && (b.kind === "casino" || b.kind === "nightclub" || b.kind === "hotel");
    const paint = () => {
      g.globalAlpha = a0; g.lineCap = "round";
      for (const [lw, a] of [[6 * z, 0.2], [1.8 * z, 0.95]] as const) {
        g.strokeStyle = rgba(b.sign, a * glowA); g.lineWidth = Math.max(1, lw); g.beginPath();
        if (southStreet) { g.moveTo(S0[0], S0[1]); g.lineTo(S1[0], S1[1]); }
        if (eastStreet) { g.moveTo(S1[0], S1[1]); g.lineTo(E1[0], E1[1]); }
        if (tube) { g.moveTo(C0[0], C0[1]); g.lineTo(S1[0], S1[1]); }
        g.stroke();
      }
      g.lineCap = "butt"; g.globalAlpha = 1;
    };
    paint(); GLOW.push(paint);
  }

  // sign over the centre of the building
  const cx = Math.floor((b.x0 + b.x1) / 2), cy = Math.floor((b.y0 + b.y1) / 2);
  if (tx === cx && ty === cy) {
    const p = P(tx + 0.5, ty + 0.5, top(tx + 0.5, ty + 0.5) + (st === "house" ? 0 : 0.22)), a0 = alpha;
    roofTop(g, b, p[0], p[1], z, time, dark);
    // tenement roofs breathe steam in the cold, a SimCity night staple
    if ((st === "flats" || st === "civic") && z >= 0.8 && dark > 0.1) {
      for (let i = 0; i < 3; i++) {
        const ph = (time * 0.12 + i / 3 + hash(b.id, i)) % 1, rr = (2.5 + ph * 7) * z;
        g.fillStyle = `rgba(222,228,240,${(0.34 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(p[0] + (10 + ph * 8 + i * 2) * z, p[1] - (6 + ph * 38) * z, rr, 0, 6.283); g.fill();
      }
    }
    // signs are lights: repaint them over the night overlay
    if (dark > 0.3) GLOW.push(() => { g.globalAlpha = a0; roofTop(g, b, p[0], p[1], z, time, dark); g.globalAlpha = 1; });
  }
  g.globalAlpha = 1;
}

function poly(g: CanvasRenderingContext2D, pts: number[][]): void {
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
}

/** Small box on a roof (AC unit, vent, chimney): near faces + top. */
function prism(g: CanvasRenderingContext2D, P: (x: number, y: number, h: number) => [number, number], x0: number, y0: number, x1: number, y1: number, h0: number, h1: number, col: string): void {
  g.fillStyle = shade(col, 0.95); poly(g, [P(x0, y1, h0), P(x1, y1, h0), P(x1, y1, h1), P(x0, y1, h1)]); g.fill();
  g.fillStyle = shade(col, 0.7); poly(g, [P(x1, y1, h0), P(x1, y0, h0), P(x1, y0, h1), P(x1, y1, h1)]); g.fill();
  g.fillStyle = shade(col, 1.15); poly(g, [P(x0, y0, h1), P(x1, y0, h1), P(x1, y1, h1), P(x0, y1, h1)]); g.fill();
}

/** Classic rooftop water tank on legs. */
function tank(g: CanvasRenderingContext2D, P: (x: number, y: number, h: number) => [number, number], x: number, y: number, h: number, z: number): void {
  const base = P(x, y, h + 0.5), topP = P(x, y, h + 1.4), r = 11 * z;
  g.strokeStyle = "#3a3430"; g.lineWidth = Math.max(1, 1.2 * z); g.beginPath();
  for (const dx of [-0.6, 0.6]) { const a = P(x, y, h); g.moveTo(a[0] + dx * r, a[1]); g.lineTo(base[0] + dx * r, base[1]); }
  g.stroke();
  g.fillStyle = "#6b4a2e"; g.fillRect(base[0] - r, topP[1], r * 2, base[1] - topP[1]);
  g.beginPath(); g.ellipse(base[0], base[1], r, r * 0.5, 0, 0, Math.PI); g.fill();
  g.fillStyle = "#4a3020"; g.beginPath(); g.moveTo(topP[0] - r * 1.05, topP[1]); g.lineTo(topP[0], topP[1] - r * 0.9); g.lineTo(topP[0] + r * 1.05, topP[1]); g.closePath(); g.fill();
  g.strokeStyle = "rgba(14,11,10,.35)"; g.beginPath(); for (let k = 1; k < 3; k++) { const yy = topP[1] + (base[1] - topP[1]) * k / 3; g.moveTo(base[0] - r, yy); g.lineTo(base[0] + r, yy); } g.stroke();
}

/**
 * One exposed wall of one tile, from world point A to B along the ground. `lightK` dims the east face.
 * Windows and ledges follow the building's storeys so neighbouring tiles line up seamlessly.
 */
function wall(g: CanvasRenderingContext2D, b: Building, P: (x: number, y: number, h: number) => [number, number], top: (x: number, y: number) => number,
  ax: number, ay: number, bx: number, by: number, lightK: number, face: "s" | "e", tx: number, ty: number, z: number, dark: number, night: boolean, time: number): void {
  const st = styleOf(b), H = b.height;
  const glowA = night ? Math.min(1, (dark - 0.25) * 2.2) : 0, a0 = g.globalAlpha, wins: Win[] = [];
  const winAt = (a0_: number, a1: number, h0: number, h1: number, col: string, f: number, k: number) => { const A = at(a0_, h0), B = at(a1, h0), C = at(a1, h1), D = at(a0_, h1); wins.push({ A, B, C, D, col, seed: (tx * 131 + ty * 17 + f * 7 + k * 3 + b.id * 977 + (face === "e" ? 1 : 0)) | 0 }); };
  const o0 = P(0, 0, 0), anchor: TexAnchor = { x: o0[0], y: o0[1], zoom: z };
  const at = (t: number, h: number) => P(ax + (bx - ax) * t, ay + (by - ay) * t, h);
  // outline, following a gable if the roof rises along this edge
  const steps = st === "house" ? 6 : 1;
  const outline: number[][] = [P(ax, ay, 0), P(bx, by, 0)];
  for (let k = steps; k >= 0; k--) { const t = k / steps; outline.push(at(t, top(ax + (bx - ax) * t, ay + (by - ay) * t))); }
  g.fillStyle = shade(b.color, lightK);
  poly(g, outline); g.fill();
  // material: brick on shops/flats/houses, poured concrete on civic and clubs, glass streaks on towers
  if (z >= 0.8) fillTextured(g, st === "tower" ? "glass" : st === "civic" || st === "club" || st === "fuel" ? "concrete" : "brick", st === "tower" ? 0.5 : 0.75, anchor);
  // brick / siding texture on flats & houses (cheap: a few horizontal courses)
  if (st === "flats" || st === "house") {
    g.strokeStyle = `rgba(0,0,0,${st === "house" ? 0.12 : 0.1})`; g.lineWidth = 1; g.beginPath();
    const n = Math.round(H * (st === "house" ? 5 : 4));
    for (let k = 1; k < n; k++) { const h = (k / n) * H; const A = at(0, h), B = at(1, h); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
  }
  const floors = b.floors;
  const floorBase = (f: number) => (f === 0 ? 0 : GROUND_H + (f - 1) * FLOOR_H);
  const floorH = (f: number) => (f === 0 ? GROUND_H : FLOOR_H);
  // a cleaner block lights more of its windows and warms them; a littered one goes dim (0.35 is the old look)
  const shine = b.shine ?? 0.35, glow = (shine - 0.35) * 0.5;
  const lit = (f: number, k: number) => night && hash(tx * 7 + ty * 13 + f * 3 + k + (face === "e" ? 50 : 0), b.id) < (st === "flats" || st === "tower" ? 0.55 : 0.45) + glow;
  const litCol = (f: number, k: number) => { const r = hash(f * 11 + k, tx + ty * 3); return shine > 0.7 && r > 0.4 ? "#fff6c8" : r < 0.15 ? "#9fe8ff" : r < 0.55 ? "#ffd27a" : "#fff0c0"; };
  const quad = (t0: number, t1: number, h0: number, h1: number) => { const A = at(t0, h0), B = at(t1, h0), C = at(t1, h1), D = at(t0, h1); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(D[0], D[1]); g.closePath(); };
  const doorHere = b.door.face === face && (face === "s" ? b.door.x === tx && b.door.y === ty + 1 : b.door.x === tx + 1 && b.door.y === ty);

  // ---------- ground floor ----------
  if (st === "shop" || st === "club" || st === "fuel") {
    // full-width shop window
    const glow = night ? 1 : 0.35;
    g.fillStyle = night ? shade(b.sign, 0.5) : "rgba(30,38,52,.92)";
    g.beginPath(); quad(0.06, 0.94, 0.12, GROUND_H * 0.78); g.fill();
    if (glow > 0.5) { g.fillStyle = "rgba(255,230,180,.35)"; g.beginPath(); quad(0.06, 0.94, 0.12, GROUND_H * 0.5); g.fill(); }
    // sky reflection streak by day
    if (!night) { g.fillStyle = "rgba(200,225,255,.18)"; g.beginPath(); quad(0.2, 0.34, 0.15, GROUND_H * 0.75); g.fill(); }
    // mullions
    g.strokeStyle = shade(b.color, 0.5 * lightK); g.lineWidth = Math.max(1, 1.2 * z); g.beginPath();
    for (const t of [0.06, 0.5, 0.94]) { const A = at(t, 0.12), B = at(t, GROUND_H * 0.78); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
    // fascia band (where the shop name would be painted)
    g.fillStyle = shade(b.color, 0.55 * lightK); g.beginPath(); quad(0, 1, GROUND_H * 0.82, GROUND_H); g.fill();
    // striped awning sticking out over the footpath
    if (st !== "fuel") awning(g, P, ax, ay, bx, by, face, b.sign, lightK, z);
    if (st !== "fuel" && z >= 1) bladeSign(g, P, ax, ay, bx, by, face, b.sign, lightK, z, night, tx * 31 + ty * 17 + b.id);
  } else if (st === "tower" || st === "civic") {
    // lobby glass
    g.fillStyle = night ? "rgba(255,226,170,.75)" : "rgba(40,52,70,.9)";
    g.beginPath(); quad(0.1, 0.9, 0.1, GROUND_H * 0.82); g.fill();
    g.strokeStyle = shade(b.color, 0.6 * lightK); g.lineWidth = Math.max(1, z); g.beginPath();
    for (const t of [0.1, 0.36, 0.63, 0.9]) { const A = at(t, 0.1), B = at(t, GROUND_H * 0.82); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
    g.stroke();
    if (b.kind === "hospital") { g.fillStyle = "#ec2a1c"; g.beginPath(); quad(0.1, 0.9, GROUND_H * 0.86, GROUND_H * 0.98); g.fill(); }
    if (b.kind === "police") { g.fillStyle = "#1c6bd6"; g.beginPath(); quad(0, 1, GROUND_H * 0.86, GROUND_H * 0.98); g.fill(); g.fillStyle = "#eee4d3"; g.beginPath(); for (let k = 0; k < 6; k += 2) quad(k / 6, (k + 1) / 6, GROUND_H * 0.86, GROUND_H * 0.98); g.fill(); }
  } else {
    // houses & flats: two windows on the ground floor
    windows(g, quad, 0, GROUND_H * 0.25, GROUND_H * 0.72, lit(0, 0) || lit(0, 1), litCol(0, 0), night, 2);
  }
  // ---------- upper floors ----------
  if (st === "tower") {
    // glass curtain wall: dark glass with a sky gradient, mullion grid, scattered lit offices at night
    const h0 = GROUND_H, h1 = H;
    if (h1 > h0) {
      // sky reflected in the glass: lighter towards the top (two flat fills, no gradient object)
      const mid = h0 + (h1 - h0) * 0.55;
      g.fillStyle = lightK > 1 ? "#2c4060" : "#1c2a42"; g.beginPath(); quad(0.03, 0.97, h0 + 0.05, mid); g.fill();
      g.fillStyle = lightK > 1 ? "#4f7099" : "#33507a"; g.beginPath(); quad(0.03, 0.97, mid, h1 - 0.05); g.fill();
      if (night) {
        for (let f = 1; f < floors; f++) for (let k = 0; k < 3; k++) if (lit(f, k)) { g.fillStyle = litCol(f, k); g.beginPath(); quad(k / 3 + 0.03, (k + 1) / 3 - 0.03, floorBase(f) + 0.08, floorBase(f) + FLOOR_H - 0.12); g.fill(); if (z >= 0.8) winAt(k / 3 + 0.03, (k + 1) / 3 - 0.03, floorBase(f) + 0.08, floorBase(f) + FLOOR_H - 0.12, litCol(f, k), f, k); }
      }
      g.strokeStyle = shade(b.color, 0.85 * lightK); g.lineWidth = Math.max(1, 0.9 * z); g.beginPath();
      for (let f = 1; f <= floors; f++) { const h = Math.min(h1, floorBase(f)); const P0 = at(0, h), P1 = at(1, h); g.moveTo(P0[0], P0[1]); g.lineTo(P1[0], P1[1]); }
      for (const t of [0, 1 / 3, 2 / 3]) { const P0 = at(t, h0), P1 = at(t, h1); g.moveTo(P0[0], P0[1]); g.lineTo(P1[0], P1[1]); }
      g.stroke();
    }
  } else {
    // every storey's windows, sills and ledges go into a handful of batched paths (one fill each)
    type R = [number, number, number, number];
    const frames: R[] = [], dark: R[] = [], refl: R[] = [], sills: R[] = [], ledges: R[] = [], litBy = new Map<string, R[]>();
    const n = st === "house" ? 1 : 2, spans = n === 1 ? [[0.3, 0.7]] : [[0.14, 0.42], [0.58, 0.86]];
    for (let f = 1; f < floors; f++) {
      const base = floorBase(f), fh = floorH(f), h0 = base + fh * 0.22, h1 = base + fh * 0.78;
      const on = lit(f, 0) || (lit(f, 1) && n === 2), col = litCol(f, 0);
      for (const [a0, a1] of spans) {
        frames.push([a0 - 0.03, a1 + 0.03, h0 - 0.05, h1 + 0.05]);
        if (on) { const arr = litBy.get(col) ?? []; arr.push([a0, a1, h0, h1]); litBy.set(col, arr); if (z >= 0.8) winAt(a0, a1, h0, h1, col, f, a0 > 0.5 ? 1 : 0); } else dark.push([a0, a1, h0, h1]);
        if (!night) refl.push([a0, a0 + (a1 - a0) * 0.35, h0 + (h1 - h0) * 0.4, h1]);
        sills.push([a0 - 0.04, a1 + 0.04, h0 - 0.06, h0 - 0.01]);
      }
      if (st === "flats" && hash(f, tx + ty) < 0.5) {
        g.fillStyle = shade(b.color, 1.35 * lightK); g.beginPath(); quad(0.15, 0.85, base, base + 0.08); g.fill();
        g.strokeStyle = shade(b.color, 1.5 * lightK); g.lineWidth = Math.max(1, 0.8 * z); g.beginPath();
        for (let k = 0; k <= 6; k++) { const t = 0.15 + (k / 6) * 0.7, A = at(t, base + 0.08), B = at(t, base + 0.35); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
        const A = at(0.15, base + 0.35), B = at(0.85, base + 0.35); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
        g.stroke();
      } else if (st !== "house") ledges.push([0, 1, base - 0.04, base + 0.04]);
    }
    const batch = (rs: R[], col: string) => { if (!rs.length) return; g.fillStyle = col; g.beginPath(); for (const r of rs) quad(r[0], r[1], r[2], r[3]); g.fill(); };
    batch(ledges, shade(b.color, 1.3 * lightK));
    batch(frames, "rgba(238,228,211,.22)");
    batch(dark, night ? "rgba(10,12,20,.85)" : "rgba(28,38,56,.85)");
    for (const [col, rs] of litBy) batch(rs, col);
    batch(refl, `rgba(200,225,255,${(0.09 + shine * 0.22).toFixed(2)})`);
    batch(sills, "rgba(238,228,211,.35)");
    if (st === "flats" && z >= 0.8 && floors > 2) {
      const seed = hash(tx * 5 + ty * 11 + (face === "e" ? 9 : 0), b.id);
      if (seed < 0.38) {
        // iron fire escape: landings, rails and a zigzag of stairs, the tenement signature of the SimCity night streets
        const iron = night ? "rgba(8,6,12,.95)" : "rgba(26,22,28,.95)";
        g.strokeStyle = iron; g.lineCap = "butt";
        g.lineWidth = Math.max(1, 1.8 * z); g.beginPath();
        for (let f = 1; f < floors; f++) { const base = floorBase(f), A = at(0.1, base + 0.03), B = at(0.9, base + 0.03); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); }
        g.stroke();
        g.lineWidth = Math.max(1, 0.8 * z); g.beginPath();
        for (let f = 1; f < floors; f++) {
          const base = floorBase(f), A = at(0.1, base + 0.36), B = at(0.9, base + 0.36); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
          for (let k = 0; k <= 4; k++) { const t = 0.1 + k * 0.2, P0 = at(t, base + 0.03), P1 = at(t, base + 0.36); g.moveTo(P0[0], P0[1]); g.lineTo(P1[0], P1[1]); }
          if (f > 1) { const pb = floorBase(f - 1), left = f % 2 === 0, A0 = at(left ? 0.15 : 0.85, pb + 0.03), B0 = at(left ? 0.6 : 0.4, base + 0.03); g.moveTo(A0[0], A0[1]); g.lineTo(B0[0], B0[1]); }
        }
        g.stroke();
      } else if (seed < 0.52) {
        // washing line strung between two windows, a few shirts hanging
        const f = 1 + Math.floor(hash(tx + ty * 3, b.id + 5) * (floors - 1)), base = floorBase(f), y = base + 0.62;
        const A = at(0.04, y), B = at(0.96, y - 0.05);
        g.strokeStyle = night ? "rgba(60,54,60,.9)" : "rgba(40,34,40,.9)"; g.lineWidth = Math.max(1, 0.7 * z); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
        const cols = ["#eee4d3", "#3d7ad9", "#ec2a1c", "#f6b62c", "#ff7ad9"];
        g.beginPath(); const parts: [number, string][] = [];
        for (let k = 0; k < 4; k++) { const t = 0.2 + k * 0.17, yy = y - 0.05 * ((t - 0.04) / 0.92); parts.push([t, cols[Math.floor(hash(k * 7 + f, tx + ty + b.id) * cols.length)]]); void yy; }
        for (const [t, col] of parts) { const yy = y - 0.05 * ((t - 0.04) / 0.92); g.fillStyle = night ? shade(col, 0.55) : col; g.beginPath(); quad(t, t + 0.1, yy - 0.3, yy); g.fill(); }
      }
    }
  }
  // lit windows glow past the night overlay, with a household behind some of them
  if (wins.length && glowA > 0.02) { const own = wins.slice(), stories = z >= 1.1; GLOW.push((c) => { c.globalAlpha = a0; paintWindows(c, own, glowA, time, stories); c.globalAlpha = 1; }); }
  // shop fronts and lobbies throw warm light onto the footpath
  if (glowA > 0.02 && z >= 0.8 && (st === "shop" || st === "club" || st === "fuel" || st === "tower" || st === "civic")) {
    const ox = face === "e" ? 0.9 : 0, oy = face === "s" ? 0.9 : 0, n0 = P(ax, ay, 0), n1 = P(bx, by, 0), f0 = P(ax + ox, ay + oy, 0), f1 = P(bx + ox, by + oy, 0);
    const col = st === "tower" || st === "civic" ? "#ffe6b0" : "#ffd27a";
    GLOW.push((c) => { c.globalAlpha = a0; paintSpill(c, n0, n1, f0, f1, col, glowA); c.globalAlpha = 1; });
  }
  // nightclub: pulsing coloured windows
  if (st === "club" && night) {
    const hue = (time * 40 + tx * 30) % 360;
    g.fillStyle = `hsla(${hue},90%,60%,.35)`; g.beginPath(); quad(0.06, 0.94, 0.12, GROUND_H * 0.78); g.fill();
  }
  // front door
  if (doorHere) door(g, quad, b, night);
  // street-level grime + occlusion gradient up the bottom of the wall
  g.fillStyle = "rgba(14,11,10,.28)"; g.beginPath(); quad(0, 1, 0, 0.1); g.fill();
  g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); quad(0, 1, 0.1, 0.45); g.fill();
}

function windows(g: CanvasRenderingContext2D, quad: (t0: number, t1: number, h0: number, h1: number) => void, _base: number, h0: number, h1: number, lit: boolean, litCol: string, night: boolean, n: number): void {
  const spans = n === 1 ? [[0.3, 0.7]] : [[0.14, 0.42], [0.58, 0.86]];
  // frames
  g.fillStyle = "rgba(238,228,211,.22)"; g.beginPath(); for (const [a, b] of spans) quad(a - 0.03, b + 0.03, h0 - 0.05, h1 + 0.05); g.fill();
  g.fillStyle = lit ? litCol : night ? "rgba(10,12,20,.85)" : "rgba(28,38,56,.85)"; g.beginPath(); for (const [a, b] of spans) quad(a, b, h0, h1); g.fill();
  if (!night) { g.fillStyle = "rgba(200,225,255,.16)"; g.beginPath(); for (const [a, b] of spans) quad(a, a + (b - a) * 0.35, h0 + (h1 - h0) * 0.4, h1); g.fill(); }
  // sill
  g.fillStyle = "rgba(238,228,211,.35)"; g.beginPath(); for (const [a, b] of spans) quad(a - 0.04, b + 0.04, h0 - 0.06, h0 - 0.01); g.fill();
  // window box under the ground-floor windows: dark planter, green spill, one bloom
  if (h0 < 0.4) {
    g.fillStyle = "#3a2c24"; g.beginPath(); for (const [a, b] of spans) quad(a - 0.02, b + 0.02, h0 - 0.14, h0 - 0.06); g.fill();
    g.fillStyle = "#2a5f2a"; g.beginPath(); for (const [a, b] of spans) quad(a - 0.02, b + 0.02, h0 - 0.07, h0 - 0.01); g.fill();
  }
}

/** A blade sign hanging from a bracket at the end of the shop front: a small board in the shop's sign colour. */
function bladeSign(g: CanvasRenderingContext2D, P: (x: number, y: number, h: number) => [number, number], ax: number, ay: number, bx: number, by: number, face: "s" | "e", col: string, lightK: number, z: number, night: boolean, seed: number): void {
  const t = hash(seed, 5) < 0.5 ? 0.88 : 0.12, ox = face === "e" ? 0.3 : 0, oy = face === "s" ? 0.3 : 0;
  const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
  const wall = P(x, y, GROUND_H * 1.02), tip = P(x + ox, y + oy, GROUND_H * 1.02), top = P(x + ox, y + oy, GROUND_H * 0.99), bot = P(x + ox, y + oy, GROUND_H * 0.74);
  g.strokeStyle = "#0e0b0a"; g.lineWidth = Math.max(1, 1.4 * z); g.beginPath(); g.moveTo(wall[0], wall[1]); g.lineTo(tip[0], tip[1]); g.stroke();
  g.fillStyle = night ? shade(col, 0.85) : shade(col, 0.95 * lightK);
  g.fillRect(tip[0] - 4 * z, top[1] + 1 * z, 8 * z, bot[1] - top[1]);
  g.fillStyle = "rgba(238,228,211,.7)"; g.fillRect(tip[0] - 2.4 * z, top[1] + 4 * z, 4.8 * z, 1.4 * z);
}

function awning(g: CanvasRenderingContext2D, P: (x: number, y: number, h: number) => [number, number], ax: number, ay: number, bx: number, by: number, face: "s" | "e", col: string, lightK: number, z: number): void {
  const ox = face === "e" ? 0.38 : 0, oy = face === "s" ? 0.38 : 0;
  const hIn = GROUND_H * 0.95, hOut = GROUND_H * 0.7;
  const stripes = 6;
  for (let k = 0; k < stripes; k++) {
    const t0 = k / stripes, t1 = (k + 1) / stripes;
    const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
    g.fillStyle = k % 2 ? shade(col, 0.9 * lightK) : shade("#eee4d3", 0.92 * lightK);
    poly(g, [P(x0, y0, hIn), P(x1, y1, hIn), P(x1 + ox, y1 + oy, hOut), P(x0 + ox, y0 + oy, hOut)]); g.fill();
  }
  // valance
  g.fillStyle = shade(col, 0.7 * lightK);
  poly(g, [P(ax + ox, ay + oy, hOut), P(bx + ox, by + oy, hOut), P(bx + ox, by + oy, hOut - 0.12), P(ax + ox, ay + oy, hOut - 0.12)]); g.fill();
  void z;
}

function door(g: CanvasRenderingContext2D, quad: (t0: number, t1: number, h0: number, h1: number) => void, b: Building, night: boolean): void {
  const frame = b.kind === "casino" ? "#f6b62c" : b.kind === "police" ? "#3dd6ff" : "#0e0b0a";
  g.fillStyle = frame; g.beginPath(); quad(0.33, 0.67, 0, GROUND_H * 0.72); g.fill();
  g.fillStyle = night ? "rgba(255,226,170,.9)" : "rgba(60,74,96,.95)"; g.beginPath(); quad(0.37, 0.63, 0.02, GROUND_H * 0.66); g.fill();
  g.strokeStyle = frame; g.lineWidth = 1; g.beginPath(); quad(0.5, 0.5, 0.02, GROUND_H * 0.66); g.stroke();
}

function paintGraffiti(g: CanvasRenderingContext2D, gr: Graffiti | undefined, A: number[], B: number[], H: number, z: number): void {
  if (!gr) return;
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2 - Math.min(H * 0.45, 20 * z);
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  g.save();
  g.translate(mx, my); g.rotate(ang);
  const fs = Math.max(7, Math.min(16, 26 * z / Math.max(3, gr.text.length / 2)));
  g.font = `${gr.style % 2 ? "900" : "700"} ${fs}px "Big Shoulders Display", Impact, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  if (gr.legal || gr.style === 2) { g.fillStyle = "rgba(14,11,10,.5)"; g.fillRect(-fs * gr.text.length * 0.32, -fs * 0.7, fs * gr.text.length * 0.64, fs * 1.4); }
  g.lineWidth = Math.max(1, 2 * z); g.strokeStyle = "#0e0b0a"; g.strokeText(gr.text, 0, 0);
  g.fillStyle = gr.color; g.fillText(gr.text, 0, 0);
  if (gr.style === 3) { g.strokeStyle = gr.color; g.beginPath(); g.moveTo(-fs * 2, fs * 0.8); g.lineTo(fs * 2, fs * 0.6); g.stroke(); }
  g.restore();
}

function roofTop(g: CanvasRenderingContext2D, b: Building, x: number, y: number, z: number, time: number, dark: number): void {
  // neon name sign on a little frame
  const fs = Math.max(8, Math.round(12 * z));
  g.font = `800 ${fs}px "Big Shoulders Display", Impact, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  const label = b.kind === "house" ? "" : b.name.toUpperCase();
  if (label) {
    const glow = dark > 0.3;
    const w = g.measureText(label).width + 10;
    g.strokeStyle = "#3a3430"; g.lineWidth = Math.max(1, 1.5 * z); g.beginPath();
    g.moveTo(x - w * 0.3, y); g.lineTo(x - w * 0.3, y - 6 * z); g.moveTo(x + w * 0.3, y); g.lineTo(x + w * 0.3, y - 6 * z); g.stroke();
    g.fillStyle = "rgba(14,11,10,.82)";
    g.fillRect(x - w / 2, y - fs - 9 * z, w, fs + 5);
    if (glow) { g.strokeStyle = b.sign; g.globalAlpha *= 0.35; g.lineWidth = 4 * z; g.strokeText(label, x, y - 8 * z); g.globalAlpha /= 0.35; }
    g.fillStyle = b.sign;
    g.fillText(label, x, y - 8 * z);
  }
  if (b.billboard || b.kind === "gallery" || b.kind === "casino") billboard(g, b, x, y - (label ? fs + 14 * z : 0), z, time, dark);
  g.textAlign = "start";
}

/** Rooftop ads: MosaicScope (logo + one short line, clickable) or the casino's own board. */
function billboard(g: CanvasRenderingContext2D, b: Building, x: number, y: number, z: number, time: number, dark: number): void {
  const w = 100 * z, h = 34 * z;
  g.strokeStyle = "#3a3430"; g.lineWidth = 2 * z;
  g.beginPath(); g.moveTo(x - w * 0.3, y); g.lineTo(x - w * 0.3, y - 12 * z); g.moveTo(x + w * 0.3, y); g.lineTo(x + w * 0.3, y - 12 * z); g.stroke();
  if (dark > 0.3) { g.fillStyle = "rgba(255,240,190,.12)"; g.beginPath(); g.moveTo(x - w * 0.3, y - 12 * z); g.lineTo(x - w / 2, y - 12 * z - h); g.lineTo(x + w / 2, y - 12 * z - h); g.lineTo(x + w * 0.3, y - 12 * z); g.closePath(); g.fill(); }
  drawAd(g, b.kind === "casino" ? "casino" : "mosaic", x, y - 12 * z, w, h, b.id + Math.floor(time / 10), dark);
}
