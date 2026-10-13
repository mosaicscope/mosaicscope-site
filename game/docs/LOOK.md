# LOOK: the website is the source of truth

Louis's look guide, v2. **The mosaicscope.com site is the look.** The game is that site's footer street, grown into a city. If the website, the 2D street and the iso world are ever side by side, they must read as one thing. When in doubt, open the site and copy it.

Source files (read these, don't guess from a picture): `styles.css` (tokens at `:root`, the footer stage from "Round 13" onward, string lights, `.prop--banner`, `.prop--neon`), `main.js` (raver colours `COL`, `PARTY` props), `index.html` (font links).

## The one idea

**A near-black night street, lit by people.** The ground is warm black. Everything alive is drawn as a bright neon line: stick figures in a different colour each, small glowing label tags, a string of coloured bulbs overhead, one loud red accent. Nothing is realistic, muted or brown. The footer is the whole game in one picture, and the game is that picture at city scale.

## Tokens (from `styles.css :root`, mirrored in `render/palette.ts`)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#0e0b0a` | ground, sky, deepest black. The page background. |
| `--ink-2` | `#1a1412` | raised surfaces: building bodies, panels |
| `--paper` | `#eee4d3` | text, outlines on dark, the moon, labels |
| `--dim` | `#9a8d80` | captions, far things |
| `--red` | `#ec2a1c` | **the** accent. One loud red per scene (a sign, an awning, the lamp). |
| `--acid` | `#c6ff3d` | second accent, bulbs, "after hours" banner |
| `--sodium` | `#f6b62c` | streetlight yellow, every lit window |
| Neon figure colours | `#c6ff3d #ff7ad9 #3dd6ff #f6b62c #ec2a1c #eee4d3 #b48cff` | raver and character line colours (`COL` in `main.js`) |

Rules:
- Backgrounds are `--ink` and `--ink-2`. No blue-violet washes, no brown dusk, no grey-blue sky.
- Colour is for **lines and light**, not for filling large areas. A building is a dark body with a coloured edge and coloured sign, not a painted brick wall.
- Shops keep the iso world's saturated block colours (that is the world's own `Building.color`), but at street level they show as a dark body, a lit shopfront and a coloured neon edge.

## Type

- **Display / labels on signs**: Big Shoulders Display (condensed, 700 to 900). Shop names, building names, the logo.
- **Mono / tags**: IBM Plex Mono, uppercase, letter-spaced, 9 to 11px. Tags, captions, counters, "THE MOSAICS", "AFTER HOURS".
- **Serif italic accent**: Instrument Serif italic, only for the "scope" flourish and an occasional handwritten line.

## The signature motifs (use them, they are what makes it Mosaics)

1. **Neon stick figures.** Characters are always the `StickFigure.ts` line figures, in their own neon colour, soft glow when close. Never filled realistic people.
2. **String of bulbs.** A sagging line across the top of any street: small round bulbs cycling sodium, red, acid, twinkling on a staggered delay (`.prop--lights`). Brighter and faster when something is happening.
3. **Tag labels.** Small rectangles with a 1px coloured border, mono caps, a slight tilt (about -2 degrees), glowing (`.prop--banner`, the pink "AFTER HOURS" tag). Use for place names and moods.
4. **A disco ball** or one odd glowing object per scene.
5. **A dashed hairline** ground line (`1px dashed paper at 7%`) where the figures stand.
6. **The boombox and the ENTER button**: small boxed props in a corner; the world has little tools, not big UI.

## Light

- One clock. `sim.daylight` drives every view. Night overlay is the same in iso and 2D.
- By day the world is the same palette, lifted: ink stays ink, but windows go dim and the sky is a flat lighter ink. Never a blue "realistic" sky.
- Light is spent, not spread: bulbs, windows, neon edges, lamp pools. Everything else is black.

## How 2D relates to the iso world and the site

- **Site footer = the 2D street at small scale.** Same ground (`--ink`), same bulbs, same tags, same figures.
- **2D = the iso world cut open.** Same buildings (dark body, edge coloured by the world building's own colour and sign), same shop labels in Big Shoulders, same characters (the same `drawFigure`), same night overlay.
- **Pixelation is not part of the look.** The site is crisp vector line work, so 2D is crisp vector line work.

## Checklist before you ship a visual change

- [ ] Put the website footer, the 2D street and the iso world next to each other. Same palette, same lines, same type?
- [ ] Characters are neon line figures, not filled muted people.
- [ ] Ground and sky are `--ink`/`--ink-2`. No new brown, violet or grey-blue.
- [ ] Bulbs and at least one tag are present in any street scene.
- [ ] Only one loud red.
- [ ] Original shapes only; no real brands, people or text traced.
