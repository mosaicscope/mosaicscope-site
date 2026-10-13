import { applyFilter, type FilterId, type FrameId, type WallFrame } from "../content/photos";

/**
 * Original frame art, drawn in code (no bitmaps): five polaroid styles, a plain frame, and the four
 * gallery-wall frames. Everything is drawn once per picture on a small canvas and then reused.
 */

export const PHOTO_W = 320, PHOTO_H = 240;

const mk = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

/** Cover-fit any canvas or image into a PHOTO_W x PHOTO_H picture and bake the filter in. */
export function capture(src: CanvasImageSource, sw: number, sh: number, filter: FilterId): HTMLCanvasElement {
  const c = mk(PHOTO_W, PHOTO_H), g = c.getContext("2d")!;
  const k = Math.max(PHOTO_W / sw, PHOTO_H / sh), w = sw * k, h = sh * k;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, (PHOTO_W - w) / 2, (PHOTO_H - h) / 2, w, h);
  if (filter !== "none") { const id = g.getImageData(0, 0, PHOTO_W, PHOTO_H); applyFilter(id.data, filter); g.putImageData(id, 0, 0); }
  return c;
}

const TILE_COLOURS = ["#ec2a1c", "#f6b62c", "#3dd6ff", "#6fe3b0", "#ff7ad9", "#eee4d3", "#c6ff3d"];
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

export const POLAROID_W = 260, POLAROID_H = 320;
const WIN = { x: 18, y: 18, w: 224, h: 224 * 0.75 + 20 }; // picture window (slightly taller than 4:3 so it reads as a snap)

function cover(g: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, x: number, y: number, w: number, h: number): void {
  const k = Math.max(w / iw, h / ih), dw = iw * k, dh = ih * k;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore();
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, colour: string, maxW: number, align: CanvasTextAlign = "center"): void {
  g.font = font; g.fillStyle = colour; g.textAlign = align; g.textBaseline = "alphabetic";
  let t = s;
  while (t.length > 1 && g.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
  g.fillText(t, x, y);
}

/** One polaroid: picture + frame + caption. `seed` makes the little random touches stable per shot. */
export function polaroid(photo: HTMLCanvasElement | HTMLImageElement, frame: FrameId, caption: string, stamp: string, seed: number): HTMLCanvasElement {
  const c = mk(POLAROID_W, POLAROID_H), g = c.getContext("2d")!;
  const R = rng(seed * 7919 + 13), iw = photo.width, ih = photo.height, { x, y, w, h } = WIN;
  const bottom = y + h;
  const hand = `italic 19px "Instrument Serif", Georgia, serif`;
  if (frame === "cream") {
    g.fillStyle = "#f3ead6"; g.fillRect(0, 0, c.width, c.height);
    const wear = g.createLinearGradient(0, 0, c.width, c.height); wear.addColorStop(0, "rgba(255,255,255,.35)"); wear.addColorStop(1, "rgba(120,90,40,.12)");
    g.fillStyle = wear; g.fillRect(0, 0, c.width, c.height);
    cover(g, photo, iw, ih, x, y, w, h);
    g.strokeStyle = "rgba(60,40,20,.25)"; g.lineWidth = 1; g.strokeRect(x - .5, y - .5, w + 1, h + 1);
    text(g, caption, c.width / 2, bottom + 40, hand, "#2b2118", w);
    text(g, stamp, c.width - 22, c.height - 14, `10px "IBM Plex Mono", monospace`, "rgba(60,40,20,.55)", 120, "right");
  } else if (frame === "dusk") {
    const sky = g.createLinearGradient(0, 0, 0, c.height); sky.addColorStop(0, "#2a2a6a"); sky.addColorStop(.55, "#8a4a8a"); sky.addColorStop(1, "#ffb48a");
    g.fillStyle = sky; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#fff6d8";
    for (let i = 0; i < 26; i++) { const sx = R() * c.width, sy = R() * 14 + (R() < .5 ? 0 : bottom + 4 + R() * 6), r = R() < .2 ? 1.6 : .8; if (sy < y - 2 || sy > bottom + 2) { g.globalAlpha = .5 + R() * .5; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); } }
    g.globalAlpha = 1;
    cover(g, photo, iw, ih, x, y, w, h);
    g.strokeStyle = "rgba(255,246,216,.7)"; g.lineWidth = 1.5; g.strokeRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = "rgba(14,11,40,.55)"; g.beginPath(); g.moveTo(0, c.height); for (let i = 0; i <= 13; i++) g.lineTo(i * 20, c.height - 12 - R() * 16); g.lineTo(c.width, c.height); g.fill();
    text(g, caption, c.width / 2, bottom + 36, hand, "#fff6d8", w);
  } else if (frame === "tape") {
    g.fillStyle = "#c9a26b"; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = .12; for (let i = 0; i < 400; i++) { g.fillStyle = R() < .5 ? "#fff" : "#5a3a10"; g.fillRect(R() * c.width, R() * c.height, 1.4, 1); } g.globalAlpha = 1;
    cover(g, photo, iw, ih, x, y, w, h);
    g.strokeStyle = "#3a2a14"; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    const strip = (cx: number, cy: number, rot: number) => { g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = "rgba(246,182,44,.82)"; g.fillRect(-30, -9, 60, 18); g.fillStyle = "rgba(255,255,255,.28)"; for (let i = -28; i < 28; i += 8) g.fillRect(i, -9, 3, 18); g.restore(); };
    strip(28, 14, -.6); strip(c.width - 28, 14, .6);
    text(g, caption, c.width / 2, bottom + 34, `italic 18px "Instrument Serif", Georgia, serif`, "#1c1a40", w);
    g.strokeStyle = "#1c1a40"; g.lineWidth = 1.4; g.beginPath(); const uy = bottom + 42; g.moveTo(34, uy); for (let i = 34; i < c.width - 34; i += 6) g.lineTo(i + 6, uy + (R() - .5) * 3); g.stroke();
  } else if (frame === "kerb") {
    g.fillStyle = "#0b0a0e"; g.fillRect(0, 0, c.width, c.height);
    cover(g, photo, iw, ih, x, y, w, h);
    g.shadowBlur = 10; g.lineWidth = 2.5;
    g.shadowColor = "#ec2a1c"; g.strokeStyle = "#ff4a3c"; g.strokeRect(8, 8, c.width - 16, c.height - 16);
    g.shadowColor = "#3dd6ff"; g.strokeStyle = "#7fe8ff"; g.strokeRect(x - 4, y - 4, w + 8, h + 8);
    g.shadowBlur = 0;
    text(g, caption.toUpperCase(), c.width / 2, bottom + 38, `700 17px "Big Shoulders Display", Impact, sans-serif`, "#eee4d3", w);
    text(g, stamp, c.width / 2, c.height - 16, `10px "IBM Plex Mono", monospace`, "#3dd6ff", w);
  } else {
    g.fillStyle = "#e8dfcc"; g.fillRect(0, 0, c.width, c.height);
    const t = 12;
    for (let tx = 0; tx < c.width; tx += t) for (let ty = 0; ty < c.height; ty += t) {
      const inside = tx + t > x - 2 && tx < x + w + 2 && ty + t > y - 2 && ty < y + h + 2;
      const caps = ty + t > bottom + 14 && ty < bottom + 52 && tx > 22 && tx + t < c.width - 22;
      if (inside || caps) continue;
      g.fillStyle = TILE_COLOURS[Math.floor(R() * TILE_COLOURS.length)]; g.fillRect(tx + 1, ty + 1, t - 2, t - 2);
      g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(tx + 1, ty + 1, t - 2, 2);
    }
    cover(g, photo, iw, ih, x, y, w, h);
    g.fillStyle = "#f6f0e2"; g.fillRect(22, bottom + 16, c.width - 44, 34);
    text(g, caption, c.width / 2, bottom + 39, `italic 18px "Instrument Serif", Georgia, serif`, "#1e1a14", w - 24);
  }
  // a little shine across every polaroid
  const sh = g.createLinearGradient(0, 0, c.width, c.height * .6); sh.addColorStop(0, "rgba(255,255,255,.10)"); sh.addColorStop(.5, "rgba(255,255,255,0)"); g.fillStyle = sh; g.fillRect(x, y, w, h);
  return c;
}

