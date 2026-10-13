/**
 * Velvet Heist Night: a three-act mission run by the crew.
 * Pure state machine: no DOM, no simulation access. The UI in ui/Heist.ts drives it
 * and reads the result; the world is never changed here.
 */

export type Act = "gossip" | "heist" | "getaway" | "ending";
export type Ending = "clean" | "messy" | "busted";

export interface Choice {
  id: string;
  label: string;
  /** one-line consequence shown after picking */
  says: string;
  /** adds to the crew's stats: trust is the Famiglia's, heat is police attention, romance is the gossip fallout */
  effect: Partial<Record<"trust" | "heat" | "romance" | "loot", number>>;
}

export interface Scene {
  act: Act;
  title: string;
  text: string;
  choices: Choice[];
}

export interface HeistState {
  act: Act;
  /** scenes already played, in order: each entry is the chosen choice id */
  picks: string[];
  trust: number;
  heat: number;
  romance: number;
  loot: number;
  /** set once the mission is over */
  ending?: Ending;
}

/** Each act has a fixed scene in this first version. Choices move the stats. */
const SCENES: Record<Exclude<Act, "ending">, Scene> = {
  gossip: {
    act: "gossip",
    title: "Act 1: The rumour",
    text: "Sir Ponsonby's gala guest list is short and the bouncers are touchy. Tiles wants a distraction that pulls the Velvet models off the door.",
    choices: [
      { id: "rumour_model", label: "Whisper that a Velvet model is secretly dating a Famiglia man", says: "The rumour spreads. The models flock to the gossip, and so do the bouncers.", effect: { romance: -1, heat: 0, loot: 0, trust: 0 } },
      { id: "rumour_roast", label: "Get Roastie Malone to heckle the guard", says: "Roastie's heckle sends the guard across the room. Nobody gets hurt, and the crowd loves it.", effect: { trust: 1, heat: 0, romance: 0, loot: 0 } },
      { id: "rumour_none", label: "Skip the rumour and walk straight in", says: "No distraction. Bold, and the door staff notice you.", effect: { heat: 1, trust: 0, romance: 0, loot: 0 } },
    ],
  },
  heist: {
    act: "heist",
    title: "Act 2: The crate",
    text: "The Famiglia's crate is in the back room, next to Dr Quakenstein's lab, where one of the experiments has gone wrong. The Night Kiwi can get in over the rooftops, or through the front.",
    choices: [
      { id: "rooftops", label: "Sneak over the rooftops as the Night Kiwi", says: "Quiet, tagging a wall on the way in. The cleaners barely notice.", effect: { heat: 0, loot: 1, trust: 0, romance: 0 } },
      { id: "lab", label: "Use the mutated toy to distract the lab guard", says: "The toy goes off in the lab. Everyone is staring at the wrong thing.", effect: { heat: 1, loot: 1, trust: 0, romance: 0 } },
      { id: "front", label: "Walk through the front with a fake clipboard", says: "It works, until the lift jams and someone starts filming.", effect: { heat: 2, loot: 1, trust: 0, romance: 0 } },
    ],
  },
  getaway: {
    act: "getaway",
    title: "Act 3: The getaway",
    text: "The crate is in the boot. The police helicopter has its searchlight on. You need a car, or a shortcut over the river.",
    choices: [
      { id: "velvet_car", label: "Drive off in a stolen Velvet car", says: "Fast and loud, with the searchlight on your roof the whole way.", effect: { heat: 1, loot: 0, trust: 0, romance: 0 } },
      { id: "gondola", label: "Take the ski bunny gondola over the river", says: "A silent escape. The ski bunnies cheer and take a photo.", effect: { heat: 0, loot: 0, trust: 1, romance: 0 } },
      { id: "on_foot", label: "Run on foot and split up", says: "The crew scatters. It is harder to catch everyone, and harder to regroup.", effect: { heat: 0, loot: 0, trust: -1, romance: 0 } },
    ],
  },
};

export function newHeist(): HeistState {
  return { act: "gossip", picks: [], trust: 0, heat: 0, romance: 0, loot: 0 };
}

/** The scene the player should see now, or undefined once the mission is over. */
export function currentScene(s: HeistState): Scene | undefined {
  return s.act === "ending" ? undefined : SCENES[s.act];
}

/** Apply a choice to the current act and move on. Unknown choices are ignored. */
export function choose(s: HeistState, choiceId: string): HeistState {
  const scene = currentScene(s);
  const choice = scene?.choices.find((c) => c.id === choiceId);
  if (!scene || !choice) return s;
  const next: HeistState = {
    ...s,
    picks: [...s.picks, choice.id],
    trust: s.trust + (choice.effect.trust ?? 0),
    heat: s.heat + (choice.effect.heat ?? 0),
    romance: s.romance + (choice.effect.romance ?? 0),
    loot: s.loot + (choice.effect.loot ?? 0),
  };
  if (scene.act === "gossip") return { ...next, act: "heist" };
  if (scene.act === "heist") return { ...next, act: "getaway" };
  return finish(next);
}

/**
 * How the night ends. Busted if the heat is high. Messy if the crate was missed or the
 * crew is short on trust. Clean otherwise.
 */
export function finish(s: HeistState): HeistState {
  const ending: Ending = s.heat >= 4 ? "busted" : s.loot < 1 || s.trust < 0 ? "messy" : "clean";
  return { ...s, act: "ending", ending };
}

export const ENDING_TEXT: Record<Ending, string> = {
  clean: "Clean getaway. The crew splits the cash at the bar and Kodak pins your photo to the wall.",
  messy: "Messy. You got the crate, or most of it, but the crew is arguing over who lost what.",
  busted: "Busted, sort of. The police chase ends at the gondola, and everyone is on the front page of the gossip sheet.",
};
