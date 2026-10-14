import type { Simulation } from "../sim/Simulation";
import type { Character } from "../entities/types";
import type { Role } from "../content/names";
import { friendship, hostility, peek } from "../social/Social";

/**
 * What you can say to someone depends on who they are, who you are to them and what they're doing.
 * Each topic scores itself against the moment (0 = makes no sense right now); the panel shows the best
 * few, so a barista on shift, a cop on patrol, a scared stranger in the rain and your partner at a party
 * all get different openers. Asking something unlocks its follow-ups, and a question is never offered
 * twice in one conversation, so it moves forward like a real back-and-forth.
 */
export interface TalkState { last: string | null; used: Set<string>; turn: number }

export interface TalkCtx {
  sim: Simulation; npc: Character; p: Character; st: TalkState;
  goal: string; role: Role; stranger: boolean; friend: number; hostile: number; partner: boolean;
  place: string; hour: number; rain: boolean; party: boolean; dark: boolean;
  scared: boolean; angry: boolean; hurt: boolean; happy: boolean; sad: boolean;
  /** something dramatic they remember from the last little while (a fight, a break, an argument) */
  saw: string | null;
}

export interface Topic {
  id: string;
  score: (t: TalkCtx) => number;
  labels: (t: TalkCtx) => string[];
  reply: (t: TalkCtx) => string[];
  /** consequences beyond the words (mood, relationships) */
  effect?: (t: TalkCtx) => void;
  /** topics that only make sense straight after this one */
  follow?: string[];
}

const ACTIVE = (t: TalkCtx, ...g: string[]) => g.includes(t.goal);
const ROLE = (t: TalkCtx, ...r: Role[]) => r.includes(t.role);

