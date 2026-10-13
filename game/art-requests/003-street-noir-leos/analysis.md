status: integrating
# 003 street-noir-leos

**Request:** Side-on pixel-art street at dusk: a stone-grey corner building with lit shopfront windows and a hanging sign, two long black 1930s sedans, a bus-stop sign, a lone figure. Request: 2D streets should look like this.

## Palette (median-cut, 8 colours)
#231c24 19%, #464957 15%, #3d4153 13%, #797883 13%, #262229 10%, #5b5b67 10%, #343038 9%, #1c171d 6%

Cool blue-violet greys with violet-tinted shadows; the only warm notes are window light and a little brick.

## Line, shape, proportion, density
Facade is flat 2-tone masonry in a rhythm of identical sash windows with stone lintels. Cars are long, low, rounded, near-black with white-wall wheels, chrome lamps and running boards, about 2.7 times a person's height in length. People about 9% of screen height with a 1px dark outline, no face detail beyond dark dots.

## Copy exactly
Palette, facade rhythm, car silhouette and scale, wet violet road, tiny people.

## Do not copy
Sign text, the shop name, any real car brands, the bus-stop lettering. Original sprites only; nothing traced from the source game. PG-13.

## Where it lands
See `docs/LOUIS.md` and `src/render/noir.ts`. Street pictures (003 to 006, 008) drive `Street2D.ts`; interior pictures (007, 009, 010) drive `InteriorView.ts`.
