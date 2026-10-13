import type { Exchange } from "../exchanges";

/** Wilf's pack: dry Kiwi satire. The joke is the way in; money, loneliness, power and ageing sit underneath. */
export const SATIRE: Exchange[] = [
  // ── Bureaucracy ────────────────────────────────────────────────
  { id: "sat_form_a", tags: ["a:office", "@office"], lines: ["I need form 27B to request form 27A.", "And where do I get 27B?", "From 27A. We're very proud of the loop."] },
  { id: "sat_form_b", tags: ["a:office", "b:local", "day"], lines: ["Your application is under review.", "For how long?", "Until it feels better about itself."] },
  { id: "sat_queue", tags: ["a:local", "b:local", "@office"], lines: ["The queue's moving nicely today.", "That's the other queue.", "Ah. Ours is the one with the plant in it."] },
  { id: "sat_council_cone", tags: ["a:local", "b:cop", "@street"], lines: ["The council put up a cone to fix the pothole.", "Did it work?", "The pothole's still there. The cone's very committed."] },
  { id: "sat_council_consult", tags: ["a:office", "b:local", "morning"], lines: ["We're consulting the community on the new bench.", "How long does that take?", "Roughly the life of a bench."] },
  { id: "sat_permit", tags: ["a:shopkeeper", "b:office"], lines: ["I need a permit to put out a sandwich board.", "Which size of sandwich?", "Don't make this weird. It's a board."] },
  { id: "sat_hold_music", tags: ["a:office", "a:tired"], lines: ["Forty minutes on hold, and the music's improving.", "Is it a good song?", "It's the same four bars. I've started humming along."] },
  { id: "sat_survey", tags: ["a:office", "b:local", "@plaza"], lines: ["Quick survey: how satisfied are you with surveys?", "Is there a box for tired?", "There's a box for tired. It's sold out."] },
  // ── Money and ambition ─────────────────────────────────────────
  { id: "sat_side_hustle", tags: ["a:student", "b:student", "a:broke"], lines: ["I'm starting a side hustle to fund my main hustle.", "What's the main hustle?", "A side hustle. It's turtles all the way down."] },
  { id: "sat_pitch", tags: ["a:mogul", "b:local", "@office"], lines: ["I'm disrupting the pie industry.", "Disrupting it how, exactly?", "Premium pies, premium prices, same pie."] },
  { id: "sat_networking", tags: ["a:office", "b:office", "evening"], lines: ["Great networking event. I collected nine business cards.", "Any actual conversations?", "Two. Both about the parking."] },
  { id: "sat_brand", tags: ["a:mogul", "b:comic"], lines: ["We're building a personal brand.", "A brand of what, exactly?", "Confidence. We've got plenty in stock."] },
  { id: "sat_budget", tags: ["a:local", "b:local", "a:broke"], lines: ["I've set a strict budget this month.", "How's it going?", "The budget is doing great. I'm the problem."] },
  { id: "sat_mortgage", tags: ["a:office", "b:local", "day"], lines: ["The bank says I can afford a garage in Sydenham.", "For the car?", "For me. Spacious, with a lovely draught."] },
  { id: "sat_promotion", tags: ["a:office", "b:office", "a:tired"], lines: ["I got promoted to Senior Associate.", "Pay rise?", "A lanyard in a nicer colour."] },
  { id: "sat_crypto", tags: ["a:student", "b:local", "a:rich"], lines: ["My coins have gone up three hundred percent.", "Then why are you in the dairy queue?", "They're coins. They don't buy milk. Yet."] },
  // ── Power and corruption ───────────────────────────────────────
  { id: "sat_mayor", tags: ["a:local", "b:local", "@plaza"], lines: ["The mayor's cutting the ribbon on a ribbon factory.", "Is that a conflict of interest?", "It's a very festive one."] },
  { id: "sat_cop_donut", tags: ["a:cop", "b:local", "night"], lines: ["Officer, why did you pull me over?", "Your tail light's out. Also I'm lonely.", "I can do something about one of those."] },
  { id: "sat_inquiry", tags: ["a:office", "b:office", "@court"], lines: ["The inquiry found no wrongdoing.", "Who ran the inquiry?", "The people who did the doing. Very thorough."] },
  { id: "sat_lobby", tags: ["a:mogul", "b:cop", "evening"], lines: ["I'd like to discuss a small road closure.", "Outside my favourite restaurant?", "Funny. That's exactly the road."] },
  { id: "sat_villain", tags: ["a:villain", "b:villain"], lines: ["My plan is to take over the city. Slowly.", "How slowly?", "Slowly enough to fit around my lunch break."] },
  { id: "sat_villain_hr", tags: ["a:villain", "b:villain", "morning"], lines: ["HR says my lair needs a fire exit.", "Did you add one?", "I added a trapdoor. It counts."] },
  { id: "sat_minion_union", tags: ["a:villain", "b:local", "day"], lines: ["My henchmen have started a union.", "Demands?", "A kettle. And not being fed to the sharks."] },
  // ── Loneliness, ageing, small truths ───────────────────────────
  { id: "sat_neighbour", tags: ["a:local", "b:local", "@residential", "evening"], lines: ["I wave at my neighbour every morning.", "Do they wave back?", "They have a very fine curtain."] },
  { id: "sat_pen_pal", tags: ["a:local", "b:local", "@park", "day"], lines: ["I feed the ducks and they know my name.", "What's your name?", "Bread. It's a nickname."] },
  { id: "sat_reunion", tags: ["a:local", "b:local", "evening"], lines: ["School reunion tomorrow. I'm bringing a plus one.", "Who?", "My confidence. It's been in the wardrobe."] },
  { id: "sat_ageing", tags: ["a:local", "b:local", "morning"], lines: ["My knees now predict the weather.", "Accurately?", "Better than the app. And they complain less."] },
  { id: "sat_retire", tags: ["a:shopkeeper", "b:local", "evening"], lines: ["I'm retiring next year.", "You said that last year.", "And the year before. It keeps me interested."] },
  { id: "sat_group_chat", tags: ["a:student", "b:student", "night"], lines: ["The group chat's been silent for three days.", "Should we say something?", "Someone has to type 'lol'. Draw straws."] },
  { id: "sat_thirty", tags: ["a:local", "b:local", "a:tired"], lines: ["Turned thirty. Everything's suddenly an investment.", "Even sleep?", "Especially sleep. I'm over-leveraged."] },
  // ── Signs, tickers and street furniture ────────────────────────
  { id: "sat_sign_a", tags: ["a:tourist", "b:local", "@street"], lines: ["The sign says 'Road Closed, Please Use Other Road'.", "Sound advice.", "Which one's the other road?", "Whichever one isn't closed. Good luck."] },
  { id: "sat_sign_b", tags: ["a:tourist", "b:shopkeeper", "@shops"], lines: ["Your sign says 'Back in 5 minutes'.", "It's been there since March.", "Wow. Five very long minutes."] },
  { id: "sat_ticker", tags: ["a:local", "b:local", "@plaza"], lines: ["Did you see the news ticker? Local man 'fine'.", "Just fine?", "Headline of the day. Slow news week."] },
  { id: "sat_weather_app", tags: ["a:local", "b:local", "rain"], lines: ["The app said fifteen percent chance of rain.", "It's raining.", "Technically I'm the fifteen percent."] },
  { id: "sat_weather_clear", tags: ["a:local", "b:local", "clear", "morning"], lines: ["Gorgeous day. Suspicious, really.", "Where's the catch?", "There's always a nor'wester behind the nice bit."] },
  { id: "sat_storm_roof", tags: ["a:local", "b:local", "storm"], lines: ["Half my roof's in Linwood.", "Are you getting it back?", "I'm sending a polite note. Not holding my breath."] },
  { id: "sat_bin_day", tags: ["a:local", "b:local", "@residential", "morning"], lines: ["Is it bin day?", "I think it's recycling.", "Which bin is that?", "The one the wind's chasing down the road."] },
  { id: "sat_loading_tip", tags: ["a:student", "b:student", "@street"], lines: ["Loading tip: the city is not actually loading.", "Then why's the sign there?", "Atmosphere. And liability."] },
  // ── Everyday food and work ─────────────────────────────────────
  { id: "sat_flatwhite", tags: ["a:barista", "b:office", "morning"], lines: ["That'll be seven dollars for a flat white.", "Is the milk made of gold?", "The milk's in a very good mood. That's the premium."] },
  { id: "sat_pie_review", tags: ["a:local", "b:local", "@food"], lines: ["I'd give this pie four stars.", "Why not five?", "I'm saving the fifth for a pie that loves me back."] },
  { id: "sat_kitchen", tags: ["a:chef", "b:local", "@food"], lines: ["The special is whatever's about to expire.", "What's it called?", "'Chef's Surprise'. Sometimes it's a surprise to me too."] },
  { id: "sat_meeting", tags: ["a:office", "b:office", "@office"], lines: ["That meeting could have been an email.", "That email could have been silence.", "Now you're being radical."] },
  { id: "sat_intern", tags: ["a:office", "b:student", "@office"], lines: ["Congratulations, you're our new unpaid intern.", "What's the learning opportunity?", "Learning to be grateful for unpaid things."] },
  { id: "sat_busker_tip", tags: ["a:busker", "b:local", "@plaza"], lines: ["Tips are appreciated, but exposure is free.", "Is exposure legal tender?", "Only in some very weird councils."] },
  { id: "sat_taxi_meter", tags: ["a:taxi", "b:tourist"], lines: ["The meter's running, but I'm in no hurry.", "Is that how this works?", "It's how it works for me. Enjoy the scenery."] },
];
