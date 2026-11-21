/**
 * WORLD PROBLEMS CATALOG
 * ---------------------------------------------------------------------------
 * A big, data-first library of things that go wrong in a lived-in world:
 * tiny embarrassments, household disasters, street trouble, health scares,
 * weather and nature, infrastructure failures, social friction and crime.
 *
 * Every problem describes:
 *   - who/what it hits, and where and when it can plausibly happen
 *   - possible root causes (so the same problem can have different stories)
 *   - signs: what the player can notice BEFORE anyone tells them (cues that
 *     your ambient engine / NPC barks / animation layer can present)
 *   - fixes: the different ways it can be resolved
 *   - ignored: what happens if nobody intervenes
 *   - optional escalation into a worse problem, which makes chains
 *     (small leak -> flooded floor -> collapsed ceiling)
 *
 * It is intentionally independent from rendering. Pair it with the ambient
 * engine: weather and time drive eligibility, and 'signs' can be played as
 * ambient cues.
 *
 * Severity: 1 trivial, 2 annoying, 3 serious, 4 dangerous, 5 catastrophic.
 */

import type { Biome, WorldContext } from './ambient-life-engine';
import { Rng } from './ambient-life-engine';

/* ================================ TYPES ================================== */

export type ProblemDomain =
  | 'everyday' | 'household' | 'street' | 'traffic' | 'health' | 'weather' | 'nature'
  | 'animal' | 'infrastructure' | 'economic' | 'social' | 'crime' | 'work' | 'travel';

export type Condition =
  | 'night' | 'day' | 'rain' | 'dry' | 'wind' | 'calm' | 'cold' | 'freezing' | 'hot'
  | 'spring' | 'summer' | 'autumn' | 'winter' | 'fog' | 'crowd' | 'storm' | 'wet';

export interface ProblemDef {
  id: string;
  title: string;
  domain: ProblemDomain;
  severity: 1 | 2 | 3 | 4 | 5;
  where: Biome[];            // empty = anywhere
  cond: Condition[];         // ALL must hold (empty = no requirement)
  cause: string[];           // possible root causes; one is picked per instance
  signs: string[];           // what can be noticed first
  fixes: string[];           // ways it can be resolved
  ignored: string;           // consequence of doing nothing
  escalatesTo?: string;      // id of the worse problem it can become
  after?: number;            // seconds before escalation if unresolved
  weight: number;            // relative likelihood
  tags: string[];
}

export interface ProblemInstance {
  uid: number;
  def: ProblemDef;
  cause: string;
  severity: number;          // can drift from def.severity per instance
  age: number;
  stage: 'brewing' | 'active' | 'resolved' | 'ignored' | 'escalated';
  signsShown: number;        // how many signs have been revealed so far
  resolvedBy?: string;
}

/* ============================== BUILD HELPERS ============================ */

const URBAN: Biome[] = ['street', 'alley', 'plaza', 'suburb', 'industrial'];
const WILD: Biome[] = ['forest', 'meadow', 'beach', 'park', 'farm'];
const HOME: Biome[] = ['suburb', 'street', 'interior'];
const ANY: Biome[] = [];

interface Body {
  cause: string[]; signs: string[]; fixes: string[]; ignored: string;
  cond?: Condition[]; escalatesTo?: string; after?: number; weight?: number; tags?: string[];
}

const catalog: ProblemDef[] = [];
function P(id: string, title: string, domain: ProblemDomain, severity: 1 | 2 | 3 | 4 | 5, where: Biome[], b: Body) {
  catalog.push({
    id, title, domain, severity, where, cond: b.cond ?? [], cause: b.cause, signs: b.signs, fixes: b.fixes,
    ignored: b.ignored, escalatesTo: b.escalatesTo, after: b.after, weight: b.weight ?? 1, tags: b.tags ?? [],
  });
}

/* ============================ EVERYDAY MISHAPS =========================== */

P('everyday.grocery_bag_split', 'Grocery bag splits open', 'everyday', 1, URBAN, {
  cause: ['overloaded with glass jars', 'bag already torn on a door handle', 'wet paper bag in the rain'],
  signs: ['an apple rolls across the pavement', 'a muffled "oh no"', 'someone crouching, scooping things up'],
  fixes: ['help gather the items', 'hand over a spare bag', 'chase the rolling can'],
  ignored: 'they scoop it up alone, embarrassed; a squashed tomato stays on the ground', weight: 2, tags: ['comic'],
});
P('everyday.lost_keys', 'Lost keys', 'everyday', 2, ANY, {
  cause: ['fell out of a pocket on a run', 'left in the door of the shop', 'a child took them as a game'],
  signs: ['patting down every pocket', 'retracing steps with eyes on the ground', 'swearing quietly at a bin'],
  fixes: ['find them (they are somewhere on the earlier route)', 'call a locksmith NPC', 'break in through the window'],
  ignored: 'they miss an appointment and are locked out for the night',
});
P('everyday.locked_out', 'Locked out of home', 'everyday', 2, HOME, {
  cause: ['door swung shut behind them', 'keys inside', 'lock jammed in the cold'], cond: [],
  signs: ['standing on a porch in slippers', 'peering through a window', 'trying every window latch'],
  fixes: ['find the spare under the pot', 'call someone with a key', 'climb in through the open upstairs window'],
  ignored: 'they wait on the step for hours and catch a chill', escalatesTo: 'health.hypothermia_mild', after: 1800,
});
P('everyday.phone_dead', 'Phone dies at a bad moment', 'everyday', 1, ANY, {
  cause: ['forgot the charger', 'cold drained the battery', 'old battery'],
  signs: ['jabbing at a black screen', 'asking passersby for the time', 'looking at the sky for direction'],
  fixes: ['lend a charger', 'give directions', 'let them use your phone'],
  ignored: 'they get lost or miss a meeting', weight: 2,
});
P('everyday.umbrella_inverted', 'Umbrella blown inside out', 'everyday', 1, URBAN, {
  cause: ['strong gust between buildings', 'cheap umbrella'], cond: ['wind'],
  signs: ['ribs sticking out like a dead bird', 'a person holding a ruined umbrella above their head anyway'],
  fixes: ['offer a spot under yours', 'point to the nearest shelter'],
  ignored: 'they are soaked and the umbrella ends up in a bin', weight: 2, tags: ['comic'],
});
P('everyday.hat_blown_away', 'Hat blown away', 'everyday', 1, ['plaza', 'park', 'street', 'beach'], {
  cause: ['gust at a corner', 'forgot to tie the strap'], cond: ['wind'],
  signs: ['a hat tumbling down the street', 'someone running with one hand up'],
  fixes: ['stop the hat with a foot', 'chase it and return it'],
  ignored: 'the hat lands in a puddle or a fountain', weight: 2, tags: ['comic'],
});
P('everyday.spilled_coffee', 'Hot coffee spilled', 'everyday', 1, URBAN, {
  cause: ['bumped in a crowd', 'lid not pressed down', 'slippery step'], cond: ['day'],
  signs: ['a yelp', 'brown splash on a white shirt', 'a half-empty cup rolling'],
  fixes: ['give a napkin', 'point to a toilet', 'offer to buy another'],
  ignored: 'a stained shirt before an interview', weight: 2, tags: ['comic'],
});
P('everyday.wallet_lost', 'Wallet missing', 'everyday', 3, URBAN, {
  cause: ['dropped it getting off a bus', 'pickpocketed', 'left on a cafe table'],
  signs: ['frantic searching', 'checking pockets over and over', 'arguing with a cashier about not being able to pay'],
  fixes: ['find and return it', 'vouch for them to the cashier', 'report it'],
  ignored: 'cards cancelled, cash gone, a bad day becomes a bad week',
});
P('everyday.broken_heel', 'Heel snaps off a shoe', 'everyday', 1, URBAN, {
  cause: ['stuck in a pavement grate', 'old glue gave out'],
  signs: ['hopping on one shoe', 'a shoe heel lying on the pavement'],
  fixes: ['lend a plaster or tape', 'point to a cobbler', 'lend a jacket to carry it'],
  ignored: 'they limp home and the evening is cancelled', tags: ['comic'],
});
P('everyday.tripped_on_curb', 'Someone trips and falls', 'everyday', 2, URBAN, {
  cause: ['uneven paving', 'wet leaves', 'distracted by a phone', 'untied lace'],
  signs: ['a thud and scattered belongings', 'a grazed palm', 'nervous laughter'],
  fixes: ['help them up', 'fetch first aid', 'move the hazard'],
  ignored: 'they get up alone, shaken; the hazard trips the next person too', weight: 2,
});
P('everyday.child_lost_balloon', 'Child loses their balloon', 'everyday', 1, ['plaza', 'park', 'street'], {
  cause: ['string slipped out of a sticky hand', 'gust caught it'], cond: ['day'],
  signs: ['a small wail', 'a balloon rising and drifting over rooftops', 'a parent kneeling to comfort'],
  fixes: ['catch the string', 'buy another', 'shoot it down gently (slingshot)'],
  ignored: 'tears; the balloon lands on a roof and is found later by someone else', tags: ['comic', 'wholesome'],
});
P('everyday.ice_cream_dropped', 'Ice cream dropped', 'everyday', 1, ['plaza', 'park', 'beach', 'street'], {
  cause: ['too hot', 'a seagull strike', 'bumped by a bike'], cond: ['day'],
  signs: ['a cone on the ground, still wobbling', 'a devastated child', 'ants arriving'],
  fixes: ['buy a replacement', 'distract with a joke'], ignored: 'a long, loud cry; the pigeons win', weight: 2, tags: ['comic', 'wholesome'],
});
P('everyday.stuck_zipper', 'Zipper stuck', 'everyday', 1, ANY, {
  cause: ['fabric caught in teeth', 'cold-stiff metal'], signs: ['awkward twisting', 'asking a stranger to help with the back'],
  fixes: ['wiggle it free', 'rub with a candle or soap'], ignored: 'they go all day with a coat half-open', tags: ['comic'],
});
P('everyday.lost_glasses', 'Lost glasses', 'everyday', 2, ANY, {
  cause: ['pushed up on forehead', 'fell off on a walk', 'sat on them'],
  signs: ['squinting at menus', 'walking into a lamp post', 'feeling along the ground'],
  fixes: ['spot them (a glint on the ground)', 'lead them by the arm'], ignored: 'they cannot read the signs and take the wrong bus',
});
P('everyday.missed_bus', 'Missed the last bus', 'everyday', 2, URBAN, {
  cause: ['ran late', 'bus ran early', 'service cancelled'], cond: ['night'],
  signs: ['watching tail lights shrink', 'checking a timetable again and again', 'pacing at the stop'],
  fixes: ['share a ride', 'point to a night bus', 'lend taxi money'],
  ignored: 'a long cold walk through the wrong part of town', escalatesTo: 'crime.lone_walker_followed', after: 900,
});
P('everyday.lost_ticket', 'Ticket lost before entry', 'everyday', 2, ['plaza', 'street'], {
  cause: ['went through the wash', 'dropped in the queue'], signs: ['turning out every pocket at the gate'],
  fixes: ['show the confirmation', 'vouch for them', 'find it in the queue'], ignored: 'they are turned away at the door',
});
P('everyday.toddler_tantrum', 'Toddler meltdown', 'everyday', 1, ['plaza', 'park', 'street', 'suburb'], {
  cause: ['nap overdue', 'denied sweets', 'too loud'], signs: ['rising whine', 'a limp small body in the road', 'a frazzled parent apologizing'],
  fixes: ['offer a distraction', 'leave them to it', 'find a quiet bench'], ignored: 'passersby stare; the parent is close to tears', tags: ['comic', 'social'],
});
P('everyday.sunburn', 'Bad sunburn building', 'everyday', 2, ['beach', 'park', 'meadow', 'plaza'], {
  cause: ['no sunscreen', 'fell asleep on the sand'], cond: ['hot', 'day'],
  signs: ['pink shoulders', 'wincing when touched', 'a red nose'], fixes: ['offer shade', 'lend sunscreen', 'bring water'],
  ignored: 'blistering and a miserable night',
});
P('everyday.blisters', 'Blisters on a long walk', 'everyday', 1, WILD, {
  cause: ['new boots', 'wet socks'], signs: ['uneven gait', 'sitting to examine a heel'], fixes: ['plasters', 'dry socks', 'a short rest'],
  ignored: 'they limp for days',
});

