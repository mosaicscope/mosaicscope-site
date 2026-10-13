# Plan: a more stellar world

Status: **plan only, no code yet.** Written so it can run alongside the update already in flight. Every change below is either a new file or a one or two line hook, so the two updates should not collide.

## What "stellar" means here

`LOOK.md` is the rule book. It says the sky is flat `--ink`, with no blue-violet washes and no grey-blue sky, and that light is spent on bulbs, neon and windows rather than spread across the frame. So "stellar" should not mean a realistic Milky Way. It should mean the night sky sparkles in the same language as the street: small paper-coloured points, a few acid and sodium ones, a rare shooting star, and bulbs that feel like a constellation. The goal is that the night reads as glamorous, not darker.

## Where things stand

- The sky is a flat `INK` fill at `game/src/render/Renderer.ts:140`. Nothing draws above the ground.
- Night darkness is an overlay in `game/src/render/Lighting.ts`, capped at 0.9 darkness, with holes cut for light sources.
- `nightness(daylight)` in `game/src/render/NightFX.ts:20` already gives a clean 0 to 1 night value. Reuse it.
- Moon and sky slivers only appear on water tiles (`Renderer.ts:462`). Nothing sits above the streets.
- A "Shooting star!" bark line already exists (`game/src/dialogue/lines.ts:86`), so the meteor is already part of the voice. The visuals just don't exist yet.
- `daylight(hour)` lives in `game/src/sim/Environment.ts:68`, so the star fade follows the same clock as everything else.

## Phases

Each phase ships on its own and can be dropped without breaking the others.

### Phase 1: the star field (smallest, highest value)

- New file `game/src/render/Stars.ts`. A fixed set of about 140 stars, generated once from a seeded RNG (`core/rng.ts`) so they are the same on every visit and in every save.
- Screen space, drawn right after the `INK` fill at `Renderer.ts:140`. They stay put while the camera moves, which reads as sky rather than ground.
- Each star is a 1 to 2px dot in `PAPER`, with about one in ten in `ACID`, `SODIUM` or `PINK`. Alpha is `nightness(daylight) * (0.35 + 0.65 * twinkle)`, where twinkle is a slow per-star sine. Daytime draws nothing.
- Batched into one path per colour, so the cost is a few arcs per frame.
- Quality tiers: 0 draws nothing, 1 draws about 60 stars, 2 and above draws all of them.

### Phase 2: shooting stars

- A single streak every 90 to 180 game-seconds at night, from a random edge, crossing in about 0.6s, in `PAPER` with a short `ACID` tail. Nothing else is drawn on that frame.
- Trigger it from the existing clock, not a new event system. Dialogue can pick up "Shooting star!" when one passes near a visible character, which the bark line already expects.
- Rate-limited and off in reduced-motion mode.

### Phase 3: bulb constellations

- Night only: the existing string-of-bulbs motif (`LOOK.md` motif 2) gets a brighter, faster twinkle, using the stagger already in `.prop--lights`. This is the same motif on the site, so the game and the footer match.
- A rooftop or awning string on the busiest street at night, using the party-light colours from `Lighting.ts`.
- One disco-ball glint per scene (`LOOK.md` motif 4): a single sparkle at the Pink Pukeko, drawn additively.

### Phase 4 (optional, only if phases 1 to 3 look right)

- Glitter on the lit shore of the water tiles, reusing the water sparkle pass in `drawReflections`, but in neon points rather than grey-blue slivers.

## Non-goals

- No Milky Way, no nebula, no blue or violet sky gradient, no moon disc. `LOOK.md` rules all of them out.
- No world-space stars that scroll with the ground.
- No change to `palette.ts` tokens. The stars use existing colours.
- No change to the simulation, save format or dialogue content.

## Conflict strategy with the in-flight update

- New code lives in new files (`Stars.ts`, and at most one small helper for shooting stars).
- `Renderer.ts` gets one call inserted after line 140, and one draw call near the night overlay. Keep both as single-line hooks.
- Don't touch `palette.ts`, `config.ts` or `Camera.ts`. If the in-flight update changes them, rebase the hooks onto that change rather than the other way round.
- Ship Phase 1 on its own branch first, so it can merge without waiting for anything else.

## Performance and budget

- Stars: fixed count, batched fills, no per-frame allocation. Target under 0.3 ms per frame on the low tier.
- Check `game/bench-results/render-latest.json` before and after Phase 1, and keep the numbers in the PR description.
- Shooting star and glints: one object at a time, pooled.

## Testing

- Unit test in `game/tests/`: `Stars.ts` gives the same positions for the same seed, produces zero alpha at full daylight, and never exceeds the star budget per tier.
- Screenshots at dusk, midnight and dawn, both iso and 2D street. Put them next to `game/docs/screenshot-day.jpg` and `screenshot-party.jpg` to check the palette still matches.
- Walk the `LOOK.md` checklist before shipping: one loud red, neon figures, no new brown, violet or grey-blue.

## Open questions

1. **Is "stellar" the right read?** I took it as sparkling neon stars and a livelier night, not a realistic sky. Say if you meant something else.
2. **What is the update already in flight?** Knowing which files it touches tells us where the two changes could collide, and whether the star hook should wait.
3. **Should Phase 1 be built now,** or is this plan enough for the moment?