export const TOPICS: Topic[] = [
  // ---- who you are to them ----
  { id: "t_intro", score: (t) => (t.stranger ? 0.9 : 0), labels: () => ["I'm new round here.", "Don't think we've met. I'm the new guy.", "Hey. Just moved in."],
    reply: (t) => t.hostile > 0.2 ? ["Good for you.", "Cool story."] : [`Welcome to ${t.place}. Watch out for the seagulls, they're organised.`, `New, eh? I'm ${t.npc.name}. Stick around, it gets weird.`, "Fresh face. Rare. Most people here have been here since the earthquakes."],
    follow: ["t_tips", "t_where_eat"] },
  { id: "t_tips", score: () => 0, labels: () => ["Any tips for a new guy?", "What should I know about this place?"],
    reply: (t) => [t.dark ? "Don't walk past the casino alone after dark. And never trust a guy selling watches." : "Get a coffee at the plaza, avoid the dodgy toy sellers, and smile at the cops.", "Everyone knows everyone. So whatever you do, people will hear about it by lunch.", "Find your crew. Nobody survives this town solo."] },
  { id: "t_where_eat", score: () => 0, labels: () => ["Where's good to eat?", "Where do you get a feed round here?"],
    reply: () => ["The food truck by the plaza. Get the loaded fries, don't ask what's in the sauce.", "Burger place does a mean double. Bring napkins. Many napkins.", "Honestly? The servo pie at 2am hits different."] },
  { id: "t_missed", score: (t) => (t.friend > 0.35 && !t.stranger ? 0.75 : 0), labels: (t) => [`${t.npc.name}! Missed you.`, "My favourite person. How've you been?", "There they are. What's new with you?"],
    reply: (t) => t.sad ? ["Honestly? Rough week. Good to see a friendly face though.", "Been better. You showing up helps."] : ["Living the dream, mate. Mostly.", "Same old, same old. Better now you're here.", "Ayy, chur. Was just thinking about you."],
    effect: (t) => { t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.06); }, follow: ["t_hang"] },
  { id: "t_hang", score: () => 0, labels: () => ["We should hang out more.", "Let's do something this weekend."],
    reply: (t) => [t.party ? "We're literally at a party. This is hanging out." : "Yes. Beach, chips, bad decisions. You in?", "Say the word. I'm always free. Tragically."],
    effect: (t) => { t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.05); } },
  { id: "t_beef", score: (t) => (t.hostile > 0.3 ? 0.85 : 0), labels: () => ["What's your problem with me?", "Are we good, or what?", "Look, can we squash this?"],
    reply: (t) => t.hostile > 0.6 ? ["You know exactly what you did.", "We are very much not good.", "Keep walking."] : ["...I dunno. Maybe I overreacted.", "Fine. Clean slate. Don't make me regret it.", "Ok. We're good. Ish."],
    effect: (t) => { const r = peek(t.npc, t.p.id); if (r && t.hostile <= 0.6) r.grudge = Math.max(0, r.grudge - 0.15); }, follow: ["t_sorry"] },
  { id: "t_sorry", score: () => 0, labels: () => ["I'm sorry. Genuinely.", "My bad. That was on me."],
    reply: (t) => t.npc.pers.kindness > 0.45 ? ["...Alright. Apology accepted.", "Thanks for saying it. That took guts."] : ["Words are cheap.", "Show me, don't tell me."],
    effect: (t) => { const r = peek(t.npc, t.p.id); if (r) r.grudge = Math.max(0, r.grudge - (t.npc.pers.kindness > 0.45 ? 0.25 : 0.05)); } },
  { id: "t_love", score: (t) => (t.partner ? 0.8 : 0), labels: () => ["Hey you. How's my favourite person?", "Thinking about you all day.", "You look good today."],
    reply: () => ["Stop it. No, keep going.", "You're sweet. Annoying, but sweet.", "Took you long enough to come find me."],
    effect: (t) => { t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.08); } },

  // ---- how they are right now ----
  { id: "t_ok", score: (t) => (t.scared ? 0.95 : t.hurt ? 0.9 : 0), labels: (t) => t.hurt ? ["You alright? You look banged up.", "Need a medic?"] : ["You ok? You look shaken.", "Hey, breathe. What happened?"],
    reply: (t) => t.hurt ? ["Took a foam bat to the face. I'll live.", "Ow. Yes. No. Ask me in five minutes.", "Someone's getting a strongly worded text."] : [t.saw ? `Did you not see? ${t.saw}. Wild.` : "Something's off tonight. Can't put my finger on it.", "Just... jumpy. Stay close, yeah?"],
    effect: (t) => { t.npc.emo.fear = Math.max(0, t.npc.emo.fear - 0.15); t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.05); } },
  { id: "t_mad", score: (t) => (t.angry && !t.scared ? 0.85 : 0), labels: () => ["Who wound you up?", "Woah. Who are we angry at?"],
    reply: (t) => [t.saw ? `Ugh. ${t.saw}. Unbelievable.` : "Everyone. Everything. The parking in this city.", "Don't. I'm one more thing away from flipping a table."],
    effect: (t) => { t.npc.emo.frustration = Math.max(0, t.npc.emo.frustration - 0.12); }, follow: ["t_calm"] },
  { id: "t_calm", score: () => 0, labels: () => ["Want to walk it off?", "Not worth it. Let it go."],
    reply: () => ["...Yeah. Maybe. Thanks.", "Easy for you to say. But fine.", "You're annoyingly reasonable."],
    effect: (t) => { t.npc.emo.frustration = Math.max(0, t.npc.emo.frustration - 0.2); } },
  { id: "t_happy", score: (t) => (t.happy && !t.scared ? 0.55 : 0), labels: () => ["Someone's in a good mood.", "What's got you smiling?"],
    reply: (t) => [t.party ? "Party, mate! Look around!" : "Sun's out, phone's charged, nobody's called me. Perfect day.", "Got paid. Don't tell anyone, they'll want a lend.", "Just vibing. Try it sometime."] },
  { id: "t_down", score: (t) => (t.sad && !t.scared && !t.angry ? 0.6 : 0), labels: () => ["You seem a bit down.", "Rough day?"],
    reply: () => ["Bit, yeah. Nothing a pie won't fix.", "Just one of those days where the toast lands butter side down.", "Thanks for noticing. Most people don't."],
    effect: (t) => { t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.1); } },

  // ---- what they're doing ----
  { id: "t_doing", score: (t) => (t.goal ? 0.5 : 0), labels: () => ["What are you up to?", "Where you off to?"],
    reply: (t) => [`${(GOAL_LINES[t.goal] ?? GOAL_LINES.wander)[0]}`, `${(GOAL_LINES[t.goal] ?? GOAL_LINES.wander)[1] ?? "Not much. Why, what's on?"}`] },
  { id: "t_eat", score: (t) => (ACTIVE(t, "eat") ? 0.8 : 0), labels: () => ["What are you eating?", "Smells good. What is it?"], reply: () => ["Mince and cheese. The king of pies.", "Loaded fries. Don't even think about it.", "No idea. Ordered by pointing."], follow: ["t_where_eat"] },
  { id: "t_work", score: (t) => (ACTIVE(t, "work", "commute") ? 0.75 : 0), labels: () => ["Off to work?", "How's the job going?"], reply: (t) => [`Being a ${roleWord(t.role)} pays the rent. Barely.`, "Clocking in. Pray for me.", "Work's fine. My boss thinks I'm in a meeting."] },
  { id: "t_dance", score: (t) => (ACTIVE(t, "party") || t.party ? 0.8 : 0), labels: () => ["Dance with me?", "Who's throwing this?", "You've got moves."],
    reply: (t) => t.npc.pers.playfulness > 0.5 ? ["Only if you can keep up.", "I've been waiting all night for someone to ask.", "Watch and learn."] : ["I don't dance. I sway. Respectfully.", "Maybe after one more drink."],
    effect: (t) => { t.npc.needs.fun = Math.min(1, t.npc.needs.fun + 0.1); } },
  { id: "t_shop", score: (t) => (ACTIVE(t, "shop") ? 0.75 : 0), labels: () => ["Buying anything good?", "Shopping again?"], reply: () => ["Just looking. Which means buying.", "New kicks. Don't tell my bank.", "Snacks. Strictly essential snacks."] },
  { id: "t_luck", score: (t) => (ACTIVE(t, "gamble") || ROLE(t, "gambler") ? 0.75 : 0), labels: () => ["Feeling lucky?", "How much you up tonight?"], reply: () => ["Up forty, down two hundred. Net vibes: excellent.", "Luck's a mindset. A very expensive mindset.", "Tonight's the night. I say that every night."] },
  { id: "t_trick", score: (t) => (ACTIVE(t, "skate") || ROLE(t, "skater") ? 0.75 : 0), labels: () => ["Show me a trick.", "How long you been skating?"], reply: () => ["Kickflip. Landed it once in 2019. Still riding that high.", "Since I could walk. Before, technically. Ask my knees.", "Watch. No, don't watch. Ok now watch."] },
  { id: "t_song", score: (t) => (ACTIVE(t, "busk") || ROLE(t, "busker", "musician") ? 0.75 : 0), labels: () => ["Play me something.", "Got a gig coming up?"], reply: () => ["Requests are two dollars. Wonderwall is five.", "Friday at the bar, if they still let me in.", "This one's an original. It's about the bus being late."], follow: ["t_tip"] },
  { id: "t_tip", score: () => 0, labels: () => ["Here's a couple bucks.", "That was class. Keep going."], reply: () => ["Legend. That's lunch sorted.", "You've got taste. Rare in this town.", "Chur! Next one's for you."],
    effect: (t) => { if (t.p.cash >= 2) { t.p.cash -= 2; t.npc.cash += 2; } t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.1); } },
  { id: "t_look", score: (t) => (ACTIVE(t, "search", "reclaim") ? 0.8 : 0), labels: () => ["Lost something? I'll help look.", "What are you looking for?"], reply: () => ["My favourite toy. Someone's got it, I just know it.", "If you see a bloke with my stuff, he's dead to me.", "Thanks. Keep your eyes peeled."] },
  { id: "t_tag", score: (t) => (ACTIVE(t, "tag") || ROLE(t, "graffiti") ? 0.7 : 0), labels: () => ["Nice piece. Who's it for?", "Aren't you worried about the cops?"], reply: () => ["For the city. It needed colour.", "Cops have to catch me first.", "Art isn't a crime. Legally it's a bit of a crime."] },
  { id: "t_clean", score: (t) => (ACTIVE(t, "clean") || ROLE(t, "cleaner") ? 0.65 : 0), labels: () => ["Thanks for keeping it tidy.", "Is it ever clean round here?"], reply: () => ["Somebody has to. Usually me.", "Clean for about four minutes a day.", "First person to thank me this year. Write that down."], effect: (t) => { t.npc.emo.mood = Math.min(1, t.npc.emo.mood + 0.1); } },
  { id: "t_rest", score: (t) => (ACTIVE(t, "rest") || t.npc.needs.energy < 0.25 ? 0.6 : 0), labels: () => ["Long day?", "You look knackered."], reply: () => ["Running on coffee and spite.", "I could sleep on this footpath.", "Every day's a long day."] },
  { id: "t_watch", score: (t) => (ACTIVE(t, "watch") ? 0.7 : 0), labels: () => ["What's everyone looking at?", "What's going on over there?"], reply: (t) => [t.saw ? `${t.saw}. Couldn't look away.` : "No idea. Everyone else stopped so I stopped.", "Drama. The good kind."] },
  { id: "t_cars", score: (t) => (ACTIVE(t, "carmeet") || ROLE(t, "car_enthusiast", "mechanic") ? 0.7 : 0), labels: () => ["Which car's yours?", "My car's making a weird noise."], reply: (t) => ROLE(t, "mechanic") ? ["Clunk or whine? Doesn't matter, it's two hundred either way.", "Bring it in. I'll have a look and a judgement."] : ["The loud one. They're all loud. Mine's louder.", "Lowered, tinted, financed. Living."] },

  // ---- who they are ----
  { id: "t_coffee", score: (t) => (ROLE(t, "barista") ? 0.75 : 0), labels: () => ["Flat white, please?", "What's the best thing on the menu?"], reply: () => ["Coming right up. Oat or regular? Trick question, it's regular.", "The cheese scone. Fight me.", "I make art in the foam. Nobody notices."] },
  { id: "t_food", score: (t) => (ROLE(t, "chef", "vendor") ? 0.7 : 0), labels: () => ["What's on the menu?", "What's your best dish?"], reply: () => ["Today's special is whatever I didn't burn.", "Loaded fries. Trust the process.", "Secret recipe. The secret is butter."], follow: ["t_where_eat"] },
  { id: "t_patrol", score: (t) => (ROLE(t, "cop") ? 0.65 : 0), labels: (t) => t.p.wanted > 0 ? ["Evening, officer. Nice night for it.", "You haven't seen me, yeah?"] : ["Keeping us safe, officer?", "Busy shift?"],
    reply: (t) => t.p.wanted > 0 ? ["Funny. You look a lot like the description I just got.", "Don't go anywhere."] : ["Someone stole a giraffe statue. Again.", "Quiet, which means something's about to happen.", "Move along. Politely."] },
  { id: "t_shady", score: (t) => (ROLE(t, "thief", "smuggler", "mobster", "dealer") ? 0.6 : 0), labels: () => ["Got anything going on?", "Heard you're the person to know."], reply: (t) => t.friend > 0.2 ? ["Maybe. Depends who's asking. And how much they've got.", "Come back after dark. Bring cash, not questions."] : ["Never heard of me. Got it?", "Wrong person, mate."] },
  { id: "t_study", score: (t) => (ROLE(t, "student") ? 0.7 : 0), labels: () => ["What are you studying?", "Exams soon?"], reply: () => ["Law. Mostly I study the bar menu.", "Engineering. Ask me how to build a bridge. Don't ask me to build one.", "Exams are a social construct. Also next Tuesday."] },
  { id: "t_tourist", score: (t) => (ROLE(t, "tourist") ? 0.75 : 0), labels: () => ["Where you visiting from?", "Enjoying Christchurch?"], reply: () => ["Melbourne! Your coffee's nearly as good as ours.", "Love it. Why does everyone say 'yeah nah'?", "The trams are cute. The wind is personal."] },
  { id: "t_shoot", score: (t) => (ROLE(t, "photographer", "model") || ACTIVE(t, "photograph") ? 0.7 : 0), labels: () => ["Take my photo?", "How'd you get into photography?"], reply: () => ["Find your light. No, your other light. Perfect.", "Bought a camera, ruined a thousand photos, then one was good.", "Golden hour's in twenty. Stick around."] },
  { id: "t_office", score: (t) => (ROLE(t, "office", "mogul") ? 0.6 : 0), labels: () => ["How's the corporate life?", "Making big moves?"], reply: () => ["Synergy. Circling back. Living the dream.", "Three meetings that could've been emails. Thriving.", "Big moves. Small lunch break."] },
  { id: "t_ride", score: (t) => (ROLE(t, "taxi", "driver") ? 0.65 : 0), labels: () => ["Know the city well?", "Crazy fares lately?"], reply: () => ["Every pothole. Personally.", "Had a guy dressed as a kiwi bird last night. Tipped well.", "Don't ask what I've seen in that back seat."] },

  // ---- the moment and the world ----
  { id: "t_weather", score: (t) => (t.rain ? 0.6 : 0.15), labels: (t) => t.rain ? ["Brutal weather, eh?", "Did you forget your umbrella too?"] : ["Nice out today.", "Reckon it'll rain?"],
    reply: (t) => t.rain ? ["Four seasons in one day. Classic.", "My shoes are full of puddle.", "Nor'west for breakfast, rain for lunch."] : ["Enjoy it while it lasts. It won't.", "Sun's out. Everyone's suddenly nice."] },
  { id: "t_late", score: (t) => (t.hour >= 23 || t.hour < 4 ? 0.65 : 0), labels: () => ["What are you doing out this late?", "Can't sleep either?"], reply: () => ["Night's when the good stuff happens.", "I could ask you the same thing.", "Insomnia and a craving for chips."] },
  { id: "t_morning", score: (t) => (t.hour >= 5 && t.hour < 9 ? 0.5 : 0), labels: () => ["Morning! Early start?", "Had your coffee yet?"], reply: () => ["Don't talk to me until I've had two.", "Up with the birds. The birds are loud.", "Early bird gets the parking spot."] },
  { id: "t_saw", score: (t) => (t.saw ? 0.75 : 0), labels: () => ["Did you see what happened?", "What was all that about?"],
    reply: (t) => [`${t.saw}. Swear down.`, `Saw it with my own eyes: ${t.saw}.`], follow: ["t_saw_more"] },
  { id: "t_saw_more", score: () => 0, labels: () => ["No way. Then what?", "Whose side are you on?"], reply: () => ["Then everyone pretended nothing happened. Typical.", "Not picking sides. Unless there's snacks.", "This town loves a scrap. Then a group hug."] },
  { id: "t_youok_me", score: (t) => (t.p.blood < 0.7 ? 0.6 : 0), labels: () => ["I've had a rough one.", "Do I look as bad as I feel?"], reply: (t) => t.npc.pers.kindness > 0.5 ? ["Yeah, you look rough. Sit down a sec.", "Get that seen to. Medic's near the plaza."] : ["You look like you lost a fight with a trampoline.", "Not my problem, mate."] },
  { id: "t_joke", score: (t) => (t.npc.pers.playfulness > 0.55 ? 0.4 : 0.15), labels: () => ["Tell me something funny.", "Make my day."], reply: () => ["Why did the kiwi cross the road? It didn't. Nocturnal, mate.", "I once saw a seagull steal a whole pie. Respect.", "My life. My life is the joke."], effect: (t) => { t.npc.needs.fun = Math.min(1, t.npc.needs.fun + 0.08); } },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