/* ============================== HOUSEHOLD ================================ */

P('household.burst_pipe', 'Burst pipe', 'household', 4, HOME, {
  cause: ['frozen pipe cracked', 'old joint failed', 'drilled through a pipe by mistake'],
  signs: ['water seeping under a door', 'a hissing from a wall', 'a damp patch spreading on a ceiling'],
  fixes: ['shut off the mains', 'call a plumber', 'patch with a clamp'],
  ignored: 'floors and furniture ruined', escalatesTo: 'household.ceiling_collapse', after: 900, cond: ['cold'],
});
P('household.blocked_drain', 'Blocked drain overflows', 'household', 2, HOME, {
  cause: ['leaves in the gutter', 'grease', 'tree roots'], signs: ['standing water at a grate', 'gurgling sounds', 'a smell'],
  fixes: ['clear the leaves', 'plunge it', 'call the council'], ignored: 'water backs up into a basement', escalatesTo: 'household.flooded_basement', after: 1200, cond: ['rain'],
});
P('household.flooded_basement', 'Flooded basement', 'household', 4, HOME, {
  cause: ['overwhelmed drains', 'rising groundwater', 'failed sump pump'],
  signs: ['water under the cellar door', 'boxes floating', 'a dead pump humming'],
  fixes: ['pump it out', 'move valuables upstairs', 'sandbag the door'], ignored: 'mold, ruined goods, electrical hazard',
});
P('household.power_trip', 'Fuse keeps tripping', 'household', 2, HOME, {
  cause: ['overloaded socket', 'faulty kettle', 'water in a fitting'], signs: ['a click and sudden dark', 'lights dimming when an appliance starts'],
  fixes: ['unplug the culprit', 'reset the fuse box', 'call an electrician'], ignored: 'repeated outages; one day a spark', escalatesTo: 'household.electrical_fire', after: 1800,
});
P('household.electrical_fire', 'Electrical fire in the wall', 'household', 5, HOME, {
  cause: ['overheated wiring', 'rodent-chewed cable'], signs: ['a burning plastic smell', 'warm wall plate', 'smoke at a socket'],
  fixes: ['cut the power', 'use the extinguisher', 'evacuate and call the fire brigade'], ignored: 'the house burns',
});
P('household.kitchen_fire', 'Pan fire in the kitchen', 'household', 4, HOME, {
  cause: ['oil left on high heat', 'distracted by a phone call', 'tea towel too near the hob'],
  signs: ['black smoke from a window', 'a smoke alarm shrieking', 'someone coughing at the door'],
  fixes: ['smother with a lid', 'fire blanket', 'turn off the gas and get out'], ignored: 'the kitchen is gutted', escalatesTo: 'infrastructure.house_fire_spreading', after: 300,
});
P('household.gas_smell', 'Smell of gas', 'household', 5, HOME, {
  cause: ['pilot light out', 'loose connection', 'cracked hose'], signs: ['rotten-egg smell', 'a faint hiss', 'a pet acting sick'],
  fixes: ['open windows, no switches', 'shut off at the meter', 'evacuate and call the gas company'], ignored: 'explosion risk grows',
});
P('household.no_hot_water', 'No hot water', 'household', 1, HOME, {
  cause: ['boiler tripped', 'empty gas tank', 'pilot out'], signs: ['a shriek from a bathroom', 'a cold shower and shivering'],
  fixes: ['relight the pilot', 'bleed the system', 'boil kettles'], ignored: 'a grim winter week', cond: ['cold'], tags: ['comic'],
});
P('household.fridge_died', 'Fridge stops cooling', 'household', 2, HOME, {
  cause: ['compressor failed', 'unplugged by the cat', 'power cut'], signs: ['a warm hum that has gone silent', 'sour smell', 'melting freezer'],
  fixes: ['move food to a neighbor', 'buy ice', 'repair or replace'], ignored: 'a week of food spoils',
});
P('household.roof_leak', 'Roof leaks', 'household', 3, HOME, {
  cause: ['slipped tile', 'blocked gutter', 'old flashing'], cond: ['rain'],
  signs: ['a bucket catching drips', 'brown ceiling stain', 'a plip-plip in the attic'],
  fixes: ['patch with a tarp', 'clear the gutter', 'call a roofer'], ignored: 'insulation soaked; ceiling sags', escalatesTo: 'household.ceiling_collapse', after: 1800,
});
P('household.ceiling_collapse', 'Ceiling collapses', 'household', 5, HOME, {
  cause: ['water-logged plaster', 'rotten joists'], signs: ['a bulge in the ceiling', 'creaking above', 'plaster dust falling'],
  fixes: ['evacuate the room', 'prop it', 'call emergency repair'], ignored: 'injury and ruin',
});
P('household.window_smashed', 'Window smashed', 'household', 2, HOME, {
  cause: ['stray football', 'break-in attempt', 'hail', 'branch in a gale'], signs: ['a crash and then silence', 'children scattering', 'glass on the floor'],
  fixes: ['board it up', 'sweep carefully', 'replace the pane'], ignored: 'rain and burglars both get in',
});
P('household.wasp_nest', 'Wasp nest in the wall', 'household', 3, HOME, {
  cause: ['gap under the eaves', 'old shed'], cond: ['summer'], signs: ['a steady stream of wasps at one corner', 'a papery rustle'],
  fixes: ['call pest control', 'treat at dusk', 'seal after clearing'], ignored: 'a stung child, a nest the size of a football',
});
P('household.mice_in_pantry', 'Mice in the pantry', 'household', 2, HOME, {
  cause: ['hole by the pipes', 'open cereal box'], cond: ['cold'], signs: ['droppings', 'chewed packets', 'scratching in the walls'],
  fixes: ['traps', 'seal the hole', 'get a cat'], ignored: 'wires chewed; cleanliness lost', escalatesTo: 'household.power_trip', after: 3600,
});
P('household.stuck_door', 'Door swells and sticks', 'household', 1, HOME, {
  cause: ['damp wood', 'warped frame'], cond: ['wet'], signs: ['someone shoulder-barging a door', 'a shrieking hinge'],
  fixes: ['plane the edge', 'oil the hinges', 'kick it'], ignored: 'trapped in a room',
});
P('household.stuck_lift', 'Lift stuck between floors', 'household', 3, ['street', 'plaza', 'industrial'], {
  cause: ['power dip', 'door sensor failure'], signs: ['muffled knocking', 'a voice calling from the shaft', 'a stalled indicator'],
  fixes: ['call maintenance', 'reset the breaker', 'talk them through it'], ignored: 'panic and heat build',
});
P('household.overflowing_bath', 'Bath left running', 'household', 3, HOME, {
  cause: ['phone call', 'dozed off', 'child turned the tap'], signs: ['water dripping through the ceiling below', 'a trickle down the stairs'],
  fixes: ['turn off the tap', 'mop up', 'check the neighbour below'], ignored: 'the flat below floods', escalatesTo: 'household.ceiling_collapse', after: 1500,
});
P('household.fallen_fence', 'Fence blown down', 'household', 2, HOME, {
  cause: ['rotten posts', 'gale'], cond: ['wind'], signs: ['a dog running loose', 'panels in a neighbor garden'],
  fixes: ['prop the panels', 'retrieve the dog', 'rebuild'], ignored: 'the dog escapes; a dispute with the neighbors starts', escalatesTo: 'social.neighbor_feud', after: 3600,
});
P('household.tree_on_roof', 'Tree limb on the roof', 'household', 4, HOME, {
  cause: ['storm', 'rotten branch'], cond: ['storm'], signs: ['a crash in the night', 'a hole of sky above a bedroom'],
  fixes: ['tarp the hole', 'cut the limb', 'insurance claim'], ignored: 'rain pours in', escalatesTo: 'household.roof_leak', after: 600,
});
P('household.smoke_alarm_chirp', 'Smoke alarm chirps at 3am', 'household', 1, HOME, {
  cause: ['dying battery'], cond: ['night'], signs: ['a single chirp every minute', 'someone on a chair at midnight'],
  fixes: ['swap the battery', 'pull it out and curse'], ignored: 'no sleep, and it goes off for real when no one trusts it', tags: ['comic'],
});

