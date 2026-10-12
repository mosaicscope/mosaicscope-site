# Changelog

## 0.2.0: the city (2026-10-12)

- **Christchurch.** The world is now central Christchurch inside the Four Avenues: real street names in their real order (Deans Ave … Madras St, Bealey Ave … Moorhouse Ave) and landmarks in the right blocks, including Hagley Park, the Botanic Gardens and the Avon, Cathedral Square, Victoria Square, the Arts Centre, Cashel Mall, the hospital, the police station and the SALT District, plus an airport. Street names are painted on the roads, the HUD shows street and district, a GTA-style district title fades in, and a radar minimap and full map (M) are added. In production the full map draws real OpenStreetMap streets via the new `/api/chch-map` Pages Function (© OpenStreetMap contributors, ODbL).
- **Buildings.** Proper storeys (tall shopfront ground floors, flats and offices above) with striped awnings, glass curtain walls, brick flats with balconies, gabled houses with chimneys, parapets, rooftop plant and water tanks, neon trim that glows after dark, and a smooth perspective cutaway that dissolves only what stands between the camera and you.
- **Cars.** Lofted 3D models with per-face lighting, raked glass, pillars, spoked wheels, liveries, light bars, wings, racing stripes and neon underglow. There are 12 classes with parody names, lane traffic with lights, driving, carjacking, crashes, towing, a dealership, Pay 'n' Spray at the fuel station, and a police helicopter with a searchlight at 3+ stars.
- **Life.** Cash in NZD, shops, food, pawning and barter. A full casino (blackjack, European roulette, Jacks or Better 9/6, and a pokie with an exact 92.54% RTP). Crime with witnesses, police, arrests and wanted stars; graffiti and cleaners; wounds, bleeding, bandages, collapse and hospital (nobody dies); romance, dates, affairs and gossip (off-screen, adults only).
- **People.** Unique names and faces, roles with workplaces and homes, and new parody characters: the Famiglia Tessera, Roastie Malone the roast comic, Sir Ponsonby Velvet and his VELVET models, the Night Kiwi, Dr Quakenstein, ski bunnies, smugglers and zookeepers.
- **Dialogue.** About 4,000 lines of authored call-and-response exchanges, picked by time, weather, place, roles, moods, relationships and recent events, never repeated between the same pair, and paced by reading time. Speech bubbles are calmer: only the three nearest conversations are heard.
- **Focus mode.** Important moments (being mugged, busted, crashing, a kiss, talking to someone) get letterbox bars, a vignette, a push-in and a caption. Family members phone you with branching calls.
- **Character cards.** Who they are, what they're doing, how they feel about you and a few fun facts; the detail lives behind "More".
- **MosaicScope.** Billboards carry the real logo and one short line, and click through to the site; the crew plug real Instagram posts and the real price list.
- **Saves.** v4, carrying cars, graffiti, tills, crime records and bookings; v3 saves migrate.
- **Fixes.** Dates no longer deadlock when both partners lead; repeat 111 calls no longer delay the ambulance; nobody can be pushed off the map edge; movers behind tall buildings sort correctly; keys work while a dev-panel checkbox has focus.

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
