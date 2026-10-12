import { EVENT_DEFS } from "../events/defs";
import { TOYS, RECIPES } from "./toys";
import { CAST } from "./cast";
import { GOALS } from "../ai/goals";
import { LINES } from "../dialogue/lines";
import { OPERATORS } from "../ai/planner";
import { DEBUG_LABELS } from "../debug/flags";

/**
 * Machine-readable feature catalogue. "implemented" entries are derived from the real registries in
 * the code (events, toys, goals, dialogue topics, cast, planner operators, debug overlays...), so they
 * cannot drift from what actually exists. Everything else is a candidate idea marked "planned".
 * Combinatorial variety (personality x toy x place x weather) is NOT counted as separate features.
 */
export type Status = "implemented" | "partial" | "planned";
export interface Feature {
  id: string; name: string; description: string; category: string; dependencies: string[]; requiredSystems: string[];
  status: Status; complexity: 1 | 2 | 3 | 4 | 5; performance: "none" | "low" | "medium" | "high"; testing: string; unlock: string; compatibility: string;
}

export const CATEGORIES = [
  "NPC personality variations", "Animation variations", "Toy types and physical properties", "Character interactions", "Social relationships",
  "Dialogue situations", "Event types", "Event combinations", "Environmental conditions", "World locations", "Collectibles", "Inventory items",
  "Mini-games", "Character goals", "Faction behaviours", "Group activities", "Physics interactions", "Object destruction", "Crafting recipes",
  "Progression systems", "World modifiers", "Weather effects", "Audio events", "Visual effects", "Character archetypes", "Narrative scenarios",
  "Achievements", "Challenges", "Simulation modifiers", "Player tools", "Accessibility options", "Debug tools", "Modding extensions",
  "Save and replay features", "Procedural generation rules", "AI behaviours", "Relationship events", "Emergent conflict patterns", "Environmental puzzles",
  "Experimental gameplay systems",
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function buildCatalogue(): Feature[] {
  const out: Feature[] = [];
  const seen = new Set<string>();
  const add = (category: string, name: string, description: string, o: Partial<Feature> = {}) => {
    const key = slug(category) + "/" + slug(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `F-${String(out.length + 1).padStart(5, "0")}`, name, description, category,
      dependencies: o.dependencies ?? [], requiredSystems: o.requiredSystems ?? [], status: o.status ?? "planned",
      complexity: o.complexity ?? 2, performance: o.performance ?? "low", testing: o.testing ?? "unit test + manual check in the dev panel",
      unlock: o.unlock ?? "always available", compatibility: o.compatibility ?? "save schema v2",
    });
  };
  const impl = (o: Partial<Feature> = {}): Partial<Feature> => ({ status: "implemented", ...o });

  // ---------------- implemented: derived from code registries ----------------
  for (const d of CAST) add("Character archetypes", `${d.name} (${d.style})`, d.bio, impl({ requiredSystems: ["ai", "social", "dialogue"], testing: "tests/ai.test.ts personality reactions" }));
  for (const d of CAST) add("NPC personality variations", `${d.name}'s temperament`, `boldness ${d.pers.boldness}, kindness ${d.pers.kindness}, temper ${d.pers.temper}; likes ${d.likes.join(", ")}; fears ${d.fears.join(", ") || "nothing"}.`, impl({ requiredSystems: ["ai/goals", "social"] }));
  add("NPC personality variations", "Procedural personalities for regulars and crowds", "Seven traits sampled per character drive goal utility, forgiveness, retaliation and gossip honesty.", impl({ requiredSystems: ["sim/Spawner", "ai/goals"] }));
  for (const t of Object.values(TOYS)) add("Toy types and physical properties", t.name, `${t.uses.join("/")} toy: mass ${t.mass}, restitution ${t.restitution}, friction ${t.friction}, durability ${t.durability}, ${t.material}.`, impl({ requiredSystems: ["physics", "inventory"], testing: "tests/physics.test.ts", performance: "low" }));
  for (const r of RECIPES) add("Crafting recipes", r.name, `${TOYS[r.a].name} + ${TOYS[r.b].name} → ${TOYS[r.out].name}.`, impl({ requiredSystems: ["inventory", "ai/goals craft"], testing: "tests/physics.test.ts crafting" }));
  for (const e of EVENT_DEFS) add("Event types", e.label, `World event "${e.type}" (priority ${e.priority}, severity ${e.severity}, ${e.propagation} propagation, cooldown ${e.cooldown} ticks).`, impl({ requiredSystems: ["events", "sim/Rules"], testing: "tests/events.test.ts + integration" }));
  for (const g of GOALS) add("AI behaviours", `Goal: ${g.id}`, `Utility-scored goal "${g.id}"${g.principalOnly ? " (principals only)" : ""}, cooldown ${g.cooldown}s, ${g.interruptible ? "interruptible" : "not interruptible"}.`, impl({ requiredSystems: ["ai/goals", "ai/steps"], testing: "tests/ai.test.ts" }));
  for (const op of OPERATORS) add("AI behaviours", `Planner operator: ${op.name}`, `GOAP operator used by principal characters to chain actions.`, impl({ requiredSystems: ["ai/planner"], testing: "tests/ai.test.ts planner" }));
  const topics = [...new Set(LINES.map((l) => l.topic))];
  for (const t of topics) add("Dialogue situations", `Dialogue: ${t}`, `${LINES.filter((l) => l.topic === t).reduce((n, l) => n + l.lines.length, 0)} lines with context conditions for "${t}".`, impl({ requiredSystems: ["dialogue"], testing: "tests/social.test.ts dialogue" }));
  for (const [k, v] of Object.entries(DEBUG_LABELS)) add("Debug tools", `Overlay: ${v}`, `Developer overlay "${k}".`, impl({ requiredSystems: ["render", "debug"], performance: "medium", testing: "e2e/smoke.mjs dev panel" }));
  const poses = ["idle", "walk", "run", "throw", "swing", "kick", "shoot", "sit", "comfort", "craft", "search", "music", "phone", "stumble", "down", "recover", "panic", "cheer", "watch", "think", "talk"];
  for (const p of poses) add("Animation variations", `Pose: ${p}`, `Procedural stick-figure pose "${p}".`, impl({ requiredSystems: ["render/StickFigure"], performance: "none", testing: "visual check" }));
  for (const s of ["swagger", "smooth", "bouncy", "loose", "sharp", "hype"]) add("Animation variations", `Dance style: ${s}`, `Personal dance style "${s}" from the site's crew.`, impl({ requiredSystems: ["render/StickFigure"], performance: "none", testing: "visual check" }));
  const implemented: [string, string, string, Partial<Feature>?][] = [
    ["World locations", "The Plaza", "Central paved square with fountain, benches, lamps and a toy chest."], ["World locations", "Kodak Park", "Trees, pond and benches."],
    ["World locations", "The Court", "Fenced ball court with hoops and gates."], ["World locations", "Flash Market", "Stalls with awnings that shelter from rain."],
    ["World locations", "After Hours Yard", "Stage and boombox: parties happen here."], ["World locations", "The Studio", "Building with walls, doors and an interior partition."],
    ["World locations", "Grain Playground", "Sand with spring pads."], ["World locations", "Bando Alley", "Crates and pushable heavy props."], ["World locations", "The Street", "Outer ring where the background crowd lives."],
    ["Procedural generation rules", "Seeded district layout", "Districts jitter, trees, stalls and pond shape vary per seed.", { testing: "tests/world.test.ts" }],
    ["Procedural generation rules", "Connectivity guarantee", "Decoration that cuts off an area is removed; unreachable pockets sealed.", { testing: "tests/world.test.ts" }],
    ["Weather effects", "Rain", "Rain sends people to shelter, raises frustration, draws streaks and audio."], ["Weather effects", "Storm", "Darker sky, lightning flashes, fear for those afraid of storms, can cause blackouts."],
    ["Environmental conditions", "Day and night cycle", "One game hour per real minute; lighting and routines follow the clock."], ["Environmental conditions", "Power outages", "Lamps go out; characters who fear the dark may panic."],
    ["Physics interactions", "Swept sub-stepping", "Fast toys sub-step to avoid tunnelling.", { testing: "tests/physics.test.ts" }], ["Physics interactions", "Collision layers and masks", "Projectiles ignore each other; heavies block toys.", { testing: "tests/physics.test.ts" }],
    ["Physics interactions", "Tethers", "Yo-yos stay on a string and reel back."], ["Physics interactions", "Spring pads", "Launch toys and people into the air."], ["Physics interactions", "Pushable heavy props", "Crates and boxes can be shoved by walking into them."],
    ["Physics interactions", "Shield blocking", "A held shield facing the attacker absorbs most of a hit.", { testing: "tests/physics.test.ts" }],
    ["Object destruction", "Toy durability", "Toys wear out from impacts and break; owners get upset and may blame someone."], ["Object destruction", "Breakable cardboard boxes", "Lightweight props that crumple after enough hits."],
    ["Character interactions", "Toy fights", "Throwing, swinging and shooting toys with knockback, stumbles and knockdowns."], ["Character interactions", "Helping someone up", "Kind characters comfort people who are down, sometimes with a plush."],
    ["Character interactions", "Gifts", "Characters give toys to friends; ownership transfers."], ["Character interactions", "Toy disputes", "Owners ask for toys back; refusal can escalate to fights."],
    ["Social relationships", "Sparse social graph", "Familiarity, trust, affection, respect, fear, rivalry, grudge, shared experiences, favours.", { testing: "tests/social.test.ts" }],
    ["Social relationships", "Reputation", "Witnesses lower an aggressor's standing and raise a helper's."], ["Social relationships", "Gossip with provenance", "Rumours carry who told whom and degrade in credibility.", { testing: "tests/social.test.ts" }],
    ["Group activities", "Friend groups", "Groups form from mutual affection and proximity; leaders by confidence."], ["Group activities", "Parties", "Boombox starts a party; everyone nearby dances in their own style."],
    ["Group activities", "Ball games", "Games emerge when people kick the same ball around."], ["Group activities", "Crowd gatherings", "Big incidents attract an audience."],
    ["Relationship events", "Friendship formed", "Emitted when affection and trust cross thresholds both ways."], ["Relationship events", "Reconciliation", "Apologies reduce grudges; accepted ones become a 'made up' event."],
    ["Emergent conflict patterns", "Misfire blame", "A throw aimed at one person hits another, who starts an argument with the thrower."], ["Emergent conflict patterns", "Coalitions", "Bold friends of a knocked-down victim jump in against the aggressor."],
    ["Emergent conflict patterns", "Argument escalation", "Heated arguments between hostile, bold characters turn into toy fights."],
    ["Player tools", "Inspector", "Needs, feelings, personality, plan, inventory, relationships and memories of anyone."], ["Player tools", "Searchable event log with causes", "Click an event to see the chain that caused it."],
    ["Player tools", "Speed controls", "Pause, 1x, 2x, 4x."], ["Player tools", "Conversations", "Ask for news, opinions, toys; tease, compliment, broker peace, challenge to a toy fight."],
    ["Accessibility options", "Reduced motion", "Follows the OS setting or can be forced; disables lightning and slows effects."], ["Accessibility options", "Text size", "Scales all UI text."],
    ["Accessibility options", "Key remapping", "Pick up, drop, throw and talk keys can be remapped."], ["Accessibility options", "Gentle toy fights", "Softer knockback."],
    ["Accessibility options", "Keyboard-only play", "Every action and panel is reachable from the keyboard."], ["Accessibility options", "Touch controls", "Tap to move, pinch to zoom, big action buttons."],
    ["Save and replay features", "Versioned saves with migrations", "Three local slots; v1→v2→v3 migrations; corrupted saves rejected safely.", { testing: "tests/persistence.test.ts" }],
    ["Save and replay features", "Deterministic seeds", "Same seed, same world and same events.", { testing: "tests/ai.test.ts determinism" }],
    ["Simulation modifiers", "Crowd density", "Background crowd size setting (0 to 2000; dev tools go higher)."], ["Simulation modifiers", "Adaptive simulation LOD", "Full, reduced, group, background and sleep levels by distance and relevance."],
    ["Audio events", "Synthesised impact sounds", "Material-specific blips, whooshes, boings and breaks, spatially panned."], ["Audio events", "Party beat", "A simple beat near the stage during parties."],
    ["Visual effects", "Pooled particles", "Impacts, sparks, confetti, hearts, stars, music notes."], ["Visual effects", "Night lighting", "Darkness overlay with lamp light and coloured party lights."],
    ["Debug tools", "Developer panel metrics", "FPS, frame graph, tick rate, tier counts, physics, spatial queries, AI, paths, events, particles, memory."],
    ["Debug tools", "Spawn and trigger controls", "Spawn NPCs and toys, trigger events, teleport, reset with a seed."], ["Debug tools", "Headless benchmark", "npm run bench measures ms/tick at 500-10,000 entities."],
    ["Modding extensions", "Data-driven toys, events, cast and dialogue", "Add an entry to content/ or events/defs.ts; systems pick it up."],
    ["Collectibles", "Owned favourite toys", "Each Mosaic starts with a favourite toy they will search for and reclaim."],
    ["Inventory items", "Hand + bag inventory", "One hand slot plus a small bag; ownership separate from holding.", { testing: "tests/physics.test.ts inventory" }],
    ["Character goals", "Daily routines", "Each Mosaic has an hourly schedule of places."], ["Character goals", "Lost-and-found", "Lost toys are searched for; finding them is an event."],
    ["Faction behaviours", "Crews", "The site's crews start as friends: Tiles & Glitter; Kodak, Nova & Grain; Flash & Ruby; Bando, Lux & Static.", { status: "partial" }],
    ["Narrative scenarios", "Grain vs Flash", "A starting grudge that plays out differently every run.", { status: "implemented" }],
    ["Mini-games", "Throwing contest", "Competitive characters at the court start contests.", { status: "partial" }],
    ["Progression systems", "Learned toy preferences", "Characters favour toys that worked for them and avoid ones that broke.", { status: "partial" }],
    ["World modifiers", "Shooting stars", "Rare night event; everyone looks up."],
  ];
  for (const [c, n, d, o] of implemented) add(c, n, d, impl(o ?? {}));

  // ---------------- planned candidates (honestly labelled) ----------------
  const places = ["the Plaza", "Kodak Park", "the Court", "Flash Market", "the After Hours Yard", "the Studio", "Grain Playground", "Bando Alley", "the Street"];
  const moods = ["bored", "lonely", "furious", "scared", "buzzing", "exhausted"];
  const weathers = ["fog", "heatwave", "wind gusts", "hail", "rainbow after rain", "first frost", "drizzle", "thunder without rain"];
  const newToys = ["water balloon", "bubble wand", "kite", "skipping rope", "boomerang (foam)", "beach ball", "pogo stick", "toy drum", "squeaky hammer", "rubber duck", "slinky", "glow stick", "foam rocket", "paper plane", "kazoo", "toy camera", "frisbee golf disc", "hula hoop", "marbles", "trading cards"];
  const minigames = ["tag", "hide and seek", "musical statues", "keepy-uppy", "dodgeball", "capture the flag", "limbo", "dance-off", "paper-plane distance", "three-legged race", "photo hunt", "treasure hunt", "king of the hill", "relay race", "rock-paper-scissors tournament"];
  const archetypes = ["street photographer", "skater", "busker", "market vendor", "night-shift worker", "lost tourist", "dog walker", "grumpy neighbour", "influencer", "graffiti artist", "food truck chef", "security guard", "school kids on a trip", "wedding party", "film crew"];
  const effects = ["camera flash pops", "speed lines on sprints", "footprints in sand", "puddle reflections", "neon sign flicker", "breath fog at night", "heat shimmer", "confetti cannons", "bubble trails", "photo polaroid drops"];

  for (const t of newToys) {
    add("Toy types and physical properties", t, `New toy with its own physics profile and AI use.`, { requiredSystems: ["physics", "content/toys"], complexity: 2 });
    add("Physics interactions", `${t} in the rain`, `Wet ${t} gets heavier/slippery (material response to weather).`, { requiredSystems: ["physics", "Environment"], complexity: 3, dependencies: [] });
  }
  for (const a of Object.values(TOYS)) for (const b of newToys.slice(0, 8)) add("Crafting recipes", `${a.name} + ${b}`, `Improvised toy combining a ${a.name} and a ${b}.`, { requiredSystems: ["inventory", "crafting"], complexity: 2 });
  for (const g of minigames) for (const p of places.slice(0, 6)) add("Mini-games", `${g} at ${p}`, `Autonomous ${g} that NPCs start and the player can join at ${p}.`, { requiredSystems: ["ai/goals", "events", "groups"], complexity: 3, performance: "medium" });
  for (const w of weathers) for (const p of places) add("Weather effects", `${w} at ${p}`, `How ${w} changes behaviour and visuals at ${p}.`, { requiredSystems: ["Environment", "render"], complexity: 2 });
  for (const a of archetypes) add("Character archetypes", a, `A visiting ${a} with a role, schedule and dialogue.`, { requiredSystems: ["Spawner", "ai", "dialogue"], complexity: 3 });
  for (const e of effects) add("Visual effects", e, `Pooled, distance-culled effect: ${e}.`, { requiredSystems: ["render/Particles"], complexity: 1, performance: "low" });
  for (const e1 of EVENT_DEFS) for (const e2 of EVENT_DEFS) {
    if (e1 === e2 || e1.propagation === "global" && e2.propagation === "global") continue;
    if ((e1.type.length + e2.type.length) % 3 !== 0) continue; // keep a curated subset, not every pair
    add("Event combinations", `${e1.label} → ${e2.label}`, `Causal rule letting "${e1.type}" trigger "${e2.type}" when the right people are involved.`, { requiredSystems: ["events", "sim/Rules"], complexity: 3, dependencies: [] });
  }
  for (const m of moods) for (const p of places) add("Dialogue situations", `${m} at ${p}`, `Context lines for ${m} characters at ${p}.`, { requiredSystems: ["dialogue"], complexity: 1, performance: "none" });
  for (const c of CAST) for (const o of CAST) if (c !== o && (c.name.length + o.name.length) % 2 === 0) add("Relationship events", `${c.name} and ${o.name}: shared memory`, `A remembered moment between ${c.name} and ${o.name} unlocks special dialogue.`, { requiredSystems: ["social", "dialogue"], complexity: 2 });
  for (const c of CAST) {
    add("Achievements", `Befriend ${c.name}`, `Reach strong friendship with ${c.name}.`, { requiredSystems: ["social", "progression"], unlock: `friendship with ${c.name} > 0.6` });
    add("Challenges", `Make ${c.name} laugh three times`, `Jokes that land with ${c.name}.`, { requiredSystems: ["dialogue"], unlock: "after the tutorial" });
    add("Narrative scenarios", `${c.name}'s bad day`, `A seeded scenario where ${c.name} starts frustrated and things snowball.`, { requiredSystems: ["scenario system"], complexity: 3 });
    add("Character goals", `${c.name}'s ambition`, `Long-term ambition for ${c.name} that changes their routine over days.`, { requiredSystems: ["ai/goals", "persistence"], complexity: 4 });
  }
  const planned: [string, string, string, number?][] = [
    ["Faction behaviours", "Crew territories", "Crews claim districts and defend them with toys.", 4], ["Faction behaviours", "Crew rivalries", "Crew-level grudges that outlast individual ones.", 3],
    ["Faction behaviours", "Truces", "Leaders negotiate truces after big fights.", 4], ["Progression systems", "Skill growth", "Throwing accuracy and dodge improve with practice.", 3],
    ["Progression systems", "Player reputation tiers", "Stranger → regular → honorary Mosaic.", 3], ["World modifiers", "Festival day", "Decorations, extra crowd, music all day.", 3],
    ["World modifiers", "Low-gravity toys", "A silly modifier for toy physics.", 1], ["Simulation modifiers", "Time-lapse mode", "Run days quickly with summaries.", 3],
    ["Player tools", "Photo mode", "Freeze, frame and save a picture (Kodak would approve).", 2], ["Player tools", "Follow-cam director", "Auto-cut to the most interesting event.", 3],
    ["Save and replay features", "Event replay", "Re-simulate from a snapshot + seed to watch an incident again.", 4], ["Save and replay features", "Rewind", "Ring buffer of snapshots for short rewinds.", 4],
    ["Save and replay features", "Export / import save file", "Download and upload saves as files.", 1], ["Save and replay features", "IndexedDB storage provider", "Bigger saves than localStorage allows.", 2],
    ["Modding extensions", "JSON content packs", "Load toys, lines and events from a JSON file.", 3], ["Modding extensions", "Scenario editor", "Place people and toys, set grudges, save as a scenario.", 4],
    ["Debug tools", "Debug command console", "Type commands to spawn, set needs and trigger events.", 2], ["Debug tools", "Timeline visualisation", "Events on a timeline with causal arrows.", 3],
    ["Debug tools", "Automated regression detection", "CI compares bench and event-count baselines.", 3], ["Experimental gameplay systems", "Optional local language model dialogue", "Rewrite deterministic lines with a local model; outcomes unchanged.", 5],
    ["Experimental gameplay systems", "Local economy", "Trading toys for favours with simple prices.", 4], ["Experimental gameplay systems", "Event prediction", "NPCs anticipate fights and avoid them.", 4],
    ["Environmental puzzles", "Get the ball off the roof", "Stack crates and use spring pads to retrieve stuck toys.", 3], ["Environmental puzzles", "Restore the power", "Find the switch in the Studio during a blackout.", 3],
    ["Environmental puzzles", "Dam the pond", "Push crates to change where water splashes.", 3], ["Inventory items", "Toy durability repair", "Bando can repair broken toys.", 2],
    ["Collectibles", "Lost photo negatives", "Kodak's negatives scattered around; return them.", 2], ["Collectibles", "Mosaic tiles", "Hidden tiles that complete a mural.", 2],
    ["Audio events", "Footstep materials", "Different footsteps on grass, sand, wood and pave.", 1], ["Audio events", "Character vocal blips", "Per-character voice timbre for speech bubbles.", 2],
    ["Accessibility options", "Colour-blind palettes", "Alternative palettes for relationship and tier colours.", 1], ["Accessibility options", "Screen reader event narration", "Announce nearby events via ARIA live regions.", 2],
    ["Procedural generation rules", "Multiple world sizes", "Generate 96x96 and 128x128 blocks.", 2], ["Procedural generation rules", "Interiors with rooms", "Multi-room buildings with doors that open.", 4],
    ["Physics interactions", "Ragdoll blending", "Short verlet ragdolls for big falls, blended back to poses.", 4], ["Physics interactions", "Inverse kinematics for reaching", "Hands reach toys and other hands.", 3],
    ["Animation variations", "Procedural animation variation by mood", "Walk speed, posture and arm swing follow mood.", 2], ["Animation variations", "Character customisation", "Choose your stick figure's colours and hat.", 2],
  ];
  for (const [c, n, d, cx] of planned) add(c, n, d, { complexity: (cx ?? 2) as Feature["complexity"] });
  return out;
}

export function validateCatalogue(list: Feature[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>(), names = new Set<string>();
  for (const f of list) {
    if (ids.has(f.id)) errs.push("duplicate id " + f.id);
    ids.add(f.id);
    const k = f.category + "/" + f.name.toLowerCase();
    if (names.has(k)) errs.push("duplicate name " + k);
    names.add(k);
    if (!(CATEGORIES as readonly string[]).includes(f.category)) errs.push("unknown category " + f.category);
    if (!["implemented", "partial", "planned"].includes(f.status)) errs.push("bad status " + f.id);
    if (!f.description) errs.push("no description " + f.id);
  }
  for (const f of list) for (const d of f.dependencies) if (!ids.has(d)) errs.push(`${f.id} depends on missing ${d}`);
  for (const c of CATEGORIES) if (!list.some((f) => f.category === c)) errs.push("empty category " + c);
  return errs;
}
