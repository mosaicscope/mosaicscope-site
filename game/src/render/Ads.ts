import { MOSAIC } from "../content/mosaicscope";

/**
 * In-world ads. MosaicScope boards carry the real logo (the same mark as the site header) and one
 * short line that always fits; every board is clickable and opens the site in a new tab. Boards
 * register their screen rectangles each frame so the game can hit-test clicks and hovers.
 */
export interface AdBox { x0: number; y0: number; x1: number; y1: number; url: string; label: string }
export const AD_BOXES: AdBox[] = [];

const FRAME = new Path2D("M2 9V2h7M23 2h7v7M30 23v7h-7M9 30H2v-7");
const TILE = new Path2D("M10.5 23V15.5M10.5 18.2c0-4.4 6-4.4 6 0V23M16.5 18.2c0-4.4 6-4.4 6 0V23");

/** The MosaicScope mark, `s` px square, top-left at (x, y). */
export function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, s: number, frame = "#0e0b0a"): void {
  g.save();
  g.translate(x, y); g.scale(s / 32, s / 32);
  g.lineCap = "butt"; g.lineJoin = "miter";
  g.strokeStyle = frame; g.lineWidth = 2.6; g.stroke(FRAME);
  g.strokeStyle = "#ec2a1c"; g.lineWidth = 2.8; g.lineCap = "square"; g.stroke(TILE);
  g.fillStyle = "#f6b62c"; g.fillRect(23.6, 8, 3.6, 3.6);
  g.restore();
}

/** Largest font size (<= max) at which `text` fits in `w`. */
function fit(g: CanvasRenderingContext2D, text: string, w: number, max: number, font: (px: number) => string): number {
  let px = max;
  for (; px > 5; px -= 0.5) { g.font = font(px); if (g.measureText(text).width <= w) break; }
  g.font = font(px);
  return px;
}

const DISPLAY = (wt: number) => (px: number) => `${wt} ${px}px "Big Shoulders Display", Impact, sans-serif`;
const MONO = (px: number) => `600 ${px}px "IBM Plex Mono", ui-monospace, monospace`;

export type AdKind = "mosaic" | "casino" | "cars" | "kiwi";

/**
 * Local, fictional Kiwi brands for the boards around town. Each is one glance: a name and one
 * short line. They match the shopfronts and interiors (Kiwibanc, Kiwi Bakehouse, Kiwi Gold).
 */
export const KIWI_ADS: { title: string; sub: string; bg: string; fg: string; ink: string }[] = [
  { title: "KIWIBANC", sub: "Banking for a bit of a kiwi", bg: "#2a2a33", fg: "#c6ff3d", ink: "#eee4d3" },
  { title: "KIWI BAKEHOUSE", sub: "Pies, pasties, flat whites", bg: "#4a3a2e", fg: "#f6b62c", ink: "#eee4d3" },
  { title: "JANDAL KING", sub: "Summer sorted. Jandals.", bg: "#1c4f6b", fg: "#eee4d3", ink: "#eee4d3" },
  { title: "HOKEY POKEY CO", sub: "Scoops since '52", bg: "#ec2a1c", fg: "#eee4d3", ink: "#eee4d3" },
  { title: "KIWI GOLD", sub: "Pokies, ka pai", bg: "#2a1630", fg: "#f6b62c", ink: "#eee4d3" },
  { title: "SHEARWELL WOOL", sub: "Warm as a woolly jersey", bg: "#eee4d3", fg: "#1c4f6b", ink: "#0e0b0a" },
  { title: "KAURI HARDWARE", sub: "Ute loads, tradie prices", bg: "#3a3430", fg: "#f6b62c", ink: "#eee4d3" },
  { title: "PAVLOVA PARLOUR", sub: "Pav. The only dessert.", bg: "#f6b62c", fg: "#0e0b0a", ink: "#0e0b0a" },
  { title: "NORWESTER LAGER", sub: "Cold ones, mate", bg: "#0e0b0a", fg: "#c6ff3d", ink: "#eee4d3" },
];

/** Taglines rotate; all short enough to read from a moving car. */
function mosaicLine(variant: number): string {
  const from = MOSAIC.rates[0]?.price ?? "$40";
  return ["Photos from " + from, "Music videos", "Book a shoot", MOSAIC.handle][variant % 4];
}

/**
 * Draw a board: centre-bottom at (cx, by), `w` x `h` screen px. Returns nothing; registers a click box.
 */
export function drawAd(g: CanvasRenderingContext2D, kind: AdKind, cx: number, by: number, w: number, h: number, variant: number, dark: number): void {
  const x0 = cx - w / 2, y0 = by - h;
  const night = dark > 0.3;
  g.save();
  g.textBaseline = "middle"; g.textAlign = "left";
  if (kind === "mosaic") {
    g.fillStyle = "#eee4d3"; g.fillRect(x0, y0, w, h);
    g.fillStyle = "#0e0b0a"; g.fillRect(x0, y0 + h - h * 0.08, w, h * 0.08);
    const pad = h * 0.14, ls = h - pad * 2;
    drawLogo(g, x0 + pad, y0 + pad, ls);
    const tx = x0 + pad * 2 + ls, tw = w - (tx - x0) - pad;
    // wordmark: "Mosaic" upright + "scope" italic, like the site
    const px = fit(g, "MOSAICscope", tw, h * 0.42, DISPLAY(900));
    g.fillStyle = "#0e0b0a"; g.fillText("Mosaic", tx, y0 + h * 0.36);
    const mw = g.measureText("Mosaic").width;
    g.font = `italic 700 ${px}px Georgia, "Times New Roman", serif`; g.fillStyle = "#ec2a1c";
    g.fillText("scope", tx + mw + px * 0.06, y0 + h * 0.36);
    fit(g, mosaicLine(variant), tw, h * 0.24, MONO);
    g.fillStyle = "#3a3430"; g.fillText(mosaicLine(variant), tx, y0 + h * 0.72);
  } else {
    const ad = kind === "kiwi" ? KIWI_ADS[((variant % KIWI_ADS.length) + KIWI_ADS.length) % KIWI_ADS.length] : null;
    const bg = ad ? ad.bg : kind === "casino" ? "#2a1630" : "#0e0b0a", fg = ad ? ad.fg : kind === "casino" ? "#f6b62c" : "#c6ff3d";
    g.fillStyle = bg; g.fillRect(x0, y0, w, h);
    const pad = h * 0.14, tw = w - pad * 2;
    const title = ad ? ad.title : kind === "casino" ? "THE TESSERA" : "MOORHOUSE MOTORS";
    const sub = ad ? ad.sub : kind === "casino" ? "Blackjack · Roulette · Pokies" : "JDM · Muscle · Super";
    g.textAlign = "center";
    fit(g, title, tw, h * 0.44, DISPLAY(900));
    if (night) { g.shadowColor = fg; g.shadowBlur = h * 0.25; }
    g.fillStyle = fg; g.fillText(title, cx, y0 + h * 0.38);
    g.shadowBlur = 0;
    fit(g, sub, tw, h * 0.22, MONO);
    g.fillStyle = ad ? ad.ink : "#eee4d3"; g.fillText(sub, cx, y0 + h * 0.74);
  }
  g.restore();
  if (kind === "mosaic") AD_BOXES.push({ x0, y0, x1: x0 + w, y1: by, url: MOSAIC.site, label: "Visit MosaicScope" });
}
