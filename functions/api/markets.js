// Cloudflare Pages Function: /api/markets
// Live prices for the Mosaics' world markets: real companies (US and New Zealand), gold and other commodities, crypto, indices
// and the NZ dollar rate. Fetched server-side from Yahoo Finance's public chart feed (the browser can't call it directly) and cached
// for a minute, so the game can refresh often without hammering it. Read-only, no keys, no personal data.

const SYMBOLS = [
  // US companies
  ["AAPL", "Apple", "stock", "Tech"], ["MSFT", "Microsoft", "stock", "Tech"], ["GOOGL", "Alphabet (Google)", "stock", "Tech"], ["AMZN", "Amazon", "stock", "Retail"],
  ["NVDA", "Nvidia", "stock", "Tech"], ["TSLA", "Tesla", "stock", "Auto"], ["META", "Meta (Facebook)", "stock", "Tech"], ["NFLX", "Netflix", "stock", "Media"],
  ["DIS", "Disney", "stock", "Media"], ["KO", "Coca-Cola", "stock", "Food"], ["MCD", "McDonald's", "stock", "Food"], ["NKE", "Nike", "stock", "Retail"],
  ["F", "Ford", "stock", "Auto"], ["BA", "Boeing", "stock", "Industrial"], ["JPM", "JPMorgan Chase", "stock", "Finance"], ["XOM", "ExxonMobil", "stock", "Energy"], ["PFE", "Pfizer", "stock", "Health"],
  // New Zealand companies
  ["FPH.NZ", "Fisher & Paykel Healthcare", "stock", "Health"], ["AIR.NZ", "Air New Zealand", "stock", "Travel"], ["SPK.NZ", "Spark New Zealand", "stock", "Telecom"],
  ["FBU.NZ", "Fletcher Building", "stock", "Industrial"], ["MEL.NZ", "Meridian Energy", "stock", "Energy"], ["ATM.NZ", "The a2 Milk Company", "stock", "Food"], ["GMT.NZ", "Goodman Property Trust", "stock", "Property"],
  // commodities, crypto, indices
  ["GC=F", "Gold (per oz)", "gold", "Metals"], ["SI=F", "Silver (per oz)", "commodity", "Metals"], ["CL=F", "Crude Oil (per barrel)", "commodity", "Energy"], ["HG=F", "Copper (per lb)", "commodity", "Metals"],
  ["BTC-USD", "Bitcoin", "crypto", "Crypto"], ["ETH-USD", "Ethereum", "crypto", "Crypto"],
  ["^GSPC", "S&P 500", "index", "Index"], ["^NZ50", "NZX 50", "index", "Index"],
  ["NZD=X", "USD to NZD", "fx", "FX"],
];

async function quote(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, { headers: { "User-Agent": "Mozilla/5.0" }, cf: { cacheTtl: 60, cacheEverything: true } });
  if (!r.ok) return null;
  const m = (await r.json())?.chart?.result?.[0]?.meta; if (!m || !Number.isFinite(m.regularMarketPrice)) return null;
  const prev = Number.isFinite(m.chartPreviousClose) ? m.chartPreviousClose : m.regularMarketPrice;
  return { price: m.regularMarketPrice, prev, cur: m.currency || "USD", time: m.regularMarketTime || 0 };
}

export async function onRequestGet() {
  const rows = await Promise.all(SYMBOLS.map(async ([sym, name, kind, sector]) => { try { const q = await quote(sym); return q ? { sym, name, kind, sector, ...q } : null; } catch (e) { return null; } }));
  const out = rows.filter(Boolean), fx = out.find((q) => q.sym === "NZD=X");
  return new Response(JSON.stringify({ t: Date.now(), nzd: fx ? fx.price : null, quotes: out.filter((q) => q.kind !== "fx") }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" },
  });
}
