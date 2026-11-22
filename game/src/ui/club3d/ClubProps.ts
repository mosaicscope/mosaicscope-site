/**
 * Fifty props for the Pink Pukeko. Each one is a real 3D object in the room and it changes how the club behaves.
 * Props are stackable: every copy costs more than the last (x1.35 each) and its effect adds up (with diminishing returns).
 * Excess is the theme: the more you have spent in the club, the more extravagant the props you may buy, and the
 * flashier ones (fireplaces, firework rigs, cash fountains) make the room hotter, messier and more likely to set off the sprinklers.
 * Everyone stays clothed and the hosts are comic hospitality staff (PG-13).
 */
export interface PropFx { income?: number; hype?: number; cool?: number; extinguish?: number; vac?: number; fan?: number; calm?: number; glow?: number; tip?: number; fog?: number; heat?: number; mess?: number; cashmult?: number; hosts?: number }
export interface Shoot { ammo: "bill" | "coin" | "conf" | "feather"; look: string; n: number; every: number; power: number; spread: number }
export interface Prop { shoot?: Shoot; id: string; name: string; icon: string; cost: number; kind: string; tier: number; color: number; blurb: string; fx: PropFx }
export const TIERS = [{ name: "Locals' night", at: 0 }, { name: "Regulars", at: 5_000 }, { name: "High rollers", at: 25_000 }, { name: "Excess", at: 100_000 }, { name: "Obscene excess", at: 500_000 }] as const;
const P = (id: string, name: string, icon: string, cost: number, kind: string, tier: number, color: number, blurb: string, fx: PropFx): Prop => ({ id, name, icon, cost, kind, tier, color, blurb, fx });
export const PROPS: Prop[] = [
  P("lava", "Lava lamp", "🌋", 300, "lamp", 0, 0xff3da8, "Glows. Mesmerises Gary.", { glow: 0.1, hype: 0.01 }),
  P("tiles", "Disco floor tiles", "🟪", 500, "tile", 0, 0x7a8cff, "The floor keeps the beat.", { hype: 0.04 }),
  P("fan", "Ceiling fan", "🌀", 800, "fan", 0, 0xcccccc, "Clears smoke and cools tempers.", { fan: 1 }),
  P("cooler", "Water cooler", "🚰", 400, "cooler", 0, 0x7ad0ff, "Hydrated patrons are calmer patrons.", { calm: 0.5 }),
  P("vend", "Vending machine", "🥤", 900, "vend", 0, 0xff5555, "Chips, cola, regret.", { income: 0.5 }),
  P("juke", "Jukebox", "🎵", 1500, "juke", 0, 0xffb347, "Slice of Heaven, again.", { hype: 0.05, income: 0.6 }),
  P("pinball", "Pinball machine", "🕹️", 1800, "arcade", 0, 0x3dd1ff, "Tilt! Tilt! Pay up.", { income: 0.8 }),
  P("popcorn", "Popcorn cart", "🍿", 700, "cart", 0, 0xffe066, "Salty income, sticky floor.", { income: 0.4, mess: 0.5 }),
  P("neon", "Neon sign", "💡", 600, "neon", 0, 0xff4d8d, "OPEN. Mostly.", { glow: 0.15 }),
  P("mop", "Mop and bucket", "🧹", 350, "bucket", 0, 0x4a9bd6, "Staff mop a little faster.", { vac: 1 }),
  P("ac", "Air conditioner", "❄️", 4_000, "ac", 1, 0xdde6ee, "Heat drains away faster.", { cool: 1 }),
  P("ext", "Fire extinguisher", "🧯", 2_500, "ext", 1, 0xd22b2b, "Stops one sprinkler soaking per copy per night.", { extinguish: 1 }),
  P("cctv", "Security cameras", "📹", 6_000, "cam", 1, 0x222222, "The crowd behaves. Mostly.", { calm: 1 }),
  P("robot", "Robot vacuum", "🤖", 9_000, "robot", 1, 0xeeeeee, "Hoovers tips off the floor by itself.", { vac: 2 }),
  P("pool", "Pool table", "🎱", 12_000, "table", 1, 0x1b7a3e, "Regulars stay and spend.", { income: 1.5, hype: 0.03 }),
  P("photo", "Photo booth", "📸", 10_000, "booth", 1, 0xc74d57, "Four frames of poor decisions.", { income: 1.2 }),
  P("tank", "Fish tank", "🐠", 8_000, "tank", 1, 0x3dd1ff, "Calming. The fish judge you.", { calm: 1.5 }),
  P("karaoke", "Karaoke machine", "🎤", 7_000, "juke", 1, 0xb98aff, "One song each. Nobody listens.", { hype: 0.06 }),
  P("bubbles", "Bubble machine", "🫧", 3_000, "fogm", 1, 0x9ee7ff, "Whimsical. Slippery.", { hype: 0.03, glow: 0.05 }),
  P("coat", "Coat check", "🧥", 5_000, "cart", 1, 0x6b3fa0, "Tips for hanging things up.", { income: 1 }),
  P("piano", "Grand piano", "🎹", 30_000, "piano", 2, 0x111111, "A slow number calms the room.", { calm: 1, income: 2 }),
  P("ice", "Ice sculpture", "🧊", 20_000, "ice", 2, 0xbfeaff, "Cools the club as it melts.", { cool: 2, glow: 0.1 }),
  P("bull", "Mechanical bull", "🐂", 45_000, "bull", 2, 0xb5651d, "Loud. Hilarious. Messy.", { hype: 0.1, income: 2.5, mess: 1 }),
  P("slots", "Slot machine", "🎰", 35_000, "arcade", 2, 0xf6b62c, "House always wins.", { income: 3 }),
  P("atm", "ATM", "🏧", 28_000, "atm", 2, 0x1ec8a0, "Fees, fees and more fees.", { income: 2.2 }),
  P("counter", "Cash counting machine", "🧮", 40_000, "cashm", 2, 0x7dcf94, "Swept tips are worth more to the till.", { cashmult: 1 }),
  P("fireplace", "Fireplace", "🔥", 32_000, "fire", 2, 0xff7a20, "Cosy. Also a fire risk.", { glow: 0.2, heat: 0.3 }),
  P("fogm", "Fog machine", "💨", 15_000, "fogm", 2, 0x888888, "Moody. Beams show up beautifully.", { fog: 1 }),
  P("snow", "Snow machine", "🌨️", 18_000, "fogm", 2, 0xffffff, "It snows indoors again.", { hype: 0.04, glow: 0.1 }),
  P("valve", "Sprinkler shut-off valve", "🚿", 50_000, "valve", 2, 0xd0a020, "Stops two sprinkler soakings per copy. Nobody asks how.", { extinguish: 2 }),
  P("chandelier", "Crystal chandelier", "🔆", 90_000, "chand", 3, 0xfff0c0, "Light, sparkle, status.", { glow: 0.3 }),
  P("tower", "Champagne tower", "🍾", 120_000, "tower", 3, 0xf6d34a, "Tips pour in as it pours out.", { tip: 0.5, income: 4 }),
  P("safe", "Vault safe", "🔒", 150_000, "safe", 3, 0x777777, "Takings sleep soundly.", { income: 6 }),
  P("statue", "Gold statue of Sir Ponsonby", "🗿", 110_000, "statue", 3, 0xd4af37, "He insisted.", { glow: 0.1, hype: 0.05 }),
  P("fountain", "Marble fountain", "⛲", 130_000, "fountain", 3, 0xbfd6ff, "Cools and calms the room.", { cool: 1, calm: 1, glow: 0.1 }),
  P("tramp", "Trampoline", "🤸", 60_000, "tramp", 3, 0xff5555, "Bad idea, great energy.", { hype: 0.08 }),
  P("harp", "Laser harp", "🎼", 95_000, "harp", 3, 0x50ffa0, "Beams that play themselves.", { hype: 0.1, glow: 0.2 }),
  P("rig", "Fireworks rig", "🎆", 140_000, "rig", 3, 0xff9a3d, "Hype for days. Heat too.", { heat: 0.5, hype: 0.15 }),
  P("goldpole", "Solid gold pole", "🥇", 80_000, "pole", 3, 0xd4af37, "The dancers insist.", { tip: 0.4, income: 3 }),
  P("poker", "VIP poker table", "♠️", 100_000, "table", 3, 0x7a1030, "High rollers settle in.", { income: 5 }),
  P("tub", "Private hot tub", "🛁", 300_000, "tub", 4, 0x7ad0ff, "Steam, bubbles, bathers in robes.", { income: 8, calm: 1 }),
  P("host", "VIP lounge host", "🎩", 200_000, "host", 4, 0xc74d57, "A Mosaic host works the private lounge.", { income: 5, tip: 0.3, hosts: 1 }),
  P("privbar", "Private bar", "🍸", 250_000, "cart", 4, 0x3a1013, "A bartender just for the VIPs.", { income: 7 }),
  P("goldloo", "Gold toilet", "🚽", 400_000, "loo", 4, 0xd4af37, "Nobody knows why. Everyone visits.", { income: 9, glow: 0.2 }),
  P("megaball", "Giant disco ball", "🪩", 350_000, "ball", 4, 0xdfe6ee, "Throws light across the whole room.", { hype: 0.15, glow: 0.3 }),
  P("cashfount", "Fountain of money", "💸", 600_000, "cashfount", 4, 0x7dcf94, "Banknotes. Constantly. Mop required.", { income: 12, mess: 2, heat: 0.1 }),
  P("shark", "Shark tank", "🦈", 500_000, "tank", 4, 0x1c6ea4, "Calms everyone. Terrifies the raccoon.", { calm: 2, glow: 0.2 }),
  P("car", "Vintage car on stage", "🚗", 700_000, "car", 4, 0xc74d57, "Parked on the catwalk. Don't ask.", { glow: 0.2, income: 10 }),
  P("skull", "Crystal skull", "💀", 800_000, "skull", 4, 0xb98aff, "Glows ominously. Great for business.", { glow: 0.4, hype: 0.1 }),
  P("throne", "Throne of cash", "👑", 1_000_000, "throne", 4, 0xd4af37, "A seat built from banknote bricks.", { income: 15, tip: 0.6 }),
];

