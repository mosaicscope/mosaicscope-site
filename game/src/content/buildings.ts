/** Building types that fill the city blocks. Hours are 24h; `menu` lists what you can buy inside. */
export type BuildingKind =
  | "casino" | "studio" | "gallery" | "police" | "dealership" | "diner" | "pizza" | "sushi" | "bakery" | "cafe" | "fishchips" | "dairy"
  | "toyshop" | "sports" | "pawn" | "bank" | "nightclub" | "apartments" | "house" | "office" | "garage" | "hospital" | "records" | "barber" | "gym" | "hotel" | "airport"
  | "stripclub" | "velvet" | "mentalhealth";

export interface BuildingDef {
  kind: BuildingKind;
  names: string[];
  floors: [number, number];      // min/max floors (1 floor ≈ 0.9 height units)
  colors: string[];              // facade
  roof: string;
  open: [number, number];        // opening hours [from, to); to < from wraps past midnight
  menu?: string[];               // item ids for sale
  sells?: "cars" | "chips" | "booking" | "pawn" | "fine" | "flights";
  enterable: boolean;            // player can go in (opens a panel)
  sign: string;                  // neon sign colour
  job?: string;                  // role that works here
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  casino: { kind: "casino", names: ["The Tessera Casino"], floors: [5, 6], colors: ["#2a1630", "#33182c"], roof: "#4a1f3d", open: [0, 24], sells: "chips", enterable: true, sign: "#f6b62c", job: "dealer" },
  studio: { kind: "studio", names: ["MosaicScope Studio"], floors: [2, 3], colors: ["#2b2026"], roof: "#3a2c22", open: [8, 23], sells: "booking", enterable: true, sign: "#ff7ad9", job: "photographer" },
  gallery: { kind: "gallery", names: ["MosaicScope Gallery"], floors: [2, 3], colors: ["#eee4d3", "#d8cdb8"], roof: "#9a8d80", open: [9, 21], enterable: true, sign: "#ec2a1c" },
  police: { kind: "police", names: ["Central Police Station"], floors: [4, 5], colors: ["#1c2836", "#203040"], roof: "#2a3a4e", open: [0, 24], sells: "fine", enterable: true, sign: "#3dd6ff", job: "cop" },
  dealership: { kind: "dealership", names: ["Moorhouse Motors", "Riccarton Motors"], floors: [2, 2], colors: ["#3a3430", "#2f2925"], roof: "#eee4d3", open: [8, 19], sells: "cars", enterable: true, sign: "#c6ff3d", job: "mechanic" },
  diner: { kind: "diner", names: ["Lyttelton Diner", "The Burger Joint"], floors: [2, 2], colors: ["#3a1c2a", "#4a2030"], roof: "#ec2a1c", open: [7, 24], menu: ["burger", "fish_chips", "lp", "hokey_pokey"], enterable: true, sign: "#ec2a1c", job: "chef" },
  pizza: { kind: "pizza", names: ["Slice of Heaven", "Pizza Pizza"], floors: [2, 3], colors: ["#3a2c22"], roof: "#b0641c", open: [11, 2], menu: ["pizza", "lp", "energy_drink"], enterable: true, sign: "#f6b62c", job: "chef" },
  sushi: { kind: "sushi", names: ["Hana Sushi", "Sushi Train"], floors: [2, 3], colors: ["#1d2a38"], roof: "#3a1c2a", open: [10, 21], menu: ["sushi", "bao", "lp"], enterable: true, sign: "#ff7ad9", job: "chef" },
  bakery: { kind: "bakery", names: ["Kiwi Bakehouse", "Hot Pies"], floors: [2, 2], colors: ["#4a3a2e"], roof: "#9a5a1c", open: [5, 17], menu: ["pie", "donut", "flat_white"], enterable: true, sign: "#f6b62c", job: "chef" },
  cafe: { kind: "cafe", names: ["Grain & Grind", "Flat White Club"], floors: [2, 3], colors: ["#33252c", "#2b2521"], roof: "#6b3a12", open: [6, 16], menu: ["flat_white", "donut", "bao", "pie"], enterable: true, sign: "#eee4d3", job: "barista" },
  fishchips: { kind: "fishchips", names: ["Sumner Fish & Chips"], floors: [2, 2], colors: ["#1d2a38"], roof: "#3dd6ff", open: [11, 21], menu: ["fish_chips", "lp"], enterable: true, sign: "#3dd6ff", job: "chef" },
  dairy: { kind: "dairy", names: ["Corner Dairy", "Superette"], floors: [2, 3], colors: ["#2d3a22"], roof: "#2d6b24", open: [6, 23], menu: ["lp", "pie", "energy_drink", "hokey_pokey", "donut", "water_balloon", "spray_can", "bandage"], enterable: true, sign: "#c6ff3d", job: "shopkeeper" },
  toyshop: { kind: "toyshop", names: ["Toy Box", "Bounce"], floors: [2, 3], colors: ["#3a1c3a"], roof: "#ff7ad9", open: [9, 18], menu: ["ball", "frisbee", "plush", "yoyo", "spring", "foam_sword", "noodle", "foam_bow", "nerf", "water_pistol", "pillow", "nunchucks"], enterable: true, sign: "#ff7ad9", job: "shopkeeper" },
  sports: { kind: "sports", names: ["Rebl Sports", "Paintball Supply"], floors: [2, 3], colors: ["#1c2a1d"], roof: "#2d6b24", open: [9, 18], menu: ["bat", "hockey_stick", "boxing_gloves", "shield", "paintball", "slingshot", "skateboard", "ball"], enterable: true, sign: "#c6ff3d", job: "shopkeeper" },
  pawn: { kind: "pawn", names: ["Cash Convertz"], floors: [2, 3], colors: ["#3a3430"], roof: "#f6b62c", open: [9, 19], sells: "pawn", menu: ["watch", "chain", "headphones", "phone", "camera", "vinyl", "frying_pan"], enterable: true, sign: "#f6b62c", job: "shopkeeper" },
  bank: { kind: "bank", names: ["Kiwibanc"], floors: [6, 8], colors: ["#2a2a33"], roof: "#3a3a48", open: [9, 17], enterable: false, sign: "#c6ff3d" },
  nightclub: { kind: "nightclub", names: ["After Hours"], floors: [3, 3], colors: ["#16101e"], roof: "#2a1630", open: [21, 4], enterable: false, sign: "#b48cff", job: "bouncer" },
  apartments: { kind: "apartments", names: ["Avon Apartments", "Hagley Lofts", "Colombo Flats", "Victoria Tower"], floors: [5, 9], colors: ["#2b2521", "#2a2a33", "#33252c", "#24302a"], roof: "#3a3430", open: [0, 24], enterable: false, sign: "#eee4d3" },
  house: { kind: "house", names: ["House"], floors: [1, 2], colors: ["#4a3a2e", "#3a2c22", "#2d3a2d", "#3a2a2a", "#2a3240"], roof: "#6b3a12", open: [0, 24], enterable: false, sign: "#eee4d3" },
  office: { kind: "office", names: ["Cathedral Square Offices", "Towr Insurance", "BNZed Centre"], floors: [7, 11], colors: ["#1d2a38", "#24242c", "#2a3240"], roof: "#3a3a48", open: [7, 19], enterable: false, sign: "#3dd6ff" },
  garage: { kind: "garage", names: ["Zed Station", "Seagull Fuel"], floors: [1, 1], colors: ["#2a2420"], roof: "#ec2a1c", open: [0, 24], menu: ["pie", "lp", "energy_drink", "donut", "bandage"], enterable: true, sign: "#ec2a1c", job: "mechanic" },
  hospital: { kind: "hospital", names: ["Christchurch Public Hospital"], floors: [5, 7], colors: ["#d8cdb8"], roof: "#9a8d80", open: [0, 24], enterable: false, sign: "#ec2a1c", job: "medic" },
  mentalhealth: { kind: "mentalhealth", names: ["Pūtahi Mental Health Unit"], floors: [2, 3], colors: ["#cfd8cf", "#c4d0c8"], roof: "#6f8a7a", open: [0, 24], enterable: true, sign: "#6fe3b0", job: "medic" },
  records: { kind: "records", names: ["Penny Lame Records"], floors: [2, 3], colors: ["#2a1630"], roof: "#b48cff", open: [10, 18], menu: ["vinyl", "headphones"], enterable: true, sign: "#b48cff", job: "shopkeeper" },
  barber: { kind: "barber", names: ["Fresh Cutz"], floors: [2, 3], colors: ["#2b2026"], roof: "#ec2a1c", open: [9, 18], enterable: false, sign: "#3dd6ff" },
  gym: { kind: "gym", names: ["Iron Works Gym"], floors: [3, 3], colors: ["#24242c"], roof: "#3a3430", open: [5, 22], enterable: false, sign: "#ec2a1c" },
  airport: { kind: "airport", names: ["Christchurch Airport"], floors: [3, 3], colors: ["#d8cdb8", "#cfc6b4"], roof: "#9a8d80", open: [0, 24], sells: "flights", enterable: true, sign: "#3dd6ff" },
  stripclub: { kind: "stripclub", names: ["The Pink Pukeko"], floors: [2, 2], colors: ["#2a1626", "#33182c"], roof: "#4a1f3d", open: [20, 4], enterable: true, sign: "#ff7ad9", job: "bouncer" },
  velvet: { kind: "velvet", names: ["The Velvet Rooms"], floors: [3, 4], colors: ["#1e1630", "#24182e"], roof: "#3a2850", open: [19, 3], enterable: true, sign: "#b48cff", job: "bouncer" },
  hotel: { kind: "hotel", names: ["The Crowned Plaza"], floors: [8, 11], colors: ["#2a2a33", "#33252c"], roof: "#3a3a48", open: [0, 24], enterable: false, sign: "#f6b62c" },
};

export function isOpen(def: BuildingDef, hour: number): boolean {
  const [a, b] = def.open;
  if (a === 0 && b === 24) return true;
  return a < b ? hour >= a && hour < b : hour >= a || hour < b;
}

/** Storey heights in world units (1 unit = 26px of iso height): a tall shopfront ground floor, then flats/offices. */
export const GROUND_H = 1.3;
export const FLOOR_H = 1.0;
