# Art requests: Louis's intake

Louis is the picture analyser. Drop a picture here and he copies what is in it exactly, then integrates it cleanly into the game. He is hungry: more pictures is always better.

## How to submit

1. Make a folder `NNN-short-name/` (next free number).
2. Put the picture in it as `picture.png` or `picture.jpg` (several: `picture-2.png` ...).
3. Add `request.md` with ONE line: what you want from it (e.g. "NPC art style", "make the alley look like this").
4. Commit it. Louis scans this folder before every Christa gate.

Louis writes `analysis.md` next to the picture. His status goes in the `status:` line at the top of that file: `new`, `analysed`, `integrating`, `in-PR`, `shipped`.

## From chat

The coordinator saves a picture a member posts in the project chat to `game/art-requests/NNN-name/picture.*` on a `louis/YYYY-MM-DD` branch, writes the member's words into `request.md`, and Louis picks it up on his next run. Nobody needs to touch git.

## Rules

PG-13, no real brands or people, never reference the 2019 Christchurch attack. If a picture breaks these, Louis copies the style and mood, not the offending content, and says so in `analysis.md`.

## Index

| # | Picture | Status |
|---|---------|--------|
| 001 | Bum Fights cover (gritty pixel-art reference) | analysed |
| 002 | Current game screenshot (baseline) | analysed |
