# Mosaics animal artwork

Generated with the built-in imagegen tool on 19 October 2026. Production images retain their original RGBA transparency. People continue to use the existing shared world/footer character design; these atlases do not replace their faces or identities.

- `horse-dog-gaits.png`: four columns, four rows. First eight cells: bay horse galloping; next eight: border collie running.
- `horse-dog-walk.png`: four columns, two rows. First row: the same horse standing and walking; second row: the same dog standing and walking.
- `farm-animal-gaits.png`: eight columns, six rows. Four frames per species, in order: dairy cow, sheep, pig, goat, deer, alpaca, hen, duck, goose, donkey, cat, bee.

The renderer samples equal cells, caches them, aligns their actual opaque foot baseline and selects standing/walking/running from the activity. It uses native images without modifying the source files. Existing procedural animal silhouettes remain the loading fallback.

## Generation prompts

Horse/dog gait atlas: Create one precisely aligned four-column, four-row transparent PNG sheet with no captions or grid. Eight sequential right-facing gallop frames of the same bay thoroughbred with correct equine anatomy, dark mane and tail, leather bridle and muted teal saddlecloth, followed by eight running frames of the same black-and-white New Zealand border collie. Keep each animal fully within its cell, identically scaled, feet at 82 percent cell height. Match MosaicScope: clean dark ink, muted earthy flat shading, restrained expressive faces, 2–3 shaded planes. Avoid photorealism, glossy 3D, chibi or anime.

Farm atlas: Create one eight-column, six-row transparent PNG sheet with four right-facing walk frames per species. Row pairs are cow/sheep, pig/goat, deer/alpaca, hen/duck, goose/donkey, cat/bee. Same identity and scale across each four-frame group, correct alternating legs, 82 percent foot baseline, generous padding. No text, grid or background. Use clean thin dark outlines and understated earthy flat shading consistent with the original Mosaics people and buildings.

Standing/walk atlas: Use the horse/dog gait sheet as an identity reference. Create a new four-column, two-row transparent atlas of the same bay horse and collie. Frame one of each row is a calm four-footed standing pose; the next three frames walk slowly with planted weight-bearing feet. Keep anatomy, markings, saddlecloth, dark outlines and muted colour palette consistent. No gallop, rearing, floating, background, captions or grid.

## City references

Town Hall name and address: [Venues Ōtautahi](https://venuesotautahi.co.nz/venues/christchurch-town-hall/). Campus library identity: [University of Canterbury](https://www.canterbury.ac.nz/study/library/libraries/central-library); podium/tower reference: [Open Christchurch](https://openchch.nz/buildings/university-of-canterbury-puaka-james-hight-central-library/). The map remains a simplified authored game city, not a measured Google Maps or Street View reconstruction. No Google imagery has been copied into the game.
