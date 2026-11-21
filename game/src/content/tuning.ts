/**
 * Fifty driving upgrades, none of which does the same job as another. Each changes how the car actually behaves in the physics
 * (see sim/VehicleTuning.ts and the car step in sim/Traffic.ts): power and boost, launch and top speed, brakes and brake fade,
 * tyre grip in the dry and wet, how the front bites and the rear lets go, differentials and drivetrain swaps, weight, roll,
 * drag and downforce, cooling, and driver electronics. Prices are game dollars.
 */
export type TuneGroup = "Engine" | "Drivetrain" | "Brakes" | "Tyres & wheels" | "Suspension & chassis" | "Aero, cooling & body" | "Electronics & steering";
/** Multiplier keys start at 1 and multiply together; the others start at 0 and add. */
export interface Fx {
  power: number; launch: number; top: number; brake: number; fade: number; grip: number; steer: number; steerSpeed: number; oversteer: number; frontBite: number; diff: number; mass: number;
  roll: number; drag: number; resp: number; shift: number; hand: number; puncture: number;
  boost: number; lag: number; nitro: number; wet: number; rough: number; down: number; cooling: number; durable: number; warm: number; launchCtl: number;
  drive: "" | "rwd" | "awd";
}
export const NEUTRAL: Fx = { power: 1, launch: 1, top: 1, brake: 1, fade: 1, grip: 1, steer: 1, steerSpeed: 1, oversteer: 1, frontBite: 1, diff: 1, mass: 1, roll: 1, drag: 1, resp: 1, shift: 1, hand: 1, puncture: 1,
  boost: 0, lag: 0, nitro: 0, wet: 0, rough: 0, down: 0, cooling: 0, durable: 0, warm: 0, launchCtl: 0, drive: "" };
export interface TuneDef { id: string; name: string; group: TuneGroup; cost: number; blurb: string; fx: Partial<Fx>; conflicts?: string[] }
const T = (id: string, group: TuneGroup, name: string, cost: number, blurb: string, fx: Partial<Fx>, conflicts: string[] = []): TuneDef => ({ id, group, name, cost, blurb, fx, conflicts });

