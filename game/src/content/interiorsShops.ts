/**
 * Interiors for the high-street kinds (food, retail, services) so a visit to a bakery, a pawn shop
 * or a gym feels like that place and not a generic shopfront. Same rules as interiors.ts: pure
 * data, floor-plan tiles (x east, y south), PG-13, adults, no real brands or people.
 *
 * Most shops share one skeleton (`shopfront`): door on the west wall, a service counter across the
 * middle with staff behind it, the customer floor in front. Gym, barber, nightclub, gallery and
 * dealership have bespoke plans because their rooms are not shaped like a shop.
 */
import type { BuildingKind } from "./buildings";
import type { InteriorDef, Interactable, LightTone, Prop, Spot, FloorMat } from "./interiors";
import { p, wp, z, wallV, wallH, row, spot } from "./interiorKit";

interface Shopfront {
  kind: BuildingKind; title: string; light: LightTone; ambience: string[]; busy: number; staff: { color: string; hat?: string };
  floor: FloorMat; floorColor: string; backFloor?: FloorMat; backColor?: string; counter: string; counterLabel: string;
  /** Fixtures on the back wall, behind the counter (y 0.2 to 1). */
  back: Prop[];
  /** Customer-side furniture; keep x >= 3 or y <= 5 so the door lane (y 6 to 7.5) stays clear. */
  front: Prop[];
  wall: Prop[];
  counterText: string; launch?: Interactable["launch"];
  extra: Interactable[];
  /** Extra spots for customers (sit/browse); the counter queue and staff are added for you. */
  seats: Spot[];
  flavour: string[];
}

function shopfront(o: Shopfront): InteriorDef {
  return {
    kind: o.kind, title: o.title, size: { w: 16, h: 10 }, door: { x: 1.5, y: 6.5 },
    light: o.light, ambience: o.ambience, busy: o.busy, staff: o.staff,
    zones: [z("back", "Behind the counter", 0, 0, 16, 4, o.backFloor ?? "lino", o.backColor ?? "#b9b09a"), z("floor", "Shop floor", 0, 4, 16, 6, o.floor, o.floorColor)],
    props: [
      p("counter", 5, 3, 7, 1, o.counter, o.counterLabel),
      ...o.back, ...o.front, ...o.wall,
      p("mat", 0.4, 5.9, 2, 1.8, "#ec2a1c", "Welcome"),
    ],
    interactables: [{ id: "counter", label: o.counterLabel, x: 8.5, y: 4.6, launch: o.launch ?? "shop", text: o.counterText }, ...o.extra],
    spots: [spot(6.5, 2.1, "work", "s"), spot(8.5, 2.1, "work", "s"), spot(10.5, 2.1, "work", "s"), spot(7.6, 4.8, "queue", "n", "counter"), spot(9.4, 4.8, "queue", "n", "counter"), ...o.seats],
    flavour: o.flavour,
  };
}

