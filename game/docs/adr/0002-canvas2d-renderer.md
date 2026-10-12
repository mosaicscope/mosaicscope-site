# ADR 0002: Canvas 2D renderer instead of PixiJS/WebGL

**Status:** accepted

**Context.** The brief suggested PixiJS. The characters are stick figures: a handful of line segments and a circle each, procedurally posed. The main costs are draw calls and sorting, not texture fill.

**Decision.** A custom Canvas 2D renderer:
- ground is pre-rendered into cached chunk canvases;
- one depth sort per frame;
- background silhouettes are batched into a single stroked path per run of same-coloured, adjacent-in-depth figures;
- lighting is a low-res overlay;
- particles are pooled.

There's no runtime dependency and no WebGL context to lose. Canvas 2D is GPU-accelerated in modern browsers and falls back to software when needed.

**Consequences.** Measured at 60 FPS for 511 entities even with software rendering. At several thousand visible figures, a WebGL instanced path would scale further. The renderer only reads simulation state, so it could be replaced without touching the simulation.