// ---- 84 shooters: 12 launchers x 7 kinds of ammunition. Each one fires on its own timer into the room and the shots obey the
// same gravity and drag as everything else (banknotes flutter, coins drop, foam hangs). Bigger launchers need more excess to unlock.
// [name, base cost, shots per volley, seconds between volleys, muzzle speed, spread]
const LAUNCHERS: [string, number, number, number, number, number][] = [
  ["Slingshot", 900, 3, 1.8, 4, 0.5], ["Blaster", 1800, 4, 2.4, 6, 0.6], ["Pump gun", 2000, 5, 2.2, 6, 0.7], ["Crossbow", 2200, 2, 2.8, 8, 0.3], ["Cannon", 2500, 6, 3.2, 7, 0.8], ["Air horn popper", 1200, 12, 3, 4, 1.4],
  ["Catapult", 3500, 8, 5, 6, 0.9], ["Leaf blower", 1400, 8, 1.6, 5, 1.6], ["Mortar", 6000, 10, 4.5, 9, 0.8], ["Gatling", 9000, 3, 0.5, 6, 0.9], ["Rocket tube", 7000, 14, 6, 10, 1.1], ["Mega-launcher", 20000, 30, 5, 9, 1.2]];
const AMMO: [string, string, Shoot["ammo"], number, number, PropFx][] = [
  ["Banknote", "💵", "bill", 0x7dcf94, 1.0, { hype: 0.03, mess: 0.4, tip: 0.05 }], ["Coin", "🪙", "coin", 0xf6b62c, 1.2, { income: 0.6, mess: 0.2 }], ["Confetti", "🎊", "conf", 0xff4d8d, 0.6, { hype: 0.05, glow: 0.05 }],
  ["Feather", "🪶", "feather", 0xf6f4f3, 0.7, { hype: 0.03, calm: 0.2 }], ["Glitter", "✨", "conf", 0xffd86b, 0.9, { glow: 0.12, hype: 0.03 }], ["Streamer", "🎉", "conf", 0x3dd1ff, 0.8, { hype: 0.04, glow: 0.03 }], ["Champagne", "🍾", "conf", 0xf6e7a0, 1.5, { hype: 0.04, cool: 0.2, glow: 0.04 }]];
