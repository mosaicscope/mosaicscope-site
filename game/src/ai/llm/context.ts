// What a model is told before it picks. The system prompt explains the world once; each request then carries a
// short "who you are and what's happening" card for that character, plus the menu of goals the sim already allows.
// Everything here is read-only: the model can only choose a number, never change the world directly.

import type { Character } from "../../entities/types";
import type { Simulation } from "../../sim/Simulation";
import { moodWord } from "../needs";
import { LORE } from "../../content/lore";
import { repLine } from "../../sim/Rep";

export const WORLD_PROMPT = [
  "You are the mind of one character in \"The Mosaics: Our World\", a living, isometric stick-figure parody of central Christchurch, New Zealand.",
  "It's the hidden easter egg of MosaicScope, a Christchurch photographer's website. The Mosaics are a crew of ten: Tiles (the main guy), Glitter (his girl), Kodak, Nova, Grain, Ruby, Flash, Lux, Bando and Honey.",
  "Around them live about a hundred regulars and hundreds of locals. People have needs, moods, memories, friendships and grudges; they party at the boombox, gossip, fight with foam toys, hold grudges and make up, work, eat, shop and wander the city.",
  "Tone: playful, cheeky, Kiwi street-life comedy. Fights are with foam swords, pool noodles and balls, never real weapons.",
  "Each turn you get your character's card and a short numbered list of things they could do next. Pick what this person would most plausibly and entertainingly do, true to their personality, mood and history.",
  "Reply with only the number of your choice. No words, no punctuation.",
  "",
  "The story so far (stay consistent with it):",
  LORE,
].join("\n");

/** Readable labels for goal ids, so the model knows what each option actually means. */
export const GOAL_LABELS: Record<string, string> = {
  wander: "wander around and look about",
  routine: "get on with your usual routine for this time of day",
  home: "head back to your usual spot",
  socialize: "go and hang out with someone",
  gossip: "share some gossip",
  play: "play with a toy",
  collect: "go and pick up a toy",
  fight: "start a foam-toy fight",
  help: "go and help someone who's down",
  rest: "sit down and rest",
  watch: "watch what's going on",
  party: "join the party at the boombox",
  music: "put the music on and start a party",
  shelter: "get out of the weather",
  search: "look for something you lost",
  reclaim: "take back something that's yours",
  gift: "give someone a gift",
  reconcile: "make up with someone you fell out with",
  craft: "make something",
  prank: "pull a prank",
  ballgame: "start a ball game",
  eat: "go and get something to eat",
  work: "go to work",
  gohome: "go home",
  shop: "go shopping",
  gamble: "go and gamble",
  steal: "nick something (crime, risky)",
  mug: "mug someone (crime, very risky)",
  flirt: "flirt with someone",
  date: "go on a date",
  follow: "follow someone",
  treat: "patch someone up",
  escape: "get away from here",
  tag: "tag a wall with graffiti",
  clean: "clean up graffiti",
  turf: "defend your turf",
  patrol: "patrol the area",
  pursue: "chase someone down",
  book: "book a photoshoot",
  attend: "turn up for an appointment",
  photograph: "take photos",
  carmeet: "go to the car meet",
  skate: "go skating",
  busk: "busk for coins",
  vend: "sell from a stall",
  barter: "do a trade",
};

const word = (v: number, lo: string, hi: string) => (v < 0.33 ? lo : v > 0.66 ? hi : "");

/** One option's line: the readable label, plus who it's aimed at when there is a target. */
export function goalLabel(id: string, sim: Simulation, target: number): string {
  const label = GOAL_LABELS[id] ?? id;
  const who = target >= 0 ? sim.chars[target]?.name : undefined;
  return who ? `${label} (with ${who})` : label;
}

/** A short card describing this character and their situation right now. Kept under ~120 words. */
export function characterCard(c: Character, sim: Simulation): string {
  const p = c.pers;
  const traits = [
    word(p.boldness, "timid", "bold"), word(p.kindness, "a bit mean", "kind"), word(p.temper, "calm", "hot-headed"),
    word(p.sociability, "a loner", "a social butterfly"), word(p.playfulness, "serious", "playful"), word(p.honesty, "a bit of a liar", "honest"),
  ].filter(Boolean);
  const n = c.needs;
  const lows = [n.energy < 0.3 && "tired", n.social < 0.3 && "lonely", n.fun < 0.3 && "bored", c.hunger < 0.3 && "hungry"].filter(Boolean);
  const hh = Math.floor(sim.hour), mm = Math.floor((sim.hour - hh) * 60);
  const area = sim.world.areaAt(c.x, c.y);
  const env = [sim.env.raining ? "raining" : "dry", sim.isDark ? "dark" : "daylight", sim.env.party ? "a party is on at the boombox" : ""].filter(Boolean);

  // the people this character feels most strongly about, by name
  const ties: string[] = [];
  for (const [id, r] of c.rel) {
    const o = sim.chars[id];
    if (!o) continue;
    if ((r.love ?? 0) > 0.5) ties.push(`${o.name} (crush)`);
    else if (r.aff > 0.5) ties.push(`${o.name} (close)`);
    else if (r.grudge + r.rivalry > 0.5) ties.push(`${o.name} (grudge)`);
    if (ties.length >= 4) break;
  }

  const lines = [
    `You are ${c.name}${c.nickname && c.nickname !== c.name ? ` ("${c.nickname}")` : ""}.${c.bio ? " " + c.bio : ""}`,
    traits.length ? `Personality: ${traits.join(", ")}.` : "",
    `Right now you feel ${moodWord(c)}${lows.length ? ` and ${lows.join(", ")}` : ""}.`,
    `It's ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}, ${env.join(", ")}. You're at ${area?.name ?? "the street"}.`,
    ties.length ? `People who matter to you: ${ties.join(", ")}.` : "",
    repLine(c, sim),
  ];
  return lines.filter(Boolean).join("\n");
}