const GOAL_LINES: Record<string, string[]> = {
  wander: ["Just wandering. Seeing who's about.", "Nowhere. Everywhere. Walking."], routine: ["Doing my rounds. Same as every day.", "Routine. Keeps me sane."],
  home: ["Heading home. Couch is calling.", "Home. Bed. Do not disturb."], gohome: ["Heading home. Couch is calling.", "Home time. Finally."],
  socialize: ["Looking for someone to talk to. Congrats, it's you.", "Just catching up with people."], gossip: ["Got some tea to spill. Not to you though.", "Off to catch up on the goss."],
  play: ["Playing. Life's short.", "Having a muck around."], fight: ["Settling a score. Stay back.", "Someone's got it coming."], help: ["Helping someone out.", "Someone needs a hand."],
  party: ["Dancing! Obviously!", "Partying till my legs give out."], shelter: ["Getting out of this rain.", "Finding a roof, fast."], eat: ["Getting a feed. Starving.", "Food. Then more food."],
  work: ["Off to work. Wish me luck.", "Clocking in. Pray for me."], commute: ["Commuting. The bus is late. Again.", "Getting across town."], shop: ["Bit of shopping.", "Spending money I don't have."],
  gamble: ["Off to the casino. Feeling lucky.", "Gonna win big. Probably."], skate: ["Skating. Want to watch me fall?", "Off to the bowl."], busk: ["Busking. Got any coins?", "Playing for the people."],
  patrol: ["On patrol. Behave.", "Keeping the peace."], rest: ["Taking a breather.", "Just sitting a sec."], book: ["Booking a MosaicScope shoot actually.", "Getting some photos done."],
  photograph: ["On a shoot. Mind the light.", "Working. Camera's rolling."], carmeet: ["Car meet. Loud ones only.", "Off to look at shiny cars."],
};

