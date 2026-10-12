/**
 * Procedural material textures: small tileable canvases generated once (seeded, so identical every
 * load) and used as CanvasPatterns over the ground and walls. No downloads, no image files, a few
 * KB of code. Each is drawn at low alpha on top of the flat colours, so the neon look stays and
 * surfaces gain grit. ULTRA tier: 2x pixel density, extra weathering layers (oil stains, tyre marks,
 * moss, chips, water streaks, patched tarmac) and a baked bump-light pass (a height map from the
 * texture's own luminance, lit from the upper left) for that "normal-mapped" depth.
 * Standard tier: asphalt with grain and hairline cracks, poured concrete with pores, brick with
 * mortar courses, pavers, roof tiles and glass streaks.
 */
export type Material = "asphalt" | "concrete" | "brick" | "pavers" | "roof" | "glass" | "grass";

let ultra = false;
/** Switch texture tier. Returns true if it changed (callers then rebuild anything cached). */
export function setTextureTier(isUltra: boolean): boolean {
  if (isUltra === ultra) return false;
  ultra = isUltra; canvases.clear(); patterns = new WeakMap();
  return true;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function make(size: number, draw: (g: CanvasRenderingContext2D, r: () => number, s: number) => void, seed: number): HTMLCanvasElement {
  const U = ultra ? 2 : 1; // pixel density
  const cv = document.createElement("canvas");
  cv.width = size * U; cv.height = size * U;
  const g = cv.getContext("2d")!;
  g.scale(U, U);
  draw(g, rng(seed), size);
  if (ultra) bake(g, cv.width, 0.85);
  return cv;
}

/** Bake directional lighting from the texture's own luminance (wrap-around, so it still tiles). */
function bake(g: CanvasRenderingContext2D, n: number, k: number): void {
  const img = g.getImageData(0, 0, n, n), d = img.data, L = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const nw = L[((y + n - 1) % n) * n + (x + n - 1) % n], se = L[((y + 1) % n) * n + (x + 1) % n];
    const delta = (nw - se) * k, i = (y * n + x) * 4;
    d[i] = Math.max(0, Math.min(255, d[i] + delta)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + delta)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + delta));
  }
  g.putImageData(img, 0, 0);
}

/** Wrap-around speckle so the tile repeats seamlessly. */
function speckle(g: CanvasRenderingContext2D, r: () => number, s: number, n: number, light: string, dark: string, max = 1.6): void {
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, w = 0.5 + r() * max;
    g.fillStyle = r() < 0.5 ? light : dark;
    for (const dx of [0, -s]) for (const dy of [0, -s]) g.fillRect(x + dx, y + dy, w, w);
  }
}