/* ============================= STREET & TRAFFIC =========================== */

P('street.pothole', 'Pothole damages a wheel', 'street', 2, ['street', 'suburb', 'industrial'], {
  cause: ['frost heave', 'heavy lorries', 'neglected road'], cond: ['wet'],
  signs: ['a loud bang', 'a car limping to the kerb', 'water-filled hole in the lane'],
  fixes: ['mark it with cones', 'help change the tyre', 'report it'], ignored: 'more cars, more flats, then a cyclist falls', escalatesTo: 'street.cyclist_crash', after: 1800,
});
P('traffic.flat_tire', 'Flat tyre', 'traffic', 2, ['street', 'suburb', 'industrial', 'farm'], {
  cause: ['nail in the tread', 'pothole', 'worn rubber'], signs: ['thumping rhythm', 'car sagging to one side', 'someone kicking a tyre'],
  fixes: ['help change it', 'lend a pump', 'call roadside assistance'], ignored: 'stuck for hours; a hazard in the lane', weight: 2,
});
P('traffic.wont_start', 'Car will not start', 'traffic', 2, ['street', 'suburb', 'industrial', 'farm'], {
  cause: ['dead battery', 'flooded engine', 'frozen fuel line'], signs: ['a click-click-click', 'hood up and a puzzled face', 'someone pushing a car'],
  fixes: ['jump-start it', 'help push', 'tow'], ignored: 'blocked road; late for work', cond: ['cold'], weight: 2,
});
P('traffic.fender_bender', 'Minor collision', 'traffic', 3, ['street', 'suburb', 'industrial'], {
  cause: ['wet braking distance', 'phone distraction', 'sun glare'], signs: ['a crunch and a horn', 'two drivers inspecting bumpers', 'broken light plastic on the road'],
  fixes: ['mediate', 'be a witness', 'move cars clear', 'call the police'], ignored: 'a blocked junction and an argument that grows', escalatesTo: 'social.road_rage', after: 300,
});
P('traffic.broken_signal', 'Traffic lights dead', 'traffic', 3, ['street', 'suburb', 'industrial'], {
  cause: ['power cut', 'storm damage', 'cable theft'], signs: ['a dark signal and honking', 'drivers inching forward', 'a near miss'],
  fixes: ['direct traffic', 'call the council', 'wait for repair'], ignored: 'a serious crash', escalatesTo: 'traffic.fender_bender', after: 900,
});
P('traffic.blocked_driveway', 'Driveway blocked', 'traffic', 1, ['suburb', 'street'], {
  cause: ['delivery van', 'visitor parked carelessly'], signs: ['a neighbor tapping on a window', 'a car idling behind a van'],
  fixes: ['move the vehicle', 'find the owner'], ignored: 'a note under the wiper, and then a worse one', escalatesTo: 'social.neighbor_feud', after: 7200, weight: 1.5,
});
P('traffic.stuck_in_mud', 'Vehicle stuck in mud', 'traffic', 2, ['farm', 'forest', 'meadow'], {
  cause: ['soft verge after rain', 'overloaded trailer'], cond: ['wet'], signs: ['spinning wheels', 'a tractor being fetched', 'mud flung up the sides'],
  fixes: ['tow', 'lay branches under the tyres', 'push'], ignored: 'stuck until the ground dries',
});
P('traffic.bus_broke_down', 'Bus breaks down', 'traffic', 2, ['street', 'suburb'], {
  cause: ['overheating', 'gearbox', 'flat'], signs: ['smoke from the back', 'passengers standing at the roadside', 'a driver on the radio'],
  fixes: ['help find alternatives', 'offer a lift', 'wait for a replacement'], ignored: 'late arrivals and angry commuters',
});
P('street.cyclist_crash', 'Cyclist crashes', 'street', 3, ['street', 'suburb', 'park'], {
  cause: ['pothole', 'wet leaves', 'car door opened', 'oil patch'], signs: ['a bike wheel still spinning', 'a rider sitting up dazed', 'scattered bottle and helmet'],
  fixes: ['first aid', 'call an ambulance', 'clear the road'], ignored: 'worsening injury', weight: 1.2,
});
P('street.open_manhole', 'Manhole cover missing', 'street', 4, URBAN, {
  cause: ['stolen for scrap', 'flood lifted it', 'workers forgot'], signs: ['a dark hole in the road', 'a cone placed by a considerate stranger', 'a near miss'],
  fixes: ['cone it off', 'report', 'cover with a board'], ignored: 'somebody falls in', cond: ['night'],
});
P('street.sinkhole', 'Pavement sinkhole opens', 'street', 4, URBAN, {
  cause: ['burst water main', 'old culvert collapse'], signs: ['a dip in the pavement', 'cracks in the asphalt', 'water seeping'],
  fixes: ['cordon off', 'call utilities', 'evacuate nearby shops'], ignored: 'a car or a person falls in', escalatesTo: 'infrastructure.water_main_burst', after: 1800,
});
P('street.shopping_trolley', 'Runaway shopping trolley', 'street', 1, ['street', 'plaza', 'suburb'], {
  cause: ['gust and a slope', 'kids prank'], cond: ['wind'], signs: ['rattling wheels', 'a trolley picking up speed down a hill'],
  fixes: ['stop it', 'step aside'], ignored: 'it dings a parked car', tags: ['comic'],
});
P('street.market_stall_collapse', 'Market stall collapses', 'street', 2, ['plaza', 'street'], {
  cause: ['gust under the awning', 'overloaded shelves', 'weakened poles'], cond: ['wind'], signs: ['canvas billowing like a sail', 'a stall shuddering', 'a shout from the vendor'],
  fixes: ['hold the pole', 'rescue the produce', 'lower the awning'], ignored: 'produce crushed; an angry crowd', weight: 1.2,
});
P('street.scaffold_collapse', 'Scaffolding sheds a plank', 'street', 4, ['street', 'plaza', 'industrial'], {
  cause: ['wind', 'bad lashing', 'rot'], cond: ['wind'], signs: ['rattling poles', 'a plank sliding', 'a warning shout'],
  fixes: ['clear the pavement', 'secure the plank', 'inform the foreman'], ignored: 'someone is hit', escalatesTo: 'health.head_injury', after: 120,
});
P('street.graffiti_dispute', 'Fresh graffiti triggers a row', 'street', 1, ['alley', 'street', 'industrial'], {
  cause: ['rival crew', 'insulting message on a shop wall'], signs: ['wet paint smell', 'a shopkeeper with a bucket and scowl'],
  fixes: ['help clean it', 'identify the culprit'], ignored: 'retaliation spirals', escalatesTo: 'crime.vandalism_spree', after: 3600, tags: ['social'],
});
P('street.hydrant_open', 'Hydrant opened by teenagers', 'street', 2, ['street', 'suburb'], {
  cause: ['summer heat prank'], cond: ['hot'], signs: ['a geyser across the road', 'kids shrieking in the spray'],
  fixes: ['shut it off', 'scold the kids', 'call the utility'], ignored: 'low water pressure across the district', tags: ['comic', 'social'],
});
P('street.puddle_splash', 'Car drenches a pedestrian', 'street', 1, ['street', 'suburb'], {
  cause: ['speeding through a gutter puddle'], cond: ['rain'], signs: ['a wave of brown water', 'a pedestrian frozen with arms out'],
  fixes: ['offer a towel', 'hold the door of a cafe'], ignored: 'a day ruined', weight: 2, tags: ['comic'],
});

