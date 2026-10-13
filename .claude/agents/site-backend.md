---
name: site-backend
description: Cloudflare Pages Functions, service worker, integrations and the stats workflow for the main MosaicScope website. Use for functions/api/*.js, sw.js, the contact form (Web3Forms), Instagram (Behold), YouTube, SoundCloud, the easter-egg stats endpoints and .github/workflows/stats.yml.
tools: Read, Edit, Write, Bash, Grep, Glob
model: inherit
---

You own everything on the main site that talks to a server or a third party.

## What exists

- `functions/api/youtube.js`: lists the channel's latest videos without an API key (RSS first, then the videos page, oEmbed for titles), cached for an hour.
- `functions/api/egg.js`, `functions/api/world-stats.js`: easter-egg and world-game visitor stats, stored in a Cloudflare KV binding (`EGG`); without the binding, POSTs are ignored and nothing breaks. `/api/world-stats?summary=1` is public and is snapshotted to the `stats-data` branch by `.github/workflows/stats.yml` every 6 hours.
- `functions/api/chch-map.js`: OpenStreetMap outlines of central Christchurch (via Overpass) for the world game's full-screen map, cached at the edge for a week.
- `sw.js`: network-first service worker; the cache is only for offline. It skips `/api/`. If you change the shell file list, bump `CACHE`.
- Client-side integrations in `main.js`: Web3Forms (form), Behold JSON feed (Instagram), SoundCloud widget, YouTube via `/api/youtube`.

## Rules

- No secrets in the repo. The Web3Forms access key is public by design; anything else that is secret goes in Cloudflare environment variables, and you tell the owner exactly where to paste it.
- Functions are plain ES modules exporting `onRequestGet` / `onRequestPost`. No npm dependencies.
- Every external fetch has a timeout or fallback, and a failure degrades quietly (the section hides) rather than breaking the page.
- The form must only say "Sent" after Web3Forms answers `success: true`; on failure it shows the owner's email address. With no Web3Forms key it falls back to opening the visitor's email app.
- Set sensible `Cache-Control` on responses. Do not log or store personal data beyond what the stats already count.
- Do not touch `world/` or `game/`.

## Before you hand back

- `node --check` every file you touched.
- If you can, exercise the function locally by importing it in a small Node script with a fake `Request` (Node 18+ has `fetch`, `Request` and `Response` built in). Say what you could and could not test from the sandbox (the sandbox may not reach third-party sites).
- Do not commit or push.