const DRAW: Record<Material, (g: CanvasRenderingContext2D, r: () => number, s: number) => void> = {
  asphalt(g, r, s) {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    speckle(g, r, s, 900, "rgba(255,255,255,.35)", "rgba(0,0,0,.4)", 1.8);
    speckle(g, r, s, 60, "rgba(255,255,255,.55)", "rgba(0,0,0,.6)", 2.6); // aggregate stones
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 0.8; // hairline cracks
    for (let i = 0; i < 3; i++) { let x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.4) * 12; y += (r() - 0.5) * 8; g.lineTo(x, y); } g.stroke(); }
  },
  concrete(g, r, s) {
    g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, s, s);
    speckle(g, r, s, 500, "rgba(255,255,255,.25)", "rgba(0,0,0,.28)", 1.4);
    g.fillStyle = "rgba(0,0,0,.2)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(r() * s, r() * s, 0.6 + r() * 1.2, 0, 6.283); g.fill(); } // pores
    g.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < 5; i++) g.fillRect(0, r() * s, s, 3 + r() * 10); // formwork banding
  },
  brick(g, r, s) {
    const bh = 8, bw = 16; // course height / brick length
    g.fillStyle = "#6a6a6a"; g.fillRect(0, 0, s, s); // mortar
    for (let row = 0, y = 0; y < s; row++, y += bh) for (let x = -(row % 2) * (bw / 2); x < s; x += bw) {
      const v = 120 + (r() * 60) | 0; g.fillStyle = `rgb(${v + 20},${v},${v - 10})`; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(x + 1, y + 1, bw - 2, 1); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x + 1, y + bh - 2, bw - 2, 1);
    }
    speckle(g, r, s, 220, "rgba(255,255,255,.16)", "rgba(0,0,0,.2)", 1.2);
  },
  pavers(g, r, s) {
    const u = 16; g.fillStyle = "#6e6e6e"; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += u) for (let x = 0; x < s; x += u) { const v = 138 + (r() * 36) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 1, y + 1, u - 2, u - 2); }
    speckle(g, r, s, 260, "rgba(255,255,255,.18)", "rgba(0,0,0,.22)", 1.2);
  },
  roof(g, r, s) {
    const u = 12; g.fillStyle = "#777"; g.fillRect(0, 0, s, s);
    for (let y = 0, row = 0; y < s; y += u * 0.7, row++) for (let x = -(row % 2) * u / 2; x < s; x += u) { const v = 130 + (r() * 50) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(x + u / 2, y + 3, u / 2 - 0.5, 0, Math.PI); g.lineTo(x, y + 3); g.fill(); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 0.8; g.stroke(); }
  },
  glass(g, r, s) {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) { const x = r() * s, w = 2 + r() * 10; g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.08})`; g.save(); g.translate(x, 0); g.transform(1, 0, -0.35, 1, 0, 0); g.fillRect(0, 0, w, s); g.restore(); }
    speckle(g, r, s, 90, "rgba(255,255,255,.2)", "rgba(0,0,0,.12)", 1);
  },
  grass(g, r, s) {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    g.lineWidth = 1; for (let i = 0; i < 520; i++) { const x = r() * s, y = r() * s, l = 2 + r() * 4; g.strokeStyle = r() < 0.5 ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.28)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - l); g.stroke(); }
  },
};

/** Ultra-only weathering layers, drawn after the base material. */
const EXTRA: Record<Material, (g: CanvasRenderingContext2D, r: () => number, s: number) => void> = {
  asphalt(g, r, s) {
    for (let i = 0; i < 4; i++) { const x = r() * s, y = r() * s, rad = 5 + r() * 10, grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(0,0,0,.45)"); grd.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } // oil stains
    g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 2; i++) g.fillRect(r() * s, 0, 3 + r() * 4, s); // tyre scuffs
    g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(r() * s * 0.5, r() * s * 0.5, 22 + r() * 20, 16 + r() * 14); // patched tarmac
    speckle(g, r, s, 380, "rgba(255,255,255,.4)", "rgba(0,0,0,.45)", 1.1);
  },
  concrete(g, r, s) {
    g.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < 5; i++) { const x = r() * s; g.fillRect(x, 0, 1 + r() * 3, s * (0.4 + r() * 0.6)); } // rain streaks
    g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, s * 0.5, s, 1.2); // expansion joint
    speckle(g, r, s, 260, "rgba(255,255,255,.3)", "rgba(0,0,0,.32)", 1);
  },
  brick(g, r, s) {
    for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.2)"; g.fillRect(r() * s, r() * s, 1 + r() * 2.5, 1 + r() * 2); } // chips
    const grd = g.createLinearGradient(0, 0, 0, s); grd.addColorStop(0, "rgba(0,0,0,.18)"); grd.addColorStop(0.5, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,.1)"); g.fillStyle = grd; g.fillRect(0, 0, s, s); // weathering
  },
  pavers(g, r, s) {
    g.fillStyle = "rgba(60,110,60,.5)"; for (let i = 0; i < 60; i++) g.fillRect(r() * s, Math.floor(r() * (s / 16)) * 16 + 15, 1 + r() * 3, 1.2); // moss in the joints
    speckle(g, r, s, 200, "rgba(255,255,255,.25)", "rgba(0,0,0,.3)", 1);
  },
  roof(g, r, s) {
    for (let i = 0; i < 7; i++) { const x = r() * s, y = r() * s, rad = 3 + r() * 6, grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(70,120,60,.5)"); grd.addColorStop(1, "rgba(70,120,60,0)"); g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } // moss
    speckle(g, r, s, 140, "rgba(255,255,255,.18)", "rgba(0,0,0,.22)", 1);
  },
  glass(g, _r, s) {
    const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, "rgba(255,255,255,.12)"); grd.addColorStop(0.5, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(0,0,0,.1)"); g.fillStyle = grd; g.fillRect(0, 0, s, s);
    g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(0, s * 0.33, s, 1); g.fillRect(0, s * 0.66, s, 1); // mullions
  },
  grass(g, r, s) {
    for (let i = 0; i < 4; i++) { const x = r() * s, y = r() * s, rad = 6 + r() * 10, grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, "rgba(120,90,60,.35)"); grd.addColorStop(1, "rgba(120,90,60,0)"); g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } // bare earth
    g.fillStyle = "rgba(255,255,255,.3)"; for (let i = 0; i < 24; i++) { g.beginPath(); g.arc(r() * s, r() * s, 0.8, 0, 6.283); g.fill(); } // clover flowers
  },
};

const SEEDS: Record<Material, number> = { asphalt: 11, concrete: 23, brick: 37, pavers: 41, roof: 53, glass: 67, grass: 79 };
const SIZE: Record<Material, number> = { asphalt: 96, concrete: 96, brick: 96, pavers: 96, roof: 96, glass: 96, grass: 96 };
const canvases = new Map<Material, HTMLCanvasElement>();
let patterns = new WeakMap<CanvasRenderingContext2D, Map<Material, CanvasPattern | null>>();

export function textureCanvas(m: Material): HTMLCanvasElement {
  let c = canvases.get(m);
  if (!c) { c = make(SIZE[m], (g, r, sz) => { DRAW[m](g, r, sz); if (ultra) EXTRA[m](g, r, sz); }, SEEDS[m]); canvases.set(m, c); }
  return c;
}

/** A CanvasPattern for this context (cached), or null if patterns aren't available. */
export function pattern(g: CanvasRenderingContext2D, m: Material): CanvasPattern | null {
  let per = patterns.get(g);
  if (!per) { per = new Map(); patterns.set(g, per); }
  if (!per.has(m)) {
    try {
      const p = g.createPattern(textureCanvas(m), "repeat");
      if (p && ultra) p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0])); // 2x pixel density, same on-screen size
      per.set(m, p);
    } catch { per.set(m, null); }
  }
  return per.get(m) ?? null;
}

/** Fill the current path with a material at the given opacity (overlay-style: mid-grey textures only add grain). */
export function fillTextured(g: CanvasRenderingContext2D, m: Material, alpha: number): void {
  const p = pattern(g, m);
  if (!p) return;
  const a = g.globalAlpha, op = g.globalCompositeOperation;
  g.globalCompositeOperation = "overlay"; // neutral grey leaves the colour alone; speckles add grain
  g.globalAlpha = a * alpha; g.fillStyle = p; g.fill();
  g.globalCompositeOperation = op; g.globalAlpha = a;
}
