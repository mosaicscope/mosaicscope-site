status: integrating
# 008 street-and-portrait

**Request:** Street scene with people walking dogs, an old black sedan, a stone civic building with steps, and a large painterly pixel portrait overlay. Request: figures and mood.

## Palette (median-cut, 8 colours)
#3d3e3f 20%, #6a5e54 16%, #323236 13%, #60544e 12%, #4a4948 11%, #a38969 9%, #453935 7%, #252427 7%

Warm sepia pavement, grey stone, olive coats. Portrait uses broad flat tone planes with a few highlight clusters.

## Line, shape, proportion, density
People 8 to 9% of screen height, walking in groups with animals, hats and long coats, clear 1px dark outline and two-tone coat shading. Dogs are 3 to 4 simple shapes. Portrait style: flat planes, hard-edged shadow side, no outline.

## Copy exactly
People proportions, long coats and hats, one lamp post type, stone building with steps and a double door.

## Do not copy
The portrait itself and the likeness of any real person. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
