# Upgrade list

Candidate upgrades for the Mosaics' world, taken from two places in the repo:

- `game/ROADMAP.md`, the "Next" and "Later" sections.
- `game/src/content/catalogue.ts`, the entries marked `planned`. The catalogue says these
  are candidate ideas and are not in the game.

Nothing here has been agreed as work to do. Each item needs a yes or no before it's built.
Complexity is the catalogue's own 1 (small) to 4 (large) rating where it has one.

Photo mode is left out: the changelog says it's already in the game.

## From the roadmap

1. **Measure on real devices.** Run `e2e/bench-render.mjs` on a desktop GPU and on phones; tune the auto-quality thresholds and the Ultra tier.
2. **Cache buildings as pre-drawn images.** The largest remaining frame-rate win on weak GPUs.
3. **Player reputation arc** with each crew member and the Famiglia, driven by the NPC minds.
4. **Wider story web.** More chapters, and consequences that persist across sessions via save slots for story state.
5. **Real four-lane traffic polish.** Buses, trams, cyclists and emergency-vehicle priority.
6. **Server-side world persistence (optional).** Lets Mark's changes and long-running consequences carry across visitors.
7. **Hand-made art pass** for key landmarks.
8. **Verlet ragdolls** for big falls, blended back into poses.
9. **Larger worlds (96x96 and up)** with hierarchical pathfinding.
10. **Optional local language model** that rewrites dialogue text without changing outcomes. Never required to play.
11. **Time-lapse mode** with daily summaries.

## From the catalogue (planned)

Faction behaviours (complexity in brackets):

12. Crew territories: crews claim districts and defend them with toys. [4]
13. Crew rivalries: crew-level grudges that outlast individual ones. [3]
14. Truces: leaders negotiate truces after big fights. [4]

Progression:

15. Skill growth: throwing accuracy and dodge improve with practice. [3]
16. Player reputation tiers: stranger, regular, then honorary Mosaic. [3]

World and simulation modifiers:

17. Festival day: decorations, extra crowd and music all day. [3]
18. Low-gravity toys: a silly modifier for toy physics. [1]
19. Time-lapse mode: run days quickly, with summaries. [3]

Player tools:

20. Follow-cam director: auto-cut to the most interesting event. [3]

Save and replay:

21. Event replay: re-simulate from a snapshot and seed to watch an incident again. [4]
22. Rewind: ring buffer of snapshots for short rewinds. [4]
23. Export and import save files. [1]
24. IndexedDB storage provider, for bigger saves than localStorage allows. [2]

Modding:

25. JSON content packs: load toys, lines and events from a JSON file. [3]
26. Scenario editor: place people and toys, set grudges, save as a scenario. [4]

Debug tools:

27. Debug command console: spawn things, set needs and trigger events by typing. [2]
28. Timeline visualisation: events on a timeline with causal arrows. [3]
29. Automated regression detection: CI compares bench and event-count baselines. [3]

Experimental systems:

30. Optional local language model dialogue (same as item 10, from the catalogue's side).
31. Local economy: trade toys for favours with simple prices. [4]
32. Event prediction: NPCs anticipate fights and avoid them. [4]

Environmental puzzles:

33. Get the ball off the roof: stack crates and use spring pads to retrieve stuck toys. [3]
34. Restore the power: find the switch in the Studio during a blackout. [3]
35. Dam the pond: push crates to change where water splashes. [3]

Inventory and collectibles:

36. Toy durability repair: Bando can repair broken toys. [2]
37. Lost photo negatives: Kodak's negatives are scattered around; return them. [2]
38. Mosaic tiles: hidden tiles that complete a mural. [2]

Audio:

39. Footstep materials: different footsteps on grass, sand, wood and pave. [1]
40. Character vocal blips: per-character voice timbre for speech bubbles. [2]

Accessibility:

41. Colour-blind palettes for relationship and tier colours. [1]
42. Screen reader event narration: announce nearby events via ARIA live regions. [2]

Procedural generation:

43. Multiple world sizes: generate 96x96 and 128x128 blocks. [2]
44. Interiors with rooms: multi-room buildings with doors that open. [4]

Physics and animation:

45. Ragdoll blending (same as item 8, from the catalogue's side). [4]
46. Inverse kinematics for reaching: hands reach toys and other hands. [3]
47. Procedural animation variation by mood: walk speed, posture and arm swing follow mood. [2]
48. Character customisation: choose your stick figure's colours and hat. [2]

## Count

48 numbered items. Items 30 and 45 repeat items 10 and 8 from the roadmap, so there are 46 distinct ideas.
