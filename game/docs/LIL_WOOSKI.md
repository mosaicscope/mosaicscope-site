# Lil Wooski: the score

Lil Wooski composes the game's music. Everything is original, synthesised live with Web Audio (no samples, no files, no paid tools, nothing imitates a real song or artist). It starts after the first click or key, **N mutes it**, and effects stay on.

Code: `src/audio/Music.ts` (the player), `src/audio/Score.ts` (scenes, themes, leitmotifs, moods, inspo, live tint), `src/audio/LiveVibe.ts` + `functions/api/vibe.js` (live data). Hunter S Bombson owns diegetic and ambient sound effects (`Audio.ts`); this file is music only.

## Scenes
One theme per scene, chosen by priority: chase, Terrance, nightlife, recycling centre, the Studio, interiors, 2D street, rain/storm, dawn, then the plain city (day, dusk, night follow the in-game clock, and heat or low health bends any of them to dread).

| Scene | When | Sound |
|---|---|---|
| chase | wanted 2+ | dread scale, fast, driving drums, brass tritone siren motif |
| terrance | near the red NPC | dread, brass, an insistent slightly wrong 4-note ostinato |
| nightlife | party on, or inside a club | night scale, four-on-the-floor, keys hook |
| recycling | at or inside the recycling centre | bouncy marimba and mallets, clink-clink motif |
| studio | at or inside the Studio | warm keys, rising arpeggio every 4th bar |
| interior | inside any other building | muffled "through the wall" keys |
| street2d | zoomed in to the street | dusty boom-bap shuffle |
| rain | rain over 0.4 or a storm | thin, soft, bells |
| dawn | 05:00 to 07:30 | slow, sparse, bells |
| city | otherwise | lazy jangle, moods follow the clock |

**Transitions:** a new scene must hold for 2 bars before the music changes (no whiplash walking past a door), changes land on the bar line with the pad overlapping the old chord, and a filtered noise sweep rises into intense scenes and falls away from them. The chase is the exception and cuts in on the next bar.

## Giving Lil Wooski inspiration
Edit `src/audio/inspo.json` (or drop notes in the inbox below and he turns them into config on his next run).

```json
{
  "live": true,
  "tempo": 1,
  "density": 1,
  "scenes": {
    "studio": { "mood": "tender" },
    "street2d": { "mood": "swagger", "tempo": 1.1 },
    "chase": { "density": 1.4 }
  }
}
```

- `live`: `false` ignores real-world weather/time.
- `tempo` and `density` (global, 0.7..1.3 and 0.3..2), per scene `tempo` and `density`, and per scene `flavour` (`day`, `dusk`, `night`, `dread`).
- `mood` names: `lonely`, `swagger`, `dreamy`, `hype`, `tender`, `mischief`, `noir`, `dread`.
- Scene names: `city`, `dawn`, `rain`, `street2d`, `interior`, `nightlife`, `chase`, `recycling`, `terrance`, `studio`.
- Unknown keys are ignored and numbers are clamped; a bad file can never break the game.

### Inspo inbox
Write vibes here in plain words (a scene, a feeling, a film mood, "more lonely at 3am"). No song or artist to copy, describe the feeling instead.

- (empty)

## Live data
`/api/vibe` (a Cloudflare Pages Function) reads Christchurch's current weather from Open-Meteo (free, no key) and answers `{weather, isDay, temp, wind, hour, source}`, cached 10 minutes. The game asks once when the music starts and every 15 minutes. Real rain thins and softens the music, a cold snap darkens it, a warm day brightens it, and the small hours slow it. If the function or network is unavailable it falls back to the clock (`source: "clock"`) with no error shown.

Rules: live data only drives audio, never the simulation (so saves, tests and the sim stay deterministic); the request is a bare GET with no parameters, cookies or user data.

## The old master's critique
Chris asked for a 10 every time. A real person's rating can't be produced here, so the review is a **fictional critic**, "the old master" (Lil Wooski's father in Chris's story, not a real person and not a real opinion). `src/audio/Critique.ts` plays each scene's generator offline for 32 bars and scores it 1 to 10 on six written criteria: **fit** (tempo, scale, busyness vs the scene's written intent), **memorability** (a recurring hook, a sensible pitch vocabulary), **storytelling** (scale colour matches the feeling), **transitions** (tempo jump from the city under 2x so the sweep can carry it), **mix** (loudness and drum share proxies from the engine's own envelope levels) and **restraint** (notes per second and silence gaps). It is a listening proxy, not ears: it catches wrong tempo, mud, nervousness and missing hooks, and cannot judge taste. Run it with `npm run critique`; the test suite fails if any shipped scene drops below 10 on any criterion.

First pass, in character: "Nightlife is a shouting match: wrong scale, 11 notes a second, nine pitch classes where there should be a hook. Street is dragging its feet at 72. The chase fidgets (10.6 notes a second). The city hats too much. Fix those." After fixes (tempo, scale, density, hats, and removing the shipped `swagger` example that dragged nightlife out of its scale): all ten scenes score 10 on all six criteria. The old master has not heard the game in a real browser; ears still beat this check.

## Routine
"HQ Lil Wooski: composer" runs twice a day just before a Christa gate: read the inbox and `inspo.json`, deepen one scene or motif, keep it original and mobile-friendly, run `cd game && npx tsc --noEmit -p . && npx vitest run && npm run build`, open a PR on `lilwooski/YYYY-MM-DD`, never merge.
