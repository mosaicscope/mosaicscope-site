# Lore notes 3: clue exchange drafts

These are first drafts of the exchanges that carry the clues from `02-acts-clues-endings.md`. They are written in the engine's format (`id`, `tags`, `lines`) so they can be copied into a pack, but **nothing here is wired into the game yet**. Each draft must pass the same checks as the other packs before it ships:

- valid tags only (see `scripts/merge-dialogue.ts`)
- 2 to 4 lines, each 80 characters or fewer, after placeholders are counted as 8 characters
- no line repeated anywhere in the pool, compared lowercase and trimmed
- ids unique across the pool

The clue tags are new. They use a `clue:` family that the engine does not read yet. They are shown in the drafts so the writers can see where each clue sits. Until the engine supports them, the exchanges should be held out of the pool. Drafts marked `(Act 1)`, `(Act 2)` or `(Act 3)` follow the scene numbers in the clue notes.

Tone: short, dry, a little funny, and never certain. Nobody in these drafts explains the story. They only add a piece.

## Act 1: gossip

```ts
// (Act 1, scene 1.1) the cones, on the bridge
{ id: "clue_cones_pattern", tags: ["a:local", "b:local", "day", "@street"], lines: [
  "Cones are in a different shape again. Spiral this time.",
  "Council's doing art now?",
  "Or someone's doing a very slow Council meeting."] },

{ id: "clue_cones_survey", tags: ["a:office", "b:local", "day"], lines: [
  "We're doing a survey on the cones.",
  "Who's answering the survey?",
  "Only the cones. Very honest about the bridge."] },
```

```ts
// (Act 1, scene 1.2) the freeze, the busker's forecast
{ id: "clue_freeze_forecast", tags: ["a:busker", "b:local", "@plaza", "clear"], lines: [
  "Ice is coming to the Avon. Three days early.",
  "The weather people say it's sunny.",
  "The weather people are always last to know."] },

{ id: "clue_freeze_feed", tags: ["a:local", "b:local", "night"], lines: [
  "Terrance posted about the ice before the busker did.",
  "Terrance doesn't post. Terrance gets posted at.",
  "Then who's feeding Terrance?"] },
```

```ts
// (Act 1, scene 1.3) the signal and the cones
{ id: "clue_signal_cones", tags: ["a:taxi", "b:taxi", "night", "clear"], lines: [
  "Kiwi-signal's up. Cones moved again, I bet.",
  "They always move the night the signal goes.",
  "Nobody's ever said that out loud. Until now."] },

{ id: "clue_signal_lift", tags: ["a:taxi", "b:driver", "night"], lines: [
  "Bryce is going to need a lift tonight.",
  "A lift to where? He flies.",
  "He takes the scooter when he's being responsible."] },
```

```ts
// (Act 1, scene 1.4) the tab at Two Pies
{ id: "clue_tab_pen", tags: ["a:mobster", "b:thief", "@food"], lines: [
  "Gina's ledger is in pen. Permanent.",
  "Permanent what?",
  "Permanent record. Like a tattoo but for your wages."] },

{ id: "clue_tab_ruby", tags: ["a:thief", "b:mobster", "@food", "a:broke"], lines: [
  "I know exactly what I owe the Famiglia.",
  "To the cent?",
  "To the cent, and to the pie. The pie's the interest."] },
```

```ts
// (Act 1, scene 1.5) Kevin eats the paper
{ id: "clue_zoo_paper", tags: ["a:zookeeper", "b:local", "@park", "day"], lines: [
  "Kevin ate the office paper again. All of it.",
  "Anything important on it?",
  "Numbers. He's got opinions about numbers."] },

{ id: "clue_zoo_numbers", tags: ["a:local", "b:zookeeper", "@park"], lines: [
  "How many numbers has Kevin eaten this month?",
  "Hard to say. He doesn't leave receipts.",
  "Then he's the only honest one in the Council."] },
```

```ts
// (Act 1, scene 1.6) the hubcaps
{ id: "clue_hubcaps_bridge", tags: ["a:car_enthusiast", "b:mobster", "@street"], lines: [
  "Hubcaps are gone from every car near the bridge.",
  "Riccarton Boys again?",
  "Same cars, every time the signal goes. Think about it."] },
```

## Act 2: pieces

```ts
// (Act 2, scene 2.1) Tiles and Glitter on the Plaza
{ id: "clue_glitter_ledger", tags: ["a:friends", "b:friends", "morning", "@plaza"], lines: [
  "The cones are a Council stunt, Glitter. Obviously.",
  "Somebody's paying for them. I've seen the receipts.",
  "Whose receipts? The Council doesn't keep receipts."] },

{ id: "clue_glitter_someone", tags: ["a:local", "b:local", "day", "a:scared"], lines: [
  "Do you know who's paying for the cones?",
  "Someone with a ledger. That's all I'll say.",
  "That's not an answer. That's a threat with a font."] },
```

```ts
// (Act 2, scene 2.2) Bryce's cat
{ id: "clue_bryce_cat", tags: ["a:local", "b:local", "night", "clear"], lines: [
  "The signal's not about the cones, Bryce says.",
  "Then what's it about?",
  "A cat. A very lost cat. He's sure of it."] },

{ id: "clue_bryce_zoo", tags: ["a:taxi", "b:zookeeper", "night", "@park"], lines: [
  "Saw Bryce at the zoo last night. Late.",
  "Checking on Kevin, probably.",
  "He was wearing a cape and carrying a clipboard."] },
```

