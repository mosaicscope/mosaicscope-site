# Reactive driving release

This release extends the existing impact dents, detachable parts, tyre model and medical response. It does not substitute a particle effect for mechanical damage.

## Twenty new crash consequences

| System | What changes during play |
| --- | --- |
| Front crush rails | Permanent nose shortening follows impact energy. |
| Rear crush rails | Rear shortening is independent of the front. |
| Chassis bend | Permanent lateral body bend adds steering pull. |
| Chassis torsion | Opposing corner loads twist the body and reduce grip. |
| Side intrusion | The struck cabin side moves inward locally. |
| Roof buckling | Heavy cabin impacts depress the roof. |
| Jammed doors | Drivers use the other side or rear escape when doors jam. |
| Radiator | Damage drains coolant; a running engine progressively overheats. |
| Oil sump | Oil leaks; running with low oil causes additional engine damage. |
| Exhaust | Rear damage reduces available engine power. |
| Transmission | Crush lengthens actual gear changes and reduces delivered power. |
| Steering rack | Damage reduces steering authority. |
| Axles | Front/rear axle damage independently adds drag and reduces grip. |
| Brake hydraulics | Side-specific damage weakens brakes and introduces pull. |
| Battery connections | Heavy front damage disables headlight illumination. |
| Fuel system | Rear crush gradually leaks fuel and eventually reduces power. |
| Aerodynamics | Displaced bodywork adds speed resistance. |
| Brake temperature | Repeated braking heats brakes and causes recoverable fade. |
| Brake wear | Accumulated braking work creates persistent braking loss. |
| Chassis rebound | A damped impact response unsettles grip and body roll, then settles. |

Inspect vehicle condition reports structure and fluid state. Rebuild crash-damaged mechanical systems repairs the mechanical systems; Straighten body panels repairs structural distortion. Full existing garage repair resets everything. Wash removes transferred blood without repairing damage.

## Other changes

- Ballistic wounds retain up to eight entry/exit marks per wound; bandaging still stops bleeding. Rubber ammunition and protective equipment retain their existing rules.
- Pedestrian impact blood is bounded at twelve panel-local stains per car, moves with deformation and dries. The blood-effects setting controls visibility; initial blood particle bursts are capped at 48.
- Explicit road width is preserved. Tagged lane counts use an estimated 3.4 m width only when width is missing. Directional lanes drive both traffic paths and markings. More lanes are no longer painted solely because a road looks wide.
- Following uses the leader's speed and available braking distance. Parallel lanes do not create a false crossing signal at an ordinary polyline vertex. Existing swept collision checks and buffered, offscreen stall recovery remain active.
- Numeric speed limits (including mph) replace the old blanket 60 km/h cap. Missing limits use conservative road-class estimates. Faster vehicle gearing is available only on mapped roads above 72 km/h, capped by the road limit; entering a slower road reduces power rather than deleting momentum.
- Existing map footprints and licensed aerial roof photography are retained. Missing wall, roof pitch, height, lane direction and speed data remain estimates; satellite images cannot establish exact hidden geometry.

## Validation and limits

Run typecheck, reactive-driving, driving-upgrade, driving-refinement, driving-sim, damage-response, workshop and city-flow regressions; build the game; exercise browser driving and mobile travel; measure the 990-car scene at normal and 4x CPU throttling. Measured built-game workload (990 cars, 556 people, 120 samples after 80 warm-up steps): 3.28 ms mean / 6.6 ms p95 at normal CPU; 8.64 ms mean / 15 ms p95 at 4x CPU throttling. Mobile address/paid teleport, natural street scene interactions, drift feedback, impact transfer and direct vehicle rendering checks passed. These are measured workloads, not a guarantee of 60 FPS on every computer. Dense junctions can still queue safely.

Rollback: revert the release commit and its generated world assets together if driving, saves or city-flow regress. No save migration is required; the additional component fields are optional.
