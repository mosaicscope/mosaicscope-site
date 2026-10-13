status: integrating
# 009 bunker-living-room

**Request:** Isometric pixel-art living room in a dark capsule: orange sofas and chair, patterned rug and checker floor, bookcases, plants, stag head, posters, coffee table with bottles, lamp. Request: interior props and density.

## Palette (median-cut, 8 colours)
#35231b 15%, #6b442f 14%, #786554 11%, #5d2919 9% (the dark blues are the void)

Rust orange against brown wood, with green plants as the only cool accents.

## Line, shape, proportion, density
Floor is a checker of two warm tones plus a rug; walls are plain with riveted panel lines. Furniture is chunky with bold edge light on the top face. Plants in pots break up every corner. Every surface carries clutter: bottles, books, a toy, a lamp. Shadows are a soft dark drop under each object.

## Copy exactly
Checker floor plus rug, plants in corners, bookcases full of coloured spines, wall decor (antlers, posters), coffee-table clutter, edge lighting.

## Do not copy
The weapons laid on furniture, the specific posters and any real people in them. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
