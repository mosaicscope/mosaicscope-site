import { ENCOUNTERS } from "../content/encounters";
export const HOUR = 3600, DAY = HOUR * 24;
export interface CasinoState {
 scratch?: import("./Arcade").ScratchTicket; result?: import("./Arcade").ArcadeResult; tournamentCards?: number[];
 point:number; pointStake:number; crash:null|{stake:number;start:number;bust:number;paid:boolean}; race:null|{sport:string;order:number[];until:number;names:string[];stake:number;payout:number;settled:boolean}; tournament:null|{round:number;score:number;paid:boolean};
}
export const newCasino=():CasinoState=>({point:0,pointStake:0,crash:null,race:null,tournament:null});
export interface ExpansionState {
 casino:CasinoState;
  seen: string[]; pending: string | null; nextEncounter: number; distance: number;
  farm: number; animals: Record<string, number>; machines: string[]; feed: number; lastFarm: number; farmCare: number; farmProfit: number; cropAt: number; hayAt: number;
  horse: null | { name: string; skill: number; fitness: number; wins: number; tier: number; trained: number; raced: number };
  degree: string | null; credits: number; level: number; graduated: string[]; attempts: number; quiz: number;
  loyalty: number; jackpot: number;
}
export const newExpansion = (): ExpansionState => ({ casino:newCasino(), seen: [], pending: null, nextEncounter: HOUR / 2, distance: 0, farm: 0, animals: {}, machines: [], feed: 0, lastFarm: 0, farmCare: -1, farmProfit: 0, cropAt: -1, hayAt: -1, horse: null, degree: null, credits: 0, level: 0, graduated: [], attempts: 0, quiz: -1, loyalty: 0, jackpot: 1000 });
export const ANIMALS = [
  ["Dairy cattle", 700, 55, "milk", "Milking shed"], ["Beef cattle", 650, 48, "stock", "Stock trailer"],
  ["Sheep", 120, 18, "wool", "Shearing shed"], ["Pigs", 160, 25, "stock", "Stock trailer"],
  ["Chickens", 20, 5, "eggs", "Hen house"], ["Goats", 180, 22, "milk", "Milking shed"],
  ["Deer", 400, 35, "stock", "Deer yards"], ["Alpacas", 280, 28, "fibre", "Shearing shed"],
  ["Farm horses", 500, 38, "grazing", "Stables"], ["Beehives", 180, 20, "honey", "Honey extractor"],
  ["Ducks", 25, 6, "eggs", "Hen house"], ["Working dogs", 150, 12, "herding", "Kennels"],
] as const;
export const MACHINES = [
  ["Tractor", 1800, "Powers implements and doubles crop work"], ["Front loader", 700, "Cuts feeding costs"],
  ["Plough", 350, "Prepares land for crops"], ["Harrow", 300, "Improves crop yield"], ["Seed drill", 500, "Sows crops"],
  ["Sprayer", 450, "Protects crop yield"], ["Fertiliser spreader", 450, "Improves soil yield"], ["Irrigator", 900, "Protects crops in dry weather"],
  ["Combine harvester", 2500, "Doubles grain harvest"], ["Grain trailer", 500, "Adds harvest capacity"],
  ["Mower", 400, "Makes hay"], ["Tedder", 350, "Improves hay yield"], ["Rake", 250, "Improves hay yield"],
  ["Baler", 800, "Doubles stored feed"], ["Bale wrapper", 500, "Preserves extra feed"], ["Forage harvester", 1600, "Makes silage"],
  ["Feed mixer", 650, "Cuts livestock feed costs"], ["Slurry tanker", 700, "Recycles waste into crop yield"],
  ["Stock trailer", 500, "Markets cattle and pigs"], ["Yards", 400, "Supports more animals"], ["Milking shed", 1500, "Collects milk"],
  ["Rotary milking shed", 5000, "Doubles milk revenue"], ["Shearing shed", 650, "Collects wool and fibre"],
  ["Hen house", 150, "Collects eggs"], ["Deer yards", 850, "Markets deer"], ["Stables", 800, "Collects grazing fees"],
  ["Honey extractor", 300, "Collects honey"], ["Kennels", 200, "Supports contract herding"],
  ["Quad bike", 600, "Reduces livestock costs"], ["Fencing rig", 450, "Raises stocking capacity"], ["Workshop", 1200, "Cuts machinery running costs"],
] as const;
export const DEGREES = ["Arts", "Commerce", "Science", "Engineering", "Education", "Law", "Fine Arts", "Computer Science"];
export const QUESTIONS: Record<string, [string, string[], number][]> = {
  Arts: [["Which is a primary source?", ["An original diary", "A summary of a diary", "A film review"], 0], ["What supports a historical claim?", ["A guess", "Evidence", "A louder voice"], 1], ["A metaphor is…", ["A comparison", "A timetable", "A receipt"], 0]],
  Commerce: [["Revenue minus costs equals…", ["Profit", "Stock", "Rent"], 0], ["A budget helps track…", ["Income and spending", "Cloud shapes", "Shoe sizes"], 0], ["Diversifying spreads…", ["Risk", "Toast", "Rumours"], 0]],
  Science: [["Water freezes at roughly…", ["100°C", "0°C", "50°C"], 1], ["A fair experiment changes…", ["Everything", "One variable at a time", "Its conclusion first"], 1], ["Plants use sunlight for…", ["Photosynthesis", "Rust", "Gravity"], 0]],
  Engineering: [["A bridge must safely carry…", ["Loads", "Opinions", "Passwords"], 0], ["Force is measured in…", ["Litres", "Newtons", "Minutes"], 1], ["Safety factors allow for…", ["Uncertainty", "Bigger logos", "Coffee breaks"], 0]],
  Education: [["Useful feedback should be…", ["Specific and constructive", "Impossible to read", "A personal insult"], 0], ["A lesson objective describes…", ["Intended learning", "The lunch menu", "Bus fares"], 0], ["Students may learn at…", ["Different rates", "One identical rate", "Only midnight"], 0]],
  Law: [["Evidence helps establish…", ["Facts", "Fashion", "Weather"], 0], ["A contract is an…", ["Agreement", "Umbrella", "Engine"], 0], ["A fair hearing lets each side…", ["Be heard", "Rewrite all facts", "Skip evidence"], 0]],
  "Fine Arts": [["Red and blue paint make…", ["Purple", "Green", "White"], 0], ["Composition describes…", ["Arrangement of elements", "A tax code", "Tyre pressure"], 0], ["Contrast uses…", ["Differences", "Only identical marks", "A parking permit"], 0]],
  "Computer Science": [["A loop repeats…", ["Instructions", "A keyboard", "An invoice"], 0], ["A boolean is…", ["True or false", "A million colours", "A printer"], 0], ["Tests help detect…", ["Bugs", "Rainfall", "Lost socks"], 0]],
};
export function titleOf(s: ExpansionState): string { return s.level >= 3 ? "Dr" : s.level === 2 ? "Master" : s.level === 1 ? "Graduate" : ""; }
export function wageBoost(s: ExpansionState): number { return 1 + s.level * 0.2; }
export function encounterAt(s: ExpansionState, tick: number, travelled: number, random: number): string | null {
  s.distance += Math.max(0, travelled);
  if (s.pending || tick < s.nextEncounter || s.distance < 20) return null;
  const remaining = ENCOUNTERS.filter(e => !s.seen.includes(e.id));
  if (!remaining.length) return null;
  s.pending = remaining[Math.min(remaining.length - 1, Math.floor(Math.max(0, random) * remaining.length))].id;
  s.nextEncounter = tick + HOUR; s.distance = 0;
  return s.pending;
}
export function farmCapacity(s: ExpansionState): number { return s.farm * 20 + (s.machines.includes("Yards") ? 20 : 0) + (s.machines.includes("Fencing rig") ? 20 : 0); }
export function farmDay(s: ExpansionState, tick: number, rainy: boolean): { gross: number; costs: number; net: number } | null {
  if (!s.farm || tick - s.lastFarm < DAY) return null;
  // One settlement per day; no windfall from repeatedly opening the panel or loading a save.
  const days = Math.floor((tick - s.lastFarm) / DAY); s.lastFarm += days * DAY;
  const units = Object.values(s.animals).reduce((a, b) => a + b, 0);
  const fed = units === 0 ? 1 : Math.min(1, s.feed / units); s.feed = Math.max(0, s.feed - units);
  const care = s.farmCare === Math.floor((tick - DAY) / DAY) ? 1 : 0.65;
  const season = Math.floor(tick / (DAY * 7)) % 4;
  const market = [1.1, 1, 1.2, 0.9][season];
  let gross = 0;
  for (const [name, , yieldCash, kind, need] of ANIMALS) {
    if (!s.machines.includes(need)) continue;
    gross += (s.animals[name] ?? 0) * yieldCash * fed * care * market * (kind === "milk" && s.machines.includes("Rotary milking shed") ? 2 : 1);
  }
  const costs = Math.round((units * 2 + s.machines.length * 2 + s.farm * 8) * (s.machines.includes("Workshop") ? 0.8 : 1) * (s.machines.includes("Quad bike") ? 0.9 : 1) * (s.machines.includes("Feed mixer") ? 0.85 : 1) * (s.machines.includes("Front loader") ? 0.9 : 1));
  gross = Math.round(gross * (rainy && season === 3 ? 0.85 : 1));
  const net = gross - costs; s.farmProfit += net;
  return { gross, costs, net };
}
export function cropYield(s: ExpansionState, hay: boolean, rainy: boolean): number {
  const needs = hay ? ["Tractor", "Mower"] : ["Tractor", "Plough", "Seed drill"];
  if (!s.farm || needs.some(n => !s.machines.includes(n))) return 0;
  const extras = hay ? ["Tedder", "Rake", "Baler", "Bale wrapper", "Forage harvester"] : ["Harrow", "Sprayer", "Fertiliser spreader", "Combine harvester", "Grain trailer", "Slurry tanker"];
  return Math.round(s.farm * (hay ? 20 : 100) * (1 + extras.filter(n => s.machines.includes(n)).length * 0.25) * (rainy || s.machines.includes("Irrigator") ? 1 : 0.8));
}
export function passCourse(s: ExpansionState, answer: number): boolean {
  if (!s.degree || s.quiz < 0 || s.quiz > 2 || !QUESTIONS[s.degree]) return false;
  const correct = QUESTIONS[s.degree][s.quiz][2]; s.attempts++;
  if (answer !== correct) return false;
  s.credits++; s.quiz = -1;
  return true;
}
/** Returns total stake-inclusive payout; callers deduct the stake first. */
export function baccarat(stake: number, side: string, rng = Math.random): { payout: number; text: string } {
  const card = () => { const r = 1 + Math.floor(rng() * 13); return r >= 10 ? 0 : r; };
  let p = (card() + card()) % 10, b = (card() + card()) % 10;
  if (p < 8 && b < 8) {
    let third = -1;
    if (p <= 5) { third = card(); p = (p + third) % 10; }
    if (third < 0 ? b <= 5 : b <= 2 || b === 3 && third !== 8 || b === 4 && third >= 2 && third <= 7 || b === 5 && third >= 4 && third <= 7 || b === 6 && third >= 6 && third <= 7) b = (b + card()) % 10;
  }
  const winner = p === b ? "Tie" : p > b ? "Player" : "Banker";
  const payout = winner === side ? stake * (side === "Tie" ? 9 : side === "Banker" ? 1.95 : 2) : winner === "Tie" && side !== "Tie" ? stake : 0;
  return { payout, text: `Player ${p} · Banker ${b} · ${winner}` };
}

/** Result and reserved stake belong to the save slot; settlement is idempotent. */
export function settleRace(s:ExpansionState,tick:number):number {const r=s.casino.race;if(!r||r.settled||tick<r.until)return 0;r.settled=true;s.loyalty++;s.jackpot+=Math.round(r.stake*2)/100;return r.payout;}
