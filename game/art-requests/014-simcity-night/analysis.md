# Analysis: SimCity Societies night city

What is in the picture:
- Dense blocks at dusk/night. The darkness is deep blue-violet, but every lit window is a saturated warm rectangle with a soft halo, so buildings read as glowing objects, not as dim walls.
- Light spills from ground-floor fronts onto the pavement in warm pools.
- Colour temperature contrast: warm tungsten windows, a few cold cyan screens, against indigo shadow.
- Variety on each facade: no two floors identical.

Integration (src/render/NightGlow.ts, Buildings.ts, Renderer.ts):
- Lit windows are repainted on a separate emissive layer after the darkness overlay, so they stay bright; a two-step additive bloom gives the halo.
- Shop fronts, lobbies and clubs throw a fading warm pool on the footpath.
- Nearer buildings wipe the glow layer behind them (per-tile silhouette), so occluded windows never show through.
- Only drawn at zoom >= 0.8; night only; day rendering untouched.
- What is deliberately NOT copied: the glossy 3D-render finish. Mosaics stays flat-shaded vector art.
