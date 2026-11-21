import { h } from "./dom";
import type { Simulation } from "../sim/Simulation";
import type { ModalHost } from "./Modals";
import { ART, BIZ_PRICE, PROP_PRICE, appraiseArt, artAsk, artDef, artValue, businessValue, buildingPrice, buyArt, buyAsset, buyBusiness, buyProperty, changePct, fireStaff, hireStaff, holdingValue, markets, netWorth, news, nzd,
  propertyGrowth, quoteOf, refreshMarkets, sellArt, sellAsset, sellBusiness, sellProperty, upgradeBusiness, wealthOf, wealthTier, type Quote } from "../sim/Wealth";

/** Markets & wealth: live prices, your portfolio, businesses, property and art, all in one place. */
type Tab = "overview" | "markets" | "business" | "property" | "art";
const TIER = ["Skint", "Comfortable", "Well off", "Rich", "Tycoon"];
const money = (n: number): string => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();
const dec = (n: number): string => "$" + n.toLocaleString(undefined, { minimumFractionDigits: n < 10 ? 2 : 0, maximumFractionDigits: n < 10 ? 2 : 0 });

export function showWealth(sim: Simulation, modal: ModalHost, resume: () => void, toast: (t: string) => void, tab: Tab = "overview"): void {
  const w = wealthOf(sim); let msg = "";
  const go = (t: Tab) => showWealth(sim, modal, resume, toast, t);
  const say = (m: string) => { msg = m; toast(m); showWealth(sim, modal, resume, toast, tab); };
  const btn = (label: string, fn: () => void, cls = "") => h("button.btn" + cls, { type: "button", onclick: fn, text: label });
  const tabs = h("div.wl-tabs", null, (["overview", "markets", "business", "property", "art"] as Tab[]).map((t) => h("button.btn" + (t === tab ? ".on" : ""), { type: "button", onclick: () => go(t), text: t[0].toUpperCase() + t.slice(1) })));
  const head = h("div.wl-head", null, [h("div", null, [h("small", { text: "Net worth" }), h("b", { text: money(netWorth(sim)) }), h("span", { text: ` · ${TIER[wealthTier(sim)]}` })]), h("div", null, [h("small", { text: "Cash" }), h("b", { text: money(sim.player.cash) })]),
    h("div", null, [h("small", { text: "Loan" }), h("b", { text: money(w.loan) })]), h("small", { class: "wl-feed", text: markets.live ? "Live prices" : "Offline prices" + (markets.error ? ` (${markets.error})` : "") })]);
  const status = h("p", { role: "status", class: "wl-msg", text: msg });
  const body: (HTMLElement | null)[] = [];

  if (tab === "overview") {
    const pts = w.worth.length > 1 ? w.worth : [netWorth(sim), netWorth(sim)], lo = Math.min(...pts), hi = Math.max(...pts) || 1, span = hi - lo || 1;
    const poly = pts.map((v, i) => `${(i / (pts.length - 1)) * 300},${58 - ((v - lo) / span) * 52}`).join(" ");
    const spark = document.createElementNS("http://www.w3.org/2000/svg", "svg"); spark.setAttribute("viewBox", "0 0 300 60"); spark.setAttribute("class", "wl-spark");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline"); line.setAttribute("points", poly); line.setAttribute("fill", "none"); line.setAttribute("stroke", "#7db995"); line.setAttribute("stroke-width", "2"); spark.appendChild(line);
    const mood = Math.round(((quoteOf("^GSPC") ? changePct(quoteOf("^GSPC")!) : 0) + (quoteOf("^NZ50") ? changePct(quoteOf("^NZ50")!) : 0)) * 50) / 100;
    body.push(h("section", null, [h("h3", { text: "Net worth over time" }), spark,
      h("p", { text: `Invested: ${money(holdingValue(sim))} · Businesses: ${Object.keys(w.biz).length} · Properties: ${Object.keys(w.props).length} · Art: ${w.art.length} works · Daily income: ${money(w.income)}` }),
      h("p", { text: `Markets today: ${mood >= 0 ? "+" : ""}${mood.toFixed(2)}% (S&P 500 and NZX 50). Good days lift the whole city's mood; crashes cost people their jobs.` }),
      h("p", { text: `How rich you are changes how the street treats you: ${["nobody notices you", "dealers see a regular", "dealers raise prices, cops go easier", "the crew comes to collect protection", "you are a name in the city"][wealthTier(sim)]}.` }),
      h("h3", { text: "News" }), h("ul", null, (news.length ? news : ["Nothing yet. Daily accounts arrive each in-game day."]).map((n) => h("li", { text: n })))]));
  }

  if (tab === "markets") {
    const groups: [string, (q: Quote) => boolean][] = [["New Zealand companies", (q) => q.sym.endsWith(".NZ")], ["US companies", (q) => q.kind === "stock" && !q.sym.endsWith(".NZ")], ["Gold and commodities", (q) => q.kind === "gold" || q.kind === "commodity"], ["Crypto", (q) => q.kind === "crypto"], ["Indices (not tradable)", (q) => q.kind === "index"]];
    for (const [name, pick] of groups) {
      const rows = [...markets.quotes.values()].filter(pick).map((q) => {
        const c = changePct(q), held = w.pos[q.sym], tradable = q.kind !== "index";
        return h("div.wl-row", null, [h("div.wl-name", null, [h("b", { text: q.name }), h("small", { text: q.sym.replace(/\.NZ$/, "") + (held ? ` · you hold ${held.qty < 1 ? held.qty.toFixed(4) : held.qty.toFixed(2)} (${money(held.qty * nzd(q))})` : "") })]),
          h("div.wl-px", null, [h("b", { text: dec(nzd(q)) }), h("small", { class: c >= 0 ? "up" : "down", text: `${c >= 0 ? "+" : ""}${c.toFixed(2)}%` })]),
          tradable ? h("div.wl-act", null, [btn("Buy $10", () => say(buyAsset(sim, q.sym, 10))), btn("$100", () => say(buyAsset(sim, q.sym, 100))), btn("$1k", () => say(buyAsset(sim, q.sym, 1000))), held ? btn("Sell half", () => say(sellAsset(sim, q.sym, 0.5)), ".alt") : null, held ? btn("Sell all", () => say(sellAsset(sim, q.sym, 1)), ".alt") : null]) : null]);
      });
      body.push(h("section", null, [h("h3", { text: name }), ...rows]));
    }
  }

  const forSale = (table: Record<string, number>): number[] => sim.world.buildings.filter((b) => table[b.kind]).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - sim.player.x, (a.y0 + a.y1) / 2 - sim.player.y) - Math.hypot((b.x0 + b.x1) / 2 - sim.player.x, (b.y0 + b.y1) / 2 - sim.player.y)).slice(0, 10).map((b) => b.id);
  if (tab === "business") {
    const owned = Object.keys(w.biz).map(Number);
    body.push(h("section", null, [h("h3", { text: "Your businesses" }), owned.length ? null : h("p", { text: "You do not own a business yet. Buy one below: 20% down, the rest on a loan. Customers who walk in, and the staff you hire from the city, decide what it earns." }),
      ...owned.map((id) => { const b = sim.world.buildings[id], biz = w.biz[id]; return h("div.wl-card", null, [h("b", { text: `${b?.name ?? "Business"} (${b?.kind})` }), h("small", { text: `Worth ${money(businessValue(biz))} · earned ${money(biz.total)} · today ${money(biz.today)} · refurb level ${biz.level}/5` }),
        h("div", null, [h("small", { text: "Staff: " + (biz.staff.length ? biz.staff.map((s) => sim.chars[s]?.name ?? "?").join(", ") : "none") })]),
        h("div.wl-act", null, [btn("Hire", () => say(hireStaff(sim, id))), ...biz.staff.slice(0, 4).map((s) => btn("Let go " + (sim.chars[s]?.name.split(" ")[0] ?? ""), () => say(fireStaff(sim, id, s)), ".alt")), btn("Refurbish", () => say(upgradeBusiness(sim, id))), btn("Sell", () => say(sellBusiness(sim, id)), ".alt")])]); })]));
    body.push(h("section", null, [h("h3", { text: "For sale near you" }), ...forSale(BIZ_PRICE).filter((id) => !w.biz[id]).map((id) => { const b = sim.world.buildings[id]; return h("div.wl-row", null, [h("div.wl-name", null, [h("b", { text: b.name }), h("small", { text: `${b.kind} · ${money(buildingPrice(sim, id, BIZ_PRICE))} · deposit ${money(buildingPrice(sim, id, BIZ_PRICE) * 0.2)}` })]), btn("Buy", () => say(buyBusiness(sim, id)))]); })]));
  }
  if (tab === "property") {
    const owned = Object.keys(w.props).map(Number);
    body.push(h("section", null, [h("h3", { text: "Your property" }), owned.length ? null : h("p", { text: "No property yet. Houses and apartments earn rent from a tenant who lives there; the mortgage grows if you let it." }),
      ...owned.map((id) => { const b = sim.world.buildings[id], p = w.props[id], t = p.tenant >= 0 ? sim.chars[p.tenant] : undefined; return h("div.wl-card", null, [h("b", { text: `${b?.name ?? "Property"} (${b?.kind})` }), h("small", { text: `Worth ${money(p.price * propertyGrowth())} · tenant: ${t?.name ?? "none"}` }), h("div.wl-act", null, [btn("Sell", () => say(sellProperty(sim, id)), ".alt")])]); })]));
    body.push(h("section", null, [h("h3", { text: "For sale near you" }), ...forSale(PROP_PRICE).filter((id) => !w.props[id]).map((id) => { const b = sim.world.buildings[id]; return h("div.wl-row", null, [h("div.wl-name", null, [h("b", { text: b.name }), h("small", { text: `${b.kind} · ${money(buildingPrice(sim, id, PROP_PRICE))} · deposit ${money(buildingPrice(sim, id, PROP_PRICE) * 0.2)}` })]), btn("Buy", () => say(buyProperty(sim, id)))]); })]));
  }
  if (tab === "art") {
    body.push(h("section", null, [h("h3", { text: "Your collection" }), w.art.length ? null : h("p", { text: "Empty. Prices follow the art market; some dealers sell forgeries, so get big pieces appraised." }),
      ...w.art.map((a, i) => { const d = artDef(a.id)!; return h("div.wl-card", null, [h("b", { text: `${d.artist}: ${d.title}` }), h("small", { text: `${d.year} · paid ${money(a.paid)} · worth ${money(artValue(a))} · ${a.known ? (a.fake ? "FORGERY" : "authenticated") : "not appraised"}` }), h("div.wl-act", null, [a.known ? null : btn("Appraise", () => say(appraiseArt(sim, i))), btn("Sell at auction", () => say(sellArt(sim, i)), ".alt")])]); })]));
    body.push(h("section", null, [h("h3", { text: "Dealers and auction" }), ...ART.filter((d) => !w.art.some((a) => a.id === d.id)).map((d) => h("div.wl-row", null, [h("div.wl-name", null, [h("b", { text: `${d.artist}: ${d.title}` }), h("small", { text: `${d.year} · ${d.tier === "nz" ? "New Zealand" : d.tier === "street" ? "street art" : "old master / modern"}` })]), h("div.wl-px", null, [h("b", { text: money(artAsk(d.id)) })]), btn("Buy", () => say(buyArt(sim, d.id)))]))]));
  }

  const style = h("style", { text: ".wl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.wl-tabs .on{background:#b3343c;color:#fff}.wl-head{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}.wl-head b{display:block;font-size:20px}.wl-feed{margin-left:auto;opacity:.7}.wl-row,.wl-card{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid #3a3030}.wl-card{flex-direction:column;align-items:flex-start}.wl-name{flex:1;min-width:150px}.wl-name small,.wl-card small{display:block;opacity:.7}.wl-px{text-align:right;min-width:80px}.up{color:#7db995}.down{color:#df7065}.wl-act{display:flex;gap:6px;flex-wrap:wrap}.wl-spark{width:100%;max-width:420px;height:60px}.wl-msg{min-height:20px;color:#d7ad5c}" });
  modal.show("Markets & wealth", [style, head, tabs, status, ...body, h("div", null, [btn("Close", resume, ".red")])], "wealth-panel");
  if (Date.now() - markets.at > 55_000) void refreshMarkets().then(() => { if (modal.open && modal.el.querySelector(".wl-head")) showWealth(sim, modal, resume, toast, tab); });
}
