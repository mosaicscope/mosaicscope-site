# Browser annotations — 23 October 2026

Source build: `a91bb84`. The ten comments are preserved below verbatim. Historical requests remain in the earlier annotation records; this release does not claim to complete every earlier request.

## 1

> ability to zoom in and place bets and zoom back out if i want whenits spinning, and teh peopel need to be doing thier thing and not so repetivityl

Roulette has a continuous 100–320% camera, scroll-wheel zoom, full-room, betting-cloth and wheel views. Canvas art, HTML betting polygons and canvas pointer coordinates share the same camera. Zoom stays usable while wagering is locked during a spin. Individual casino guests have different work, rest, drink and watch beats, and a server walks a clear route.

## 2

> they wave thier =hadns in weird way, i need it to be more realistic movement bro, like they need to look riht from this iso metric angle we are looing from

Reduced repetitive waving and talking amplitudes, restrained gestures by facing angle, and replaced stretched casino forearms with full two-bone reach. Seated knees and feet remain anchored to projected furniture. People pause between activities.

## 3

> car dmamage model needs to better, phone needs to not be so big smalller and remove this dad mom calllign thing enturely

Deformed body panels, damaged tyres, glazing and fittings render on their physical models. The handset is 234 CSS pixels wide, with compact desktop hardware and larger touch controls. Removed the entire scheduled family-call system, family contact actions and obsolete saved family call records. City links, news, wallet and Snake remain.

## 4

> when he interacta with everything and everything he shouldo do relevelatn actions and add in more props in to the world environ ment, liek manyh amnay

37 physical street-prop types, including 32 additions. Each has its own model and action, with suitable poses, costs, effects, damage, mobility or fixed placement. Passers-by can use nearby props. Airport services animate typing, inspecting, giving, eating and resting; player service actions persist briefly and clear when movement resumes. Street life lists real objects and can walk to them.

## 5

> the marks are coming off weird imporove i tway more, btui its nice, spicder weebbing but its ebing weird

Fractures use local pane coordinates and pane clipping, with stable impact origins, branching rays and connecting rings. Windshields retain laminated webbing; badly damaged side glazing opens a clipped hole. Removed the generic floating roof and body marks. Primer scuffs and creases are clipped to actual visible metal faces. Loose bonnet geometry uses the current bonnet hinge and crumpled front edge.

## 6

> ik mnoting rn but usualy i want it when it does scan objects, the same shape of the object should also be visible not all of htme looking like guns, if i have drugs too add that in

Security receives the carried item's actual definition and reuses its native item art. Powder and cannabis bags and sedative blister packs have distinct shapes. Weapons, ammunition and carried non-alcohol drug items are screened; ordinary camera and phone items remain allowed. Existing surrender and confiscation flow handles flagged objects.

## 7

> make these more high res and fun and realistic to how it would like look at thsoes wide ass seats bro comonnn on

Rebuilt economy and first-class seats as separate proportional chairs, with cushions, lumbar pads, headrests, hinges, piping, belts and armrests. Passengers sit on the cushion and reach actual furniture with bounded limb lengths. Retained high-DPI canvas rendering, scenic wing view, meal service and the first-class fittings.

## 8

> all of the views of every scene need to have people moviong relevantly broo

Travel rooms, airport queues and security workers use context-specific activity beats. Cabin passengers read, converse, rest and drink independently while crew travel down the aisle. Casino guests work machines, place chips, rest and drink with different timing. Existing destination and authored venue routes remain in use.

## 9

> bill boards adn signs need to be improved they are glictching rendering in teh wrong aereas nad are lacking any real substance i want it to be more funneir and relevant and mosaicscope websits and instagram should be linked thorugh out and ads for it should be littered around teh city, also add more interactablke props around the city like 30 mroe real props, add more than 70 new vehicles, go crazy with the set design adn remember to make thier modesl dammageable detailed af

