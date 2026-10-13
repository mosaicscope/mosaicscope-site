/**
 * Audio preferences for the street's diegetic sounds: speech blips, footsteps and ambience.
 * Pure data and maths only (no Web Audio here), so the Diegetic class and the settings UI can both use it.
 */

/** Speech blip preferences: who is muted, how the voice sounds, and how often blips may play. */
export interface VoicePrefs {
  /** master switch for every speech blip */
  enabled: boolean;
  /** character ids whose blips are silenced */
  muted: ReadonlySet<number>;
  /** pitch multiplier applied to every blip, 0.5 (low) to 2 (high) */
  pitch: number;
  /** blip loudness, 0 to 1 */
  volume: number;
  /** blip duration multiplier, 0.5 (fast) to 2 (slow). Higher is slower. */
  speed: number;
  /** most blips allowed in any one second across all speakers (the blip frequency limit) */
  maxPerSec: number;
  /** blip tone shape: "triangle" (soft), "square" (buzzy) or "sine" (pure) */
  shape: "triangle" | "square" | "sine";
  /** radio / walkie-talkie: buzzier tone and quieter blips */
  radio: boolean;
  /** equaliser preset: "flat" as recorded, "bright" lifts the pitch, "warm" lowers it */
  eq: "flat" | "bright" | "warm";
  /** randomised tones: each blip's pitch wobbles a little so the same speaker never sounds identical twice */
  randomTone: boolean;
}

export const DEFAULT_VOICE: VoicePrefs = {
  enabled: true,
  muted: new Set<number>(),
  pitch: 1,
  volume: 1,
  speed: 1,
  maxPerSec: 6,
  shape: "triangle",
  radio: false,
  eq: "flat",
  randomTone: false,
};

/** The tone shape and loudness a blip uses, with the radio filter applied when it is on. */
export function voiceTone(prefs: VoicePrefs): { shape: VoicePrefs["shape"]; gain: number } {
  const gain = voiceGain(prefs);
  return prefs.radio ? { shape: "square", gain: gain * 0.6 } : { shape: prefs.shape, gain };
}

/** Footstep preferences: loudness, the shoe sound, and whether sneaking silences the steps. */
export interface FootPrefs {
  enabled: boolean;
  /** footstep loudness, 0 to 1 */
  volume: number;
  /** "boots" are heavier and lower, "sneakers" are lighter and quieter, "default" is the original sound */
  shoe: "default" | "boots" | "sneakers";
  /** when true, the player's steps are quieter while sneaking */
  silenceWhenSneaking: boolean;
  /** how much quieter sneaking steps are, 0 (no change) to 1 (silent) */
  sneakAmount: number;
  /** step delay offset in seconds: pushes every footstep later (negative values are clamped to 0) */
  delay: number;
}

export const DEFAULT_FOOT: FootPrefs = {
  enabled: true,
  volume: 1,
  shoe: "default",
  silenceWhenSneaking: true,
  sneakAmount: 0.7,
  delay: 0,
};

/** Ambience preferences: the background beds (rain, wind, crickets, crowd). */
export interface AmbiencePrefs {
  /** mute the whole ambience bus */
  muted: boolean;
  /** how long a change takes to fade in or out, in seconds */
  fadeSecs: number;
}

export const DEFAULT_AMBIENCE: AmbiencePrefs = { muted: false, fadeSecs: 1.2 };

const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** Blip pitch for a character: the old per-person voice, moved by the pitch preference. */
export function voicePitch(id: number, prefs: VoicePrefs): number {
  const base = 220 + ((id * 37) % 260);
  const eq = prefs.eq === "bright" ? 1.12 : prefs.eq === "warm" ? 0.9 : 1;
  return base * clamp(prefs.pitch, 0.5, 2) * eq;
}

/** Blip length in seconds for the speed preference. */
export function voiceDuration(prefs: VoicePrefs): number {
  return 0.07 * clamp(prefs.speed, 0.5, 2);
}

/** Blip loudness for the volume preference. */
export function voiceGain(prefs: VoicePrefs): number {
  return 0.12 * clamp(prefs.volume, 0, 1);
}

/**
 * Whether a blip may play now: the speaker is not muted, the feature is on, and the blip frequency limit
 * has room. `recent` holds the times (seconds) of blips already played; it is pruned in place to the last second.
 */
export function voiceAllowed(prefs: VoicePrefs, id: number, now: number, recent: number[]): boolean {
  if (!prefs.enabled || prefs.muted.has(id)) return false;
  while (recent.length && now - recent[0] > 1) recent.shift();
  if (recent.length >= clamp(prefs.maxPerSec, 1, 60)) return false;
  recent.push(now);
  return true;
}

/** Footstep loudness: the volume preference, lowered while sneaking when that is switched on. */
export function footGain(prefs: FootPrefs, sneaking: boolean): number {
  if (!prefs.enabled) return 0;
  const sneak = sneaking && prefs.silenceWhenSneaking ? 1 - clamp(prefs.sneakAmount, 0, 1) : 1;
  return clamp(prefs.volume, 0, 1) * sneak;
}

/** Pitch multiplier for a shoe: boots sit low, sneakers sit high, the default is unchanged. */
export function shoePitch(shoe: FootPrefs["shoe"]): number {
  return shoe === "boots" ? 0.82 : shoe === "sneakers" ? 1.18 : 1;
}

/** Ambience gain: 0 when muted, otherwise 1. The fade time is applied by the caller. */
export function ambienceGain(prefs: AmbiencePrefs): number {
  return prefs.muted ? 0 : 1;
}

/** One-shot UI tones: a short pitched blip for each interface event. */
export type UiTone = "hover" | "click" | "tab" | "error" | "save" | "tick" | "modal" | "toast" | "levelUp" | "pickup";

export interface UiToneSpec { freq: number; freqEnd: number; dur: number; vol: number; shape: VoicePrefs["shape"] }

export const UI_TONES: Record<UiTone, UiToneSpec> = {
  hover: { freq: 1400, freqEnd: 1500, dur: 0.03, vol: 0.05, shape: "sine" },
  click: { freq: 880, freqEnd: 660, dur: 0.05, vol: 0.12, shape: "triangle" },
  tab: { freq: 520, freqEnd: 780, dur: 0.09, vol: 0.09, shape: "sine" },
  error: { freq: 150, freqEnd: 110, dur: 0.22, vol: 0.2, shape: "square" },
  save: { freq: 1046, freqEnd: 1318, dur: 0.18, vol: 0.12, shape: "sine" },
  tick: { freq: 2400, freqEnd: 2300, dur: 0.012, vol: 0.06, shape: "square" },
  modal: { freq: 300, freqEnd: 900, dur: 0.16, vol: 0.09, shape: "sine" },
  toast: { freq: 1200, freqEnd: 1600, dur: 0.1, vol: 0.08, shape: "sine" },
  levelUp: { freq: 523, freqEnd: 1046, dur: 0.4, vol: 0.14, shape: "triangle" },
  pickup: { freq: 1568, freqEnd: 2093, dur: 0.12, vol: 0.1, shape: "sine" },
};

/** A UI tone's gain once the sound-effects volume is applied. */
export function uiGain(tone: UiTone, sfxVolume: number): number {
  return UI_TONES[tone].vol * clamp(sfxVolume, 0, 1);
}
