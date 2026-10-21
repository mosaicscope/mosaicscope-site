# Flight, venues, racing and street-play upgrade

## Requested work

- Preserve the existing random encounter trigger; add real nearby street furniture and context-specific dressing. Add further dairy, medical, police, warehouse, home, party and street props to authored scenes.
- Render baggage screening and cabin scenes sharply with uniform high-DPI transforms. Use a closer portrait cabin composition on mobile.
- Add window/aisle cabin views, crew service, nuts/fruit, headphones, blankets, fictional comfort tablets and first-class upgrades with soup, a main course and dessert. Purchases affect the actual wallet; food, rest and substance state carry into arrival.
- Keep mapped geography, click-to-move, follow camera and zoom distance while reducing destination rendering cost.
- Advance horse race physics every simulation tick; draw the race at 60 fps, with hoof dust, leaders and finish celebrations. Existing betting, payout and save rules remain authoritative.
- Remove the licence gate, default licence restriction and practice/test buttons; retain legacy save compatibility.
- Use the native Mosaic character renderer for clothed adult club performers and patrons, with costumes and stage effects.
- Add roulette ball trails, chip/number highlights and a visible native croupier. Bar purchases affect the real player and persist into the world; the player can choose a substance-dependent confrontation, recorded through the existing wound and crime systems.

## 25 engineering fixes

1. **Building sprite churn:** Retain a larger LRU working set instead of rebuilding after the old 16-sprite limit.
2. **Building memory ceiling:** Account for canvas bytes and cap the destination sprite cache at 128 MiB.
3. **Cold-load frame stalls:** Rasterise building tiles incrementally with a 3 ms per-frame warm-up budget.
4. **Oversized footprint workload:** Bound sprite tessellation to 28 cells per side at the mapped viewing distance.
5. **Repeated geometry copies:** Deduplicate building, road, venue and terrain records when district data changes.
6. **Repeated building sorting:** Reuse a depth-sorted building list between geometry updates.
7. **Expensive collision scans:** Index footprints in spatial buckets rather than scanning every building for every step.
8. **Hidden world rendering:** Do not redraw the Christchurch world behind full travel, venue or activity screens.
9. **Tall building distortion:** Keep facade height independent of footprint tessellation scale.
10. **Hidden travel movement:** Freeze the street body while its player is inside the travel interface.
11. **Automatic fire during travel:** Prevent held fire from firing into the underlying world during travel.
12. **Automatic fire inside clubs:** Prevent held fire from continuing behind a club screen.
13. **Automatic fire during luxury shopping:** Prevent held fire from continuing behind the luxury interface.
14. **Automatic fire inside interiors:** Prevent the street body firing while a walk-in interior is active.
15. **Stuck keyboard input:** Release held movement keys when the browser loses focus.
16. **Stuck mouse fire:** Release mouse-down and dragging state on focus loss.
17. **Stuck touch controls:** Clear touch steering, braking and firing on focus loss.
18. **Lost pointer capture:** Release dragging and firing when pointer capture is lost.
19. **Cancelled pointer gestures:** Clear touch and mouse state when a pointer gesture is cancelled.
20. **Activity sharpness after browser zoom:** Rebuild canvas backing stores when display scale changes.
21. **Stretched activity hit targets:** Use the same uniform-fit transform for rendering and pointer coordinates.
22. **Background practice time jumps:** Pause local activity animation time while the page or stage is hidden.
23. **Club sharpness after browser zoom:** Refresh the club canvas backing resolution when device pixel ratio changes.
24. **Gun toolbar overflow:** Allow aiming controls to wrap within the current CSS viewport.
25. **Panel and dock overflow:** Bound panels, top bar, HUD and dock to the CSS viewport at browser zoom levels.

## 50 interactive additions

These are **12 distinct skill games and 38 street interactions**, not 50 copies of one minigame. Scores, repeat-reward cooldowns and activity counts are saved. Native wave, bow, stretch, breathing, salute, juggling, coin and shadowboxing gestures render on the actual character. Target-dependent world actions require a real nearby object or resident.

