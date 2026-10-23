# Christchurch world and flight release

The normal game now uses the same surveyed OpenStreetMap coordinate system and native isometric art as travel. Its central Christchurch core covers 1.72 × 1.72 km at two metres per simulation tile. It contains 1,444 real footprints, the Avon, mapped roads and paths, with stable gameplay building IDs for shops, homes, casino and story systems. Existing saves retain money, inventory, relationships, ownership and vehicle component damage while their positions migrate to the mapped streets. Airport activities remain available through the airport-transfer venue; the real airport is outside this central survey.

Live-city tools operate on this main world rather than a second preview. Current weather and available road notices use the existing attributed endpoints. Reported closures affect simulated traffic routes. Traffic movement is a game simulation, and local-road notice coverage depends on the provider. Source geometry is surveyed; missing heights, materials, facade details, interiors and road markings are game interpretations, not exact photographic replicas.

Buildings use their actual polygon edges for vehicle contacts. Glass, timber, brick, metal, concrete and stone respond differently; reinforced structures retain their structural volume. Persistent scars, displaced material, boarding, scaffolding and repair crews share the struck facade bay. Travel districts use the same damage and architecture artists.

The fleet adds 200 named production models across 20 authored body families. A new main world starts with 150 moving and 210 parked vehicles, selected without repeatedly exhausting a small model pool. Utility payload affects acceleration, braking, steering response, roll and collision inertia; working vehicles have visible loads, heat and service details. Spatial collision queries, reduced distant updates, static road buffers, cached architecture, bounded room animation and bounded sprite memory keep the larger scene manageable.

## Twenty new Crash Flight controls and systems

1. Preselected automatic cash-out.
2. Correct automatic settlement after background-tab delays.
3. A chosen multiplier alert.
4. Free practice with no wallet changes.
5. Last-flight visual replay.
6. Replay seeking.
7. Replay pause and playback-speed controls.
8. A saved journal of up to forty flights.
9. Recent flight totals and net chip results.
10. A best cash-out record.
11. Saved favourite aircraft and route.
12. Day, sunset and night lighting choices.
13. Clear, rain and snow atmosphere choices.
14. Journey-following and fixed camera modes.
15. Journey-distance instrumentation.
16. Altitude instrumentation.
17. Airspeed with km/h or knot units.
18. Vertical-speed and flight-phase instrumentation.
19. Route beacons and progress to the next beacon.
20. A live multiplier trace, with calm-effects and instrument-display controls.

The 2D scene also has a smaller aircraft, nine routes, deeper parallax, route landmarks, runway transitions, gear movement, landing/departure and controlled crash animation. New rounds use a longer pacing curve; already-running old saves retain their original timing. All instruments and scenery are cosmetic and never predict or modify the random endpoint. Replays and practice never create chips. Cash-outs settle once through the shared settlement function.

## Verification

Automated coverage includes mapped geometry and entrances, greater fleet quantities, mapped traffic, facade contacts, damage/save persistence, legacy save migration, utility physics, exact automatic settlement and ties, practice, journal restoration and old flight compatibility. Chrome checks cover the shared map/live city, nine routes, real UI cash-out/practice/replay controls, desktop, phone and landscape sizing, casino cameras, airport scanning, the detailed cabin and regional travel.

Rendering samples from Chrome on the development machine were approximately 4–8 ms median and 5–11 ms at the 95th percentile across overview, normal and close night views. These are measured drawing costs, not a promise of 60 FPS on every device. The benchmark script separately reports full simulation costs.

Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0. The bundled source is [christchurch.json](../src/world/christchurch.json); `scripts/christchurch-snapshot.mjs` refreshes the bounded survey from the existing map API converter.
