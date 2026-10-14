import type { Character } from "../entities/types";

/**
 * The town swears. Every spoken line passes through here, and how foul it comes out depends on who's talking:
 * hot-heads, the angry, the scared, the hurt and the rougher trades swear a lot; kind, calm people barely do.
 * Swearing is never bleeped or starred out anywhere in the game. No slurs, ever: only the words below.
 */

/** 0..1: how likely this person is to swear in a given line. */
export function foulness(c: Character): number {
  const p = c.pers, e = c.emo;
  let f = 0.12 + p.temper * 0.35 + (1 - p.kindness) * 0.25 + p.boldness * 0.1;
  if (e.frustration > 0.5) f += 0.3;
  if (e.fear > 0.5) f += 0.2;
  if (c.phys !== 0 || e.composure < 0.4) f += 0.2;
  if (ROUGH.has(c.role)) f += 0.15;
  if (GENTLE.has(c.role)) f -= 0.15;
  return Math.max(0.03, Math.min(0.9, f));
}

const ROUGH = new Set<string>(["mobster", "thief", "smuggler", "mechanic", "chef", "bouncer", "taxi", "driver", "graffiti", "skater", "comic", "car_enthusiast", "villain", "gambler"]);
const GENTLE = new Set<string>(["medic", "barista", "tourist", "zookeeper", "shopkeeper"]);

const OPENERS = ["Fuck, ", "Shit, ", "Oh for fuck's sake, ", "Bloody hell, ", "Fuck me, ", "Jesus Christ, ", "Holy shit, ", "Bugger me, "];
const ANGRY_OPENERS = ["Fuck off, ", "Oh piss off, ", "For fuck's sake, ", "Are you fucking kidding me? "];
const CLOSERS = [". Fucking hell.", ", I swear to fuck.", ". No bullshit.", ", no fucking joke.", ". Shit, man."];
const ANGRY_CLOSERS = [", for fuck's sake.", ". Fuck this.", ", fucking hell."];

const COMMON = new Set(("oh hey hi the this that these those no yes yeah nah yep what why who where when how is are was were did do does " +
  "can can't don't won't you we they it it's my your our his her their got check big true facts always vibes ha sup for kia " +
  "just so not never maybe well look listen mate bro man right ok okay go come get let let's there here then if all any some " +
  "everyone someone nobody nothing something again still stop wait thanks cheers good great nice cool sweet chur classic seriously " +
  "same love hate want need had have has be been being one two a an and but or of on in at to with from up down out off over").split(/\s+/));

/** Maybe swear up a line. `roll` returns 0..1 (the sim's seeded rng, so runs stay deterministic). */
export function swear(text: string, c: Character, roll: () => number): string {
  if (!text || text === "..." || roll() > foulness(c)) return text;
  const angry = c.emo.frustration > 0.5;
  const kind = roll();
  // swear inside the sentence: "really good" -> "fucking good", "my foam sword" -> "my fucking foam sword"
  if (kind < 0.5) {
    const out = text.replace(/\b(really|very|so|pretty|super|totally)\b/i, (m) => (m[0] === m[0].toUpperCase() ? "Fucking" : "fucking"));
    if (out !== text) return out;
    const out2 = text.replace(/\bWhat\b(?! the)/, "What the fuck");
    if (out2 !== text) return out2;
    const out3 = text.replace(/\b(my|the|this|that|your|his|her|our|their) (?=[a-z]{3,})(?!fucking)/i, (m) => m + "fucking ");
    if (out3 !== text) return out3;
  }
  // a swear on the end of a statement
  if (kind < 0.7 && /[.!]$/.test(text) && text.length < 90 && text.length > 14) {
    const pool = angry ? ANGRY_CLOSERS : CLOSERS;
    return text.replace(/[.!]$/, "") + pool[Math.floor(roll() * pool.length)];
  }
  // a swear up front
  const pool = angry ? ANGRY_OPENERS : OPENERS;
  const pick = pool[Math.floor(roll() * pool.length)];
  // lower-case the old first word only when it's an ordinary word, never a name ("Grain smiled" stays "Grain")
  const first = /^[A-Za-z']+/.exec(text)?.[0] ?? "";
  const lower = !pick.endsWith("? ") && COMMON.has(first.toLowerCase()) && first !== "I" && !first.startsWith("I'");
  return pick + (lower ? text[0].toLowerCase() + text.slice(1) : text);
}