const WALL = {
  gold: { outer: "#8a6a18", mid: "#e8c04a", inner: "#a8821c", mat: "#f4efe2", plaque: "#d4af37" },
  ebony: { outer: "#0a0a0c", mid: "#2a2a32", inner: "#15151a", mat: "#e9e4d6", plaque: "#9aa0a8" },
  oak: { outer: "#6a4520", mid: "#b98850", inner: "#8a5e30", mat: "#efe6d0", plaque: "#c2a070" },
  white: { outer: "#cfcabc", mid: "#f6f3ea", inner: "#dedacb", mat: "#fbf9f3", plaque: "#b8b2a0" },
} as const;

/** A gallery-wall picture: layered frame, a mat, and a little brass plaque with the caption. */
export function framed(photo: HTMLCanvasElement | HTMLImageElement, kind: WallFrame, caption: string): HTMLCanvasElement {
  const f = WALL[kind], B = 14, M = 14, w = PHOTO_W + (B + M) * 2, ph = PHOTO_H + (B + M) * 2, c = mk(w, ph + 34), g = c.getContext("2d")!;
  g.fillStyle = f.outer; g.fillRect(0, 0, w, ph);
  g.fillStyle = f.mid; g.fillRect(3, 3, w - 6, ph - 6);
  g.fillStyle = f.inner; g.fillRect(B - 3, B - 3, w - (B - 3) * 2, ph - (B - 3) * 2);
  g.fillStyle = f.mat; g.fillRect(B, B, w - B * 2, ph - B * 2);
  g.drawImage(photo, B + M, B + M, PHOTO_W, PHOTO_H);
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; g.strokeRect(B + M - .5, B + M - .5, PHOTO_W + 1, PHOTO_H + 1);
  g.fillStyle = f.plaque; g.fillRect(w / 2 - 90, ph + 8, 180, 22);
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(w / 2 - 90, ph + 28, 180, 2);
  text(g, caption, w / 2, ph + 24, `600 12px "IBM Plex Mono", monospace`, "#1c1608", 168);
  return c;
}
