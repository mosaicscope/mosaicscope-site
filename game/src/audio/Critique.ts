import { planStep, rng, scaleFor, stepSeconds, flavourFor, type Mood } from "./Music";
import { THEMES, resolveTheme, parseInspo, type Scene, type Theme } from "./Score";

/**
 * "The old master": a FICTIONAL critic (Lil Wooski's father in Chris's story, not a real person and not a real
 * rating) who scores each scene theme 1..10 on six written criteria. The scores come from analysing what the
 * generator actually plays (tempo, key, density, rests, loudness proxy) against what each scene is meant to feel like.
 * It is a listening proxy, not ears: it catches wrong tempo, mud, silence, nervous busyness, a missing hook.
 */
export const CRITERIA = ["fit", "memorability", "storytelling", "transitions", "mix", "restraint"] as const;
export type Criterion = typeof CRITERIA[number];

interface Intent { bpm: [number, number]; flavour: string[]; leadPerBar: [number, number]; hook: boolean; onsetsPerSec: [number, number]; maxRest: number }
/** What each scene should feel like, written down so the critique is repeatable. */
export const INTENT: Record<Scene, Intent> = {
  city: { bpm: [64, 92], flavour: ["day", "dusk", "night", "dread"], leadPerBar: [1, 4], hook: false, onsetsPerSec: [0.5, 3], maxRest: 15 },
  dawn: { bpm: [55, 80], flavour: ["day", "dread"], leadPerBar: [0.5, 3], hook: false, onsetsPerSec: [0.3, 2.5], maxRest: 14 },
  rain: { bpm: [55, 80], flavour: ["day", "dusk", "night", "dread"], leadPerBar: [0.5, 3], hook: false, onsetsPerSec: [0.3, 2.5], maxRest: 14 },
  street2d: { bpm: [78, 105], flavour: ["day", "dusk", "night", "dread"], leadPerBar: [2, 6], hook: false, onsetsPerSec: [3, 8], maxRest: 4 },
  interior: { bpm: [55, 85], flavour: ["day", "dusk", "night", "dread"], leadPerBar: [0.5, 3.5], hook: false, onsetsPerSec: [0.3, 2.5], maxRest: 14 },
  nightlife: { bpm: [100, 125], flavour: ["night"], leadPerBar: [2, 7], hook: true, onsetsPerSec: [4, 10], maxRest: 3 },
  chase: { bpm: [110, 135], flavour: ["dread"], leadPerBar: [0, 6], hook: true, onsetsPerSec: [4, 10], maxRest: 3 },
  recycling: { bpm: [95, 125], flavour: ["day"], leadPerBar: [1, 6], hook: true, onsetsPerSec: [2, 8], maxRest: 6 },
  terrance: { bpm: [70, 100], flavour: ["dread"], leadPerBar: [0, 4], hook: true, onsetsPerSec: [2, 7], maxRest: 6 },
  studio: { bpm: [70, 95], flavour: ["day"], leadPerBar: [1, 4], hook: true, onsetsPerSec: [0.5, 3.5], maxRest: 15 },
};

export interface Metrics { bpm: number; flavour: string; leadPerBar: number; onsetsPerSec: number; maxRest: number; motifBars: number; pitchClasses: number; loud: number; drumShare: number }
export interface Review { scene: Scene; scores: Record<Criterion, number>; total: number; metrics: Metrics; notes: string[] }

const sample = (scene: Scene, theme: Theme, hour: number): Metrics => {
  const mood: Mood = { hour, rain: scene === "rain" ? 0.7 : 0, storm: false, tension: 0, street: scene === "street2d", party: scene === "nightlife", chase: scene === "chase", indoors: scene === "interior" };
  const f = flavourFor(mood, theme), sc = scaleFor(f), bars = 32, r = rng(scene.length * 977 + 11);
  let lead = 0, onsets = 0, rest = 0, maxRest = 0, motifBars = 0, loud = 0, drum = 0;
  const pcs = new Set<number>();
  for (let b = 0; b < bars; b++) {
    let motifHere = false;
    for (let s = 0; s < 16; s++) {
      const st = planStep(mood, f, b, s, r, theme);
      const n = (st.lead !== null ? 1 : 0) + (st.motif !== null ? 1 : 0) + (st.bass !== null ? 1 : 0) + (st.kick ? 1 : 0) + (st.snare ? 1 : 0) + (st.hat ? 1 : 0);
      onsets += n; if (st.lead !== null) { lead++; pcs.add(st.lead % 12); }
      if (st.motif !== null) { motifHere = true; pcs.add(st.motif % 12); }
      // loudness proxy: summed peak amplitudes of what plays on this step (matches the engine's envelopes)
      const d = (st.kick ? 0.5 : 0) + (st.snare ? 0.22 : 0) + (st.hat ? (st.hat === 2 ? 0.05 : 0.09) : 0);
      drum += d; loud += 0.1 /* the pad is always under it */ + d + (st.bass !== null ? 0.32 : 0) + (st.lead !== null ? 0.1 : 0) + (st.motif !== null ? 0.16 : 0);
      if (n === 0) { rest++; maxRest = Math.max(maxRest, rest); } else rest = 0;
    }
    if (motifHere) motifBars++;
  }
  const secs = bars * 16 * stepSeconds(sc.bpm * theme.bpm);
  return { bpm: sc.bpm * theme.bpm, flavour: f, leadPerBar: lead / bars, onsetsPerSec: onsets / secs, maxRest, motifBars, pitchClasses: pcs.size, loud: loud / (bars * 16), drumShare: loud ? drum / loud : 0 };
};

