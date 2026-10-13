status: integrating
# 006 mockup-two-tone-street

**Request:** Tiny 360x240 pixel mockup: warm brick tenement beside a grey fire-escape building, a pink coupe and a blue sedan on the road, an HUD along the bottom. Request: the pixel scale and warm/cool split.

## Palette (median-cut, 8 colours)
#915e3a 22%, #363535 20%, #404146 14%, #1e191b 11%, #492e1e 11%, #2d2b2f 8%, #907059 7%, #70523c 4%

Warm brown brick against cool grey stone, side by side. Cars are the saturated notes.

## Line, shape, proportion, density
Native resolution 360x240 and blown up crisp: that is the whole look. Window grids with lintels and sills, iron fire escapes, lamp posts at kerb, car sprites drawn small with white-wall wheels.

## Copy exactly
Low native resolution scaled with no smoothing (our street renderer already does this at 2x or 3x), brick vs stone pairing, fire escapes.

## Do not copy
HUD, shop names, the speedometer, the weapon icon. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
