import { h } from "./dom";
import { PAPER, RED, ACID, GOLD } from "../render/palette";

/** The skyline: the city's real buildings reduced to one neon outline. Pure, so it can be tested. */
export interface SkyBlock { x: number; w: number; h: number; sign: string; floors: number; name: string }
export interface SkyBuilding { x0: number; x1: number; y0?: number; floors: number; height: number; sign: string; name: string }

/**
 * Collapse the city into `cols` slim columns left to right, keeping the tallest building in each, so the
 * silhouette is the real one (the tallest towers really are the tallest). Heights are normalised to 0..1.
 */
export function skylineFrom(buildings: SkyBuilding[], cols = 26): SkyBlock[] {
  if (!buildings.length) return [];
  let lo = Infinity, hi = -Infinity, top = 0;
  for (const b of buildings) { lo = Math.min(lo, b.x0); hi = Math.max(hi, b.x1 + 1); top = Math.max(top, b.height); }
  const span = Math.max(1, hi - lo), best: (SkyBuilding | undefined)[] = new Array(cols).fill(undefined);
  for (const b of buildings) {
    const c = Math.min(cols - 1, Math.floor((((b.x0 + b.x1 + 1) / 2) - lo) / span * cols));
    if (!best[c] || b.height > best[c]!.height) best[c] = b;
  }
  const out: SkyBlock[] = [];
  for (let i = 0; i < cols; i++) {
    const b = best[i]; if (!b) continue;
    out.push({ x: i / cols, w: 1 / cols, h: Math.max(0.08, b.height / (top || 1)), sign: b.sign, floors: b.floors, name: b.name });
  }
  return out;
}

/** Outline of a skyline as one continuous polyline in unit space (y up from the ground line), drawn left to right. */
export function skylinePath(blocks: SkyBlock[]): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  const gap = 0.18;
  for (const b of blocks) {
    const x0 = b.x + b.w * gap / 2, x1 = b.x + b.w * (1 - gap / 2);
    pts.push([x0, 0], [x0, b.h], [x1, b.h], [x1, 0]);
  }
  pts.push([1, 0]);
  return pts;
}

export const TITLE_MS = 2200;
const FADE_MS = 450;

/**
 * Neon title card: the skyline draws itself line by line over the live game, bulbs light up, then it fades.
 * It never blocks play: it ignores the pointer, the game runs underneath, and any key, tap or click skips it.
 * Skipped outright under automation (unless ?title is in the URL), for reduced motion it is a short still.
 */
