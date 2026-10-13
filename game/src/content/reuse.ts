/**
 * The reuse stall and swap meet: odd little trinkets made from cans and bottles, and found-object art
 * that Louis, the gallery's resident fine-arts doctorate, appraises. Brand-free and PG: the stall
 * sells nothing real, only the second life of the street's rubbish.
 */
export interface Trinket { id: string; name: string; cost: number; blurb: string; louis: string; value: number }

/** Cost is in sack pieces (cans and bottles); value is what it is worth on a shelf. */
export const TRINKETS: Trinket[] = [
  { id: "kazoo", name: "bottle-cap kazoo", cost: 3, value: 2, blurb: "Plays one note and a lot of attitude.", louis: "An instrument of exactly one argument. Pure, uncompromised, deafening." },
  { id: "bracelet", name: "ring-pull bracelet", cost: 4, value: 3, blurb: "Forty pulls, linked like tiny chainmail.", louis: "Wearable chainmail for the post-industrial wrist. Christa would call it rigorous." },
  { id: "phone", name: "tin-can telephone", cost: 5, value: 4, blurb: "Works up to the length of the string.", louis: "The oldest network protocol, rendered in aluminium. I wept a little. Quietly." },
  { id: "chime", name: "spoon wind-chime", cost: 6, value: 5, blurb: "Rings like a very small cathedral.", louis: "Kinetic sound-sculpture; the wind is the co-author. Exquisite attribution." },
  { id: "marble", name: "glass-stopper marble", cost: 4, value: 3, blurb: "A green sky you can hold.", louis: "A captured horizon in a bottle's final breath. Every collector's first obsession." },
  { id: "dragonfly", name: "wire dragonfly", cost: 5, value: 5, blurb: "Wings of flattened can, gone shimmering.", louis: "Gestural line against negative space. Calder would have looked twice." },
  { id: "diorama", name: "matchbox diorama", cost: 6, value: 6, blurb: "A whole street, one drawer wide.", louis: "A city compressed into a drawer: scale as a moral statement. I want it on my wall." },
  { id: "badger", name: "bottle-top badger", cost: 7, value: 7, blurb: "Stern, shiny and slightly smug.", louis: "The badger as brutalist icon. I did the provenance paperwork before you asked." },
];
export const TRINKET_BY_ID: Record<string, Trinket> = Object.fromEntries(TRINKETS.map((t) => [t.id, t]));
export const SET_BONUS = 25;

/** Pieces it takes to assemble one found-object artwork. */
export const ART_COST = 6;

const ADJ = ["Quiet", "Restless", "Borrowed", "Second-hand", "Luminous", "Dented", "Patient", "Unfinished", "Tender", "Stubborn"];
const NOUN = ["Chandelier", "Hymn", "Weather", "Tide", "Lantern", "Argument", "Orchard", "Procession", "Mosaic", "Return"];
export const artTitle = (a: number, n: number): string => `${ADJ[a % ADJ.length]} ${NOUN[n % NOUN.length]}`;

/** Louis's tiers, from polite to ecstatic. Quality 0..1 picks the line; the multiplier drives the price. */
const VERDICT = [
  "Competent. Earnest. The gallery's back room will adopt it, politely.",
  "There is a thesis here, shy but present. I would hang it low, near the door.",
  "The negative space does the heavy lifting. A stronger statement than most of last season.",
  "A masterclass in material honesty; the aluminium confesses everything. Hang it centre wall.",
  "Transcendent. I have cleared the east wall. Christa must see it, I did the labels first.",
];
export const verdictFor = (q: number): string => VERDICT[Math.min(VERDICT.length - 1, Math.floor(q * VERDICT.length))];

export interface ArtPiece { title: string; cans: number; bottles: number; q: number; price: number }
