# ADR 0001: The game is a separate static page built into `/world/`

**Status:** accepted

**Context.** MosaicScope is a static site on Cloudflare Pages with no build step. The owner edits it through Pages CMS. The game is an easter egg and must not slow down or break the main site.

**Decision.** Game source lives in `game/` (TypeScript + Vite). `npm run build` writes a self-contained bundle to `../world/`, and that output is committed. Cloudflare serves it at `/world/` with no build configuration. The main site only changes one footer sign into a link. `package.json` lives inside `game/` rather than at the repo root, so Cloudflare never tries to install or build anything.

**Consequences.** Contributors must run `npm run build` and commit `world/` after changing the game. The game's storage keys are namespaced (`mosaics-world:`) so they can't collide with the site's.
