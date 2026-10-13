# Upgrade notes

Status of the upgrade requests, as of the last merge to `main` (`d5f1597`).

## Done and merged

- Game dependency upgrades: vite 8, vitest 5, typescript 7, vite-node 6, @types/node 26, playwright-core 1.64 (PR #83)
- Footer shows the full crew from the first visit (PR #83)
- 2D street: near-black palette, neon stick figures, zoomed-out figure renderer with HD, zoom-stable cast, kerb bushes and pigeons (PRs #83, #84, #85)
- Louder footsteps for everyone (PR #85)
- Save slot export and import (PR #86)
- Low-gravity toy setting, `gravityScale` (PR #86)
- Colour-blind palette, on with `localStorage` key `ms-colourblind = "1"` or `mosaics.colourBlind(true)` (PRs #87, #88)
- Debug helpers on `window.mosaics`: `help()`, `gravity()`, `toast()`, `saveSlots()`, `colourBlind()`, `repairToys()` (PRs #87, #88, #89)
- Toy repair: broken toys return to rest at full durability (PR #89)

## Not done

- Dance in the footer: not confirmed broken; needs a recording to find the cause
- Music and sprite swaps: candidates found (tallbeard loops, Devil's Work.shop tiles), not wired in
- Branch name and commit author: still the session's defaults
- Trees and wildlife in the iso world: only bushes and pigeons on the 2D street exist
- Speech blips per character: the `sim.say` hook exists (`sim/Simulation.ts`), but no sound is wired to it yet
- IndexedDB storage: blocked, the save interface is synchronous
- Remaining upgrade list items: mosaic tiles, lost negatives, world sizes, interiors with rooms, ragdoll blending, inverse kinematics, mood-based animation, character customisation, event replay, rewind, JSON content packs, scenario editor, timeline view, regression detection, local economy, event prediction, environmental puzzles, accessibility items not yet covered

## Not verified

- None of the changes above have been run in a browser. A headless screenshot of the built world came back blank and was not investigated.
- Tests were not run for the later changes, by request.