function roleWord(r: Role): string { return r === "local" ? "local legend" : r.replace("_", " "); }

/** The moment, from this NPC's side. */
export function talkCtx(sim: Simulation, npc: Character, st: TalkState): TalkCtx {
  const p = sim.player, rel = peek(npc, p.id);
  const recent = npc.memories.filter((m) => sim.tick - m.t < 60 * 240 && (m.kind === "saw_fight" || m.kind === "saw_break" || m.kind === "argued" || m.kind === "hit_by")).sort((a, b) => b.t - a.t)[0];
  return {
    sim, npc, p, st, goal: npc.goal?.id ?? "", role: npc.role, stranger: !rel || rel.fam < 0.05,
    friend: friendship(rel), hostile: hostility(rel), partner: npc.partner === p.id,
    place: sim.world.areaAt(npc.x, npc.y)?.name ?? "here", hour: sim.hour, rain: sim.env.raining || sim.env.storm, party: sim.env.party, dark: sim.isDark,
    scared: npc.emo.fear > 0.5, angry: npc.emo.frustration > 0.5, hurt: npc.blood < 0.8 || npc.emo.composure < 0.4,
    happy: npc.emo.mood > 0.4, sad: npc.emo.mood < -0.25,
    saw: recent ? sim.dialogue.describe(recent, npc) : null,
  };
}

