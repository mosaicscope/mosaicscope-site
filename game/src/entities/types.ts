/** Plain data shapes shared by every system. Systems own behaviour; entities are just state. */

export type Tier = "player" | "principal" | "mid" | "background";
/** Dynamic simulation level of detail. Lower = more detail. */
export const enum Lod { FULL = 0, REDUCED = 1, GROUP = 2, BACKGROUND = 3, SLEEP = 4 }
export const LOD_NAMES = ["full", "reduced", "group", "background", "sleep"];
/** Ticks between AI updates for each LOD (physics/steering for FULL..GROUP runs every tick). */
export const LOD_INTERVAL = [1, 3, 8, 15, 45];

export type BodyKind = "guy" | "girl";
export type HatStyle = "bandana" | "cap" | "beanie" | "none" | "bucket" | "beret" | "headphones" | "helmet" | "cowboy" | "police" | "snapback" | "hood";
export type HairStyle = "big" | "bun" | "pony" | "none" | "afro" | "mohawk" | "buzz" | "long" | "braids" | "curly" | "spiky" | "sidepart" | "bob" | "pigtails" | "topknot";
export interface Face {
  eyes: "shades" | "round" | "dots" | "visor" | "aviator" | "happy" | "wide" | "sleepy" | "wink" | "shutter" | "cateye";
  brows: "none" | "straight" | "angry" | "raised" | "thick" | "worried";
  mouth: "smile" | "grin" | "flat" | "o" | "smirk" | "teeth" | "frown" | "tongue";
  nose: "none" | "dot" | "line" | "hook";
  facial: "none" | "mustache" | "goatee" | "beard" | "stubble" | "soulpatch";
  extra: "none" | "freckles" | "earrings" | "nosering" | "blush" | "tattoo" | "scar" | "mole";
  head: "round" | "oval" | "wide";
  /** Face-gene seed (see render/FaceGenes.ts): layered procedural details. Absent on old saves. */
  gene?: number;
  /** A unique eye drawn from its parameters (street models, see render/Models.ts). Overrides `eyes` when set. */
  shape?: EyeShape;
}
export interface EyeShape {
  kind: "oval" | "almond" | "slit" | "heavy" | "ring" | "closed" | "cross";
  /** eye width and height multipliers */
  w: number; h: number;
  /** outer-corner tilt in radians (positive lifts the outer corner: friendly; negative drops it: angry) */
  tilt: number;
  /** pupil offset toward the facing side, -1..1 */
  pupil: number;
  /** how far the upper lid has dropped, 0..1 (heavy lids) */
  lid: number;
  lash: boolean;
}
export type Accessory = "glasses" | "chain" | "scarf" | "backpack" | "watch" | "headband" | "earrings" | "eyepatch" | "bandage" | "bowtie";
export interface Look {
  skin?: string; hairColor?: string; pattern?: number; accessories?: Accessory[];
  top?:import('../render/Models').TopStyle;bottom?:import('../render/Models').ModelSpec['bottom'];shoes?:import('../render/Models').ModelSpec['shoes'];shoeColor?:string;
  kind: BodyKind;
  color: string;
  accent: string;
  hat: HatStyle;
  hair: HairStyle;
  glam?: boolean;
  main?: boolean;
  scale: number;
  face?: Face;
  /** body build: >1 stockier stroke, <1 slimmer */
  build?: number;
}

export interface Personality {
  boldness: number;     // 0 timid .. 1 fearless
  kindness: number;     // 0 mean .. 1 caring
  temper: number;       // 0 calm .. 1 hot-headed
  sociability: number;  // 0 loner .. 1 social butterfly
  curiosity: number;
  playfulness: number;
  honesty: number;      // affects gossip distortion
}

/** Needs: 1 = fully satisfied, 0 = desperate. */
export interface Needs { energy: number; social: number; fun: number; curiosity: number }

export interface Emotion {
  fear: number;         // 0..1
  frustration: number;  // 0..1
  confidence: number;   // 0..1
  mood: number;         // -1..1
  composure: number;    // 0..1, physical "toy hit points"; 0 = knocked down
}

export const enum Phys { OK = 0, STUMBLE = 1, DOWN = 2, RECOVER = 3 }

export type MemoryKind =
  | "hit_by" | "hit" | "helped_by" | "helped" | "gift_from" | "gift_to" | "argued" | "made_up" | "insulted_by"
  | "joked_with" | "saw_fight" | "saw_break" | "lost_item" | "party" | "talked" | "rumour" | "event" | "player_action"
  | "saw_crime" | "robbed" | "arrested" | "shoot" | "car_hit"
  | "wounded" | "kissed" | "dated" | "cheating" | "broke_up";

