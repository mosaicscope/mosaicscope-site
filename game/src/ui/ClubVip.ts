import { h } from "./dom";

/**
 * The Pink Pukeko's VIP side, for adults: a clothed lap dance in the booth, a partner dance on the floor, and a private room that
 * you negotiate for. Everything is consensual and the dancers decide: they can say no, and pushing gets you thrown out by the
 * bouncer. Private rooms fade to black. Nothing explicit is ever shown.
 */
export interface VipCtx {
  cash: number; dancers: string[]; pay(n: number, what: string): boolean; say(spec: string): void; toast(t: string): void; mood(d: number): void;
  scene(kind: "lap" | "partner" | "private", dancer: string, secs: number): void; strike(): number; eject(): void; spent: number;
}

/** Each dancer has her own personality: how she reacts to tips and how she answers a private-room offer. */
export const PERSONALITY: Record<string, { tipLines: string[]; yes: number; sayYes: string; sayNo: string }> = {
  Velocity: { tipLines: ["Velocity|Now THAT is how you tip. Darling, stay for the encore.", "Velocity|Keep it coming and I might remember your name."], yes: 0.35, sayYes: "Velocity|For you? Fine. Don't make it weird.", sayNo: "Velocity|Not tonight, sweetheart. I'm worth more than that." },
  Crystal: { tipLines: ["Crystal|Aww, you're sweet! I'll save you a dance.", "Crystal|You're the nicest one in here, honestly."], yes: 0.5, sayYes: "Crystal|Okay... you've been lovely. Just for a while.", sayNo: "Crystal|Sorry, I'm not comfortable with that. But thank you for asking nicely." },
  Shazza: { tipLines: ["Shazza|Oi! Easy, big spender, you'll run out of bank!", "Shazza|Ha! Put it in the garter, mate."], yes: 0.4, sayYes: "Shazza|Go on then. But you're buying drinks after.", sayNo: "Shazza|Nah, mate. Cheeky, but nah." },
  Destiny: { tipLines: ["Destiny|Oh! Thank you! Really!", "Destiny|You're making my whole week."], yes: 0.25, sayYes: "Destiny|...Okay. I trust you. Be kind.", sayNo: "Destiny|I'm sorry, no. I hope that's okay." },
  Pearl: { tipLines: ["Pearl|Diamonds are a girl's best friend. So is cash.", "Pearl|Generous. I like generous."], yes: 0.45, sayYes: "Pearl|You've got taste. Come on.", sayNo: "Pearl|Not my kind of night, darling." },
};

/** Flirty, crude adult humour from the MC, dancers and patrons. Suggestive, never explicit. */
export const ADULT_LINES = [
  "MC|Gents, remember: look with your eyes, tip with your wallet, and keep your hands to yourselves. The bouncer is bigger than your ex.",
  "MC|Our next performer is single, thirty-ish, and allergic to men who say 'I'm a nice guy'. Give it up for Pearl!",
  "PATRON|Do you come here often?||BARTENDER|Mate, you're on the roster.",
  "MC|Ladies and gentlemen, please welcome the lovely Velocity. She's got a degree in physics and it shows.",
  "PATRON|I'm just here for the music.||BARTENDER|Sure you are, Kevin. That's why you're facing the stage.",
  "MC|Tonight's special: buy one drink, get a very awkward conversation with your accountant.",
  "PIMP|Everyone in this room is working. Some of them just don't know it yet.",
  "BOUNCER|Rules are simple. Ask nicely. Hear 'no'. Respect it. Or meet me outside.",
  "MC|A reminder that our dancers are professionals, and you are Kevin from Timaru. Act accordingly.",
  "PATRON|She winked at me!||PATRON|She winks at everyone, Dave.",
  "MC|Fresh from a sold-out tour of every pub in Canterbury, it's the one, the only, Shazza!",
  "BARTENDER|We do cocktails, shots, and bad decisions. All three are on special.",
];

export function vipPanel(c: VipCtx): HTMLElement {
  const pick = (a: string[]): string => a[Math.floor(Math.random() * a.length)];
  const who = h("select", { "aria-label": "Dancer" }, c.dancers.map((n) => h("option", { value: n, text: n }))) as HTMLSelectElement;
  const lap = h("button.cl-btn", { disabled: c.cash < 80, onclick: () => { if (c.pay(80, "a lap dance")) { c.say(`${who.value}|Sit back and relax, handsome. Hands to yourself.`); c.scene("lap", who.value, 10); c.mood(0.12); } } }, ["Lap dance in the booth · $80"]);
  const partner = h("button.cl-btn", { disabled: c.cash < 40, onclick: () => { if (c.pay(40, "a dance")) { c.say(`${who.value}|Come on then, show me what you've got.`); c.scene("partner", who.value, 9); c.mood(0.08); } } }, ["Partner dance on the floor · $40"]);
  const room = (price: number) => h("button.cl-btn.gold", { disabled: c.cash < price || c.spent < 150, onclick: () => {
    const p = PERSONALITY[who.value] ?? { yes: 0.3, sayYes: "OK.", sayNo: "No." };
    // she decides: a better offer helps, but it is never guaranteed, and a no is a no
    if (Math.random() < Math.min(0.9, p.yes + price / 2000) && c.pay(price, "the private room")) { c.say(p.sayYes); c.scene("private", who.value, 8); c.mood(0.3); }
    else { c.say(p.sayNo); const n = c.strike(); if (n >= 3) { c.say("BOUNCER|Alright, that's enough. Out. Now."); c.eject(); } else if (n === 2) c.say("BOUNCER|Last warning, mate. She said no."); }
  } }, [`Ask for the private room · $${price}`]);
  return h("section.cl-box.small", null, [h("h3", { text: "VIP & private rooms (18+)" }),
    h("p.cl-note", { text: c.spent >= 150 ? "The bouncer unhooks the rope for a big spender. Pick who you want, but she decides. Private rooms fade to black." : "Spend $150 on the stage and the bouncer will open the rope to the VIP side." }),
    h("div.cl-row", null, [who]), h("div.cl-row", null, [lap, partner]), h("div.cl-row", null, [room(150), room(300), room(600)]), h("p.cl-note", { text: pick(["Respect the dancers. Three pushy asks and you're out.", "No means no. The bouncer is watching.", "Nothing explicit is ever shown. It's a burlesque show, not a back alley."]) })]);
}