/* ================================== HEALTH ================================ */

P('health.heat_exhaustion', 'Heat exhaustion', 'health', 3, ANY, {
  cause: ['working outdoors', 'no water', 'long queue in the sun'], cond: ['hot', 'day'],
  signs: ['flushed, unsteady', 'stopping repeatedly to lean on walls', 'heavy sweat and a dazed look'],
  fixes: ['shade and water', 'cool cloth', 'call medical help'], ignored: 'collapse', escalatesTo: 'health.collapsed_stranger', after: 900,
});
P('health.hypothermia_mild', 'Cold exposure', 'health', 3, ANY, {
  cause: ['locked out in the cold', 'wet clothes', 'stranded after a breakdown'], cond: ['cold'],
  signs: ['shivering and fumbling', 'slurred words', 'blue lips'], fixes: ['warm drink and shelter', 'dry clothes', 'call help'],
  ignored: 'confusion and collapse', escalatesTo: 'health.collapsed_stranger', after: 1500,
});
P('health.collapsed_stranger', 'Stranger collapses', 'health', 4, URBAN, {
  cause: ['heart trouble', 'low blood sugar', 'heat', 'seizure'], signs: ['a crowd forming', 'someone shouting for a doctor', 'a still body on the ground'],
  fixes: ['call an ambulance', 'first aid and recovery position', 'find a doctor in the crowd'], ignored: 'bystanders stand uncertain and time slips away',
});
P('health.choking', 'Someone chokes', 'health', 5, ['plaza', 'street', 'interior'], {
  cause: ['eating too fast', 'laughing with food', 'a toy swallowed'], signs: ['hands at the throat', 'a silent panicked face', 'a chair knocked back'],
  fixes: ['back blows and abdominal thrusts', 'call an ambulance'], ignored: 'death within minutes',
});
P('health.asthma_attack', 'Asthma attack', 'health', 4, ANY, {
  cause: ['pollen', 'smoke', 'cold air', 'sprinting for a bus'], signs: ['wheezing', 'leaning forward with hands on knees', 'frantic searching of a bag'],
  fixes: ['find their inhaler', 'sit them upright', 'call an ambulance'], ignored: 'escalates quickly',
});
P('health.allergic_reaction', 'Allergic reaction (sting or food)', 'health', 4, ANY, {
  cause: ['bee sting', 'peanut in a pastry', 'new medicine'], signs: ['rapidly swelling lip', 'hives', 'a hoarse voice'],
  fixes: ['injector pen', 'antihistamine', 'ambulance'], ignored: 'airway closing', cond: [],
});
P('health.diabetic_low', 'Blood sugar crash', 'health', 3, ANY, {
  cause: ['skipped lunch', 'too much insulin'], signs: ['sweating, shaky, irritable', 'confused speech', 'fumbling with a meter'],
  fixes: ['sweet drink or glucose', 'sit them down', 'call help'], ignored: 'seizure or unconsciousness',
});
P('health.panic_attack', 'Panic attack', 'health', 2, URBAN, {
  cause: ['crowd', 'noise', 'bad news', 'enclosed space'], signs: ['fast breathing', 'gripping a rail', 'wide eyes'],
  fixes: ['speak calmly, slow the breath', 'lead them out of the crowd'], ignored: 'they flee into traffic or collapse', cond: ['crowd'],
});
P('health.broken_ankle_ice', 'Broken ankle on ice', 'health', 3, URBAN, {
  cause: ['black ice', 'icy steps'], cond: ['freezing'], signs: ['a cry and a fall', 'foot at the wrong angle', 'ice glinting'],
  fixes: ['keep them still', 'splint', 'call an ambulance', 'salt the path'], ignored: 'worse injury and another fall by someone else',
});
P('health.head_injury', 'Head injury', 'health', 4, ANY, {
  cause: ['fall', 'falling object', 'fight'], signs: ['blood in the hair', 'confusion', 'vomiting'], fixes: ['keep awake', 'call an ambulance', 'do not move'],
  ignored: 'drowsiness and worse',
});
P('health.food_poisoning', 'Food poisoning outbreak', 'health', 3, ['plaza', 'street', 'suburb'], {
  cause: ['undercooked meat at a stall', 'warm potato salad at a wedding'], cond: ['hot'],
  signs: ['pale people clutching stomachs', 'a queue at the one bathroom', 'a closed food stall'],
  fixes: ['shut the stall', 'water and rest', 'doctor'], ignored: 'dozens ill and a ruined reputation', escalatesTo: 'economic.business_shut', after: 7200,
});
P('health.early_labor', 'Early labor', 'health', 4, URBAN, {
  cause: ['stress', 'a long walk'], signs: ['a woman bent over, counting', 'a husband panicking', 'a taxi that will not stop'],
  fixes: ['call an ambulance', 'give a lift', 'find a midwife'], ignored: 'birth in the street',
});
P('health.fainting_crowd', 'Faints in a crowd', 'health', 2, ['plaza', 'street'], {
  cause: ['heat', 'standing too long', 'skipped breakfast'], cond: ['crowd'], signs: ['a stagger', 'grey face', 'a cleared space'], fixes: ['lay down legs up', 'water', 'fresh air'], ignored: 'trampled or injured when they drop',
});

/* ======================= WEATHER & NATURAL EVENTS ======================== */

P('weather.fallen_tree', 'Tree blocks the road', 'weather', 3, ['street', 'suburb', 'forest', 'farm'], {
  cause: ['gale', 'saturated roots', 'rotten trunk'], cond: ['wind'],
  signs: ['a leaning trunk', 'cracking sounds', 'a line of stopped cars'], fixes: ['cut it with a saw', 'tow it', 'detour traffic'], ignored: 'a road cut off', escalatesTo: 'infrastructure.power_line_down', after: 600,
});
P('weather.flash_flood', 'Flash flood', 'weather', 5, ['street', 'suburb', 'meadow', 'farm', 'forest'], {
  cause: ['heavy rainfall upstream', 'blocked culvert', 'burst river bank'], cond: ['rain'],
  signs: ['brown water rushing over the road', 'debris carried by the stream', 'a warning siren'],
  fixes: ['move to high ground', 'rescue stuck motorists', 'sandbag'], ignored: 'vehicles swept off the road',
});
P('weather.lightning_strike', 'Lightning strikes', 'weather', 4, ['park', 'meadow', 'farm', 'forest', 'beach'], {
  cause: ['open ground', 'standing under a lone tree'], cond: ['storm'], signs: ['hair standing up', 'a metallic smell', 'a flash and instant thunder'],
  fixes: ['take cover in a building or car', 'crouch low', 'help a victim'], ignored: 'a burn victim or a burning tree', escalatesTo: 'nature.wildfire_spark', after: 120,
});
P('weather.black_ice', 'Black ice', 'weather', 3, ['street', 'suburb'], {
  cause: ['freezing fog after a thaw', 'clear cold night'], cond: ['freezing'],
  signs: ['a sheen on the tarmac', 'cars sliding sideways', 'someone grabbing a lamp post'], fixes: ['salt or grit it', 'warn drivers', 'close the road'],
  ignored: 'pile-ups', escalatesTo: 'traffic.fender_bender', after: 300,
});
P('weather.dense_fog', 'Dense fog', 'weather', 2, ANY, {
  cause: ['cold night and river valley'], cond: ['fog'], signs: ['dim headlights', 'muffled horns', 'people appearing suddenly'],
  fixes: ['slow down', 'guide with a torch', 'wait it out'], ignored: 'collisions and lost hikers', escalatesTo: 'nature.lost_hiker', after: 1800,
});
P('weather.heatwave', 'Heatwave', 'weather', 3, ANY, {
  cause: ['stalled high pressure'], cond: ['hot', 'summer'], signs: ['shimmering roads', 'wilting plants', 'empty streets at noon'], fixes: ['open cooling centres', 'water stations', 'shade'], ignored: 'elderly and animals suffer', escalatesTo: 'health.heat_exhaustion', after: 900,
});
P('weather.hail_damage', 'Hailstorm damage', 'weather', 3, ANY, {
  cause: ['convective storm'], cond: ['storm'], signs: ['white pellets bouncing', 'a roar on the roofs', 'dented car bonnets'], fixes: ['shelter', 'tarp the roof', 'salvage crops'], ignored: 'crop loss and broken glass',
});
P('weather.snowed_in', 'Road snowed in', 'weather', 3, ['farm', 'suburb', 'forest', 'meadow'], {
  cause: ['overnight blizzard'], cond: ['winter', 'cold'], signs: ['a wall of white across the road', 'a stuck bus', 'tracks fading to nothing'], fixes: ['dig out', 'snowplow', 'deliver food on foot'], ignored: 'isolated farms run out of food',
});
P('weather.frozen_pipes', 'Frozen water supply', 'weather', 3, HOME, {
  cause: ['cold snap', 'unheated outbuilding'], cond: ['freezing'], signs: ['taps spitting then dry', 'a frost-white pipe'], fixes: ['wrap and warm gently', 'use a hairdryer', 'call a plumber'], ignored: 'the pipe bursts', escalatesTo: 'household.burst_pipe', after: 3600,
});
P('weather.storm_surge_beach', 'Waves sweep the promenade', 'weather', 4, ['beach'], {
  cause: ['onshore gale at high tide'], cond: ['storm'], signs: ['spray over the wall', 'foam in the road', 'drowning bins'], fixes: ['close the promenade', 'evacuate nearby', 'sandbags'], ignored: 'people swept off their feet',
});

