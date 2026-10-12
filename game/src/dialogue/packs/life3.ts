import type { Exchange } from "../exchanges";

/**
 * Life pack 3: the Famiglia Tessera's wiseguys, the Riccarton Boys rivalry, Mannequin Mike's
 * smugglers, and the gamblers and dealers of the Tessera Casino. Loyalty, the Don's tomatoes,
 * contracts, turf, protection pies and long nights at the tables. All cartoon, all adults.
 * Moon Sherbet is a fictional glowing sherbet and nothing else.
 */
export const LIFE_3: Exchange[] = [
  // ── Loyalty and the family ─────────────────────────────────────
  { id: "life3_loyalty_oath", tags: ["a:mobster", "b:mobster"], lines: [
    "Twenty years I've been loyal to this family.",
    "Nineteen. You had that gap year at the Kaikoura whale tours.",
    "That was undercover. I was watching the whales for the Don.",
    "What did the whales do?",
  ] },
  { id: "life3_loyalty_birthday", tags: ["a:mobster", "b:mobster", "a:sad"], lines: [
    "Nobody in the family remembered my birthday.",
    "The Don did. He sent you a tomato with a candle in it.",
    "That was a birthday? I thought it was a warning.",
  ] },
  { id: "life3_loyalty_group_chat", tags: ["a:mobster", "b:mobster"], lines: [
    "Why've I been kicked out of the family group chat?",
    "You sent a thumbs up to the Don's funeral planning.",
    "It was a pre-planning meeting! He's healthy as a horse!",
    "Doesn't matter. Thumbs up on a funeral is a statement.",
  ] },
  { id: "life3_loyalty_rat", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "Gina reckons there's a rat in the family.",
    "There is. It lives behind the casino fryer. Big fella.",
    "Not that kind of rat, Paulie. Although also, call someone.",
  ] },
  { id: "life3_loyalty_kneel", tags: ["a:mobster", "b:mobster"], lines: [
    "When you meet the Don, you kiss the ring.",
    "Which ring? He's got eleven.",
    "The tomato-shaped one. Never the one from the cereal box.",
  ] },
  { id: "life3_loyalty_family_dinner", tags: ["a:mobster", "b:mobster", "evening"], lines: [
    "Sunday dinner at the Don's. Bring a dish.",
    "I'll bring my famous sausage rolls.",
    "Bring them in a nicer dish. Last time you brought the bag.",
  ] },
  { id: "life3_loyalty_seat", tags: ["a:mobster", "b:mobster"], lines: [
    "You're sitting in Uncle Carmine's chair.",
    "Uncle Carmine retired to the Gold Coast eight years ago.",
    "And the chair waits. That's loyalty. Shift over.",
  ] },
  { id: "life3_loyalty_tattoo", tags: ["a:mobster", "b:mobster"], lines: [
    "Got the family crest tattooed on my shoulder.",
    "That's a tomato with a moustache.",
    "That IS the family crest. Did you not read the newsletter?",
  ] },
  { id: "life3_loyalty_newsletter", tags: ["a:mobster", "b:mobster", "morning"], lines: [
    "Gina's sent out the monthly family newsletter.",
    "Anything good?",
    "Tomato update, a recipe, and a list of who's in trouble.",
    "Am I on the list?",
  ] },
  { id: "life3_loyalty_retire", tags: ["a:mobster", "b:mobster", "a:tired"], lines: [
    "Nobody leaves the family, you know that.",
    "I just want to retire to Akaroa and open a bait shop.",
    "Akaroa's family turf. You'd be selling bait to us.",
  ] },
  { id: "life3_loyalty_mum", tags: ["a:mobster", "b:local"], lines: [
    "My mum still thinks I sell insurance.",
    "Does she ever ask what kind?",
    "I said tomato insurance. She was very proud.",
  ] },
  { id: "life3_loyalty_secret_handshake", tags: ["a:mobster", "b:mobster"], lines: [
    "You forgot the secret handshake again.",
    "It's got nine steps and a sneeze in the middle.",
    "The sneeze is so outsiders think we're just unwell.",
  ] },
  { id: "life3_loyalty_promotion", tags: ["a:mobster", "b:mobster", "a:happy"], lines: [
    "The Don's made me a captain!",
    "Of what?",
    "Of the casino car park. Forty spaces, all mine.",
    "Long may you reign over the disabled bay. Don't park in it.",
  ] },
  { id: "life3_loyalty_demoted", tags: ["a:mobster", "b:mobster", "a:sad"], lines: [
    "I've been demoted to tomato stake duty.",
    "What did you do?",
    "Called the Don's basil 'a bit much'. Out loud.",
  ] },
  { id: "life3_loyalty_omerta", tags: ["a:mobster", "b:cop"], lines: [
    "I know my rights. I'm saying nothing.",
    "I only asked if you wanted a sticker for donating blood.",
    "...Strawberry one. And I said nothing about this.",
  ] },
  { id: "life3_loyalty_funeral_flowers", tags: ["a:mobster", "b:vendor", "@market"], lines: [
    "Need a wreath. Big one. Says Sorry For Your Loss.",
    "Who passed?",
    "Nobody yet. The Riccarton Boys' hubcap stall. Thursday.",
  ] },
  { id: "life3_loyalty_cousin", tags: ["a:mobster", "b:mobster"], lines: [
    "My cousin from Palmerston North wants to join the family.",
    "What can he do?",
    "Stand very still and look disappointed.",
    "Hire him. That's half the job.",
  ] },
  { id: "life3_loyalty_tracksuit_ban", tags: ["a:mobster", "b:mobster", "morning"], lines: [
    "You're wearing trackpants to a family meeting.",
    "They're Italian trackpants. Says so on the bum.",
    "Nothing says Riccarton like writing on the bum. Change.",
  ] },
  { id: "life3_loyalty_compliment", tags: ["a:mobster", "b:mobster"], lines: [
    "The Don said I did 'okay' today.",
    "Okay? He's never said okay to anyone.",
    "I know. I've had it framed.",
  ] },
  { id: "life3_loyalty_wedding_seat", tags: ["a:mobster", "b:mobster", "party"], lines: [
    "Why are we at the kids' table at Gina's engagement?",
    "Remember the pavlova incident?",
    "One pavlova. One time. A man is not his pavlova.",
  ] },
  { id: "life3_loyalty_hospital", tags: ["a:mobster", "b:medic", "@hospital"], lines: [
    "I'm here to visit Sal. Family.",
    "Visiting hours ended at eight.",
    "The Don sends grapes. And regards. And more grapes.",
    "...Five minutes. Leave some grapes at the desk.",
  ] },
  { id: "life3_loyalty_new_guy", tags: ["a:mobster", "b:mobster", "strangers"], lines: [
    "You the new guy? What do they call you?",
    "Kevin.",
    "No, your name in the family. Your nickname.",
    "They're still deciding between Kev and Other Kev.",
  ] },
  { id: "life3_loyalty_earthquake", tags: ["a:mobster", "b:mobster"], lines: [
    "Family's been here since before the quakes.",
    "Back when the casino was a garage with a pokie in it.",
    "One pokie, and the Don guarding it with a hose. Good days.",
  ] },
  { id: "life3_loyalty_sit_down", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "The Don's calling a sit-down. Wear something nice.",
    "Is it serious?",
    "There's a seating plan. Name cards. It's very serious.",
  ] },
  { id: "life3_loyalty_kiss_cheek", tags: ["a:mobster", "b:mobster", "friends"], lines: [
    "Why'd you kiss me on both cheeks?",
    "It's what the family does. Respect.",
    "We're in the queue at Countdown, Tony.",
  ] },
  { id: "life3_loyalty_ute", tags: ["a:mobster", "b:mechanic"], lines: [
    "Family needs a getaway car. Something classy.",
    "I've got a 1998 Corolla with a tape deck.",
    "The Don loves a tape deck. Does it have Dean Martin in it?",
    "It's got a pan pipes tape jammed in it forever.",
  ] },
  { id: "life3_loyalty_jacket", tags: ["a:mobster", "b:mobster", "storm"], lines: [
    "My good suit jacket blew into the Avon.",
    "The nor'wester takes what it wants.",
    "Tell the Don I lost it in the line of duty.",
  ] },
  { id: "life3_loyalty_eel", tags: ["a:mobster", "b:mobster", "@park"], lines: [
    "You know what sleeping with the eels means?",
    "You get thrown in the Avon?",
    "You get taken to feed the eels at dawn. Every day. Forever.",
    "That's actually quite peaceful.",
  ] },

  // ── The Don's tomatoes ─────────────────────────────────────────
  { id: "life3_tom_frost", tags: ["a:mobster", "b:mobster", "late"], lines: [
    "Frost warning tonight. The Don wants the vines covered.",
    "With what?",
    "Your duvet. He was very specific.",
  ] },
  { id: "life3_tom_nor_wester", tags: ["a:mobster", "b:mobster", "storm"], lines: [
    "The nor'wester's flattened the tomato cages!",
    "The Don's going to want names.",
    "Of who? The wind?",
    "Get me the wind's address.",
  ] },
  { id: "life3_tom_rain_good", tags: ["a:mobster", "b:mobster", "rain"], lines: [
    "Finally, rain. The vines needed it.",
    "So I don't have to carry the watering can today?",
    "You carry it anyway. In case the rain gets lazy.",
  ] },
  { id: "life3_tom_sun", tags: ["a:mobster", "b:mobster", "clear"], lines: [
    "Clear day. Rotate the pots a quarter turn every hour.",
    "Every hour?",
    "The Don says a tomato should tan evenly. Like a gentleman.",
  ] },
  { id: "life3_tom_neighbour", tags: ["a:mobster", "b:local", "@residential"], lines: [
    "The Don says your lemon tree is shading his tomatoes.",
    "It's my lemon tree. On my side.",
    "And the shade is on his side. That's trespassing shade.",
  ] },
  { id: "life3_tom_naming", tags: ["a:mobster", "b:mobster"], lines: [
    "The Don's named every plant. Which one's Bianca?",
    "Third from the fence. Don't look at her directly.",
    "Why not?",
    "She's going through something. Blossom end rot.",
  ] },
  { id: "life3_tom_competition", tags: ["a:mobster", "b:mobster", "a:angry"], lines: [
    "Some nana in Papanui grew a bigger tomato than the Don.",
    "How much bigger?",
    "Forty grams. He's taken it personally.",
    "Do we visit her?",
  ] },
  { id: "life3_tom_nana", tags: ["a:mobster", "b:local"], lines: [
    "Are you the nana with the forty-gram advantage?",
    "Sheep poo pellets, love. That's my secret.",
    "...Can I write that down? For an associate.",
  ] },
  { id: "life3_tom_seaweed", tags: ["a:mobster", "b:mobster", "morning"], lines: [
    "Don wants seaweed from Sumner for the compost.",
    "Fresh or the stuff that smells like a wet dog's diary?",
    "The diary stuff. It's got character.",
  ] },
  { id: "life3_tom_slug", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "Found a slug on the Roma plants.",
    "What do we do?",
    "We don't do anything. We relocate him to Riccarton.",
  ] },
  { id: "life3_tom_heirloom", tags: ["a:mobster", "b:shopkeeper"], lines: [
    "Got any heirloom seeds? Black Krim. The good ones.",
    "Just the Yates rack, mate.",
    "The Don's grandfather smuggled his in a sock. Fine. Yates.",
  ] },
  { id: "life3_tom_gift", tags: ["a:mobster", "b:barista", "morning"], lines: [
    "The Don sends you one tomato. Hand-picked.",
    "Is that a thank you or a threat?",
    "It's a tomato. Read into it what you like.",
  ] },
  { id: "life3_tom_sauce_day", tags: ["a:mobster", "b:mobster", "day"], lines: [
    "It's sauce day. Everyone to the Don's garage.",
    "I've got a dentist appointment.",
    "Nobody has teeth on sauce day. Move it.",
  ] },
  { id: "life3_tom_jar_count", tags: ["a:mobster", "b:mobster"], lines: [
    "Four hundred jars of passata this year.",
    "What does he do with them all?",
    "Christmas presents. To judges. And a few councillors.",
  ] },
  { id: "life3_tom_kea", tags: ["a:mobster", "b:zookeeper"], lines: [
    "One of Velvet's kea has been at the Don's tomatoes.",
    "Kea get around. Did it take anything else?",
    "Two tomatoes and the wiper off my Commodore.",
    "That's our boy. He's got a type.",
  ] },
  { id: "life3_tom_greenhouse", tags: ["a:mobster", "b:mobster", "a:scared"], lines: [
    "I cracked a pane in the Don's glasshouse.",
    "Tell him.",
    "I'm going to tell him it was a Riccarton hubcap.",
    "Clever. It's always a hubcap.",
  ] },
  { id: "life3_tom_playlist", tags: ["a:mobster", "b:musician"], lines: [
    "Can you play opera to tomatoes? It's a paid gig.",
    "How many tomatoes?",
    "Thirty-two plants. They like Puccini and the odd sea shanty.",
  ] },
  { id: "life3_tom_photo", tags: ["a:photographer", "b:mobster"], lines: [
    "The Don wants his tomatoes photographed for a calendar?",
    "Twelve months, twelve tomatoes. Moody lighting.",
    "Who buys a tomato calendar?",
    "Everyone he gives one to. That's the beauty of it.",
  ] },
  { id: "life3_tom_mosaic_shoot", tags: ["a:mosaic", "b:mobster"], lines: [
    "Shot the Don's tomato for the calendar. Very red.",
    "He wants a reshoot. Bianca didn't look herself.",
    "She's a tomato.",
    "She's a tomato with a reputation. Reshoot, {a}.",
  ] },
  { id: "life3_tom_stakes", tags: ["a:mobster", "b:shopkeeper", "@shops"], lines: [
    "Need sixty bamboo stakes.",
    "Planning something?",
    "Tomatoes. You know what else needs staking? Nothing. Rude.",
  ] },
  { id: "life3_tom_harvest_party", tags: ["a:mobster", "b:mobster", "party"], lines: [
    "Harvest party at the Don's. There's a tomato queen.",
    "Who's the queen this year?",
    "Same as every year. A tomato. In a little crown.",
  ] },
  { id: "life3_tom_stolen_hose", tags: ["a:mobster", "b:mobster", "after:crime"], lines: [
    "{who} just legged it with the Don's garden hose.",
    "The forty-metre one with the brass fitting?",
    "Nobody take that hose from him. Not in summer.",
  ] },
  { id: "life3_tom_cop_tip", tags: ["a:cop", "b:mobster"], lines: [
    "I've got a tip-off you've got a grow operation.",
    "Thirty-two tomato plants and a bag of blood and bone.",
    "...What do you feed them? Mine keep splitting.",
    "Water deep, not often. Tell nobody I helped a cop.",
  ] },
  { id: "life3_tom_dream", tags: ["a:mobster", "b:mobster", "late"], lines: [
    "The Don rang at 3am. Said he had a dream about aphids.",
    "What did he want?",
    "Ladybirds. Four hundred. Before sunrise.",
  ] },
  { id: "life3_tom_ladybirds", tags: ["a:mobster", "b:vendor", "@market"], lines: [
    "I need every ladybird you've got.",
    "We sell honey, mate.",
    "Then ask your bees who owes the Don a favour.",
  ] },
  { id: "life3_tom_first", tags: ["a:mobster", "b:mobster", "a:happy"], lines: [
    "First ripe tomato of the season!",
    "The Don's crying in the glasshouse.",
    "Leave him. This is his Christmas.",
  ] },
  { id: "life3_tom_chutney", tags: ["a:chef", "b:mobster", "@food"], lines: [
    "Your boss wants me to put his tomatoes on the menu?",
    "Every dish. Even dessert.",
    "Tomato pavlova?",
    "He's told you about the pavlova. Good. You're ready.",
  ] },
  { id: "life3_tom_fake", tags: ["a:mobster", "b:mobster", "a:scared"], lines: [
    "I've been replacing the eaten tomatoes with supermarket ones.",
    "With the little stickers on them?",
    "I peel the stickers. I'm not an animal.",
  ] },
  { id: "life3_tom_botanic", tags: ["a:mobster", "b:local", "@park"], lines: [
    "The Don tried to buy the Botanic Gardens' vege patch.",
    "It's public land.",
    "That's what they told him. He's still deciding to believe it.",
  ] },
  { id: "life3_tom_hail", tags: ["a:mobster", "b:mobster", "storm"], lines: [
    "Hail's coming over the Port Hills!",
    "Get the umbrellas! All of them!",
    "Even the casino golf umbrellas?",
    "Especially those. Branding's important in a crisis.",
  ] },

  // ── Gina Tessera, the brains ───────────────────────────────────
  { id: "life3_gina_spreadsheet", tags: ["a:mobster", "b:mobster", "@office"], lines: [
    "Gina's put the whole family into a spreadsheet.",
    "Am I a row or a column?",
    "You're a cell highlighted orange. Orange is not good.",
  ] },
  { id: "life3_gina_meeting", tags: ["a:mobster", "b:mobster", "morning"], lines: [
    "Gina wants a stand-up meeting at nine.",
    "Why standing?",
    "So Nico doesn't get comfortable and start narrating.",
  ] },
  { id: "life3_gina_kpi", tags: ["a:mobster", "b:mobster", "a:sad"], lines: [
    "Gina says my KPIs are down.",
    "What are your KPIs?",
    "Pies collected, frowns delivered, and staying off Facebook.",
    "Ah. You posted that sunset again.",
  ] },
  { id: "life3_gina_accountant", tags: ["a:mobster", "b:vigilante"], lines: [
    "Gina says you did your own taxes in four minutes.",
    "I'm an accountant by day. That's no secret.",
    "Everything about you is no secret, Bryce. Got a card?",
  ] },
  { id: "life3_gina_laptop", tags: ["a:mobster", "b:mobster"], lines: [
    "Don't touch Gina's laptop.",
    "I only wanted to check the rugby score.",
    "Last guy who checked the rugby on it now runs our Ashburton office.",
  ] },
  { id: "life3_gina_plan", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "Gina's got a plan to take the Riccarton turf.",
    "Guns? Muscle?",
    "A cheaper loyalty card. Five coffees, sixth one free.",
    "Brutal. She's the Don's niece all right.",
  ] },
  { id: "life3_gina_reception", tags: ["a:local", "b:mobster", "@casino"], lines: [
    "I'd like to speak to whoever's in charge.",
    "You'd like to speak to Gina. Nobody likes speaking to Gina.",
    "Why?",
    "She listens. Then she remembers. Forever.",
  ] },
  { id: "life3_gina_pies", tags: ["a:mobster", "b:mobster"], lines: [
    "Gina wants the pie collections on an app.",
    "An app for protection pies?",
    "Tap to pay. Choose mince or steak and cheese. Rate your fear.",
  ] },
  { id: "life3_gina_nico", tags: ["a:mobster", "b:mobster", "a:angry"], lines: [
    "Gina's banned Nico from saying 'capisce'.",
    "Good. He's not even Italian. He's from Rangiora.",
    "He said it at the bank. To the teller. Twice.",
  ] },
  { id: "life3_gina_phd", tags: ["a:student", "b:mobster"], lines: [
    "Is it true the Don's niece has a business degree?",
    "Two. And she failed nobody's class but her own.",
    "That doesn't make sense.",
    "She gave herself a B. Too generous. Strict woman.",
  ] },
  { id: "life3_gina_redtape", tags: ["a:mobster", "b:office", "@office"], lines: [
    "Gina sent me to lodge the casino's liquor licence.",
    "Form 7B, triplicate, black ink only.",
    "This is the scariest thing I've ever done.",
  ] },

  // ── Nico Fontana, who thinks he's in a film ────────────────────
  { id: "life3_nico_slowmo", tags: ["a:mobster", "b:mobster"], lines: [
    "Why is Nico walking in slow motion down Colombo St?",
    "He says the soundtrack's kicked in.",
    "There's no soundtrack. It's a Lime scooter beeping.",
  ] },
  { id: "life3_nico_narration", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "Christchurch. A city of cones and secrets.",
    "Nico, mate, you're doing the voiceover out loud again.",
    "Little did I know, my associate would ruin the moment.",
  ] },
  { id: "life3_nico_sunglasses", tags: ["a:mobster", "b:mobster", "late"], lines: [
    "Why the sunglasses at four in the morning, Nico?",
    "Cinematic lighting.",
    "You just walked into the casino door.",
    "The door was in shadow. Practical effect.",
  ] },
  { id: "life3_nico_director", tags: ["a:mobster", "b:photographer"], lines: [
    "Are you the director? I'm ready for my close-up.",
    "I'm photographing the Arts Centre for a client.",
    "Then I'll be in the background. Brooding. Free of charge.",
  ] },
  { id: "life3_nico_credits", tags: ["a:mobster", "b:mobster", "a:sad"], lines: [
    "Nico's sitting in the car waiting for the credits.",
    "What credits?",
    "He thinks every job ends with credits. It's been an hour.",
  ] },
  { id: "life3_nico_monologue", tags: ["a:mobster", "b:shopkeeper"], lines: [
    "You come into my dairy, on the day of my daughter's...",
    "Mate, you're the one in my dairy. And it's my dairy.",
    "...Line. What's my line?",
  ] },
  { id: "life3_nico_rain", tags: ["a:mobster", "b:mobster", "rain"], lines: [
    "Nico's standing in the rain on Cashel Mall again.",
    "Moody?",
    "He reckons it's the turning point of the second act.",
    "It's a Tuesday. He'll get the flu in act three.",
  ] },
  { id: "life3_nico_audition", tags: ["a:mobster", "b:mosaic"], lines: [
    "I hear you shoot music videos. I'm available.",
    "What can you do?",
    "Stare out a car window for three minutes. Award-worthy.",
  ] },
  { id: "life3_nico_stunt", tags: ["a:mobster", "b:medic", "a:hurt"], lines: [
    "I did my own stunt off the casino loading dock.",
    "It's one metre high.",
    "And I'd do it again. For the art.",
    "Your ankle wouldn't. Sit down.",
  ] },
  { id: "life3_nico_trailer", tags: ["a:mobster", "b:mobster"], lines: [
    "In a world... where tomatoes rule...",
    "Nico, we're at the Don's garden. Shush.",
    "One man... must water them. Coming this summer.",
  ] },
  { id: "life3_nico_cop", tags: ["a:cop", "b:mobster"], lines: [
    "You're not going to run, are you?",
    "Officer, in this scene I run. It's in the script.",
    "There's no script.",
    "Then I improvise. Which is walking. Briskly.",
  ] },
  { id: "life3_nico_popcorn", tags: ["a:mobster", "b:mobster", "evening"], lines: [
    "Why do you bring popcorn to collections?",
    "In case it gets dramatic.",
    "It's Sal getting a mince pie off a dairy owner.",
    "That IS dramatic. Did you see his eyebrows?",
  ] },
  { id: "life3_nico_oscars", tags: ["a:local", "b:mobster"], lines: [
    "Who are you talking to? There's nobody there.",
    "The camera. There's always a camera.",
    "That's a CCTV dome on a lamp post.",
    "And it's never missed one of my good sides.",
  ] },

  // ── Sal "Two Pies" Moretti and the protection pies ─────────────
  { id: "life3_pies_why_two", tags: ["a:local", "b:mobster"], lines: [
    "Why do they call you Two Pies?",
    "One for the Don. One for me.",
    "What if there's only one pie?",
    "Then there's a problem. And I'm the solution.",
  ] },
  { id: "life3_pies_bakery", tags: ["a:mobster", "b:shopkeeper", "morning"], lines: [
    "Morning. The usual arrangement.",
    "Two mince, one steak and cheese, in the paper bag.",
    "And the brown sauce. Don't make me ask for the sauce.",
  ] },
  { id: "life3_pies_cold", tags: ["a:mobster", "b:shopkeeper", "a:angry"], lines: [
    "This pie's lukewarm in the middle.",
    "Pie warmer's on the blink.",
    "A cold centre is an insult to the family. Fix it by Friday.",
  ] },
  { id: "life3_pies_vegan", tags: ["a:shopkeeper", "b:mobster"], lines: [
    "We've gone vegan. Protection this week's a lentil pie.",
    "Lentils.",
    "With a lovely flaky crust.",
    "...Okay that's actually good. Don't tell Sal I said so.",
  ] },
  { id: "life3_pies_sal_diet", tags: ["a:mobster", "b:mobster", "a:sad"], lines: [
    "Sal's doctor told him to cut back on pies.",
    "That's his whole job.",
    "He's Two Pies. He can't go down to One Pie. Who'd fear him?",
  ] },
  { id: "life3_pies_one_pie", tags: ["a:mobster", "b:mobster"], lines: [
    "Sal's trying to rebrand as Sal 'One Pie and a Salad'.",
    "That's not going to scare anyone.",
    "Scared the salad. It hid under the pie.",
  ] },
  { id: "life3_pies_receipt", tags: ["a:shopkeeper", "b:mobster"], lines: [
    "Can I get a receipt for the protection pies?",
    "A receipt?",
    "My accountant says I can claim them as security costs.",
  ] },
  { id: "life3_pies_flaky", tags: ["a:mobster", "b:mobster", "@street"], lines: [
    "You've got pastry flakes all down your good suit.",
    "That's how they know I've been collecting.",
    "Like a lion with a mane of crumbs.",
  ] },
  { id: "life3_pies_late", tags: ["a:mobster", "b:shopkeeper", "late"], lines: [
    "You're closed? It's collection night.",
    "It's two in the morning, Sal.",
    "Pies don't sleep. Neither does respect. Do you have a toastie?",
  ] },
  { id: "life3_pies_pie_cart", tags: ["a:mobster", "b:vendor", "@food"], lines: [
    "This is a new pie cart on Tessera turf.",
    "It's a council-approved site.",
    "Council doesn't eat pies. The Don does. Two a week, please.",
  ] },
  { id: "life3_pies_quiche", tags: ["a:shopkeeper", "b:mobster"], lines: [
    "We ran out of pies. I've got a quiche.",
    "A quiche is a pie that's given up.",
    "It's got bacon in it.",
    "...A pie that's given up but kept its dignity. Fine.",
  ] },
  { id: "life3_pies_raid", tags: ["a:cop", "b:mobster"], lines: [
    "Your boot's full of pies. Where'd they come from?",
    "Gifts. From grateful businesses.",
    "Grateful for what?",
    "For nothing happening. Nothing's been happening for years.",
  ] },
  { id: "life3_pies_review", tags: ["a:mobster", "b:mobster", "day"], lines: [
    "Sal rates every pie out of ten in a little notebook.",
    "What's the top score?",
    "A nine. Bakery in Lyttelton. He nearly let them off for life.",
  ] },
  { id: "life3_pies_lyttelton", tags: ["a:mobster", "b:shopkeeper"], lines: [
    "Your pie got a nine from Sal. The family's grateful.",
    "Does that mean no more protection?",
    "It means more protection. Better pies need more protecting.",
  ] },
  { id: "life3_pies_hot_hands", tags: ["a:mobster", "b:mobster", "a:hurt"], lines: [
    "Burnt my mouth on a protection pie.",
    "You never wait.",
    "Waiting makes you look weak. My tongue is a price I pay.",
  ] },
  { id: "life3_pies_supermarket", tags: ["a:mobster", "b:shopkeeper", "@shops"], lines: [
    "Is this the bakery section manager?",
    "Supermarket bakery, yeah.",
    "Twelve-pack of mince pies. Then we never speak of this.",
  ] },
  { id: "life3_pies_new_shop", tags: ["a:shopkeeper", "b:shopkeeper"], lines: [
    "A bloke in a pinstripe just asked for two pies a week.",
    "Welcome to Manchester St. Give him the good ones.",
    "What happens if I don't?",
    "Your pie warmer starts making a funny noise. Every time.",
  ] },
  { id: "life3_pies_quota", tags: ["a:mobster", "b:mobster", "evening"], lines: [
    "Thirty pies collected today.",
    "Where are they?",
    "Twenty-eight are with the Don. Two are a private matter.",
  ] },
  { id: "life3_pies_sausage_roll", tags: ["a:shopkeeper", "b:mobster"], lines: [
    "Will sausage rolls do this week?",
    "Sausage rolls are a pie that went for a lie down.",
    "So yes?",
    "Yes. But they'll be talked about.",
  ] },
  { id: "life3_pies_barista", tags: ["a:barista", "b:mobster", "morning"], lines: [
    "We don't do pies here. Just coffee.",
    "Then I'll take protection in flat whites.",
    "How many?",
    "Two. Obviously. The name's not One Flat White.",
  ] },
  { id: "life3_pies_hungry", tags: ["a:mobster", "b:mobster", "a:hungry"], lines: [
    "I'm so hungry I could eat the Don's pies.",
    "Don't even joke. Remember Vinnie?",
    "He's alright now. Lovely life in Gore.",
    "Gore, Mikey. Think about that.",
  ] },
  { id: "life3_pies_bribe", tags: ["a:shopkeeper", "b:cop"], lines: [
    "Officer, the mob takes two pies off me every week.",
    "That's extortion. I'll write it down.",
    "Want a pie while you write?",
    "...This is how it starts, isn't it.",
  ] },

  // ── Contracts and jobs ─────────────────────────────────────────
  { id: "life3_contract_out", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "The Don's put out a contract.",
    "On who?",
    "The council. For better parking outside the casino.",
    "Oh, an actual contract. With a pen.",
  ] },
  { id: "life3_contract_fine_print", tags: ["a:mobster", "b:mobster", "@office"], lines: [
    "Gina's contracts have fine print you need a microscope for.",
    "What's it say?",
    "Clause nine: all tomatoes remain property of the Don.",
  ] },
  { id: "life3_contract_whack", tags: ["a:mobster", "b:mobster"], lines: [
    "I've been given my first job. A whacking.",
    "Who are you whacking?",
    "The pinata at Gina's birthday. It's got a Riccarton face.",
  ] },
  { id: "life3_contract_signature", tags: ["a:mobster", "b:local"], lines: [
    "Sign here, here, and initial there.",
    "What am I signing?",
    "That you didn't sign anything. It's a very clever document.",
  ] },
  { id: "life3_contract_hit_list", tags: ["a:mobster", "b:mobster", "a:scared"], lines: [
    "I found the Don's hit list!",
    "Let me see. Aphids, whitefly, possums, Riccarton...",
    "It's a gardening list.",
    "Possums were circled three times. Dark stuff.",
  ] },
  { id: "life3_contract_wet_job", tags: ["a:mobster", "b:mobster", "rain"], lines: [
    "Gina says this job's a wet job.",
    "Like the films?",
    "Like the Don's gutters are blocked and you're on the ladder.",
  ] },
  { id: "life3_contract_payday", tags: ["a:mobster", "b:mobster", "a:broke"], lines: [
    "When do we get paid for the Sumner job?",
    "End of the month. In casino chips.",
    "I can't pay my rent in casino chips.",
    "Your landlord's family. He'll take them.",
  ] },
  { id: "life3_contract_freelance", tags: ["a:mobster", "b:mobster"], lines: [
    "I've been doing some freelance muscle on the side.",
    "For who?",
    "A nana in Fendalton. Opening jars. She tips in scones.",
  ] },
  { id: "life3_contract_mover", tags: ["a:mobster", "b:local", "@residential"], lines: [
    "Family's here to help you move. Free of charge.",
    "Why?",
    "The Don says you were kind to a tomato once.",
    "I... I bought one at the market?",
  ] },
  { id: "life3_contract_nda", tags: ["a:mobster", "b:photographer"], lines: [
    "Before you shoot the Don's birthday, sign the NDA.",
    "It says if I talk I get 'tomatoed'?",
    "Nobody knows what that means. That's what makes it work.",
  ] },
  { id: "life3_contract_tradie", tags: ["a:mobster", "b:mechanic", "@street"], lines: [
    "The Don needs his garage door fixed. Discreetly.",
    "Discreetly how?",
    "Don't look at the four hundred jars of passata.",
  ] },
  { id: "life3_contract_debt", tags: ["a:mobster", "b:broke"], lines: [
    "The Don's loan was due Friday.",
    "Can I pay it off in instalments?",
    "He accepts instalments. And weeding. Mostly weeding.",
  ] },
  { id: "life3_contract_debt_weed", tags: ["a:local", "b:mobster", "a:tired"], lines: [
    "Six hours I've been weeding to pay off a $50 loan.",
    "Interest.",
    "In what, dandelions?",
    "Compound dandelions. Gina did the maths.",
  ] },
  { id: "life3_contract_alibi", tags: ["a:mobster", "b:barista"], lines: [
    "I was here all morning. Remember?",
    "You walked in two minutes ago.",
    "And I've been here in spirit since six. Large mochaccino.",
  ] },
  { id: "life3_contract_kiwisignal", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "The Kiwi-signal's up over the Square.",
    "Postpone the job. Bryce'll be out in his costume.",
    "Doesn't he have an audit tomorrow?",
    "He'll be tired. Do the job tomorrow then.",
  ] },
  { id: "life3_contract_quake_lair", tags: ["a:mobster", "b:villain"], lines: [
    "The Don wants to rent your lair for storage.",
    "My lair under the Arts Centre? For what?",
    "Passata. It's very cool and dark down there.",
    "...Do I get a jar?",
  ] },
  { id: "life3_contract_velvet", tags: ["a:mobster", "b:mogul"], lines: [
    "The Don offers you a deal on the Pink Pukeko.",
    "Tell Vito the price has silk in it.",
    "He says your silk is polyester.",
    "How dare— it is a blend. A blend!",
  ] },
  { id: "life3_contract_job_board", tags: ["a:mobster", "b:mobster", "morning"], lines: [
    "What's on the job board today?",
    "Collect pies, scare a hubcap stall, pick up dry cleaning.",
    "In that order?",
    "Dry cleaning first. The Don has a lunch.",
  ] },

  // ── Turf and the Riccarton Boys ────────────────────────────────
  { id: "life3_turf_map", tags: ["a:mobster", "b:mobster"], lines: [
    "Our turf's everything inside the four avenues.",
    "And the Riccarton Boys?",
    "Everything west of Deans Ave. And a Burger King.",
  ] },
  { id: "life3_turf_deans_line", tags: ["a:mobster", "b:mobster", "rivals"], lines: [
    "You're on the wrong side of Deans Ave, Riccarton.",
    "I'm getting a coffee, Tessera. It's a free country.",
    "Coffee's free. The footpath costs two hubcaps.",
  ] },
  { id: "life3_turf_hubcap_offer", tags: ["a:mobster", "b:local"], lines: [
    "Some bloke tried to sell me hubcaps outside Westfield.",
    "Riccarton Boys. Were they nice hubcaps?",
    "One was off my own car. He wanted forty bucks.",
  ] },
  { id: "life3_turf_hubcap_hagley", tags: ["a:mobster", "b:mobster", "rivals", "@park"], lines: [
    "Get your hubcaps off Hagley Park.",
    "It's a park. It's for everyone.",
    "Then everyone can see your hubcaps don't fit a single car.",
  ] },
  { id: "life3_turf_tracksuit_colours", tags: ["a:mobster", "b:mobster", "rivals"], lines: [
    "Nice tracksuit. Shame about the colour.",
    "It's teal. Teal's the new black.",
    "Teal's the new 'I lost a bet'. Off my street.",
  ] },
  { id: "life3_turf_food_court", tags: ["a:mobster", "b:mobster", "rivals", "@food"], lines: [
    "This is my table. I always sit by the dumpling place.",
    "No names on tables, mate.",
    "There's a fork scratch shaped like a tomato. That's a name.",
  ] },
  { id: "life3_turf_dance_off", tags: ["a:mobster", "b:mobster", "rivals", "party"], lines: [
    "Riccarton. Dance floor. Now.",
    "You can't dance in a three-piece suit.",
    "Watch me. Waistcoat's breathable. Gina checked.",
  ] },
  { id: "life3_turf_hubcap_raid", tags: ["a:mobster", "b:mobster", "after:fight"], lines: [
    "Did we win?",
    "We took forty hubcaps off them.",
    "What do we do with forty hubcaps?",
    "Gina's making them into tomato planters. Very ironic.",
  ] },
  { id: "life3_turf_truce", tags: ["a:mobster", "b:mobster", "rivals"], lines: [
    "The Don's offering a truce. Two tomatoes, one handshake.",
    "Our boss wants three tomatoes.",
    "Three? Who does he think he is? Sal?",
  ] },
  { id: "life3_turf_bus", tags: ["a:mobster", "b:mobster", "rivals", "@street"], lines: [
    "Are you on the Orbiter into our turf?",
    "It's the bus, mate. It goes in a circle.",
    "Then circle back out. Tessera territory starts at Bealey.",
  ] },
  { id: "life3_turf_rugby", tags: ["a:mobster", "b:mobster", "rivals"], lines: [
    "Touch rugby, Saturday, Hagley. Loser leaves Cashel Mall.",
    "Touch? Not tackle?",
    "The Don's knee. Also my suits. Touch.",
  ] },
  { id: "life3_turf_rugby_result", tags: ["a:mobster", "b:mobster", "a:sad"], lines: [
    "We lost the touch game to the Riccarton Boys.",
    "How?",
    "Nico did a slow-motion dive. Took him four minutes to land.",
  ] },
  { id: "life3_turf_spy", tags: ["a:mobster", "b:mobster", "night"], lines: [
    "I went undercover with the Riccarton Boys.",
    "What did you learn?",
    "Their hubcaps come from a bloke in Hornby. And they're nice.",
    "Nice? Don't go native on me.",
  ] },
  { id: "life3_turf_nan", tags: ["a:mobster", "b:mobster", "rivals"], lines: [
    "You keep my nan out of this.",
    "Your nan bought four hubcaps off us on Tuesday.",
    "...She doesn't even have a car.",
    "She said she liked how they shine. Lovely woman.",
  ] },
  { id: "life3_turf_parking", tags: ["a:mobster", "b:cop", "@street"], lines: [
    "Riccarton Boys are double parked on Tuam St.",
    "So are you.",
    "We're triple parked. That's different. That's tradition.",
  ] },
  { id: "life3_turf_cop_middle", tags: ["a:cop", "b:cop", "@police"], lines: [
    "Tessera lot and Riccarton lot both filed complaints.",
    "About each other?",
    "About each other's dress sense. Eleven pages each.",
  ] },
  { id: "life3_turf_graffiti", tags: ["a:mobster", "b:graffiti"], lines: [
    "Who tagged 'RICC 4 LYF' on the casino wall?",
    "Not me. I only do murals.",
    "Then mural over it. Tomatoes. Big ones. On the house.",
  ] },
  { id: "life3_turf_tag_spelling", tags: ["a:mobster", "b:mobster", "after:graffiti"], lines: [
    "The Riccarton Boys tagged our wall again.",
    "What's it say?",
    "'Tessra Sux.' They spelt us wrong.",
    "Leave it. It's more embarrassing for them.",
  ] },
  { id: "life3_turf_riccarton_life", tags: ["a:mobster", "b:mobster", "rivals", "a:tired"], lines: [
    "You ever get sick of the rivalry, Tessera?",
    "Every day. But I'd miss your terrible hubcaps.",
    "...I'd miss your terrible suits.",
    "Back to hating each other at nine sharp, then.",
  ] },
  { id: "life3_turf_shared_dentist", tags: ["a:mobster", "b:mobster", "rivals", "@hospital"], lines: [
    "What are you doing at my dentist?",
    "Your dentist? She's been our dentist for years.",
    "...Sit on the other side of the waiting room.",
  ] },
  { id: "life3_turf_cones", tags: ["a:mobster", "b:mobster"], lines: [
    "Someone's coned off our parking outside the casino.",
    "Council?",
    "Riccarton Boys. The cones have little hubcaps glued on.",
  ] },
  { id: "life3_turf_hubcap_buyer", tags: ["a:car_enthusiast", "b:mobster"], lines: [
    "I bought hubcaps off the Riccarton Boys. Wrong size.",
    "They're always the wrong size. That's their business.",
    "So who sells the right ones?",
    "Nobody. That's why we stay out of hubcaps. Classy.",
  ] },
  { id: "life3_turf_wedding", tags: ["a:mobster", "b:mobster", "rivals", "party"], lines: [
    "Why are you at my cousin's wedding?",
    "Your cousin married my cousin.",
    "...So we're family now?",
    "Worst day of my life. Pass the bread rolls.",
  ] },
  { id: "life3_turf_mall_guard", tags: ["a:mobster", "b:bouncer"], lines: [
    "Riccarton mall security just kicked me out.",
    "What for?",
    "Loitering with menace. I was buying socks.",
    "Out there, socks are a statement.",
  ] },
  { id: "life3_turf_victoria_sq", tags: ["a:mobster", "b:mobster", "@plaza"], lines: [
    "Riccarton Boys are setting up a hubcap stall in Victoria Square.",
    "Next to Queen Victoria?",
    "Right under her nose. She looks furious.",
    "She always looks furious. She's a statue.",
  ] },

  // ── Moon Sherbet ───────────────────────────────────────────────
  { id: "life3_sherbet_shipment", tags: ["a:mobster", "b:smuggler", "night"], lines: [
    "Is the Moon Sherbet in?",
    "Two crates. Glowing like a fish tank.",
    "Put a blanket on them. The neighbours think we've got UFOs.",
  ] },
  { id: "life3_sherbet_flavour", tags: ["a:mobster", "b:mobster"], lines: [
    "New Moon Sherbet flavour. Crescent Lime.",
    "What's it taste like?",
    "Like lime that's seen the dark side of something.",
  ] },
  { id: "life3_sherbet_glowing_suit", tags: ["a:mobster", "b:mobster", "late"], lines: [
    "My pocket's glowing through my suit.",
    "Moon Sherbet leaked again?",
    "I look like a lava lamp at a funeral.",
  ] },
  { id: "life3_sherbet_kid_brother", tags: ["a:mobster", "b:local"], lines: [
    "Is it true Moon Sherbet makes your teeth glow?",
    "For about a day. Great for finding your mouth in the dark.",
    "Is that a selling point?",
    "To a man who's lost his mouth? Yes.",
  ] },
  { id: "life3_sherbet_price", tags: ["a:gambler", "b:mobster", "@casino"], lines: [
    "How much for a bag of Moon Sherbet?",
    "Twenty bucks or one funny story.",
    "...I once lost my car keys in a pavlova.",
    "That's barely a ten. Twenty bucks.",
  ] },
  { id: "life3_sherbet_buzz", tags: ["a:mobster", "b:mobster", "a:scared"], lines: [
    "The sherbet crate is humming in E flat.",
    "Last week it was C.",
    "It's changing key. That means something. I just don't know what.",
  ] },

  // ── Mannequin Mike and the smugglers ───────────────────────────
  { id: "life3_smug_mike_name", tags: ["a:local", "b:smuggler"], lines: [
    "Why do they call him Mannequin Mike?",
    "Moves more plastic limbs than every shop on Cashel Mall.",
    "Who needs that many limbs?",
    "Shop windows, film sets, and one very lonely farmer.",
  ] },
  { id: "life3_smug_lyttelton", tags: ["a:smuggler", "b:smuggler", "night"], lines: [
    "Boat's coming into Lyttelton at midnight.",
    "Limbs or gnomes?",
    "Both. And one pallet of sneakers labelled 'potatoes'.",
  ] },
  { id: "life3_smug_tunnel", tags: ["a:smuggler", "b:smuggler", "late"], lines: [
    "We're driving forty mannequins through the Lyttelton tunnel.",
    "In the van?",
    "Seatbelted. If we're stopped, they're a choir.",
  ] },
  { id: "life3_smug_choir", tags: ["a:cop", "b:smuggler", "late"], lines: [
    "Why is your van full of people who aren't moving?",
    "They're a choir. Resting their voices.",
    "That one hasn't got a head.",
    "He's the bass. They're very low.",
  ] },
  { id: "life3_smug_left_legs", tags: ["a:smuggler", "b:smuggler", "a:angry"], lines: [
    "This whole crate is left legs.",
    "Can't we sell them anyway?",
    "To who? A shop that only does hopping?",
  ] },
  { id: "life3_smug_gnome_customs", tags: ["a:smuggler", "b:cop", "@airport"], lines: [
    "Anything to declare?",
    "Just these garden gnomes. Personal use.",
    "Two hundred gnomes is personal use?",
    "I've got a very big garden. And low self-esteem.",
  ] },
  { id: "life3_smug_sneaker_size", tags: ["a:student", "b:smuggler", "@alley"], lines: [
    "These Jordanz are both left feet.",
    "That's the drop. Limited edition Lefty.",
    "How do I walk in them?",
    "In circles. Very stylish circles.",
  ] },
  { id: "life3_smug_sneaker_logo", tags: ["a:smuggler", "b:local"], lines: [
    "Brand new Pumba trainers. Forty bucks.",
    "The logo's a warthog.",
    "Warthogs are very fast. Hakuna nothing, it's a bargain.",
  ] },
  { id: "life3_smug_mike_boss", tags: ["a:smuggler", "b:smuggler", "morning"], lines: [
    "Mike wants a stock count before breakfast.",
    "How many heads have we got?",
    "Sixty heads, eighty torsos, and nobody's got a left hand.",
  ] },
  { id: "life3_smug_hand_thing", tags: ["a:smuggler", "b:smuggler", "a:scared"], lines: [
    "Did a mannequin hand just wave at me?",
    "You stacked it on the van's air vent.",
    "Still. Rude.",
  ] },
  { id: "life3_smug_gnome_fishing", tags: ["a:smuggler", "b:local", "@residential"], lines: [
    "Want a gnome for the garden? This one's got a fishing rod.",
    "Why's he so cheap?",
    "He fell off a container. He's seen the ocean. He's changed.",
  ] },
  { id: "life3_smug_mob_deal", tags: ["a:smuggler", "b:mobster"], lines: [
    "The family needs forty mannequins. No questions.",
    "No questions? What for?",
    "That's a question.",
    "Sorry. Forty mannequins. Is the Don's suit shop opening?",
  ] },
  { id: "life3_smug_mob_suits", tags: ["a:mobster", "b:smuggler"], lines: [
    "These mannequins are for the Don's tailor.",
    "Nice. Torso sizes?",
    "Wide. Like they've had a lot of pies. You know why.",
  ] },
  { id: "life3_smug_decoy", tags: ["a:mobster", "b:smuggler", "night"], lines: [
    "Gina wants mannequins in suits on the casino roof.",
    "Decoys?",
    "So the Riccarton Boys think we've got more men.",
    "Clever. Forty men who never ask for a pay rise.",
  ] },
  { id: "life3_smug_pukeko", tags: ["a:smuggler", "b:mogul"], lines: [
    "Need costumes for the Pukeko dancers? Got cartoon ones.",
    "Are they knock-offs?",
    "They're inspired by. Big Mouse, Duck Without Pants.",
    "Charming. Send me forty Ducks.",
  ] },
  { id: "life3_smug_zoo", tags: ["a:smuggler", "b:zookeeper"], lines: [
    "Kevin the giraffe needs a scarf. I've got a long one.",
    "How long?",
    "Nine metres. Was meant for a whale.",
    "We do have a whale that doesn't fit. Bring both.",
  ] },
  { id: "life3_smug_market", tags: ["a:smuggler", "b:vendor", "@market"], lines: [
    "Can I rent half your stall at Riverside?",
    "What are you selling?",
    "Arms.",
    "...Plastic ones, mate. Mannequin. Relax.",
  ] },
  { id: "life3_smug_storm", tags: ["a:smuggler", "b:smuggler", "storm"], lines: [
    "Nor'wester blew the tarp off the ute on Moorhouse.",
    "And?",
    "Thirty mannequin legs tumbling down the road like tumbleweed.",
    "Make it look like a parade. Wave.",
  ] },
  { id: "life3_smug_rain_box", tags: ["a:smuggler", "b:smuggler", "rain"], lines: [
    "The sneaker boxes are soaking.",
    "Will the sneakers survive?",
    "The glue's dissolving. They're sandals now.",
  ] },
  { id: "life3_smug_vigilante", tags: ["a:vigilante", "b:smuggler", "night"], lines: [
    "Mannequin Mike. We meet again.",
    "Bryce, it's ten o'clock. Don't you have the Henderson audit?",
    "The Night Kiwi doesn't do audits!",
    "Yeah but Bryce does. Get some sleep, mate.",
  ] },
  { id: "life3_smug_mike_quotes", tags: ["a:smuggler", "b:smuggler"], lines: [
    "Mike says a man's only as good as his limbs.",
    "Did he mean it as a life lesson?",
    "He meant the arm crate's short. But both, maybe.",
  ] },
  { id: "life3_smug_new_line", tags: ["a:smuggler", "b:smuggler", "day"], lines: [
    "Mike's branching out. Inflatable flamingos.",
    "Why?",
    "Summer. Everyone in Sumner wants one. Nobody wants to pay.",
  ] },
  { id: "life3_smug_airport_head", tags: ["a:tourist", "b:smuggler", "@airport"], lines: [
    "Excuse me, your bag is staring at me.",
    "That's my carry-on head.",
    "Your what?",
    "Mannequin head. They're for wigs. It's legit. Mostly.",
  ] },
  { id: "life3_smug_retire", tags: ["a:smuggler", "b:smuggler", "a:tired"], lines: [
    "I want to go straight. Sell real sneakers.",
    "Real sneakers have real prices.",
    "Then real people won't buy them. Never mind.",
  ] },
  { id: "life3_smug_mike_bday", tags: ["a:smuggler", "b:smuggler", "party"], lines: [
    "What do you get Mannequin Mike for his birthday?",
    "Something he can't smuggle.",
    "A hug?",
    "He tried to put the last one in a crate.",
  ] },
  { id: "life3_smug_cop_dog", tags: ["a:cop", "b:smuggler", "@airport"], lines: [
    "The sniffer dog's going mad at your suitcase.",
    "It's full of gnomes.",
    "Dogs can't smell gnomes.",
    "This one can. He's had a bad experience.",
  ] },
  { id: "life3_smug_mechanic", tags: ["a:smuggler", "b:mechanic"], lines: [
    "Can you build a hidden compartment in my van?",
    "What size?",
    "Exactly one adult mannequin. Lying down. Peaceful.",
    "I'm going to stop asking questions now.",
  ] },
  { id: "life3_smug_gallery", tags: ["a:smuggler", "b:local", "@gallery"], lines: [
    "I sold a pile of mannequin arms to the gallery.",
    "For what?",
    "It's an installation now. Called 'Reach'. Eight grand.",
    "So smuggling's just art with worse lighting.",
  ] },
  { id: "life3_smug_bando", tags: ["a:mosaic", "b:smuggler"], lines: [
    "Bando wants to trade you a broken amp for six gnomes.",
    "Does the amp work?",
    "He says it works emotionally.",
    "So do the gnomes. Deal.",
  ] },
  { id: "life3_smug_sneaker_squeak", tags: ["a:skater", "b:smuggler"], lines: [
    "Your knock-off skate shoes squeak every step.",
    "That's the built-in alarm. Anti-theft.",
    "Who'd steal these?",
    "Exactly. It works.",
  ] },
  { id: "life3_smug_taxi", tags: ["a:taxi", "b:smuggler"], lines: [
    "I'm not taking three mannequins to Sumner in my cab.",
    "They'll pay.",
    "Mannequins don't pay.",
    "They don't talk either. Best passengers you'll ever have.",
  ] },
  { id: "life3_smug_quake", tags: ["a:villain", "b:smuggler"], lines: [
    "I require two hundred mannequins for my robot army!",
    "Do they need to move?",
    "...Ideally.",
    "That's extra. Movement's a premium feature.",
  ] },

  // ── The casino floor: gamblers ─────────────────────────────────
  { id: "life3_gamb_system", tags: ["a:gambler", "b:gambler", "@casino"], lines: [
    "I've got a system for roulette.",
    "Everyone's got a system.",
    "Mine's different. I bet on red when I'm wearing red.",
    "That's not a system, Trevor. That's a wardrobe.",
  ] },
  { id: "life3_gamb_lucky_socks", tags: ["a:gambler", "b:gambler", "@casino"], lines: [
    "Lucky socks are on. Tonight's the night.",
    "Haven't you worn those since 2011?",
    "Never washed. You can't wash luck off, mate.",
    "I'll stand at the other table.",
  ] },
  { id: "life3_gamb_pokies", tags: ["a:gambler", "b:gambler", "@casino", "late"], lines: [
    "This pokie's due. I can feel it.",
    "You said that about the last six pokies.",
    "And they all paid out. Right after I left. Not leaving.",
  ] },
  { id: "life3_gamb_rent", tags: ["a:gambler", "b:gambler", "a:broke", "@casino"], lines: [
    "I just bet my rent on black.",
    "And?",
    "Green. Zero. The flatmates are going to have opinions.",
  ] },
  { id: "life3_gamb_flatmates", tags: ["a:gambler", "b:local", "a:broke"], lines: [
    "Can I owe you the rent till Thursday?",
    "Did you take it to the casino?",
    "I took it for a walk. It wandered into the casino.",
  ] },
  { id: "life3_gamb_big_win", tags: ["a:gambler", "b:gambler", "after:casino_win"], lines: [
    "Did you see? {who} hit the jackpot!",
    "On the pokie I just left?",
    "The very one. Still warm from your hope.",
  ] },
  { id: "life3_gamb_win_plans", tags: ["a:gambler", "b:local", "a:rich"], lines: [
    "Won five grand at blackjack!",
    "Pay off your car?",
    "Hot tub. On the balcony. Of my rental.",
    "Your landlord's going to love that.",
  ] },
  { id: "life3_gamb_superstition", tags: ["a:gambler", "b:dealer", "@casino"], lines: [
    "Can you shuffle with your left hand? It's luckier.",
    "The machine shuffles, sir.",
    "Then ask the machine to use its left hand.",
  ] },
  { id: "life3_gamb_horses", tags: ["a:gambler", "b:gambler", "@casino", "day"], lines: [
    "Put fifty on a horse at Addington.",
    "Which one?",
    "Called Two Pies Moretti. Felt it was a sign.",
    "It's a sign Sal's been naming horses again.",
  ] },
  { id: "life3_gamb_pie_bet", tags: ["a:gambler", "b:mobster", "@casino"], lines: [
    "Can I bet with a pie? I'm out of cash.",
    "Mince?",
    "Steak and cheese.",
    "Sal accepts. The house always wins. Especially lunch.",
  ] },
  { id: "life3_gamb_wife", tags: ["a:gambler", "b:gambler", "night"], lines: [
    "Told my wife I'm at choir practice.",
    "Every Thursday?",
    "Every Thursday for nine years. She thinks I'm a tenor.",
    "Do you sing at all?",
  ] },
  { id: "life3_gamb_tenor", tags: ["a:gambler", "b:gambler", "a:scared"], lines: [
    "My wife bought tickets to my choir's concert.",
    "The fake choir?",
    "I've got two weeks to form a choir. You in?",
  ] },
  { id: "life3_gamb_buffet", tags: ["a:gambler", "b:gambler", "a:hungry", "@casino"], lines: [
    "I've lost everything. Even my bus fare.",
    "Buffet's free with a players card.",
    "...I've won. I've eaten nine sausage rolls. I've won.",
  ] },
  { id: "life3_gamb_jacket", tags: ["a:gambler", "b:bouncer", "@casino"], lines: [
    "Sorry, sir. Collared shirts only after nine.",
    "This IS a collared shirt.",
    "That's a rugby jersey with a collar drawn on in Vivid.",
  ] },
  { id: "life3_gamb_counting", tags: ["a:gambler", "b:gambler", "@casino"], lines: [
    "I'm counting cards.",
    "How's it going?",
    "I've got to fourteen. Then I lost track. Started again.",
  ] },
  { id: "life3_gamb_cards_caught", tags: ["a:bouncer", "b:gambler", "@casino"], lines: [
    "Are you counting cards, sir?",
    "I can barely count change.",
    "You were moving your lips.",
    "I was praying. To the cards. Different thing.",
  ] },
  { id: "life3_gamb_lucky_pukeko", tags: ["a:gambler", "b:gambler"], lines: [
    "Saw a pukeko on the way here. Good omen.",
    "Was it the strip club sign?",
    "It flashed at me twice. That's double luck.",
  ] },
  { id: "life3_gamb_dawn", tags: ["a:gambler", "b:gambler", "morning"], lines: [
    "Is that the sun? What time is it?",
    "Seven. The casino has no windows for a reason.",
    "I came in Tuesday.",
    "It's Thursday, mate. Go home and feed the cat.",
  ] },
  { id: "life3_gamb_cat", tags: ["a:gambler", "b:local", "a:tired"], lines: [
    "Can you feed my cat? I've been at the casino a while.",
    "How long's a while?",
    "Long enough she's probably joined the Riccarton Boys.",
  ] },
  { id: "life3_gamb_quit", tags: ["a:gambler", "b:gambler", "friends"], lines: [
    "I've quit gambling.",
    "Since when?",
    "Since ten minutes ago. Bet you I last a week.",
    "...You see the problem.",
  ] },
  { id: "life3_gamb_lotto", tags: ["a:gambler", "b:shopkeeper", "@shops"], lines: [
    "Lucky dip, and pick numbers off my old rugby jerseys.",
    "Which ones?",
    "Seven, ten, and the one I wore when we lost by sixty.",
    "Why that one?",
  ] },
  { id: "life3_gamb_mogul", tags: ["a:gambler", "b:mogul", "@casino"], lines: [
    "Sir Ponsonby, can I borrow a chip? Just one.",
    "Darling, my chips are made of mother-of-pearl.",
    "So can I borrow one?",
    "You may hold one. Briefly. Jenkins, watch him.",
  ] },
  { id: "life3_gamb_roastie", tags: ["a:comic", "b:gambler", "@casino"], lines: [
    "You've been at that pokie so long it's paying you rent.",
    "Funny. Got any coins?",
    "Mate, I tell jokes on a Tuesday. I've got less than you.",
  ] },
  { id: "life3_gamb_mosaic", tags: ["a:mosaic", "b:gambler", "@casino"], lines: [
    "Flash bet me ten bucks you'd never leave that seat.",
    "Flash is right.",
    "He's at the bar spending it already.",
  ] },
  { id: "life3_gamb_photo", tags: ["a:gambler", "b:photographer"], lines: [
    "Can you take my photo with my winnings?",
    "That's a single twenty-cent coin.",
    "And it's the best twenty cents I've ever had. Shoot it.",
  ] },
  { id: "life3_gamb_loan", tags: ["a:gambler", "b:mobster", "@casino", "a:broke"], lines: [
    "Could the Don front me a hundred?",
    "The Don fronts nobody. The Don offers a payment plan.",
    "What's the interest?",
    "Two Saturdays weeding. And you learn to love it.",
  ] },
  { id: "life3_gamb_spin_rain", tags: ["a:gambler", "b:gambler", "rain"], lines: [
    "Raining. Might as well go to the casino.",
    "It's sunny, you go to the casino.",
    "Yes, but now I've got an excuse.",
  ] },
  { id: "life3_gamb_bus_fare", tags: ["a:gambler", "b:driver", "a:broke"], lines: [
    "Can I pay my bus fare with a casino chip?",
    "It's a five-dollar chip.",
    "Keep the change. Let it ride.",
  ] },
  { id: "life3_gamb_rich_flex", tags: ["a:gambler", "b:barista", "a:rich", "morning"], lines: [
    "Flat white for everyone in the café! On me!",
    "There's two people in here.",
    "Then they get three each. I had a night.",
  ] },
  { id: "life3_gamb_crypto", tags: ["a:gambler", "b:gambler"], lines: [
    "I've moved on from roulette. Now I do crypto.",
    "How's that going?",
    "Roulette with less carpet. Same feeling in the stomach.",
  ] },
  { id: "life3_gamb_martingale", tags: ["a:gambler", "b:gambler", "@casino", "a:broke"], lines: [
    "If you lose, double your bet. Can't fail.",
    "How much are you betting now?",
    "My Corolla. Then the Corolla's double. Which is two Corollas.",
  ] },
  { id: "life3_gamb_bingo", tags: ["a:gambler", "b:local"], lines: [
    "Gave up the casino. Bingo at the club now.",
    "Safer?",
    "The nanas are ruthless. One took my dabber at the door.",
  ] },
  { id: "life3_gamb_lucky_cone", tags: ["a:gambler", "b:gambler", "@street"], lines: [
    "I touch every road cone on the way to the casino.",
    "There's four hundred between here and Victoria Square.",
    "That's why I've never lost. Well. Never lost early.",
  ] },
  { id: "life3_gamb_win_drink", tags: ["a:gambler", "b:mobster", "after:casino_win"], lines: [
    "The house wants to buy you a drink, friend.",
    "Is that the house being nice?",
    "The house is always nice. Until you try to leave.",
  ] },
  { id: "life3_gamb_cheer", tags: ["a:local", "b:gambler", "after:casino_win"], lines: [
    "Did {who} just win the big one?",
    "Forty grand on the wheel. Screamed like a kea.",
    "Good for them!",
    "Bad for me. I told them to bet on black.",
  ] },
