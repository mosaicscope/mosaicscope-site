status: analysed
# 001 Bum Fights cover (600x800 JPEG, portrait)

**Request:** gritty hand-drawn pixel-art, thick outlines, dark alley mood.

## Palette (median-cut, 8 colours, share of image)
| Hex | Share | Role |
|-----|-------|------|
| #181211 | 22% | deep shadow / alley void |
| #a37262 | 17% | title lettering, skin light (salmon-brick) |
| #3b2723 | 16% | brick mid-shadow |
| #4c4341 | 12% | cobble / stone grey |
| #2a1d1d | 10% | wall shadow |
| #825241 | 9% | skin shade, rust brick |
| #bdafa2 | 7% | smoke cloud, vests (warm off-white) |
| #170b0d | 2% | outline black |
Accents (small areas): lamp amber ~#e8a23a, orange helmet ~#e0702a, red lightning ~#d83a2a, teal sky glimpse ~#2f4a52.
Rule: everything is warm brown with ONE cool teal glimmer. No pure black, no pure white; the lightest tone is a warm #bdafa2.

## Line and shape
- Outlines are near-black (#170b0d), thick (about 3 to 4% of figure height), uniform weight, rounded joins.
- Figures are chunky: head about 1/3.5 of body height, shoulders wider than hips, huge fists. Heroic cartoon proportions, not realistic.
- Shading is flat cel with 2 tones per material plus a hard dark outline. No gradients on figures; background uses dithered posterised bands.
- Title lettering is chiselled block letters with a dark outline and a white sticker border.

## Mood
Dim, lamp-lit back alley at night, wet cobbles, brick on both sides funnelling the eye to a vanishing point, two tough characters squaring up in the foreground. Comic-violent but cheerful: smoke-cloud brawl burst with stars, boot, fist, bottle.

## Copy exactly
1. The 8-colour palette above, as named constants.
2. Outline weight and colour.
3. Two-tone flat shading on characters.
4. Warm lamp pools on a near-black ground.

## Do not copy
The title text and logo, the viking helmet, any brand-like marks, and anything depicting real people. Brawl clouds are fine as a comic effect; keep it PG-13.

## Integration plan
See `docs/LOUIS.md`. Candidate hooks: a "gritty" palette in `src/render/palette.ts`, outline weight option in `StickFigure.ts`, alley-brick texture in `Textures.ts`, lamp light pools in `Lighting.ts`. Pure data first; renderer changes only behind a quality-tier flag.
