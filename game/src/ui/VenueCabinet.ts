import { h } from "./dom";

/**
 * The strip club's cabinets: a liquor cabinet with real brands, and the back-room cabinet (adults only) with party drugs by their
 * real names. Click what you want, pay at the till, and the game applies a state effect (see Substances.ts): there are no
 * amounts, dosing or advice here, just what the venue sells and how you feel in the game afterwards.
 */
export type CabinetKind = "alcohol" | "cannabis" | "stimulant" | "sedative";
interface Item { name: string; price: number; kind: CabinetKind; note: string }
export interface CabinetHost { getCash(): number; setCash(v: number): void; toast(t: string): void; consume?(kind: CabinetKind, label: string): { ok: boolean; msg: string } }

const LIQUOR: Item[] = [
  { name: "Jack Daniel's Old No. 7", price: 14, kind: "alcohol", note: "Tennessee whiskey, neat or on ice" },
  { name: "Jim Beam & Cola", price: 12, kind: "alcohol", note: "Kentucky bourbon" },
  { name: "Johnnie Walker Black Label", price: 16, kind: "alcohol", note: "Blended Scotch" },
  { name: "Jameson Irish Whiskey", price: 14, kind: "alcohol", note: "Smooth, triple distilled" },
  { name: "Smirnoff Vodka", price: 11, kind: "alcohol", note: "Vodka, soda, lime" },
  { name: "Absolut Vodka", price: 12, kind: "alcohol", note: "Swedish vodka" },
  { name: "Grey Goose", price: 18, kind: "alcohol", note: "French premium vodka" },
  { name: "Bombay Sapphire & Tonic", price: 15, kind: "alcohol", note: "London dry gin" },
  { name: "Bacardi & Coke", price: 11, kind: "alcohol", note: "White rum" },
  { name: "Captain Morgan Spiced Rum", price: 12, kind: "alcohol", note: "Spiced rum" },
  { name: "Jägermeister Shot", price: 9, kind: "alcohol", note: "Ice cold, dark and herbal" },
  { name: "Patrón Silver Tequila", price: 18, kind: "alcohol", note: "Shot with salt and lime" },
  { name: "Hennessy VS Cognac", price: 20, kind: "alcohol", note: "French cognac" },
  { name: "Moët & Chandon Champagne", price: 45, kind: "alcohol", note: "A bottle for the booth" },
  { name: "Corona Extra", price: 9, kind: "alcohol", note: "With a lime wedge" },
  { name: "Heineken", price: 9, kind: "alcohol", note: "Lager" },
  { name: "Steinlager Classic", price: 8, kind: "alcohol", note: "New Zealand lager" },
  { name: "Speight's Gold Medal Ale", price: 8, kind: "alcohol", note: "Dunedin pride" },
  { name: "Tui", price: 8, kind: "alcohol", note: "East India Pale Ale" },
  { name: "Red Bull & Vodka", price: 14, kind: "alcohol", note: "Wings and regret" },
];
const BACK_ROOM: Item[] = [
  { name: "Weed", price: 20, kind: "cannabis", note: "Cannabis: mellow, hungry, slow" },
  { name: "Cocaine", price: 70, kind: "stimulant", note: "Fast, confident, then the crash" },
  { name: "MDMA (Ecstasy)", price: 40, kind: "stimulant", note: "Warm, loud, sweaty" },
  { name: "Speed (Amphetamine)", price: 30, kind: "stimulant", note: "Wired and wide awake" },
  { name: "Xanax", price: 25, kind: "sedative", note: "Everything goes soft" },
  { name: "Valium", price: 20, kind: "sedative", note: "Calm, heavy, drowsy" },
  { name: "Ketamine", price: 45, kind: "sedative", note: "Detached and floaty" },
];

export function cabinet(host: CabinetHost): HTMLElement {
  const message = h("p", { role: "status", text: "Everything here is for adults. Pick what you want; the bartender keeps the receipts." });
  const buy = (it: Item): void => {
    if (host.getCash() < it.price) { message.textContent = `You need $${it.price} for ${it.name}.`; return; }
    const r = host.consume?.(it.kind, it.name) ?? { ok: true, msg: `${it.name}: served.` };
    if (!r.ok) { message.textContent = r.msg; return; }
    host.setCash(host.getCash() - it.price); message.textContent = r.msg;
  };
  const grid = (items: Item[]): HTMLElement => h("div.cab-grid", null, items.map((it) => h("button.btn.cab-item", { type: "button", title: it.note, onclick: () => buy(it) }, [h("b", { text: it.name }), h("small", { text: `$${it.price} · ${it.note}` })])));
  const back = h("details.cab-back", null, [h("summary", { text: "Back-room cabinet · 18+" }), grid(BACK_ROOM)]);
  const style = h("style", { text: ".cab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin:8px 0}.cab-item{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;padding:9px 11px}.cab-item small{opacity:.75;font-size:11px}.cab-back summary{cursor:pointer;font-weight:700;margin:8px 0}" });
  return h("section.venue-hospitality.cabinet", null, [style, h("h3", { text: "Liquor cabinet" }), message, grid(LIQUOR), back]);
}
