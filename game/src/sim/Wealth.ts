import type { Simulation } from "./Simulation";
import { TICKS_PER_HOUR } from "./Environment";

/**
 * Money that matters. Live markets (real companies, gold and other commodities, crypto, indices, from /api/markets), owning
 * businesses and property, and a market in valuable art, all tied into the life sim:
 *  - the markets' mood (the S&P 500 and NZX 50 moves) lifts or sours everyone's mood, and a crash costs some people their jobs
 *  - a business you own is staffed by real people in the city (their job, pay and mood change), earns from the customers who
 *    actually come through the door, and pays wages
 *  - property you own gets a tenant who lives there; a mortgage grows if you let it, and the bank can take it back
 *  - how rich you are (net worth tier) changes how the street treats you: dealers raise prices, police are more lenient, and
 *    once you own things the crew comes to collect "protection"
 * Saved with the game (worldFun.wealth). Prices are real where the feed is live, and drift plausibly when it is not.
 */
export interface Quote { sym: string; name: string; kind: string; sector: string; price: number; prev: number; cur: string; time: number }
export interface Business { since: number; staff: number[]; level: number; today: number; total: number; price: number }
export interface Holding { qty: number; cost: number }
export interface Artwork { id: string; paid: number; fake: boolean; known: boolean }
export interface WealthState {
  pos: Record<string, Holding>; biz: Record<string, Business>; props: Record<string, { price: number; since: number; tenant: number }>;
  art: Artwork[]; worth: number[]; loan: number; lastHour: number; lastDay: number; weekIncome: number; income: number;
}
export const newWealth = (): WealthState => ({ pos: {}, biz: {}, props: {}, art: [], worth: [], loan: 0, lastHour: -1, lastDay: -1, weekIncome: 0, income: 0 });

/** Sanitise saved state: numbers only, sensible caps. */
export function restoreWealth(raw: unknown): WealthState {
  const w = newWealth(); if (!raw || typeof raw !== "object") return w; const r = raw as Partial<WealthState>;
  const n = (v: unknown, hi = 1e12) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(hi, v)) : 0);
  for (const [k, v] of Object.entries(r.pos ?? {}).slice(0, 80)) if (v && typeof v === "object") w.pos[k.slice(0, 16)] = { qty: n((v as Holding).qty), cost: n((v as Holding).cost) };
  for (const [k, v] of Object.entries(r.biz ?? {}).slice(0, 60)) if (v && typeof v === "object") { const b = v as Business; w.biz[k] = { since: n(b.since), staff: Array.isArray(b.staff) ? b.staff.filter((x) => Number.isInteger(x)).slice(0, 6) : [], level: Math.min(5, n(b.level)), today: n(b.today), total: Number.isFinite(b.total) ? b.total : 0, price: n(b.price) }; }
  for (const [k, v] of Object.entries(r.props ?? {}).slice(0, 60)) if (v && typeof v === "object") { const p = v as { price: number; since: number; tenant: number }; w.props[k] = { price: n(p.price), since: n(p.since), tenant: Number.isInteger(p.tenant) ? p.tenant : -1 }; }
  if (Array.isArray(r.art)) w.art = r.art.slice(0, 80).filter((a) => a && typeof a.id === "string").map((a) => ({ id: a.id.slice(0, 40), paid: n(a.paid), fake: !!a.fake, known: !!a.known }));
  if (Array.isArray(r.worth)) w.worth = r.worth.filter((x) => Number.isFinite(x)).slice(-90);
  w.loan = n(r.loan); w.lastHour = typeof r.lastHour === "number" ? r.lastHour : -1; w.lastDay = typeof r.lastDay === "number" ? r.lastDay : -1; w.weekIncome = n(r.weekIncome); w.income = n(r.income);
  return w;
}
export const wealthOf = (sim: Simulation): WealthState => (sim.worldFun.wealth ??= newWealth());

