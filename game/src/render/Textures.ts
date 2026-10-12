/**
 * Procedural material textures: small tileable canvases generated once (seeded, so identical every
 * load) and used as CanvasPatterns over the ground and walls. No downloads, no image files, a few
 * KB of code. Each is drawn at low alpha on top of the flat colours, so the neon look stays and
 * surfaces gain grit: asphalt with grain and hairline cracks, poured concrete with pores, brick with
 * mortar courses, pavers, roof tiles and glass streaks.
 */
export type Material = "asphalt" | "concrete" | "brick" | "pavers" | "roof" | "glass" | "grass";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function make(size: number, draw: (g: CanvasRenderingContext2D, r: () => number, s: number) => void, seed: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = size; cv.height = size;
  const g = cv.getContext("2d")!;
  draw(g, rng(seed), size);
  return cv;
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

const SEEDS: Record<Material, number> = { asphalt: 11, concrete: 23, brick: 37, pavers: 41, roof: 53, glass: 67, grass: 79 };
const SIZE: Record<Material, number> = { asphalt: 96, concrete: 96, brick: 96, pavers: 96, roof: 96, glass: 96, grass: 96 };
const canvases = new Map<Material, HTMLCanvasElement>();
const patterns = new WeakMap<CanvasRenderingContext2D, Map<Material, CanvasPattern | null>>();

export function textureCanvas(m: Material): HTMLCanvasElement {
  let c = canvases.get(m);
  if (!c) { c = make(SIZE[m], DRAW[m], SEEDS[m]); canvases.set(m, c); }
  return c;
}

/** A CanvasPattern for this context (cached), or null if patterns aren't available. */
export function pattern(g: CanvasRenderingContext2D, m: Material): CanvasPattern | null {
  let per = patterns.get(g);
  if (!per) { per = new Map(); patterns.set(g, per); }
  if (!per.has(m)) { try { per.set(m, g.createPattern(textureCanvas(m), "repeat")); } catch { per.set(m, null); } }
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
