# Driving refinements

These are the 50 concrete driving behaviors delivered across the vehicle simulation releases. They are game-tuned approximations, not measurements or certification for real vehicle models. The regression suites `wheel-contact`, `vehicle-simulator`, `manual-transmission`, `driving-telemetry`, `driving-sim`, and `arcade-driving` exercise their behavior.

1. Driven-wheel traction responds to the surface under the front axle on front-wheel-drive cars.
2. Driven-wheel traction responds to the surface under the rear axle on rear-wheel-drive cars.
3. All-wheel-drive cars use the available grip from both axles.
4. Motorcycles and bicycles use single-track front and rear contacts rather than four car wheels.
5. Each side's wheel ground speed changes with the vehicle's yaw rate.
6. Front-wheel slip responds to steering angle and yaw at the contact patch.
7. Tyre temperature responds to the speed of the individual wheel.
8. Tyre wear responds to the speed and slip of the individual wheel.
9. Water-film formation responds to the speed of the individual wheel.
10. Loose surfaces increase tyre wear without mistaking wet asphalt for rough ground.
11. Cold tyres gradually reach their normal grip as they warm up.
12. Brake cooling responds to vehicle speed and wet conditions.
13. Damaged suspension springs change their wheel's suspension response.
14. Damaged dampers change their wheel's suspension response.
15. The damped suspension response remains bounded over different physics step sizes.
16. A damaged control arm reduces grip at its own wheel.
17. A missing wheel removes that contact's driven and braking capacity.
18. Tyre force responds nonlinearly to the load on each wheel.
19. Reduced front-axle grip causes additional understeer.
20. Reduced rear-axle grip increases the tendency to slide.
21. Unequal left and right braking grip creates a bounded steering pull.
22. A damaged caliper reduces braking at its own wheel.
23. Heat causes individual brakes to fade under sustained braking.
24. Individual brakes accumulate wear and can be serviced independently of tyre tread.
25. Brake distribution shifts toward the front as load transfers under deceleration.
26. ABS modulates wheel lock independently on low-grip surfaces.
27. The handbrake locks the rear wheels without falsely locking the front wheels.
28. Wheel rotation recovers progressively after the handbrake is released.
29. ABS intervention changes the heat generated at its wheel.
30. Traction control responds to excess drive demand at powered wheels and reduces requested drive torque.
31. Service braking no longer falsely requests traction control.
32. Driver-aid presets let the player select automatic, on, sport or off behavior.
33. Stability assistance responds to excessive yaw and can be disabled for drifting.
34. Rendered front wheels use different inside and outside steering angles in a turn.
35. Each rendered wheel rotates according to its own ground speed and lock state.
36. A locked wheel can leave its own skid mark.
37. Eligible vehicles can switch between automatic and manual shifting.
38. Manual drivers can shift up and down with on-screen controls or the keyboard.
39. Manual shifts have a short torque interruption and cannot be repeated during that shift.
40. Manual downshifts that would exceed the selected gear's limit are refused.
41. The selected manual gear has its own acceleration and speed envelope.
42. Reverse still uses the normal reverse pedal, and forward shifts are refused while reversing.
43. Shift safety uses the same speed envelope as the physics, including chassis modifications.
44. Single-speed electric vehicles and bicycles do not offer a false multi-gear manual mode.
45. Combustion-engine lift-off braking responds to engine speed, gear and drive mode.
46. Electric regenerative coasting tapers at low speed.
47. Aerodynamic drag responds to speed and the vehicle's frontal dimensions.
48. Body damage affects aerodynamic drag, load and high-speed directional pull.
49. Players can adjust each existing tyre's pressure in the workshop, with different effects on sealed and loose surfaces.
50. The optional trip computer records distance, peak speed, acceleration, 0–100 time and 80–0 braking distance from actual vehicle movement.

The aerodynamic and control models are informed by the [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/) and [NHTSA's braking and stability-control overview](https://www.nhtsa.gov/sites/nhtsa.gov/files/documents/13497a_812574_hydraulicbrakingsystem.pdf). Coefficients remain game tuning rather than vehicle-specific measured data.
