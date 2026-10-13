status: integrating
# 010 zomboid-living-room

**Request:** Isometric cutaway house: light wood-plank floor, peach walls, stone fireplace, wicker sofa, tall plant, table and chairs, a TV, a staircase, glass panels and a nearby brick wall. Request: the cutaway house look.

## Palette (median-cut, 8 colours)
#caa167 17%, #3e301e 17%, #9f794a 10%, #eebf7c 9%, #584c37 9% (rest is the black void)

Honey wood floor, peach walls with a soft vertical gradient, dark walnut furniture. Daylight warmth.

## Line, shape, proportion, density
Walls are drawn as thick slabs with a lighter top edge and a dark inner face; the far two walls are full height, the near two are cut away to a low wall. The floor shows clear plank rows in perspective with subtle value variation per plank. Furniture has a 3-face shading rule: light top, mid front, dark side. Wall lamps and skirting boards add detail.

## Copy exactly
Plank floor with per-plank value variation, 3-face shading, thick wall slabs with lit top, skirting, stairs, fireplace as a stone block pattern.

## Do not copy
The UI panels, the character, the blood, the TV channel text and any game branding. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
