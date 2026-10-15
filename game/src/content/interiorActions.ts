/**
 * Things to DO in every building you can walk into, on top of each floor plan's own counter and characters.
 * Each action names the props it belongs next to (the bench press by the gym machines, the dance floor on the club
 * rug); `placeActions` finds a free, reachable tile beside one of them, clear of the other interactables, so the
 * hand-built floor plans never need editing. An action with no room to stand is simply left out.
 *
 * Kinds with a job (BUILDINGS[kind].job) also get "Pick up a shift" by the counter: real wages, tiring.
 */
import type { BuildingKind } from "./buildings";
import { BUILDINGS } from "./buildings";
import type { InteriorDef, Interactable, PropType } from "./interiors";
import { blockedAt, reachable } from "./interiorNav";

export interface Action extends Omit<Interactable, "x" | "y"> { near: PropType[] }

const A = (id: string, label: string, effect: Interactable["effect"], near: PropType[], lines: string[], cost?: number): Action =>
  ({ id: `act_${id}`, label, effect, near, text: lines[0], lines, ...(cost ? { cost } : {}) });

export const ACTIONS: Partial<Record<BuildingKind, Action[]>> = {
  pizza: [
    A("slice", "Slice at the bar ($6)", "eat", ["table", "counter"], ["Pepperoni, folded in half, eaten standing up. The correct way.", "The slice is too hot and you eat it anyway. Roof of your mouth: gone.", "Cheese pull for days. Someone films it."], 6),
    A("oven", "Watch the oven", "browse", ["machine", "counter"], ["The wood oven roars. The pizzaiolo spins a base like it owes him money.", "Bases going in, bubbling, coming out. Hypnotic.", "The chef flicks flour at you. Affectionately, you think."]),
  ],
  sushi: [
    A("train", "Grab a plate off the train ($8)", "eat", ["counter", "table"], ["Salmon nigiri glides past. You commit.", "You hesitate, it leaves, you wait a full lap for it. Worth it.", "Three plates deep. The stack judges you quietly."], 8),
    A("miso", "Miso and a sit-down", "cuppa", ["table", "chair"], ["Miso soup, hot enough to fix your whole week.", "Green tea refill. The chef nods once. Respect."], 3),
  ],
  fishchips: [
    A("leaner", "Eat on the leaner ($9)", "eat", ["table", "bench", "counter"], ["Hot chips in paper, vinegar everywhere. Perfect.", "A seagull watches you through the window. It knows.", "Battered fish, lemon, a scoop of chips. Summer in a parcel."], 9),
    A("paper", "Read the old Press", "read", ["bench", "table", "counter"], ["Last week's paper. Council still arguing about the stadium.", "Letters page: someone's furious about a cycleway again."]),
  ],
  bakery: [
    A("pie", "Hot pie, eat it here ($5)", "eat", ["counter", "table"], ["Mince and cheese. Lava-hot. Burn it is.", "Steak and cheese, flaky pastry all down your front.", "Potato top. The bakery queen nods approvingly."], 5),
    A("window", "Ogle the cabinet", "browse", ["cabinet", "counter", "shelf"], ["Custard squares, lamingtons, a cream donut the size of your head.", "The cheese rolls are going fast. Southland would approve."]),
  ],
  cafe: [
    A("paper", "Read the paper", "read", ["table", "sofa", "chair"], ["The crossword's half done. Someone wrote 'MUM' in every box.", "Property prices again. You close the paper gently."]),
    A("laptop", "Laptop by the window", "work", ["table", "chair"], ["Emails. So many emails. The flat white keeps you alive.", "You do a solid hour. The barista refills you without asking."]),
  ],
  dairy: [
    A("lotto", "Scratchie ($5)", "play", ["counter"], ["Scratch, scratch... nothing. Classic.", "Two matching! Not three. Never three.", "You win $5. You buy another. You lose $5."], 5),
    A("mags", "Flick through the mags", "read", ["shelf", "rack", "counter"], ["A car mag, a gossip mag and a fishing mag. You read all three.", "The owner coughs pointedly. This isn't a library."]),
  ],
  toyshop: [
    A("demo", "Play with the demo toys", "play", ["table", "shelf"], ["A remote control car does a flip. You laugh like a kid.", "You squeeze the singing plush. It will not stop singing.", "The yoyo goes down. The yoyo does not come back up."]),
    A("browse", "Browse the shelves", "browse", ["shelf", "rack"], ["Foam swords, water pistols, a slinky. Childhood, aisle by aisle.", "A puzzle box with 3,000 pieces. Someone's brave."]),
  ],
  sports: [
    A("net", "Try out the gear", "workout", ["rack", "mat"], ["Practice swings in the net. Nearly took out a display.", "You test the boxing gloves on a bag. The bag wins.", "Skateboard on the test mat. One push, one wobble, one save."]),
    A("shoes", "Shoe wall", "browse", ["shelf", "rack"], ["Two hundred trainers, all slightly different, all $220.", "You find one in your size. Then the other one. Not the same colour."]),
  ],
  pawn: [
    A("cabinet", "Look through the cabinets", "browse", ["cabinet", "shelf", "counter"], ["A trophy for 'Most Improved 1998'. Someone's dad's.", "Three PlayStations, a sword and a wedding ring. Stories everywhere.", "A camera with a roll still in it. Tempting."]),
    A("guitar", "Strum the old guitar", "music", ["rack", "shelf", "cabinet"], ["Four chords, slightly out of tune. Wonderwall. Of course.", "The owner joins in on harmonica. Neither of you mention it."]),
  ],
  bank: [
    A("lollies", "Free lollies at the counter", "vend", ["counter", "desk"], ["One jelly bean. Okay, four.", "The teller slides the bowl closer. A rare kindness."]),
    A("brochure", "Read a brochure", "read", ["desk", "board", "counter", "chair"], ["'Your first home: a realistic guide.' It's two pages and one is blank.", "Term deposit rates. You understand about half of it."]),
  ],
  nightclub: [
    A("dance", "Hit the dance floor", "dance", ["rug", "mat", "pillar"], ["The bass drops. So do you. Then up again.", "You find the rhythm. Someone you don't know cheers.", "Lights strobe, hands up, sweat everywhere. Bliss."]),
    A("dj", "Request a track", "music", ["machine", "counter", "table"], ["The DJ nods, plays something completely different. Banger though.", "Your request comes on. The whole floor sings it. You did that."]),
  ],
  apartments: [
    A("mail", "Check the letterboxes", "read", ["cabinet", "locker", "shelf"], ["Power bill, pizza menu, a postcard for the last tenant.", "Body corporate minutes. Someone's complained about a barbecue."]),
    A("stairs", "Take the stairs", "workout", ["stairs", "lift"], ["Five floors. Your legs file a complaint.", "Halfway up you regret everything. Top floor view though."]),
  ],
  house: [
    A("shower", "Have a shower", "wash", ["bath"], ["Hot water, nobody banging on the door. Luxury.", "You sing in the shower. The neighbours clap. Or bang. Hard to tell."]),
    A("fridge", "Raid the fridge", "eat", ["fridge"], ["Leftover curry, cold. Honestly better.", "Cheese, crackers, one sad pickle. Feast."]),
    A("couch", "Gaming on the couch", "play", ["sofa", "screen"], ["One more round. One more. It's been an hour.", "You rage-quit and immediately requeue."]),
  ],
  office: [
    A("desk", "Do some work", "work", ["desk"], ["Spreadsheet, meeting, spreadsheet about the meeting.", "You clear your inbox. It refills instantly. Tidal."]),
    A("notice", "Read the noticeboard", "read", ["board", "desk"], ["'Whoever keeps eating my yoghurt: I know.'", "Friday drinks cancelled. Morale cancelled."]),
  ],
  garage: [
    A("pie", "Pie from the warmer ($5)", "eat", ["counter", "fridge", "shelf"], ["A servo pie at 2am. Dangerous. Delicious.", "Mince pie, slightly too old, eaten anyway."], 5),
    A("vac", "Use the car vac", "browse", ["machine"], ["Two dollars of suction. You find three fries and a phone charger."]),
  ],
  hospital: [
    A("mags", "Old magazines", "read", ["table", "chair"], ["A magazine from 2014. Celebrity divorce you'd forgotten.", "Half a crossword. The pen's chained to the clipboard."]),
  ],
  records: [
    A("booth", "Listening booth", "music", ["machine", "counter", "rack"], ["Headphones on, needle down. The world goes quiet.", "A B-side you've never heard. Instant favourite.", "The owner hands you another. 'If you like that, try this.'"]),
    A("crates", "Dig through the crates", "browse", ["rack", "shelf", "table"], ["Bargain bin gold: a Kiwi dub record for ten bucks.", "Forty copies of the same Christmas album. Every shop has them."]),
  ],
  barber: [
    A("cut", "Fresh cut ($30)", "wash", ["chair"], ["Skin fade, sharp line-up. You look ten per cent more dangerous.", "The barber spins you to the mirror. Fresh as.", "A trim and a story about the barber's cousin's boat."], 30),
    A("beard", "Beard trim ($15)", "wash", ["chair", "counter"], ["Hot towel, straight razor, total trust.", "Edged up. Your jaw has never looked this sure of itself."], 15),
  ],
  gym: [
    A("bench", "Bench press", "workout", ["rack", "machine"], ["Three sets of eight. A stranger spots you without asking.", "You grind out the last rep. Someone yells 'LIGHT WEIGHT'.", "Chest day. Every day is chest day."]),
    A("tread", "Treadmill", "workout", ["machine"], ["Twenty minutes, speed 9. Your playlist carries you.", "You run nowhere, quickly. It feels great."]),
    A("stretch", "Stretch on the mats", "rest", ["mat", "rug"], ["Hamstrings: tight. Pride: intact. Mostly.", "You lie on the mat 'stretching'. You are resting."]),
  ],
  hotel: [
    A("bar", "Hotel bar ($14)", "cuppa", ["counter", "table", "sofa"], ["A cocktail with an umbrella in it. You feel like a business traveller.", "The bartender's heard everything. Tells you none of it."], 14),
    A("room", "Book a nap room ($80)", "rest", ["sofa", "desk", "counter"], ["Crisp sheets, blackout curtains. You wake up a new person.", "Two hours of sleep in a bed nobody else has to make. Glorious."], 80),
  ],
  police: [
    A("wanted", "Read the wanted posters", "read", ["board", "bench"], ["Wanted: whoever keeps stealing the station's road cones.", "One face looks a bit like you. You move on."]),
  ],
  dealership: [
    A("sit", "Sit in the showroom car", "play", ["machine", "rug", "pillar", "desk"], ["New car smell. You grip the wheel and make engine noises.", "The salesperson appears instantly. 'Can see you in this one.'"]),
  ],
  gallery: [
    A("bench", "Sit with a piece a while", "browse", ["bench", "sofa", "rug"], ["You stare at the big photo until it starts staring back.", "Up close, the colours are louder. Out here, it's quieter in your head."]),
  ],
  hellkitchen: [
    A("table", "Eat at the chef's table ($45)", "eat", ["table"], ["The Wellington arrives. It's perfect. Somewhere someone is crying.", "Scallops, seared hard. The chef stares until you nod."], 45),
  ],
  recycling: [
    A("sort", "Help sort the bins", "work", ["bin", "machine", "trolley"], ["Glass in glass, cans in cans, a full chilly bin in neither.", "You sort for an hour. The pile is somehow bigger."]),
  ],
  mentalhealth: [
    A("journal", "Write in a journal", "read", ["table", "desk", "sofa"], ["You write a page. Then another. Lighter.", "Three things that went alright today. You find four."]),
  ],
};

