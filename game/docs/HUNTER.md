# Hunter S Bombson: the in-world sound layer

Hunter does the diegetic sounds: everything you would hear standing in the city and need in the world. Music is his brother Lil Wooski's job (generative engine in `src/audio/Music.ts`); Hunter does not care enough about the music.

Code: `src/audio/Diegetic.ts` (pure planning functions at the top, Web Audio below), wired in by `src/audio/Audio.ts`. Tests: `tests/diegetic.test.ts` (pure parts plus a headless run against a fake AudioContext).

## Rules

- Original and procedural: no samples, no files, no paid tools.
- Own bus: everything goes through `Diegetic.input` (own volume and mute, a compressor, and a lowpass that muffles the street indoors). **J** toggles it, **N** toggles only the music, Settings has "World sounds" and "World sound volume".
- Starts after the first user gesture like the rest of the audio.
- Positional: `spatialize()` gives distance falloff and pan; the 2D street view uses a flatter side-on mix.
- Capped: at most 14 live one-shots (8 on phones), 4 engine voices and 2 siren voices (2 and 1 on phones), scans every 50 ms (90 ms on phones).
- Paused sim means silence for engines and footsteps (positions stop changing).

## What makes each sound

| Sound | Where it comes from |
| --- | --- |
| Footsteps | people near the camera, by tile surface (`surfaceOf`), stride from speed |
| Engines, doppler, doors, pops | `sim.vehicles`, speed measured from movement between scans, `ENGINE` profile per class |
| Horn, crash, car hit, till | the sim's `sound` bus |
| Cans, bins, recycling | `clink`, `bin` and `recycle` sound kinds from `sim/Litter.ts` |
| Sirens | vehicles with `siren` on; police yelp, ambulance hi-lo, anything else wails (no fire engine exists yet) |
| Rain, wind, thunder | `sim.env` (rain level, weather, `lightningAt`) |
| Birds, crickets | hour, rain and greenery around the camera |
| Traffic and crowd beds | cars and people near the camera, scaled by the hour |
| Shop jingles (`JINGLES`, one per shop kind), door latches | characters entering or leaving buildings, and you opening an interior |
| Depot machinery, fountains, food truck, club bass | fixed emitters found once per world in `attach()` |
| Inside | `ROOMS` table: crowd chatter, fridge hum, bass, machinery per building kind |
| Puddle splashes, drip echoes | hard ground and `sim.env.rain` above ~0.3 (`puddleChance`, `dripRate`, `dripEchoes`) |
| Distant train | `trainSwell()` schedule on audio time; loudest near an `airport` door (`trainReach`), horn on arrival; no station building exists yet |
| Terrance | his `say` lines and his dialogue panel, `voiceBlips()` |

## Adding a sound

Add a `kind` string where the sim emits `sound`, handle it in `Diegetic.onSound()`, keep it to one `begin()`/`end()` voice, and add its pure parameters (if any) to the tested helpers.
