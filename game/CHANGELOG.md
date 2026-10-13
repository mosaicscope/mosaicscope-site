# Changelog

## Unreleased

- Street stories (Tess): a fortune-teller booth on Cathedral Square ($5 slips that quietly come true: a coin purse, a friendly hello, a friendly horn, a pigeon), neighbour feuds that escalate every six game hours (bad blood, litter, shouting, then a brawl) until you hear both sides out and broker a truce for a reward, plaza pigeons you win over with crumbs ($1) who tag along, remember where you usually walk next and wait there, and a rooftop coop with a ladder, feeder and pennants where they roost at night (`sim/Stories.ts`, `render/StoryArt.ts`, `tests/stories.test.ts`). Saved with the game (no version bump).
- Street litter and recycling: cans, bottles, wrappers and cups on the pavements (messier round clubs, alleys and food streets), street bins by doors and benches, and the Avon Recycling Centre on Cashel Mall. Pick up cans and bottles (E), rummage bins, then cash them in at the centre: 10c a can, 20c a bottle, 25% bonus for 20+. Cleaners tidy up, litter persists in saves (no version bump).
- 2D street view: restyled as a gritty pixel-art brick alley (cobbles, bins, cans, puddles, lamp pools, chunky outlined people). Fixed people vanishing: the old filter was a hard +/-1.6 depth band plus a nearest-7 cut; now a wide band with a soft fade, hysteresis on the cap and smoothed positions (`render/Street2D.ts`, `tests/street2d.test.ts`).
- Interiors: 16 more places get their own floor plan so each feels like what it is: cafe, bakery, pizza, sushi, fish and chips, dairy, toy shop, sports shop, pawn shop, record shop, fuel station, barber, gym, nightclub, gallery and car dealership. Shop counters open the shop panel; the gallery and dealership desks open theirs. Only the Studio still uses the generic shopfront.
- Terrance the overcoder: a completely red NPC who always stands in front of the Studio. Talk to him for the latest changes and any team drama, read from `src/content/terrance-feed.json` (refresh with `npm run terrance`). He never wanders.
- Cars: 25 new vehicle classes (37 total) so the street stops looking like the same four cars. Everyday: kei mini, wagon, minivan, coupe, roadster, retro bug, EV, banger with rust and a mismatched door, camper with a pop-top. Work: double-cab ute, flatdeck, tradie van with ladder, ice-cream van, post van, tow truck, rubbish truck, Metro bus, hearse, fire engine. Performance: hot hatch, rally, lowrider, hot rod with flames, stretch limo, 4x4 with a spare wheel. Parody names only, 16 are for sale at the dealership.

## 0.4.0

- Cars: 25 new vehicle classes (37 total) so the street stops looking like the same four cars. Everyday: kei mini, wagon, minivan, coupe, roadster, retro bug, EV, banger with rust and a mismatched door, camper with a pop-top. Work: double-cab ute, flatdeck, tradie van with ladder, ice-cream van, post van, tow truck, rubbish truck, Metro bus, hearse, fire engine. Performance: hot hatch, rally, lowrider, hot rod with flames, stretch limo, 4x4 with a spare wheel. Parody names only, 16 are for sale at the dealership.
- Clinical layer: 249 evidence-tagged studies (`mind/Evidence.ts`), stress, anxiety, depression, trauma and a rare psychosis spectrum with genetic liability from families (`Psychopathology.ts`, `Kin.ts`), whanau support and stigma (`Whanau.ts`), care pathways, Putahi Mental Health Unit. Saves are now v6 (v5 migrates).
- Interiors: enterable interiors with props and people (hospital, Putahi, police, bank, office, apartments, house, hotel); other kinds use a generic shopfront until more are written.
- Zoo: visitors react to the animals you own.
- Mobile: zoom rescue on rotation, pinch/double-tap zoom blocked.
- Smoke test accepts the interior overlay for the police station.

## 0.3.0: the living city (2026-10-13)

- **Roads and traffic.** 4-lane roads (left-hand traffic), lane choice and changes, stop lines, give-way rules, pedestrian signals (people cross on the green man), a 164-tile map with clubs and a zoo placed in real Christchurch blocks.
- **Places.** The Pink Pukeko (comic strip club with the money-gun "make it rain" game, ownership and income), the Velvet Rooms (innuendo-only lounge), Velvet & Co. Luxury (property, rides, 18 animals), the Velvet Zoo, an HD casino (blackjack, European roulette, pokies, 9/6 video poker), the airport (tickets, check-in, x-ray, flights, six cities) and a travel log in Your Empire.
- **Stories.** The Famiglia (five chapters), 17 further missions across Mannequin Mike, Sir Ponsonby Velvet, the Night Kiwi, Dr Quakenstein, the zookeepers and Roastie Malone, contract hits, roast battles, burger shifts, pickpocketing, hold-ups, shoplifting, cartoon firearms (black market, gunfire crime, armed police, rare turf wars).
- **Dialogue.** About 15,500 lines of authored call-and-response exchanges, picked by time, weather, place, role, mood, relationship and recent events; paced by reading time; cute rounded bubbles heard only within about 4 tiles.
- **Phones.** Floating analog stick, a contextual action button, side buttons, a ⋯ sheet with every PC action, a slim menu bar, tucked HUD and radar, crossfaded 2D/3D.
- **Graphics.** Procedural material textures, ambient occlusion, a 2D street view (V), a police helicopter, an **Ultra** quality tier (2x textures with weathering and baked bump lighting, supersampled ground, native resolution, cinematic grade).
- **Life.** Time-away consequences (you get skinny and hungry, rent comes out, the crew misses you), calm everyday-life pacing, 50 crowd styles, natural passing and pace, focus mode, family phone calls.
- **Minds.** NPCs have psychologically grounded minds (see docs/MINDS.md).
- **Robustness.** A crash-proof main loop with a recovery panel, a chaos soak test, locked stats endpoint (`STATS_KEY`), anonymous play-time stats, a daily caretaker agent (Mark) that proposes improvements through pull requests.

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