export const TUNING: TuneDef[] = [
  // ---- engine
  T("intake", "Engine", "Cold-air intake", 420, "A little more power and a sharper throttle.", { power: 1.04, resp: 1.04 }),
  T("exhaust", "Engine", "Performance exhaust", 650, "Freer breathing: more power and a better noise.", { power: 1.05 }),
  T("ecu1", "Engine", "ECU remap, stage 1", 900, "Fuel and ignition mapped for power and a higher limiter.", { power: 1.08, top: 1.02 }),
  T("turbo", "Engine", "Turbocharger kit", 4200, "Big mid-range punch, but it has to spool: boost builds while you are on the throttle.", { boost: 0.26, lag: 0.7 }, ["supercharger"]),
  T("supercharger", "Engine", "Supercharger", 4800, "Instant, linear power with no lag, and a little extra drag.", { power: 1.16, drag: 1.02 }, ["turbo"]),
  T("forged", "Engine", "Forged internals", 3100, "The engine survives heat and abuse much better.", { durable: 0.45 }),
  T("flywheel", "Engine", "Lightweight flywheel", 800, "The engine revs and responds faster, at a small cost to launch.", { resp: 1.25, launch: 0.97 }),
  T("injectors", "Engine", "High-flow injectors", 700, "More fuel up top: a touch more power and top speed.", { top: 1.03, power: 1.03 }),
  T("intercooler", "Engine", "Intercooler", 1300, "Cooler, denser air: more boost and less heat soak.", { boost: 0.03, cooling: 0.2 }),
  T("nitrous", "Engine", "Nitrous system", 2200, "Three bursts of extra power, engaged at full throttle in the lower gears, recharging over time.", { nitro: 3 }),
  // ---- drivetrain
  T("lsd", "Drivetrain", "Limited-slip differential", 1800, "Both driven wheels share the grip, so you get power down out of corners.", { diff: 1.12 }),
  T("tvd", "Drivetrain", "Torque-vectoring differential", 5200, "Sends power where it helps: the nose bites under power and the tail is calmer.", { diff: 1.06, frontBite: 1.12, oversteer: 0.92 }),
  T("short", "Drivetrain", "Short-ratio gearbox", 1100, "Rapid acceleration, lower top speed.", { launch: 1.14, top: 0.92 }, ["long"]),
  T("long", "Drivetrain", "Long-ratio gearbox", 1100, "A higher top speed at the cost of punch off the line.", { launch: 0.9, top: 1.1 }, ["short"]),
  T("seq", "Drivetrain", "Sequential gearbox", 4300, "Near-instant shifts, so you lose almost no speed between gears.", { shift: 0.4, power: 1.01 }),
  T("rwd", "Drivetrain", "Rear-wheel-drive conversion", 6500, "All the power to the back: oversteer on the throttle, and the tail comes round.", { drive: "rwd" }, ["awd"]),
  T("awd", "Drivetrain", "All-wheel-drive conversion", 9500, "Four driven wheels: huge launch traction and a nose that holds, but it pushes on.", { drive: "awd", launch: 1.06, frontBite: 1.08 }, ["rwd"]),
  T("clutch", "Drivetrain", "Heavy-duty clutch", 950, "Bites harder on launch.", { launch: 1.06 }),
  // ---- brakes
  T("pads", "Brakes", "Sports brake pads", 380, "More bite from the brakes.", { brake: 1.1 }),
  T("bbk", "Brakes", "Big brake kit", 3400, "Bigger discs and calipers: more stopping power and far less fade.", { brake: 1.18, fade: 1.4 }),
  T("lines", "Brakes", "Braided brake lines", 260, "A firmer pedal and slightly better braking.", { brake: 1.04 }),
  T("ceramic", "Brakes", "Carbon-ceramic discs", 6800, "Very little fade, and they are light.", { fade: 1.8, mass: 0.995 }),
  T("bias", "Brakes", "Brake-bias adjuster", 300, "Shift the braking to the rear to rotate the car under trail-braking.", { oversteer: 1.08, brake: 1.02 }),
  T("hydhand", "Brakes", "Hydraulic handbrake", 520, "A stronger rear lock for starting a slide or pulling a handbrake turn.", { hand: 1.35 }),
  // ---- tyres and wheels
  T("sport", "Tyres & wheels", "Sport tyres", 1200, "More dry grip that wears faster.", { grip: 1.1 }, ["semi", "allterrain", "winter"]),
  T("semi", "Tyres & wheels", "Semi-slick track tyres", 2600, "Huge dry grip, poor in the wet, and they wear quickly.", { grip: 1.2, wet: -0.25 }, ["sport", "allterrain", "winter"]),
  T("allterrain", "Tyres & wheels", "All-terrain tyres", 900, "Hold on loose surfaces and rough ground, a touch less sharp on tarmac.", { grip: 0.96, rough: 0.25 }, ["sport", "semi", "winter"]),
  T("winter", "Tyres & wheels", "Winter tyres", 1100, "Much better in the rain and the cold.", { wet: 0.18, grip: 0.97 }, ["sport", "semi", "allterrain"]),
  T("runflat", "Tyres & wheels", "Run-flat tyres", 1400, "A puncture barely upsets the car.", { puncture: 0.2, mass: 1.01 }),
  T("widerear", "Tyres & wheels", "Wider rear tyres", 1500, "More traction at the back, so it holds the tail in and pushes a bit at the front.", { grip: 1.04, oversteer: 0.88, frontBite: 0.97 }),
  T("lightwheels", "Tyres & wheels", "Lightweight forged wheels", 2400, "Less unsprung weight: quicker steering and a livelier car.", { steerSpeed: 1.08, resp: 1.03, mass: 0.995 }),
  T("warmers", "Tyres & wheels", "Tyre warmer pack", 650, "Tyres start the drive already up to temperature.", { warm: 0.3, grip: 1.02 }),
  // ---- suspension and chassis
  T("springs", "Suspension & chassis", "Sport springs", 750, "Less body roll and a firmer ride.", { roll: 0.75, grip: 1.015 }),
  T("coilovers", "Suspension & chassis", "Coilover kit", 2800, "Adjustable ride height and damping: flat cornering and more grip.", { roll: 0.65, grip: 1.03, rough: -0.05 }),
  T("farb", "Suspension & chassis", "Front anti-roll bar", 400, "A stable, understeering balance that is hard to spin.", { oversteer: 0.9, roll: 0.9 }),
  T("rarb", "Suspension & chassis", "Rear anti-roll bar", 400, "Free up the tail so the car rotates.", { oversteer: 1.12, roll: 0.92 }),
  T("brace", "Suspension & chassis", "Strut brace", 280, "A stiffer front end: sharper turn-in.", { steerSpeed: 1.05 }),
  T("lowering", "Suspension & chassis", "Lowering kit", 900, "Lower centre of gravity and drag, but it hates rough roads.", { roll: 0.85, drag: 0.97, rough: -0.12, grip: 1.01 }, ["lift"]),
  T("lift", "Suspension & chassis", "Lift kit", 1700, "Ground clearance for rough ground, at the cost of roll and drag.", { rough: 0.3, roll: 1.2, drag: 1.03 }, ["lowering"]),
  T("dampers", "Suspension & chassis", "Adjustable dampers", 1900, "Keeps the tyres on bumpy roads and settles the body.", { rough: 0.08, roll: 0.9 }),
  T("cage", "Suspension & chassis", "Roll cage", 2300, "A stiffer, safer shell that is heavier.", { roll: 0.85, mass: 1.04, durable: 0.1 }),
  T("diet", "Suspension & chassis", "Weight reduction", 3500, "Strip the interior and every spare kilo: it accelerates, brakes and turns better.", { mass: 0.93 }),
  // ---- aero, cooling and body
  T("splitter", "Aero, cooling & body", "Front splitter", 850, "Downforce on the front axle: the nose bites at speed.", { down: 0.06, frontBite: 1.05 }),
  T("wing", "Aero, cooling & body", "Rear wing", 1100, "Downforce on the back for stability at speed, with a bit of drag.", { down: 0.09, drag: 1.04, oversteer: 0.9 }),
  T("underbody", "Aero, cooling & body", "Flat underbody", 1600, "Smooth air under the car: less drag and a little downforce.", { down: 0.05, drag: 0.96 }),
  T("radiator", "Aero, cooling & body", "Larger radiator", 700, "The engine and brakes shrug off heat.", { cooling: 0.25 }),
  T("oilcooler", "Aero, cooling & body", "Oil cooler", 650, "Keeps the engine cool under load and extends its life.", { cooling: 0.15, durable: 0.1 }),
  T("carbon", "Aero, cooling & body", "Carbon-fibre body panels", 7200, "Lighter by a good margin.", { mass: 0.96 }),
  // ---- electronics and steering
  T("launch", "Electronics & steering", "Launch control", 2100, "The car meters the power to the line: much less wheelspin off a standing start.", { launchCtl: 1, launch: 1.08 }),
  T("rack", "Electronics & steering", "Quick-ratio steering rack", 1900, "More lock and faster response, though it can be twitchy.", { steer: 1.1, steerSpeed: 1.06 }),
];
export const TUNING_BY_ID = new Map(TUNING.map((t) => [t.id, t]));
export const TUNE_GROUPS: TuneGroup[] = ["Engine", "Drivetrain", "Brakes", "Tyres & wheels", "Suspension & chassis", "Aero, cooling & body", "Electronics & steering"];
const ADD = new Set(["boost", "lag", "nitro", "wet", "rough", "down", "cooling", "durable", "warm", "launchCtl"]);
/** Combine the installed upgrades into one set of effects. */
export function combine(ids: readonly string[]): Fx {
  const out: Fx = { ...NEUTRAL };
  for (const id of ids) {
    const t = TUNING_BY_ID.get(id); if (!t) continue;
    for (const [k, v] of Object.entries(t.fx)) { if (k === "drive") { out.drive = v as Fx["drive"]; continue; } const key = k as Exclude<keyof Fx, "drive">; out[key] = ADD.has(k) ? out[key] + (v as number) : out[key] * (v as number); }
  }
  return out;
}
