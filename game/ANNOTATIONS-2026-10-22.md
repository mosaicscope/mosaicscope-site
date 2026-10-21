# User annotations — preserved in full

Source build: d5752f0. Each comment is retained verbatim below. Completion requires implementation and validation, not a catalogue entry alone.

## Comment 1

this is great buit i need it to be more detailed, lots more damage realistic models for when teh car crashed into teh houses or any building at all, needs to be realveant to the building

## Comment 2

better handling for cars, better damage mpodels, borken glass, hanging off the edge, but breaks mroe as the velocitty pocks up and it curmbles, the sheet metal gest dented and worse, and teh wheel can fall off, get misalgined, dfented, brlken punctued on one end liek realistic shit bro car handling is veeryh very realisitc, car colors should be lots mroe vaired, lots more differnt modesl, more unique, and based off real cars even

## Comment 3

better handlign of all name things handlign like wtf, its getting put on the road broo

## Comment 4

need thiet be a leot more realisitc, lots more exitring, spectators, like youer gabling with other moasicas and they make gambling comnrets to cher ypou on or cpemtept with you, eveyton os gaming with you there are other peple heree too

## Comment 5

roulette table needs more action things, i can buy drinks for girls, get a loan from the bank here, credit, mafia bets, bimbo bets, lots of poepel and happpenings thigns happpen at teh ropulete tabel i want you to be legit fr

## Comment 6

casinpo is missing the crash plane game, adn tah gaem enedst o be wayy more fun, like you know lots more effects, world shit,

## Comment 7

add in actual poker and poker tournatments, with spicy checters adn thier back stories and different palystyles, lots of fun in the casino to be had, makeall the gaems have even more physical fun effects to palky with and real life thigns to itnerat with make it realistic

## Comment 8

when we tracel to differnt places, i watn teh buldigns to also rtefect exactly the cutlure adn style of the place, that can be scraped by an onlien free data set or wosmeting

## Comment 9

mroe fun movabel hitable things in real life in the world on the road, on the pavemnt, add in motor bikes too adn bikes, electric scooters,let the npcs drivce em around, also these phone calls i keep getting, make me a new cell phone that can internact, skin it like an early 2010 nokia phone ui and everything and its own little mini game isnide that is form tyht atera

## Comment 10

needs more drunks, alcoholics, domestic viloence, lots of fights, shootings, ral life drama, cars getting stolen buit onlyu relevant to how a city is like

## Implementation and validation

The ten original comments above are unchanged. The implementation below also includes the follow-up request to improve motorcycles, bicycles and poker tables.

