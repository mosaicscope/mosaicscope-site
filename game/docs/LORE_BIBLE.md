# Lore bible: the Avon freeze

A working draft of the city's central story and how it reaches the player. It uses names already in the game (see `src/dialogue/packs/life.ts`, `src/content/cast.ts`). The story is told in gossip, not exposition: nobody explains it, and each person only knows their own corner.

## The tale in one breath

Dr Quakenstein has promised to freeze the Avon. Nobody agrees on why. The Council is paying a ransom in road cones. Bryce's kiwi-signal goes up over the Port Hills, and the Famiglia keeps a tab on everyone who owes them. Under all of it is one question the city keeps asking without knowing it: who is actually running this town, and do they know what they're doing?

## Threads

Each thread has a face in the city, a place it lives, and a clue the player can pick up.

| Thread | Who carries it | Where it lives | Clue the player can find |
|---|---|---|---|
| **The cones** | Quakenstein; the Council | Streets, the Avon bridge | Cones keep turning up on the same bridge, arranged in a pattern |
| **The freeze** | Quakenstein; a busker on the Bridge of Remembrance | Plaza, the river | A busker says the ice is coming before the forecast does |
| **The signal** | Bryce | Port Hills, Cathedral Square, taxi ranks | The kiwi-signal goes up on nights the cones move |
| **The tab** | Gina, Sal, Nico, Vito | Two Pies, the casino, the Don's garage | Gina's pen ledger names everyone who owes, and one name is missing |
| **The zoo** | Kevin the giraffe; the Velvet Zoo keeper | Velvet Zoo, Cathedral Square mural | Kevin keeps eating paper with numbers on it |
| **The Pukeko** | The car crowd; the Riccarton Boys | Moorhouse yards, the Pink Pukeko | Hubcaps are going missing, and they all turn up on Moorhouse |

## Three acts

Each act is a set of exchanges. The player can move through them in any order, but the later ones only make sense after the earlier ones have been seen.

**Act 1: Gossip.** Every thread shows up as a rumour between two strangers or friends. Nothing is confirmed. Tags: `day`, `night`, `@street`, `@food`, `a:local`, `a:taxi`.

**Act 2: Pieces.** Characters start to disagree. The cones are a ransom, or a prank, or a survey. Bryce says it was a cat. Gina says the ledger is complete. Tags add roles and moods: `a:scared`, `a:angry`, `b:mobster`, `a:cop`.

**Act 3: Who.** The one missing name in Gina's ledger is the answer: whoever is paying the Council's ransom in cones. Late exchanges let the player connect the threads. Tags: `after:crime`, `after:arrest`, `wanted`.

## How the player finds it

The player should never be told the answer, but should always be able to reach it.

1. Each clue is a plain exchange. It stays in the pool of normal chatter, so it never looks like a quest.
2. A clue is "found" when the player hears it. This needs a memory the engine doesn't have yet: a per-save set of clue IDs, written when a clue plays and read by later exchanges. That is the main engineering piece.
3. Each act can be reached from at least two directions, so one missed conversation doesn't block the story.
4. Nothing requires the player to be in a specific place at a specific time to make progress. Clues repeat on a schedule through the day and the weather.

## Characters and their mini-stories

Each character gets one small story that is shown across three or four exchanges, not all at once. Stories are tied to a character through their name tag or role.

- **Quakenstein**: a scientist who doesn't think he's a villain. He's shown with a plan he's proud of and an obvious, harmless flaw.
- **Bryce**: a self-employed superhero who files his tax return and worries about the cape being deductible.
- **Kevin**: a giraffe with no taste and total commitment. He is the only character who knows where the numbers went.
- **Gina**: writes everything in pen. Her ledger is the single source of truth, and she knows it.
- **Sal**: the mince pie. The debt is real, the pies are the interest, and nobody remembers the original loan.
- **The Pink Pukeko**: a car nobody wants and everyone talks about. It's the city's running joke about things that never get sold.

## Integration points

- **`src/dialogue/packs/life.ts`**: the existing lore already covers Quakenstein, Bryce, Kevin, the Famiglia and the Pukeko. Acts 1 and 2 are mostly here, once it is wired in (PR #105).
- **`src/dialogue/packs/lore.ts`**: the 19 new exchanges (PR #103). They are Act 1 and set the tone.
- **New pack (Act 2 and 3)**: needs the clue tags. Clue IDs should go in a new `clue:<id>` tag family, checked by the engine against the save.
- **Clue memory**: a small addition to the dialogue engine and the save system (`src/persistence/SaveSystem.ts`). See ADR 0007 for how saves work.

## Open questions

- Who is paying the cones? The current plan is "the Don, through Gina", but the other writer may have a better answer.
- Should the freeze happen in the game, or stay as a rumour? If it happens, it needs a world event (`src/events/defs.ts`).
- How many clues does the player need before Act 3 unlocks? The draft says two, but this needs playtesting.
