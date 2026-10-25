import { StorageProvider, NS } from "./storage";

export interface Settings {
  palette: "standard" | "deuteranopia" | "protanopia" | "tritanopia";
  autoPause: boolean;
  gamepad: boolean;
  quality: "auto" | "low" | "medium" | "high" | "ultra";
  volume: number;          // 0..1
  sound: boolean;
  sfx: boolean;            // in-world sounds (footsteps, cars, weather...), separate from the music
  sfxVolume: number;       // 0..1
  reducedMotion: boolean | null; // null = follow the OS setting
  textScale: number;       // 0.85..1.5
  gentle: boolean;         // softer toy impacts
  fakeBlood: boolean;      // cartoon blood, wounds and splatter
  density: number;         // background crowd count
  showNames: boolean;
  streetZoom?:number;
  tutorialDone: boolean;
  keys: Record<string, string>;
  /** Optional model brains for the Mosaics, keyed by backend id. Keys/tokens stay in this browser only. */
  brains: Record<string, BrainConf>;
}

export interface BrainConf { on: boolean; url: string; model: string; key: string }
export const BRAIN_IDS = ["ollama", "claude", "openai", "gemini", "openrouter", "hfdirect", "gguf", "webllm", "local", "hf"] as const;

export const DEFAULT_KEYS: Record<string, string> = {
  up: "w", down: "s", left: "a", right: "d", pickup: "e", drop: "q", throw: "f", swing: " ", talk: "t", pause: "p", inspect: "i", log: "l", dev: "`", rob: "r", bandage: "b", horn: "h",
};

export const DEFAULT_SETTINGS: Settings = {
  palette: "standard", autoPause: true, gamepad: true,
  quality: "auto", volume: 0.6, sound: false, sfx: false, sfxVolume: 0.8, fakeBlood: true, reducedMotion: null, textScale: 1, gentle: false, density: 150, showNames: true, tutorialDone: false, keys: { ...DEFAULT_KEYS }, brains: {},
};

/** Load settings defensively: any missing or wrong-typed field falls back to its default. */
export function loadSettings(store: StorageProvider): Settings {
  const raw = store.get(NS + "settings");
  const s: Settings = { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS }, brains: {} };
  if (!raw) return s;
  try {
    const d = JSON.parse(raw);
    if (["standard", "deuteranopia", "protanopia", "tritanopia"].includes(d.palette)) s.palette = d.palette;
    if (typeof d.autoPause === "boolean") s.autoPause = d.autoPause;
    if (typeof d.gamepad === "boolean") s.gamepad = d.gamepad;
    if (["auto", "low", "medium", "high", "ultra"].includes(d.quality)) s.quality = d.quality;
    if (typeof d.volume === "number" && d.volume >= 0 && d.volume <= 1) s.volume = d.volume;
    if (typeof d.sound === "boolean") s.sound = d.sound;
    if (typeof d.sfx === "boolean") s.sfx = d.sfx;
    if (typeof d.sfxVolume === "number" && d.sfxVolume >= 0 && d.sfxVolume <= 1) s.sfxVolume = d.sfxVolume;
    if (d.reducedMotion === null || typeof d.reducedMotion === "boolean") s.reducedMotion = d.reducedMotion;
    if (typeof d.textScale === "number" && d.textScale >= 0.85 && d.textScale <= 1.5) s.textScale = d.textScale;
    if (typeof d.gentle === "boolean") s.gentle = d.gentle;
    if (typeof d.fakeBlood === "boolean") s.fakeBlood = d.fakeBlood;
    if (typeof d.density === "number" && d.density >= 0 && d.density <= 5000) s.density = Math.round(d.density);
    if(typeof d.streetZoom==="number"&&Number.isFinite(d.streetZoom)&&d.streetZoom>=.55&&d.streetZoom<=7)s.streetZoom=d.streetZoom;
    if (typeof d.showNames === "boolean") s.showNames = d.showNames;
    if (typeof d.tutorialDone === "boolean") s.tutorialDone = d.tutorialDone;
    if (d.brains && typeof d.brains === "object") for (const id of BRAIN_IDS) {
      const b = d.brains[id];
      if (!b || typeof b !== "object") continue;
      const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : "");
      s.brains[id] = { on: b.on === true, url: str(b.url, 500), model: str(b.model, 200), key: str(b.key, 300) };
    }
    if (d.keys && typeof d.keys === "object") for (const k of Object.keys(DEFAULT_KEYS)) if (typeof d.keys[k] === "string" && d.keys[k].length >= 1) s.keys[k] = d.keys[k];
  } catch { /* corrupted settings: defaults */ }
  return s;
}

export function saveSettings(store: StorageProvider, s: Settings): void { store.set(NS + "settings", JSON.stringify(s)); }