/* ============================ NATURE & ANIMALS =========================== */

P('nature.lost_hiker', 'Lost hiker', 'nature', 4, ['forest', 'meadow'], {
  cause: ['trail markers missing', 'fog', 'dusk fell faster than expected', 'phone flat'], signs: ['a distant whistle', 'a dropped glove on the trail', 'torchlight wandering'],
  fixes: ['guide them back', 'organise a search', 'give them a torch'], ignored: 'night exposure', escalatesTo: 'health.hypothermia_mild', after: 3600,
});
P('nature.wildfire_spark', 'Brush fire starts', 'nature', 5, ['forest', 'meadow', 'farm', 'park'], {
  cause: ['lightning', 'a discarded cigarette', 'hot exhaust on dry grass', 'unattended campfire'], cond: ['dry'],
  signs: ['a thin plume of smoke', 'crackling grass', 'birds fleeing', 'an orange glow'], fixes: ['stamp it out when small', 'fire beater', 'call the fire service', 'create a firebreak'],
  ignored: 'it races downwind', escalatesTo: 'nature.wildfire_spreading', after: 300,
});
P('nature.wildfire_spreading', 'Wildfire spreads', 'nature', 5, ['forest', 'meadow', 'farm'], {
  cause: ['wind-driven flames'], cond: ['dry', 'wind'], signs: ['smoke wall', 'embers raining', 'animals running'], fixes: ['evacuate', 'backburn', 'water bombers'], ignored: 'homes lost',
});
P('nature.landslide', 'Landslide across the track', 'nature', 4, ['forest', 'farm', 'meadow'], {
  cause: ['saturated slope', 'deforestation'], cond: ['rain', 'wet'], signs: ['small stones rattling down', 'tilting trees', 'a groan underfoot'], fixes: ['evacuate', 'divert traffic', 'clear with diggers'], ignored: 'buried road',
});
P('nature.river_rising', 'River rising over its bank', 'nature', 4, ['meadow', 'farm', 'forest', 'park'], {
  cause: ['upstream storm', 'snowmelt'], cond: ['rain'], signs: ['brown fast water', 'debris', 'a gauge post disappearing'], fixes: ['sandbag', 'move livestock', 'warn downstream'], ignored: 'flooded fields', escalatesTo: 'weather.flash_flood', after: 1800,
});
P('nature.bog_stuck', 'Stuck in a bog', 'nature', 3, ['meadow', 'forest', 'farm'], {
  cause: ['shortcut across wet ground', 'following a stray sheep'], cond: ['wet'], signs: ['calls for help', 'one boot missing', 'a person sunk to the knees'], fixes: ['throw a rope', 'lay a plank', 'pull gently'], ignored: 'exhaustion and cold',
});
P('nature.riptide', 'Swimmer caught in a rip current', 'nature', 5, ['beach'], {
  cause: ['unguarded beach', 'offshore wind', 'tired swimmer'], cond: ['day'], signs: ['a head getting smaller offshore', 'arms waving', 'lifeguard flag raised'], fixes: ['lifebuoy', 'call lifeguards', 'swim parallel to shore'], ignored: 'drowning',
});
P('nature.jellyfish_sting', 'Jellyfish stings', 'nature', 2, ['beach'], {
  cause: ['bloom after warm weather'], cond: ['hot', 'summer'], signs: ['a yelp and a red welt', 'clear blobs on the sand'], fixes: ['rinse with seawater', 'vinegar', 'first aid'], ignored: 'a nasty welt and a ruined swim',
});
P('nature.thin_ice', 'Ice cracks on the pond', 'nature', 5, ['park', 'meadow', 'forest'], {
  cause: ['kids test the ice', 'dog runs after a stick'], cond: ['freezing'], signs: ['creaking', 'cracks radiating', 'a dog yelping'], fixes: ['throw a rope or ladder', 'spread weight', 'call rescue'], ignored: 'drowning',
});
P('nature.snake_in_path', 'Snake in the path', 'nature', 2, ['meadow', 'forest', 'park', 'beach'], {
  cause: ['basking on a warm trail'], cond: ['hot', 'day'], signs: ['a dog freezing', 'a rattle or hiss', 'a long shape on warm stones'], fixes: ['step back slowly', 'detour', 'call wildlife control'], ignored: 'a bite',
});
P('nature.hornet_swarm', 'Hornet swarm', 'nature', 3, ['forest', 'park', 'farm'], {
  cause: ['disturbed nest', 'a dropped sugary drink'], cond: ['summer'], signs: ['a low drone', 'people flapping their arms and running'], fixes: ['retreat steadily', 'call pest control'], ignored: 'multiple stings',
});
P('nature.rockfall', 'Rockfall on a coast path', 'nature', 4, ['beach', 'forest'], {
  cause: ['frost wedging', 'heavy rain', 'tide undercut'], cond: ['wet'], signs: ['pebbles rattling', 'a crack', 'dust above the cliff'], fixes: ['close the path', 'warn walkers'], ignored: 'someone is hit',
});
P('animal.cat_in_tree', 'Cat stuck up a tree', 'animal', 1, ['park', 'suburb', 'street'], {
  cause: ['chased by a dog', 'too curious'], signs: ['a thin yowl overhead', 'a child crying below'], fixes: ['coax with food', 'ladder', 'call the fire service'], ignored: 'it comes down at 2am as if nothing happened', tags: ['comic', 'wholesome'],
});
P('animal.dog_loose', 'Dog loose in traffic', 'animal', 3, ['street', 'suburb'], {
  cause: ['snapped lead', 'gate left open', 'frightened by fireworks'], signs: ['a leash trailing', 'a panicked owner calling', 'screech of brakes'], fixes: ['calm it down with food', 'block the road', 'catch it'], ignored: 'hit by a car', escalatesTo: 'traffic.fender_bender', after: 300,
});
P('animal.dog_in_hot_car', 'Dog locked in a hot car', 'animal', 4, ['street', 'plaza', 'suburb'], {
  cause: ['owner stopped for "just a minute"'], cond: ['hot', 'day'], signs: ['panting at the window', 'fogged glass', 'a limp dog'], fixes: ['find the owner', 'call authorities', 'break the window'], ignored: 'heatstroke',
});
P('animal.bird_in_chimney', 'Bird trapped in a chimney', 'animal', 1, HOME, {
  cause: ['no cap on the flue'], signs: ['frantic fluttering behind the grate', 'soot on the hearth'], fixes: ['open the flap and darken the room', 'carefully remove it'], ignored: 'dead bird and a smell',
});
P('animal.deer_collision', 'Deer on the road', 'animal', 3, ['forest', 'farm', 'meadow'], {
  cause: ['rutting season', 'dusk', 'startled by headlights'], cond: ['night'], signs: ['eyes shining at the verge', 'a warning sign', 'a car with a crumpled bonnet'], fixes: ['slow down', 'help the driver', 'call wildlife rescue'], ignored: 'an injured animal suffers and the car is wrecked',
});
P('animal.livestock_loose', 'Livestock loose on the road', 'animal', 3, ['farm', 'meadow'], {
  cause: ['broken fence', 'gate left open'], signs: ['a cow in the road', 'a distant farmer waving his hat'], fixes: ['herd gently', 'block both ends', 'repair the fence'], ignored: 'a crash and escaped herd', tags: ['comic'],
});
P('animal.sheep_cast', 'Sheep stuck on its back', 'animal', 3, ['farm', 'meadow'], {
  cause: ['heavy fleece', 'sloping ground'], cond: ['wet'], signs: ['legs waving above the grass', 'a lone sheep that will not stand'], fixes: ['roll it upright', 'support it until steady'], ignored: 'death within hours', tags: ['wholesome'],
});
P('animal.fox_henhouse', 'Fox in the henhouse', 'animal', 3, ['farm', 'suburb'], {
  cause: ['latch left undone', 'a gap under the wire'], cond: ['night'], signs: ['squawking', 'feathers drifting', 'a shadow slipping into a hedge'], fixes: ['make noise', 'close the coop', 'fox-proof it'], ignored: 'the flock is gone',
});
P('animal.dog_in_drain', 'Dog trapped down a drain', 'animal', 2, ['street', 'suburb', 'park'], {
  cause: ['chasing a ball', 'curious about a smell'], signs: ['whimpering from a grate', 'a leash disappearing below'], fixes: ['lift the grate', 'call the fire service', 'coax with food'], ignored: 'exhaustion and injury',
});
P('animal.rat_infestation', 'Rats multiply behind restaurants', 'animal', 3, ['alley', 'industrial', 'street'], {
  cause: ['uncollected rubbish', 'a broken sewer'], signs: ['scratching in the bins', 'droppings', 'dead rat by a doorway'], fixes: ['clean up', 'poison responsibly', 'fix the sewer'], ignored: 'health inspection and closure', escalatesTo: 'economic.business_shut', after: 14400,
});
P('animal.bee_swarm', 'Bee swarm settles on a car', 'animal', 2, ['street', 'park', 'suburb'], {
  cause: ['hive split in spring'], cond: ['spring', 'day'], signs: ['a humming cluster on a roof', 'a curious crowd'], fixes: ['call a beekeeper', 'leave them be', 'smoke gently'], ignored: 'stings and panic',
});

