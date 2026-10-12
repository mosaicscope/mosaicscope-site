# ADR 0005: Event queue with causality limits

**Decision.** World events go through a central queue with:
- priority, and a dedupe key plus per-type cooldown;
- causal depth (each event records its cause; anything deeper than `maxCausalDepth` is rejected);
- a queue cap with lowest-priority eviction (backpressure);
- a per-tick processing budget.

Handlers in `sim/Rules.ts` turn physical facts into events, and events into memories, feelings and goals. That's how chains emerge without scripts.

**Consequences.** Event storms are impossible by construction (tested with a self-re-emitting handler). The log can show "because…" chains.