/* ------------------------------------------------------------------ live markets */
const BASE: [string, string, string, string, number, string][] = [   // fallback when the feed is unreachable: [sym, name, kind, sector, price, currency]
  ["AAPL", "Apple", "stock", "Tech", 230, "USD"], ["MSFT", "Microsoft", "stock", "Tech", 430, "USD"], ["GOOGL", "Alphabet (Google)", "stock", "Tech", 175, "USD"], ["AMZN", "Amazon", "stock", "Retail", 200, "USD"],
  ["NVDA", "Nvidia", "stock", "Tech", 130, "USD"], ["TSLA", "Tesla", "stock", "Auto", 250, "USD"], ["META", "Meta (Facebook)", "stock", "Tech", 580, "USD"], ["NFLX", "Netflix", "stock", "Media", 750, "USD"],
  ["DIS", "Disney", "stock", "Media", 105, "USD"], ["KO", "Coca-Cola", "stock", "Food", 65, "USD"], ["MCD", "McDonald's", "stock", "Food", 295, "USD"], ["NKE", "Nike", "stock", "Retail", 80, "USD"],
  ["F", "Ford", "stock", "Auto", 11, "USD"], ["BA", "Boeing", "stock", "Industrial", 170, "USD"], ["JPM", "JPMorgan Chase", "stock", "Finance", 230, "USD"], ["XOM", "ExxonMobil", "stock", "Energy", 115, "USD"], ["PFE", "Pfizer", "stock", "Health", 27, "USD"],
  ["FPH.NZ", "Fisher & Paykel Healthcare", "stock", "Health", 36, "NZD"], ["AIR.NZ", "Air New Zealand", "stock", "Travel", 0.6, "NZD"], ["SPK.NZ", "Spark New Zealand", "stock", "Telecom", 3, "NZD"],
  ["FBU.NZ", "Fletcher Building", "stock", "Industrial", 3.2, "NZD"], ["MEL.NZ", "Meridian Energy", "stock", "Energy", 5.5, "NZD"], ["ATM.NZ", "The a2 Milk Company", "stock", "Food", 7, "NZD"], ["GMT.NZ", "Goodman Property Trust", "stock", "Property", 2.1, "NZD"],
  ["GC=F", "Gold (per oz)", "gold", "Metals", 2700, "USD"], ["SI=F", "Silver (per oz)", "commodity", "Metals", 32, "USD"], ["CL=F", "Crude Oil (per barrel)", "commodity", "Energy", 70, "USD"], ["HG=F", "Copper (per lb)", "commodity", "Metals", 4.3, "USD"],
  ["BTC-USD", "Bitcoin", "crypto", "Crypto", 90000, "USD"], ["ETH-USD", "Ethereum", "crypto", "Crypto", 3200, "USD"], ["^GSPC", "S&P 500", "index", "Index", 5900, "USD"], ["^NZ50", "NZX 50", "index", "Index", 12500, "NZD"],
];
export const markets = { quotes: new Map<string, Quote>(), nzd: 1.7, live: false, at: 0, error: "" };
const YIELD: Record<string, number> = { Food: 0.025, Energy: 0.04, Finance: 0.025, Property: 0.05, Telecom: 0.05, Media: 0.005, Tech: 0.006, Retail: 0.01, Auto: 0.03, Industrial: 0.02, Health: 0.015, Travel: 0.01, Metals: 0, Crypto: 0, Index: 0 };
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
function seedBase(): void { for (const [sym, name, kind, sector, price, cur] of BASE) if (!markets.quotes.has(sym)) markets.quotes.set(sym, { sym, name, kind, sector, price, prev: price, cur, time: 0 }); }
seedBase();
try { const c = typeof localStorage !== "undefined" ? localStorage.getItem("mosaics-world:markets") : null; if (c) { const d = JSON.parse(c) as { nzd: number; quotes: Quote[] }; for (const q of d.quotes) markets.quotes.set(q.sym, q); markets.nzd = d.nzd || markets.nzd; } } catch { /* no cache */ }