| Comment | Implemented behavior | Validation |
| --- | --- | --- |
| 1 | Impact records identify the actual building, facade, energy and material. Timber splinters, masonry fragments, metal creases and fractured glazing stay on that facade. Existing maintenance workers board and repair the site. | Building identity/material and real maintenance-worker tests; native world screenshot. |
| 2 | Directional component damage, progressive crumple, four independent wheels with puncture/rim/alignment/suspension/failure states, clipped window fractures and missing glazing, airspeed-driven loose hood detachment, hanging bumper, exposed engine, bouncing fragments and chassis sag. Smoothed steering and damaged grip/pull affect handling. Parked targets take damage while retaining their handbrake. Twelve additional car chassis and six two-wheel classes bring the fleet to 72; production paint choices expand without recolouring service liveries. | Energy/corner, airflow, parked collision, repair, traffic flow and save-isolation tests; browser damage rendering. |
| 3 | Names anchor to the actual front roof edge and render after the building's final roof tile; screen collision bounds remain active. | World screenshots at multiple zooms; shared renderer regression suite. |
| 4 | Six actual Mosaic characters retain balances, place visible wagers, react to the actual result, chat, accept or decline drinks and acknowledge encouragement. Company appears beside the main casino games. | Browser checks of native crowd, guest selection, drink charge and roulette reactions. |
| 5 | Selectable guests and drinks, fixed-term bank and Famiglia advances, bounded credit, partial/full repayment, and named Famiglia/Bimbo side bets. Zero loses; queued roulette bets settle only on roulette, never on another game's result, and refund if the player leaves before spinning. Cash, chips, debt and side bets persist. | Credit/idempotence tests and complete browser purchase/repayment/side-bet settlement flow. |
| 6 | Crash flight is directly in the casino navigation and lobby. Sixty native aircraft, three detailed route backdrops, cloud movement, route trace, smoke on a lost round, landing celebrations, selectable stakes from $25 to $1M and a frozen cash-out result. | Browser aircraft count, scenery, launch, cash-out, single settlement and viewport checks. |
| 7 | Actual Texas hold'em: shuffled deck, blinds, four streets, calls/checks/folds/raises/all-ins, correct seven-card rankings, short all-in reopening rules, side/split pots, cash tables and escalating-blind sit-and-go tournaments. NPCs fund their own entries and receive their remaining stacks once. Distinct existing biographies and playing styles, profiles, table talk, drinks and a raise slider. The detailed room includes native seated characters, dealer, chairs, parquet floor, a raised timber/felt table, chip racks, button, shoe and moving cards/chips. | Hand-ranking, side-pot, bankroll, all-in, replay guard and save tests; browser cash/tournament/profile/mobile flows and visual inspection. |
| 8 | The map API preserves source building material, colour, architecture, roof shape/material/colour/levels and country alongside actual footprints, height and land cover. The existing world renderer uses those fields, with regional palettes, roof forms, balconies, framing, masonry and ventilation details. | API attribute/country tests, explicit-tag precedence tests, Cloudflare compiler and dense-destination render benchmark. |
| 9 | Cones, crates, barrels, carts and balls are saved, depth-sorted physical objects that can be pushed on foot or hit by vehicles. NPCs and player can use motorcycles, sport bikes, cruisers, bicycles, e-bikes and scooters through the normal traffic/vehicle systems. Dedicated geometry includes spoked tyres, forks, brakes, chains, pedals, batteries, tanks, engines, exhausts, bodywork and rider joints fitted to bars/pedals/decks. A keypad phone handles existing incoming/outgoing family dialogue, contacts, call history, messages, wallet and Snake with persistent high score. | Prop shove/save and vehicle classes tests; browser models, authored calls, keypad pause/restart, mobile fit and restored player movement/follow. |
| 10 | Nightlife intoxication requires a nearby venue and suitable existing NPC. Household incidents require actual nearby partners/shared home and frustration; assault requires an existing grudge. Fights require an actual rival; theft requires a poor thief and suitable parked owned car; gunfire requires an armed, hostile crew dispute with line of sight. Existing substances, injuries, crime/police and medical systems handle effects. Incidents appear in the event log, phone messages and street-life panel with walk/check/help actions. | Relevant-partner, injury, cooldown and ineligible-event tests; full simulation regression suite. |

### Data and scope limits

OSM footprints and explicit attributes are source data; missing facade colours, roof forms and materials use regional estimates. These are not claims of satellite/photo-exact reconstruction. Existing OSM attribution remains visible. Traffic remains simulated; this release does not claim access to live traffic observations. The tournament is a single-table sit-and-go. Vehicle damage is procedural native geometry and component simulation, not licensed scans or an engineering crash simulator.

Primary attribute references: [OSM building attributes](https://wiki.openstreetmap.org/wiki/Building_attributes), [building architecture](https://wiki.openstreetmap.org/wiki/Key%3Abuilding%3Aarchitecture), [building colour](https://wiki.openstreetmap.org/wiki/Key%3Abuilding%3Acolour), [roof shape](https://wiki.openstreetmap.org/wiki/Key%3Aroof%3Ashape).

### Release evidence

- TypeScript and production Vite build pass.
- Site/API tests: 45 pass. Cloudflare Wrangler 3 Functions compilation passes.
- Game regression suite: 842 pass across 97 files. Staged security gate: no new high or critical findings. Deployment evidence is recorded with the release pull request.
- `e2e/world-casino-annotations.mjs`: actual cashier, credit, drinks, roulette settlement, cash poker, tournament, aircraft, phone, Snake, player-control and responsive-layout flows; no runtime errors.
- Dense mapped-destination benchmark on this machine: 181 frames; mean render 6.84 ms; p95 9.00 ms; mean frame interval 16.67 ms; 50 sprites / 21.94 MB; no pending jobs. This is a measured result, not a guarantee for every device.
- Cabin renderer and its economy/first-class/window/aisle layouts are preserved; cabin browser regression is run with this release.

Rollback: revert the release squash commit and redeploy the preceding main. Optional save extensions default on old saves; exported saves remain available through the existing save UI.
