# Driving engine: 20 development upgrades

The existing tyre, drivetrain, damage, and traffic systems remain the foundation. This change improves control, fleet throughput, and physical impact response without requiring per-model logic for new cars.

1. **Bounded physics steps.** Free-driving and crashed cars integrate at up to 120 Hz. Hitch catch-up is limited to 250 ms; traffic-only frames use 60 Hz to avoid unnecessary work. Full-frame previous positions survive for interpolation and roadside sweeps.
2. **Footprint spatial index.** Reused eight-tile buckets replace all-pairs collision searches. Long and modified chassis occupy every relevant bucket; moving cars index their swept footprint.
3. **Local traffic perception.** Following, overtaking, oncoming checks, exit clearance, junction occupancy, and overlap recovery query nearby buckets instead of repeatedly scanning the entire fleet.
4. **Predictive following.** Safe speeds account for the leader's projected motion, reaction time, available braking, and bumper clearance. A moving queue can accelerate without treating every leader as stationary.
5. **Weather-aware traffic braking.** AI stopping distances and deceleration use actual tyre/surface adhesion, including damaged running gear. Numerical floors keep disabled vehicles from generating unbounded searches.
6. **Chassis-aware clearance.** Queues, merges, stop lines, and receiving lanes use the same mutated/modded body dimensions as physical contacts.
7. **Grip-limited AI turns.** Turn speed responds to wheelbase and tyre grip, so a wet bend or damaged chassis gets a slower approach.
8. **Predictive merge safety.** Faster cars approaching from behind and closing speeds ahead enlarge the required lane-change gap. A target-lane claim also covers a car still crossing between lanes.
9. **Incident bypass and overtake hysteresis.** Cars identify parked/crashed obstructions early, can skip a planned turn to bypass an incident, and use a three-second cooldown to avoid repeatedly swapping lanes.
10. **Concurrent safe junction streams.** Parallel and opposing straight routes can use a green together. Crossing and turning routes still reserve the junction; approach leases include body length and expire after abandonment.
11. **Speed-sensitive steering response.** Wheel input is smoother at speed, with quicker centring and countersteering to catch a slide.
12. **Wheelbase-aware yaw.** Short cars respond more quickly than long chassis. Exponential yaw response and crash spin damping stay consistent across integration rates.
13. **Mode-aware stability assistance.** Road and Trail modes resist developing spins. Sport and Drift keep the more permissive rear-slip response.
14. **Progressive handbrake breakaway.** Rear grip fades progressively with speed rather than changing abruptly at one speed threshold.
15. **Tyre temperature adhesion.** Warm tyres gain modest grip; sustained overheating reduces it. Existing heat, smoke, and repair systems remain connected.
16. **Running-gear rolling resistance.** Punctured, bent, and missing wheels add drag as well as changing braking/steering. Future fleet models inherit this automatically.
17. **Continuous chassis collision checks.** Swept separating-axis tests catch fast, narrow vehicles passing through each other between endpoints. Ordinary contacts calculate a point on the overlapping body faces.
18. **Angular and scraping crash impulses.** Impacts include velocity at the contact point, rotational inertia, tangential friction, mass-weighted separation, and speed-dependent restitution. Parked brakes hold while panels still deform; severe hits crush more and rebound less.
19. **Severity-driven feedback and recovery.** Sparks, fragments, and control recovery scale with impact speed. Debris begins at the struck panel and inherits vehicle momentum; broken glass does not refill endlessly. Substeps emit tyre feedback once per game tick. Drivers remain attached to the corrected chassis position, and crash events preserve solved momentum.
20. **Traffic continuity around incidents.** Ordinary AI yields and backs out of contact with parked/queued cars instead of starting a crash cascade. Appointment pedestrians retain their existing longer wait/travel allowance through signal queues, instead of losing their booking to the generic one-minute timeout.

## Verification

`tests/driving-upgrade.test.ts` adds 21 regression scenarios covering fleet-local queries, modified chassis, concurrent reservations, following, incident bypass, long traffic waits, frame-rate consistency, every authored vehicle class, swept impacts, crash momentum, and bounded debris.

Run `node node_modules/vite-node/dist/cli.mjs scripts/driving-bench.ts 180` from `game/` for a repeatable engine-only fleet stress test at 200, 600, and 1,200 vehicles. It uses identical seeded layouts, 60 warm-up ticks, and reports mean/p95 update time, travel distance, and damaged-car count. World generation, pedestrian AI, and rendering are outside its timer. Dense fleets deliberately include parked road obstructions; this is a stress test, not a claim about browser FPS or unlimited car counts.

The current catalogue needs no new handling schema: dimensions, wheelbase, mass, grip, brakes, top speed, authored base family, drive mode, chassis modifications, and component condition determine behaviour.

### Local stress results

Sequential runs on this Windows machine, 90 measured frames after 60 warm-up frames, comparing the parent commit `a3de565` with this upgrade:

| Vehicles | Parent mean / p95 (ms) | Upgrade mean / p95 (ms) | Mean improvement |
| --- | --- | --- | --- |
| 200 | 6.747 / 17.229 | 2.859 / 4.765 | 2.4× |
| 600 | 58.074 / 75.668 | 18.616 / 41.306 | 3.1× |
| 1,200 | 273.433 / 399.639 | 44.626 / 79.050 | 6.1× |

The upgraded runs recorded zero damaged cars in this deliberately obstructed AI-only layout (the parent recorded 2, 2, and 18). Timing varies with other work on the machine. The 1,200-car stress case still exceeds a 16.7 ms frame budget before rendering; these measurements establish improved scaling, not a guarantee of 60 FPS at arbitrary fleet sizes. Recorded travel distance also includes overlap recovery and must not be interpreted as junction throughput.
