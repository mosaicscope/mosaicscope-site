import type { Character, Memory, Rel } from "../entities/types";

/** Everything a line template may look at. Built once per utterance by the ContextResolver. */
export interface LineCtx {
  s: Character; l: Character | null; rel: Rel | undefined; lrel: Rel | undefined;
  friend: number; hostile: number; mood: number; place: string; weather: string; hour: number;
  toy: string; mem: Memory | null; memText: string; about: string; party: boolean; dark: boolean;
  busy: boolean; scared: boolean; angry: boolean; hurt: boolean; isPlayer: boolean;
}

export interface LineTemplate {
  id: string;
  topic: string;
  when?: (c: LineCtx) => boolean;
  lines: string[];
  weight?: number;
}

/**
 * Line library. Variables: {name} speaker, {other} listener, {toy}, {place}, {weather}, {mem}, {about}, {catch}.
 * Conditions keep lines truthful to the speaker's actual state and knowledge.
 */
export const LINES: LineTemplate[] = [
  // greetings
  { id: "greet_friend", topic: "greet", when: (c) => c.friend > 0.35, lines: ["{other}! My person.", "Ayy {other}, there you are.", "{other}! Chur.", "Look who it is. {other}!"] },
  { id: "greet_neutral", topic: "greet", when: (c) => c.friend > -0.1 && c.friend <= 0.35, lines: ["Hey {other}.", "Sup.", "Kia ora.", "Oh, hey."] },
  { id: "greet_stranger", topic: "greet", when: (c) => !c.rel || c.rel.fam < 0.05, lines: ["Don't think we've met. I'm {name}.", "New face. I'm {name}.", "You lost? I'm {name}."] },
  { id: "greet_cold", topic: "greet", when: (c) => c.hostile > 0.3, lines: ["Oh. It's you.", "What do you want, {other}?", "Not you again."] },
  { id: "greet_scared", topic: "greet", when: (c) => c.scared, lines: ["Did you see that?!", "Is it safe here?", "Stay close, yeah?"] },
  { id: "greet_hurt", topic: "greet", when: (c) => c.hurt, lines: ["Still seeing stars...", "Ow. Give me a sec.", "My everything hurts."] },
  // small talk
  { id: "chat_weather_rain", topic: "chat", when: (c) => c.weather === "rain", lines: ["This rain, man.", "Should've stayed in the Studio.", "Soaked. Again."] },
  { id: "chat_weather_storm", topic: "chat", when: (c) => c.weather === "storm", lines: ["That thunder is not it.", "Storm's getting worse."] },
  { id: "chat_place", topic: "chat", lines: ["{place} is the spot today.", "Always end up at {place}.", "Vibes are good at {place}."] },
  { id: "chat_toy", topic: "chat", when: (c) => c.toy !== "", lines: ["Check my {toy}.", "Got a {toy}, want a go after?", "This {toy} is elite."] },
  { id: "chat_bored", topic: "chat", when: (c) => c.s.needs.fun < 0.3, lines: ["So bored I could nap standing up.", "Nothing's happening. Make something happen.", "Someone start a game, please."] },
  { id: "chat_tired", topic: "chat", when: (c) => c.s.needs.energy < 0.3, lines: ["Running on fumes.", "Need a bench. Badly."] },
  { id: "chat_happy", topic: "chat", when: (c) => c.mood > 0.4, lines: ["Good day, this.", "Feeling unreal today.", "Honestly? Life's good."] },
  { id: "chat_low", topic: "chat", when: (c) => c.mood < -0.25, lines: ["Not my day.", "Everything's a bit much.", "Yeah nah, rough one."] },
  { id: "chat_night", topic: "chat", when: (c) => c.hour >= 21 || c.hour < 4, lines: ["After hours. Best hours.", "Who's DJing tonight?"] },
  { id: "chat_party", topic: "chat", when: (c) => c.party, lines: ["Static's cooking right now!", "This track!", "Hands up!"] },
  { id: "chat_catch", topic: "chat", lines: ["{catch}"], weight: 0.6 },
  { id: "chat_reply", topic: "reply", lines: ["True.", "Facts.", "Ha, yeah.", "For real?", "Mm.", "Sweet as.", "No way.", "Big if true."] },
  { id: "chat_reply_cold", topic: "reply", when: (c) => c.hostile > 0.3, lines: ["Whatever.", "Did I ask?", "Cool story."] },
  // jokes and teasing
  { id: "joke", topic: "joke", lines: ["Why'd the plush bear skip the fight? It had no guts.", "Grain smiled once. Once.", "I'd tell you a frisbee joke but it'd come back to me.", "My photos are like Tiles: overexposed."] },
  { id: "tease", topic: "tease", lines: ["Nice throw. For a toddler.", "You fight like a soggy noodle.", "Did you get dressed in the dark?", "Is that your best move?"] },
  { id: "tease_back", topic: "tease_back", when: (c) => c.s.pers.temper > 0.6, lines: ["Say that again.", "Keep talking.", "You want problems?"] },
  { id: "tease_laugh", topic: "tease_back", when: (c) => c.s.pers.temper <= 0.6, lines: ["Ha! Fair.", "Rude. Accurate, but rude.", "Wow. Ok."] },
  // gossip with provenance
  { id: "gossip_saw", topic: "gossip", when: (c) => !!c.mem && (c.mem.src === "saw" || c.mem.src === "did"), lines: ["I saw it myself: {mem}.", "With my own eyes: {mem}.", "Swear down, {mem}. I was there."] },
  { id: "gossip_told", topic: "gossip", when: (c) => !!c.mem && c.mem.src === "told", lines: ["{about} told me {mem}.", "Heard from {about}: {mem}.", "According to {about}, {mem}."] },
  { id: "gossip_heard", topic: "gossip", when: (c) => !!c.mem && c.mem.src === "heard", lines: ["Rumour is {mem}. Don't quote me.", "People are saying {mem}.", "Word on the street: {mem}."] },
  { id: "gossip_none", topic: "gossip", when: (c) => !c.mem, lines: ["Nothing to report.", "Quiet day, honestly.", "Haven't heard a thing."] },
  { id: "gossip_react", topic: "gossip_react", lines: ["No way.", "Seriously?", "Classic.", "I knew it.", "That's wild."] },
  // disputes
  { id: "dispute_ask", topic: "dispute", lines: ["That's my {toy}. Hand it over.", "Oi, {other}, that {toy} is mine.", "Give back my {toy}."] },
  { id: "dispute_yield", topic: "dispute_yield", lines: ["My bad, here.", "Ok ok, take it.", "Didn't know it was yours."] },
  { id: "dispute_refuse", topic: "dispute_refuse", lines: ["Finders keepers.", "Make me.", "Don't see your name on it."] },
  // apology / reconcile
  { id: "apology", topic: "apology", lines: ["Hey... about before. Sorry.", "We good? I was out of line.", "My bad earlier, {other}."] },
  { id: "apology_accept", topic: "apology_accept", lines: ["All good. We're sweet.", "Yeah, we're good.", "Forget it. Hug it out."] },
  { id: "apology_reject", topic: "apology_reject", lines: ["Not yet.", "Nah. Too soon.", "Words are cheap."] },
  // argument
  { id: "argue", topic: "argue", lines: ["You've got some nerve.", "Unbelievable.", "Every time, {other}!", "Back off!", "Seriously?!"] },
  // barks (one-liners shouted in the world)
  { id: "bark_hit", topic: "hit", lines: ["Ow!", "Hey!", "Oof!", "Watch it!", "Rude!"] },
  { id: "bark_hit_angry", topic: "hit", when: (c) => c.s.pers.temper > 0.6, lines: ["Oh it's ON.", "You're done!", "Big mistake!"] },
  { id: "bark_down", topic: "down", lines: ["I'm down!", "Ugh...", "Stars..."] },
  { id: "bark_taunt", topic: "taunt", lines: ["Catch!", "Heads up!", "En garde!", "Who wants it?", "Too slow!"] },
  { id: "bark_panic", topic: "panic", lines: ["RUN!", "Nope nope nope!", "Get me out of here!", "Aaah!"] },
  { id: "bark_help", topic: "help", lines: ["You ok? Here.", "Up you get.", "I got you.", "Breathe. You're fine."] },
  { id: "bark_thanks", topic: "thanks", lines: ["Thanks, {other}.", "Legend.", "Owe you one."] },
  { id: "bark_gift", topic: "gift", lines: ["Here, have my {toy}.", "Got you something.", "This {toy}'s for you."] },
  { id: "bark_found", topic: "found", lines: ["Found it!", "There you are!", "Mine again."] },
  { id: "bark_lost", topic: "lost", lines: ["Where's my {toy}?", "Has anyone seen my {toy}?", "I had it a second ago..."] },
  { id: "bark_broken", topic: "broken", lines: ["It broke!", "RIP {toy}.", "Noooo, my {toy}!"] },
  { id: "bark_rain", topic: "rain", lines: ["Rain!", "Ugh, rain.", "Inside, everyone!"] },
  { id: "bark_blackout", topic: "blackout", lines: ["Who turned off the lights?!", "Power's out!", "I can't see a thing!"] },
  { id: "bark_power", topic: "power_back", lines: ["Lights!", "We're back!", "Phew."] },
  { id: "bark_party", topic: "party", lines: ["PARTY!", "Turn it up!", "Static, you legend!", "Let's gooo!"] },
  { id: "bark_startled", topic: "startled", lines: ["Whoa!", "Jeez!", "What was that?!"] },
  { id: "bark_craft", topic: "craft", lines: ["Made a {toy}!", "Behold: {toy}.", "Bando-certified {toy}."] },
  { id: "bark_cheer", topic: "cheer", lines: ["Gooo!", "Get 'em!", "Ohhh!", "Woo!"] },
  { id: "bark_spring", topic: "spring", lines: ["Boing!", "Wheee!", "Up we go!"] },
  { id: "bark_meteor", topic: "wonder", lines: ["Shooting star!", "Make a wish!", "Did you see that?"] },
  // player-facing replies
  { id: "p_busy", topic: "p_busy", lines: ["Not now!", "Bit busy here.", "Later, yeah?"] },
  { id: "p_about", topic: "p_about", lines: ["{bio}"] },
  { id: "p_gift_yes", topic: "p_gift_yes", lines: ["For me? Chur!", "Oh nice, a {toy}! Thanks.", "You're alright, stranger."] },
  { id: "p_gift_no", topic: "p_gift_no", lines: ["Already got my hands full.", "Can't carry any more."] },
  { id: "p_ask_yes", topic: "p_ask_yes", lines: ["Sure, take it.", "Go on then.", "Look after it."] },
  { id: "p_ask_no", topic: "p_ask_no", lines: ["Nah, it's mine.", "Get your own.", "Earn it first."] },
  { id: "p_comp", topic: "p_comp", lines: ["Aw, stop. Keep going.", "You've got taste.", "Ha, thanks!"] },
  { id: "p_tease_hurt", topic: "p_tease", when: (c) => c.s.pers.temper > 0.55, lines: ["Watch your mouth.", "Wanna run that back?", "Bold, for a stranger."] },
  { id: "p_tease_ok", topic: "p_tease", lines: ["Ha. Ok, I deserved that.", "Wow. Rude.", "Good one."] },
  { id: "p_duel_yes", topic: "p_duel_yes", lines: ["You're on.", "Hope you can take a foam hit.", "Let's see it!"] },
  { id: "p_duel_no", topic: "p_duel_no", lines: ["Nah, not feeling it.", "Maybe later.", "Fight someone else."] },
  { id: "p_peace_yes", topic: "p_peace_yes", lines: ["...yeah, you're right. I'll talk to {about}.", "Fine. Maybe I'll let it go."] },
  { id: "p_peace_no", topic: "p_peace_no", lines: ["You don't know what {about} did.", "Stay out of it."] },
  { id: "p_opinion_good", topic: "p_opinion", when: (c) => c.friend > 0.3, lines: ["{about}? Love them.", "{about}'s my people.", "Ride or die, {about}."] },
  { id: "p_opinion_bad", topic: "p_opinion", when: (c) => c.hostile > 0.3, lines: ["{about}? Don't get me started.", "Can't stand {about}.", "{about} owes me an apology."] },
  { id: "p_opinion_meh", topic: "p_opinion", lines: ["{about}? They're alright.", "Don't really know {about}.", "{about}'s fine I guess."] },
  { id: "p_bye", topic: "p_bye", lines: ["Later.", "See ya.", "Catch you round.", "Ka kite."] },
];
