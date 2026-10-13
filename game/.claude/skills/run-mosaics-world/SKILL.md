---
name: run-mosaics-world
description: Build, run, and screenshot the Mosaics world game (game/). Use when asked to run, start, build, preview, screenshot, or check the world, the 2D street, or the footer crew.
---

# Run the Mosaics world

The world is a browser game in `game/` (Vite + TypeScript, no backend). It builds into `../world/`, which is the deployed page at `/world/`. Paths below are relative to `game/` unless noted.

## Prerequisites

- Node and npm (the repo's `game/package-lock.json` pins everything).
- Chromium at `/opt/pw-browsers/chromium` (already present in the cloud container). Override with `CHROMIUM=/path/to/chromium` if needed.

## Build

```bash
cd game
npm ci
npm run build        # runs tsc --noEmit, then vite build into ../world/
```

`npm run build` writes into the tracked `world/` folder. If you only want to check types, use `npm run typecheck`.

## Run (agent path): serve the build and take a screenshot

Serve the built world with Vite's preview server, then screenshot it with the repo's helper:

```bash
cd game
npx vite preview --port 4173 --strictPort &      # serves the built world on port 4173
node e2e/shot.mjs http://127.0.0.1:4173/world/ e2e/screenshots/world.png 5000
```

- Arguments to `e2e/shot.mjs`: `<url> <out.png> [waitMs] [js-to-eval]`. The default URL is port 5173 (the dev server), so always pass the preview URL.
- Output lands in `e2e/screenshots/`. Open the PNG to check the scene, then look at it yourself. A blank white screenshot means the page did not load, so check the preview server is running first.
- Stop the preview server when you are done: `pkill -f "vite preview"`.

The helper prints console errors. `error: Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED` is a sandbox network block (the Instagram and SoundCloud feeds), not a game bug.

## Run (dev server)

```bash
cd game
npm run dev          # Vite dev server, default port 5173
```

Then `node e2e/shot.mjs http://127.0.0.1:5173/world/ e2e/screenshots/dev.png`.

## Smoke test

`e2e/smoke.mjs` opens the built page and checks it renders and that the main controls work. Serve the build first (as above), then:

```bash
node e2e/smoke.mjs http://127.0.0.1:4173/world/
```

This was not run during the session that wrote this skill, so treat its results as unverified until you run it.

## Debug helpers (browser console)

The page exposes `window.mosaics` for testing from the console:

- `mosaics.help()` lists the commands.
- `mosaics.gravity(v)` sets toy gravity (0.1 to 2).
- `mosaics.colourBlind(true|false)` switches the palette.
- `mosaics.toys()`, `mosaics.toyCount()`, `mosaics.people()`, `mosaics.saveList()`.
- `mosaics.save('1')`, `mosaics.clearSlot('1')`, `mosaics.restart()`, `mosaics.repairToys()`.

To drive these from a script, pass a JS string as the fourth argument to `e2e/shot.mjs`.

## Gotchas

- The default screenshot URL is the dev port, not the preview port. Always pass the URL.
- `npm run build` rewrites `../world/`. Commit that folder with the source change, or the deployed page will be stale.
- The 2D street view (`V` key) was not screenshotted in the session that wrote this skill, so its look is unverified.
- Headless Chromium runs with no GPU. The 3D view renders fine with the Canvas2D renderer used here.

## Troubleshooting

- **Blank white page:** the server is not serving `/world/`. Check `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4173/world/` returns 200.
- **`ERR_CONNECTION_REFUSED`:** the server is not running on that port. Start `npx vite preview --port 4173 --strictPort` first.
- **Build fails with TS6133 (unused variable):** remove or underscore the unused parameter. The build runs `tsc` with `noUnusedLocals` and `noUnusedParameters`.