export function showTitle(root: HTMLElement, buildings: SkyBuilding[], opts: { reduceMotion?: boolean; owner?: string } = {}): () => void {
  const q = typeof location !== "undefined" ? location.search : "";
  if (typeof navigator !== "undefined" && (navigator as any).webdriver && !/[?&]title\b/.test(q)) return () => {};
  const blocks = skylineFrom(buildings), path = skylinePath(blocks);
  if (!blocks.length) return () => {};
  const cv = h("canvas.title-cv") as HTMLCanvasElement;
  const tag = h("div.title-tag", null, [h("b", { text: "THE MOSAICS" }), h("i", { text: " our world" })]);
  const skip = h("div.title-skip", { text: "any key to skip" });
  const el = h("div.title", { "aria-hidden": "true" }, [cv, tag, skip]);
  root.append(el);

  let raf = 0, done = false;
  const still = !!opts.reduceMotion, total = still ? 900 : TITLE_MS, t0 = performance.now();
  const finish = (): void => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    window.removeEventListener("keydown", finish, true); window.removeEventListener("pointerdown", finish, true);
    el.classList.add("out"); setTimeout(() => el.remove(), FADE_MS);
  };
  window.addEventListener("keydown", finish, true); window.addEventListener("pointerdown", finish, true);

  // segment lengths so the line is drawn at an even speed
  const seg: number[] = []; let len = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot((path[i][0] - path[i - 1][0]) * 1.8, path[i][1] - path[i - 1][1]); seg.push(d); len += d; }

  const draw = (): void => {
    if (done) return;
    const t = performance.now() - t0, p = still ? 1 : Math.min(1, t / (total * 0.62));
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext("2d"); if (!g) { finish(); return; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const mx = Math.max(16, W * 0.06), bw = W - mx * 2, base = H * 0.66, bh = Math.min(H * 0.42, bw * 0.34);
    const X = (u: number) => mx + u * bw, Y = (u: number) => base - u * bh;

    // sagging bulb string across the top: sodium, red, acid, twinkling like the website footer
    const bulbs = 18, bt = Math.min(1, t / 700 + (still ? 1 : 0));
    g.lineWidth = 1; g.strokeStyle = "rgba(238,228,211,.35)"; g.beginPath();
    for (let i = 0; i <= 60; i++) { const u = i / 60, x = X(u), y = H * 0.16 + Math.sin(u * Math.PI) * H * 0.05; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    const cols = [GOLD, RED, ACID];
    for (let i = 0; i < bulbs * bt; i++) {
      const u = (i + 0.5) / bulbs, x = X(u), y = H * 0.16 + Math.sin(u * Math.PI) * H * 0.05 + 5, tw = 0.65 + 0.35 * Math.sin(t / 180 + i * 1.7);
      g.fillStyle = cols[i % 3]; g.globalAlpha = tw; g.shadowColor = cols[i % 3]; g.shadowBlur = 10; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1; g.shadowBlur = 0;

    // dashed hairline ground
    g.setLineDash([4, 6]); g.strokeStyle = "rgba(238,228,211,.18)"; g.beginPath(); g.moveTo(mx * 0.5, base + 10); g.lineTo(W - mx * 0.5, base + 10); g.stroke(); g.setLineDash([]);

    // the skyline outline, drawn line by line
    let left = p * len;
    g.lineWidth = 2; g.lineJoin = "round"; g.strokeStyle = PAPER; g.shadowColor = PAPER; g.shadowBlur = 8; g.beginPath(); g.moveTo(X(path[0][0]), Y(path[0][1]));
    let tip: [number, number] = path[0];
    for (let i = 1; i < path.length && left > 0; i++) {
      const f = Math.min(1, left / (seg[i - 1] || 1)); left -= seg[i - 1];
      tip = [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f];
      g.lineTo(X(tip[0]), Y(tip[1]));
    }
    g.stroke(); g.shadowBlur = 0;
    if (p < 1) { g.fillStyle = ACID; g.shadowColor = ACID; g.shadowBlur = 14; g.beginPath(); g.arc(X(tip[0]), Y(tip[1]), 4, 0, 7); g.fill(); g.shadowBlur = 0; }

    // neon signs and lit windows appear on each tower once the line has passed it
    const tallest = blocks.reduce((m, b) => (b.h > blocks[m].h ? blocks.indexOf(b) : m), 0);
    blocks.forEach((b, i) => {
      if (tip[0] < b.x + b.w) return;
      const age = Math.min(1, (p * len / len - (b.x + b.w)) * 8 + 0.2), x0 = X(b.x + b.w * 0.09), x1 = X(b.x + b.w * 0.91), top = Y(b.h);
      const col = i === tallest ? RED : b.sign;
      g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.globalAlpha = Math.max(0, age); g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, top); g.lineTo(x1, top); g.stroke(); // coloured roof edge in the building's own sign colour
      g.shadowBlur = 0; g.fillStyle = GOLD;
      const rows = Math.min(8, Math.max(2, b.floors)), cw = (x1 - x0) / 3;
      for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) {
        if (((i * 7 + r * 3 + c * 5) % 5) < 2) continue; // some windows stay dark
        g.globalAlpha = Math.max(0, age) * (0.45 + 0.4 * ((i + r + c) % 3) / 2);
        g.fillRect(x0 + cw * (0.45 + c * 1.1), top + 8 + r * ((Y(0) - top - 12) / rows), cw * 0.5, 4);
      }
      g.globalAlpha = 1;
    });
    g.lineWidth = 1;

    tag.style.opacity = String(Math.min(1, Math.max(0, (t - total * 0.55) / 350)));
    skip.style.opacity = String(Math.min(0.7, t / 500));
    if (t >= total) { finish(); return; }
    raf = requestAnimationFrame(draw);
  };
  draw();
  return finish;
}