// ------------------------------------------------------------------ FOOD
const cafe = shopfront({
  kind: "cafe", title: "Grain & Grind", light: "warm", ambience: ["espresso-machine", "grinder", "murmur", "acoustic-guitar"], busy: 0.6, staff: { color: "#eee4d3", hat: "apron" },
  floor: "wood", floorColor: "#8a6a48", counter: "#3a2c22", counterLabel: "Coffee counter",
  back: [p("machine", 5.6, 0.3, 1.6, 0.9, "#c9c9c9", "Espresso machine"), p("machine", 7.6, 0.3, 0.8, 0.8, "#2a2a33", "Grinder"), p("shelf", 9.2, 0.2, 3, 0.7, "#6b4a2a", "Beans & cups"), p("fridge", 13, 0.3, 1.2, 1, "#d8d8d8", "Milk fridge")],
  front: [
    p("cabinet", 12.2, 3.1, 1.6, 0.9, "#e8e2d6", "Cabinet food"),
    p("table", 4, 7.8, 1.4, 1.4, "#6b4a2a"), ...row("chair", 2, 3.4, 7.9, 2.2, 0, 0.7, 0.7, "#b0641c"),
    p("table", 8, 7.2, 1.4, 1.4, "#6b4a2a"), p("chair", 7.3, 7.5, 0.7, 0.7, "#b0641c"), p("chair", 9.5, 7.5, 0.7, 0.7, "#b0641c"),
    p("sofa", 12, 7.6, 3.2, 1, "#4a5a4a", "Window couch"), p("table", 12.8, 6.2, 1.4, 0.9, "#6b4a2a"), p("plant", 14.6, 4.4, 0.9, 0.9, "#3f8f4a"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#eee4d3", "Grain & Grind"), wp("board", "n", 10.5, 2.5, "#2a2a33", "Flat white $5, Long black $4.50"), wp("window", "w", 2, 2, "#9fd8ff", "Window"), wp("poster", "w", 6.5, 1.4, "#f6b62c", "Open-mic Thursday")],
  counterText: "Barista: 'Flat white? Of course it is.' The machine hisses like it has opinions.",
  extra: [
    { id: "couch", label: "Window couch", x: 13.6, y: 9.0, effect: "rest", text: "The couch swallows you whole. Someone has left a half-finished crossword and a very good pen." },
    { id: "board", label: "Community board", x: 12.5, y: 4.6, text: "Piano lessons. A lost cat called Nigel. A flat with a spare room and a 'no drama' clause." },
  ],
  seats: [spot(4.1, 8.5, "sit", "e"), spot(5.9, 8.5, "sit", "w"), spot(8, 8.3, "sit", "e"), spot(9.9, 8.3, "sit", "w"), spot(13.1, 8.2, "sit", "n"), spot(14.2, 8.2, "sit", "n")],
  flavour: ["Beans, steam and a playlist assembled by someone with feelings.", "A laptop on every second table and a regular who has not left since breakfast."],
});

const bakery = shopfront({
  kind: "bakery", title: "Kiwi Bakehouse", light: "warm", ambience: ["oven-fan", "tray-clatter", "radio", "till"], busy: 0.55, staff: { color: "#fffaf0", hat: "baker" },
  floor: "tile", floorColor: "#d8cdb8", counter: "#c9b48f", counterLabel: "Pie warmer",
  back: [p("machine", 5.4, 0.3, 2.2, 1, "#6b6b73", "Deck oven"), p("rack", 8, 0.3, 2.6, 0.8, "#9aa6ad", "Cooling racks"), p("table", 11, 0.4, 2.2, 1, "#e8e2d6", "Dough bench"), p("cabinet", 13.6, 0.3, 1.4, 1.2, "#d8d8d8", "Flour")],
  front: [
    p("cabinet", 5, 5.4, 2.4, 0.9, "#e8e2d6", "Bread basket"), p("cabinet", 8.4, 5.4, 2.4, 0.9, "#e8e2d6", "Sweet slices"), p("table", 12.6, 5, 1.6, 1.6, "#6b4a2a", "Cream donuts"),
    p("bench", 4, 8.8, 3, 0.6, "#8a6a40"), p("plant", 13.8, 8.2, 1, 1, "#3f8f4a"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#f6b62c", "Hot pies"), wp("board", "n", 11.5, 2.5, "#eee4d3", "Mince & cheese, steak, butter chicken"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock"), wp("poster", "w", 2.5, 1.4, "#f6b62c", "Lamingtons by the half dozen")],
  counterText: "The pie warmer glows like a tiny sunrise. 'Steak and cheese? Mind your fingers, love, it's volcanic.'",
  extra: [
    { id: "bread", label: "Fresh bread", x: 6.2, y: 6.6, text: "Still warm. You tell yourself you're only smelling it." },
    { id: "oven", label: "Back oven", x: 6.5, y: 2.1, text: "A hand-written sign reads: 'Staff only, and also hot. Both are rules.'" },
  ],
  seats: [spot(10.5, 7, "browse", "n"), spot(6, 6.9, "browse", "n"), spot(5.5, 8.4, "sit", "n")],
  flavour: ["Four a.m. energy at any hour: flour on every surface and a radio arguing with itself.", "Pies lined up like a very well-fed choir."],
});

const pizza = shopfront({
  kind: "pizza", title: "Slice of Heaven", light: "warm", ambience: ["oven-roar", "dough-slap", "scooter-outside", "murmur"], busy: 0.65, staff: { color: "#fff", hat: "chef" },
  floor: "tile", floorColor: "#8a3a2a", backFloor: "tile", backColor: "#b9b09a", counter: "#e8e2d6", counterLabel: "Order counter",
  back: [p("machine", 5.4, 0.2, 2.8, 1.1, "#8a3a1c", "Wood-fired oven"), p("table", 8.8, 0.4, 2.6, 1, "#c9c9c9", "Prep bench"), p("fridge", 11.8, 0.3, 1.4, 1, "#d8d8d8", "Toppings"), p("rack", 13.6, 0.3, 1.6, 0.8, "#6b4a2a", "Boxes")],
  front: [
    p("table", 4.4, 8.2, 1.4, 1.1, "#eee4d3"), p("chair", 4.2, 7.5, 0.7, 0.6, "#ec2a1c"), p("chair", 5.2, 7.5, 0.7, 0.6, "#ec2a1c"),
    p("table", 9, 7.6, 1.4, 1.1, "#eee4d3"), p("chair", 8.6, 8.9, 0.7, 0.6, "#ec2a1c"), p("chair", 9.6, 8.9, 0.7, 0.6, "#ec2a1c"),
    p("table", 13, 6, 1.4, 1.1, "#eee4d3"), p("chair", 12.5, 7.3, 0.7, 0.6, "#ec2a1c"), p("chair", 13.6, 7.3, 0.7, 0.6, "#ec2a1c"),
    p("bench", 13, 4.4, 2, 0.5, "#8a6a40", "Takeaway wait"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#f6b62c", "Slice of Heaven"), wp("board", "n", 11.5, 3, "#2a2a33", "Margherita, Hawaiian (it's fine), Meatlovers"), wp("poster", "w", 3, 1.4, "#ec2a1c", "Two for Tuesday")],
  counterText: "'Hawaiian? We don't judge. Out loud.' The oven roars behind a ring of fire-red tiles.",
  extra: [{ id: "oven", label: "Wood-fired oven", x: 6.8, y: 2.1, text: "You can feel it from here. A pizza peel the size of a canoe leans against the wall." }],
  seats: [spot(4.9, 8.3, "sit", "e"), spot(9.7, 7.9, "sit", "e"), spot(13.7, 6.6, "sit", "s"), spot(14.5, 5.4, "phone", "w")],
  flavour: ["Garlic, hot tomato and a delivery rider doing paperwork on a stool.", "Red-checked tile, a wood-fired oven and one very patient dough-tosser."],
});

const sushi = shopfront({
  kind: "sushi", title: "Hana Sushi", light: "soft", ambience: ["conveyor-hum", "plate-clink", "knife-on-board", "soft-pop"], busy: 0.6, staff: { color: "#fff", hat: "chef" },
  floor: "wood", floorColor: "#b89a6a", counter: "#3a2c22", counterLabel: "Sushi bar",
  back: [p("table", 5.6, 0.4, 3, 0.9, "#c9c9c9", "Prep & rice"), p("fridge", 9.4, 0.3, 1.6, 1, "#d8d8d8", "Fish fridge"), p("shelf", 11.6, 0.2, 3, 0.7, "#6b4a2a", "Soy, wasabi, ginger")],
  front: [
    p("table", 4, 4.6, 0.5, 1.1, "#c9c9c9", "Belt end"), ...row("chair", 5, 5.6, 5.5, 1.5, 0, 0.8, 0.7, "#ec2a1c", "Sushi stools"),
    p("rug", 5, 7.2, 8.4, 1, "#b0252a", "Tatami runner"),
    p("table", 5, 8.4, 1.8, 1, "#3a2c22"), p("table", 9, 8.4, 1.8, 1, "#3a2c22"), p("plant", 14.4, 8.4, 1, 1, "#3f8f4a", "Bamboo"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#ff7ad9", "Hana"), wp("poster", "n", 11, 2, "#eee4d3", "Today's catch"), wp("poster", "w", 3, 1.4, "#ec2a1c", "Ichi-go ichi-e"), wp("window", "w", 8, 2, "#9fd8ff", "Window")],
  counterText: "The belt turns. 'Salmon nigiri, avocado roll, and one mystery plate.' The chef bows fractionally.",
  extra: [{ id: "belt", label: "Sushi train", x: 4.6, y: 6.4, text: "Small plates drift past at a stately pace. The colours are a price code nobody has ever memorised." }],
  seats: [spot(6, 6.2, "sit", "n"), spot(7.5, 6.2, "sit", "n"), spot(9, 6.2, "sit", "n"), spot(5.9, 9.5, "sit", "n"), spot(9.9, 9.5, "sit", "n")],
  flavour: ["A conveyor of tiny plates, a quiet chef and the satisfying click of chopsticks.", "Pale wood, warm light, and the long politeness of a good restaurant."],
});

const fishchips = shopfront({
  kind: "fishchips", title: "Sumner Fish & Chips", light: "warm", ambience: ["fryer-sizzle", "paper-wrap", "seagulls", "murmur"], busy: 0.6, staff: { color: "#fff", hat: "apron" },
  floor: "lino", floorColor: "#c9bfa5", counter: "#c0c8cc", counterLabel: "Takeaway counter",
  back: [p("machine", 5.6, 0.3, 3.2, 1, "#9aa6ad", "Fryers"), p("machine", 9.3, 0.3, 1.4, 1, "#c33", "Chip warmer"), p("shelf", 11.2, 0.2, 3.4, 0.7, "#6b4a2a", "Paper, salt, vinegar")],
  front: [
    p("cabinet", 12.4, 3.1, 1.6, 0.9, "#e8e2d6", "Battered sausages"), p("bench", 4, 8.7, 3.6, 0.6, "#8a6a40"), p("bench", 9, 8.7, 3.6, 0.6, "#8a6a40"),
    p("bin", 14.4, 8.4, 0.9, 0.9, "#556", "Bin"), p("table", 13, 5.4, 1.6, 1, "#c9bfa5", "Sauce station"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#3dd6ff", "Fresh fish daily"), wp("board", "n", 11.5, 3, "#eee4d3", "Hoki, snapper, chips, scallop"), wp("poster", "w", 3, 1.4, "#3dd6ff", "Sumner Beach, Christchurch"), wp("window", "w", 8, 2, "#9fd8ff", "Window")],
  counterText: "'Scoop of chips and a fish? Salt and vinegar or you're wrong.' The paper crackles around a very warm parcel.",
  extra: [{ id: "sauce", label: "Sauce station", x: 13.8, y: 6.8, text: "Tomato sauce, tartare, chilli, and the unforgivable mayonnaise nobody orders." }],
  seats: [spot(5.7, 8.1, "sit", "s"), spot(10.9, 8.1, "sit", "s"), spot(14, 7.6, "stand", "n")],
  flavour: ["A salty, warm room that smells exactly like a beach holiday in a newspaper.", "Gulls outside, fryers within, someone waiting for 'the next fish, please'."],
});

// ------------------------------------------------------------------ RETAIL
const dairy = shopfront({
  kind: "dairy", title: "Corner Dairy", light: "cool", ambience: ["fridge-hum", "shop-bell", "radio", "lotto-machine"], busy: 0.45, staff: { color: "#d8d8d8", hat: "cap" },
  floor: "lino", floorColor: "#d8d4c8", counter: "#6b4a2a", counterLabel: "Till",
  back: [p("shelf", 5.4, 0.2, 3.2, 0.7, "#6b4a2a", "Sweets & gum"), p("machine", 9.2, 0.3, 1.2, 0.8, "#223", "Lotto terminal"), p("cabinet", 11, 0.3, 3, 0.9, "#9aa6ad", "Newspapers")],
  front: [
    p("shelf", 3.2, 4.4, 0.9, 2, "#6b4a2a", "Bread & milk"), p("shelf", 5, 5.5, 3.6, 0.8, "#6b4a2a", "Chip aisle"), p("shelf", 5, 7.2, 3.6, 0.8, "#6b4a2a", "Tinned & jars"),
    p("fridge", 13.8, 4.4, 1.6, 1, "#d8d8d8", "Ice blocks"), p("fridge", 13.8, 5.7, 1.6, 1, "#d8d8d8", "Drinks"), p("fridge", 13.8, 7, 1.6, 1, "#d8d8d8", "Pies"),
    p("rack", 10.5, 6.2, 2.4, 0.8, "#9aa6ad", "Pick 'n' mix"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#c6ff3d", "Open late"), wp("poster", "w", 2.5, 1.4, "#c6ff3d", "Bread $3"), wp("clock", "w", 7, 0.8, "#eee4d3", "Clock"), wp("poster", "n", 11, 2, "#f6b62c", "Lotto: big wow")],
  counterText: "'Just the milk? That's $4.20.' A scratchy radio is losing to the fridge hum.",
  extra: [
    { id: "chips", label: "Chip aisle", x: 6.8, y: 6.75, text: "Sixteen flavours of chip. Four of them are 'chicken'. None of them is chicken." },
    { id: "pickmix", label: "Pick 'n' mix", x: 11.7, y: 5.6, text: "A scoop for the kids, a scoop for yourself, and none for the dog." },
  ],
  seats: [spot(6.8, 6.75, "browse", "n"), spot(11.5, 7.9, "browse", "n"), spot(12.5, 5.3, "browse", "e")],
  flavour: ["A bell over the door, a fridge buzzing in B-flat and a cat asleep on the bread.", "Everything you forgot, at slightly more than it should be."],
});

const toyshop = shopfront({
  kind: "toyshop", title: "Toy Box", light: "soft", ambience: ["music-box", "squeak", "kids-murmur", "shop-bell"], busy: 0.45, staff: { color: "#ff7ad9", hat: "cap" },
  floor: "carpet", floorColor: "#5a3a8a", counter: "#ff7ad9", counterLabel: "Toy counter",
  back: [p("shelf", 5.4, 0.2, 3, 0.7, "#ff7ad9", "Boxed sets"), p("shelf", 9, 0.2, 3, 0.7, "#6fe3b0", "Puzzles"), p("cabinet", 12.6, 0.3, 2, 0.9, "#f6b62c", "Gift wrap")],
  front: [
    p("rug", 5, 5.4, 4.6, 3.6, "#3dd6ff", "Play rug"), p("table", 6, 6.4, 2.2, 1.2, "#f6b62c", "Display"),
    p("shelf", 11, 5.5, 0.9, 3, "#6b4a2a", "Plush wall"), p("rack", 12.6, 5.5, 2.4, 0.8, "#9aa6ad", "Foam swords"), p("trolley", 12.8, 7.4, 1.4, 0.9, "#ec2a1c", "Bouncy balls"),
    p("plant", 14.4, 8.8, 1, 1, "#3f8f4a", "Stuffed palm"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#ff7ad9", "Toy Box"), wp("poster", "n", 11, 2.4, "#3dd6ff", "Ages 3 to 103"), wp("poster", "w", 3, 1.4, "#c6ff3d", "Water pistols: outdoors only"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock")],
  counterText: "'A foam sword and a very large plush shark? Brave. Excellent.' The shark gets the best seat in the shop.",
  extra: [
    { id: "plush", label: "Plush wall", x: 10.4, y: 7.2, text: "A hundred soft faces watch you leave. One of them is a shark. It is not leaving with you." },
    { id: "playrug", label: "Play rug", x: 7.2, y: 8.9, effect: "rest", text: "You sit on the rug for a second. It is, honestly, the nicest part of the week." },
  ],
  seats: [spot(6.5, 8.4, "browse", "n"), spot(12.3, 6.85, "browse", "w"), spot(8.5, 6.3, "stand", "s")],
  flavour: ["A tinkling music box, a squeaky toy somewhere that nobody will admit to, and adults pretending to browse the building sets for the kids.", "Bright, soft and slightly over-stocked. Everything is touchable on purpose."],
});

const sports = shopfront({
  kind: "sports", title: "Rebl Sports", light: "cool", ambience: ["ball-bounce", "shoe-squeak", "radio", "shop-bell"], busy: 0.45, staff: { color: "#c6ff3d", hat: "cap" },
  floor: "rubber", floorColor: "#3a3a48", counter: "#24242c", counterLabel: "Sports counter",
  back: [p("shelf", 5.4, 0.2, 3.4, 0.7, "#6b6b73", "Gloves & helmets"), p("rack", 9.2, 0.3, 3, 0.8, "#9aa6ad", "Bats & sticks"), p("locker", 12.8, 0.3, 2, 0.8, "#24242c", "Paintball stock")],
  front: [
    p("rack", 3.4, 4.4, 0.8, 2.2, "#9aa6ad", "Footy balls"), p("rack", 5, 5.5, 3, 0.8, "#6b6b73", "Jerseys"), p("rack", 5, 7.2, 3, 0.8, "#6b6b73", "Shorts"),
    p("bench", 10.5, 5.6, 2.6, 0.6, "#6b4a2a", "Try-on bench"), p("shelf", 10.5, 7.4, 3.6, 0.8, "#24242c", "Shoe wall"), p("trolley", 14.2, 4.4, 1.2, 1.2, "#c6ff3d", "Skateboards"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#c6ff3d", "Game on"), wp("poster", "n", 11, 2.4, "#eee4d3", "Summer cricket sign-ups"), wp("poster", "w", 3, 1.4, "#3dd6ff", "Run the Port Hills"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock")],
  counterText: "'Bat, boxing gloves or both?' The clerk has a calf like a rugby prop and a very gentle voice.",
  extra: [{ id: "shoes", label: "Shoe wall", x: 12.2, y: 8.9, text: "A hundred pairs of shoes, a label saying 'Clearance', and a sniff that says 'not clearance'." }],
  seats: [spot(6.5, 6.7, "browse", "n"), spot(12.2, 6.6, "sit", "n"), spot(8.8, 8.6, "browse", "w")],
  flavour: ["Rubber floor, shoe squeak and a dozen things you will say you bought for 'the kids'.", "Team colours on the wall and a suspiciously pristine cricket bat in the window."],
});

const pawn = shopfront({
  kind: "pawn", title: "Cash Convertz", light: "dim", ambience: ["buzz-light", "clock-tick", "door-chime", "radio-low"], busy: 0.35, staff: { color: "#f6b62c", hat: "cap" },
  floor: "lino", floorColor: "#7a6e58", counter: "#3a3430", counterLabel: "Pawn counter",
  back: [p("vault", 5.4, 0.2, 1.6, 0.9, "#6b6b73", "Safe"), p("cabinet", 7.4, 0.3, 3.4, 0.9, "#4a4a55", "Glass case (jewellery)"), p("shelf", 11.2, 0.2, 3.4, 0.7, "#6b4a2a", "Unclaimed")],
  front: [
    p("rack", 3.4, 4.6, 0.8, 2.2, "#4a4a55", "Guitars"), p("cabinet", 5, 5.5, 3, 0.9, "#9aa6ad", "Watches & phones"), p("shelf", 5, 7.4, 3.6, 0.8, "#6b4a2a", "Tools & cameras"),
    p("table", 10.5, 5.8, 2.4, 1.2, "#6b4a2a", "Vinyl crate"), p("rack", 13.4, 4.4, 1.4, 3, "#4a4a55", "Electronics"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#f6b62c", "Cash for gear"), wp("poster", "n", 11, 2.4, "#eee4d3", "No receipts, no returns, no judgement"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock"), wp("poster", "w", 3, 1.4, "#f6b62c", "Wedding rings")],
  counterText: "'Gold's up. Guitars are down. What have you got?' He peers through a loupe the size of a thumbnail.",
  extra: [
    { id: "guitars", label: "Guitars", x: 2.9, y: 5.2, text: "Fourteen guitars, fourteen heartbreaks. The Strat has a sticker: 'Back soon, Dad.' It has been there a long time." },
    { id: "crate", label: "Vinyl crate", x: 11.7, y: 7.4, text: "Three copies of the same wedding album. Someone's loss, someone's bargain." },
  ],
  seats: [spot(6.5, 6.7, "browse", "n"), spot(12, 8.3, "browse", "n"), spot(12.9, 4.9, "browse", "w")],
  flavour: ["A glass case of other people's second chances, and a clock that is five minutes fast on purpose.", "Everything has a story, a price tag and a hint of 'I wish I hadn't'."],
});

const records = shopfront({
  kind: "records", title: "Penny Lame Records", light: "neon", ambience: ["needle-drop", "bass-rumble", "murmur", "chair-creak"], busy: 0.4, staff: { color: "#b48cff", hat: "cap" },
  floor: "wood", floorColor: "#5a4a68", counter: "#2a1630", counterLabel: "Record counter",
  back: [p("shelf", 5.4, 0.2, 3.4, 0.7, "#2a1630", "New arrivals"), p("machine", 9.2, 0.3, 1.8, 0.9, "#222", "Listening deck"), p("shelf", 11.4, 0.2, 3.2, 0.7, "#2a1630", "Used & rare")],
  front: [
    p("rack", 3.4, 4.4, 1, 3.2, "#6b4a2a", "Crates: Rock"), p("rack", 5.2, 5.4, 3.2, 0.8, "#6b4a2a", "Crates: Jazz"), p("rack", 5.2, 7.2, 3.2, 0.8, "#6b4a2a", "Crates: Hip-hop"),
    p("sofa", 10.4, 6.2, 3.2, 1, "#4a3a8a", "Listening couch"), p("rug", 10.2, 7.4, 3.8, 2, "#ec2a1c", "Rug"), p("lamp", 14.2, 5.2, 0.5, 0.5, "#ff7ad9", "Lava lamp"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#b48cff", "Penny Lame Records"), wp("poster", "n", 11, 2.4, "#3dd6ff", "Live in-store Friday"), wp("poster", "w", 3, 1.4, "#ec2a1c", "Original pressing"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock")],
  counterText: "Needle drops on something that sounds like a decision. 'You'll want that one. Trust me.'",
  extra: [
    { id: "deck", label: "Listening deck", x: 10, y: 2.1, text: "Headphones on the hook. You hear four seconds of a song and then spend twenty minutes finding it." },
    { id: "couch", label: "Listening couch", x: 12, y: 8.4, effect: "rest", text: "The couch exhales under you. Somewhere, someone is playing something in 7/8." },
  ],
  seats: [spot(6.8, 6.6, "browse", "n"), spot(4.7, 7, "browse", "w"), spot(11.6, 7.6, "sit", "n"), spot(13, 7.6, "sit", "n")],
  flavour: ["Crates, dust and a turntable going round with total self-possession.", "A wall of sleeves that each hold a decade of someone else's best year."],
});

const garage = shopfront({
  kind: "garage", title: "Zed Station", light: "cool", ambience: ["fridge-hum", "pump-click", "shop-bell", "radio"], busy: 0.35, staff: { color: "#ec2a1c", hat: "cap" },
  floor: "lino", floorColor: "#d8d4c8", counter: "#9aa6ad", counterLabel: "Pay here",
  back: [p("machine", 5.4, 0.3, 1.6, 0.9, "#223", "Card reader"), p("cabinet", 7.6, 0.3, 3.4, 0.9, "#6b6b73", "Gum & mints"), p("shelf", 11.4, 0.2, 3.2, 0.7, "#6b4a2a", "Oil, wipers, de-icer")],
  front: [
    p("shelf", 3.4, 4.4, 0.9, 2, "#9aa6ad", "Snacks"), p("rack", 5, 5.5, 3.4, 0.8, "#9aa6ad", "Road-trip lollies"), p("rack", 5, 7.2, 3.4, 0.8, "#9aa6ad", "Maps & chargers"),
    p("fridge", 12.6, 4.4, 1.6, 1, "#d8d8d8", "Cold drinks"), p("fridge", 12.6, 5.7, 1.6, 1, "#d8d8d8", "Hot pies"), p("machine", 10.6, 5.4, 1.2, 0.9, "#ec2a1c", "Coffee machine"),
    p("bin", 14.4, 8.4, 0.9, 0.9, "#556", "Bin"),
  ],
  wall: [wp("sign", "n", 5.5, 5, "#ec2a1c", "Zed Station"), wp("poster", "n", 11, 2.4, "#eee4d3", "Free air & water (round the back)"), wp("poster", "w", 3, 1.4, "#c6ff3d", "Windscreen chips fixed"), wp("clock", "w", 8, 0.8, "#eee4d3", "Clock")],
  counterText: "'Pump four? That'll be a fair bit.' She does not blink at the number on the screen.",
  extra: [{ id: "coffee", label: "Coffee machine", x: 11.2, y: 4.9, effect: "cuppa", text: "A cup of something dark and warm. It says 'Latte' but it is a long-black with ambition." }],
  seats: [spot(6.8, 6.7, "browse", "n"), spot(11.2, 6.7, "stand", "s"), spot(13.6, 7.8, "phone", "w")],
  flavour: ["Fluorescent, fresh, open all night. A forecourt that smells faintly of petrol and pies.", "A caffeine stop for people who have somewhere to be, and some who don't."],
});

// ------------------------------------------------------------------ SERVICES
const barber: InteriorDef = {
  kind: "barber", title: "Fresh Cutz", size: { w: 14, h: 10 }, door: { x: 1.5, y: 6.5 },
  light: "warm", ambience: ["clippers", "radio", "chatter", "razor-strop"], busy: 0.5, staff: { color: "#3dd6ff", hat: "apron" },
  zones: [z("waiting", "Waiting", 0, 4, 6, 6, "wood", "#7a6048"), z("chairs", "Cutting floor", 0, 0, 14, 4, "tile", "#3a3a48"), z("back", "Back bench", 6, 4, 8, 6, "tile", "#4a4a55")],
  props: [
    wallH(4, 6, 8), wallH(4, 9.5, 14, "#2b2026"),
    p("table", 1, 0.4, 2.2, 0.8, "#c9c9c9", "Hair products"), ...[0, 1, 2].map((i) => p("chair", 4.4 + i * 2.8, 1.2, 1.1, 1.1, "#ec2a1c", i === 0 ? "Barber chairs" : undefined)),
    p("cabinet", 12.6, 0.4, 1.2, 1.2, "#6b4a2a", "Towel cabinet"),
    p("sofa", 1, 8.2, 3, 1, "#2a3a4e", "Waiting couch"), p("table", 1.2, 4.6, 1.6, 0.9, "#6b4a2a", "Magazines"),
    p("table", 8, 6.4, 2.4, 1, "#c9c9c9", "Wash basin"), p("trolley", 11.4, 6.4, 1.2, 0.9, "#3dd6ff", "Tool trolley"), p("fridge", 12.4, 8.2, 1, 1, "#222", "Drinks"),
    wp("sign", "n", 3.2, 4, "#3dd6ff", "Fresh Cutz"), wp("poster", "n", 9, 2.8, "#eee4d3", "Skin fade ~ $30"), wp("poster", "w", 2.4, 1.2, "#ec2a1c", "No appointment? Wait, mate."),
  ],
  interactables: [
    { id: "chair", label: "Barber chair", x: 5, y: 3.1, effect: "rest", text: "A warm towel, a mirror and a stranger who knows exactly what your head needs. You exhale." },
    { id: "mags", label: "Magazines", x: 2, y: 6, text: "Thirty-one issues of a golf magazine and one dog-eared copy of Shed Weekly." },
    { id: "basin", label: "Wash basin", x: 9.2, y: 7.7, text: "Hot water and a head rub. This is the real reason people come here." },
  ],
  spots: [spot(5, 2.9, "work", "n"), spot(7.8, 2.9, "work", "n"), spot(2.2, 7.9, "sit", "e"), spot(3.3, 7.9, "sit", "n"), spot(5.2, 6.8, "queue", "n", "chair"), spot(10, 8.5, "phone", "w"), spot(12.4, 5.5, "talk", "w")],
  flavour: ["Clippers, a radio on the rugby and an unreasonable amount of confidence.", "A very good place to be told the truth about your fringe."],
};

const gym: InteriorDef = {
  kind: "gym", title: "Iron Works Gym", size: { w: 22, h: 14 }, door: { x: 1.5, y: 9.5 },
  light: "cool", ambience: ["plate-clang", "treadmill", "music-thump", "grunt"], busy: 0.5, staff: { color: "#ec2a1c", hat: "cap" },
  zones: [
    z("desk", "Front desk", 0, 0, 7, 5, "tile", "#4a4a55"), z("cardio", "Cardio", 0, 5, 8, 9, "rubber", "#2a2a33"),
    z("weights", "Free weights", 8, 0, 14, 9, "rubber", "#24242c"), z("stretch", "Stretching & mats", 8, 9, 14, 5, "rubber", "#3a3a48"),
  ],
  props: [
    wallV(7, 0, 4.6), wallH(5.4, 0, 5.5),
    p("counter", 0.3, 2.1, 5.6, 0.9, "#24242c", "Front desk"), p("machine", 1, 0.4, 0.6, 0.5, "#223", "Check-in"), p("fridge", 5.6, 0.3, 1, 1, "#ec2a1c", "Protein shakes"),
    ...[0, 1, 2].map((i) => p("machine", 1.2 + i * 2, 6.2, 1, 2.2, "#6b6b73", i === 0 ? "Treadmills" : undefined)),
    ...[0, 1].map((i) => p("machine", 1.2 + i * 2.8, 11.2, 1.4, 1.6, "#4a4a55", i === 0 ? "Rowers & bikes" : undefined)),
    p("rack", 9, 1, 4, 1.4, "#24242c", "Squat racks"), p("rack", 14.6, 1, 4, 1.4, "#24242c", "Bench press"), p("rack", 19.6, 1, 1.8, 3.4, "#9aa6ad", "Dumbbells"),
    p("bench", 9.4, 4, 2.4, 0.7, "#ec2a1c"), p("bench", 13.4, 4, 2.4, 0.7, "#ec2a1c"), p("machine", 16.4, 4.6, 1.6, 1.4, "#6b6b73", "Cable machine"),
    p("mat", 9.4, 10, 3, 1.3, "#3dd6ff", "Mat"), p("mat", 13, 10, 3, 1.3, "#c6ff3d", "Mat"), p("mat", 16.6, 10, 3, 1.3, "#ff7ad9", "Mat"), p("trolley", 20.4, 11.4, 1.2, 1.2, "#9aa6ad", "Kettlebells"),
    p("locker", 20.4, 6.4, 1.2, 2.6, "#3a3a48", "Lockers"),
    wp("sign", "n", 1.6, 5, "#ec2a1c", "Iron Works"), wp("poster", "n", 9, 3.2, "#eee4d3", "Respect the racks"), wp("screen", "n", 14, 3, "#10202c", "Today: legs"), wp("clock", "w", 11, 0.8, "#eee4d3", "Clock"),
    wp("poster", "w", 1.6, 1.4, "#c6ff3d", "Wipe it down"),
  ],
  interactables: [
    { id: "desk", label: "Front desk", x: 3.4, y: 4.0, text: "'Membership's $18 a week. Showers are free, towels are not, and yes, you will hurt tomorrow.'" },
    { id: "shakes", label: "Protein fridge", x: 5, y: 4.0, effect: "vend", cost: 6, text: "A tub of something chocolate-ish that is aggressively good for you." },
    { id: "bench", label: "Bench press", x: 16.8, y: 3.1, text: "You pat the bar with respect and decide it is a good day to do nothing about it." },
    { id: "mat", label: "Stretching mats", x: 12.6, y: 9.4, effect: "rest", text: "You stretch for six minutes and call it a workout. Nobody has to know." },
  ],
  spots: [spot(2.2, 1.7, "work", "s"), spot(3.6, 1.7, "work", "s"), spot(2.5, 9.4, "stand", "s"), spot(4.9, 9.4, "stand", "s"), spot(10, 6.4, "stand", "n"), spot(16, 2.9, "stand", "s"), spot(11.6, 9.2, "stand", "s"), spot(14, 8.5, "phone", "n"), spot(19, 8.4, "talk", "n")],
  flavour: ["Rubber, chalk and a barely-audible grunt, which is a language of its own.", "Mirrors on every wall and nobody making eye contact. This is a respectful space."],
};

const nightclub: InteriorDef = {
  kind: "nightclub", title: "After Hours", size: { w: 24, h: 14 }, door: { x: 1.5, y: 7.5 },
  light: "neon", ambience: ["bass", "crowd-roar", "glass-clink", "laser-hiss"], busy: 0.85, staff: { color: "#b48cff", hat: "cap" },
  zones: [
    z("entry", "Door & cloakroom", 0, 0, 6, 14, "concrete", "#16101e"), z("dance", "Dance floor", 6, 2, 12, 10, "marble", "#2a1630"),
    z("bar", "Bar", 6, 0, 18, 2, "wood", "#3a1c3a"), z("booths", "Booths", 18, 2, 6, 12, "carpet", "#4a1f3d"), z("djarea", "DJ riser", 6, 12, 12, 2, "rubber", "#16101e"),
  ],
  props: [
    wallV(6, 0, 6.5), wallV(6, 8.5, 14),
    p("counter", 1, 1.5, 3.8, 1, "#2a1630", "Cloakroom"), p("bench", 1, 11, 3, 0.7, "#4a3a8a"), p("plant", 4.6, 12.4, 1, 1, "#3f8f4a"),
    p("counter", 7, 0.3, 15, 1, "#3a1c3a", "Bar"), ...row("chair", 6, 8, 1.4, 2.4, 0, 0.7, 0.6, "#ff7ad9", "Bar stools"), p("shelf", 7.4, 0.1, 13, 0.3, "#b48cff", "Bottles"),
    p("rug", 8, 4, 8, 6, "#16101e", "Lit dance floor"), p("pillar", 11, 6.4, 0.8, 0.8, "#6b6b73"), p("pillar", 14.6, 6.4, 0.8, 0.8, "#6b6b73"),
    p("machine", 7, 12.4, 3, 1.2, "#24242c", "DJ deck"), p("machine", 14.5, 12.4, 1.8, 1.2, "#24242c", "Speakers"), p("machine", 6.4, 3, 0.7, 1.4, "#24242c", "Speaker stack"),
    p("sofa", 19, 3, 4, 1.2, "#b0252a", "Booth"), p("table", 19.4, 4.6, 3, 1, "#2a1630"), p("sofa", 19, 6.6, 4, 1.2, "#b0252a", "Booth"), p("table", 19.4, 8.2, 3, 1, "#2a1630"), p("sofa", 19, 10.2, 4, 1.2, "#b0252a", "Booth"),
    wp("sign", "n", 7.5, 6, "#b48cff", "After Hours"), wp("screen", "n", 14, 4, "#3a1c3a", "DJ line-up"), wp("poster", "w", 2.6, 1.6, "#ff7ad9", "Dress code: tidy"), wp("poster", "w", 10, 1.4, "#3dd6ff", "18+ only"),
  ],
  interactables: [
    { id: "cloak", label: "Cloakroom", x: 2.9, y: 3.2, text: "'Coat? Number 42. Don't lose it.' She has done this a long time and has a tea behind the counter." },
    { id: "bar", label: "Bar", x: 14.6, y: 3, effect: "cuppa", cost: 8, text: "A soda and lime. The bartender gives you the nod of someone who will say nothing about it." },
    { id: "dj", label: "DJ", x: 9, y: 11.3, text: "The DJ lifts one earphone, nods at you, and drops the bass. The floor moves." },
    { id: "booth", label: "Booth", x: 20.4, y: 6.1, effect: "rest", text: "You sink into the booth. The music is now a rumour, which is exactly right." },
  ],
  spots: [spot(2.5, 2.7, "work", "n"), spot(10, 1.5, "work", "s"), spot(16.5, 1.5, "work", "s"), spot(9, 12, "work", "s"), spot(8.6, 6.4, "talk", "e"), spot(12.6, 7.4, "stand", "s"), spot(13.6, 5.2, "stand", "s"), spot(10, 8.6, "stand", "n"), spot(15.8, 8.9, "talk", "w"), spot(20.6, 3.9, "sit", "s"), spot(20.6, 7.3, "sit", "n"), spot(20.6, 11.2, "sit", "n"), spot(8.4, 2.4, "phone", "n")],
  flavour: ["Low light, a decent sound system and a floor that remembers everyone.", "Adults only, as the door says. The bass tells you where the room's heart is."],
};

const gallery: InteriorDef = {
  kind: "gallery", title: "MosaicScope Gallery", size: { w: 20, h: 12 }, door: { x: 1.5, y: 6.5 },
  light: "soft", ambience: ["hush", "footsteps", "air-con", "murmur"], busy: 0.35, staff: { color: "#eee4d3", hat: "cap" },
  zones: [z("hall", "Main hall", 0, 0, 14, 12, "marble", "#eee4d3"), z("side", "Photo wall", 14, 0, 6, 12, "wood", "#d8cdb8")],
  props: [
    wallV(14, 0, 4), wallV(14, 8, 12),
    p("counter", 1, 1.6, 3.2, 0.9, "#8a8f96", "Welcome desk"), p("bench", 5.4, 5.2, 3, 0.6, "#2a2a33", "Viewing bench"), p("bench", 5.4, 8.2, 3, 0.6, "#2a2a33", "Viewing bench"),
    p("pillar", 4, 4.2, 0.7, 0.7, "#cfc6b4"), p("pillar", 4, 8.6, 0.7, 0.7, "#cfc6b4"),
    p("stanchion", 10, 3, 0.4, 0.4, "#d4af37"), p("stanchion", 11.4, 3, 0.4, 0.4, "#d4af37"), p("table", 10, 6.4, 2.6, 1.8, "#eee4d3", "Sculpture plinth"),
    p("shelf", 15, 0.4, 1.6, 0.8, "#6b4a2a", "Prints for sale"), p("table", 16.4, 4.4, 2.4, 1.2, "#eee4d3", "Guest book"), p("plant", 18.2, 9.8, 1, 1, "#3f8f4a"),
    wp("sign", "n", 4, 6, "#ec2a1c", "MosaicScope Gallery"), wp("poster", "n", 8, 2.4, "#6fe3b0", "Canterbury light, in colour"), wp("poster", "n", 11.5, 2.2, "#ff7ad9", "Portraits of strangers"),
    wp("poster", "n", 15, 2, "#3dd6ff", "Port Hills at dawn"), wp("poster", "w", 3, 1.6, "#f6b62c", "Local artists, local light"), wp("poster", "w", 8, 1.4, "#eee4d3", "Prints, framed or not"), wp("painting", "w", 9.8, 2.2, "#c9a24a", "Painting of the week"),
    p("mat", 15.2, 8.6, 2.4, 2.2, "#ec2a1c", "Polaroid spot"), p("lamp", 18, 8.4, 0.4, 0.4, "#f6e8a8"), wp("sign", "n", 17.4, 2, "#f6b62c", "Say cheese"), wp("board", "n", 12.4, 1.6, "#d4af37", "Your best moments"),
  ],
  interactables: [
    { id: "desk", label: "Welcome desk", x: 2.6, y: 3.1, launch: "gallery", text: "'Take your time. If you love something, put your hand on your chest and say nothing.'" },
    { id: "spot", label: "Polaroid spot", x: 16.4, y: 9.7, launch: "photospot", text: "A red mat, a good lamp and a camera on a tripod." },
    { id: "bestwall", label: "Best moments", x: 13, y: 2.6, launch: "gallerywall", text: "The wall where your best moments hang." },
    { id: "plinth", label: "Sculpture", x: 11.2, y: 9.2, text: "A twisted brass thing titled 'Untitled (Tuesday)'. It is either a lung or a mug." },
    { id: "weekly", label: "Painting of the week", x: 1.4, y: 10.9, text: "A small gilt frame and a card in a very small font. The card changes every week." },
    { id: "guest", label: "Guest book", x: 17.6, y: 6.2, text: "'Beautiful.' 'Lovely light.' 'My nephew paints better.' (That last one is crossed out.)" },
  ],
  spots: [spot(2.6, 2.9, "work", "s"), spot(6.2, 4.4, "browse", "n"), spot(8.8, 4.6, "stand", "n"), spot(6.6, 7.3, "browse", "n"), spot(8.8, 7.3, "talk", "e"), spot(12.6, 4.7, "browse", "w"), spot(15.8, 6.6, "browse", "e"), spot(7, 9.9, "browse", "s")],
  flavour: ["White walls, honest light, and a polite hush that has been practised.", "Pictures of places you have walked past and never looked at."],
};

const dealership: InteriorDef = {
  kind: "dealership", title: "Moorhouse Motors", size: { w: 22, h: 12 }, door: { x: 1.5, y: 6.5 },
  light: "cool", ambience: ["air-con", "tyre-squeak", "phone-ring", "murmur"], busy: 0.35, staff: { color: "#c6ff3d", hat: "cap" },
  zones: [z("showroom", "Showroom", 0, 0, 16, 12, "marble", "#d8d4c8"), z("office", "Sales office", 16, 0, 6, 12, "carpet", "#4a4a55")],
  props: [
    wallV(16, 0, 4), wallV(16, 8, 12),
    p("counter", 1, 1.6, 3.4, 0.9, "#24242c", "Reception"),
    p("table", 5.6, 3.2, 3, 1.6, "#c33", "Car: hatch on a plinth"), p("table", 10, 3.2, 3, 1.6, "#3dd6ff", "Car: wagon on a plinth"),
    p("table", 5.6, 7.4, 3, 1.6, "#f6b62c", "Car: ute on a plinth"), p("table", 10, 7.4, 3, 1.6, "#c6ff3d", "Car: coupe on a plinth"),
    p("trolley", 13.8, 5.6, 1.2, 0.8, "#9aa6ad", "Keys cabinet"), p("plant", 14.4, 10.4, 1, 1, "#3f8f4a"),
    p("desk", 17, 1, 2.6, 0.9, "#6b4a2a", "Sales desk"), p("desk", 17, 9.8, 2.6, 0.9, "#6b4a2a", "Finance desk"), p("fridge", 20.6, 5.4, 0.9, 0.9, "#222", "Water cooler"), p("sofa", 20.4, 1, 1.2, 2.8, "#2a3a4e", "Waiting couch"),
    wp("sign", "n", 4.5, 6, "#c6ff3d", "Moorhouse Motors"), wp("poster", "n", 11, 3, "#eee4d3", "Zero deposit (read the fine print)"), wp("poster", "w", 3, 1.6, "#3dd6ff", "Test drives: ask us"),
    wp("clock", "w", 9, 0.8, "#eee4d3", "Clock"),
  ],
  interactables: [
    { id: "sales", label: "Sales desk", x: 18.3, y: 3, launch: "dealership", text: "'Take a look. They're all spotless. Some are even honest.'" },
    { id: "keys", label: "Keys cabinet", x: 14.4, y: 6.9, text: "Forty sets of keys and one very particular tag: 'Do NOT touch the ute.'" },
    { id: "cooler", label: "Water cooler", x: 20.2, y: 6.7, effect: "vend", text: "A paper cup of water. Cold, free, and the best part of the sales experience." },
  ],
  spots: [spot(2.7, 2.9, "work", "s"), spot(18.3, 2.3, "work", "s"), spot(18.3, 10.9, "work", "n"), spot(4.6, 5.6, "stand", "e"), spot(8, 5.6, "browse", "n"), spot(12, 5.6, "browse", "n"), spot(7.5, 9.8, "browse", "n"), spot(14.6, 9.4, "talk", "w")],
  flavour: ["A showroom of cars looking more confident than their owners did.", "Spotless floor, brisk handshake and a small-print table somewhere in the next room."],
};

export const SHOP_INTERIORS: Partial<Record<BuildingKind, InteriorDef>> = {
  cafe, bakery, pizza, sushi, fishchips, dairy, toyshop, sports, pawn, records, garage, barber, gym, nightclub, gallery, dealership,
};
