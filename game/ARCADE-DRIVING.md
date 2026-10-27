# Arcade driving response

The trigger for this release was sluggish pickup, cars losing useful speed too early, difficult steering after minor damage, and crash interruptions that made repeated driving feel unresponsive.

- Free-driving cars retain useful engine torque through the middle of the speed range; taper is restricted to the final eighteen percent of the target. Passenger-car launch torque, forward gear multiplication and pedal response increase. Shifts blend more torque over shorter interruptions.
- Player gearing uses the mapped road context: ordinary streets allow thirty percent arcade headroom over the posted speed, high-speed roads thirty-five percent. Vehicle-specific limits remain, with larger highway gearing headroom for passenger cars. The governor reduces available drive force rather than clamping existing momentum. Autonomous traffic retains its existing mapped speeds and right of way.
- Cosmetic body damage no longer stacks several large top-speed and grip penalties. Front damage must reach thirty percent before the legacy engine-damage estimate begins. Severe engine, cooling, transmission, steering and wheel failures still have consequences. Missing wheels and punctures retain drag and reduced grip.
- Steering input, centring and countersteer respond sooner. Road mode has less throttle-induced rear looseness, while Sport/Drift and the handbrake retain intentional slides. High-speed tyre force, wet-road braking, load transfer and swept collision checks remain active.
- Bent-panel steering pull is bounded and eases with speed. Actual rack and hydraulic damage remain. Player control returns sooner after a glancing crash, based on solved change in speed. Collision momentum, local dents, progressive parts, medical response and repair state are preserved.
- Cosmetic accessories no longer incur an automatic six-percent speed penalty each. Heavy body modifications still affect gearing and geometry. Cycles and heavy utility vehicles do not inherit passenger sports-car launch/gearing multipliers.
- Camera follow looks ahead along actual vehicle motion, capped at eight metres. A visible parking-brake release button explains why an intentionally secured vehicle will not move. Keyboard hints distinguish normal braking/reverse from the handbrake.

Validation includes measured stock-hatch acceleration beyond fifty km/h within four seconds on a city fixture; performance-car acceleration beyond eighty km/h within three seconds on a highway fixture; steering release and drift recovery; cosmetic versus mechanical damage; input-rate consistency; reverse/service-brake behaviour; all catalogue chassis; local crash components; traffic-flow and existing mobile/injury/travel checks. These are game tuning targets, not manufacturer specifications or a validated engineering simulator. All earlier map, city, crash and injury work is retained.

Rollback: revert source and generated world assets together. No save migration is required.
