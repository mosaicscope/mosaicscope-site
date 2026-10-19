import type { StorageProvider } from "../persistence/storage";
import { NS } from "../persistence/storage";

/**
 * Photo mode, polaroids and the two walls. Pure and DOM-free so it can be tested: frame and filter
 * tables, the pixel filters, the album (persisted under its own key, not in the world save) and the
 * moments that earn a picture. Drawing lives in src/render/PolaroidArt.ts, panels in src/ui/Photos.ts.
 */

export type FrameId = "cream" | "dusk" | "tape" | "kerb" | "tile";
export type FilterId = "none" | "warm" | "noir" | "fade" | "neon" | "golden" | "night" | "grain";

/** Five original polaroid frame styles. `plain` is photo mode's "no frame" and is not a polaroid. */
export const FRAMES: Record<FrameId, { name: string; blurb: string }> = {
  cream: { name: "Harbour Cream", blurb: "Classic cream card, soft corners, handwritten caption" },
  dusk: { name: "Port Hills Dusk", blurb: "Indigo to peach sky with a scatter of stars" },
  tape: { name: "Tape & Biro", blurb: "Kraft card, two strips of tape, a biro underline" },
  kerb: { name: "Neon Kerb", blurb: "Black card, red and cyan tube lines" },
  tile: { name: "Mosaic Tile", blurb: "A border of little hand-laid tiles" },
};
export const FRAME_IDS = Object.keys(FRAMES) as FrameId[];

export const FILTERS: Record<FilterId, { name: string }> = {
  night: { name: "Night lens" }, grain: { name: "Grain’s film" },
  none: { name: "Straight" }, warm: { name: "Verandah" }, noir: { name: "Noir" }, fade: { name: "Faded" }, neon: { name: "After Dark" }, golden: { name: "Golden Hour" },
};
export const FILTER_IDS = Object.keys(FILTERS) as FilterId[];

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Apply a filter in place to RGBA pixel data. Pure per-pixel maths, so it works in every browser. */
export function applyFilter(d: Uint8ClampedArray, id: FilterId): void {
  if (id === "none") return;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    switch (id) {
      case "night": r = Math.sqrt(r / 255) * 255; g = Math.sqrt(g / 255) * 255; b = Math.sqrt(b / 255) * 255 + 8; break;
      case "grain": { const noise = ((i * 17 + 31) % 19) - 9; r = r * 0.9 + 24 + noise; g = g * 0.86 + 19 + noise; b = b * 0.72 + 16 + noise; break; }
      case "warm": r = r * 1.08 + 8; g = g * 1.02 + 2; b = b * 0.88; break;
      case "noir": { const c = clamp((l - 128) * 1.25 + 120); r = g = b = c; break; }
      case "fade": r = l * 0.35 + r * 0.65 * 0.9 + 26; g = l * 0.35 + g * 0.65 * 0.9 + 24; b = l * 0.35 + b * 0.65 * 0.9 + 30; break;
      case "neon": r = l + (r - l) * 1.5 + (l > 110 ? 18 : -6); g = l + (g - l) * 1.3 - 8; b = l + (b - l) * 1.6 + 22; break;
      case "golden": r = r * 1.12 + 14; g = g * 1.04 + 6; b = b * 0.8; break;
    }
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
}

export type ShotKind = "photo" | "moment";
export interface Shot {
  id: number;
  /** epoch ms */
  t: number;
  kind: ShotKind;
  frame: FrameId;
  filter: FilterId;
  caption: string;
  /** how good the moment was, 1..10; photos you take yourself get 3 */
  score: number;
  /** key of the deed or event that earned it ("kiss", "recycle"…); empty for a plain photo */
  deed: string;
  /** JPEG data URL of the picture itself (the frame is drawn around it on display) */
  img: string;
}

/** Events in your life worth a picture, with how much they are worth on the gallery wall. */
export const MOMENTS: Record<string, { score: number; caption: (street: string, other: string) => string }> = {
  kiss: { score: 8, caption: (_s, o) => (o ? `A moment with ${o}` : "A moment") },
  date: { score: 8, caption: (_s, o) => (o ? `Date night with ${o}` : "Date night") },
  friendship: { score: 6, caption: (_s, o) => (o ? `New mate: ${o}` : "New mate") },
  reconcile: { score: 6, caption: (_s, o) => (o ? `Made up with ${o}` : "Made up") },
  car_crash: { score: 5, caption: (s) => `Crunch on ${s}` },
  car_hit: { score: 4, caption: (s) => `Rude awakening, ${s}` },
  arrest: { score: 5, caption: (s) => `Busted, ${s}` },
  busted: { score: 5, caption: (s) => `Busted, ${s}` },
  crime: { score: 3, caption: (s) => `Naughty on ${s}` },
  collapse: { score: 3, caption: () => "Lights out" },
  hospital: { score: 3, caption: () => "Patched up at the hospital" },
  caught_cheating: { score: 6, caption: () => "Caught. Awkward." },
  breakup: { score: 4, caption: (_s, o) => (o ? `It's over with ${o}` : "It's over") },
  recycle: { score: 5, caption: (n) => `${n} returned. The street thanks you` },
  photo: { score: 3, caption: () => "" },
};