/** Pull live prices (every minute at most). On failure the last prices drift a little so the market still feels alive. */
export async function refreshMarkets(force = false): Promise<void> {
  const now = Date.now(); if (!force && now - markets.at < 55_000) return; markets.at = now;
  try {
    const r = await fetch("/api/markets", { cache: "no-cache" }); if (!r.ok) throw new Error("HTTP " + r.status);
    const d = (await r.json()) as { nzd: number | null; quotes: Quote[] };
    if (!d.quotes?.length) throw new Error("empty");
    for (const q of d.quotes) markets.quotes.set(q.sym, q);
    if (d.nzd) markets.nzd = d.nzd; markets.live = true; markets.error = "";
    try { localStorage.setItem("mosaics-world:markets", JSON.stringify({ nzd: markets.nzd, quotes: [...markets.quotes.values()] })); } catch { /* storage full */ }
  } catch (e) {
    markets.live = false; markets.error = e instanceof Error ? e.message : "offline";
    for (const q of markets.quotes.values()) { const d = gauss() * (q.kind === "crypto" ? 0.004 : 0.0012); q.price = Math.max(0.01, q.price * (1 + d)); }
  }
}
/** Price of one unit in NZ dollars (what the game's wallet uses). */
export const nzd = (q: Quote): number => (q.cur === "NZD" ? q.price : q.price * markets.nzd);
export const changePct = (q: Quote): number => (q.prev ? ((q.price - q.prev) / q.prev) * 100 : 0);
export const quoteOf = (sym: string): Quote | undefined => markets.quotes.get(sym);
/** -1 (tumbling) to 1 (booming): the S&P 500 and NZX 50 together. */
export const marketMood = (): number => { const a = quoteOf("^GSPC"), b = quoteOf("^NZ50"); const c = ((a ? changePct(a) : 0) + (b ? changePct(b) : 0)) / 2; return Math.max(-1, Math.min(1, c / 2.5)); };

/* ------------------------------------------------------------------ trading */
const FEE = 0.005;
export function buyAsset(sim: Simulation, sym: string, spend: number): string {
  const q = quoteOf(sym), p = sim.player; if (!q) return "Unknown market."; if (!(spend >= 1)) return "Spend at least $1.";
  if (p.cash < spend) return "Not enough cash."; const unit = nzd(q), fee = Math.max(0.5, spend * FEE), qty = (spend - fee) / unit;
  p.cash -= spend; const h = (wealthOf(sim).pos[sym] ??= { qty: 0, cost: 0 }); h.qty += qty; h.cost += spend - fee;
  return `Bought ${qty < 1 ? qty.toFixed(4) : qty.toFixed(2)} ${q.kind === "gold" ? "oz of gold" : q.name} for $${spend.toFixed(2)} (fee $${fee.toFixed(2)}).`;
}
export function sellAsset(sim: Simulation, sym: string, frac: number): string {
  const q = quoteOf(sym), h = wealthOf(sim).pos[sym]; if (!q || !h || h.qty <= 0) return "You do not hold that."; const qty = h.qty * Math.max(0.01, Math.min(1, frac));
  const gross = qty * nzd(q), fee = Math.max(0.5, gross * FEE), net = gross - fee, cost = h.cost * (qty / h.qty);
  sim.player.cash += net; h.qty -= qty; h.cost -= cost; if (h.qty < 1e-9) delete wealthOf(sim).pos[sym];
  return `Sold for $${net.toFixed(2)}, ${net >= cost ? "a profit" : "a loss"} of $${Math.abs(net - cost).toFixed(2)}.`;
}
export const holdingValue = (sim: Simulation): number => Object.entries(wealthOf(sim).pos).reduce((s, [sym, h]) => { const q = quoteOf(sym); return s + (q ? h.qty * nzd(q) : 0); }, 0);

