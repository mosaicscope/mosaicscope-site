# Roadmap

Ordered by value for the effort. "Done" items live in [CHANGELOG.md](CHANGELOG.md).

## Next (highest value)

1. **Measure on real devices.** Run `e2e/bench-render.mjs` on a GPU desktop and phones; tune auto-quality thresholds and the Ultra tier.
2. **Cache buildings as pre-drawn images** (the largest remaining frame-rate win on weak GPUs).
3. **Player reputation arc** with each crew member and the Famiglia, driven by the NPC minds.
4. **Wider story web.** More chapters, consequences that persist across sessions (save slots for story state).
5. **Real four-lane traffic polish:** buses, trams, cyclists, emergency vehicle priority.
6. **Server-side world persistence** (optional) so Mark's changes and long-running consequences carry across visitors.
7. **Hand-made art pass** for key landmarks.

## Later

- Verlet ragdolls for big falls, blended back into poses.
- Larger worlds (96×96+) with hierarchical pathfinding.
- An optional local language model that rewrites dialogue text without changing outcomes. Never required to play.
- Time-lapse mode with daily summaries.
- A photo mode, which Kodak would approve of.

## Not planned

- Fake multiplayer, hidden network calls, or an AI service the game depends on.
