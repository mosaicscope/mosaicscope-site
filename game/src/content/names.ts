/**
 * Real-sounding names for a Christchurch block (a mix of Māori, Pasifika, Pākehā, Asian and other
 * names, like the actual city). Full names are unique; nobody gets a number tacked on.
 */
export const FIRST_GIRL = [
  "Aroha", "Mia", "Ana", "Priya", "Chloe", "Sienna", "Mere", "Leilani", "Hana", "Isla", "Grace", "Olivia", "Ava", "Zoe", "Maia", "Kiri",
  "Talia", "Jasmine", "Amelia", "Ruby-Rose", "Sofia", "Lucia", "Eva", "Charlotte", "Harriet", "Neve", "Freya", "Tui", "Moana", "Losa",
  "Mele", "Seini", "Anahera", "Ngaio", "Yuki", "Mei", "Ji-woo", "Linh", "Anika", "Riya", "Fatima", "Amira", "Leah", "Sarah", "Emma",
  "Holly", "Georgia", "Bella", "Indie", "Poppy", "Willow", "Matilda", "Esther", "Rose", "Daisy", "Paige", "Tayla", "Kayla", "Brooke",
  "Jess", "Nikita", "Shanaya", "Kaia", "Alofa", "Vai", "Teuila", "Ella", "Lily", "Nina", "Sasha", "Imogen", "Frankie", "Remi", "Ivy",
];
export const FIRST_GUY = [
  "Tama", "Liam", "Sione", "Mateo", "Hemi", "Jae", "Wiremu", "Noah", "Oliver", "Jack", "Rawiri", "Tane", "Kahu", "Manaia", "Ihaia",
  "Leon", "Lucas", "Finn", "Max", "Ethan", "Hamish", "Angus", "Callum", "Kieran", "Tevita", "Viliami", "Semisi", "Malakai", "Josiah",
  "Ravi", "Arjun", "Dev", "Kenji", "Haruto", "Min-jun", "Duc", "Bao", "Omar", "Yusuf", "Ali", "Marco", "Diego", "Jonah", "Caleb",
  "Isaac", "Elijah", "Reuben", "Ollie", "George", "Harry", "Sam", "Ben", "Toby", "Zac", "Kai", "Nikau", "Ari", "Rangi", "Mikaere",
  "Pita", "Tipene", "Losi", "Fetu", "Junior", "Brayden", "Jayden", "Cody", "Blake", "Connor", "Declan", "Seb", "Felix", "Hugo", "Arlo",
];
export const SURNAMES = [
  "Ngata", "Parata", "Te Rangi", "Walker", "Smith", "Wilson", "Brown", "Taylor", "Thompson", "Patel", "Singh", "Kumar", "Tanaka", "Kim",
  "Park", "Nguyen", "Tran", "Chen", "Wong", "Li", "Fale", "Tuilagi", "Vaifale", "Faleolo", "Taufa", "Havili", "Tupou", "Ioane", "Leota",
  "Henare", "Tipene", "Rewi", "Paewai", "Kereama", "Moana", "Edwards", "Clarke", "Robinson", "Hughes", "Murphy", "O'Brien", "Kelly",
  "McDonald", "Campbell", "Stewart", "Fraser", "Reid", "Hall", "Young", "King", "Wright", "Green", "Baker", "Scott", "Mitchell",
  "Anderson", "Johnson", "Martin", "Roberts", "Turner", "Phillips", "Carter", "Morgan", "Bell", "Cooper", "Ward", "Price", "Reyes",
  "Garcia", "Silva", "Rossi", "Müller", "Novak", "Haddad", "Hassan", "Sato", "Suzuki", "Ito", "Yamada", "Choi", "Lee", "Pham", "Le",
];
/** Street nicknames a few regulars go by. */
export const NICKNAMES = ["Chopper", "Smokey", "Bubbles", "Gizmo", "Moose", "Ace", "Dutch", "Sparky", "Bones", "Tiny", "Lefty", "Rocket", "Pickles", "Biscuit"];

/** Character roles: a job or a way of life. Drives schedules, goals and dialogue. */
export type Role =
  | "local" | "student" | "barista" | "chef" | "vendor" | "shopkeeper" | "cop" | "thief" | "graffiti" | "cleaner" | "dealer" | "bouncer"
  | "busker" | "skater" | "car_enthusiast" | "office" | "tourist" | "mechanic" | "musician" | "photographer" | "medic" | "taxi" | "driver" | "gambler"
  | "mobster" | "smuggler" | "comic" | "mogul" | "model" | "vigilante" | "villain" | "skibunny" | "zookeeper" | "overcoder";

export const ROLE_LABEL: Record<Role, string> = {
  overcoder: "overcoder",
  local: "local", student: "uni student", barista: "barista", chef: "cook", vendor: "food truck vendor", shopkeeper: "shopkeeper", cop: "police officer",
  thief: "small-time thief", graffiti: "graffiti artist", cleaner: "city cleaner", dealer: "casino dealer", bouncer: "bouncer", busker: "busker",
  skater: "skater", car_enthusiast: "car-meet regular", office: "office worker", tourist: "tourist", mechanic: "mechanic", musician: "musician",
  photographer: "photographer", medic: "paramedic", taxi: "taxi driver", driver: "delivery driver", gambler: "regular at the casino",
  mobster: "Famiglia Tessera wiseguy", smuggler: "smuggler", comic: "roast comedian", mogul: "mogul", model: "glamour model", vigilante: "masked vigilante",
  villain: "aspiring supervillain", skibunny: "ski bunny", zookeeper: "zookeeper",
};

/** How many regulars of each role (the rest are locals/students/office workers). */
export const ROLE_COUNTS: Partial<Record<Role, number>> = {
  cop: 7, thief: 6, graffiti: 4, cleaner: 3, barista: 3, chef: 4, vendor: 3, shopkeeper: 6, dealer: 4, bouncer: 2, busker: 2, skater: 6,
  car_enthusiast: 6, mechanic: 2, musician: 4, medic: 2, taxi: 3, driver: 3, gambler: 4, tourist: 4,
};
