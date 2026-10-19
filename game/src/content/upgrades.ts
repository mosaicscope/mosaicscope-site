/** Upgrade catalogue shared by the simulation and life dashboard. Prices use game dollars. */
export const UPGRADE_GROUPS = ["Skills", "Crew", "Home", "Money", "City", "Style", "Mosaics"] as const;
export type UpgradeGroup = typeof UPGRADE_GROUPS[number];
export interface UpgradeDef { number: number; id: string; group: UpgradeGroup; name: string; cost: number; effect: string }
const group = (group: UpgradeGroup, start: number, rows: [string, string, number, string][]): UpgradeDef[] =>
  rows.map(([id, name, cost, effect], i) => ({ number: start + i, id, name, cost, effect, group }));
export const UPGRADES: UpgradeDef[] = [
  ...group("Skills", 12, [
    ["throwing", "Park throwing practice", 45, "Tighter aim when throwing toys."],
    ["busker", "Busker’s ear", 60, "Larger tips from your street performances."],
    ["strategy", "Blackjack strategy card", 35, "Show basic-strategy advice at the blackjack table. Rules and payouts stay the same."],
    ["stealth", "Pickpocket stealth", 85, "Lower chance of witnesses noticing quiet theft."],
    ["lockpicks", "Lockpick set", 80, "Pick nearby doors and car boots. Discovery still counts as a crime."],
    ["cooking", "Street cooking", 55, "Better meals restore more hunger and mood."],
    ["photography", "Photographer’s eye", 100, "Earn more from photo commissions."],
    ["stencil", "Stencil kit", 40, "Paint precise tags and halve graffiti cleanup costs."],
    ["dance", "Dance moves", 65, "Earn extra respect at dance sessions."],
    ["chess", "Chess opening book", 40, "Improve your odds in park chess tournaments."],
    ["mechanic", "Mechanic basics", 90, "Car repairs cost 25% less."],
  ]),
  ...group("Crew", 23, [
    ["hideout", "Hideout: couch, fridge & dartboard", 240, "Crew rest restores energy, hunger and fun."],
    ["van", "Crew van", 900, "Take your recruited crew to a map destination together."],
    ["radio", "Crew radio", 90, "Call recruited members to your position."],
    ["streetwear", "Crew streetwear", 130, "Matching colours and extra intimidation around rivals."],
    ["lookout", "Lookout", 110, "Warns when police approach while you are wanted."],
    ["driver", "Getaway driver", 250, "Hire a driver for trips home while wanted; heat remains."],
    ["stash", "Safehouse stash", 100, "Store carried toys safely and retrieve them later."],
    ["loyalty", "Loyalty bonus", 120, "Trusted crew members contribute more to daily crew income."],
    ["medic", "Crew medic", 180, "Treat recruited members’ wounds during hourly check-ins."],
    ["titles", "Earned crew titles", 30, "Earn The Firestarter, Community Legend and Crew Captain through play."],
    ["handshake", "Secret handshake", 45, "Unlock a private exchange and build trust with your crew."],
  ]),
  ...group("Home", 34, [
    ["beanbag", "Bean bag", 55, "Sleeping recovers fatigue 25% faster."],
    ["toaster", "Smart toaster", 70, "One free energising breakfast each game day."],
    ["camera", "Security camera", 160, "Break-ins leave evidence usable in court."],
    ["doorbell", "Doorbell cam", 95, "See the closest visitor to your home."],
    ["deadbolt", "Deadbolts", 85, "Reduce the chance of a home burglary."],
    ["homegym", "Home gym corner", 180, "Work out at home without paying session fees."],
    ["balcony", "Balcony garden", 65, "A small daily mood lift at home."],
    ["heater", "Heater", 80, "Prevent winter cold from draining energy at home."],
    ["dehumidifier", "Dehumidifier", 100, "Prevent damp-home mould events."],
    ["petdoor", "Pet door", 50, "Your companion can roam near home and return when called."],
    ["stereo", "Home stereo", 120, "Home parties give a stronger mood boost."],
  ]),
  ...group("Money", 45, [
    ["cards", "Business cards", 40, "Networking shifts earn extra experience."],
    ["accounting", "Accounting software", 100, "Recover 10% of paid tax once each day."],
    ["tracker", "Spending tracker", 25, "View your purchase and income ledger."],
    ["coffee", "Coffee machine", 85, "10% better shift earnings."],
    ["secondphone", "Second phone", 120, "Unlock repeatable delivery side hustles."],
    ["bonds", "Savings bonds", 200, "An extra 0.1% daily return on your savings."],
    ["stocks", "Stock research tools", 180, "See a market signal before buying a daily stock position."],
    ["credit", "Pawn shop credit line", 50, "Borrow up to $300. Outstanding debt costs 1% daily."],
    ["lawyer", "Lawyer on retainer", 250, "Extra court evidence and lower justice fines."],
    ["excess", "Lower insurance excess", 140, "Approved insurance claims cost $25 instead of $50."],
    ["loyaltycard", "Corner store loyalty card", 20, "10% off upgrade purchases and groceries."],
  ]),
  ...group("City", 56, [
    ["foodtruck", "Food truck business", 650, "Earn daily sales. Street cooking and a stall licence improve income."],
    ["stall", "Street stall licence", 120, "Run a legal daily street stall and improve food truck sales."],
    ["vip", "Pink Pukeko VIP lounge", 450, "Unlock a VIP social session with bigger reputation gains."],
    ["rooftop", "Rooftop bar", 850, "Daily bar income and a new map destination."],
    ["renovation", "Shop renovation", 350, "Owned town businesses earn 25% more."],
    ["parking", "Parking permit", 80, "Avoid daily parking fines on your owned car."],
    ["bikelanes", "Bike lanes", 200, "Bike travel is 20% faster."],
    ["streetart", "Commissioned street art", 180, "Place a legal named mural near the Square."],
    ["watch", "Neighbourhood watch", 140, "Reduce burglary risk and improve detection of local crime."],
    ["community", "Community garden", 130, "Daily reputation and a garden map destination."],
    ["fountain", "Repair the Square fountain", 220, "Restore a visible animated fountain and a neighbourhood mood boost."],
  ]),
  ...group("Style", 67, [
    ["nightlens", "Night photo lens", 100, "A bright night filter for photo mode."],
    ["film", "Polaroid film pack", 25, "Ten extra commissioned shots. Buy another pack after using them."],
    ["discoball", "Club disco ball", 180, "Animated lights during parties."],
    ["speaker", "Boombox speakers", 90, "Street music reaches a larger crowd."],
    ["stringlights", "String light colours", 65, "Switch between warm, festival and neon strings."],
    ["rainsound", "Rain sound pack", 45, "Optional soft synthesised rain ambience while it rains."],
    ["sunset", "Sunset over the Avon", 55, "Warm colour grading at sunset."],
    ["clouds", "Cloud shadows", 60, "Drifting cloud shadows across the city."],
    ["puddles", "Puddle reflections", 75, "Rain puddles reflect city lights."],
    ["streetlights", "Retro & neon streetlights", 95, "Switch between amber and neon street lighting."],
    ["cosmetics", "Hats & cosmetics", 80, "Choose a hat and outfit colour."],
  ]),
  ...group("Mosaics", 89, [
    ["tiles", "Tiles’s signature dance", 100, "Perform Tiles’s dance with your crew."],
    ["glitter", "Glitter’s boutique", 150, "New matching outfit colours for recruited members."],
    ["kodak", "Kodak’s camera", 160, "Arrange a group photo and earn crew album progress."],
    ["nova", "Nova’s laptop", 180, "Live member positions and minimap crew blips."],
    ["grain", "Grain’s old film stock", 75, "A vintage photo filter."],
    ["ruby", "Ruby’s bike", 220, "Toggle fast bike travel on foot."],
    ["flash", "Flash’s night-out pass", 100, "Club entry and an evening social session."],
    ["lux", "Lux’s stage lights", 170, "Animated coloured beams during parties."],
    ["bando", "Bando’s pet", 110, "A dog companion follows you through town."],
    ["honey", "Honey’s garden", 95, "Harvest healing plants once per day."],
    ["album", "Crew album", 100, "Crew activities unlock an original playable track at three milestones."],
  ]),
];

export interface UpgradeState {
  owned: string[]; crew: number[]; stash: number[]; debt: number; film: number;
  ledger: { tick: number; label: string; amount: number }[];
  last: Record<string, number>; titles: string[]; album: number; evidence: number;
  bike: boolean; lights: "warm" | "festival" | "neon"; streetlight: "retro" | "neon";
  pet: { x: number; y: number }; market: number; lastDay: number; taxClaimed: number;
}
export const newUpgrades = (): UpgradeState => ({
  owned: [], crew: [], stash: [], debt: 0, film: 0, ledger: [], last: {}, titles: [],
  album: 0, evidence: 0, bike: false, lights: "warm", streetlight: "retro",
  pet: { x: 0, y: 0 }, market: 0, lastDay: -1, taxClaimed: 0,
});
export const hasUpgrade = (state: UpgradeState, id: string): boolean => state.owned.includes(id);
export const upgradeCost = (state: UpgradeState, cost: number): number => Math.round(cost * (hasUpgrade(state, "loyaltycard") ? 0.9 : 1));
