# ADR 0006: Deterministic template dialogue with information provenance

**Decision.** Dialogue is chosen from conditioned templates using the speaker's real state, relationships and memories. Memories record provenance (did / saw / told / heard), who the information came from, and its credibility. NPCs can only report what they know, and they say where they heard it. No language model is used. An optional model could later rewrite the text only.

**Consequences.** Fully offline and deterministic, with no secrets or API keys. Variety comes from conditions, variables and repetition prevention, not from claiming intelligence the game doesn't have.
