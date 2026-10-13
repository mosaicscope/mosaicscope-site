status: integrating
# 005 street-post-office

**Request:** Daylight city street: brick tenements with stoops and window boxes, a corner post office, newsstand, lamp posts, a police-style car and a delivery truck. Request: dense, lived-in streets.

## Palette (median-cut, 8 colours)
#6b6d76 19%, #837c7f 13%, #383031 12%, #a39b9c 12%, #555760 11%, #46444b 11%, #737074 10%, #686467 9%

Daylight version of the same family: grey cobbles, pale stone, dark brick, muted everything.

## Line, shape, proportion, density
Prop density is the secret: every 100px has a bench, bin, pillar box, stand, crate or plant. Stoops with railings, window boxes, awnings, house numbers. Thin lamp posts at regular spacing. Buildings differ in height and material.

## Copy exactly
Prop density and spacing, stoops, window boxes, pillar box, lamp spacing, mixed building heights.

## Do not copy
The Post Office sign, the newsstand headlines, the police car livery. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