export const ALBUM_MAX = 40;
export const WALL_COUNT = 8;
const KEY = NS + "album";

/** The album: every picture you took or earned. Newest last. Survives new worlds. */
export class Album {
  shots: Shot[] = [];
  private nextId = 1;
  constructor(private store: StorageProvider | null = null) { this.load(); }

  private load(): void {
    const raw = this.store?.get(KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (!Array.isArray(d)) return;
      this.shots = d.filter(isShot).slice(-ALBUM_MAX);
      this.nextId = this.shots.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    } catch { /* corrupt album: start empty */ }
  }

  save(): boolean {
    if (!this.store) return true;
    // quota guard: if the write fails, drop the oldest low-scoring shot and retry a few times
    for (let i = 0; i < 6; i++) {
      if (this.store.set(KEY, JSON.stringify(this.shots))) return true;
      this.shots.splice(this.weakestIndex(), 1);
    }
    return false;
  }

  add(s: Omit<Shot, "id" | "t"> & { t?: number }): Shot {
    const shot: Shot = { ...s, id: this.nextId++, t: s.t ?? Date.now(), score: Math.max(1, Math.min(10, Math.round(s.score))), caption: s.caption.slice(0, 40) };
    this.shots.push(shot);
    while (this.shots.length > ALBUM_MAX) this.shots.splice(this.weakestIndex(), 1);
    this.save();
    return shot;
  }

  /** Oldest of the lowest-scoring shots goes first when the album is full. */
  private weakestIndex(): number {
    let at = 0;
    for (let i = 1; i < this.shots.length; i++) if (this.shots[i].score < this.shots[at].score) at = i;
    return at;
  }

  /** The reputation wall: what you've done lately, newest first. */
  latest(n = WALL_COUNT): Shot[] { return this.shots.slice(-n).reverse(); }
  /** The gallery wall: your best moments, best first, ties go to the newer one. */
  best(n = WALL_COUNT): Shot[] { return [...this.shots].sort((a, b) => b.score - a.score || b.t - a.t).slice(0, n); }
  remove(id: number): void { this.shots = this.shots.filter((s) => s.id !== id); this.save(); }
  get total(): number { return this.shots.reduce((t, s) => t + s.score, 0); }
}

function isShot(s: any): s is Shot {
  return s && typeof s.id === "number" && typeof s.t === "number" && typeof s.img === "string" && typeof s.caption === "string" && typeof s.score === "number"
    && (s.kind === "photo" || s.kind === "moment") && s.frame in FRAMES && s.filter in FILTERS && typeof s.deed === "string";
}

/** Your standing in town as shown on the reputation wall (album score plus the sim's own -1..1 reputation). */
export function standing(album: Album, simRep: number): { title: string; points: number } {
  const points = Math.max(0, Math.round(album.total + simRep * 10));
  const title = points >= 80 ? "Local legend" : points >= 45 ? "Face about town" : points >= 20 ? "Known around here" : points >= 6 ? "Getting noticed" : "New in town";
  return { title, points };
}

/** Gallery wall frame for a rank (0 = best). Plaque colours are drawn by PolaroidArt. */
export type WallFrame = "gold" | "ebony" | "oak" | "white";
export const wallFrameFor = (rank: number): WallFrame => (rank === 0 ? "gold" : rank < 3 ? "ebony" : rank < 6 ? "oak" : "white");

/** Cheap hash so every shot always sits on the wall at the same tilt. */
export function tiltFor(id: number): number { let x = (id * 2654435761) >>> 0; x = (x ^ (x >>> 13)) >>> 0; return ((x % 1000) / 1000 - 0.5) * 6; }

/** How long to wait between automatic moments, and per deed, so the wall never fills with one thing. */
export const MOMENT_GAP_MS = 15000;
export const DEED_GAP_MS = 60000;
export class MomentGate {
  private last = -1e12; private byDeed = new Map<string, number>();
  allow(deed: string, now: number): boolean {
    if (now - this.last < MOMENT_GAP_MS) return false;
    if (now - (this.byDeed.get(deed) ?? -1e12) < DEED_GAP_MS) return false;
    this.last = now; this.byDeed.set(deed, now);
    return true;
  }
}
