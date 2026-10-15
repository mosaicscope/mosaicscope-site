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

## Round 4 additions: glow trail and all-calm glow

Drawn by `src/ui/Glow.ts` on one overlay canvas (half resolution, pointer-transparent, drawn only while something is visible). Colours are the website tokens from LOOK.md v2: acid `#c6ff3d` for the trail, sodium `#f6b62c` for the calm pool.

| Moment | Spark | Exact spec |
|---|---|---|
| You walk or run on foot, iso view | glow trail | A dot every 0.18 tiles, at most 14 alive. Each fades over 0.85 s with alpha 0.55 x (1 - age/0.85)^2 and shrinks from 8 px to 3 px. Additive blend. Skipped in cars, interiors, the 2D street and while paused; reduced motion turns it off. A jump over 6 tiles (teleport) never draws a streak. |
| Stand still 2.5 s with no litter within 5 tiles | all-calm glow | A flat sodium pool under your feet (26 px by 13 px), rising over 1.8 s to alpha 0.2, gone in 0.5 s the moment you move or litter is near. Litter is rescanned twice a second, not per frame. Reduced motion keeps it (it never moves). |
| Golden minute and streak chimes | mix | Now asked through `allow("event")` like every other effect, so Hunter's central mix can drop them when the street is busy. |

Cost: no per-frame allocation beyond up to 15 small gradients, and nothing is cleared or drawn while both glows are idle.
