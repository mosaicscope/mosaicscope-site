import * as THREE from "three";

/** Procedural surface art for the 3D lobby: every material gets a real texture, none is a flat colour. All painted once and cached. */
const cache = new Map<string, THREE.CanvasTexture>();
const rand = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export function paint(key: string, w: number, h: number, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const hit = cache.get(key); if (hit) return hit;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; fn(cv.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  cache.set(key, t); return t;
}

const noise = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, seed = 1) => { const r = rand(seed); for (let i = 0; i < n; i++) { g.fillStyle = r() > .5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } };

/** Cream and charcoal marble tiles, veined, with gold joints. */
export const marble = (repeat: [number, number] = [5, 4], checker = false) => paint("marble" + repeat + checker, 1024, 1024, (g, w, h) => {
  const r = rand(7), tile = w / 4;
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
    const dark = checker && (tx + ty) % 2 === 1, x = tx * tile, y = ty * tile, base = g.createLinearGradient(x, y, x + tile, y + tile);
    base.addColorStop(0, dark ? "#8a7f78" : "#f6efe3"); base.addColorStop(1, dark ? "#6d635e" : "#e6dcc9"); g.fillStyle = base; g.fillRect(x, y, tile, tile);
    g.save(); g.beginPath(); g.rect(x, y, tile, tile); g.clip();
    for (let v = 0; v < 7; v++) { g.strokeStyle = dark ? `rgba(212,175,90,${.1 + r() * .22})` : `rgba(110,100,95,${.08 + r() * .18})`; g.lineWidth = .6 + r() * 1.8; g.beginPath(); let px = x + r() * tile, py = y + r() * tile; g.moveTo(px, py); for (let s = 0; s < 5; s++) { px += (r() - .3) * 90; py += (r() - .3) * 90; g.quadraticCurveTo(px + (r() - .5) * 50, py + (r() - .5) * 50, px, py); } g.stroke(); }
    g.restore();
  }
  g.strokeStyle = "#c9a24a"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * tile, 0); g.lineTo(i * tile, h); g.moveTo(0, i * tile); g.lineTo(w, i * tile); g.stroke(); }
  noise(g, w, h, 5000, .035, 3);
}, repeat);

/** Deep burgundy carpet woven with a gold quatrefoil damask. */
export const carpet = (repeat: [number, number] = [6, 6], base = "#3b1119", gold = "#6a3340") => paint("carpet" + repeat + base, 512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const grad = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * .7); grad.addColorStop(0, "rgba(255,255,255,.05)"); grad.addColorStop(1, "rgba(0,0,0,.22)"); g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const step = 128;
  for (let y = 0; y <= h; y += step) for (let x = 0; x <= w; x += step) for (const [ox, oy] of [[0, 0], [step / 2, step / 2]]) {
    const cx = x + ox, cy = y + oy; g.strokeStyle = gold; g.fillStyle = gold; g.globalAlpha = .5; g.lineWidth = 2.4;
    for (let k = 0; k < 4; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI / 2); g.beginPath(); g.ellipse(0, -22, 13, 22, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, -42, 4, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = .22; g.beginPath(); g.moveTo(cx - 40, cy); g.quadraticCurveTo(cx, cy - 30, cx + 40, cy); g.stroke(); g.globalAlpha = 1;
  }
  noise(g, w, h, 9000, .05, 5);
}, repeat);