/* ------------------------------------------------------------------ businesses and property */
export const BIZ_PRICE: Record<string, number> = { cafe: 180_000, bakery: 150_000, diner: 220_000, pizza: 200_000, sushi: 260_000, fishchips: 140_000, dairy: 160_000, toyshop: 120_000, sports: 200_000, barber: 90_000, gym: 300_000, garage: 250_000, nightclub: 900_000, hotel: 2_500_000, pawn: 180_000, records: 110_000 };
export const PROP_PRICE: Record<string, number> = { house: 650_000, apartments: 420_000 };
export function buildingPrice(sim: Simulation, id: number, table: Record<string, number>): number {
  const b = sim.world.buildings[id]; const base = b ? table[b.kind] : 0; if (!base) return 0;
  return Math.round(base * (0.8 + ((Math.imul(id + 3, 2654435761) >>> 0) % 50) / 100) * (1 + (b.floors - 1) * 0.12) / 1000) * 1000;
}
export function buyBusiness(sim: Simulation, id: number): string {
  const w = wealthOf(sim), price = buildingPrice(sim, id, BIZ_PRICE), b = sim.world.buildings[id]; if (!b || !price) return "That is not for sale.";
  if (w.biz[id]) return "You already own it."; const deposit = price * 0.2; if (sim.player.cash < deposit) return `You need a 20% deposit: $${Math.round(deposit).toLocaleString()}.`;
  sim.player.cash -= deposit; w.loan += price - deposit; w.biz[id] = { since: sim.tick, staff: [], level: 0, today: 0, total: 0, price };
  return `You bought ${b.name} for $${price.toLocaleString()} ($${Math.round(deposit).toLocaleString()} down, the rest on a loan).`;
}
export function hireStaff(sim: Simulation, id: number): string {
  const biz = wealthOf(sim).biz[id], b = sim.world.buildings[id]; if (!biz || !b) return "You do not own it."; if (biz.staff.length >= 4) return "That is a full team.";
  let best = -1, bd = Infinity;
  for (const c of sim.chars) if (c.tier !== "player" && c.workplace < 0 && c.partner !== sim.playerId && c.inside < 0 && !c.crew && c.role !== "cop") { const d = Math.hypot(c.x - (b.x0 + b.x1) / 2, c.y - (b.y0 + b.y1) / 2); if (d < bd) { bd = d; best = c.id; } }
  const c = sim.chars[best]; if (!c) return "Nobody is looking for work right now.";
  c.workplace = id; biz.staff.push(c.id); c.emo.mood = Math.min(1, c.emo.mood + 0.15); sim.say(c, "Thanks for the job. I will not let you down.", "say", 3);
  return `${c.name} now works at ${b.name}.`;
}
export function fireStaff(sim: Simulation, id: number, who: number): string {
  const biz = wealthOf(sim).biz[id], c = sim.chars[who]; if (!biz || !c) return "Nobody to let go.";
  biz.staff = biz.staff.filter((s) => s !== who); c.workplace = -1; c.emo.mood = Math.max(-1, c.emo.mood - 0.3); c.emo.frustration = Math.min(1, c.emo.frustration + 0.2); sim.say(c, "...Fine. I will find something else.", "say", 3);
  return `${c.name} was let go.`;
}
export function upgradeBusiness(sim: Simulation, id: number): string {
  const biz = wealthOf(sim).biz[id]; if (!biz) return "You do not own it."; if (biz.level >= 5) return "Fully refurbished."; const cost = Math.round(biz.price * 0.06 * (biz.level + 1));
  if (sim.player.cash < cost) return `A refurbishment costs $${cost.toLocaleString()}.`; sim.player.cash -= cost; biz.level++; return `Refurbished for $${cost.toLocaleString()}. Customers will notice.`;
}
export function sellBusiness(sim: Simulation, id: number): string {
  const w = wealthOf(sim), biz = w.biz[id]; if (!biz) return "You do not own it."; for (const s of biz.staff) { const c = sim.chars[s]; if (c) c.workplace = -1; }
  const value = Math.round(biz.price * (0.9 + biz.level * 0.05)), repay = Math.min(w.loan, value); w.loan -= repay; sim.player.cash += value - repay; delete w.biz[id];
  return `Sold for $${value.toLocaleString()}; $${Math.round(repay).toLocaleString()} went to the bank.`;
}
export function buyProperty(sim: Simulation, id: number): string {
  const w = wealthOf(sim), price = buildingPrice(sim, id, PROP_PRICE), b = sim.world.buildings[id]; if (!b || !price) return "That is not for sale.";
  if (w.props[id]) return "You already own it."; const deposit = price * 0.2; if (sim.player.cash < deposit) return `You need a 20% deposit: $${Math.round(deposit).toLocaleString()}.`;
  sim.player.cash -= deposit; w.loan += price - deposit;
  const tenant = sim.chars.find((c) => c.tier === "background" && c.home !== id && c.inside < 0 && !c.crew && c.partner < 0)?.id ?? -1;
  if (tenant >= 0) sim.chars[tenant].home = id;
  w.props[id] = { price, since: sim.tick, tenant }; return `You bought ${b.name} for $${price.toLocaleString()}${tenant >= 0 ? `. ${sim.chars[tenant].name} moves in as your tenant.` : ". It needs a tenant."}`;
}
export function sellProperty(sim: Simulation, id: number): string {
  const w = wealthOf(sim), p = w.props[id]; if (!p) return "You do not own it."; const value = Math.round(p.price * propertyGrowth()), repay = Math.min(w.loan, value);
  w.loan -= repay; sim.player.cash += value - repay; if (p.tenant >= 0 && sim.chars[p.tenant]) sim.chars[p.tenant].home = -1; delete w.props[id];
  return `Sold for $${value.toLocaleString()}; $${Math.round(repay).toLocaleString()} went to the bank.`;
}
/** Property follows the property trust and the economy, slowly. */
export const propertyGrowth = (): number => { const g = quoteOf("GMT.NZ"); return g ? Math.max(0.7, Math.min(1.6, g.price / (g.prev || g.price) * (1 + marketMood() * 0.02))) : 1; };
export const businessValue = (b: Business): number => Math.round(b.price * (0.9 + b.level * 0.05));

