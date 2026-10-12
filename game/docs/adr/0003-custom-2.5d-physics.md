# ADR 0003: Custom 2.5D toy physics instead of a general engine

**Status:** accepted

**Context.** Toys move on a ground plane with a height axis (lobbed throws, bounces, spring pads), in an isometric world made of tiles. General 2D engines (Matter, Planck) have no height axis. 3D engines (Rapier) are heavy and less deterministic across platforms.

**Decision.** A small purpose-built engine:
- circles on the plane plus z, with mass, restitution, friction and spin;
- axis-separated tile collision with low walls that airborne toys can clear;
- swept sub-stepping (anti-tunnelling);
- layer/mask filtering, a toy spatial hash, sleeping bodies;
- tethers, spring pads, durability and breaking.

Characters are kinematic circles that receive capped impulses. Gameplay effects (stumble/fall) are decided separately in `combat.ts`.

**Consequences.** Deterministic, cheap (under 0.05 ms per tick with 85 toys) and fully tested. It is not a general rigid-body solver: there's no stacking or rotational collision response.