/** Table baize with a visible weave and a printed layout for each game. */
export const felt = (kind: string, base: string) => paint("felt" + kind + base, 1024, 1024, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.globalAlpha = .08; g.strokeStyle = "#000"; g.lineWidth = 1; for (let i = 0; i < w; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } g.globalAlpha = 1;
  const v = g.createRadialGradient(w / 2, h / 2, 120, w / 2, h / 2, w * .72); v.addColorStop(0, "rgba(255,255,255,.1)"); v.addColorStop(1, "rgba(0,0,0,.4)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#e5c566"; g.fillStyle = "#e5c566"; g.lineWidth = 6; g.textAlign = "center"; g.font = "700 56px Georgia,serif"; g.globalAlpha = .85;
  if (kind === "blackjack") { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w / 2, h * .25, 250 + i * 60, .15 * Math.PI, .85 * Math.PI); g.stroke(); } g.fillText("BLACKJACK PAYS 3 TO 2", w / 2, h * .62); g.font = "600 34px Georgia,serif"; g.fillText("DEALER STANDS ON SOFT 17", w / 2, h * .7); for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w * (.2 + i * .15), h * .85, 46, 0, Math.PI * 2); g.stroke(); } }
  else if (kind === "poker") { g.beginPath(); g.ellipse(w / 2, h / 2, w * .36, h * .3, 0, 0, Math.PI * 2); g.stroke(); g.fillText("HOLD'EM", w / 2, h * .5); for (let i = 0; i < 5; i++) g.strokeRect(w * .26 + i * 100, h * .6, 84, 118); }
  else if (kind === "roulette") { g.lineWidth = 4; g.font = "700 38px Georgia,serif"; for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) { const x = 150 + c * 62, y = 360 + r * 74; g.fillStyle = (r + c) % 2 ? "#a3142b" : "#0d0d10"; g.globalAlpha = .75; g.fillRect(x, y, 58, 70); g.globalAlpha = .9; g.strokeRect(x, y, 58, 70); g.fillStyle = "#fff"; g.fillText(String(c * 3 + 3 - r), x + 29, y + 48); } g.fillStyle = "#e5c566"; g.fillText("EUROPEAN ROULETTE", w / 2, 300); }
  else if (kind !== "blank") { g.font = "700 72px Georgia,serif"; g.fillText("THE TESSERA", w / 2, h / 2); }
  g.globalAlpha = 1; noise(g, w, h, 12000, .04, 9);
});

/** Mahogany with long grain and a lacquer sheen. */
export const wood = (repeat: [number, number] = [2, 1], base = "#3a1c10") => paint("wood" + repeat + base, 512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rand(11);
  for (let i = 0; i < 220; i++) { const y = r() * h, a = .05 + r() * .12; g.strokeStyle = r() > .5 ? `rgba(255,190,130,${a})` : `rgba(0,0,0,${a * 1.6})`; g.lineWidth = .5 + r() * 2.2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .02 + i) * 3 + (r() - .5) * 2); g.stroke(); }
  for (let k = 0; k < 6; k++) { const x = r() * w, y = r() * h; g.strokeStyle = "rgba(20,8,4,.35)"; for (let q = 1; q < 5; q++) { g.beginPath(); g.ellipse(x, y, q * 9, q * 3.2, 0, 0, Math.PI * 2); g.stroke(); } }
}, repeat);

/** Damask wallpaper in oxblood and gold, with a green wainscot band at the foot. */
export const wallpaper = (repeat: [number, number] = [6, 1]) => paint("wall" + repeat, 512, 512, (g, w, h) => {
  g.fillStyle = "#3d0c19"; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(0,0,0,.18)"; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
  g.strokeStyle = "#cfa94f"; g.fillStyle = "#cfa94f"; g.globalAlpha = .6;
  for (let y = 40; y < h; y += 120) for (let x = 64; x < w; x += 128) { g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 44); g.bezierCurveTo(x + 36, y - 20, x + 36, y + 20, x, y + 44); g.bezierCurveTo(x - 36, y + 20, x - 36, y - 20, x, y - 44); g.stroke(); g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; noise(g, w, h, 6000, .04, 4);
}, repeat);

