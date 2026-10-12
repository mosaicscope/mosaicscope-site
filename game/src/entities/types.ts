/** Plain data shapes shared by every system. Systems own behaviour; entities are just state. */

export type Tier = "player" | "principal" | "mid" | "background";
/** Dynamic simulation level of detail. Lower = more detail. */
export const enum Lod { FULL = 0, REDUCED = 1, GROUP = 2, BACKGROUND = 3, SLEEP = 4 }
export const LOD_NAMES = ["full", "reduced", "group", "background", "sleep"];
/** Ticks between AI updates for each LOD (physics/steering for FULL..GROUP runs every tick). */
export const LOD_INTERVAL = [1, 3, 8, 15, 45];

export type BodyKind = "guy" | "girl";
export interface Look {
  kind: BodyKind;
  color: string;
  accent: string;
  hat: "bandana" | "cap" | "beanie" | "none";
  hair: "big" | "bun" | "pony" | "none";
  glam?: boolean;
  main?: boolean;
  scale: number;
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
  | "joked_with" | "saw_fight" | "saw_break" | "lost_item" | "party" | "talked" | "rumour" | "event" | "player_action";

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
}
export type StepKind =
  | "goto" | "approach" | "pickup" | "throw" | "swing" | "talk" | "sit" | "wait" | "play" | "dance" | "flee"
  | "comfort" | "search" | "give" | "drop" | "craft" | "watch" | "cheer" | "push" | "shoot" | "kick" | "music" | "wander";

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
  dirty: boolean;                // render-relevant state changed (background batching)
  seedPhase: number;             // per-entity animation offset
}

export type ToyState = "rest" | "flying" | "held" | "broken";

export interface Toy {
  id: number;
  def: string;
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
