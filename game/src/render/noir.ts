/**
 * Louis's "noir pixel" look, copied from the 2D street references (see art-requests/003 to 010):
 * a dusk-blue and violet city, warm brick, lamp-amber windows, one near-black outline, flat two-tone shading.
 * Pure data and helpers so the street and interior renderers share one palette and the tests can pin it.
 */
export const NOIR = {
  ink: "#0e0b0a",          // the one outline colour, never pure black
  skyTop: "#2c2744", skyLow: "#7a6483", skyDusk: "#d08a6a",
  night: "#0b0a18",
  wallBrick: ["#7a3f36", "#6a3532", "#8a4a3c", "#5d2f30"],
  wallStone: ["#8c8a96", "#6f7488", "#5a6078", "#a39a8c"],
  wallPlaster: ["#b49c7c", "#9c8672", "#a8a0a4"],
  trim: "#2a2420", sill: "#9d93a0",
  glassDark: "#1e1b22", glassLit: "#f2b24c", glassGlow: "#ffe39a",
  road: "#24211f", roadFar: "#1b1918", kerb: "#7a7068", pave: "#4a443e", paveJoint: "#34302c",
  lane: "#c9bfa8", puddle: "#4a5d86",
  lampPost: "#2a2522", lampLight: "#ffd37a",
  cars: ["#1e1c24", "#2a3a58", "#5a2630", "#2c4a3c", "#3a3440", "#6a5a44"],
  awning: ["#a63030", "#2f5a6a", "#d8c8a0", "#3a6a48"],
  skin: ["#e8b48a", "#d99a6c", "#b97a52", "#8a5a3a", "#f0c8a0"],
  coat: ["#2a2a34", "#3a3040", "#4a3a2e", "#2c3a4a", "#5a4a3a", "#3a2a2a"],
} as const;

export const SHOP_NAMES = [
  "COLOMBO BOOKS", "AVON DAIRY", "CASHEL SHOES", "TUAM TAILORS", "HARDWARE", "FISH & CHIPS",
  "POST OFFICE", "PHARMACY", "GREENGROCER", "SALT & PEPPER", "BUTCHER", "TWO DOLLAR SHOP",
] as const;

export const hash01 = (n: number): number => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
export const pickOf = <T>(list: readonly T[], seed: number): T => list[Math.floor(hash01(seed) * list.length) % list.length];

const parse = (hex: string): [number, number, number] => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const toHex = (r: number, g: number, b: number): string => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");

/** Multiply brightness, keeping a violet cast in the shadows (what the references do). */
export function shade(hex: string, m: number): string {
  const [r, g, b] = parse(hex);
  return m >= 1 ? toHex(r * m, g * m, b * m) : toHex(r * m, g * m * 0.97, b * m * 1.06 + (1 - m) * 10);
}

/** Pull any colour toward the noir palette: lower saturation and brightness so bright toy colours sit in the dusk. */
export function muted(hex: string, amount = 0.55): string {
  const [r, g, b] = parse(hex), l = (r + g + b) / 3;
  return toHex((l + (r - l) * amount) * 0.7, (l + (g - l) * amount) * 0.68, (l + (b - l) * amount) * 0.78);
}

/** Blend two hex colours (t=0 gives a, t=1 gives b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a), [br, bg, bb] = parse(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/**
 * The 2D street takes its wall colour from the world's own building beside the player, so both views are one place.
 * The world colours are dark, so lift them to a readable wall and keep 45% of the noir material for texture and warmth.
 */
export function worldWall(material: string, buildingColor: string | undefined): string {
  if (!buildingColor) return material;
  return mix(material, shade(buildingColor, 2.1), 0.55);
}

/** The website's own tokens (styles.css :root) and neon colours (main.js COL): the source of truth for every view. */
export const SITE = { ink: "#0e0b0a", ink2: "#1a1412", paper: "#eee4d3", dim: "#9a8d80", red: "#ec2a1c", acid: "#c6ff3d", sodium: "#f6b62c" } as const;
export const NEONS = ["#c6ff3d", "#ff7ad9", "#3dd6ff", "#f6b62c", "#ec2a1c", "#eee4d3", "#b48cff"] as const;
