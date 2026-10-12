import type { Exchange } from "../exchanges";

/**
 * Life pack 6: the creatives. Photographers, musicians, buskers, skaters,
 * graffiti artists and the cleaners who paint over them.
 */
export const LIFE_6: Exchange[] = [

  // ── Photographers: the job, the light, the hustle ──
  {
    id: "life6_photo_golden_hour",
    tags: ["a:photographer", "evening", "clear"],
    lines: [
      "Golden hour's in eight minutes. Nobody blink.",
      "Can I blink after?",
      "After, you can blink, sneeze and go get a pie.",
    ],
  },
  {
    id: "life6_photo_norwester_hair",
    tags: ["a:photographer", "storm"],
    lines: [
      "Nor'wester's turned my model's hair into a hedge.",
      "Lean into it. Call it the Canterbury Plains look.",
      "Moody, windswept, slightly crunchy. I can sell that.",
    ],
  },
  {
    id: "life6_photo_lens_cap",
    tags: ["a:photographer", "b:photographer"],
    lines: [
      "Shot forty frames before I clocked the lens cap was on.",
      "Forty frames of pure black? Call it a series.",
      "'Lyttelton Tunnel, No Torch.' Gallery wants three.",
    ],
  },
  {
    id: "life6_photo_cone_talent",
    tags: ["a:photographer", "@street"],
    lines: [
      "Can't get one frame on Durham St without a cone in it.",
      "So make the cone the talent.",
      "Signed it to an agency. It gets more bookings than me.",
    ],
  },
  {
    id: "life6_photo_puddle_knees",
    tags: ["a:photographer", "rain"],
    lines: [
      "Rain's the best thing that ever happens to Cashel Mall.",
      "You're kneeling in a puddle, mate.",
      "Reflections cost knees. That's the deal I signed.",
    ],
  },
  {
    id: "life6_photo_tourist_square",
    tags: ["a:photographer", "b:tourist"],
    lines: [
      "Want me to take one of you two by the Square?",
      "Yes please! Just a quick one!",
      "I don't do quick. Step left. Chin down. Gorgeous.",
    ],
  },
  {
    id: "life6_photo_exposure_rent",
    tags: ["a:photographer", "a:broke"],
    lines: [
      "Another band wants a shoot for 'exposure'.",
      "Exposure's literally your whole job, though.",
      "Not the kind that pays rent on Bealey Ave.",
    ],
  },
  {
    id: "life6_photo_undercut_legend",
    tags: ["a:photographer", "b:photographer"],
    lines: [
      "Saw MosaicScope's set from the Town Hall gig.",
      "The haze and the red gels? Unreal.",
      "And shoots start at {rate}. Undercut by a legend.",
    ],
  },
  {
    id: "life6_photo_card_full",
    tags: ["a:photographer", "a:scared"],
    lines: [
      "Card's full and the band's still on stage!",
      "Delete the blurry ones.",
      "They're all blurry. It's a punk band.",
    ],
  },
  {
    id: "life6_photo_drone_carpark",
    tags: ["a:photographer", "b:cop"],
    lines: [
      "Drone's only up for a sec, officer. Fifteen metres.",
      "It's hovering over the police car park.",
      "It's an establishing shot. Of how tidy you keep it.",
    ],
  },
  {
    id: "life6_photo_kea_lens_hood",
    tags: ["a:photographer", "b:zookeeper"],
    lines: [
      "A kea at the Velvet Zoo just nicked my lens hood.",
      "He'll trade it back for a wiper blade.",
      "I came on the bus. I have zero wiper blades.",
    ],
  },
  {
    id: "life6_photo_hagley_ducks",
    tags: ["a:photographer", "@park"],
    lines: [
      "Wedding in Hagley Park. Bride wants ducks in shot.",
      "Ducks don't take direction.",
      "I've got crumbs. Crumbs are direction.",
    ],
  },
  {
    id: "life6_photo_gossip_face",
    tags: ["a:photographer", "b:model"],
    lines: [
      "Less 'catalogue', more 'just heard juicy gossip'.",
      "Like Glitter at brunch?",
      "Exactly that. Hold it. Oh, that's the one.",
    ],
  },
  {
    id: "life6_photo_three_drives",
    tags: ["a:photographer", "late"],
    lines: [
      "Three a.m. and I'm backing up to three hard drives.",
      "Bit paranoid, eh?",
      "Nearly lost a wedding once. I still hear the bride.",
    ],
  },
  {
    id: "life6_photo_velvet_robe",
    tags: ["a:photographer", "b:mogul"],
    lines: [
      "Sir, the robe's catching every light in the room.",
      "Darling, that is the robe's entire purpose.",
      "It's flaring. You're glowing like a jar of honey.",
      "Print it. Honey sells.",
    ],
  },
  {
    id: "life6_photo_mince_sensor",
    tags: ["a:photographer", "a:hungry"],
    lines: [
      "Last shoot had a pie on set. Never again.",
      "Crumbs in the frame?",
      "Crumbs in the lens. Mince on the sensor. It was a lot.",
    ],
  },
  {
    id: "life6_photo_kodak_garage_film",
    tags: ["a:photographer", "b:mosaic"],
    lines: [
      "Kodak, what film are you running these days?",
      "Expired stuff. From a garage sale in Sumner.",
      "Every frame's a surprise party. Respect.",
    ],
  },
  {
    id: "life6_photo_raw_files",
    tags: ["a:photographer", "b:local"],
    lines: [
      "You want the raw files? Unedited?",
      "Yeah, just send everything.",
      "You want to see me before coffee too? Edited it is.",
    ],
  },
  {
    id: "life6_photo_free_angles",
    tags: ["a:photographer", "b:local"],
    lines: [
      "Don't worry about the chin. I'll change the angle.",
      "Wait, angles are free?",
      "Angles are free. The chin goes, the confidence stays.",
    ],
  },
  {
    id: "life6_photo_port_hills_fog",
    tags: ["a:photographer", "morning", "clear"],
    lines: [
      "Sunrise off the Port Hills. Had to be up there by six.",
      "Worth the climb?",
      "Fog rolled in. I shot a very artistic cloud.",
    ],
  },
  {
    id: "life6_photo_back_of_camera",
    tags: ["a:photographer", "after:shoot"],
    lines: [
      "Did {who} just book a shoot on the spot?",
      "Saw the back of the camera and went quiet.",
      "That little screen closes more deals than I do.",
    ],
  },
  {
    id: "life6_photo_upside_down",
    tags: ["a:photographer", "@gallery"],
    lines: [
      "They hung my print upside down at the opening.",
      "Did anyone notice?",
      "A critic called it brave. It's staying upside down.",
    ],
  },
  {
    id: "life6_photo_spot_rivals",
    tags: ["a:photographer", "b:photographer", "rivals"],
    lines: [
      "Nice spot. Shame I was here first.",
      "You were here first last summer. Spot's moved on.",
      "The light hasn't. The light remembers me.",
    ],
  },
  {
    id: "life6_photo_tram_wave",
    tags: ["a:photographer", "@street", "day"],
    lines: [
      "Waited forty minutes for the tram to line up.",
      "Worth the wait?",
      "Tourist waved from the window. Accidentally perfect.",
    ],
  },
  {
    id: "life6_photo_mannequin_hands",
    tags: ["a:photographer", "b:smuggler"],
    lines: [
      "Got any mannequin hands? It's for a concept shoot.",
      "Left or right?",
      "Does it matter?",
      "Mate, it always matters. Lefts are dearer.",
    ],
  },

  // ── Musicians: gigs, bands, money, the dream ──
  {
    id: "life6_music_fridge_soundcheck",
    tags: ["a:musician", "@stage"],
    lines: [
      "Check, check. One two. Is the bass even on?",
      "Bass is on, the fridge is on, my nan can hear it.",
      "Perfect. Turn it up a notch.",
    ],
  },
  {
    id: "life6_music_band_name_cones",
    tags: ["a:musician", "b:musician"],
    lines: [
      "We need a new band name. Something local.",
      "Road Cone Orchestra?",
      "Bit long. Just 'The Cones'.",
      "Orange merch. Write it down before I forget.",
    ],
  },
  {
    id: "life6_music_drinks_tab_hug",
    tags: ["a:musician", "a:broke"],
    lines: [
      "Last gig paid in a drinks tab and a hug.",
      "Was it a good hug at least?",
      "Decent hug. The tab ran out by the second song.",
    ],
  },
  {
    id: "life6_music_opening_roastie",
    tags: ["a:musician", "b:musician", "evening"],
    lines: [
      "We're opening at the Town Hall on Friday.",
      "Opening for who?",
      "Roastie Malone. So, mostly getting roasted.",
    ],
  },
  {
    id: "life6_music_static_wall",
    tags: ["a:musician", "b:mosaic"],
    lines: [
      "Static, you on the decks at the Mosaics thing?",
      "If nobody looks at me directly, yeah.",
      "We'll all face the wall. Out of respect.",
    ],
  },
  {
    id: "life6_music_mv_van",
    tags: ["a:musician", "b:photographer"],
    lines: [
      "How much for a music video? Proper, not a phone.",
      "MosaicScope does them from three hundred.",
      "Three hundred? Our van cost more and it doesn't start.",
    ],
  },
  {
    id: "life6_music_mv_avon_wading",
    tags: ["a:musician", "b:musician"],
    lines: [
      "Music video idea: us playing in the Avon.",
      "In it? Like, wading?",
      "Waist deep with the ducks. MosaicScope can light it.",
      "I'll bring togs. You bring the courage.",
    ],
  },
  {
    id: "life6_music_contract_setlist",
    tags: ["a:musician", "b:musician", "@stage"],
    lines: [
      "Who wrote 'Wonderwall' on our setlist?",
      "Promoter. Says it's in the contract.",
      "Fine. One verse, then we go full noise.",
    ],
  },
  {
    id: "life6_music_amp_ovation",
    tags: ["a:musician", "a:sad"],
    lines: [
      "Amp blew up mid-solo at the Riverside gig.",
      "Like, actual smoke?",
      "Smoke, sparks, one standing ovation. Best set yet.",
    ],
  },
  {
    id: "life6_music_drummer_snacks",
    tags: ["a:musician", "b:musician"],
    lines: [
      "Drummer's quit again.",
      "That's his third time this year.",
      "He keeps rejoining for the van snacks.",
    ],
  },
  {
    id: "life6_music_open_mic_outfit",
    tags: ["a:musician", "b:comic"],
    lines: [
      "You on before or after me at open mic?",
      "After. I'll roast your outfit as a warm-up.",
      "Go for it. It's ironic. Mostly.",
    ],
  },
  {
    id: "life6_music_neighbour_encore",
    tags: ["a:musician", "@residential"],
    lines: [
      "Neighbours banged on the wall during band practice.",
      "Too loud?",
      "They wanted the chorus again. Twice.",
    ],
  },
  {
    id: "life6_music_pukeko_tuesday",
    tags: ["a:musician", "b:musician", "night"],
    lines: [
      "Pink Pukeko offered us the Tuesday slot.",
      "Isn't Tuesday Roastie's night?",
      "We play, he heckles. 'Collaborative', apparently.",
    ],
  },
  {
    id: "life6_music_vinyl_bed",
    tags: ["a:musician", "b:local"],
    lines: [
      "Pressed a hundred vinyls. Sold four.",
      "Where are the other ninety-six?",
      "Holding up my bed. Very supportive fans.",
    ],
  },
  {
    id: "life6_music_streaming_half",
    tags: ["a:musician", "a:broke"],
    lines: [
      "Got my streaming payout this month.",
      "Retiring yet?",
      "Bought half a flat white. The good half.",
    ],
  },
  {
    id: "life6_music_wind_tuning",
    tags: ["a:musician", "storm"],
    lines: [
      "Nor'wester's knocked the whole guitar out of tune.",
      "Blame the weather, eh?",
      "Weather, humidity and my hands. In that order.",
    ],
  },
  {
    id: "life6_music_good_side",
    tags: ["a:musician", "b:photographer", "@stage"],
    lines: [
      "Get my good side tonight, yeah?",
      "Which side's that?",
      "The one facing the crowd. Facing the drums I cry.",
    ],
  },
  {
    id: "life6_music_lyttelton_spirit",
    tags: ["a:musician", "b:musician"],
    lines: [
      "Lyttelton gig was packed last night.",
      "Who drove us back over the hill?",
      "Nobody. We're technically still there in spirit.",
    ],
  },
  {
    id: "life6_music_sound_guy_pies",
    tags: ["a:musician", "b:musician"],
    lines: [
      "Sound guy said 'more vocals' and left for a pie.",
      "Did he come back?",
      "With two pies. Mix was flawless after that.",
    ],
  },
  {
    id: "life6_music_play_for_coffee",
    tags: ["a:musician", "b:barista"],
    lines: [
      "Can I play a song for a coffee?",
      "Depends what you play.",
      "Acoustic covers. Gentle ones.",
      "Deal. Nothing by Oasis, though.",
    ],
  },
  {
    id: "life6_music_ep_cat_cover",
    tags: ["a:musician", "b:musician"],
    lines: [
      "EP's done. We need cover art that isn't my cat.",
      "Your cat's a solid cover.",
      "Cat's booked out. Getting MosaicScope instead.",
    ],
  },
  {
    id: "life6_music_twelve_punters",
    tags: ["a:musician", "a:happy"],
    lines: [
      "Twelve people came tonight. TWELVE.",
      "Is that good?",
      "Ten more than last time. Two of those were bar staff.",
    ],
  },
  {
    id: "life6_music_hagley_tan",
    tags: ["a:musician", "@park", "clear"],
    lines: [
      "Picnic gig at Hagley. Sun's absolutely out.",
      "Sunburn on the fretting hand?",
      "Only the left. My chords have a tan now.",
    ],
  },
  {
    id: "life6_music_kettle_banger",
    tags: ["a:musician", "@studio"],
    lines: [
      "Studio's booked for six hours. We've spent five on tea.",
      "Recorded anything?",
      "The kettle. Honestly? It's a banger.",
    ],
  },
  {
    id: "life6_music_casino_chips",
    tags: ["a:musician", "@casino"],
    lines: [
      "Casino lounge pays the band in chips.",
      "Can you cash them?",
      "Only if Gina likes the set. She tapped a foot once.",
    ],
  },
  {
    id: "life6_music_static_hiding",
    tags: ["a:musician", "party"],
    lines: [
      "Who's on the decks tonight?",
      "Static. Hiding behind the speaker stack.",
      "Shy man, loud bass. Best combo there is.",
    ],
  },
  {
    id: "life6_music_smoke_water",
    tags: ["a:musician", "a:tired", "morning"],
    lines: [
      "Played till two, loaded the van till four.",
      "And now?",
      "Teaching a nine-year-old 'Smoke on the Water'.",
    ],
  },

  // ── Buskers: pitches, tips, rivals, the weather ──
  {
    id: "life6_busk_square_echo",
    tags: ["a:busker", "@plaza"],
    lines: [
      "Cathedral Square's got echo. Free reverb.",
      "And seagulls.",
      "Seagulls are my backing vocals. Unpaid, mind.",
    ],
  },
  {
    id: "life6_busk_bus_ticket_tip",
    tags: ["a:busker", "a:broke"],
    lines: [
      "Case has two bucks, a button and a bus ticket.",
      "Used bus ticket?",
      "Used. Someone tipped me their whole commute.",
    ],
  },
  {
    id: "life6_busk_bagpipe_turf",
    tags: ["a:busker", "b:busker", "rivals"],
    lines: [
      "You're on my corner, bagpipe boy.",
      "Cashel Mall's a public space, mate.",
      "Then play publicly. Somewhere further away.",
    ],
  },
  {
    id: "life6_busk_soft_bagpipes",
    tags: ["a:busker", "b:local"],
    lines: [
      "Any requests?",
      "Something soft and gentle?",
      "These are bagpipes. Soft's not on the menu.",
    ],
  },
  {
    id: "life6_busk_umbrella_crowd",
    tags: ["a:busker", "rain"],
    lines: [
      "Rain brings out the umbrella crowd. Stingy lot.",
      "Why stingy?",
      "Both hands busy. Can't reach a wallet.",
    ],
  },
  {
    id: "life6_busk_traditional_kiwi",
    tags: ["a:busker", "b:tourist"],
    lines: [
      "Where you visiting from?",
      "Germany! Is this traditional Kiwi music?",
      "Very traditional. Oasis covers on a ukulele.",
    ],
  },
  {
    id: "life6_busk_four_eyebrows",
    tags: ["a:busker", "b:cop"],
    lines: [
      "Officer, I'm turning it down already.",
      "I didn't say a word.",
      "Your eyebrows said four. All of them 'volume'.",
    ],
  },
  {
    id: "life6_busk_dumpling_tips",
    tags: ["a:busker", "@market"],
    lines: [
      "Riverside Market owner says play by the dumplings.",
      "Good tips there?",
      "Tips are dumplings. Eating better than ever.",
    ],
  },
  {
    id: "life6_busk_mystery_dancer",
    tags: ["a:busker", "b:local"],
    lines: [
      "Your kid's been dancing for twenty minutes straight.",
      "That's not my kid.",
      "Then someone's missing a very talented kid.",
    ],
  },
  {
    id: "life6_busk_two_pies_rates",
    tags: ["a:busker", "b:mobster"],
    lines: [
      "Sal, I busk here. I don't need protection.",
      "Everybody needs a pie, sweetheart.",
      "Is that a threat?",
      "It's mince and cheese. Fifty a week.",
    ],
  },
  {
    id: "life6_busk_mime_pivot",
    tags: ["a:busker", "b:busker"],
    lines: [
      "Since when are you a mime?",
      "Since the noise complaints.",
      "Clever. Nobody complains about silence.",
      "They complain about the face. I'm working on it.",
    ],
  },
  {
    id: "life6_busk_wine_oclock",
    tags: ["a:busker", "evening", "@street"],
    lines: [
      "Evening crowd tips better. Wine o'clock generosity.",
      "And the morning crowd?",
      "Tips in eye contact. Zero calories, zero dollars.",
    ],
  },
  {
    id: "life6_busk_mum_lawyer",
    tags: ["a:busker", "b:photographer"],
    lines: [
      "Saw you snap me. You going to post that?",
      "If you don't mind. You looked great in that light.",
      "Tag me. My mum still thinks I'm a lawyer.",
    ],
  },
  {
    id: "life6_busk_flash_choc_coins",
    tags: ["a:busker", "b:mosaic"],
    lines: [
      "Flash, stop putting fake coins in my case.",
      "They're chocolate coins. Morale boost.",
      "They melted on my capo. Morale is now low.",
    ],
  },
  {
    id: "life6_busk_duck_sign",
    tags: ["a:busker", "storm"],
    lines: [
      "Wind blew my sign straight into the Avon.",
      "What did it say?",
      "'Will play for food.' A duck's taken it literally.",
    ],
  },
  {
    id: "life6_busk_night_kiwi_tax",
    tags: ["a:busker", "b:vigilante"],
    lines: [
      "Evening, Bryce. Sorry, Night Kiwi.",
      "No idea who Bryce is, citizen.",
      "You did my tax return last April.",
      "...Play something heroic and keep it down.",
    ],
  },
  {
    id: "life6_busk_one_song",
    tags: ["a:busker", "a:tired"],
    lines: [
      "Seven hours busking and one song.",
      "Why only one song?",
      "I know one song. I know it extremely well.",
    ],
  },
  {
    id: "life6_busk_tram_b_flat",
    tags: ["a:busker", "@street"],
    lines: [
      "Tram bell's in B flat. Did you know that?",
      "How would you even know?",
      "Tuned to it. We harmonise every ten minutes.",
    ],
  },
  {
    id: "life6_busk_regent_drumroll",
    tags: ["a:busker", "@street", "day"],
    lines: [
      "New Regent St's the prettiest stage in town.",
      "Even with the tram rolling through?",
      "Especially. The tram's my drum roll.",
    ],
  },
  {
    id: "life6_busk_fountain_applause",
    tags: ["a:busker", "b:busker", "@park"],
    lines: [
      "I busk by the Victoria Square fountain now.",
      "Doesn't it drown you out?",
      "It sounds like applause. I close my eyes and believe.",
    ],
  },
  {
    id: "life6_busk_parking_meter",
    tags: ["a:busker", "a:happy"],
    lines: [
      "Someone tipped me a twenty!",
      "Must've loved the song.",
      "Think they were sloshed and mistook me for a meter.",
    ],
  },
  {
    id: "life6_busk_nan_birthday",
    tags: ["a:busker", "b:local"],
    lines: [
      "Booked a photo shoot for my nan's birthday.",
      "With busking money?",
      "Three weeks of 'Hallelujah'. She's worth every verse.",
    ],
  },
  {
    id: "life6_busk_promo_rate",
    tags: ["a:busker", "b:busker"],
    lines: [
      "Booked my promo shoot. {rate}. Starting price.",
      "For real? That's one decent afternoon of tips.",
      "A sunny afternoon. And the photos last longer.",
    ],
  },
  {
    id: "life6_busk_crush_minor_key",
    tags: ["a:busker", "crush"],
    lines: [
      "Wrote a song about you.",
      "Is it a nice one?",
      "It's in a minor key. That doesn't mean anything.",
    ],
  },

  // ── Skaters: Margaret Mahy, slams, cops, scooters ──
  {
    id: "life6_skate_mahy_dawn_gull",
    tags: ["a:skater", "@playground", "morning"],
    lines: [
      "Margaret Mahy bowl before the little kids wake up.",
      "Peak time, that.",
      "Just me, the dew and one very judgmental gull.",
    ],
  },
  {
    id: "life6_skate_ledge_ego",
    tags: ["a:skater", "a:hurt"],
    lines: [
      "Slammed on the big ledge at Margaret Mahy.",
      "Anything broken?",
      "Ego's broken. Wrist's just being dramatic.",
    ],
  },
  {
    id: "life6_skate_spaghetti_rules",
    tags: ["a:skater", "b:local", "@playground"],
    lines: [
      "Your daughter's watching me like I'm a superhero.",
      "She wants a go. Show her?",
      "Rule one: helmet. Rule two: fall like spaghetti.",
    ],
  },
  {
    id: "life6_skate_snapped_deck",
    tags: ["a:skater", "b:skater", "a:sad"],
    lines: [
      "Snapped my deck. Second one this month.",
      "Sell the halves as art?",
      "Already did. Bloke at the Arts Centre paid fifty.",
    ],
  },
  {
    id: "life6_skate_cone_slalom",
    tags: ["a:skater", "@street"],
    lines: [
      "Manchester St cone slalom. Personal best.",
      "Knock any over?",
      "Knocked one. It knocked me back. We're even.",
    ],
  },
  {
    id: "life6_skate_which_easter",
    tags: ["a:skater", "b:skater"],
    lines: [
      "How long you been trying that kickflip?",
      "Since Easter.",
      "Which Easter, mate?",
    ],
  },
  {
    id: "life6_skate_te_pae_carpark",
    tags: ["a:skater", "rain"],
    lines: [
      "Rain day. The bowl's basically a swimming pool.",
      "So what now?",
      "Covered car park by Te Pae. Smooth, dry, frowned upon.",
    ],
  },
  {
    id: "life6_skate_bouncer_steps",
    tags: ["a:skater", "b:bouncer"],
    lines: [
      "Bro, can I skate the steps out front?",
      "No.",
      "What if I'm really, really good?",
      "Then I'll say no faster.",
    ],
  },
  {
    id: "life6_skate_edit_knees",
    tags: ["a:skater", "b:photographer"],
    lines: [
      "Need a skate edit. Fisheye, low angle, slow-mo.",
      "I can do that. When?",
      "Before my knees retire. So, soonish.",
    ],
  },
  {
    id: "life6_skate_mahy_saturday",
    tags: ["a:skater", "b:skater", "@playground"],
    lines: [
      "MosaicScope's shooting at Margaret Mahy Saturday.",
      "Shooting us?",
      "Shooting whoever lands it. Start practising.",
    ],
  },
  {
    id: "life6_skate_scooter_sandflies",
    tags: ["a:skater", "b:skater"],
    lines: [
      "Scooter kids have taken over the bowl again.",
      "Tiny, fearless, absolutely everywhere.",
      "Like sandflies with helmets.",
    ],
  },
  {
    id: "life6_skate_lime_vert",
    tags: ["a:skater", "b:local"],
    lines: [
      "Was that a Lime scooter on the vert ramp?",
      "It was. Now it's a Lime scooter at the bottom.",
      "Bold choice. Bad choice. Bold.",
    ],
  },
  {
    id: "life6_skate_toast_grip",
    tags: ["a:skater", "b:skater", "evening"],
    lines: [
      "Fresh grip tape. Feels like standing on toast.",
      "Burnt toast?",
      "Perfect toast. Crunchy with confidence.",
    ],
  },
  {
    id: "life6_skate_sumner_nana",
    tags: ["a:skater", "b:local", "a:happy"],
    lines: [
      "Some nana just dropped into the bowl. Clean.",
      "Wait, actually?",
      "Eighty-one. Says she skated Sumner in the seventies.",
    ],
  },
  {
    id: "life6_skate_where_then",
    tags: ["a:skater", "b:cop", "@street"],
    lines: [
      "Can't skate the Square. Can't skate the steps.",
      "Correct on both counts.",
      "So where can I skate?",
      "Margaret Mahy. The bowl. Literally built for you.",
    ],
  },
  {
    id: "life6_skate_nlke_sneakers",
    tags: ["a:skater", "b:smuggler"],
    lines: [
      "These knock-off sneakers say 'Nlke'.",
      "Limited edition.",
      "The sole came off on my first ollie.",
      "Rare collectible now. You're welcome.",
    ],
  },
  {
    id: "life6_skate_hereford_bus",
    tags: ["a:skater", "night", "@street"],
    lines: [
      "Hereford St at night. Smooth as a brand new bowl.",
      "Until the bus comes.",
      "Bus is a feature. Keeps you humble.",
    ],
  },
  {
    id: "life6_skate_other_wrist",
    tags: ["a:skater", "b:medic"],
    lines: [
      "Hi again, nurse.",
      "Same wrist?",
      "Other wrist. Balancing things out.",
    ],
  },
  {
    id: "life6_skate_gloss_rim",
    tags: ["a:skater", "b:graffiti"],
    lines: [
      "Someone painted the bowl rim. It's slippery now.",
      "Guilty. Gloss was all I had left.",
      "You've turned it into a ski field, mate.",
    ],
  },
  {
    id: "life6_skate_sumner_esplanade",
    tags: ["a:skater", "b:skater", "clear"],
    lines: [
      "Esplanade at Sumner. Sea breeze, smooth path.",
      "Then the bus home with our boards?",
      "Driver loves us. He skated the old ramps out there.",
    ],
  },
  {
    id: "life6_skate_cast_loyalty",
    tags: ["a:skater", "@hospital"],
    lines: [
      "Emergency nurses know me by name now.",
      "That's bad, eh?",
      "Gave me a loyalty card. Tenth cast's free.",
    ],
  },
  {
    id: "life6_skate_bored_phase_one",
    tags: ["a:skater", "a:bored"],
    lines: [
      "Bowl's empty, weather's perfect, and I'm bored.",
      "Learn a new trick?",
      "I'm learning to want to learn one. Phase one.",
    ],
  },
  {
    id: "life6_skate_gull_first",
    tags: ["a:skater", "after:fight"],
    lines: [
      "{who} and some bloke scrapping at the skatepark.",
      "Over what?",
      "Who had the bowl first. Answer: the gull.",
    ],
  },
  {
    id: "life6_skate_first_date",
    tags: ["a:skater", "b:skater", "couple"],
    lines: [
      "First date was at Margaret Mahy, remember?",
      "You fell and I laughed.",
      "Then you fell. That's love, basically.",
    ],
  },
  {
    id: "life6_skate_board_launch",
    tags: ["a:skater", "b:local"],
    lines: [
      "Saved up. Booking MosaicScope for my board launch.",
      "Your skateboard is having a launch?",
      "Hand-painted deck. It deserves a portrait.",
    ],
  },
  {
    id: "life6_skate_crew_photo",
    tags: ["a:skater", "b:skater"],
    lines: [
      "Crew photo at Margaret Mahy? A proper one?",
      "Who's shooting it?",
      "MosaicScope. Booked it before you could say no.",
    ],
  },

  // ── Graffiti artists: tags, walls and the war with the cleaners ──
  {
    id: "life6_graff_fifty_two_mins",
    tags: ["a:graffiti", "b:cleaner"],
    lines: [
      "You painted over my piece in under an hour.",
      "Fifty-two minutes. New personal record.",
      "That piece took me all night!",
      "And it took me one coffee.",
    ],
  },
  {
    id: "life6_graff_letters_fast",
    tags: ["a:graffiti", "b:graffiti"],
    lines: [
      "What's your tag actually mean?",
      "Nothing. It's just letters that look fast.",
      "Bold. Same as my whole life plan.",
    ],
  },
  {
    id: "life6_graff_canterbury_oatmeal",
    tags: ["a:graffiti", "b:cleaner"],
    lines: [
      "Why's your paint always that exact beige?",
      "Council beige. Officially 'Canterbury Oatmeal'.",
      "It's the colour of giving up.",
      "It's the colour of a clean wall, sunshine.",
    ],
  },
  {
    id: "life6_graff_legal_wall",
    tags: ["a:graffiti", "b:graffiti"],
    lines: [
      "Council's opened a legal wall in the SALT District.",
      "Legal? Where's the thrill?",
      "The thrill is finishing before the rain.",
    ],
  },
  {
    id: "life6_graff_kiwi_critique",
    tags: ["a:graffiti", "b:vigilante"],
    lines: [
      "You're not catching me tonight, Night Kiwi.",
      "I'm not catching you. I'm critiquing you.",
      "Critiquing?",
      "Your 'K' is wobbly. Practise on paper, citizen.",
    ],
  },
  {
    id: "life6_graff_drippy_outline",
    tags: ["a:graffiti", "rain"],
    lines: [
      "Rain's running my outline down the wall.",
      "Ruined?",
      "Drippy. Expressive. Accidentally gallery-ready.",
    ],
  },
  {
    id: "life6_graff_beat_the_van",
    tags: ["a:graffiti", "b:photographer"],
    lines: [
      "Shoot my piece before the cleaners get to it.",
      "How long have we got?",
      "Twenty minutes. They've got a van and an attitude.",
    ],
  },
  {
    id: "life6_graff_tuam_moustache",
    tags: ["a:graffiti", "b:graffiti", "rivals"],
    lines: [
      "You went over my piece on Tuam St.",
      "It was a throw-up. I improved it.",
      "You put a moustache on my letters!",
    ],
  },
  {
    id: "life6_graff_vito_tomatoes",
    tags: ["a:graffiti", "b:mobster"],
    lines: [
      "Your boss wants a mural on the casino?",
      "Tomatoes. Big ones. Still on the vine.",
      "Not exactly street, is it?",
      "Neither are you, if you say no.",
    ],
  },
  {
    id: "life6_graff_budget_piece",
    tags: ["a:graffiti", "a:broke"],
    lines: [
      "Cans are twenty bucks each now.",
      "Inflation's even hit the vandals.",
      "Doing a one-colour piece. It's called 'Budget'.",
    ],
  },
  {
    id: "life6_graff_fresh_as",
    tags: ["a:graffiti", "after:graffiti"],
    lines: [
      "Who did that new piece? It's actually sick.",
      "{who}. Fresh as.",
      "Steal their colour scheme. Respectfully.",
    ],
  },
  {
    id: "life6_graff_shutter_pukeko",
    tags: ["a:graffiti", "b:shopkeeper"],
    lines: [
      "You paid me to paint your shutter. Now you're mad?",
      "I asked for a nice bird!",
      "That is a nice bird. It's a pukeko with attitude.",
    ],
  },
  {
    id: "life6_graff_bando_caps",
    tags: ["a:graffiti", "b:mosaic"],
    lines: [
      "Bando, got any cheap spray caps?",
      "Traded a box for a broken amp. Two bucks each.",
      "Bando, you beautiful little marketplace.",
    ],
  },
  {
    id: "life6_graff_gold_cones",
    tags: ["a:graffiti", "@street"],
    lines: [
      "Painted every road cone on Durham St gold.",
      "Why gold?",
      "Treasure for the drivers. They've earned it.",
    ],
  },
  {
    id: "life6_graff_daylight_disguise",
    tags: ["a:graffiti", "b:local"],
    lines: [
      "Don't tell anyone you saw me.",
      "You're painting a giant kiwi in broad daylight.",
      "Daylight's the new disguise.",
    ],
  },
  {
    id: "life6_graff_mum_spelling",
    tags: ["a:graffiti", "b:local"],
    lines: [
      "Mum saw my new piece and cried.",
      "Proud tears?",
      "She said it was spelt wrong. It was. Still proud.",
    ],
  },
  {
    id: "life6_graff_madras_two_hours",
    tags: ["a:graffiti", "b:graffiti", "late"],
    lines: [
      "Three a.m. on Madras. Wall's fresh as.",
      "Cleaners start at five.",
      "Then we've got two hours to be famous.",
    ],
  },
  {
    id: "life6_graff_hide_cans",
    tags: ["a:graffiti", "a:scared", "wanted"],
    lines: [
      "Sirens. Put the can away.",
      "I'm holding six cans.",
      "Put five away. Hold one like it's a drink.",
    ],
  },
  {
    id: "life6_graff_screaming_eel",
    tags: ["a:graffiti", "after:kiss"],
    lines: [
      "Just saw {who} kissing under my mural.",
      "Romantic.",
      "My mural's a screaming eel. They chose that.",
    ],
  },
  {
    id: "life6_graff_brush_eel",
    tags: ["a:graffiti", "b:cleaner", "friends"],
    lines: [
      "Morning. Leave the eel till after lunch?",
      "I'll do the other side of the street first. Fair go.",
      "Legend. I'll paint you a broom on the next one.",
    ],
  },
  {
    id: "life6_graff_mural_archive",
    tags: ["a:graffiti", "b:photographer"],
    lines: [
      "Can you shoot all my murals before the beige comes?",
      "Like a documentary series?",
      "Like evidence. That I was, briefly, a genius.",
    ],
  },
  {
    id: "life6_graff_album_wall",
    tags: ["a:graffiti", "b:musician"],
    lines: [
      "Painted your album cover on the Kilmore St wall.",
      "Can we shoot it for the actual cover?",
      "Get MosaicScope here before the cleaners do. Run.",
    ],
  },
  {
    id: "life6_graff_bowl_side",
    tags: ["a:graffiti", "b:skater", "@playground"],
    lines: [
      "Reckon I could paint the side of the bowl?",
      "Paint a big kea stealing a wiper blade.",
      "Done. And a tiny Night Kiwi chasing it.",
    ],
  },
  {
    id: "life6_graff_alley_light",
    tags: ["a:graffiti", "b:photographer", "night", "@alley"],
    lines: [
      "What's the torch for? You painting too?",
      "Painting with light. Long exposure.",
      "So we're rivals now. Light versus spray.",
    ],
  },

  // ── Cleaners: the dawn shift, the tags, the mess ──
  {
    id: "life6_clean_kebab_gary",
    tags: ["a:cleaner", "b:cleaner", "morning"],
    lines: [
      "Five a.m. Cashel Mall. Who left half a kebab?",
      "Same person every Saturday.",
      "I've started a file. I've named him Gary.",
    ],
  },
  {
    id: "life6_clean_loose_never_sleeps",
    tags: ["a:cleaner", "b:cleaner"],
    lines: [
      "Forty-three tags removed this week.",
      "Record?",
      "Record's fifty. The 'LOOSE' guy never sleeps.",
    ],
  },
  {
    id: "life6_clean_good_and_paid",
    tags: ["a:cleaner", "b:graffiti"],
    lines: [
      "Honestly? Your piece was good.",
      "Then why'd you paint over it?",
      "Because I'm paid to. Good and paid aren't friends.",
    ],
  },
  {
    id: "life6_clean_fountain_canoe",
    tags: ["a:cleaner", "after:party"],
    lines: [
      "Who threw that party? {who}?",
      "Yep. Went off.",
      "Found a canoe in the fountain. A whole canoe.",
    ],
  },
  {
    id: "life6_clean_trolley_hat",
    tags: ["a:cleaner", "b:cleaner"],
    lines: [
      "Pulled nine road cones out of the Avon today.",
      "Nine?",
      "And a shopping trolley wearing one like a hat.",
    ],
  },
  {
    id: "life6_clean_money_gun_carpet",
    tags: ["a:cleaner", "b:cleaner", "late"],
    lines: [
      "Did the Pink Pukeko after money-gun night.",
      "Much cash about?",
      "Fake cash. Thousands. Glued to the carpet.",
    ],
  },
  {
    id: "life6_clean_eat_pie_off_it",
    tags: ["a:cleaner", "b:local", "a:happy"],
    lines: [
      "Look at that footpath. Just look at it.",
      "It's... a footpath.",
      "It's MY footpath. You could eat a pie off it.",
    ],
  },
  {
    id: "life6_clean_litter_with_roots",
    tags: ["a:cleaner", "b:mobster"],
    lines: [
      "I clean streets, not the Don's tomato beds.",
      "The Don says a weed is just litter with roots.",
      "Fine. But I'm not touching the zucchini.",
    ],
  },
  {
    id: "life6_clean_wet_and_moody",
    tags: ["a:cleaner", "b:photographer"],
    lines: [
      "Shift over, mate. I'm hosing this alley.",
      "I'm shooting a band right here in five!",
      "Then they'll be wet and moody. You're welcome.",
    ],
  },
  {
    id: "life6_clean_freeze_gel",
    tags: ["a:cleaner", "b:villain"],
    lines: [
      "You left goo all over the Arts Centre steps.",
      "Not goo. Prototype freezing gel for the Avon.",
      "Well, it's frozen my mop to the ground.",
    ],
  },
  {
    id: "life6_clean_bin_installation",
    tags: ["a:cleaner", "storm"],
    lines: [
      "Nor'wester's redistributed every bin on Colombo.",
      "So it's a mess out there?",
      "It's an installation. I'll be uninstalling it.",
    ],
  },
  {
    id: "life6_clean_ten_minute_respect",
    tags: ["a:cleaner", "after:graffiti"],
    lines: [
      "{who} hit the Kilmore St wall again.",
      "Painting over it now?",
      "After my flat white. Fresh tags get ten minutes.",
    ],
  },
  {
    id: "life6_clean_arm_circles",
    tags: ["a:cleaner", "b:cleaner", "a:tired"],
    lines: [
      "Dreamt I scrubbed the entire Cathedral clean.",
      "Spotless, was it?",
      "Woke up with my arm still going in circles.",
    ],
  },
  {
    id: "life6_clean_leaf_duel",
    tags: ["a:cleaner", "b:cleaner", "@park"],
    lines: [
      "Autumn in Hagley. About a billion leaves.",
      "Using the blower?",
      "The wind's blowing them back. It's a duel.",
    ],
  },
  {
    id: "life6_clean_gum_galaxy",
    tags: ["a:cleaner", "a:angry"],
    lines: [
      "Gum on Cashel Mall. Hundreds of them.",
      "Like little stars?",
      "Like a crime scene stretched over twelve years.",
    ],
  },
  {
    id: "life6_clean_left_shoe",
    tags: ["a:cleaner", "b:local"],
    lines: [
      "Did you lose a left shoe?",
      "Yes! Where'd you find it?",
      "On top of a bus shelter. Long story, I assume.",
    ],
  },
  {
    id: "life6_clean_free_two_pies",
    tags: ["a:cleaner", "@police"],
    lines: [
      "Someone keeps chalking 'FREE TWO PIES' on these steps.",
      "Who'd do that?",
      "Two Pies. In his own handwriting.",
    ],
  },
  {
    id: "life6_clean_glowing_broom",
    tags: ["a:cleaner", "late"],
    lines: [
      "Found glowing powder all over Cashel Mall.",
      "Moon Sherbet?",
      "Whatever it was, my broom's still glowing.",
    ],
  },
  {
    id: "life6_clean_steak_cheese_debt",
    tags: ["a:cleaner", "a:hungry"],
    lines: [
      "Bakery on my round smells like pure heaven.",
      "Ask them for a pie.",
      "I cleaned their windows. They owe me a steak and cheese.",
    ],
  },
  {
    id: "life6_clean_cone_first_names",
    tags: ["a:cleaner", "after:crash"],
    lines: [
      "{who} took out a whole row of cones.",
      "Who puts them all back?",
      "Me. The cones and I are on first-name terms.",
    ],
  },
  {
    id: "life6_clean_predisapproving",
    tags: ["a:cleaner", "party", "night"],
    lines: [
      "Party's still going and I'm already out with a bag.",
      "Bit early, no?",
      "I'm not cleaning. I'm pre-emptively disapproving.",
    ],
  },
  {
    id: "life6_clean_hivis_flash",
    tags: ["a:cleaner", "b:cleaner"],
    lines: [
      "Getting proper portraits done. MosaicScope.",
      "Of you? In the hi-vis?",
      "Especially in the hi-vis. I glow under flash.",
    ],
  },
  {
    id: "life6_clean_gardens_wedding",
    tags: ["a:cleaner", "b:local", "couple"],
    lines: [
      "We're getting married at the Botanic Gardens.",
      "Photographer sorted?",
      "MosaicScope. And I've swept those paths. They'll shine.",
    ],
  },

  // ── Crossovers and life around town ──
  {
    id: "life6_cross_sweep_four_four",
    tags: ["a:busker", "b:cleaner"],
    lines: [
      "Mind sweeping in time with the song?",
      "I'm already in four-four, mate.",
      "Swish, swish, clunk. Best rhythm section in town.",
    ],
  },
  {
    id: "life6_cross_polished_rail",
    tags: ["a:skater", "b:cleaner"],
    lines: [
      "You polished the rail! I can't grind it now.",
      "That's the idea.",
      "Now it's faster. I'm terrified. Cheers.",
    ],
  },
  {
    id: "life6_cross_cover_my_corner",
    tags: ["a:musician", "b:busker"],
    lines: [
      "Got a Town Hall gig. Cover my Cashel corner?",
      "Keep it warm for you?",
      "Warm, not hot. Don't be better than me.",
    ],
  },
  {
    id: "life6_cross_die_higher",
    tags: ["a:photographer", "b:skater"],
    lines: [
      "One more go. I blinked.",
      "You blinked? I nearly died!",
      "Then nearly die once more, but higher.",
    ],
  },
  {
    id: "life6_cross_setlist_bin",
    tags: ["a:cleaner", "b:musician", "late", "@stage"],
    lines: [
      "Found your setlist in the bin backstage.",
      "Is it the one with the new lyrics on the back?",
      "Coffee-stained. Fished it out for you anyway.",
    ],
  },
  {
    id: "life6_cross_sad_trombone",
    tags: ["a:busker", "b:skater"],
    lines: [
      "Every time you stack it, I play a sad trombone bit.",
      "I fell nine times today.",
      "Best tips I've had all year.",
    ],
  },
  {
    id: "life6_cross_salt_neon",
    tags: ["a:photographer", "@alley", "evening"],
    lines: [
      "SALT District laneways at dusk. Neon everywhere.",
      "Bit busy for a shoot?",
      "Busy's good. Strangers make the background breathe.",
    ],
  },
  {
    id: "life6_cross_airport_doco",
    tags: ["a:photographer", "@airport"],
    lines: [
      "Shooting arrivals at the airport for a doco.",
      "Hugs and happy tears?",
      "Mostly people asking where the bus goes.",
    ],
  },
  {
    id: "life6_cross_market_dumplings",
    tags: ["a:photographer", "@market", "morning"],
    lines: [
      "Riverside Market at opening. Steam off the dumplings.",
      "Shooting or eating?",
      "Both. One hand each. Advanced technique.",
    ],
  },
  {
    id: "life6_cross_second_shooter",
    tags: ["a:photographer", "b:photographer"],
    lines: [
      "Chris needs a second shooter on Saturday.",
      "For what?",
      "Lantern night. I'd pay to be there. He's paying me.",
    ],
  },
  {
    id: "life6_cross_pay_it_forward",
    tags: ["a:photographer", "b:musician"],
    lines: [
      "Want proper photos for the band? Check out {handle}.",
      "Isn't that sending work to the competition?",
      "Half my tricks I learned off Chris. Pay it forward.",
    ],
  },
  {
    id: "life6_cross_ep_mood_boards",
    tags: ["a:musician", "b:musician"],
    lines: [
      "DMed {handle} about the EP shoot.",
      "Any reply?",
      "Ten minutes. With mood boards. I'm in love.",
    ],
  },
  {
    id: "life6_cross_bassist_wig",
    tags: ["a:musician", "a:happy"],
    lines: [
      "We booked the music video! MosaicScope!",
      "Who's playing the love interest?",
      "Our bassist. In a wig. Low budget, high art.",
    ],
  },
  {
    id: "life6_cross_looking_available",
    tags: ["a:musician", "after:shoot"],
    lines: [
      "MosaicScope just shot {who} down by the river.",
      "Jealous?",
      "I'm standing by the river now. Looking available.",
    ],
  },
  {
    id: "life6_cross_party_mirror_ball",
    tags: ["a:musician", "after:party"],
    lines: [
      "That party with {who}? Played till sunrise.",
      "How was the crowd?",
      "Two people, a dog and a mirror ball. Iconic.",
    ],
  },
  {
    id: "life6_cross_crouched_singing",
    tags: ["a:photographer", "b:musician", "friends"],
    lines: [
      "Still got the shots from our first gig together.",
      "The one with the broken mic stand?",
      "You sang crouched the whole set. Still my favourite.",
    ],
  },
  {
    id: "life6_cross_dads_coat",
    tags: ["a:photographer", "strangers"],
    lines: [
      "Sorry, can I take your portrait? That coat's unreal.",
      "This old thing? It was my dad's.",
      "Tell your dad he's in a portfolio now.",
    ],
  },
  {
    id: "life6_cross_confident_in_g",
    tags: ["a:musician", "b:musician", "rivals"],
    lines: [
      "Heard your new single.",
      "Go on, say it. I can take it.",
      "It's very... confident for something in G.",
    ],
  },
  {
    id: "life6_cross_sharpest_frame",
    tags: ["a:photographer", "after:crime"],
    lines: [
      "Got {who} legging it on camera by accident.",
      "Giving it to the cops?",
      "Sharpest frame I've shot all week. Bittersweet.",
    ],
  },
  {
    id: "life6_cross_dramatic_arrest",
    tags: ["a:busker", "after:arrest"],
    lines: [
      "{who} got cuffed right in front of my pitch.",
      "Did you stop playing?",
      "Switched to something dramatic. Tips went bonkers.",
    ],
  },
  {
    id: "life6_cross_seatbelt_lens",
    tags: ["a:photographer", "a:rich"],
    lines: [
      "Big wedding paid out. Bought a new lens.",
      "How big?",
      "So big it needs its own seatbelt in the car.",
    ],
  },

  // ── Latest Insta post ──
  {
    id: "life6_post_toaster_wizard",
    tags: ["post", "a:photographer"],
    lines: [
      "Studied the light in '{post}' for an hour.",
      "Work it out?",
      "Nope. Chris is a wizard and I'm a toaster.",
    ],
  },
  {
    id: "life6_post_single_energy",
    tags: ["post", "a:musician"],
    lines: [
      "'{post}'. That's the energy for our next single.",
      "Moody?",
      "Moody and expensive-looking. On a busker budget.",
    ],
  },
  {
    id: "life6_post_genuine_nod",
    tags: ["post", "a:busker"],
    lines: [
      "Played a song inspired by '{post}'.",
      "How'd it go down?",
      "Two dollars and a nod. The nod was genuine.",
    ],
  },
  {
    id: "life6_post_wallpaper_landed",
    tags: ["post", "a:skater"],
    lines: [
      "'{post}' is my phone wallpaper now.",
      "Over your kickflip clip?",
      "My kickflip never landed. That photo did.",
    ],
  },
  {
    id: "life6_post_mural_tribute",
    tags: ["post", "a:graffiti"],
    lines: [
      "Thinking of painting '{post}' as a mural.",
      "Copying it?",
      "Tributing it. Huge. Somewhere cleaners can't reach.",
    ],
  },
  {
    id: "life6_post_smoko_gum",
    tags: ["post", "a:cleaner"],
    lines: [
      "Saw '{post}' on my smoko break.",
      "Any good?",
      "So good I let the gum sit an extra minute.",
    ],
  },
  {
    id: "life6_post_rethought_career",
    tags: ["post", "a:photographer", "b:photographer"],
    lines: [
      "You seen '{post}'?",
      "Saw it. Went quiet. Rethought my career.",
      "Same. Then I booked myself a workshop.",
    ],
  },
  {
    id: "life6_post_couch_money",
    tags: ["post", "a:musician", "b:musician"],
    lines: [
      "Booking MosaicScope after seeing '{post}'.",
      "With what money?",
      "Gig money. Vinyl money. Couch cushion money.",
    ],
  },
  {
    id: "life6_post_skatepark_silence",
    tags: ["post", "a:skater", "@playground"],
    lines: [
      "Someone passed '{post}' round the skatepark.",
      "Reaction?",
      "Twelve skaters went silent. That never happens.",
    ],
  },
  {
    id: "life6_post_bagpipe_vibration",
    tags: ["post", "a:busker", "b:local"],
    lines: [
      "Have you seen '{post}'?",
      "Can't. Your bagpipes are vibrating my phone.",
      "Fine. I'll stop. Look. Then I'll resume.",
    ],
  },
  {
    id: "life6_post_council_secret",
    tags: ["post", "a:graffiti", "b:cleaner"],
    lines: [
      "Even you've got to like '{post}'.",
      "Liked it twice. Don't tell the council.",
      "Your secret's safe. Unlike my walls.",
    ],
  },
  {
    id: "life6_post_leafblower_reading",
    tags: ["post", "a:cleaner", "b:cleaner"],
    lines: [
      "Read '{post}' out to the crew this morning.",
      "Over the leaf blowers?",
      "Shouted it. Got a round of applause.",
    ],
  },
  {
    id: "life6_post_spine_of_steel",
    tags: ["post", "a:photographer", "night"],
    lines: [
      "'{post}'. How do you even get that at night?",
      "Patience and a tripod?",
      "And a spine of steel. I'd have gone home for chips.",
    ],
  },
  {
    id: "life6_post_friday_fingers",
    tags: ["post", "a:musician", "@stage"],
    lines: [
      "A gig post like '{post}' would change everything.",
      "We'd need MosaicScope here for that.",
      "Already messaged. Fingers crossed for Friday.",
    ],
  },
  {
    id: "life6_post_film_a_part",
    tags: ["post", "a:skater", "b:skater"],
    lines: [
      "'{post}' made me want to film a proper part.",
      "Fisheye and all?",
      "Fisheye, slow-mo, and me not falling. Pure fiction.",
    ],
  },
  {
    id: "life6_post_puddle_concert",
    tags: ["post", "a:busker", "rain"],
    lines: [
      "Rainy pitch, no crowd. Scrolled to '{post}'.",
      "Cheer you up?",
      "Enough to play a whole set in the puddle.",
    ],
  },
  {
    id: "life6_post_steal_palette",
    tags: ["post", "a:graffiti", "b:graffiti"],
    lines: [
      "'{post}' has better colour than our whole wall.",
      "Rude but correct.",
      "Let's borrow the palette. With love.",
    ],
  },
  {
    id: "life6_post_gulls_and_fans",
    tags: ["post", "a:cleaner", "morning"],
    lines: [
      "Five a.m. and '{post}' already has likes.",
      "Who's up that early?",
      "Me, the gulls and Chris's fans. Same crew.",
    ],
  },
  {
    id: "life6_post_kodak_allows_it",
    tags: ["post", "a:photographer", "b:mosaic"],
    lines: [
      "Kodak, '{post}'. Thoughts?",
      "Sharper than my film. I'll allow it.",
      "High praise from a man who shoots expired stock.",
    ],
  },
  {
    id: "life6_post_drummer_sentence",
    tags: ["post", "a:musician", "b:local"],
    lines: [
      "Sent '{post}' to the band chat.",
      "Anyone bite?",
      "Drummer replied 'book it'. First full sentence all year.",
    ],
  },
  {
    id: "life6_post_one_good_hoodie",
    tags: ["post", "a:skater", "evening"],
    lines: [
      "Saw '{post}' and went straight to the booking page.",
      "Actually booked?",
      "Thursday. Washing my one good hoodie as we speak.",
    ],
  },
  {
    id: "life6_post_two_chord_feeling",
    tags: ["post", "a:busker", "b:busker"],
    lines: [
      "'{post}' has more feeling than my whole set.",
      "Your set's got two chords.",
      "Two chords, loads of feeling. Just not that much.",
    ],
  },
  {
    id: "life6_post_hide_the_beige",
    tags: ["post", "a:graffiti", "night"],
    lines: [
      "Saw '{post}'. Felt something. Grabbed my cans.",
      "Inspired?",
      "Dangerously. Somebody hide the beige paint.",
    ],
  },
  {
    id: "life6_post_beauty_allergies",
    tags: ["post", "a:cleaner", "b:local"],
    lines: [
      "Didn't think I'd tear up over '{post}'.",
      "Hay fever?",
      "Beauty. Hay fever. Mostly beauty.",
    ],
  },
  {
    id: "life6_post_not_even_me",
    tags: ["post", "a:photographer", "b:local"],
    lines: [
      "'{post}' is why I'd book MosaicScope over anyone.",
      "Even over you?",
      "Even over me. And I'm brilliant.",
    ],
  },
  {
    id: "life6_post_noodle_ambition",
    tags: ["post", "a:musician", "a:broke"],
    lines: [
      "'{post}' made me start saving properly.",
      "How far along?",
      "Halfway. Living on noodles and ambition.",
    ],
  },
];
