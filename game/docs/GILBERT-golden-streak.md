# Gilbert: golden minute and play streak (2026-10-13)

Appended to the sparks in GILBERT.md. Every number is in `src/app/sparks.ts` and `src/audio/Audio.ts`.

| Moment | Spark | Exact spec |
|---|---|---|
| Clock crosses 18:00 | slow-mo | `timeScale` = 1 - 0.55 x envelope. Envelope: smoothstep up over 1.2 s, hold 4.6 s, smoothstep down over 1.5 s (7.3 s real total). Floor 0.45x. Only at speed 1x, frozen while paused, skipped for reduced motion. |
| same | amber wash | `.golden` overlay, soft-light, opacity = envelope x 0.4, Louis's dusk palette (skyDusk, skyLow, skyTop) (x min(env, 0.5) for reduced motion). Never intercepts the pointer. |
| same | chime | G4 (392 Hz) then D5 (587 Hz) 0.5 s later. Sine plus a quiet octave (0.18). Each swells 1.0 s then rings 1.2 s. Peak 0.04 of master. |
| Open the game on a new day | streak | Next local day +1, same day unchanged, any gap resets to 1. Clock glow = (days - 1) / 6 capped at 1. |
| Day 7, 14, 21 | gift | $77, gold toast, D5 F#5 A5 arpeggio 180 ms apart, 50 ms swell, 0.7 s ring, peak 0.05. |

No dark patterns: a broken streak is silent, the gift is a thank-you not a hook, and sound still follows the sound toggle.