/* ===================== INFRASTRUCTURE & UTILITIES ======================== */

P('infrastructure.blackout', 'Neighbourhood blackout', 'infrastructure', 3, URBAN, {
  cause: ['substation fault', 'storm damage', 'overloaded grid in a heatwave'], signs: ['lights flickering then dead', 'silent fridges', 'a street of candles'],
  fixes: ['wait for repair', 'check on elderly neighbours', 'fire up a generator'], ignored: 'food spoils, traffic gridlocks, crime rises', escalatesTo: 'crime.opportunistic_looting', after: 7200,
});
P('infrastructure.power_line_down', 'Power line down', 'infrastructure', 5, URBAN, {
  cause: ['tree fall', 'ice load', 'vehicle impact'], signs: ['sparks on wet road', 'a buzzing wire in the gutter', 'a dead-looking tree against a pole'],
  fixes: ['keep everyone back', 'call the utility', 'do not touch the wire'], ignored: 'electrocution risk and fire',
});
P('infrastructure.water_main_burst', 'Water main bursts', 'infrastructure', 4, URBAN, {
  cause: ['old iron pipe', 'frost', 'roadworks'], signs: ['a river down the street', 'dry taps in houses', 'a rising puddle'], fixes: ['shut off the valve', 'bring bottled water', 'reroute traffic'], ignored: 'houses with no water for days',
});
P('infrastructure.gas_main_leak', 'Gas main leak in the street', 'infrastructure', 5, URBAN, {
  cause: ['digger hit the pipe', 'corroded joint'], signs: ['hissing from the ground', 'dead grass in a line', 'a strong smell'], fixes: ['evacuate', 'no ignition sources', 'call gas emergency'], ignored: 'explosion',
});
P('infrastructure.internet_down', 'Internet outage', 'infrastructure', 1, URBAN, {
  cause: ['cable cut by digger', 'ISP fault'], signs: ['a cafe full of people staring at dead laptops', 'an irritated shopkeeper unable to take cards'], fixes: ['wait', 'tether via phone', 'pay cash'], ignored: 'shops lose a day', weight: 1.5, tags: ['comic'],
});
P('infrastructure.sewer_backup', 'Sewer backup', 'infrastructure', 3, URBAN, {
  cause: ['grease blockage', 'storm overload'], cond: ['rain'], signs: ['a smell rising from drains', 'brown water at a grate'], fixes: ['clear the blockage', 'close the road', 'call the utility'], ignored: 'basements flood with sewage',
});
P('infrastructure.bridge_closed', 'Bridge closed for safety', 'infrastructure', 3, ['street', 'farm', 'suburb'], {
  cause: ['cracks found', 'flood scour'], signs: ['barriers', 'a long diversion', 'engineers with clipboards'], fixes: ['use the detour', 'ferry people across', 'temporary footbridge'], ignored: 'a village cut off',
});
P('infrastructure.house_fire_spreading', 'House fire spreading to neighbours', 'infrastructure', 5, HOME, {
  cause: ['strong wind', 'close eaves'], cond: ['wind'], signs: ['flames at a window', 'a roof glowing', 'neighbours hosing walls'], fixes: ['evacuate row', 'fire brigade', 'hose down the next roofs'], ignored: 'a whole terrace burns',
});
P('infrastructure.train_delayed', 'Trains delayed all day', 'travel', 2, ['street', 'plaza', 'industrial'], {
  cause: ['signal failure', 'leaves on the line', 'trespasser'], cond: [], signs: ['a packed platform', 'an announcer apologising again', 'taxi queue'], fixes: ['share a taxi', 'walk', 'wait'], ignored: 'missed meetings, stranded travellers', escalatesTo: 'travel.stranded_travellers', after: 7200,
});
P('travel.stranded_travellers', 'Stranded travellers', 'travel', 3, ['street', 'plaza', 'industrial'], {
  cause: ['cancelled service', 'closed road', 'storm'], cond: ['night'], signs: ['suitcases lined along a wall', 'sleeping on benches', 'children crying'], fixes: ['offer a spare room', 'organise transport', 'hot drinks'], ignored: 'cold night in the open',
});
P('travel.lost_luggage', 'Luggage goes missing', 'travel', 2, ['street', 'plaza'], {
  cause: ['mislabelled', 'wrong carousel', 'stolen'], signs: ['an empty carousel', 'a clerk typing endlessly'], fixes: ['search the lost property', 'describe it to the staff'], ignored: 'a holiday without clothes', tags: ['comic'],
});
P('travel.wrong_train', 'Boarded the wrong train', 'travel', 1, ['plaza', 'street'], {
  cause: ['same platform, different line', 'poor announcement'], signs: ['looking around nervously at each stop', 'asking a stranger for the next station'], fixes: ['correct them', 'direct them back'], ignored: 'an expensive extra fare', tags: ['comic'],
});

/* ========================= ECONOMIC & WORK ================================ */