/* ------------------------------------------------------------------ art */
export interface ArtDef { id: string; artist: string; title: string; year: number; value: number; tier: "street" | "nz" | "master" }
export const ART: ArtDef[] = [
  { id: "fairey-hope", artist: "Shepard Fairey", title: "Hope (screenprint)", year: 2008, value: 2_800, tier: "street" },
  { id: "kaws-companion", artist: "KAWS", title: "Companion (vinyl figure)", year: 2016, value: 9_500, tier: "street" },
  { id: "peryer-photo", artist: "Peter Peryer", title: "Sleeping Dog (photograph)", year: 1995, value: 12_000, tier: "nz" },
  { id: "banksy-loverat", artist: "Banksy", title: "Love Rat (print)", year: 2004, value: 24_000, tier: "street" },
  { id: "apple-dollar", artist: "Billy Apple", title: "A Dollar", year: 1984, value: 40_000, tier: "nz" },
  { id: "hodgkins-garden", artist: "Frances Hodgkins", title: "Pleasure Garden", year: 1933, value: 300_000, tier: "nz" },
  { id: "warhol-soup", artist: "Andy Warhol", title: "Campbell's Soup Cans (print set)", year: 1968, value: 450_000, tier: "master" },
  { id: "walters-koru", artist: "Gordon Walters", title: "Koru", year: 1968, value: 850_000, tier: "nz" },
  { id: "mccahon-landscape", artist: "Colin McCahon", title: "Landscape Theme and Variations", year: 1963, value: 1_200_000, tier: "nz" },
  { id: "banksy-parliament", artist: "Banksy", title: "Devolved Parliament", year: 2009, value: 18_000_000, tier: "street" },
  { id: "monet-lilies", artist: "Claude Monet", title: "Water Lilies", year: 1919, value: 120_000_000, tier: "master" },
  { id: "basquiat-skull", artist: "Jean-Michel Basquiat", title: "Untitled (Skull)", year: 1982, value: 180_000_000, tier: "master" },
  { id: "vangogh-irises", artist: "Vincent van Gogh", title: "Irises", year: 1889, value: 200_000_000, tier: "master" },
  { id: "picasso-algiers", artist: "Pablo Picasso", title: "Women of Algiers", year: 1955, value: 270_000_000, tier: "master" },
  { id: "davinci-salvator", artist: "Leonardo da Vinci", title: "Salvator Mundi", year: 1500, value: 640_000_000, tier: "master" },
];
export const artDef = (id: string): ArtDef | undefined => ART.find((a) => a.id === id);
/** The art market follows the broad market and the daily mood, with its own slow drift. */
export function artIndex(): number { const sp = quoteOf("^GSPC"), pct = sp ? changePct(sp) : 0, day = Math.floor(Date.now() / 86_400_000); return Math.max(0.6, Math.min(1.8, 1 + Math.sin(day * 0.37) * 0.08 + pct * 0.004 + ((Math.imul(day, 2654435761) >>> 0) % 100) / 2000)); }
export const artValue = (a: Artwork): number => { const d = artDef(a.id); if (!d) return 0; const v = d.value * artIndex(); return Math.round(a.fake && a.known ? v * 0.03 : v); };
export const artAsk = (id: string): number => Math.round((artDef(id)?.value ?? 0) * artIndex() * 1.12);
export function buyArt(sim: Simulation, id: string): string {
  const d = artDef(id), p = sim.player; if (!d) return "Unknown work."; const ask = artAsk(id); if (p.cash < ask) return `The dealer wants $${ask.toLocaleString()}.`;
  const w = wealthOf(sim); if (w.art.some((a) => a.id === id)) return "You already own that one.";
  p.cash -= ask; const fake = d.tier !== "street" && Math.random() < 0.12; w.art.push({ id, paid: ask, fake, known: false });
  return `You bought ${d.artist}, ${d.title} for $${ask.toLocaleString()}. Get it appraised to be sure it is real.`;
}
export function appraiseArt(sim: Simulation, i: number): string {
  const a = wealthOf(sim).art[i]; if (!a) return "No such work."; if (a.known) return "Already authenticated."; const d = artDef(a.id)!, fee = Math.max(50, Math.round(d.value * 0.01));
  if (sim.player.cash < fee) return `The appraiser charges $${fee.toLocaleString()}.`; sim.player.cash -= fee; a.known = true;
  return a.fake ? `It is a forgery. Worth almost nothing now. (Appraisal $${fee.toLocaleString()})` : `Authentic. It is worth $${artValue(a).toLocaleString()} today. (Appraisal $${fee.toLocaleString()})`;
}
export function sellArt(sim: Simulation, i: number): string {
  const w = wealthOf(sim), a = w.art[i]; if (!a) return "No such work."; const v = Math.round(artValue(a) * (a.known ? 0.92 : 0.9));
  if (!a.known && a.fake && Math.random() < 0.5) { w.art.splice(i, 1); return "The auction house spotted the forgery. Nobody bought it, and your reputation took a knock."; }
  sim.player.cash += v; w.art.splice(i, 1); return `Sold at auction for $${v.toLocaleString()}.`;
}

