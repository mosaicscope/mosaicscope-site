import type { Look, Personality } from "../entities/types";

/**
 * The ten Mosaics, carried over from the crew that lives in the footer of mosaicscope.co.nz
 * (same names, colours, hats and hair as main.js CAST). Each has a personality that makes them
 * respond differently to the same situation.
 */
export interface CastDef {
  name: string;
  look: Omit<Look, "scale">;
  pers: Personality;
  style: string;
  bio: string;
  likes: string[];
  fears: string[];
  home: string; // area kind
  catchphrase: string;
  /** daily routine: [hour, area kind] pairs */
  routine: [number, string][];
}

export const CAST: CastDef[] = [
  {
    name: "Tiles", look: { kind: "guy", color: "#c6ff3d", accent: "#ec2a1c", hat: "bandana", hair: "none", main: true },
    pers: { boldness: 0.85, kindness: 0.6, temper: 0.55, sociability: 0.9, curiosity: 0.5, playfulness: 0.8, honesty: 0.7 },
    style: "swagger", home: "plaza", catchphrase: "Run it back.",
    bio: "Main guy. Throws the parties, throws the cash, throws the first ball. Hates being upstaged, loves his crew.",
    likes: ["ball", "foam_sword"], fears: [],
    routine: [[8, "plaza"], [11, "court"], [14, "market"], [17, "plaza"], [20, "stage"], [23, "stage"]],
  },
  {
    name: "Glitter", look: { kind: "girl", color: "#ff7ad9", accent: "#f6b62c", hat: "none", hair: "big", glam: true },
    pers: { boldness: 0.7, kindness: 0.65, temper: 0.4, sociability: 0.95, curiosity: 0.6, playfulness: 0.75, honesty: 0.5 },
    style: "smooth", home: "stage", catchphrase: "Get my good side.",
    bio: "Tiles' girl. Knows everyone's business before they do. Rumours start and end with her.",
    likes: ["plush", "frisbee"], fears: ["blackout"],
    routine: [[9, "market"], [12, "plaza"], [15, "park"], [18, "market"], [20, "stage"]],
  },
  {
    name: "Kodak", look: { kind: "guy", color: "#f6b62c", accent: "#eee4d3", hat: "cap", hair: "none" },
    pers: { boldness: 0.6, kindness: 0.7, temper: 0.3, sociability: 0.6, curiosity: 0.9, playfulness: 0.6, honesty: 0.9 },
    style: "bouncy", home: "park", catchphrase: "Hold still. Got it.",
    bio: "Always has a camera. Turns up wherever something is happening, which means he sees everything.",
    likes: ["frisbee", "yoyo"], fears: [],
    routine: [[7, "park"], [10, "plaza"], [13, "court"], [16, "park"], [19, "stage"]],
  },
  {
    name: "Nova", look: { kind: "girl", color: "#3dd6ff", accent: "#ff7ad9", hat: "none", hair: "bun" },
    pers: { boldness: 0.35, kindness: 0.85, temper: 0.2, sociability: 0.55, curiosity: 0.75, playfulness: 0.5, honesty: 0.85 },
    style: "loose", home: "studio", catchphrase: "Everyone ok?",
    bio: "Calm one. First to help when someone goes down, last to start anything. Hides in the Studio when it rains.",
    likes: ["plush", "yoyo"], fears: ["fight", "blackout"],
    routine: [[8, "studio"], [12, "park"], [15, "studio"], [18, "plaza"], [21, "studio"]],
  },
  {
    name: "Grain", look: { kind: "guy", color: "#eee4d3", accent: "#ec2a1c", hat: "none", hair: "none" },
    pers: { boldness: 0.5, kindness: 0.4, temper: 0.35, sociability: 0.3, curiosity: 0.6, playfulness: 0.45, honesty: 0.6 },
    style: "sharp", home: "playground", catchphrase: "Nah.",
    bio: "Quiet. Keeps to the playground. Holds a grudge for a very, very long time.",
    likes: ["foam_bow", "shield"], fears: ["crowd"],
    routine: [[9, "playground"], [13, "alley"], [16, "playground"], [20, "alley"]],
  },
  {
    name: "Flash", look: { kind: "guy", color: "#b48cff", accent: "#f6b62c", hat: "cap", hair: "none" },
    pers: { boldness: 0.95, kindness: 0.35, temper: 0.8, sociability: 0.7, curiosity: 0.4, playfulness: 0.9, honesty: 0.4 },
    style: "hype", home: "court", catchphrase: "Who wants it?",
    bio: "Hype man with a short fuse. Starts toy fights for fun and occasionally finishes them. Pranks everyone.",
    likes: ["foam_sword", "noodle", "ball"], fears: [],
    routine: [[10, "court"], [13, "plaza"], [16, "court"], [19, "alley"], [21, "stage"]],
  },
  {
    name: "Ruby", look: { kind: "girl", color: "#ec2a1c", accent: "#c6ff3d", hat: "none", hair: "big" },
    pers: { boldness: 0.8, kindness: 0.5, temper: 0.65, sociability: 0.75, curiosity: 0.5, playfulness: 0.7, honesty: 0.75 },
    style: "smooth", home: "court", catchphrase: "Say that again.",
    bio: "Competitive. Runs the court. Will defend a friend from anyone, including Tiles.",
    likes: ["ball", "shield", "foam_sword"], fears: [],
    routine: [[8, "court"], [12, "market"], [15, "court"], [19, "plaza"], [21, "stage"]],
  },
  {
    name: "Bando", look: { kind: "guy", color: "#ff9a3d", accent: "#3dd6ff", hat: "bandana", hair: "none" },
    pers: { boldness: 0.7, kindness: 0.55, temper: 0.5, sociability: 0.65, curiosity: 0.7, playfulness: 0.85, honesty: 0.55 },
    style: "bouncy", home: "alley", catchphrase: "I can fix that.",
    bio: "Tinkerer from the alley. Builds improvised toys out of whatever is lying around. Trades everything.",
    likes: ["noodle", "spring", "box"], fears: [],
    routine: [[9, "alley"], [12, "market"], [15, "alley"], [18, "playground"], [21, "stage"]],
  },
  {
    name: "Lux", look: { kind: "girl", color: "#c6ff3d", accent: "#3dd6ff", hat: "none", hair: "bun" },
    pers: { boldness: 0.45, kindness: 0.75, temper: 0.3, sociability: 0.8, curiosity: 0.85, playfulness: 0.8, honesty: 0.7 },
    style: "loose", home: "park", catchphrase: "Ooh what's that?",
    bio: "Curious about everything. Wanders to every crowd, collects shiny things, makes friends fast.",
    likes: ["frisbee", "spring", "plush"], fears: ["storm"],
    routine: [[8, "park"], [11, "market"], [14, "playground"], [17, "plaza"], [20, "stage"]],
  },
  {
    name: "Static", look: { kind: "guy", color: "#8fe3c0", accent: "#ff7ad9", hat: "cap", hair: "none" },
    pers: { boldness: 0.3, kindness: 0.6, temper: 0.45, sociability: 0.4, curiosity: 0.65, playfulness: 0.55, honesty: 0.8 },
    style: "sharp", home: "studio", catchphrase: "...ok.",
    bio: "The DJ. Shy until the music is on. Guards the boombox; panics when the power goes.",
    likes: ["yoyo", "plush"], fears: ["blackout", "fight"],
    routine: [[10, "studio"], [14, "stage"], [17, "studio"], [19, "stage"]],
  },
];

/** Palette used for procedural characters (same neon set as the site). */
export const PALETTE = ["#c6ff3d", "#ff7ad9", "#f6b62c", "#3dd6ff", "#eee4d3", "#b48cff", "#ec2a1c", "#ff9a3d", "#8fe3c0"];
export const MID_STYLES = ["swagger", "smooth", "bouncy", "loose", "sharp", "hype"];

export const NAME_A = ["Shutter", "Lens", "Echo", "Velvet", "Tape", "Reel", "Frame", "Pixel", "Disco", "Bass", "Tempo", "Dusk", "Halo", "Neon", "Prism", "Sepia", "Focus", "Blur", "Gloss", "Matte", "Chrome", "Sprocket", "Polaroid", "Strobe", "Vinyl", "Fader", "Treble", "Cue", "Reverb", "Saber", "Ollie", "Kicks", "Jinx", "Pepper", "Mango", "Coco", "Juno", "Rio", "Zed", "Moss"];
export const NAME_B = ["", "", "", "", "Jr", "II", "Kid", "Lil", "Big"];