LAUNCHERS.forEach(([ln, base, n, every, power, spread], li) => AMMO.forEach(([an, icon, ammo, color, mult, fx]) => {
  const cost = Math.round((base * mult * (1 + li * li * 0.35)) / 50) * 50, tier = Math.min(4, Math.floor(li / 2.4)), k = 0.6 + li * 0.1;
  const f: PropFx = {}; for (const key of Object.keys(fx) as (keyof PropFx)[]) f[key] = (fx[key] ?? 0) * k;
  const p = P("sh_" + li + "_" + an.toLowerCase(), an + " " + ln.toLowerCase(), icon, cost, "shooter", tier, color, "Fires " + an.toLowerCase() + "s into the room every few seconds.", f);
  p.shoot = { ammo, look: an, n, every, power, spread }; PROPS.push(p);
}));
export const stackPrice = (p: Prop, owned: number): number => Math.round(p.cost * Math.pow(1.35, owned));
export const tierOf = (spent: number): number => { let t = 0; TIERS.forEach((x, i) => { if (spent >= x.at) t = i; }); return t; };

const KEY = "club.props";
export type Owned = Record<string, number>;
export const loadProps = (): Owned => { try { const o = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };
export const saveProps = (o: Owned): void => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode */ } };

/** Sum the effects of everything owned; every extra copy counts for a little less than the one before. */
export function aggregate(o: Owned): Required<PropFx> {
  const a: Required<PropFx> = { income: 0, hype: 0, cool: 0, extinguish: 0, vac: 0, fan: 0, calm: 0, glow: 0, tip: 0, fog: 0, heat: 0, mess: 0, cashmult: 0, hosts: 0 };
  for (const p of PROPS) { const n = o[p.id] ?? 0; if (!n) continue; const k = (1 - Math.pow(0.85, n)) / 0.15; for (const f of Object.keys(p.fx) as (keyof PropFx)[]) a[f] += (p.fx[f] ?? 0) * (f === "extinguish" || f === "hosts" ? n : k); }
  return a;
}