Increased real-world-anchored street and rooftop MosaicScope ads, with short fitted taglines and working website, booking and Instagram targets from the site's configured business data. Existing collision-aware sign reservations remain. Added 32 prop types and 86 authored road vehicles to traffic and sales, each with physical specifications, wheelbase and fittings. Vehicle shapes use the native isometric projection and retain independent damage components. Added lamp signatures and motorcycle/cycle fittings; no bitmap vehicle stand-ins.

## 10

> more life update in the city, houses have life inside thembro so lights glowing on and off or like poepel moving insdie them, the streets need to have more things going on, more interactions betterewn the mosacis anot just walking mindlesley, the soemtiems teh cars even have car chases adn shit , again car modesl need to be top tier render quality siper sniper good

Individual windows switch on a slow household schedule, moving silhouettes remain clipped to panes, and city-scale buildings retain inexpensive windows instead of bare walls. Actual neighbours can start conversations, people use street furniture, and a driving thief or mobster can evade a patrol that is already pursuing that real suspect. Existing crime, dispatch, traffic collision and injury consequences remain active.

## Validation

Verified before publishing:

- TypeScript and the production Vite build pass.
- Full game suite: **891 tests, 102 files pass**. This includes independent repairs, saved stock/anchors, all chassis contact shapes, swept impacts and facade material resistance.
- `e2e/workshop.mjs`: all 40 tools operate through visible controls, with exact cash accounting and desktop/portrait/landscape fit.
- `e2e/city-polish.mjs`: exact zoomed roulette wagers and camera changes during a spin; compact phone, no family contacts, real links and Snake; actual props, inventory-specific scanner and airport/city views.
- Existing casino/poker browser checks: real pots, payouts, credit, social wagers, 2D Crash Flight and responsive layouts pass.
- Seven cabin desktop/mobile/class/view combinations pass, including high-DPI backing and unchanged player cash.
- Native renderer gallery: all 158 vehicle classes render both intact and damaged (316 renders), all 37 prop models render intact and damaged, and all six facade materials plus directional motorcycle/tank/rear-lamp damage render without runtime errors. Screenshots were inspected.
- Security gate: no new high or critical findings. Diff whitespace check passes.

## Follow-up requests, verbatim

> the tails lights are weirdly off in the crash model, make the crash modesl of every single vehicel even better. the props need to be ocnnected bro, theior models are all over the place, amke suire they are accurate to real life, scrape models adn online data if you need to, make this wayyy beter, the crash mdoesl adn the actayul models need to be a lot lot better

> yes continie adn do all that i wil say dora from now on and you will make it 20x better and add 20 more functions to what you did

> dora

> harsher dora apply the car models need to be more detailed and on top of hat everything can crash into and be dfeformed eaxtly youd expect irl

> dora dora dora x20

The follow-up pass adds two sets of 20 usable workshop tools, for 40 total. Its quality and crash improvements cover the existing fleet as well as the 86 new models. “20×” is treated as a request for greater depth, not a measured quality or performance claim.

### Connected models and physical impacts

Headlamps, tail lamps, bumpers, plates and grilles use coordinates on their actual deformed parent surface. Lamps have independent corner damage, broken lenses, tethered loose assemblies, indicators, reversing sections and matching illumination. Removed the separate floating brake halo and duplicated headlight hot spots. Motorcycle mirrors now sit on their own physical stalks; panniers have closed volumes. Cycles, scooters, motorcycles and tracked armour keep their own geometry and damage behavior.

Body and glazing rings deform together. Contact positions determine where along a panel the dent appears, with stronger local compression, displaced pillars and pane-clipped fractures. Wheels retain independent puncture, rim, alignment, suspension and detachment states. Wipers, seams, handles, mirror mounts, bonnet hinges, grille fins and lamp housings remain connected to the car.

