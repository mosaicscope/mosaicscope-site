import { StorageProvider, NS } from "./storage";

export interface Settings {
  quality: "auto" | "low" | "medium" | "high";
  volume: number;          // 0..1
  sound: boolean;
  reducedMotion: boolean | null; // null = follow the OS setting
  textScale: number;       // 0.85..1.5
  gentle: boolean;         // softer toy impacts
  fakeBlood: boolean;      // cartoon blood, wounds and splatter
  density: number;         // background crowd count
  showNames: boolean;
  tutorialDone: boolean;
  keys: Record<string, string>;
}

export const DEFAULT_KEYS: Record<string, string> = {
  up: "w", down: "s", left: "a", right: "d", pickup: "e", drop: "q", throw: "f", swing: " ", talk: "t", pause: "p", inspect: "i", log: "l", dev: "`", rob: "r", bandage: "b", horn: "h",
};

export const DEFAULT_SETTINGS: Settings = {
  quality: "auto", volume: 0.6, sound: true, fakeBlood: true, reducedMotion: null, textScale: 1, gentle: false, density: 420, showNames: true, tutorialDone: false, keys: { ...DEFAULT_KEYS },
};

/** Load settings defensively: any missing or wrong-typed field falls back to its default. */
export function loadSettings(store: StorageProvider): Settings {
  const raw = store.get(NS + "settings");
  const s: Settings = { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
  if (!raw) return s;
  try {
    const d = JSON.parse(raw);
    if (["auto", "low", "medium", "high"].includes(d.quality)) s.quality = d.quality;
    if (typeof d.volume === "number" && d.volume >= 0 && d.volume <= 1) s.volume = d.volume;
    if (typeof d.sound === "boolean") s.sound = d.sound;
    if (d.reducedMotion === null || typeof d.reducedMotion === "boolean") s.reducedMotion = d.reducedMotion;
    if (typeof d.textScale === "number" && d.textScale >= 0.85 && d.textScale <= 1.5) s.textScale = d.textScale;
    if (typeof d.gentle === "boolean") s.gentle = d.gentle;
    if (typeof d.fakeBlood === "boolean") s.fakeBlood = d.fakeBlood;
    if (typeof d.density === "number" && d.density >= 0 && d.density <= 5000) s.density = Math.round(d.density);
    if (typeof d.showNames === "boolean") s.showNames = d.showNames;
    if (typeof d.tutorialDone === "boolean") s.tutorialDone = d.tutorialDone;
    if (d.keys && typeof d.keys === "object") for (const k of Object.keys(DEFAULT_KEYS)) if (typeof d.keys[k] === "string" && d.keys[k].length >= 1) s.keys[k] = d.keys[k];
  } catch { /* corrupted settings: defaults */ }
  return s;
}

export function saveSettings(store: StorageProvider, s: Settings): void { store.set(NS + "settings", JSON.stringify(s)); }
