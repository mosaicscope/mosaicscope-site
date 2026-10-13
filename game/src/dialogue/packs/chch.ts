import type { Exchange } from "../exchanges";

/**
 * Flatmates, the dairy, the trolley and the nor'wester: a Christchurch life-sim pack built from the
 * "CHCH Life Sim: Five Variations" writers' draft. Each scene is split into two-person exchanges so
 * the engine can play it as call-and-response. Every line names its context (the trolley, the
 * dairy, the mortgage), so a player who joins a conversation mid-way still understands it.
 * Branches and new stories off the same cast are at the end.
 */
export const CHCH: Exchange[] = [
  // ------------------------------------------------------------ the flat (residential)
  { id: "chch_flat_alarm", tags: ["morning", "@residential", "a:student", "b:student"], lines: ["If that alarm doesn't shut up in thirty seconds, I'm going to evolve into a threat.", "You already evolved, bro. That's your final form."] },
  { id: "chch_flat_rent_deadline", tags: ["day", "@residential", "a:student", "b:student"], lines: ["Ash, how are you paying rent? Friday's coming.", "I've been thinking about that. Very hard.", "Think faster. The landlord doesn't do vibes."] },
  { id: "chch_flat_bin_roots", tags: ["day", "@residential", "a:local", "b:student"], lines: ["Ash, your bin's been on the footpath since Thursday. It's got flies.", "It's part of the neighbourhood now. It's got roots.", "Got roots and a smell."] },
  { id: "chch_flat_clock_late", tags: ["late", "@residential", "a:student", "b:student", "a:tired"], lines: ["Why is the kitchen light still on?", "I'm making toast for the trolley. It's been a long day.", "The trolley doesn't eat toast, Ash."] },
  { id: "chch_flat_brunch_plan", tags: ["morning", "@residential", "a:student", "b:student"], lines: ["It's nearly eleven. Get up.", "Brunch for people with a plan.", "Then I'm the most organised man in Riccarton."] },

  // ------------------------------------------------------------ trolley (street, shops)
  { id: "chch_trolley_rescue", tags: ["day", "@street", "a:student", "b:student"], lines: ["Also, we rescued a trolley from the Pak'nSave car park.", "From where?", "Capitalism. It was lonely in there."] },
  { id: "chch_trolley_name", tags: ["day", "@street", "a:student", "b:student"], lines: ["The trolley's name is Trolley Parton. It's official.", "Of course it is.", "It's got big dreams and one wheel that won't turn left."] },
  { id: "chch_trolley_bin_ambition", tags: ["day", "@street", "a:student", "b:local"], lines: ["That trolley's blocking the footpath, Ash.", "It's a bin with ambitions. Leave it alone.", "It knows too much now. We're keeping it."] },
  { id: "chch_trolley_pakn_cold", tags: ["morning", "@shops", "a:student", "b:shopkeeper"], lines: ["Is that your trolley out front?", "It's a rescued trolley. It has a name.", "Trolleys don't have names. Take it back before I call someone."] },
  { id: "chch_trolley_tour_idea", tags: ["day", "@street", "a:student", "b:student", "a:bored"], lines: ["Quick, let's do a tour. Christchurch's Most Haunted Trolley.", "Stop one: the Pak'nSave freezer aisle. Jayden screamed into the frozen peas."] },

  // ------------------------------------------------------------ business ideas and the cone tour
  { id: "chch_cone_business", tags: ["day", "@plaza", "a:student", "b:student"], lines: ["We start a business. Guided road cone tours.", "No one is paying to look at road cones.", "People pay to look at old rocks in Europe.", "Those are castles, Ash."] },
  { id: "chch_cone_heritage", tags: ["day", "@street", "a:student", "b:tourist"], lines: ["Christchurch has a rich heritage of orange plastic.", "Is that a real tour? I'd pay for that.", "You'd be our first customer. Five dollars, cone included."] },
  { id: "chch_cone_german_tourists", tags: ["day", "@plaza", "a:student", "b:student"], lines: ["Honestly, the German tourists would love the cone tour.", "Do not encourage him, Jayden.", "I'm not encouraging. I'm observing the market."] },
  { id: "chch_real_job", tags: ["day", "@office", "a:local", "b:student"], lines: ["You need a real job, Ash.", "Define real.", "Pays money. That's the whole definition."] },
  { id: "chch_westfield_souls", tags: ["day", "@shops", "a:student", "b:student"], lines: ["Westfield steals souls, Ash. It's on the sign.", "The sign's a lie. It's just a carpark with a food court."] },

  // ------------------------------------------------------------ mortgage plains (the satire)
  { id: "chch_mortgage_plains_welcome", tags: ["day", "@street", "a:student", "b:student"], lines: ["Welcome to Christchurch, the Garden City. Ignore the orange cones.", "Ten out of ten, would not recommend to a friend with a mortgage."] },
  { id: "chch_mortgage_personality", tags: ["day", "@residential", "a:student", "b:student"], lines: ["Who's the mortgage for?", "Everyone. Your whole personality is a loan."] },
  { id: "chch_mortgage_paid_off", tags: ["day", "@residential", "a:student", "b:student"], lines: ["Which bit of your personality is paid off, Ash?", "The bit that brings Hokey Pokey to the Sumner Esplanade.", "That's not paying off a mortgage."] },
  { id: "chch_debt_stat", tags: ["day", "@residential", "a:student", "b:student"], lines: ["It's a game mechanic, Ash. Your Debt stat is at ninety.", "Debt's a lifestyle. Loyal, always there."] },
  { id: "chch_debt_cousin", tags: ["day", "@residential", "a:student", "b:student"], lines: ["My Debt stat is at my cousin.", "Your cousin is your landlord.", "Family curse with rent."] },
  { id: "chch_squeezed_families", tags: ["day", "@office", "a:local", "b:student"], lines: ["Some families are actually getting squeezed, Ash.", "Yeah. That's why it needs to be in the game.", "The week runs on a payslip, a bus on time and the landlord's mood."] },
  { id: "chch_tagline", tags: ["day", "@residential", "a:student", "b:student"], lines: ["Then the tagline: Christchurch. It's fine. Probably.", "That's the heart of it, honestly."] },

  // ------------------------------------------------------------ the dairy (shops)
  { id: "chch_dairy_shut", tags: ["day", "@shops", "a:student", "b:student"], lines: ["Dairy's shut.", "It's not shut. It's sulking."] },
  { id: "chch_dairy_banned", tags: ["day", "@shops", "a:student", "b:shopkeeper"], lines: ["You're banned, mate. Because of the voucher.", "I tried to pay with a Rebel Sport voucher. For ten dollars.", "Money is a social agreement. He lacked imagination."] },
  { id: "chch_dairy_call_mum", tags: ["day", "@shops", "a:local", "b:student"], lines: ["He told you he'd call your mum.", "And he would. I've met his mum. Terrifying woman."] },
  { id: "chch_dairy_bribe", tags: ["day", "@shops", "a:student", "b:student"], lines: ["Get the dairy guy to unban you.", "Bring him two V cans and a Pineapple Lump.", "That's not a quest, Ash. That's bribery."] },
  { id: "chch_dairy_hospitality", tags: ["day", "@shops", "a:local", "b:student"], lines: ["You can't keep borrowing from the shop that keeps you alive.", "I don't steal. I borrow with conviction.", "The EFTPOS declined you three times, Ash."] },
  { id: "chch_eftpos_personal", tags: ["day", "@shops", "a:student", "b:student"], lines: ["The EFTPOS machine declined me three times.", "It got personal first.", "Because you only had twelve cents."] },
  { id: "chch_dairy_apology", tags: ["day", "@shops", "a:student", "b:shopkeeper", "a:scared"], lines: ["I'm here to apologise. Two V cans and a Pineapple Lump.", "Apology accepted. Your voucher still isn't.", "Fair. Can I buy milk with my dignity?"] },

  // ------------------------------------------------------------ nor'wester (weather, heart)
  { id: "chch_norwester_back", tags: ["storm", "@street", "a:student", "b:student"], lines: ["The nor'wester's back.", "It's making everyone feral."] },
  { id: "chch_norwester_irritable", tags: ["storm", "@street", "a:student", "b:student", "a:angry"], lines: ["In the game, everyone gets plus ten irritability in a nor'wester.", "That's medically accurate. I've felt it in my teeth."] },
  { id: "chch_quake_not_a_joke", tags: ["day", "@street", "a:local", "b:student"], lines: ["Some things aren't for jokes. Earthquakes, for one.", "Yeah. We don't make it cheap. It's part of the city, not a gimmick."] },
  { id: "chch_quake_show_quiet", tags: ["evening", "@residential", "a:student", "b:student"], lines: ["So how do you show it?", "Quiet. Buildings gone. A character who still sleeps badly when trucks rumble past."] },
  { id: "chch_quake_jokes_or_silence", tags: ["evening", "@residential", "a:student", "b:student"], lines: ["Some people make jokes. Some people go silent.", "That's strong. Keep both in the game."] },
  { id: "chch_ash_backstory", tags: ["evening", "@residential", "a:student", "b:student"], lines: ["You're sounding personal, Ash.", "I'm pre-writing. Dad gone, Mum tired, money bad. The jokes are a wall."] },
  { id: "chch_ash_pre_writing", tags: ["evening", "@residential", "a:student", "b:student"], lines: ["Write that down, Ash.", "After coffee. It's a sacred phase where nothing gets done."] },

  // ------------------------------------------------------------ neighbours and the milk
  { id: "chch_out_of_milk", tags: ["morning", "@residential", "a:student", "b:student"], lines: ["We're out of milk.", "I've got milk next door. Bring the trolley when you come."] },
  { id: "chch_uncle_legend", tags: ["morning", "@residential", "a:local", "b:student"], lines: ["I've got milk next door, Ash. Bring the trolley.", "Uncle, you beautiful legend.", "Don't make it weird."] },

  // ------------------------------------------------------------ viral trolley (party, chaos)
  { id: "chch_trolley_fan_account", tags: ["day", "@street", "a:student", "b:student"], lines: ["Trolley Parton has a fan account now.", "Four followers, and one of them is the council."] },
  { id: "chch_trolley_council_fans", tags: ["day", "@street", "a:student", "b:student"], lines: ["The council are closet fans of anything that blocks a footpath.", "They're not your fans, Ash."] },
  { id: "chch_mum_tired", tags: ["day", "@residential", "a:student", "b:student"], lines: ["She actually said she's not proud of you?", "She said, Ash, I'm not proud, I'm tired.", "Mothers always win."] },
  { id: "chch_haunted_tour_stop_two", tags: ["day", "@street", "a:student", "b:student"], lines: ["Stop two: the bin that's been on the footpath since Thursday.", "It's Sir Fungalot's cousin. Show some respect."] },
  { id: "chch_cone_legend", tags: ["day", "@street", "a:student", "b:student"], lines: ["Stop three: the cone that's been blocking a lane.", "A true Christchurch legend. Respect the cone."] },
  { id: "chch_hashtags", tags: ["day", "@street", "a:student", "b:student"], lines: ["Your hashtags are embarrassing.", "#ChCh4Life #NoWorriesMate #OrangeConeMafia"] },
  { id: "chch_viral_news", tags: ["day", "@street", "a:student", "b:local"], lines: ["Breaking: local man names his trolley after a rock star.", "Christchurch is confused. Put that on the news."] },
  { id: "chch_rules_serious", tags: ["day", "@residential", "a:student", "b:student"], lines: ["Rule: nothing's serious unless someone's bleeding.", "Except the real stuff. Rent. Health. Family.", "Fine. Real stuff gets one slide. Then back to the trolley."] },
  { id: "chch_wet_socks", tags: ["morning", "@residential", "a:local", "b:student"], lines: ["Put your shoes on before you go outside.", "They're outdoor socks.", "They're wet.", "Christened."] },
  { id: "chch_biohazard_goodbye", tags: ["morning", "@residential", "a:student", "b:student"], lines: ["Biohazard.", "Say goodbye to Trolley Parton, everyone.", "Goodbye, stolen property."] },

  // ------------------------------------------------------------ new branches off the same cast
  { id: "chch_branch_bin_gone", tags: ["day", "@residential", "a:local", "b:student"], lines: ["Your bin's gone, Ash. The council took it.", "Good. It was getting a personality.", "It's in Lincoln now. Making friends."] },
  { id: "chch_branch_trolley_taken", tags: ["day", "@street", "a:student", "b:student", "a:angry"], lines: ["Where's Trolley Parton? She's gone.", "The council took her. Her fan club is furious.", "Four followers, all of them furious. That's a movement."] },
  { id: "chch_branch_rent_bought", tags: ["day", "@residential", "a:student", "b:student", "a:happy"], lines: ["I paid rent. Every cent. Look at me.", "You sold the cone tour, didn't you?", "Five dollars, cone included. A proper business."] },
  { id: "chch_branch_crush_trolley", tags: ["evening", "@street", "a:student", "b:student", "crush"], lines: ["You're the only one who laughs at my trolley.", "I'm laughing at the trolley. You're just standing there."] },
  { id: "chch_branch_nw_fire", tags: ["storm", "@residential", "a:student", "b:student", "a:scared"], lines: ["The nor'wester took my hat and the neighbour's bin.", "Bin's fine. The neighbour's the one who's angry.", "Then I'll bring milk. Milk fixes most things."] },
  { id: "chch_branch_dairy_regular", tags: ["morning", "@shops", "a:student", "b:shopkeeper", "a:happy"], lines: ["Morning! Usual please. Milk and a Pineapple Lump.", "You're back? After the voucher?", "The voucher was a learning experience. Mostly for the dairy."] },
  { id: "chch_branch_rent_friday", tags: ["day", "@residential", "a:student", "b:local", "a:broke"], lines: ["I can't pay rent this Friday.", "Then Friday's a cone tour day. Sell them tickets.", "Nobody buys tickets from a broke man in a trolley."] },
  { id: "chch_branch_the_quiet_one", tags: ["evening", "@residential", "a:student", "b:student", "a:tired"], lines: ["Can we just not do the jokes tonight?", "Yeah. Just sit here with me, Ash.", "Okay. Quiet. The trolley can wait till morning."] }
];
