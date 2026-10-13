# LOOK: one world, three ways of seeing it

Louis's look guide. Everyone who draws, lights or colours anything in the game follows this. If a change fights it, change the change.

## The one idea

Mosaics is a **warm-black city lit by people**. Walls are dark and quiet, so the human things (lit windows, neon, headlights, a hot pie shop, a bus stop with a face in it) are the brightest things on screen. The concrete jungle is only bleak when nothing in it is alive, so every street needs life in the light, not more grey.

The iso view, the 2D street and the interiors are **the same place**. Switching view must feel like stepping through a door, not changing games.

## Palette (the tokens are in `render/palette.ts`)

| Role | Colour | Use |
|---|---|---|
| Ink | `#0e0b0a` | the only outline and deepest shadow, never pure black |
| Paper | `#eee4d3` | light stone, paper, signs' text |
| Dim | `#9a8d80` | mid stone, dust, distance |
| Warm window | `#ffd27a` / `#fff0c0` | every lit window, lamp, doorway, shopfront (cool `#9fe8ff` TV only) |
| Red / Gold / Acid / Pink / Cyan | `#ec2a1c` `#f6b62c` `#c6ff3d` `#ff7ad9` `#3dd6ff` | **accents**: signs, awnings, cars, one thing per block, never walls |

Rules:
- Walls and ground are **warm-dark** (browns, plum, slate with a warm cast). No saturated blue or violet walls. Blue lives in the sky, in shadow, in rain and in glass.
- Accents are small. If more than a tenth of the screen is accent colour, it is a toy, not a city.
- A shadow is the same hue as its wall, darker, with a slight cool shift (`shade()` in `render/noir.ts` does this).

## Light

- **One sun, one clock.** Day, dusk and night come from `sim.daylight` in every view. Both views use the same night overlay colour (`rgba(8,6,22)`) so dusk matches across the join.
- Dusk is the hero hour: warm band low in the sky, cool high, windows turning on.
- At night, **light is spent, not spread**: lamps cast a pool, windows glow past the dark (`NightGlow.ts`), neon bleeds onto the footpath. Everything else drops away.
- Rain darkens the ground and adds reflections of lights, not extra fog.

## Materials

- Brick (warm red-brown), render/plaster (sand, grey), concrete (cool grey-brown), glass (dark with a bright reflection), painted metal (flat accents).
- Shading is **flat two-tone**: lit face and shaded face, plus one edge light on the lamp side. No gradients on walls, no noise textures, no dither patterns (they read as a criss-cross).
- Roofs carry kit (vents, aerials, tanks, steam). Walls carry life (fire escapes, washing, window boxes, signs). A bare flat plane is a bug.

## Density (what makes a street feel triple-A rather than bleak)

Every block of street should have, within a screen: one light source that is not a lamp post, one piece of street furniture that tells a story (bench, bins, bike, bus stop), one sign, one thing moving, and one thing a person did (graffiti, litter, a parked car with a dent). Greenery at the edges of concrete.

Keep it **calm**: a lot of small things, few loud ones. Sound follows the same rule (quiet by default, loud only for events).

## How 2D relates to the iso view

2D is the iso world **cut open**, not a second game:
1. **Same colours**: its walls come from the building the player is next to in the world (`Building.color`, shop awnings from `Building.sign`), blended into the brick/stone/plaster materials. Same ink, same ground colours as `GROUND`.
2. **Same time**: driven by `sim.daylight`, same night overlay.
3. **Same cast**: the people and cars in 2D are the characters and cars of the world, dressed from the same data.
4. **Same signs**: accents in 2D (neon, awnings) are the sign colours of the iso building.
5. The only differences allowed are the ones the camera forces: side-on perspective, pixel grid, and parallax.

## Checklist before you ship a visual change

- [ ] Take a day, a dusk and a night screenshot in iso **and** 2D at the same spot. Do they feel like one place?
- [ ] No new saturated wall colour. No pure black, no pure white.
- [ ] No dither, checker or hairline lattice.
- [ ] Anything bright is something a person would want to look at.
- [ ] Original shapes only; no real brands, people or text traced.