/** Clothing weaves. Each Mosaic's outfit gets one so cloth never looks like plastic. */
export type Weave = "plain" | "pinstripe" | "herringbone" | "plaid" | "sequin" | "brocade" | "denim" | "satin";
export const fabric = (weave: Weave, base: string, accent: string) => paint(`fab${weave}${base}${accent}`, 128, 128, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rand(weave.length * 31 + base.length);
  if (weave === "pinstripe") { g.fillStyle = accent; g.globalAlpha = .55; for (let x = 6; x < w; x += 16) g.fillRect(x, 0, 2, h); }
  else if (weave === "herringbone") { g.strokeStyle = accent; g.globalAlpha = .35; g.lineWidth = 2; for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 8, y); g.lineTo(x + 16, y + 8); g.stroke(); } }
  else if (weave === "plaid") { g.fillStyle = accent; g.globalAlpha = .4; for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 10, h); g.fillRect(0, i, w, 10); } g.globalAlpha = .18; g.fillStyle = "#000"; for (let i = 16; i < w; i += 32) { g.fillRect(i, 0, 3, h); g.fillRect(0, i, w, 3); } }
  else if (weave === "sequin") { for (let y = 0; y < h; y += 6) for (let x = (y / 6 % 2) * 3; x < w; x += 6) { g.fillStyle = r() > .6 ? accent : r() > .5 ? "#ffffff" : base; g.globalAlpha = .35 + r() * .5; g.beginPath(); g.arc(x + 3, y + 3, 2.6, 0, Math.PI * 2); g.fill(); } }
  else if (weave === "brocade") { g.strokeStyle = accent; g.globalAlpha = .5; g.lineWidth = 1.6; for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) { g.beginPath(); g.ellipse(x, y, 7, 12, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(x, y, 12, 7, 0, 0, Math.PI * 2); g.stroke(); } }
  else if (weave === "denim") { g.strokeStyle = accent; g.globalAlpha = .3; g.lineWidth = 1; for (let i = -h; i < w; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); } }
  else if (weave === "satin") { const s = g.createLinearGradient(0, 0, w, h); s.addColorStop(0, "rgba(255,255,255,.28)"); s.addColorStop(.5, "rgba(0,0,0,.2)"); s.addColorStop(1, "rgba(255,255,255,.22)"); g.fillStyle = s; g.fillRect(0, 0, w, h); }
  g.globalAlpha = 1; noise(g, w, h, 900, .06, 2);
}, [1, 1]);

/** A glowing neon word as a sprite texture. */
export const neon = (text: string, color: string, size = 72) => paint("neon" + text + color + size, 512, 160, (g, w, h) => {
  g.font = `800 ${size}px 'Big Shoulders Display', Impact, 'Arial Narrow', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 16; g.lineWidth = 7; g.strokeStyle = color; g.strokeText(text, w / 2, h / 2 + 4); g.shadowBlur = 0; g.fillStyle = "#fff8ea"; g.fillText(text, w / 2, h / 2 + 4);
});

/** A coffered, stained-glass dome for the ceiling above the central fountain of light. */
export const dome = () => paint("dome", 1024, 1024, (g, w, h) => {
  const cx = w / 2, cy = h / 2; g.fillStyle = "#120a0f"; g.fillRect(0, 0, w, h);
  const cols = ["#d4af37", "#c0273d", "#2a7bd6", "#2fa36b", "#8a3ad1", "#e8742c"];
  for (let ring = 0; ring < 5; ring++) for (let s = 0; s < 24; s++) {
    const a0 = s / 24 * Math.PI * 2, a1 = (s + 1) / 24 * Math.PI * 2, r0 = 70 + ring * 85, r1 = r0 + 78;
    g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fillStyle = cols[(s + ring * 2) % cols.length]; g.globalAlpha = .75; g.fill(); g.globalAlpha = 1; g.strokeStyle = "#e5c566"; g.lineWidth = 4; g.stroke();
  }
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, 120); glow.addColorStop(0, "#fff7d6"); glow.addColorStop(1, "rgba(255,200,120,0)"); g.fillStyle = glow; g.fillRect(0, 0, w, h);
});

/** Soft round light for glows and sparkles. */
export const spark = (inner = "#fff", outer = "rgba(255,255,255,0)") => paint("spark" + inner + outer, 64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, inner); r.addColorStop(.35, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
