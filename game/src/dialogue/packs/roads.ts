import type { Exchange } from "../exchanges";

/**
 * The road and the body: what people say after a close call, a crash, a limp or a wrecked car. These hang off the
 * tags the director reads from the live sim (a:limping, a:sorehead, a:armhurt, a:hunched, a:hitbycar, a:wreck,
 * after:close_call, after:crash), so a line only comes up when it's true for the person saying it.
 */
export const ROADS: Exchange[] = [
  // ── Close calls: somebody nearly got skittled ─────────────────
  { id: "roads_close_shaky", tags: ["after:close_call", "a:scared"], lines: ["Did you see that car? It nearly took me out.", "I saw you do a dive I didn't know humans could do.", "My heart's still on the other side of the road.", "Go get it. Use the crossing this time."] },
  { id: "roads_close_who", tags: ["after:close_call"], lines: ["{who} nearly got cleaned up by a car just now.", "Was it doing the speed limit?", "It was doing the speed limit of a different country."] },
  { id: "roads_close_green_man", tags: ["after:close_call", "a:local"], lines: ["This is why I wait for the green man.", "Even when there's nothing coming?", "Especially then. That's when they come out of nowhere."] },
  { id: "roads_close_driver_blame", tags: ["after:close_call", "a:angry"], lines: ["People drive round here like the road owes them money.", "Some of them it probably does.", "Doesn't mean they can aim at pedestrians."] },
  { id: "roads_close_mum", tags: ["after:close_call", "b:scared"], lines: ["You alright? You've gone the colour of a flat white.", "I'm fine. I just need to sit down for about a year.", "Sit here. I'll watch the traffic for you."] },
  { id: "roads_close_jaywalk", tags: ["after:close_call", "rivals"], lines: ["If you'd used the crossing, that wouldn't have happened.", "If he'd used his brakes, that wouldn't have happened.", "Fair. You're both idiots."] },
  { id: "roads_close_phone", tags: ["after:close_call", "a:student"], lines: ["I wasn't even on my phone that time.", "So what was your excuse?", "I was thinking. Turns out thinking is also dangerous."] },
  { id: "roads_close_cop", tags: ["after:close_call", "a:cop"], lines: ["Anyone get a plate on that car?", "It started with a letter, then went really fast.", "Narrows it down to every car in Canterbury."] },
  { id: "roads_close_taxi", tags: ["after:close_call", "a:taxi"], lines: ["Saw that. Twenty years driving this town, never seen a dive like it.", "Was it graceful at least?", "Graceful? It was a cat falling off a fence."] },
  { id: "roads_close_laugh", tags: ["after:close_call", "a:happy", "friends"], lines: ["Okay that was terrifying, but your face.", "Don't. I can feel my face still doing it.", "I'll describe it at your wedding."] },
  { id: "roads_close_hug", tags: ["after:close_call", "couple"], lines: ["Don't ever do that to me again.", "I didn't do it, the car did it.", "Then don't stand anywhere cars are. Ever. Hold my hand."] },
  { id: "roads_close_honk", tags: ["after:close_call", "a:tired"], lines: ["That horn went straight through my skull.", "At least you heard it in time.", "I heard it after. My legs heard it first."] },
  { id: "roads_close_mosaic", tags: ["after:close_call", "a:mosaic", "b:mosaic"], lines: ["If anyone filmed that dive, it's going on the page.", "Over my dead body.", "That was nearly the caption, bro."] },
  { id: "roads_close_karma", tags: ["after:close_call", "a:thief"], lines: ["Nearly got hit. Must be karma for the sandwiches.", "What sandwiches?", "Exactly. No sandwiches. Never happened."] },
  { id: "roads_close_tourist", tags: ["after:close_call", "a:tourist"], lines: ["Do the cars here not stop for walkers?", "They stop. Eventually. Sometimes on you.", "I'm putting that in my review of the country."] },

  // ── After a crash ──────────────────────────────────────────────
  { id: "roads_crash_heard", tags: ["after:crash"], lines: ["Did you hear that bang?", "Two cars had a disagreement near {place}.", "And who came out on top?", "The panel beater. He always wins."] },
  { id: "roads_crash_rubberneck", tags: ["after:crash", "a:local"], lines: ["Everyone's slowing down to look at the crash.", "And you're not?", "I'm walking. I'm allowed to look."] },
  { id: "roads_crash_who", tags: ["after:crash"], lines: ["Was {who} in that smash?", "Walked away from it, I think. Shouting the whole time.", "Shouting's a good sign. Means the lungs work."] },
  { id: "roads_crash_insurance", tags: ["after:crash", "a:office"], lines: ["The paperwork on that crash is going to be glorious.", "You sound excited.", "I process claims. That's my Super Bowl out there."] },
  { id: "roads_crash_medic", tags: ["after:crash", "a:medic"], lines: ["Anyone hurt in that one?", "Couple of bruised egos and a bumper in the gutter.", "Bumpers I can't help. Egos I can't help either, actually."] },
  { id: "roads_crash_mechanic", tags: ["after:crash", "a:mechanic"], lines: ["Did you see the front end on that car?", "Looked like a crumpled can.", "Looked like next month's rent to me."] },
  { id: "roads_crash_skid", tags: ["after:crash", "a:car_enthusiast"], lines: ["Did you see the skid marks? Black lines all the way down.", "Is that impressive or terrible?", "Both. That's the beauty of it."] },
  { id: "roads_crash_rain", tags: ["after:crash", "rain"], lines: ["Wet roads and someone thinks they're in a rally.", "First rain in a week, the oil comes up.", "And the idiots come out with it."] },
  { id: "roads_crash_cop_tired", tags: ["after:crash", "a:cop", "a:tired"], lines: ["Third crash this shift.", "Same intersection?", "Same intersection. I'm going to start charging it rent."] },
  { id: "roads_crash_argue", tags: ["after:crash", "a:angry"], lines: ["The two drivers are still out there yelling.", "About whose fault it was?", "About whose car was uglier. It's escalated."] },
  { id: "roads_crash_glass", tags: ["after:crash", "a:cleaner"], lines: ["There's glass all over the road from that crash.", "Your job or the council's?", "Mine. The council's job is to write a letter about it."] },
  { id: "roads_crash_photographer", tags: ["after:crash", "a:photographer"], lines: ["The light on that wreck is actually beautiful.", "Mate, people are upset.", "I know. I'm not shooting it. I'm just noticing."] },
  { id: "roads_crash_night", tags: ["after:crash", "night"], lines: ["Crashes always sound worse at night.", "Everything does. Even the bins.", "The bins especially. They're up to something."] },
  { id: "roads_crash_shaken", tags: ["after:crash", "b:scared"], lines: ["You saw it happen, didn't you?", "Right in front of me. I can still hear it.", "Come walk with me. Away from the road."] },

  // ── Limping: a bad leg ─────────────────────────────────────────
  { id: "roads_limp_ask", tags: ["a:limping"], lines: ["Don't ask about the leg.", "I wasn't going to.", "You were. Your face was about to."] },
  { id: "roads_limp_concern", tags: ["b:limping", "friends"], lines: ["Why are you walking like a pirate?", "Leg's munted. Took a hit.", "Lean on me. Arr."] },
  { id: "roads_limp_stairs", tags: ["a:limping", "a:tired"], lines: ["Every step feels like a negotiation.", "Who's ahead in the talks?", "The step. Every time."] },
  { id: "roads_limp_tough", tags: ["a:limping", "a:mosaic"], lines: ["It's nothing. I've had worse.", "When?", "I'll think of something. Give me a sec."] },
  { id: "roads_limp_medic", tags: ["b:limping", "a:medic"], lines: ["That limp needs looking at.", "It's fine, it's walking.", "It's hopping. Hopping isn't walking. Come here."] },
  { id: "roads_limp_cop", tags: ["b:limping", "a:cop"], lines: ["What happened to the leg?", "Fell over.", "Onto what?", "The ground. Very suddenly."] },
  { id: "roads_limp_slow", tags: ["a:limping", "friends"], lines: ["Go on ahead. I'll catch up next week.", "I'm not leaving you.", "Then we're both late. Great. Teamwork."] },
  { id: "roads_limp_tease", tags: ["b:limping", "rivals"], lines: ["Nice walk. New dance?", "Keep talking and you'll get one too.", "Big talk from a man with one working leg."] },
  { id: "roads_limp_rain", tags: ["a:limping", "rain"], lines: ["My knee says it's going to rain.", "It is raining.", "Knee's a bit late today. It's in pain, give it a break."] },
  { id: "roads_limp_couple", tags: ["b:limping", "couple"], lines: ["Sit. Leg up. I'll get you a pie.", "I can get my own pie.", "You can barely get your own leg. Sit."] },
  { id: "roads_limp_happy", tags: ["a:limping", "a:happy"], lines: ["Leg's busted but honestly, good day.", "How's that work?", "Everyone's being nice to me. I might keep the limp."] },
  { id: "roads_limp_skater", tags: ["a:limping", "a:skater"], lines: ["Bailed on the rail. Leg's cooked.", "Did you land it at least?", "I landed. Just not on the board."] },

  // ── Sore head ──────────────────────────────────────────────────
  { id: "roads_head_spin", tags: ["a:sorehead"], lines: ["Is the street moving or is it me?", "It's you.", "Good. I'd hate for the street to be going through something."] },
  { id: "roads_head_count", tags: ["b:sorehead", "a:medic"], lines: ["How many fingers?", "Is it a trick question?", "It's three. That's concerning. Sit down."] },
  { id: "roads_head_friend", tags: ["b:sorehead", "friends"], lines: ["You took a proper knock. You're swaying.", "I'm vibing.", "You're vibing into a lamppost. This way."] },
  { id: "roads_head_name", tags: ["a:sorehead", "a:happy"], lines: ["Remind me what your name is again?", "It's {b}. Still {b}.", "{b}! Love that. Strong name. Who am I?"] },
  { id: "roads_head_light", tags: ["a:sorehead", "day"], lines: ["Why is the sun so loud today?", "That's a headache, mate.", "Tell it to turn down the brightness."] },
  { id: "roads_head_angry", tags: ["a:sorehead", "a:angry"], lines: ["Everything's too bright and everyone's too loud.", "I'm not talking that loud.", "You're breathing loud. Stop that."] },
  { id: "roads_head_stars", tags: ["a:sorehead", "night"], lines: ["Are there more stars tonight or is that my head?", "Mostly your head.", "Pity. It's a nice view either way."] },

  // ── Hurt arm ───────────────────────────────────────────────────
  { id: "roads_arm_wave", tags: ["a:armhurt", "friends"], lines: ["I'd wave, but.", "But what?", "But the arm's out of office. Leave a message."] },
  { id: "roads_arm_coffee", tags: ["a:armhurt", "b:barista"], lines: ["Can you put a lid on it? One-armed today.", "What happened to the arm?", "Lost a fight with a car door. Car door's undefeated."] },
  { id: "roads_arm_help", tags: ["b:armhurt"], lines: ["Want me to carry that?", "I've got it.", "You've got it in your teeth. Give it here."] },
  { id: "roads_arm_photo", tags: ["a:armhurt", "a:photographer"], lines: ["Can't hold the camera steady with this arm.", "Use a tripod.", "I'm going to have to become a tripod person. Tragic."] },

  // ── Hunched: hurt side ─────────────────────────────────────────
  { id: "roads_ribs_laugh", tags: ["a:hunched", "b:comic"], lines: ["Don't make me laugh. My ribs.", "Why did the car cross the road?", "I said DON'T. Ow. Why?", "To finish the job."] },
  { id: "roads_ribs_posture", tags: ["b:hunched", "friends"], lines: ["You're folded over like a deck chair.", "Ribs. Took a hit.", "Want me to unfold you?", "Touch me and I scream."] },
  { id: "roads_ribs_breathe", tags: ["a:hunched", "a:tired"], lines: ["Breathing's a whole project today.", "In, out. You've done it before.", "Not with these ribs I haven't."] },

  // ── Hit by a car today ─────────────────────────────────────────
  { id: "roads_hit_story", tags: ["a:hitbycar"], lines: ["Got hit by a car today.", "You what?", "Bonnet, sky, footpath. In that order.", "And you're out walking?", "Where else am I going to complain about it?"] },
  { id: "roads_hit_kerb", tags: ["a:hitbycar", "a:scared"], lines: ["I can't step off a kerb now without my legs locking.", "That's normal after something like that.", "Normal's going to take me twenty minutes to cross Colombo."] },
  { id: "roads_hit_friend", tags: ["b:hitbycar", "friends"], lines: ["I heard what happened. You alright?", "Bruised. Rattled. Annoyed.", "Annoyed is good. Annoyed means you're still you."] },
  { id: "roads_hit_cop", tags: ["b:hitbycar", "a:cop"], lines: ["Did you get a look at the driver?", "I got a look at the grille. Up close.", "We'll find them. Grilles are distinctive."] },
  { id: "roads_hit_medic", tags: ["b:hitbycar", "a:medic"], lines: ["You should get checked over properly.", "I feel fine.", "Adrenaline feels fine. Tomorrow will feel different. Come in."] },
  { id: "roads_hit_angry", tags: ["a:hitbycar", "a:angry"], lines: ["If I see that car again I'm keying it.", "Bit much?", "It keyed me first. With its whole front."] },
  { id: "roads_hit_couple", tags: ["b:hitbycar", "couple"], lines: ["You're not walking near roads for a week.", "Everywhere is near roads.", "Then you're not walking for a week. I'll carry you."] },
  { id: "roads_hit_lucky", tags: ["a:hitbycar", "a:happy"], lines: ["Got hit by a car and walked away. Feel unkillable.", "Please don't test that.", "Too late. I'm buying a Lotto ticket."] },
  { id: "roads_hit_mosaic", tags: ["a:hitbycar", "a:mosaic"], lines: ["Got skittled on the way here.", "And you still turned up?", "Crew's the crew. Car's just a car."] },
  { id: "roads_hit_green", tags: ["a:hitbycar", "a:local"], lines: ["I was on the green man. The green man!", "The green man's a suggestion to some people.", "He's a promise. He's a little glowing promise."] },

  // ── Wrecked cars ───────────────────────────────────────────────
  { id: "roads_wreck_owner", tags: ["a:wreck"], lines: ["Have you seen my car? Front's like a folded napkin.", "Can it be fixed?", "It can be prayed for."] },
  { id: "roads_wreck_mechanic", tags: ["a:wreck", "b:mechanic"], lines: ["How much to fix my car?", "What happened to it?", "Everything. Then a bit more.", "Then it's everything plus labour."] },
  { id: "roads_wreck_tease", tags: ["b:wreck", "rivals"], lines: ["Nice car. Very modern art.", "It was in an accident.", "I know. The art is the accident."] },
  { id: "roads_wreck_smoke", tags: ["a:wreck", "a:car_enthusiast"], lines: ["The bonnet's smoking but she still starts.", "Smoke is never a good sign, bro.", "That's a fighter. That's what that is."] },
  { id: "roads_wreck_insurance", tags: ["a:wreck", "a:broke"], lines: ["Insurance won't cover it. Said it was 'driver error.'", "Was it?", "It was driver error-adjacent."] },
  { id: "roads_wreck_light", tags: ["a:wreck", "night"], lines: ["One headlight. I'm basically a motorbike now.", "That's illegal, you know.", "So's the way the other guy was driving."] },
  { id: "roads_wreck_pull", tags: ["a:wreck", "a:driver"], lines: ["The van pulls left now. Hard.", "Then go right a bit.", "I am. I'm driving permanently sideways."] },
  { id: "roads_wreck_cop", tags: ["b:wreck", "a:cop"], lines: ["Your car's got a smashed light and a hanging bumper.", "It's got character.", "It's got a defect notice. Here."] },
  { id: "roads_wreck_mosaic", tags: ["a:wreck", "a:mosaic", "b:mosaic"], lines: ["My car's cooked, bro.", "Shoot it before you fix it. Wreck shoot. Gritty.", "You're turning my trauma into content.", "That's literally the job."] },

  // ── Kerbside life: waiting, crossing, jaywalking ───────────────
  { id: "roads_kerb_wait", tags: ["a:local"], lines: ["Why does the green man take so long?", "Gives you time to reflect.", "Reflect on what, exactly?", "On how long the green man takes."] },
  { id: "roads_kerb_button", tags: ["a:student"], lines: ["Does pressing the button more make it faster?", "Scientifically, no.", "Emotionally, though?"] },
  { id: "roads_kerb_red", tags: ["a:cop", "b:local"], lines: ["Light's red, mate.", "There's nothing coming.", "There's me coming. With a fine."] },
  { id: "roads_kerb_rush", tags: ["morning", "a:office"], lines: ["Rush hour on Colombo is a sport.", "Who's top of the table?", "The buses. They always win. They're bigger."] },
  { id: "roads_kerb_tourist", tags: ["a:tourist", "b:local"], lines: ["Which way do I look before crossing?", "Right first. Then left. Then right again. Then pray.", "Is the praying necessary?", "Near the casino it is."] },
  { id: "roads_kerb_scooter", tags: ["a:local", "b:student"], lines: ["Those e-scooters on the footpath are a menace.", "I ride one.", "I know. I've seen you. I've been hit by you."] },
  { id: "roads_kerb_bus", tags: ["a:local", "rain"], lines: ["Bus went through that puddle on purpose.", "They aim. I'm sure they aim.", "Fifteen points for a full soak."] },
  { id: "roads_kerb_taxi_rant", tags: ["a:taxi"], lines: ["Pedestrians step out like they've got nine lives.", "Maybe they're cats.", "Then they should land on their feet off my bonnet."] },
  { id: "roads_kerb_courier", tags: ["a:driver", "a:tired"], lines: ["Forty drops today and every one in a no-parking zone.", "Where do you park?", "Wherever I'm least likely to be shouted at. Which is nowhere."] },
  { id: "roads_kerb_horn", tags: ["a:angry", "b:driver"], lines: ["Did you just honk at me?", "You walked out in front of my van.", "I was walking with purpose.", "Purpose doesn't stop a van."] },
  { id: "roads_kerb_dog", tags: ["a:local", "friends"], lines: ["My dog waits at the crossing better than half this town.", "Dogs respect the green man.", "Dogs respect everything except the postie."] },

  // ── Car culture ─────────────────────────────────────────────────
  { id: "roads_cars_drift", tags: ["a:car_enthusiast", "b:car_enthusiast"], lines: ["Saw someone pull a handbrake turn round the square.", "Clean?", "Clean till the end. Then very much not clean."] },
  { id: "roads_cars_tyres", tags: ["a:car_enthusiast", "rain"], lines: ["Wet road, bald tyres. That's how you meet a lamppost.", "Speaking from experience?", "Speaking from a lamppost, once."] },
  { id: "roads_cars_cop", tags: ["a:car_enthusiast", "b:cop"], lines: ["Officer, how fast is too fast?", "Faster than I can walk with a ticket book.", "So slow, then."] },
  { id: "roads_cars_skid_art", tags: ["a:graffiti", "b:car_enthusiast"], lines: ["Your skid marks on Lichfield are better art than mine.", "Thanks. I didn't mean them.", "That's what makes them honest."] },
  { id: "roads_cars_mechanic", tags: ["a:mechanic", "b:car_enthusiast"], lines: ["You back again?", "She's making a noise.", "She's been making a noise since 2009. It's called age."] },
  { id: "roads_cars_super", tags: ["a:rich", "b:local"], lines: ["Did you see my new car?", "Hard to miss. It's bright green.", "Lime. It's lime. Green's for poor people."] },
  { id: "roads_cars_wing", tags: ["a:car_enthusiast", "b:student"], lines: ["Why does your car have a wing?", "Aerodynamics, mate.", "On a Corolla? In Papanui?", "You can never have too much downforce in Papanui."] },
  { id: "roads_cars_sound", tags: ["a:local", "b:car_enthusiast", "night"], lines: ["Your exhaust woke my whole street.", "That's the sound of freedom.", "That's the sound of my baby crying at 2 a.m."] },

  // ── Hospital, healing, getting better ──────────────────────────
  { id: "roads_heal_bandage", tags: ["a:hurt", "b:medic"], lines: ["Bandage is itchy.", "That means it's healing.", "Or it means you used scratchy bandages.", "Both can be true."] },
  { id: "roads_heal_bruise", tags: ["a:hurt", "friends"], lines: ["My bruise has gone yellow and green.", "Like a traffic light.", "Great. Now my leg's telling me when to cross."] },
  { id: "roads_heal_waiting", tags: ["a:hurt", "a:tired"], lines: ["Six hours in A&E for two stitches.", "Was it busy?", "Busy with people who also had two stitches."] },
  { id: "roads_heal_scar", tags: ["a:hurt", "a:happy"], lines: ["It's going to scar, they reckon.", "Sorry, mate.", "Don't be. Scars come with stories. I'm going to lie about this one."] },
  { id: "roads_heal_soup", tags: ["b:hurt", "couple"], lines: ["I made you soup.", "I hurt my leg, not my stomach.", "Soup fixes everything. It's science. Eat."] },
  { id: "roads_heal_tough", tags: ["a:hurt", "a:mobster"], lines: ["You should see the other guy.", "The other guy was a car.", "You should see the car."] },
  { id: "roads_heal_mosaic_care", tags: ["b:hurt", "a:mosaic", "b:mosaic"], lines: ["Crew's got you. Sit out the shoot.", "I can still hold a reflector.", "You can hold a pie and supervise. That's an order."] },

  // ── Town talk: the bigger picture ──────────────────────────────
  { id: "roads_town_council", tags: ["a:local", "b:local"], lines: ["Council wants to put speed bumps on our street.", "Good. Cars fly down there.", "My car flies down there. That's the point."] },
  { id: "roads_town_cones", tags: ["a:local", "day"], lines: ["More road cones on Riccarton Road.", "Are they fixing anything?", "Not that I can see. I think they just like the cones."] },
  { id: "roads_town_cycle", tags: ["a:student", "b:local"], lines: ["The new cycle lane's actually great.", "If you cycle.", "Everyone should cycle. It's flat. We're the flattest city in the world.", "Except for the Port Hills.", "Fine. Flat apart from one giant hill."] },
  { id: "roads_town_bus_late", tags: ["a:office", "morning"], lines: ["Bus is late again.", "The app says three minutes.", "The app's said three minutes for fifteen minutes."] },
  { id: "roads_town_roadworks", tags: ["a:angry", "b:local"], lines: ["How long have they been digging up that intersection?", "Since I was a kid.", "You're thirty-four.", "Long-term project."] },
  { id: "roads_town_parking", tags: ["a:local", "b:shopkeeper"], lines: ["Parking in town is a nightmare.", "Tell me about it. Customers park in my doorway.", "At least they're near the shop."] },
  { id: "roads_town_tram", tags: ["a:tourist", "b:local"], lines: ["Is the tram worth it?", "If you like going very slowly in a circle.", "That sounds lovely, actually.", "It is, honestly. Don't tell anyone."] },

  // ── Small moments: kindness on the street ──────────────────────
  { id: "roads_kind_cross", tags: ["b:limping"], lines: ["Want a hand across the road?", "I'm alright.", "Go on. I'll stop the traffic with my face."] },
  { id: "roads_kind_stranger", tags: ["strangers", "b:hurt"], lines: ["You okay there? You look like you've been through it.", "Bit of a day.", "Here, have a seat. Nobody should stand through a day like that."] },
  { id: "roads_kind_water", tags: ["b:sorehead", "a:barista"], lines: ["Water first. Then coffee.", "Coffee first.", "You're swaying. Water first. I'm not arguing with someone who's swaying."] },
  { id: "roads_kind_walk_home", tags: ["b:hitbycar", "friends", "night"], lines: ["I'll walk you home.", "You don't have to.", "I know. I'm going to anyway. I'm walking on the road side."] },
  { id: "roads_kind_cop_care", tags: ["b:scared", "a:cop", "after:close_call"], lines: ["Take your time. Breathe.", "That car came out of nowhere.", "They always do. You did everything right."] },
];
