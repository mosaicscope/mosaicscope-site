# Vehicle simulation

Impacts apply localized, accumulated damage to 50 named components. Component effects feed steering, braking, engine power, cooling, drag and exit access. Mechanical, wheel and body repairs are separate, and the workshop inspection reports component and tyre condition.

The driven vehicle tracks pressure, temperature, wear, load, suspension travel, slip, brake heat, water film and rotation for each wheel. These states influence traction, steering pull and braking, with wet-speed grip loss, load transfer, handbrake locking and electric regenerative coasting. Older saves initialize the wheel state on demand. This is a tuned game approximation; it is not calibrated or validated against a particular real vehicle.

The qualitative treatment of wet grip and braking draws on NHTSA background on [tyres and tyre pressure](https://www.nhtsa.gov/sites/nhtsa.dot.gov/files/tirepressure-fmvss-138.pdf) and [vehicle braking systems](https://www.nhtsa.gov/sites/nhtsa.gov/files/documents/13497a_812574_hydraulicbrakingsystem.pdf).

The driven car also models four contact patches, tyre-specific braking, load-sensitive grip, steering geometry and driveline differences. Split-surface traction and braking depend on each wheel; ABS and traction control respond in assisted modes, while handbrake and drift modes retain more slip. Brake fade, caliper damage and wear influence braking independently. Suspension springs and dampers have a bounded, damped response and engine braking varies with gear; electric vehicles use tapered regenerative coasting. These are game-tuned approximations, not a calibrated vehicle model.
