# Roadmap

Ordered by value for the effort. "Done" items live in [CHANGELOG.md](CHANGELOG.md).

## Next (highest value)

1. **Measure on real devices.** Run `e2e/bench-render.mjs` on a GPU desktop and a mid-range phone, record the results, and tune the auto-quality thresholds.
2. **Wall fading / cutaways.** Fade wall tiles that hide a character. This would let the Studio have taller walls and more rooms.
3. **Player reputation arc.** Stranger → regular → honorary Mosaic, unlocked by witnessed kindness. Each Mosaic would get special dialogue.
4. **More autonomous mini-games.** Tag, dodgeball and dance-offs on top of the existing event and group systems (the ball game and throwing contest already exist).
5. **Crew territories and truces.** Faction behaviour built on the existing crews and group leaders.
6. **Export/import save files and an IndexedDB storage provider.** The provider interface already exists.
7. **Event replay.** Snapshot plus seed lets you re-simulate an incident from the log (the simulation is already deterministic).
8. **Scenario editor and debug console.** Place people and toys, set grudges, and save the setup as a reproducible test.
9. **Back-facing figure views and more pose variety** (mood-driven walk cycles).
10. **Hand-made art pass.** Swap the procedural tiles and props for drawn sprites. The renderer API stays the same.

## Later

- Verlet ragdolls for big falls, blended back into poses.
- Larger worlds (96×96+) with hierarchical pathfinding.
- An optional local language model that rewrites dialogue text without changing outcomes. Never required to play.
- Time-lapse mode with daily summaries.
- A photo mode, which Kodak would approve of.

## Not planned

- Fake multiplayer, hidden network calls, or an AI service the game depends on.