Roadside objects use swept oriented chassis contact, including side impacts and high-speed movement between frames. Material strength and impact energy govern damage; fixed concrete and metal objects resist motion, while light objects roll, bounce or deform. Wooden and concrete faces crack on their own surfaces. Trolley castors, basket supports, fountain taps and basins, round drums, hydrant caps, picnic supports and dispenser fittings share the object transform. Temporary anchors hold a loose object at its actual position until released.

Wall collisions use the contact direction and closing speed, retaining tangential sliding and off-centre rotation. Facade damage records its actual contact position and material: glass breaks sooner than brick, stone or concrete; timber splinters and metal creases. Moderate impacts bend connected bus shelters, street signs and decorative assemblies before severe damage becomes wreckage. Existing maintenance crews repair the actual damaged objects. Buildings retain solid structural collision; this is not a building-collapse solver.

### Forty working tools

Available from **Menu → Vehicle & street workshop**, beside an actual vehicle or street object. Repairs cost fictional game cash, require a stopped vehicle and must be performed outside it. Healthy parts are not charged again.

| First 20 | Additional 20 |
| --- | --- |
| Inspect vehicle condition | Replace side mirrors |
| Replace broken lamps | Patch attached punctured tyres |
| Fit selected spare/replacement wheel | Repair front body panel |
| Align wheels and suspension | Repair rear body panel |
| Replace windscreen | Repair left body panel |
| Replace side/rear glazing | Repair right body panel |
| Secure/replace bonnet | Refit front bumper |
| Replace bumpers | Refit rear bumper |
| Straighten bodywork | Replace front lamps |
| Service damaged engine | Replace rear lamps |
| Wash vehicle | Signal left |
| Respray vehicle | Signal right |
| Switch headlights | Cancel indicators |
| Switch hazards | Replace left glass |
| Toggle parking brake | Replace right glass |
| Sound horn/cycle bell | Replace rear glass |
| Recover real detached wheel as spare | Inspect object material/condition/stock |
| Repair real street furniture | Secure loose object |
| Set movable object upright | Release temporary anchor |
| Repaint street furniture | Restock consumable dispenser |

Partial repairs preserve other damage. Recovered wheels cannot be collected twice. Anchors, paint, stock and spare inventory survive saves. Newspaper, produce and bottled-water dispensers consume real stock and stop charging or granting benefits when empty.

### Geometry references

Original procedural game geometry was informed by manufacturer dimensions and connected assembly references. No third-party mesh was scraped or redistributed.

- [Toyota Corolla hatch dimensions](https://www.toyota.co.nz/globalassets/brochures/2021/corolla-hatch-range-02-21-web-final.pdf).
- [Toyota HiAce specification sheet](https://www.toyota.com.au/-/media/toyota/main-site/vehicle-hubs/hiace/files/20250828_hiace_spec-sheet.pdf?rev=aceff0e6c437463ea62ea67d26e3d1f0).
- [Wanzl DRC shopping trolley assembly](https://www.wanzl.com/en_AU/products/trolleys/shopping-trolleys/various-shopping-trolleys/drc-series~p1379).
- [Haws pedestal drinking fountain](https://www.hawsco.com/products/3121-concrete-pedestal-fountain/).
- [Trek FX bicycle geometry](https://www.trekbikes.com/us/en_US/bikes/hybrid-bikes/active-fitness-bikes/fx/fx-3-disc-stagger-gen-3/p/5259437/).

### Release and rollback

No server configuration, credentials or database migration is required. Older saves gain missing prop types and bounded defaults for optional workshop fields. Rollback target before this release is `a91bb84`; revert the release commit and redeploy its matching `world/` bundle. Keep source and generated assets together.

## Limits

Vehicles use detailed procedural game models inspired by familiar shapes, not licensed replicas or a soft-body crash solver. City traffic and drama are simulated. Lighting and indoor silhouettes provide ambient household activity; they are not streamed real-world occupants. Free map services retain their existing provenance and fallbacks. No universal frame-rate guarantee is made.