P('economic.rent_overdue', 'Rent overdue', 'economic', 3, HOME, {
  cause: ['lost hours at work', 'medical bill', 'a lost wallet'], signs: ['a notice on a door', 'a worried tenant counting coins', 'landlord knocking'], fixes: ['lend money', 'find them work', 'help negotiate'], ignored: 'eviction', escalatesTo: 'economic.eviction_notice', after: 10800,
});
P('economic.eviction_notice', 'Eviction', 'economic', 4, HOME, {
  cause: ['unpaid rent', 'property sold', 'a landlord feud'], signs: ['furniture on the pavement', 'a family sitting among boxes'], fixes: ['find temporary shelter', 'raise funds', 'challenge the notice'], ignored: 'homelessness',
});
P('economic.job_lost', 'Laid off without warning', 'economic', 3, URBAN, {
  cause: ['factory closing', 'a boss with a grudge', 'restructure'], signs: ['a person carrying a box of desk items', 'sitting on a kerb after a shift'], fixes: ['offer a lead on work', 'listen', 'pool money'], ignored: 'despair and debt',
});
P('economic.business_shut', 'Shop forced to close', 'economic', 3, URBAN, {
  cause: ['failed inspection', 'a road closed for months', 'a rent hike'], signs: ['paper over the windows', 'a "closing down" sign', 'a shopkeeper loading boxes'], fixes: ['buy their stock', 'campaign for them', 'find a new space'], ignored: 'the street feels emptier',
});
P('economic.price_spike', 'Food prices spike', 'economic', 3, URBAN, {
  cause: ['crop failure', 'strike at the depot', 'panic buying'], signs: ['queues at the baker', 'empty shelves', 'people comparing prices on slips'], fixes: ['barter', 'grow your own', 'organise bulk buying'], ignored: 'hunger among the poor',
});
P('economic.atm_broken', 'ATM swallows a card', 'economic', 2, ['street', 'plaza'], {
  cause: ['skimmer', 'machine fault'], signs: ['a person banging a machine', 'a "sorry" screen'], fixes: ['call the bank', 'lend cash'], ignored: 'no cash for the weekend', tags: ['comic'],
});
P('economic.debt_collector', 'Debt collector at the door', 'economic', 3, HOME, {
  cause: ['a loan gone bad', 'a family member borrowed'], signs: ['hushed voices at a door', 'a car idling for hours', 'curtains drawn all day'], fixes: ['pay or negotiate', 'intervene', 'call the authorities'], ignored: 'intimidation grows', escalatesTo: 'crime.shakedown', after: 7200,
});
P('work.workplace_accident', 'Accident on the job', 'work', 4, ['industrial', 'farm', 'street'], {
  cause: ['missing guard on a machine', 'rushed shift', 'wet floor', 'unsecured load'], signs: ['machines stopping', 'a shout', 'a pale colleague holding a hand'], fixes: ['first aid', 'stop the line', 'call an ambulance'], ignored: 'worse injury and a lawsuit',
});
P('work.strike', 'Workers walk out', 'work', 3, ['industrial', 'street'], {
  cause: ['unpaid wages', 'unsafe conditions'], signs: ['picket line', 'idle machinery', 'tense foremen'], fixes: ['mediate', 'raise pay', 'bring in replacements (angrily)'], ignored: 'shortages and a clash on the picket line', escalatesTo: 'social.brawl', after: 14400,
});
P('work.delivery_late', 'Delivery truck stuck', 'work', 2, ['industrial', 'street', 'alley'], {
  cause: ['too tall for the bridge', 'narrow alley', 'broken tail-lift'], signs: ['a stuck lorry and a long honking queue', 'a driver in a sweat'], fixes: ['guide it out', 'unload by hand', 'tow'], ignored: 'a street blocked for hours', weight: 1.2,
});
P('work.farm_machine_breakdown', 'Harvest machine breaks down', 'work', 3, ['farm'], {
  cause: ['worn bearing', 'stone in the cutter', 'no spare part'], cond: ['dry', 'day'], signs: ['a stalled combine mid-field', 'farmers peering inside', 'thunderheads on the horizon'], fixes: ['borrow a neighbour machine', 'repair on the spot', 'bring in volunteers'], ignored: 'crop lost to rain',
});
P('work.crop_blight', 'Blight in the crop', 'work', 3, ['farm'], {
  cause: ['wet summer', 'infected seed'], cond: ['wet'], signs: ['blackened leaves', 'a farmer silent at the field edge', 'a sweet rotten smell'], fixes: ['burn infected plants', 'spray', 'seek advice'], ignored: 'whole harvest lost',
});
P('work.well_dry', 'Well runs dry', 'work', 3, ['farm', 'suburb'], {
  cause: ['drought', 'a neighbour digging deeper'], cond: ['hot', 'dry'], signs: ['a dull thud from the bucket', 'dust in the trough'], fixes: ['deliver water', 'dig deeper', 'ration'], ignored: 'livestock die', escalatesTo: 'social.neighbor_feud', after: 3600,
});
P('work.barn_fire', 'Barn fire', 'work', 5, ['farm'], {
  cause: ['damp hay self-heating', 'lightning', 'a spark from a tool'], signs: ['a sweet burning smell', 'smoke from the loft', 'animals bellowing'], fixes: ['release the animals', 'fire brigade', 'form a bucket line'], ignored: 'barn and livestock lost',
});

/* ============================== SOCIAL ==================================== */

P('social.neighbor_feud', 'Neighbour feud', 'social', 2, HOME, {
  cause: ['boundary fence', 'noisy dog', 'a hedge', 'parking'], signs: ['curt greetings', 'a note on a windscreen', 'a hosepipe pointed over a fence'], fixes: ['mediate', 'involve the council', 'share a pint'],
  ignored: 'a slow poison on the street', escalatesTo: 'crime.vandalism_spree', after: 14400, tags: ['social'],
});
P('social.road_rage', 'Road rage', 'social', 3, ['street', 'suburb'], {
  cause: ['cut off at a junction', 'honking', 'a scraped wing mirror'], signs: ['two drivers out of their cars', 'raised voices', 'a thrown cap'], fixes: ['de-escalate', 'call the police', 'get between them'], ignored: 'a punch', escalatesTo: 'social.brawl', after: 120,
});
P('social.brawl', 'Fight breaks out', 'social', 4, ['street', 'plaza', 'alley', 'industrial'], {
  cause: ['a spilled drink', 'old grudge', 'football result', 'picket line'], signs: ['shouting', 'a cleared circle', 'shoving', 'a bottle breaking'], fixes: ['break it up', 'call the police', 'drag a friend away'], ignored: 'serious injury',
});
P('social.argument_couple', 'Couple argues in public', 'social', 1, ['street', 'plaza', 'park'], {
  cause: ['lost tickets', 'jealousy', 'money'], signs: ['sharp whispers', 'one person walking off', 'a door slamming'], fixes: ['leave them be', 'offer a calm word'], ignored: 'one storms off alone into the night', tags: ['comic'],
});
P('social.wedding_disaster', 'Wedding goes wrong', 'social', 2, ['plaza', 'park', 'suburb'], {
  cause: ['rain on the marquee', 'cake collapses', 'missing ring', 'drunk speech'], signs: ['a bride on the verge of tears', 'frantic staff', 'guests murmuring'], fixes: ['improvise', 'find the ring', 'lend a coat', 'rally the guests'], ignored: 'memories forever', tags: ['comic'],
});
P('social.funeral_clash', 'Funeral and festival clash', 'social', 2, ['plaza', 'street'], {
  cause: ['bad scheduling', 'a loud band next door'], signs: ['mourners glaring at balloons', 'two organisers arguing'], fixes: ['negotiate a quiet hour', 'move the party'], ignored: 'insults traded', tags: ['social'],
});
P('social.festival_cancelled', 'Festival cancelled at the last minute', 'social', 2, ['plaza', 'park'], {
  cause: ['storm warning', 'unpaid performers', 'permit problems'], signs: ['staff taking down banners', 'a disappointed crowd'], fixes: ['organise an impromptu gig', 'offer refunds', 'move indoors'], ignored: 'a crowd with nowhere to go',
});
P('social.lost_child', 'Lost child', 'social', 4, ['plaza', 'park', 'street', 'beach'], {
  cause: ['let go of a hand in a crowd', 'wandered after a dog'], cond: ['day'], signs: ['a parent calling a name', 'a small figure standing alone', 'a tear-streaked face'],
  fixes: ['stay with the child', 'ask a staff member', 'organise a search', 'check the nearest water'], ignored: 'terror and danger rise by the minute', weight: 1.4,
});
P('social.rumor_spreads', 'False rumour spreads', 'social', 2, ['plaza', 'street', 'suburb'], {
  cause: ['gossip at the market', 'a misheard conversation'], signs: ['whispers falling silent when someone enters', 'a shopkeeper avoiding eye contact'], fixes: ['track the source', 'confront it with facts', 'give the rumour a kinder ending'], ignored: 'a reputation ruined', escalatesTo: 'economic.business_shut', after: 14400,
});
P('social.drunk_wandering', 'Drunk wanders into danger', 'social', 3, ['street', 'plaza', 'alley', 'beach'], {
  cause: ['pub chucking out', 'celebration'], cond: ['night'], signs: ['weaving gait', 'singing', 'a stumble at a kerb'], fixes: ['walk them home', 'get a taxi', 'keep them from the road'], ignored: 'a fall, a fight, or a freezing night on a bench', escalatesTo: 'health.hypothermia_mild', after: 3600,
});
P('social.eviction_protest', 'Protest outside the town hall', 'social', 3, ['plaza', 'street'], {
  cause: ['rent hikes', 'closed clinic', 'a decision nobody was asked about'], signs: ['placards', 'a growing crowd', 'police lines'], fixes: ['listen to the organisers', 'mediate with the council'], ignored: 'clashes with police', escalatesTo: 'social.brawl', after: 3600,
});
P('social.language_barrier', 'Traveller cannot make themselves understood', 'social', 1, ['plaza', 'street'], {
  cause: ['just arrived', 'phone translator broken'], signs: ['pointing at a map', 'helpless repeating of one word'], fixes: ['translate', 'draw a map', 'walk them there'], ignored: 'they take the wrong turn',
});
P('social.elder_alone', 'Elderly neighbour has not been seen', 'social', 3, HOME, {
  cause: ['fallen at home', 'illness', 'locked out'], signs: ['newspapers piled up', 'curtains closed for days', 'a dog barking inside'], fixes: ['knock and call', 'call emergency services', 'break the door'], ignored: 'found too late',
});

/* ================================= CRIME ================================== */