/** Where a piece of knowledge came from. NPCs only talk about what they could plausibly know. */
export type Provenance = "did" | "saw" | "heard" | "told";

export interface Memory {
  t: number;            // tick
  kind: MemoryKind;
  subj: number;         // main entity involved (-1 none)
  obj: number;          // secondary entity (-1 none)
  toy: string | null;   // toy def id
  area: number;
  val: number;          // emotional valence -1..1
  src: Provenance;
  from: number;         // who told us (-1 if first-hand)
  cred: number;         // credibility 0..1
  ev: number;           // world event id (-1)
  /** rehearsal count and last-recall tick (Ebbinghaus spacing; see mind/Memory.ts) */
  rep?: number; rec?: number;
}

export interface Rel {
  fam: number;      // familiarity 0..1
  trust: number;    // -1..1
  aff: number;      // affection -1..1
  respect: number;  // -1..1
  fear: number;     // 0..1
  rivalry: number;  // 0..1
  grudge: number;   // 0..1
  shared: number;   // count of shared experiences
  favours: number;  // favours owed to us (+) or by us (-)
  last: number;     // tick of last interaction
  love?: number;    // romantic feeling 0..1 (only for people they're attracted to)
}

export interface Step {
  kind: StepKind;
  x?: number; y?: number;
  target?: number;      // character id
  toy?: number;         // toy id
  poi?: number;
  dist?: number;
  time?: number;
  text?: string;
  topic?: string;
  building?: number;
  minutes?: number;
  item?: string;
  booking?: number;
}
export type StepKind =
  | "goto" | "approach" | "pickup" | "throw" | "swing" | "talk" | "sit" | "wait" | "play" | "dance" | "flee"
  | "comfort" | "search" | "give" | "drop" | "craft" | "watch" | "cheer" | "push" | "shoot" | "kick" | "music" | "wander"
  | "enter" | "buy" | "eat" | "steal" | "spray" | "clean" | "chase" | "photo" | "pose" | "skate" | "busk" | "flee_far" | "trade" | "book" | "treat" | "mug" | "flirt" | "kiss" | "date" | "follow" | "gunfight";

export interface ActiveGoal {
  id: string;
  target: number;
  plan: Step[];
  stepIdx: number;
  stepTimer: number;
  started: number;
  replans: number;
}

export interface Anim {
  phase: number;        // walk cycle phase
  pose: string;         // current pose id
  poseT: number;        // seconds in pose
  flash: number;        // hit flash timer
  gesture: number;      // talk gesture phase
}

export type WoundPart = "head" | "torso" | "arm" | "leg";
export type WoundKind = "bruise" | "graze" | "cut" | "gash" | "stab" | "fracture";
/** severity: 1 bruise/graze (no bleeding), 2 cut/gash (bleeds), 3 deep stab or bad gash (bleeds fast) */
export interface Wound { art?:number; marks?:number[]; hits?:number; part: WoundPart; kind: WoundKind; severity: 1 | 2 | 3; bandaged: boolean; tick: number }

