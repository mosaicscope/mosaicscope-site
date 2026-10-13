status: integrating
# 007 bar-iso-cutaway

**Request:** Isometric pixel-art cutaway bar: wood-panelled walls, long bar with stools, jukebox, booths under blinds, an office with desk, safe and filing cabinets, warm lamps over a dark floor. Request: interiors and sprites like this.

## Palette (median-cut, 8 colours)
#1d1b31 34% (void), #ad754d 23%, #573426 20%, #2a1c1c 11%, #1d191e 5%

Amber and walnut walls lit by wall lamps, very dark floor, navy void behind. Light is the star.

## Line, shape, proportion, density
The room is a slab with two thick cut walls (front walls removed), a visible floor edge, a lit lip along the cut. Walls have wainscot and picture rails. Wall lamps cast cones of light down the wall and onto the floor. The floor is dark planks with scuffs, lit only in pools. Props are dense: bottles on shelves, glasses, plates, ashtrays. Small people with 1px outline and hats.

## Copy exactly
Wall lamp light cones, dark floor with warm pools, thick cut-wall lip, wainscot, dense counter and shelf props, booths with lit blinds.

## Do not copy
The sign lettering on the roof, the jukebox design, any brand names on bottles. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
