# Crash contact and material visibility

A hard impact now knocks a parked target into a temporary sliding crash state. The parking brake still resists rolling through tyre friction. Gentle parking contacts leave the target parked. Secondary collisions remain consequential when both bodies are already in a crash state.

After the normal impact solve, up to eight local separation iterations settle a bounded island of at most 32 nearby bodies. This prevents separating one pair from leaving it inside the next wreck. Damaged parked overlaps in the same island can also be separated without inventing new damage or kinetic energy. Ambient traffic retains its yield/spacing path. The conservative chassis collider remains; this is an arcade rigid-body crash model with persistent local mesh deformation, not a finite-element simulator.

Loose skins and the bonnet now use the deformed mesh rather than a flat overlay that hides the crush. End impacts produce local folds, side impacts retain intrusion, and contact-local exposed metal and crease highlights track the body surface. A continuous paint underlay and local deformation threshold avoid triangle seams across healthy bodywork. Existing individual glazing, wheel, lamp, bumper, hood, progressive attachment, fluid and repair systems remain active. Contact scars and local dents stay bounded; nearby crash-island work has a fixed cap.

Validation: hard/gentle parked contacts; a five-car collision; old overlapping wreck correction; secondary impacts; no artificial position-solver damage/energy; persistent crush and repair; existing damage/traffic suites. The browser collision runs the actual simulation, while a separate six-view visual fixture calls the actual renderer for light, moderate, frontal, side and repeated rear impacts. Displayed impact speeds use the game's unit conversion and do not claim real crash-test certification.

Rollback source and generated world assets together. Existing damage/save state remains compatible.

Persistent deformation uses a bounded 4,096-point cache per rendered damaged vehicle, invalidated by changed dents, structure, proportions or repair. Numeric keys quantize local lookup coordinates to 1/4096 world units; the mesh keeps its original point values. In the mapped five-car damaged-scene fixture, mean combined step/render measured 6.05 ms at normal CPU and 21.51 ms under 4x throttling (p95 28.3 ms). This remains above a 60 FPS budget on the throttled fixture and is not a universal performance guarantee.