1. **Street hoops** (`basketball`) — Time the release at the centre mark.
2. **Penalty shootout** (`penalty`) — Read the keeper, then choose left, centre or right.
3. **Darts** (`darts`) — Tap the moving target close to its bullseye.
4. **Fishing line** (`fishing`) — Keep your tension marker inside the moving green band.
5. **Busker rhythm** (`rhythm`) — Play the indicated lane as each beat reaches the line.
6. **Photo focus** (`focus`) — Match the focus ring to the moving subject three times.
7. **Circuit repair** (`repair`) — Toggle the nine switches and their neighbours until every light is off.
8. **Garden tending** (`garden`) — Plant, water, let the plants grow, then harvest three plots.
9. **Bicycle delivery** (`delivery`) — Navigate the street grid to the marked delivery address.
10. **Skate line** (`skate`) — Jump each cone as it reaches your board.
11. **Ring toss** (`rings`) — Hold to build power, then release inside the gold band.
12. **Shuffleboard** (`shuffle`) — Set power with the horizontal position of your tap. Friction decides where the puck stops.
13. **Breathing break** (`breathe`) — World interaction; free.
14. **Stretch your shoulders** (`stretch`) — World interaction; free.
15. **Bench break** (`bench`) — World interaction; free.
16. **Wave to the street** (`wave`) — World interaction; free.
17. **Take a theatrical bow** (`bow`) — World interaction; free.
18. **Street dance** (`dance`) — World interaction; free.
19. **Sing a chorus** (`sing`) — World interaction; free.
20. **Tap a street rhythm** (`drum`) — World interaction; free.
21. **Air-guitar solo** (`guitar`) — World interaction; free.
22. **Juggling flourish** (`juggle`) — World interaction; free.
23. **Soap bubbles** (`bubbles`) — World interaction; $2 game cash.
24. **Sidewalk chalk pattern** (`chalk`) — World interaction; $3 game cash.
25. **Fountain wish** (`wish`) — World interaction; $1 game cash.
26. **Fountain splash** (`splash`) — World interaction; free.
27. **Coin trick** (`coin`) — World interaction; free.
28. **Confetti popper** (`confetti`) — World interaction; $5 game cash.
29. **Launch a frisbee** (`frisbee`) — World interaction; $12 game cash.
30. **Bounce a ball** (`ball`) — World interaction; $8 game cash.
31. **Practise a skate flourish** (`skateflair`) — World interaction; free.
32. **Shadowboxing drill** (`shadowbox`) — World interaction; free.
33. **Running warm-up** (`warmup`) — World interaction; free.
34. **Friendly salute** (`salute`) — World interaction; free.
35. **Frame the skyline** (`skyline`) — World interaction; free.
36. **Watch the clouds** (`clouds`) — World interaction; free.
37. **Listen to the weather** (`rain`) — World interaction; free.
38. **Cheer a race finish** (`cheer`) — World interaction; free.
39. **Paper-star celebration** (`lantern`) — World interaction; $3 game cash.
40. **Warm your hands** (`hands`) — World interaction; free.
41. **Picnic lunch** (`picnic`) — World interaction; $12 game cash.
42. **Takeaway tea** (`tea`) — World interaction; $5 game cash.
43. **Water break** (`water`) — World interaction; free.
44. **Switch a nearby lamp** (`lamp`) — World interaction; free.
45. **Sort nearby recycling** (`recycle`) — World interaction; free.
46. **Pick up nearby rubbish** (`tidy`) — World interaction; free.
47. **Repair a damaged fixture** (`sign`) — World interaction; $10 game cash.
48. **Repair a nearby flat tyre** (`tyres`) — World interaction; $10 game cash.
49. **Tune a parked engine** (`engine`) — World interaction; $15 game cash.
50. **Help a nearby neighbour** (`neighbour`) — World interaction; free.

## Validation

- All 821 simulation tests passed across 96 files; the subsequent native-gesture regression also passed with the targeted activity checks.
- All 44 backend and publishing-authorization tests passed.
- Browser walkthrough: baggage, class upgrade, all three courses, included extras, comfort effects, bar purchases, dealer injury/crime, native club cast, circuit game reward, all 50 catalogue entries, browser zoom and mobile cabin.
- Destination benchmark: the zoomed-out Tokyo fixture averaged 16.67 ms between frames, with 10.1 ms destination-render p95 and 50 cached building sprites using about 21 MiB after warm-up on the test machine. This is measured performance, not a guarantee for every device or map.
- Public map data, live traffic availability and venue interiors retain the limitations described in the previous destination release.

## Cabin art refinement

- Aisle view uses the same 2:1 ground axes and upright native Mosaic cast as world interiors. Economy has paired seats; first class has wider individual seats, a service console and extra space. Geometry, seams, cushions, seat belts, bins, latches, galley drawers, exit door, reading lights and trolley have consistent projected depth.
- Window view retains a close scenic composition, with recessed fuselage framing, layered clouds and distant terrain, wing slats and hinges, fairings and an engine. Nearby seats and service furniture use the same isometric axes and muted teal, cream, charcoal and brass palette.
- Food, cutlery, a napkin, cups, the comfort kit, blanket and headphones follow the existing service state. Mobile aisle framing keeps the actual player and meal near the centre; window framing retains the scenic close-up. Canvas scaling is uniform with retina backing, and motion respects the existing reduced-motion setting.
- Validation: TypeScript and production build; seven visual combinations covering both views/classes, desktop, portrait and landscape; the complete existing flight/venues/street-play browser walkthrough.
