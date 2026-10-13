import type { Exchange } from "../exchanges";

/**
 * Lore pack: the city's running stories (Quakenstein's cones and ice, Bryce's kiwi-signal, Kevin at the
 * Velvet Zoo, the Famiglia's pies and tabs, the Pink Pukeko). Written as everyday gossip, so the lore
 * comes up the way it would between people who already know it. Every line is bubble-sized and unique.
 */
export const LORE: Exchange[] = [
  // ── Quakenstein ────────────────────────────────────────────────
  { id: "lore_quake_cones", tags: ["a:local", "b:local", "day", "@street"], lines: ["Quakenstein's holding every road cone in town hostage.", "Council's paying the ransom. In cones.", "Hope the cones are at least getting a rest."] },
  { id: "lore_quake_avon", tags: ["a:car_enthusiast", "b:local", "night"], lines: ["Heard Quakenstein might freeze the Avon. Drifting it, then.", "On ice? Is that even legal?", "Legal's a suggestion when the river's a rink."] },
  { id: "lore_quake_cops", tags: ["a:cop", "b:local", "day"], lines: ["Any sign of Quakenstein's doomsday machine?", "Only the cones. Hundreds of them.", "Then we're dealing with a very organised villain."] },
  { id: "lore_quake_busker", tags: ["a:busker", "b:local", "@plaza", "day"], lines: ["Busking by the Avon today. Ice is in the forecast.", "Someone's freezing the river?", "Quakenstein says so. Bring a warm hat and a shorter tune."] },
  { id: "lore_quake_taxi", tags: ["a:taxi", "b:driver", "night"], lines: ["Cones are blocking the Avon bridge again.", "Quakenstein's ransom, I bet.", "Yeah. Take the long way round. Pay the cone toll."] },
  // ── Bryce and the kiwi-signal ──────────────────────────────────
  { id: "lore_kiwi_bryce", tags: ["a:local", "b:local", "night", "clear"], lines: ["Kiwi-signal's up over the Port Hills again.", "Bryce is on duty. Who's he saving tonight?", "Nobody yet. Probably a lost cat. He takes cats seriously."] },
  { id: "lore_bryce_tax", tags: ["a:local", "b:local", "day"], lines: ["Bryce says he's self-employed as a superhero now.", "Does that pay?", "Tights are a write-off. The cape's deductible."] },
  { id: "lore_bryce_scooter", tags: ["a:skater", "b:local", "day"], lines: ["Lime scooters are faster than my board now.", "Ask Bryce. He'd know about speed.", "He rides a scooter in a cape. Sets a bad example."] },
  { id: "lore_bryce_taxi", tags: ["a:taxi", "b:local", "night", "clear"], lines: ["Kiwi-signal is glowing over Cathedral Square.", "Bryce will be wanting a lift, then.", "Keeping the back seat clear for the cape."] },
  // ── Kevin and the Velvet Zoo ───────────────────────────────────
  { id: "lore_kevin_hat", tags: ["a:local", "b:local", "@park"], lines: ["Kevin the giraffe ate a whole hat off a tourist.", "Which hat?", "The tourist's. Kevin has no taste but total commitment."] },
  { id: "lore_kevin_mural", tags: ["a:graffiti", "b:local", "@alley", "night"], lines: ["Someone painted Kevin on the Cathedral Square wall.", "Kevin's famous enough for murals now.", "He's a legend. The mural's got better posture than him."] },
  { id: "lore_zoo_press", tags: ["a:zookeeper", "b:local", "@park", "day"], lines: ["Velvet Zoo's giraffe was in the paper again.", "Kevin's still getting all the press.", "He keeps eating the reporters' notes. Good for his brand."] },
  // ── The Famiglia, Sal and the pies ─────────────────────────────
  { id: "lore_sal_tab", tags: ["a:local", "b:local", "@food"], lines: ["Sal's mince pies are on the Famiglia's tab now.", "Who pays for pies that aren't theirs?", "Whoever owes Sal. Which is everyone, eventually."] },
  { id: "lore_famiglia_diary", tags: ["a:local", "b:local", "@office"], lines: ["Gina writes everything down in pen.", "Pen is permanent, she says.", "Her diary's thicker than the council's rulebook."] },
  { id: "lore_sherbet_pockets", tags: ["a:local", "b:local", "night"], lines: ["Someone's pockets are glowing with Moon Sherbet.", "Put it back before the Famiglia counts it.", "Counting's their hobby. Also their business."] },
  { id: "lore_pies_medical", tags: ["a:medic", "b:local", "@hospital"], lines: ["Sal's pie habit is in the hospital's notes now.", "Is the pie a medical condition?", "Official diagnosis: Mince Debt. Very serious."] },
  // ── Turf and cars ──────────────────────────────────────────────
  { id: "lore_riccarton_hubcaps", tags: ["a:mobster", "b:mobster"], lines: ["The Riccarton Boys are selling hubcaps on Moorhouse.", "On our turf? That's an insult.", "The Don's taking it personally. He takes everything personally."] },
  { id: "lore_pukeko_buyer", tags: ["a:car_enthusiast", "b:taxi"], lines: ["The Pink Pukeko's up for sale again.", "Who's buying a pink pukeko?", "Someone with a big garage and no sense of shame."] },
  { id: "lore_city_cop_road", tags: ["a:cop", "b:driver", "day", "@street"], lines: ["Why are the cones blocking half the road?", "Quakenstein's ransom. Don't ask me how it works.", "I'm asking. Someone has to write this down."] },
];