P('crime.pickpocket', 'Pickpocketing in a crowd', 'crime', 2, ['plaza', 'street'], {
  cause: ['a bump and apology', 'a distraction by a partner'], cond: ['crowd'], signs: ['a stranger brushing past', 'a person patting a pocket', 'a quick figure slipping away'], fixes: ['chase', 'alert the victim', 'call the police'], ignored: 'wallet gone', weight: 1.5,
});
P('crime.mugging', 'Mugging in the dark', 'crime', 4, ['alley', 'street', 'industrial'], {
  cause: ['desperation', 'a poorly lit route'], cond: ['night'], signs: ['a raised voice', 'shadow movement', 'a bag dropped'], fixes: ['intervene', 'call the police', 'make noise'], ignored: 'injury and loss',
});
P('crime.burglary', 'Break-in', 'crime', 3, HOME, {
  cause: ['empty house on holiday', 'back gate unlatched', 'keys left under a mat'], cond: ['night'], signs: ['a torch inside a dark house', 'a window ajar', 'a quiet figure on a roof'], fixes: ['call the police', 'confront', 'lock the gate'], ignored: 'valuables gone and a victim shaken',
});
P('crime.car_theft', 'Car stolen', 'crime', 3, ['street', 'suburb', 'industrial'], {
  cause: ['left unlocked', 'a relay attack', 'keys left in the ignition'], signs: ['a hotwire click', 'an engine starting where none should', 'broken glass in a bay'], fixes: ['chase', 'call the police', 'track by phone'], ignored: 'gone for good',
});
P('crime.vandalism_spree', 'Vandalism spree', 'crime', 3, URBAN, {
  cause: ['bored teens', 'a feud', 'a hate campaign'], signs: ['smashed bus shelters', 'keyed cars', 'torn flowerbeds'], fixes: ['catch them in the act', 'community watch', 'youth outreach'], ignored: 'the neighbourhood sours',
});
P('crime.shop_alarm', 'Shop alarm blares', 'crime', 2, ['street', 'plaza'], {
  cause: ['a break-in', 'a cat triggering the sensor', 'a short circuit'], cond: ['night'], signs: ['a piercing bell', 'a shattered window', 'a dash of footsteps'], fixes: ['check the shop', 'call the owner', 'call the police'], ignored: 'sleep ruined and shop lost',
});
P('crime.lone_walker_followed', 'Lone walker is followed', 'crime', 4, ['alley', 'street', 'industrial'], {
  cause: ['a predator', 'a mistaken identity'], cond: ['night'], signs: ['matching footsteps behind a walker', 'a walker glancing back and speeding up'], fixes: ['walk with them', 'call the police', 'make your presence known'], ignored: 'an assault',
});
P('crime.unattended_bag', 'Unattended bag', 'crime', 3, ['plaza', 'street'], {
  cause: ['forgotten by a tourist', 'a decoy', 'actual threat'], cond: ['crowd'], signs: ['a bag alone by a bench', 'people edging away', 'a nervous guard'], fixes: ['find the owner', 'call the bomb squad', 'clear the area'], ignored: 'panic or worse',
});
P('crime.shakedown', 'Protection racket shakedown', 'crime', 3, ['street', 'plaza', 'alley'], {
  cause: ['a local gang', 'a debt'], signs: ['a shopkeeper paying a visitor quietly', 'a thick envelope', 'a smashed window "accident"'], fixes: ['report', 'organise the shopkeepers', 'confront the gang'], ignored: 'more shops drawn in',
});
P('crime.opportunistic_looting', 'Opportunistic looting', 'crime', 4, URBAN, {
  cause: ['blackout', 'a flood', 'a riot'], cond: ['night'], signs: ['smashed shutters', 'a figure running with a TV', 'silence of no alarms'], fixes: ['guard shops', 'call the police', 'form a watch'], ignored: 'a looted street',
});
P('crime.scam', 'Street scam in progress', 'crime', 2, ['plaza', 'street'], {
  cause: ['a bracelet "gift"', 'fake charity', 'cup-and-ball game'], signs: ['a smooth talker with a crowd', 'a tourist handing over money reluctantly'], fixes: ['warn the mark', 'expose the shill', 'report'], ignored: 'a victim poorer and more embarrassed', weight: 1.3,
});
P('crime.arson', 'Suspicious fire', 'crime', 5, URBAN, {
  cause: ['a grudge', 'an insurance scheme'], cond: ['night'], signs: ['the smell of petrol', 'a lit window with no residents', 'someone leaving quickly'], fixes: ['fire brigade', 'chase the culprit', 'evacuate'], ignored: 'the block burns',
});

/* ============================= RUNTIME HELPERS ============================ */

export const PROBLEMS: readonly ProblemDef[] = catalog;
export const PROBLEM_BY_ID: ReadonlyMap<string, ProblemDef> = new Map(catalog.map(p => [p.id, p]));

export function problemsByDomain(domain: ProblemDomain): ProblemDef[] {
  return catalog.filter(p => p.domain === domain);
}

/** Convert world state into the condition tokens problems ask for. */
export function conditionsFor(ctx: WorldContext, crowd = false): Set<Condition> {
  const w = ctx.weather, h = ctx.hour, s = new Set<Condition>();
  s.add(h >= 20.5 || h < 5.5 ? 'night' : 'day');
  s.add(w.rain > 0.15 ? 'rain' : 'dry');
  s.add(w.windSpeed > 6 ? 'wind' : 'calm');
  if (w.temperature < 5) s.add('cold');
  if (w.temperature < 0) s.add('freezing');
  if (w.temperature > 26) s.add('hot');
  if (w.wetness > 0.5) s.add('wet');
  if (w.fog > 0.5) s.add('fog');
  if (w.rain > 0.6 && w.windSpeed > 8) s.add('storm');
  s.add(ctx.season);
  if (crowd) s.add('crowd');
  return s;
}

export function isEligible(p: ProblemDef, biome: Biome, conds: Set<Condition>): boolean {
  if (p.where.length && !p.where.includes(biome)) return false;
  return p.cond.every(c => conds.has(c));
}

let uidSeq = 1;

/** Roll a problem that suits where the player is and what the world is doing. */
export function rollProblem(ctx: WorldContext, rng: Rng, opts: { crowd?: boolean; maxSeverity?: number; domains?: ProblemDomain[] } = {}): ProblemInstance | null {
  const biome = ctx.biomeAt(ctx.player.pos), conds = conditionsFor(ctx, opts.crowd);
  const pool = catalog.filter(p =>
    isEligible(p, biome, conds) &&
    p.severity <= (opts.maxSeverity ?? 5) &&
    (!opts.domains || opts.domains.includes(p.domain)));
  // Rarer for higher severity so the world is mostly small trouble.
  const picked = rng.weighted(pool, pool.map(p => p.weight / Math.pow(2, p.severity - 1)));
  return picked ? instantiate(picked, rng) : null;
}

export function instantiate(def: ProblemDef, rng: Rng): ProblemInstance {
  const drift = rng.chance(0.15) ? (rng.chance(0.5) ? 1 : -1) : 0;
  return { uid: uidSeq++, def, cause: rng.pick(def.cause), severity: Math.min(5, Math.max(1, def.severity + drift)), age: 0, stage: 'brewing', signsShown: 0 };
}

/**
 * Advance a problem. It reveals signs gradually, becomes active, then escalates
 * into a worse problem (if it has one) when left alone. Returns the successor
 * problem when an escalation happens.
 */
export function tickProblem(inst: ProblemInstance, dt: number, rng: Rng): ProblemInstance | null {
  if (inst.stage === 'resolved' || inst.stage === 'escalated' || inst.stage === 'ignored') return null;
  inst.age += dt;
  const revealEvery = 6;
  inst.signsShown = Math.min(inst.def.signs.length, Math.floor(inst.age / revealEvery) + 1);
  if (inst.age > 3) inst.stage = 'active';
  if (inst.def.escalatesTo && inst.def.after && inst.age > inst.def.after) {
    inst.stage = 'escalated';
    const next = PROBLEM_BY_ID.get(inst.def.escalatesTo);
    return next ? instantiate(next, rng) : null;
  }
  return null;
}

export function resolveProblem(inst: ProblemInstance, fixIndex: number) {
  inst.stage = 'resolved';
  inst.resolvedBy = inst.def.fixes[fixIndex] ?? inst.def.fixes[0];
}

/** Gives up on a problem after the player leaves; consequences are `def.ignored`. */
export function abandonProblem(inst: ProblemInstance): string {
  if (inst.stage !== 'resolved') inst.stage = 'ignored';
  return inst.def.ignored;
}

/** Quick sanity check for authoring: finds escalation targets that don't exist. */
export function validateCatalog(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const p of catalog) {
    if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`);
    ids.add(p.id);
  }
  for (const p of catalog) if (p.escalatesTo && !ids.has(p.escalatesTo)) errors.push(`${p.id} escalates to missing ${p.escalatesTo}`);
  return errors;
}