export interface Character {
  id: number;
  name: string;
  tier: Tier;
  lod: Lod;
  x: number; y: number; z: number;
  px: number; py: number;        // previous position (render interpolation)
  vx: number; vy: number;        // steering velocity
  kx: number; ky: number; vz: number; // knockback + vertical velocity
  facing: number;                // radians, world space
  radius: number;
  speed: number;
  look: Look;
  pers: Personality;
  needs: Needs;
  emo: Emotion;
  phys: Phys;
  physTimer: number;
  /** HSM top state */
  mode: "idle" | "goal" | "talk" | "panic" | "down" | "player";
  goal: ActiveGoal | null;
  goalCooldowns: Record<string, number>;
  path: Float32Array | null;
  pathIdx: number;
  pathReq: number;
  pathGoalX: number; pathGoalY: number;
  repathAt: number;
  /** set when an entity is promoted from background to a detailed tier (keeps state) */
  promoted: boolean;
  stuck: number;
  lastX: number; lastY: number;
  hand: number;                  // toy id in hand (-1)
  bag: number[];                 // toy ids carried (max 3)
  bagMax: number;
  memories: Memory[];
  memMax: number;
  rel: Map<number, Rel>;
  group: number;
  anim: Anim;
  bubble: { text: string; until: number; kind: "say" | "think" | "shout" } | null;
  talkWith: number;              // conversation partner id (-1)
  nextThink: number;             // tick of next AI update
  lastHitBy: number; lastHitTick: number;
  homeArea: number;
  bio: string;
  style: string;                 // movement/dance style
  likes: string[];               // toy def ids
  fears: string[];               // event kinds
  catchphrase: string;
  /** stats for inspector */
  stats: { hits: number; hitsTaken: number; throws: number; gifts: number; talks: number; helps: number; falls: number };
  /** learned simple preferences: toy def -> score */
  prefs: Record<string, number>;
  reputation: number;            // public standing -1..1
  role: import("../content/names").Role;
  cash: number;                  // NZD in their wallet
  /** redeemable cans and bottles in their sack (see sim/Litter.ts) */
  scrap?: { can: number; bottle: number };
  hunger: number;                // 1 = full, 0 = starving
  /** building id they are inside (hidden from the street), or -1 */
  inside: number;
  insideUntil: number;
  /** vehicle id they are driving/riding, or -1 */
  inCar: number;
  workplace: number;             // building id or -1
  home: number;                  // building id or -1
  /** police: suspect being chased; others: -1 */
  pursuing: number;
  arrestedBy: number;            // cop id while being escorted, or -1
  jailUntil: number;             // tick released from custody (0 = free)
  wanted: number;                // 0..5 stars (player and known criminals)
  /** player only: street rep with each crew, -100..100 (sim/Rep.ts) */
  rep?: Record<string, number>;
  stunUntil: number;
  nickname: string;
  /** street crew ("famiglia", "riccarton") or "" for none */
  crew: string;
  painAt?:number;
  combat?:{magUsed?:Record<string,number>;reloadUntil?:number;reloadWeapon?:string;style:import("../content/combat").UnarmedStyle;load?:"rubber"|"standard"|"heavy";recoil?:number;recoilTick?:number;theftXP?:number;issued?:boolean;xp:number;ammo:Record<string,number>;vest:number;helmet:number};
  wounds: Wound[];
  bleed: number;                 // current bleeding rate 0..1 (sum of open wounds)
  blood: number;                 // 1 = fine, below 0.35 they collapse
  partner: number;               // romantic partner id or -1
  affair: number;                // secret other person, or -1
  attractedTo: ("guy" | "girl")[];
  dirty: boolean;                // render-relevant state changed (background batching)
  seedPhase: number;             // per-entity animation offset
  /** learned tastes, habits, affect and fears (see src/mind); plain JSON so it saves as-is */
  mind: import("../mind/Mind").Mind;
}

export type ToyState = "rest" | "flying" | "held" | "broken";

export interface Toy {
  id: number;
  def: string;
  load?:"rubber"|"standard"|"heavy";
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  angle: number; spin: number;
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
  durability: number;
  maxDurability: number;
  holder: number;     // character id or -1
  owner: number;      // character id or -1
  thrower: number;    // last thrower id
  throwTick: number;
  state: ToyState;
  layer: number;
  mask: number;
  tether: number;     // character id the toy is tethered to (-1)
  tetherLen: number;
  hitUntil: number;   // tick before which it cannot hit again
  brokenAt: number;
  color: string;
  lostBy: number;     // owner who lost it (search events)
}

export type VehicleState = "drive" | "parked" | "crashed" | "free";
export interface Vehicle {
  id: number;
  cls: import("../content/vehicles").VehicleClass;
  x: number; y: number; px: number; py: number;
  heading: number;      // radians, world space
  speed: number;        // tiles per second (negative = reversing)
  color: string;
  driver: number;       // character id or -1
  owner: number;        // character id, -1 city/unowned, -2 dealership stock
  state: VehicleState;
  dir: number;          // lane direction for traffic AI: 0 E, 1 S, 2 W, 3 N
  nextDir: number;      // planned direction at the next intersection (-1 undecided)
  damage: number;       // 0..1
  siren: boolean;
  plate: string;
  forSale: boolean;
  price: number;
  stuck: number;
  honkAt: number;
  crashedUntil: number;
  meet: boolean;        // parked at a car meet
  /** Free-body dynamics (player driving, joyriders, crashed cars sliding): world velocity, yaw rate, the tick they
   *  were last integrated (stale values are re-seeded from heading and speed) and sideways slip for skid marks. */
  vx?: number; vy?: number; yaw?: number; dynT?: number; slip?: number;
  /** Where the car has been hit, 0..1 each: front, rear, left, right (the body crumples there; see Traffic.bump). */
  dmgF?: number; dmgR?: number; dmgL?: number; dmgS?: number;
  rescueTarget?:number; rescueAt?:number; rescueMedic?:number;
  cannonRounds?:number;
  lifeMods?: string[];
  engineDamage?: number; glassDamage?: number; flatLeft?: boolean; flatRight?: boolean;
  bumperLost?: boolean; mirrorLost?: boolean; leak?: number; heat?: number; burning?: boolean; burnTime?: number; burnt?: boolean; burntAge?: number; towAt?: number;
}