/** Score every topic for this moment; follow-ups of the last answer get a big boost, used ones drop out. */
export function rankTopics(t: TalkCtx): { id: string; label: string; score: number }[] {
  const sim = t.sim, last = t.st.last ? TOPIC_BY_ID.get(t.st.last) : undefined;
  const out: { id: string; label: string; score: number }[] = [];
  for (const top of TOPICS) {
    if (t.st.used.has(top.id)) continue;
    let s = top.score(t);
    if (last?.follow?.includes(top.id)) s = Math.max(s, 1.2);
    if (s <= 0) continue;
    const labels = top.labels(t);
    // the phrasing changes person to person and turn to turn, so the same question doesn't read identically every time
    const label = labels[(t.npc.id * 7 + t.st.turn * 3 + top.id.length) % labels.length];
    out.push({ id: top.id, label, score: s + sim.rng.next() * 0.2 });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The NPC's answer to a topic, picked so the same person doesn't repeat themselves. */
export function answerTopic(t: TalkCtx, id: string): string {
  const top = TOPIC_BY_ID.get(id);
  if (!top) return "...";
  const lines = top.reply(t).filter(Boolean);
  top.effect?.(t);
  t.st.used.add(id); t.st.last = id; t.st.turn++;
  return lines[t.sim.rng.int(0, lines.length - 1)] ?? "...";
}