const within = (v: number, [lo, hi]: [number, number]): number => (v >= lo && v <= hi ? 0 : Math.min(1, (v < lo ? lo - v : v - hi) / ((hi - lo) / 2 || 1)));
const score = (penalty: number): number => Math.max(1, Math.round(10 - penalty * 9));

export function review(scene: Scene, theme: Theme = THEMES[scene]): Review {
  const it = INTENT[scene], hour = scene === "dawn" ? 6 : scene === "city" ? 12 : 22, m = sample(scene, theme, hour), notes: string[] = [];
  const bpmP = within(m.bpm, it.bpm), densP = within(m.leadPerBar, it.leadPerBar), flavP = it.flavour.includes(m.flavour) ? 0 : 1;
  const motifOk = !it.hook || (m.motifBars >= 8 && m.motifBars <= 32), pcOk = m.pitchClasses >= 3 && m.pitchClasses <= 9;
  // transitions: tempo jump from the plain city theme (the usual neighbour) must stay under 2x either way, so the sweep can carry it
  const city = scaleFor("day").bpm * THEMES.city.bpm, ratio = Math.max(m.bpm / city, city / m.bpm);
  const rateP = within(m.onsetsPerSec, it.onsetsPerSec), restP = m.maxRest <= it.maxRest ? 0 : Math.min(1, (m.maxRest - it.maxRest) / 8);
  const s: Record<Criterion, number> = {
    fit: score(bpmP * 0.5 + densP * 0.25 + flavP * 0.25),
    memorability: score((motifOk ? 0 : 0.6) + (pcOk ? 0 : 0.4)),
    storytelling: score(flavP * 0.7 + (it.hook && m.motifBars === 0 ? 0.3 : 0)),
    transitions: score(ratio <= 2 ? 0 : Math.min(1, (ratio - 2) / 1)),
    mix: score((m.loud > 0.55 ? Math.min(1, (m.loud - 0.55) / 0.3) : 0) * 0.6 + (m.drumShare > 0.7 ? 0.4 : 0)),
    restraint: score(rateP * 0.6 + restP * 0.4),
  };
  if (bpmP) notes.push(`tempo ${m.bpm.toFixed(0)} bpm outside ${it.bpm.join("-")}`);
  if (densP) notes.push(`lead ${m.leadPerBar.toFixed(1)}/bar outside ${it.leadPerBar.join("-")}`);
  if (flavP) notes.push(`scale ${m.flavour} is not what the scene wants`);
  if (!motifOk) notes.push(`hook is on ${m.motifBars}/32 bars`);
  if (!pcOk) notes.push(`${m.pitchClasses} pitch classes`);
  if (ratio > 2) notes.push(`${ratio.toFixed(1)}x tempo jump from the city`);
  if (rateP) notes.push(`${m.onsetsPerSec.toFixed(1)} notes/sec outside ${it.onsetsPerSec.join("-")}`);
  if (restP) notes.push(`silence gap of ${m.maxRest} steps`);
  if (m.loud > 0.55) notes.push(`loud (${m.loud.toFixed(2)})`);
  const total = Math.round(CRITERIA.reduce((a, c) => a + s[c], 0) / CRITERIA.length * 10) / 10;
  return { scene, scores: s, total, metrics: m, notes };
}

/** Every scene, as the shipped theme resolves it with the shipped inspo and no live data. */
export function reviewAll(inspo = parseInspo({})): Review[] {
  return (Object.keys(THEMES) as Scene[]).map((sc) => review(sc, resolveTheme(sc, inspo, null)));
}