/* ------------------------------------------------------------------ net worth and the life-sim ties */
export function netWorth(sim: Simulation): number {
  const w = wealthOf(sim); const props = Object.values(w.props).reduce((s, p) => s + p.price * propertyGrowth(), 0), biz = Object.values(w.biz).reduce((s, b) => s + businessValue(b), 0), art = w.art.reduce((s, a) => s + artValue(a), 0);
  return Math.round(sim.player.cash + holdingValue(sim) + props + biz + art - w.loan);
}
/** 0 broke, 1 comfortable, 2 well off, 3 rich, 4 tycoon. */
export function wealthTier(sim: Simulation): number { const n = netWorth(sim); return n < 5_000 ? 0 : n < 100_000 ? 1 : n < 1_000_000 ? 2 : n < 20_000_000 ? 3 : 4; }
export const news: string[] = [];
const tell = (sim: Simulation, text: string): void => { news.unshift(text); if (news.length > 12) news.pop(); sim.say(sim.player, text, "think", 4); };

export function updateWealth(sim: Simulation): void {
  if (sim.tick % 60 !== 31) return;
  const w = wealthOf(sim), hour = Math.floor(sim.tick / TICKS_PER_HOUR); void refreshMarkets();
  if (w.lastHour < 0) { w.lastHour = hour; w.lastDay = Math.floor(hour / 24); return; }
  while (w.lastHour < hour) { w.lastHour++; hourly(sim, w); }
  const day = Math.floor(hour / 24);
  while (w.lastDay < day) { w.lastDay++; daily(sim, w); }
}

