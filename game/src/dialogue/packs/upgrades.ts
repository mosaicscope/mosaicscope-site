import type { Exchange } from "../exchanges";

/** Upgrade pack: twenty new neighbourhood exchanges, so the street has more to say. */
export const UPGRADES: Exchange[] = [
  { id: "up_bush_trim", tags: ["a:local", "b:mosaic", "@residential"], lines: ["Someone's been trimming the kerb bushes.", "That was me, sorry.", "Keep it up. The pigeons like the shade."] },
  { id: "up_pigeon_steal", tags: ["a:local", "b:mosaic", "@street"], lines: ["A pigeon just took your chips.", "It was a gift.", "It didn't look like a gift. It looked like a heist."] },
  { id: "up_rain_hat", tags: ["a:student", "b:mosaic", "rain"], lines: ["You forgot a brolly again.", "I'm a brolly sort of person now.", "Your hair says otherwise."] },
  { id: "up_footstep_quiet", tags: ["a:local", "b:mosaic", "night"], lines: ["You walk like a cat on the stairs.", "Practise. My landlord is deaf.", "Your landlord is deaf to rent, not footsteps."] },
  { id: "up_negatives", tags: ["a:musician", "b:mosaic", "@studio"], lines: ["I found an old roll of film in the gutter.", "Negatives are weird, aren't they?", "The darkroom crowd say they're the real photos."] },
  { id: "up_tile_mural", tags: ["a:graffiti", "b:mosaic", "@plaza"], lines: ["Someone set little tiles in the path. Is it a mural?", "It's a mosaic. Get it?", "I get it. I'm also stepping on it."] },
  { id: "up_toy_fixed", tags: ["a:thief", "b:mosaic", "@shops"], lines: ["That broken skateboard is working again.", "Bando fixed it.", "Bando fixes everything except my reputation."] },
  { id: "up_low_gravity", tags: ["a:mosaic", "b:mosaic", "party"], lines: ["Why is everything floating?", "Somebody lowered the gravity at the party.", "Good. My sandwich can finally reach my mouth."] },
  { id: "up_colourblind", tags: ["a:local", "b:mosaic", "@street"], lines: ["The red signs look blue today.", "Maybe it's the palette setting.", "Then the palette setting is brilliant."] },
  { id: "up_save_file", tags: ["a:mosaic", "b:mosaic", "friends"], lines: ["I backed up my save as a file.", "Smart. Put it somewhere safe.", "Under my pillow. Very safe."] },
  { id: "up_zoom_out", tags: ["a:tourist", "b:mosaic", "@plaza"], lines: ["Why does everyone stay put when I zoom out?", "They know where they're going.", "I don't. I'm just a tourist with a camera."] },
  { id: "up_bridge_wave", tags: ["a:local", "b:mosaic", "@park"], lines: ["Hey, you waved at the swan.", "The swan waved first.", "Swans don't wave. They judge."] },
  { id: "up_bin_return", tags: ["a:local", "b:mosaic", "@street"], lines: ["Cans in the bag, money in the pocket.", "Ten cents a can. I'm rich.", "You're rich in cans, that's it."] },
  { id: "up_siren_morning", tags: ["a:tired", "b:mosaic", "morning"], lines: ["Did a siren wake you up too?", "It's the ambulance on the bridge again.", "It's always the bridge. Maybe build a new bridge."] },
  { id: "up_street_name", tags: ["a:tourist", "b:mosaic", "@street"], lines: ["Is this Cashel Mall?", "It's Cashel Mall, and that's the hot dog stand.", "Thanks. The hot dog stand has better directions than the map."] },
  { id: "up_fog_night", tags: ["a:local", "b:mosaic", "night", "rain"], lines: ["The fog came in off the river.", "I can barely see my own shoes.", "Then keep walking. Shoes don't need seeing."] },
  { id: "up_lamp_light", tags: ["a:local", "b:mosaic", "@residential", "night"], lines: ["The street lamp flickers like it's thinking.", "It's been thinking for a week.", "Good lamps think. Bad lamps just buzz."] },
  { id: "up_bus_late", tags: ["a:local", "b:mosaic", "@street"], lines: ["The bus is late again.", "Is it really late, or just late for us?", "Late for everyone. The bus doesn't do time."] },
  { id: "up_camera_flash", tags: ["a:tourist", "b:mosaic", "@plaza"], lines: ["Can I take a photo of you?", "Only if you don't flash me.", "Deal. I'll wait for the sun."] },
  { id: "up_goodnight_crew", tags: ["a:mosaic", "b:mosaic", "night", "friends"], lines: ["Night, crew. See you tomorrow.", "Night. Mind the bushes.", "The bushes mind us. They've got pigeons."] },
];
