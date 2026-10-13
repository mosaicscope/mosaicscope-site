# Analysis: rusty sedan

What is in the picture (Louis' reading, copied faithfully, not invented):
- Boxy three-box sedan, faceted low-poly body. Silhouette is lived-in, not showroom.
- Orange-brown rust blooms eating the sills, wheel arches and door bottoms; bright orange in the middle, darker brown at the rim.
- Dents as darker diamond patches with a pale edge where the light catches the crease.
- Panels that do not match: a grey primer door beside the faded body paint.
- Dirt line along the bottom of the doors; sun-bleached paint.

Integration (game/src/render/CarPatina.ts, wired into Cars.ts):
- Deterministic from class + plate + price + damage, so a car keeps its scars. Nothing saved, no RNG, sim untouched.
- Age by class: bangers/retros are wrecks, police/ambulance/fire kept smart, supercars babied.
- Marks painted on the near long side with the existing face coordinates: rust (with orange bloom), dents (dark diamond with highlight), scratches, primer panels, mud line.
- Original art only: the picture sets the vocabulary of damage, the shapes are our own.