function hourly(sim: Simulation, w: WealthState): void {
  const mood = marketMood(), h = sim.hour;
  for (const [id, biz] of Object.entries(w.biz)) {
    const b = sim.world.buildings[+id]; if (!b) continue;
    const def = { open: [8, 20] as [number, number] }, open = h >= def.open[0] && h < def.open[1]; if (!open) continue;
    const customers = sim.chars.filter((c) => c.inside === +id && c.tier !== "player" && !biz.staff.includes(c.id)).length;
    const staffed = biz.staff.filter((s) => sim.chars[s] && sim.chars[s].workplace === +id).length, hourlyBase = (biz.price * 0.18) / (365 * 12);
    const f = Math.max(0.35, 0.7 + customers * 0.12 + staffed * 0.18 + biz.level * 0.1 + mood * 0.2), wages = staffed * 2.5, profit = hourlyBase * f - wages;
    biz.today += profit; for (const s of biz.staff) { const c = sim.chars[s]; if (c) { c.cash += 2.5; c.emo.mood = Math.min(1, c.emo.mood + 0.01); } }
  }
  if (mood !== 0) for (const c of sim.chars) if (c.tier !== "player") c.emo.mood = Math.max(-1, Math.min(1, c.emo.mood + mood * 0.012));
}

function daily(sim: Simulation, w: WealthState): void {
  const p = sim.player; let income = 0;
  for (const biz of Object.values(w.biz)) { income += biz.today; biz.total += biz.today; biz.today = 0; }
  for (const [id, pr] of Object.entries(w.props)) { if (pr.tenant >= 0 && sim.chars[pr.tenant]?.home === +id) { const rent = (pr.price * propertyGrowth() * 0.04) / 365; income += rent; sim.chars[pr.tenant].cash = Math.max(0, sim.chars[pr.tenant].cash - rent * 0.2); } }
  for (const [sym, h] of Object.entries(w.pos)) { const q = quoteOf(sym); if (q) income += (h.qty * nzd(q) * (YIELD[q.sector] ?? 0)) / 365; }   // dividends
  // the loan grows at 6% a year; income pays it down first
  const interest = (w.loan * 0.06) / 365; w.loan += interest; income -= interest;
  p.cash += income; w.income = income; w.weekIncome += Math.max(0, income);
  const nw = netWorth(sim); w.worth.push(nw); if (w.worth.length > 90) w.worth.shift();
  if (Math.abs(income) >= 1) tell(sim, `Daily accounts: ${income >= 0 ? "+" : "-"}$${Math.abs(Math.round(income)).toLocaleString()} (net worth $${nw.toLocaleString()}).`);
  // a loan that has run away is the bank's problem to fix: they take a property back
  if (w.loan > 0 && w.loan > (nw + w.loan) * 0.9) { const id = Object.keys(w.props)[0] ?? Object.keys(w.biz)[0]; if (id !== undefined) { const msg = w.props[id] ? sellProperty(sim, +id) : sellBusiness(sim, +id); tell(sim, "The bank has repossessed an asset to cover your loan. " + msg); } }
  // the market's mood spills into the city
  const mood = marketMood();
  if (mood < -0.8) { let fired = 0; for (const c of sim.chars) if (c.tier === "background" && c.workplace >= 0 && fired < 4 && Math.random() < 0.05) { c.workplace = -1; c.emo.frustration = Math.min(1, c.emo.frustration + 0.25); fired++; } tell(sim, "Markets are tumbling. People are losing jobs and the city is on edge."); }
  else if (mood > 0.8) { for (const c of sim.chars) if (c.tier === "background") c.cash += 15; tell(sim, "Markets are booming. People are spending."); }
  // once you own things and are doing well, the crew comes to collect protection money each week
  if (sim.tick > 0 && w.lastDay % 7 === 0 && wealthTier(sim) >= 2 && (Object.keys(w.biz).length || Object.keys(w.props).length) && w.weekIncome > 0) {
    const take = Math.min(Math.round(w.weekIncome * 0.06), Math.max(0, Math.floor(p.cash))); w.weekIncome = 0;
    if (take > 0) { p.cash -= take; tell(sim, `A man from the Famiglia dropped by and collected $${take.toLocaleString()} "for your protection".`); }
  }
}

/** Everyone else's view of you: dealers charge the rich more. */
export const priceMultiplier = (sim: Simulation): number => 1 + 0.12 * wealthTier(sim);
