import type { Exchange } from "../exchanges";

/** Street banter: quick, cheeky exchanges between strangers and regulars, on any corner of the city. */
export const STREET_BANTER: Exchange[] = [
  { id: "sbnt_sunny_bloke", tags: ["strangers", "clear", "day", "@street"], lines: ["Lovely day, mate. Shame about the wind.", "It's not wind. It's a free hairdryer.", "Then I'll have the full wash."] },
  { id: "sbnt_wrong_bus", tags: ["strangers", "morning", "@street"], lines: ["Is this the 1 or the 3?", "It's the bus. Got every number on it.", "That's a fair answer, but I'm late."] },
  { id: "sbnt_pigeon_sandwich", tags: ["strangers", "day", "@plaza"], lines: ["That pigeon just stole half my pie.", "Mate, he's been doing that since the seventies.", "The seventies were a better time for pigeons."] },
  { id: "sbnt_dog_parade", tags: ["strangers", "day", "@park"], lines: ["Your dog's wearing a tutu.", "He insisted. I'm just the valet.", "He's walking better than my flatmate."] },
  { id: "sbnt_shoe_polish", tags: ["strangers", "morning", "@street", "a:tired"], lines: ["Your shoes are on the wrong feet.", "They're on the right feet. The feet are the wrong ones.", "That's the most Christchurch thing I've ever heard."] },
  { id: "sbnt_coffee_queue", tags: ["strangers", "morning", "@food"], lines: ["You're second in line. I'm first in spirit.", "Spirit doesn't get a coffee, mate.", "Then I'll wait in spirit. Very slowly."] },
  { id: "sbnt_lost_keys", tags: ["strangers", "night", "@street", "a:angry"], lines: ["Have you seen my keys? Big red fob.", "Found them. You left them in a kebab.", "Ah. Tell me it wasn't the chilli sauce."] },
  { id: "sbnt_queue_jump", tags: ["strangers", "day", "@shops", "a:angry"], lines: ["Oi, the queue starts at the back, not in front of me.", "I'm the front queue. Spiritually. Obviously.", "You're spiritually in the wrong spot, mate."] },
  { id: "sbnt_taxi_bet", tags: ["strangers", "night", "@street", "a:taxi"], lines: ["I bet you can't get home without a taxi.", "I bet you owe me a fiver.", "Bet's off. You were right. Let's split the fare."] },
  { id: "sbnt_cracked_phone", tags: ["strangers", "day", "@street", "a:tired"], lines: ["Your phone's got more cracks than the footpath.", "It's got character. Like a painting.", "The painting's from a bad car accident."] },
  { id: "sbnt_wet_chips", tags: ["strangers", "rain", "@street"], lines: ["Your chips are soggy. Want a new bag?", "It's a Christchurch chip. Soggy is the point.", "Then you're fighting nature. Good on you."] },
  { id: "sbnt_scooter_lost", tags: ["strangers", "day", "@street", "a:local"], lines: ["Is that your scooter lying in the road?", "It's a rescue. I'm just giving it a shot.", "It's not a rescue, it's a crime scene."] },
  { id: "sbnt_hat_sale", tags: ["strangers", "day", "@market", "a:vendor"], lines: ["How much for the hat that looks like a pie?", "Twelve dollars. It's cheaper than a real pie.", "Twelve dollars for a hat that says pie? I'm in."] },
  { id: "sbnt_wrong_stop", tags: ["strangers", "evening", "@street"], lines: ["Is this the stop for the Arts Centre?", "No, that's the stop for regret. Get on the bus next to it.", "Thanks. I think my life just got a lot clearer."] },
  { id: "sbnt_bike_lock", tags: ["strangers", "day", "@street", "a:local"], lines: ["You've locked your bike to my bike.", "We're a team now. A two-bike team.", "I'm not into commitment. Get your bike."] },
  { id: "sbnt_street_fair", tags: ["strangers", "clear", "day", "@plaza", "a:local"], lines: ["Is there a market today or just vibes?", "Vibes and one stall selling tea towels.", "Vibes are free. I'll take a tea towel too."] },
  { id: "sbnt_squeaky_shoe", tags: ["strangers", "morning", "@street", "a:tired"], lines: ["Your shoes squeak louder than the tram ever did.", "Tram? We don't have trams.", "Then I'm making a new sound for the city."] },
  { id: "sbnt_ticket_fine", tags: ["strangers", "day", "@street", "a:angry"], lines: ["You parked on my wheelie bin.", "It was a bin wrapped in a car. Very confusing.", "I'll be calling the council, and the bin."] },
  { id: "sbnt_free_wifi", tags: ["strangers", "day", "@street", "a:bored"], lines: ["What's the wifi password here?", "It's 'nope'. Then it's 'nope123'.", "Brilliant. I'll just go hungry in the cloud."] },
  { id: "sbnt_weather_roulette", tags: ["strangers", "morning", "@street", "a:tired"], lines: ["Will it rain today or should I bring sunglasses?", "Bring both. Christchurch doesn't do halfway.", "Then I'm bringing a hat and a boat."] }
];
