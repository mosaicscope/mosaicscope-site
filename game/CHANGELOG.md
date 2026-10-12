# Changelog

## 0.1.0: first playable world (2026-10-12)

- New: the Mosaics' world at `/world/`, a separate static page built from `game/` into `world/`. The only main-site change is that the footer easter egg's "Our world · coming soon" sign is now a link ("Our world · step inside").
- Simulation core: fixed-step clock, seeded RNG with savable state, typed config budgets, feature flags.
- World: seeded district generator with a connectivity guarantee, budgeted A* navigation with a request queue, uniform-grid spatial hash.
- Characters: player, 10 principal Mosaics (from the site's crew), 80 regulars, 420 background locals; dynamic simulation LOD with promotion and demotion that preserves state.
- AI: hierarchical state machine, 21 utility goals, GOAP planner for principals, needs/mood, stuck recovery, replanning, learned toy preferences.
- Physics: 2.5D toy physics with sub-stepping, layers/masks, durability, tethers, spring pads, pushable heavies, shields, capped knockback, stumble/fall/recover.
- Social: sparse relationship graph, memories with provenance, gossip with credibility, groups, reputation, reconciliation.
- Events: 34 event types with priority, dedupe, cooldowns, causal depth limits, backpressure and history with cause chains.
- Dialogue: context-conditioned templates, NPC conversations with consequences, player dialogue UI.
- Environment: day/night, weather, blackouts, parties, shooting stars.
- Rendering: Canvas 2D isometric renderer, chunked ground, depth sorting, batched crowds, particles, lighting, rain, bubbles, debug overlays, adaptive quality.
- UI: inspector, event log, dialogue, settings, saves (3 slots, schema v3, v1→v2→v3 migrations), tutorial, touch controls, developer panel.
- Audio: synthesised spatial sound (off by default).
- Tooling: 67 unit/integration tests, browser smoke test (14 checks), headless and in-browser benchmarks, feature catalogue generator (1,135 entries, honestly labelled).
