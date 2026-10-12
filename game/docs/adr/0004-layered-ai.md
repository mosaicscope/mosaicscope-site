# ADR 0004: Layered AI (HSM + utility + GOAP), one entity type for all tiers

**Status:** accepted

**Decision.**
- A hierarchical state machine decides *which layer is in charge*: physical, then panic, then conversation, then goal.
- Utility scoring picks *what to want*: 21 goals scored from needs, personality, relationships and nearby facts, with a weighted pick among the top three (seeded RNG).
- Principals turn goals into steps with a GOAP planner over fact bits. Other tiers use template plans.
- Steps are primitive behaviours with failure handling and timeouts.

Every character is the same data shape. The simulation tier only changes update frequency and which systems run, so promotion and demotion never reset state.

**Consequences.** Behaviour is explainable: the inspector shows the live plan, and the event log shows causes. Costs scale with LOD. Background figures without promotion run a much cheaper brain.
