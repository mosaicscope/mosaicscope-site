# Mobile movement and progressive damage

The earlier driving, city streaming, road geometry, aerial roofs, fleet, address travel and performance work is retained.

## Movement and city life

Fixed tutorial input and visual blockers: generic UI pointer events intercepted touches, and player control treated the touch tutorial as a blocking modal, and rendering froze beneath it. Direct presses around the joystick centre now create immediate analog input. Pointer capture survives leaving its hit area; cancellation and focus loss clear input. Touch movement resumes a paused world. The phone hides street controls while it is open.

Walking increases from 1.1 to 1.25 times base pace. Sprint builds from 1.75 to 2.4 times pace over 1.4 seconds, with bounded acceleration, stamina use and wall collision. Nearby scenes start up to every fifteen seconds using existing eligible people on safe pavement. Six life-themed verses, call-and-response lines and busking actions vary performances. Existing two-scene and twenty-four-history limits remain.

## Progressive crash models

Each glazing zone records bond strength, retained glass, flutter and shed fragments. Impact severity and material govern initial damage. Air pressure scales with driving speed squared. Laminated fronts retain a bonded edge under moderate damage; damaged side panes shed loose pieces. Repair resets retention and attachment strength.

Outer skins have independent hinge strength, permanent curl, wind flutter and detachment. The renderer shows curled patches and exposed inner framing; detached skins retain their bend. Shed pieces have individual size, world position, velocity, three-axis tumbling, drag, ground bounce and settling. The shared debris budget stays at twenty-four pieces per damaged car. Existing local dents, chassis deformation, component failures and repair actions remain active.

## Forty additional injury effects and reactions

1. Ballistic entry cavity
2. Entry abrasion collar
3. Impact bruising halo
4. Ragged exit cavity
5. Torn exit petals
6. Punctured fabric fibres
7. Entry wound rivulet
8. Pulsing wound edge
9. Directional ballistic spatter
10. Impact residue rim
11. Long open incision
12. Serrated cut edges
13. Parallel blade nicks
14. Intersecting cuts
15. Hanging skin flap
16. Slashed clothing seam
17. Beaded cut edges
18. Slow wound seepage
19. Exposed layered tissue
20. Attached visceral strands
21. Deep spreading haematoma
22. Yellowing bruise margins
23. Raised impact swelling
24. Small impact spots
25. Grazed road abrasion
26. Directional scrape lines
27. Compressed tissue crease
28. Swollen injured joint
29. Protruding fracture detail
30. Fracture edge chips
31. Pain sweat beads
32. Pain tremor
33. Laboured guarded breathing
34. Protective torso hunch
35. Asymmetric injured gait
36. Injured hand tremor
37. Load-bearing knee buckle
38. Blood-loss pallor
39. Blood-soaked dressing
40. Drying clotted edges
41. graze

These include visual details and functional body reactions, rather than forty global particle emitters. Injury type, anatomy, severity, bullet exits, elapsed time, blood level and treatment choose effects. Distance budgets draw one, five, eight or twelve local detail passes per visible wound, retaining critical tissue/trauma first. Close views retain the full catalogue. A render-cost budget at low quality reduces full crowd artwork under sustained load and recovers slowly; player, selected, hovered and followed people retain priority. Entity positions, injuries, AI and medical response continue unchanged. Severe sharp/ballistic torso wounds create attached tissue with damped extension and sway driven by movement. Leg injury changes pace and gait; torso injury changes posture and breathing; arm/head trauma adds tremor; blood loss causes pallor and shock. Bandaging stops bleeding and tucks exposed tissue away. Rubber, armour, medical response, recovery and the blood visibility setting are preserved.

The models are bounded game approximations, not a validated medical or engineering simulator. Validation includes fixed-step movement, material shedding, component repair, injury treatment, mobile touch events and frame costs. Rollback should revert source and generated world assets together.

## Release validation

Production build and typecheck passed. The affected suite passed 158 tests before the final artwork-budget change; the final targeted renderer/progression suite passed 18 checks, including the added adaptive-budget regression. CI repeats the full affected suite. Security and 52 API/engine checks passed. Browser checks cover real tutorial touch movement/resume/sprint/release/cancellation, address search and paid travel, street performances, actual vehicle collision initialization and attached tissue advancement.

Recorded deterministic seed-1 workloads: ordinary 990-car city averaged 2.53 ms simulation + render at normal CPU. Final extreme injury workload (994 cars including medical response, 556 people) averaged 4.61 ms / 7.5 ms p95 at normal CPU, and 22.49 ms / 43.8 ms p95 at 4x CPU throttling. The throttled workload remains below 60 FPS; adaptive artwork lowers its mean cost from the initial 30.56 ms measurement while retaining all simulated entities. No universal FPS guarantee is made.