```ts
// (Act 2, scene 2.3) the scratched car at the garage
{ id: "clue_garage_scratch", tags: ["a:mechanic", "b:mobster", "@dealership", "day"], lines: [
  "The Don's car's been scratched. Someone who knows it.",
  "Someone who knows it how well?",
  "Someone who's been inside the garage. Lots of times."] },

{ id: "clue_garage_quake", tags: ["a:mechanic", "b:mobster"], lines: [
  "Quakenstein's been fixing the Don's car, right?",
  "In return for something. He won't say what.",
  "He's a scientist. He pays in experiments."] },
```

```ts
// (Act 2, scene 2.4) the survey paper
{ id: "clue_survey_ledger", tags: ["a:office", "b:zookeeper", "@park"], lines: [
  "The survey paper Kevin ate was the cone survey.",
  "And the cone survey is in the Famiglia's ledger?",
  "Same paper. Same pen. Same bad handwriting."] },
```

```ts
// (Act 2, scene 2.5) Nova in the Studio, rain
{ id: "clue_studio_dawn", tags: ["a:calm", "b:local", "rain", "@studio"], lines: [
  "Saw someone on the bridge at dawn with a box of cones.",
  "Who?",
  "I'm not sure. I'm not going to say until I am."] },
```

> Note: `a:calm` is not a valid mood in the current tag set. Use `a:tired` or `a:bored` in the real pack, or add `calm` to the mood list in the merge script first. This is a known gap in these drafts.

```ts
// (Act 2, scene 2.6) the power and the signal
{ id: "clue_stage_power", tags: ["a:local", "b:bando", "night", "@stage"], lines: [
  "The boombox is going to cut out at midnight.",
  "How do you know?",
  "Same time the signal went up last time. Same circuit."] },

{ id: "clue_stage_static", tags: ["a:local", "b:local", "night", "@stage"], lines: [
  "Static says the power goes when the signal goes.",
  "Static says a lot of things when the music's off.",
  "He's right about this one, though. I checked."] },
```

## Act 3: who

These are the late exchanges. They should only be reachable after the player has heard at least three clues from Act 2.

```ts
// (Act 3, scene 3.1) the ledger's blank line
{ id: "clue_ledger_blank", tags: ["a:mobster", "b:thief", "@casino", "after:casino_win"], lines: [
  "Gina showed me the ledger. Nine pages of names.",
  "And the tenth?",
  "Blank. With a date and an amount. Nobody's name on it."] },
```

```ts
// (Act 3, scene 3.2) Kodak's photos and the clerk
{ id: "clue_clerk_photo", tags: ["a:photographer", "b:local", "@street", "morning"], lines: [
  "My photos show someone placing the cones at dawn.",
  "A clerk? With a clipboard?",
  "A clerk with a schedule. Nobody's asked him why."] },
```

```ts
// (Act 3, scene 3.3) Quakenstein's confession
{ id: "clue_quake_jar", tags: ["a:scientist", "b:local", "@street", "evening"], lines: [
  "The freeze was never a real plan, was it?",
  "It was a jar. A small one. The Council wanted a threat.",
  "So I wrote them one. I'm very sorry about the bridge."] },
```

> Note: `a:scientist` is also not a valid role in the current set. It is a placeholder for Quakenstein's role. Use `a:villain` (Quakenstein is tagged `villain` in the existing packs) or add `scientist` to the roles list.

```ts
// (Act 3, scene 3.4) Bryce admits the signal's purpose
{ id: "clue_bryce_truth", tags: ["a:vigilante", "b:local", "night", "clear"], lines: [
  "The signal goes up when the Council's payments are late.",
  "Because the cones start moving?",
  "Because someone has to stop them. I just don't know who."] },
```

```ts
// (Act 3, scene 3.5) the tab closes
{ id: "clue_tab_closes", tags: ["a:thief", "b:mobster", "@food", "evening"], lines: [
  "Gina wrote the last line. The debt's paid.",
  "So the interest stops?",
  "The interest stops. The pies don't. Sal's very upset."] },
```

## Filler that keeps the clues from standing out

A clue sits better when it has neighbours that are only texture. These drafts are plain chatter with no clue in them, to be mixed into the same places.

```ts
{ id: "texture_plaza_bench", tags: ["a:local", "b:local", "day", "@plaza"], lines: [
  "The new bench is very comfortable.",
  "Is that the one from the consultation?",
  "It's the one that survived the consultation."] },

{ id: "texture_park_dog", tags: ["a:local", "b:lux", "morning", "@park"], lines: [
  "Lux's dog has learned to open the gate.",
  "Is that good or bad?",
  "Depends who's on the other side of it."] },
```

> Note: `b:lux` is not a valid tag, because Lux is a named Mosaic, not a role. Use `b:local` in the real pack. These drafts keep the name to show who the line is about.

## Checks before any of this ships

1. Fix the three invalid tags above (`a:calm`, `a:scientist`, `b:lux`) and any `b:bando` or `a:friends` mistakes, since `friends` is a relation tag, not a role.
2. Run the drafts through the merge-script rules.
3. Check that each clue appears in at least two places, so the player can miss one.
4. Make sure no clue line repeats a line already in `life.ts` or `lore.ts`.
5. Hold the whole set out of the pool until the clue memory exists in the engine.