/** "Pick up a shift" for the kinds that employ someone, on top of the hand-picked actions. */
const SHIFT = (kind: BuildingKind): Action | null => {
  const job = BUILDINGS[kind]?.job;
  if (!job || ACTIONS[kind]?.some((a) => a.effect === "work")) return null;
  return A("shift", "Pick up a shift", "work", ["counter", "desk", "machine"], [`The manager hands you an apron. 'You've done ${job} work before, yeah?'`, "Head down, an hour flies. The till likes you.", "Busy shift. You earn every dollar of it."]);
};

const CLEAR = 1.45; // metres kept between interactables so each prompt is unambiguous

/** A copy of `def` with its building's actions placed beside fitting props. Pure; deterministic. */
export function placeActions(def: InteriorDef): InteriorDef {
  if (def.kind === "fallback") return def;
  const kind = def.kind as BuildingKind;
  const acts = [...(ACTIONS[kind] ?? [])], shift = SHIFT(kind);
  if (shift) acts.push(shift);
  if (!acts.length) return def;
  const taken = def.interactables.map((i) => ({ x: i.x, y: i.y }));
  taken.push({ x: def.door.x, y: def.door.y });
  const free = (x: number, y: number) => !blockedAt(def, x, y) && taken.every((t) => Math.hypot(t.x - x, t.y - y) >= CLEAR) && reachable(def, def.door, { x, y });
  const extra: Interactable[] = [];
  for (const a of acts) {
    let at: { x: number; y: number } | null = null;
    for (const type of a.near) {
      for (const q of def.props) {
        if (q.type !== type) continue;
        // walk a ring just outside the prop's footprint (or around a flat/wall prop's centre)
        const cx = q.x + q.w / 2, cy = q.y + q.h / 2, rx = q.w / 2 + 0.55, ry = q.h / 2 + 0.55;
        for (let i = 0; i < 16 && !at; i++) {
          const t = (i / 16) * Math.PI * 2, x = Math.round((cx + Math.cos(t) * rx) * 10) / 10, y = Math.round((cy + Math.sin(t) * ry) * 10) / 10;
          if (free(x, y)) at = { x, y };
        }
        if (at) break;
      }
      if (at) break;
    }
    if (!at) continue;
    taken.push(at);
    const { near: _near, ...it } = a;
    extra.push({ ...it, x: at.x, y: at.y });
  }
  return { ...def, interactables: [...def.interactables, ...extra] };
}
