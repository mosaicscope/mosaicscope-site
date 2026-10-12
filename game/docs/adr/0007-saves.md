# ADR 0007: Versioned saves, world regenerated from seed

**Decision.** The world layout is regenerated deterministically from the seed. Saves store everything dynamic: characters, relationships, memories, toys, environment, groups, routines and recent event history. Saves have a `version`, and migrations run in order (v1 → v2 → v3 are implemented; v3 packs memories and relationships into tuples). Floats are rounded to 3 decimals. Parsing validates the data and throws a readable `SaveError` instead of crashing. Storage goes through a `StorageProvider` interface, with localStorage now and room for IndexedDB later. All keys are under `mosaics-world:`.

**Consequences.** A save is about 700 KB for 511 people after an hour of game time, so three slots fit comfortably in localStorage. Transient AI plans are dropped and replanned on load.
