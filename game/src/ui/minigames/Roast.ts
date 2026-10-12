import { h } from "../dom";
import "./minigames.css";

/**
 * "Roast Night" at a little Christchurch comedy club. Three rounds against Roastie Malone.
 * Roastie types out a roast, you pick one of three comebacks (killer / mid / bomb, shuffled),
 * the neon crowd laughs, groans or goes "OHHH". Finish with the cheer meter above 60 to win.
 */
export interface RoastResult { won: boolean; crowd: number }

type Kind = "killer" | "mid" | "bomb";
type Phase = "intro" | "roast" | "choose" | "react" | "done";
type Mood = "idle" | "laugh" | "groan" | "ohh";
interface Choice { kind: Kind; text: string }
interface Fan { x: number; y: number; s: number; color: string; phase: number; delay: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; text: string }

// ------------------------------------------------------------------ libraries
/** Roastie's material. Aimed at choices (clothes, cars, wallets, moves), never at who someone is. */
export const ROASTIE_LINES: string[] = [
  "Nice jacket. Did you lose a bet with the Warehouse clearance bin?",
  "You dress like a Kathmandu catalogue that gave up halfway through.",
  "Those jandals have seen more of Canterbury than the Southern Alps have.",
  "Your shirt's so loud the neighbours rang noise control on it.",
  "Is that outfit vintage, or have you just never done a wash?",
  "You've got the fashion sense of a scarecrow at a Farmers sale.",
  "Mate, your hoodie's held together by hope and old pie flakes.",
  "You wear socks with jandals and call it 'transitional'.",
  "Your trackies have been worn so much they could walk home without you.",
  "That hat makes you look like an extra who got lost on the way to Hobbiton.",
  "Your sense of style is 'whatever was on the floor this morning'.",
  "Your fashion icon is a road cone. Hi-vis, slightly squashed, always in the way.",
  "Your shoes are so old they've got their own earthquake rebuild plan.",
  "You wear a singlet in July like the Christchurch frost owes you money.",
  "That puffer jacket's got more patches than State Highway 1.",
  "Your car's so old the WOF guy just signs the form and says a quiet prayer.",
  "You drive a Corolla with more rust than a Lyttelton shipping container.",
  "Your car stereo only plays one station: the exhaust slowly falling off.",
  "Your ride's got so many dents it looks like it lost a fight with Ashburton hail.",
  "Your car is the only thing in Christchurch slower than the road works.",
  "Your car's got a 'Baby on Board' sticker and the baby's a slab of Lion Red.",
  "You parallel park like you're threading a needle with a shovel.",
  "You beep at road cones like they're going to move for you.",
  "You stall at every roundabout like it's a pit stop at Ruapuna.",
  "You've been on your learners so long the instructor's retired twice.",
  "Your car speakers have more bass than your car has brakes.",
  "Your boot's got more junk in it than the Addington tip shop.",
  "You're so broke your eftpos card asks 'are you sure?' before every pie.",
  "You're so skint you go to Countdown just for the free fruit for kids.",
  "Your bank balance is like a nor'wester: hot air and nothing else.",
  "You'd split a two-dollar sausage sizzle into four interest-free payments.",
  "You check Afterpay to see if you can stretch to a Moro bar.",
  "Your wallet's got moths and a Hell Pizza loyalty card with one stamp.",
  "You're so tight you reuse tea bags from the staff room. Third brew, too.",
  "You list 'tap water' on the shopping list so it feels like you bought something.",
  "You think a budget is something that happens to other people.",
  "You borrowed five bucks in 2019 and you're still 'getting it sorted'.",
  "Your idea of a hot date is a free sample at the Riccarton Mall food court.",
  "You dance like someone dropped a cold pie down the back of your shirt.",
  "I've seen better moves from a road cone in a gale.",
  "You dance like a dad at a 21st after his third Speight's.",
  "Your moves got you kicked out of a silent disco. A SILENT disco.",
  "You dance like a seagull fighting for chips at New Brighton.",
  "Your two-step is just one step and an apology.",
  "You do the worm like a worm that's already been stepped on.",
  "You do TikTok dances in the Countdown car park. Alone. At night.",
  "Christchurch has a road cone on every corner and you've still got less direction.",
  "You're basically a road cone: bright, orange, and blocking everyone's progress.",
  "Even the road cones on Riccarton Road move faster than your career.",
  "You're like a road cone: everyone's seen you, nobody knows why you're there.",
  "You've been 'under construction' longer than the stadium.",
  "If road cones were a personality, you'd be the one somebody nicked for a party.",
  "You skipped leg day so often your calves filed a missing persons report.",
  "You go to the gym to take selfies next to the water fountain.",
  "You pay for a gym membership just to use the hot showers.",
  "You lift, bro? Only the lid off the protein tub.",
  "You grunt louder on the bench than a Crusaders scrum.",
  "You talk about your macros more than you talk to your mum.",
  "Your biggest lift this year was a mince and cheese from the servo.",
  "Your pre-workout is a flat white and an existential crisis.",
  "You say 'bro' so much it should be on your licence.",
  "You look like a tourist who got lost in Cathedral Square and just stayed.",
  "You took a photo of the Avon like it was the Grand Canyon.",
  "You stood in the middle of a cycleway to film a duck. A DUCK.",
  "You drive like a tourist on Lewis Pass: middle of the road, zero urgency.",
  "You've been to the Antarctic Centre more times than an actual penguin.",
  "You ask for directions to the beach while standing at New Brighton pier.",
  "You've got a 'Kia Ora' mug, a pāua keyring, and you live in Hornby.",
  "You've spent more on the pokies than on your whole wardrobe, and it shows.",
  "You talk to the pokie machine like it's your therapist.",
  "You call the pokies at the local your 'investment portfolio'.",
  "The pokies know you by name and they still won't pay you out.",
  "You took a pokies win of four bucks and bought a round. For yourself.",
  "Your dating profile says 'adventurous' but you've never left Hornby.",
  "Your Tinder bio is just a photo of a fish you definitely didn't catch.",
  "You've been left on read by more people than read the Press.",
  "You swipe right so much your thumb's got its own gym membership.",
  "Your dating app photos are from 2014 and a much better haircut.",
  "Your best match was a bot, and the bot unmatched you.",
  "You put 'loves long walks' on your profile because your car's broken.",
  "You've been ghosted so often you should be charging the spirits rent.",
  "You burnt toast so badly the fire brigade sent a sympathy card.",
  "Your signature dish is two-minute noodles that took twenty.",
  "You think 'seasoning' is when the tomato sauce runs out.",
  "You took a store-bought pav to a potluck and lied about it.",
  "Your barbecue skills are why Canterbury keeps a fire ban.",
  "You cook mince like you're trying to punish it.",
  "Your fridge has three things in it: tomato sauce, a lemon, and regret.",
  "Your haircut looks like you lost an argument with a sheep shearer.",
  "Did you get that cut at the barber, or at a hedge-trimming course?",
  "Your fringe has its own postcode.",
  "Your mullet's business up front and bankrupt out the back.",
  "Your barber should be charged with something. Possibly arson.",
  "You cut your own fringe in the dark, didn't you? With kitchen scissors.",
  "You dye your hair so often the box-dye shelf knows you by name.",
  "Your playlist is mostly ads because you're too tight for premium.",
  "Your music taste peaked with the ringtone on your old Nokia.",
  "You play Nickelback at parties and wonder why everyone goes home at nine.",
  "You think 'live music' is when the radio's on in the car.",
  "Your Spotify Wrapped was so bad they sent it in a plain brown envelope.",
  "You know one song on the guitar and it's Wonderwall. Badly.",
  "Your karaoke made a whole pub in Sydenham go quiet. Even the pokies.",
  "Your playlist goes Six60, sea shanties, then whale noises. One car trip.",
  "You've got the charm of a parking ticket on a Monday morning.",
  "Even the ducks in Hagley Park have muted you.",
];

/** Player comebacks aimed at Roastie's act, car, clothes, and life choices. */
export const COMEBACKS: { killer: string[]; mid: string[]; bomb: string[] } = {
  killer: [
    "Roastie, your jokes are like our road cones: everywhere, and nobody wants them.",
    "You've been doing this act longer than the Town Hall rebuild. Still not finished.",
    "Big talk from someone whose last gig was the sausage sizzle at Bunnings.",
    "Your jokes are so old they've got a heritage listing.",
    "A roast comedian? I've felt more heat from a Christchurch winter.",
    "You've got the stage presence of a parking warden: loud and unwelcome.",
    "Your material's so recycled the council wants it in the yellow bin.",
    "Mate, you peaked at a work Christmas do in 2009 and we all know it.",
    "Your jacket's so shiny it's blinding the back row. They're the lucky ones.",
    "Your career's like the pokies: lots of flashing lights, never pays out.",
    "Roastie, even your dating profile gets heckled.",
    "You're the only comedian whose crowd laughs on the way out.",
    "Your timing's worse than the bus in the rain.",
    "Your haircut's doing better material than you are tonight.",
    "Your jokes need a WOF. They'd fail on the brakes and the delivery.",
    "Your act's like a gym bro's leg day: skipped, and everyone can tell.",
    "That's a roast? I've had spicier cups of tea at Nana's.",
    "They put you on at nine so we'd had enough drinks to cope.",
    "Your mic stand's got more backbone than your punchlines.",
    "You're like a tourist in town: lost, loud, and stopped in the cycle lane.",
    "Twenty years of roasting and you're still undercooked.",
    "Your comedy's like Christchurch weather: four seasons, none of them funny.",
    "Roastie, you're a human 'Road Closed' sign. With a microphone.",
    "If your jokes were a car, they'd be up on blocks in a Hornby front yard.",
    "Your shirt's the funniest thing you've brought tonight, and it isn't even trying.",
    "Your walk-on music was the sound of everyone ordering another drink.",
    "You dance between punchlines like you're looking for one.",
    "You've got fewer good lines than a Tinder bio written by a sheep.",
    "Your set's like Lyttelton Tunnel: long, dark, and we all just want out.",
    "You roast like you cook: everything's burnt and nobody asked.",
    "You drive a ute with a 'Comedy Legend' sticker. Self-printed, I reckon.",
    "I'd roast your car, but the hailstorm already beat me to it.",
  ],
  mid: [
    "Yeah, well, you're not that great either, Roastie.",
    "That's pretty rich coming from someone in that shirt.",
    "Okay, but have you seen your own car?",
    "Your jokes are a bit old, mate.",
    "You're not exactly a fashion icon yourself.",
    "Your haircut's a bit much, eh.",
    "I bet you practised that one in the car on the way here.",
    "Hey, at least my car starts. Most days.",
    "Whatever, I've heard better at the RSA on a Tuesday.",
    "Says the bloke who drives a Corolla.",
    "Your dancing's probably worse than mine, to be fair.",
    "You've been doing this a while, huh? It shows.",
    "Easy for you to say, you've got the microphone.",
    "My mate Dave reckons you're not even that funny.",
    "You probably only go to the gym for the sauna.",
    "Nice one. Did a road cone write that for you?",
    "You'd get lost in Hagley Park, you would.",
    "I've seen your dating profile. It's... fine, I guess.",
    "You can talk, you have Pineapple Lumps for breakfast.",
    "Well, your music taste is probably dodgy too.",
    "Right back at you, mate. Mostly.",
    "Okay, that stung a little. But your shoes, though.",
    "I'd roast you back but I left my notes in the car.",
    "Pretty bold from someone who looks like they overcook mince.",
    "Fair. But you still owe the pokies twenty bucks.",
    "That's a five out of ten roast, Roastie. Generous.",
    "I'll have you know my jandals are from this decade.",
    "You're one to talk, your jacket's from the 90s.",
    "Bit harsh. Your haircut's got its own weather system, so.",
    "Cool story. Did it come with a free road cone?",
  ],
  bomb: [
    "Um... no u.",
    "I know you are but what am I?",
    "Your face is a... um... it's a face.",
    "Oh yeah? Well... your mic is... very tall.",
    "*nervous laugh* Haha. Yeah. Good one. Ha.",
    "I'm rubber, you're glue, and... I forget the rest.",
    "Sorry, can you repeat that? I was looking at the ceiling.",
    "Roastie? More like... Roastie. Yeah. Got you.",
    "I'll get you back! In an email. Tomorrow. Probably.",
    "Well, I think you're a very nice person, actually.",
    "My mum says I'm cool.",
    "Knock knock. ...Anyone? No? Okay.",
    "You're from Christchurch! Ha! ...Oh. We all are.",
    "Why did the chicken cross the road? Road cones. Something about road cones.",
    "Your shoes are untied! Made you look! ...You didn't look.",
    "That's not very nice. I'm telling the manager.",
    "I've got a comeback but it's at home on charge.",
    "You smell like... a person who exists.",
    "Okay, well, I'm going to the toilet now.",
    "Hey! You can't say that! ...Can you? Is that allowed?",
    "You're so old you remember... 2010. Gotcha.",
    "Your car is a car. With wheels. Probably four.",
    "Ha. Ha. Ha. That's me laughing sarcastically. Out loud.",
    "Uh, the Crusaders are a good rugby team. Anyway.",
    "Roastie, you're a... meanie. A big one.",
    "I'd roast you, but I'm vegetarian. Wait, that's not how it works.",
    "Pineapple Lumps! ...Sorry, I panicked.",
    "Uh. Sheep? Something about sheep. People laugh at sheep, right?",
    "Can I get a medium flat white? Oh. Wrong queue.",
    "Your jokes are bad and so is... the weather. Today. Outside.",
  ],
};

const ROUNDS = 3;
const START_CROWD = 50;
const WIN_AT = 60;
const PICK_TIME = 15;
const TYPE_CPS = 38;
const W = 720, H = 300;
const STAGE_Y = 206;
const ROASTIE_X = 190, PLAYER_X = 540, MIC_X = 236;
const NEON = ["#3dd6ff", "#ff7ad9", "#c6ff3d", "#f6b62c", "#a98bff", "#ff8a3d"];
const GOLD = "#f6b62c", ACID = "#c6ff3d", PINK = "#ff7ad9", RED = "#ec2a1c";

const REACT: Record<Kind, { label: string; mood: Mood; delta: () => number; words: string[] }> = {
  killer: { label: "OHHHHH!", mood: "ohh", delta: () => 16 + Math.round(Math.random() * 3), words: ["OHHH!", "HA!", "OOF!", "BURN!"] },
  mid: { label: "Polite chuckles", mood: "laugh", delta: () => 3, words: ["heh", "ha", "eh"] },
  bomb: { label: "Groooan...", mood: "groan", delta: () => -15, words: ["...", "ugh", "*cough*"] },
};
const ROASTIE_SAYS = {
  intro: "Kia ora, Christchurch! Fresh meat on stage. Be gentle... I won't be.",
  win: ["Alright, alright. You got me. Take the mic, legend.", "Tonight the roaster got roasted. Respect."],
  lose: ["Thanks for coming! Mind the road cones on the way out.", "Better luck next time. Practise on the mirror, eh?"],
  dead: "...(dead air)",
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function pickFresh(pool: string[], used: Set<string>): string {
  const left = pool.filter((s) => !used.has(s));
  const s = pick(left.length ? left : pool);
  used.add(s);
  return s;
}

function stick(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, o: { armL?: number; armR?: number; lean?: number; tilt?: number; blur?: number } = {}): void {
  const lean = (o.lean ?? 0) * s;
  const hy = y - 60 * s + (o.tilt ?? 0) * s, ny = y - 50 * s, hip = y - 24 * s, sh = y - 45 * s;
  c.save();
  c.strokeStyle = color; c.lineWidth = 3 * s; c.lineCap = "round"; c.lineJoin = "round";
  c.shadowColor = color; c.shadowBlur = o.blur ?? 8;
  c.beginPath(); c.arc(x + lean, hy, 8 * s, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x + lean, ny + (o.tilt ?? 0) * s * 0.4); c.lineTo(x, hip);
  c.moveTo(x, hip); c.lineTo(x - 8 * s, y);
  c.moveTo(x, hip); c.lineTo(x + 8 * s, y);
  const L = 20 * s, aL = o.armL ?? 0.35, aR = o.armR ?? 0.35, sx = x + lean * 0.6;
  c.moveTo(sx, sh); c.lineTo(sx - Math.sin(aL) * L, sh + Math.cos(aL) * L);
  c.moveTo(sx, sh); c.lineTo(sx + Math.sin(aR) * L, sh + Math.cos(aR) * L);
  c.stroke();
  c.restore();
}

export class RoastBattle {
  el: HTMLElement;
  open = false;

  private phase: Phase = "intro";
  private opponent = "Roastie Malone";
  private body: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hud: HTMLElement;
  private meterFill: HTMLElement;
  private meterNum: HTMLElement;
  private bubbleL: HTMLElement;
  private bubbleLText: HTMLElement;
  private bubbleR: HTMLElement;
  private bubbleRText: HTMLElement;
  private panel: HTMLElement;
  private timerBar: HTMLElement | null = null;
  private reduced = false;
  private raf = 0;
  private last = 0;
  private clock = 0;

  private round = 0;
  private crowd = START_CROWD;
  private roastLine = "";
  private typed = 0;
  private shownChars = -1;
  private choices: Choice[] = [];
  private pickLeft = PICK_TIME;
  private reactLeft = 0;
  private lastKind: Kind | null = null;
  private tally: Kind[] = [];
  private usedRoasts = new Set<string>();
  private usedComebacks = new Set<string>();
  private mood: Mood = "idle";
  private moodT = 0;
  private fans: Fan[] = [];
  private particles: Particle[] = [];
  private flicker = 1;
  private result: RoastResult | null = null;

  constructor(private onDone: (r: RoastResult) => void) {
    this.el = h("div.mg.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "Roast Night: a roast battle" });
    this.canvas = h("canvas.mg-canvas", { width: W, height: H, role: "img", "aria-label": "A comedy club stage: brick wall, neon ROAST NIGHT sign, a spotlight, a mic stand and a neon stick-figure crowd." }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.hud = h("div.mg-hud", { "aria-live": "off" });
    this.meterFill = h("div.rb-fill");
    this.meterNum = h("span", { text: String(START_CROWD) });
    this.bubbleLText = h("span");
    this.bubbleL = h("div.rb-bubble.l", { role: "status", "aria-live": "polite" }, [h("b", { text: this.opponent }), this.bubbleLText]);
    this.bubbleRText = h("span");
    this.bubbleR = h("div.rb-bubble.r", { "aria-live": "polite" }, [h("b", { text: "You" }), this.bubbleRText]);
    this.panel = h("div.rb-panel");
    this.body = h("div.mg-body");
  }

  start(opponentName?: string): void {
    this.opponent = opponentName?.trim() || "Roastie Malone";
    (this.bubbleL.firstChild as HTMLElement).textContent = this.opponent;
    this.reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.reset();
    this.open = true;
    this.el.classList.remove("hidden");
    document.addEventListener("keydown", this.onKey, true);
    this.render();
    this.sayLeft(ROASTIE_SAYS.intro.replace("Roastie", this.short()));
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  close(): void {
    this.open = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("keydown", this.onKey, true);
    this.el.classList.add("hidden");
    this.el.replaceChildren();
  }

  private short(): string { return this.opponent.split(/\s+/)[0] || "Roastie"; }

  private reset(): void {
    this.phase = "intro"; this.round = 0; this.crowd = START_CROWD; this.roastLine = ""; this.typed = 0; this.shownChars = -1;
    this.choices = []; this.pickLeft = PICK_TIME; this.reactLeft = 0; this.lastKind = null; this.tally = [];
    this.usedRoasts.clear(); this.usedComebacks.clear(); this.mood = "idle"; this.moodT = 0; this.particles = []; this.result = null;
    this.bubbleL.classList.remove("show"); this.bubbleR.classList.remove("show");
    this.fans = [];
    const rows = [{ y: 262, n: 11, s: 0.62 }, { y: 284, n: 10, s: 0.72 }, { y: 308, n: 9, s: 0.82 }];
    rows.forEach((r, ri) => {
      const gap = W / r.n;
      for (let i = 0; i < r.n; i++) {
        this.fans.push({ x: gap * (i + 0.5) + (ri % 2 ? gap * 0.3 : 0) + rand(-6, 6), y: r.y, s: r.s, color: pick(NEON), phase: rand(0, Math.PI * 2), delay: rand(0, 0.25) });
      }
    });
  }

  // ------------------------------------------------------------------ layout
  private render(): void {
    const head = h("header.mg-head", null, [
      h("h2", null, ["Roast Night", h("small", { text: `Comedy club · vs ${this.opponent}` })]),
      this.hud,
      h("button.x", { "aria-label": "Close (Esc)", onclick: () => this.escape(), text: "×" }),
    ]);
    this.updateHud();
    const view: HTMLElement[] = [];
    if (this.phase === "done") view.push(this.resultsCard());
    else {
      view.push(
        h("div.rb-meter", { role: "group", "aria-label": "Crowd cheer meter" }, [h("span", { text: "Crowd" }), h("div.rb-track", null, [this.meterFill]), this.meterNum]),
        h("div.rb-stage", null, [this.canvas, this.bubbleL, this.bubbleR]),
        this.phase === "intro" ? this.introCard() : this.panel,
      );
      this.updateMeter();
    }
    this.body.replaceChildren(...view);
    this.el.replaceChildren(h("div.mg-frame", null, [head, this.body]));
    this.el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }

  private introCard(): HTMLElement {
    return h("div.mg-card", null, [
      h("h3", { text: "Step up to the mic" }),
      h("p", { text: `${this.opponent} is Christchurch's sharpest roaster. Three rounds: they roast you, you fire back. Pick the right comeback and the crowd's yours.` }),
      h("ul", null, [
        "1 / 2 / 3: pick a comeback (or click it). One kills, one's mid, one bombs.",
        `Space or Enter: skip ${this.short()}'s typing · Esc: walk off stage`,
        `Finish with the crowd meter above ${WIN_AT} to win. You've got ${PICK_TIME}s per comeback.`,
      ].map((t) => h("li", { text: t }))),
      h("button.mg-btn.go", { "data-autofocus": true, onclick: () => this.begin(), text: "Grab the mic" }),
    ]);
  }

  private renderPanel(): void {
    const top = h("div.rb-round", null, [h("span", null, ["Round ", h("b", { text: `${this.round} / ${ROUNDS}` })]), h("span", { text: `Win above ${WIN_AT}` })]);
    const kids: HTMLElement[] = [top];
    this.timerBar = null;
    if (this.phase === "roast") {
      kids.push(h("p.rb-status", { text: `${this.short()} is cooking... (Space to skip)` }));
    } else if (this.phase === "choose") {
      kids.push(h("p.rb-status", { text: "Your comeback. Pick 1, 2 or 3." }));
      kids.push(h("div.rb-choices", { role: "group", "aria-label": "Comebacks" }, this.choices.map((ch, i) =>
        h("button.mg-btn", { onclick: () => this.choose(i), "data-autofocus": i === 0 ? true : undefined, "aria-label": `Comeback ${i + 1}: ${ch.text}` }, [h("kbd", { text: String(i + 1) }), ch.text]))));
      this.timerBar = h("i");
      kids.push(h("div.rb-timer", { "aria-hidden": "true" }, [this.timerBar]));
    } else if (this.phase === "react" && this.lastKind) {
      kids.push(h("p.rb-react." + this.lastKind, { role: "status", text: REACT[this.lastKind].label }));
    }
    this.panel.replaceChildren(...kids);
    this.panel.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }

  private resultsCard(): HTMLElement {
    const r = this.result!;
    const count = (k: Kind) => this.tally.filter((t) => t === k).length;
    return h("div.mg-card", null, [
      h("h3", { class: r.won ? "win" : "lose", text: r.won ? "You roasted the roaster!" : "Roasted." }),
      h("p", null, [h("b", { text: `${this.short()}: ` }), `"${pick(r.won ? ROASTIE_SAYS.win : ROASTIE_SAYS.lose)}"`]),
      h("div.mg-stats", null, [
        h("div" + (r.won ? ".acid" : ".red"), null, [h("span", { text: "Crowd meter" }), h("b", { text: String(r.crowd) })]),
        h("div", null, [h("span", { text: "Needed" }), h("b", { text: `>${WIN_AT}` })]),
      ]),
      h("div.rb-tally", null, [
        h("span.killer", { text: `${count("killer")} killer` }),
        h("span.mid", { text: `${count("mid")} mid` }),
        h("span.bomb", { text: `${count("bomb")} bombed` }),
      ]),
      h("button.mg-btn.go", { "data-autofocus": true, onclick: () => this.collect(), text: r.won ? "Take a bow" : "Leave the stage" }),
    ]);
  }

  private updateHud(): void {
    const cell = (l: string, v: string, hot = false) => h("div", null, [h("span", { text: l }), h("b" + (hot ? ".hot" : ""), { text: v })]);
    this.hud.replaceChildren(
      cell("Round", `${Math.max(1, this.round)}/${ROUNDS}`),
      cell("Crowd", String(this.crowd), this.crowd <= WIN_AT),
    );
  }

  private updateMeter(): void {
    this.meterFill.style.width = this.crowd + "%";
    this.meterFill.classList.toggle("low", this.crowd <= WIN_AT);
    this.meterNum.textContent = String(this.crowd);
  }

  private sayLeft(text: string): void {
    this.bubbleLText.textContent = text;
    this.bubbleL.classList.add("show");
  }

  // ------------------------------------------------------------------ flow
  private begin(): void {
    this.bubbleL.classList.remove("show");
    this.render();
    this.nextRound();
  }

  private nextRound(): void {
    this.round++;
    this.phase = "roast";
    this.roastLine = pickFresh(ROASTIE_LINES, this.usedRoasts);
    this.typed = this.reduced ? this.roastLine.length : 0;
    this.shownChars = -1;
    this.bubbleR.classList.remove("show");
    this.bubbleL.setAttribute("aria-busy", "true");
    this.bubbleL.classList.add("show");
    this.choices = shuffle((["killer", "mid", "bomb"] as Kind[]).map((kind) => ({ kind, text: pickFresh(COMEBACKS[kind], this.usedComebacks) })));
    this.updateHud();
    this.renderPanel();
    this.syncTyping();
  }

  private syncTyping(): void {
    const n = Math.min(this.roastLine.length, Math.floor(this.typed));
    if (n !== this.shownChars) { this.shownChars = n; this.bubbleLText.textContent = this.roastLine.slice(0, n); }
    if (n >= this.roastLine.length && this.phase === "roast") {
      this.bubbleL.setAttribute("aria-busy", "false");
      this.setMood("ohh", 1.1);
      this.phase = "choose";
      this.pickLeft = PICK_TIME;
      this.renderPanel();
    }
  }

  private skipTyping(): void {
    if (this.phase !== "roast") return;
    this.typed = this.roastLine.length;
    this.syncTyping();
  }

  private choose(i: number): void {
    if (this.phase !== "choose") return;
    const ch = this.choices[i];
    if (ch) this.resolve(ch.kind, ch.text);
  }

  private resolve(kind: Kind, text: string): void {
    this.phase = "react";
    this.lastKind = kind;
    this.tally.push(kind);
    this.crowd = Math.max(0, Math.min(100, this.crowd + REACT[kind].delta()));
    this.bubbleRText.textContent = text;
    this.bubbleR.classList.add("show");
    this.setMood(REACT[kind].mood, 2.6);
    this.reactLeft = this.reduced ? 2.4 : 2.8;
    if (!this.reduced) this.burst(kind);
    this.updateMeter();
    this.updateHud();
    this.renderPanel();
  }

  private finish(): void {
    this.phase = "done";
    this.result = { won: this.crowd > WIN_AT, crowd: this.crowd };
    this.render();
  }

  private escape(): void {
    if (this.phase === "intro") { this.close(); return; }
    if (this.phase === "done") { this.collect(); return; }
    // walking off mid-battle forfeits
    this.result = { won: false, crowd: this.crowd };
    this.collect();
  }

  private collect(): void {
    const r = this.result;
    this.close();
    if (r) this.onDone(r);
  }

  private setMood(m: Mood, t: number): void { this.mood = m; this.moodT = t; }

  private burst(kind: Kind): void {
    const words = REACT[kind].words;
    const n = kind === "killer" ? 14 : kind === "mid" ? 5 : 6;
    for (let i = 0; i < n; i++) {
      const f = pick(this.fans);
      this.particles.push({ x: f.x, y: f.y - 70 * f.s, vx: rand(-20, 20), vy: rand(-70, -35), life: 0, max: rand(0.9, 1.6), color: kind === "bomb" ? "#9a8fb0" : f.color, text: pick(words) });
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.open) return;
    const k = e.key.toLowerCase();
    const onButton = (e.target as HTMLElement | null)?.tagName === "BUTTON";
    let handled = true;
    if (k === "escape") this.escape();
    else if (this.phase === "choose" && k >= "1" && k <= "3" && !e.ctrlKey && !e.metaKey && !e.altKey) this.choose(+k - 1);
    else if (k === "enter" || k === " ") {
      if (this.phase === "roast") this.skipTyping();
      else if (onButton) handled = false;
      else if (this.phase === "intro") this.begin();
      else if (this.phase === "done") this.collect();
      else handled = false;
    } else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  };

  // ------------------------------------------------------------------ loop
  private loop = (now: number): void => {
    if (!this.open) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.clock += dt;
    this.moodT = Math.max(0, this.moodT - dt);
    if (this.moodT === 0) this.mood = "idle";
    if (!this.reduced) this.flicker = Math.random() < 0.015 ? rand(0.25, 0.6) : Math.min(1, this.flicker + dt * 4);
    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; }
    this.particles = this.particles.filter((p) => p.life < p.max);

    if (this.phase === "roast") {
      this.typed += dt * TYPE_CPS;
      this.syncTyping();
    } else if (this.phase === "choose") {
      this.pickLeft -= dt;
      if (this.timerBar) {
        this.timerBar.style.width = Math.max(0, (this.pickLeft / PICK_TIME) * 100) + "%";
        this.timerBar.style.background = this.pickLeft < 4 ? RED : "";
      }
      if (this.pickLeft <= 0) this.resolve("bomb", ROASTIE_SAYS.dead);
    } else if (this.phase === "react") {
      this.reactLeft -= dt;
      if (this.reactLeft <= 0) { if (this.round >= ROUNDS) this.finish(); else this.nextRound(); }
    }
  }

  // ------------------------------------------------------------------ drawing
  private draw(): void {
    const c = this.ctx, cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = this.clock;

    this.drawWall(c);
    this.drawSign(c, t);
    this.drawStage(c);
    const speaker = this.phase === "roast" || this.phase === "intro" ? "l" : this.phase === "react" ? "r" : "both";
    this.drawSpot(c, ROASTIE_X, speaker === "r" ? 0.35 : 1);
    this.drawSpot(c, PLAYER_X, speaker === "l" ? 0.35 : 1);
    this.drawMic(c);
    this.drawPerformers(c, t);
    this.drawCrowd(c, t);
    for (const p of this.particles) {
      c.save();
      c.globalAlpha = Math.max(0, 1 - p.life / p.max);
      c.font = "900 16px Impact, 'Arial Black', sans-serif";
      c.textAlign = "center";
      c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 10;
      c.fillText(p.text, p.x, p.y);
      c.restore();
    }
  }

  private drawWall(c: CanvasRenderingContext2D): void {
    c.fillStyle = "#1a0d14"; c.fillRect(0, 0, W, H);
    const bw = 44, bh = 18;
    c.strokeStyle = "rgba(0,0,0,0.55)"; c.lineWidth = 2;
    for (let row = 0; row * bh < STAGE_Y; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw + off; x < W; x += bw) {
        const shade = 30 + ((row * 7 + Math.floor(x / bw) * 13) % 11);
        c.fillStyle = `rgb(${shade + 32},${shade - 12},${shade - 14})`;
        c.fillRect(x + 1, row * bh + 1, bw - 2, bh - 2);
        c.strokeRect(x + 1, row * bh + 1, bw - 2, bh - 2);
      }
    }
    const v = c.createLinearGradient(0, 0, 0, STAGE_Y);
    v.addColorStop(0, "rgba(5,3,8,0.75)"); v.addColorStop(0.5, "rgba(5,3,8,0.45)"); v.addColorStop(1, "rgba(5,3,8,0.7)");
    c.fillStyle = v; c.fillRect(0, 0, W, STAGE_Y);
  }

  private drawSign(c: CanvasRenderingContext2D, t: number): void {
    c.save();
    c.font = "900 34px Impact, 'Arial Black', sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    const x = W / 2, y = 34;
    c.globalAlpha = 0.25; c.fillStyle = PINK; c.fillText("ROAST NIGHT", x, y + 2);
    // "NIGHT" flickers, "ROAST" is steady
    c.globalAlpha = 1;
    c.lineWidth = 2; c.shadowBlur = 18;
    const glow = this.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 3);
    c.shadowColor = PINK; c.strokeStyle = PINK; c.fillStyle = "#ffe0f5";
    c.globalAlpha = glow;
    c.strokeText("ROAST", x - 62, y); c.fillText("ROAST", x - 62, y);
    c.shadowColor = "#3dd6ff"; c.strokeStyle = "#3dd6ff"; c.fillStyle = "#dff7ff";
    c.globalAlpha = glow * this.flicker;
    c.strokeText("NIGHT", x + 66, y); c.fillText("NIGHT", x + 66, y);
    c.globalAlpha = 0.6; c.shadowBlur = 8; c.strokeStyle = PINK; c.lineWidth = 2;
    c.beginPath(); c.roundRect(x - 140, y - 26, 280, 52, 12); c.stroke();
    c.restore();
  }

  private drawStage(c: CanvasRenderingContext2D): void {
    const g = c.createLinearGradient(0, STAGE_Y, 0, H);
    g.addColorStop(0, "#2a1a14"); g.addColorStop(1, "#0a0608");
    c.fillStyle = g; c.fillRect(0, STAGE_Y, W, H - STAGE_Y);
    c.save();
    c.strokeStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 10; c.lineWidth = 2; c.globalAlpha = 0.7;
    c.beginPath(); c.moveTo(0, STAGE_Y + 22); c.lineTo(W, STAGE_Y + 22); c.stroke();
    c.restore();
  }

  private drawSpot(c: CanvasRenderingContext2D, x: number, k: number): void {
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createLinearGradient(0, 0, 0, STAGE_Y + 20);
    g.addColorStop(0, `rgba(255,240,200,${0.02 * k})`); g.addColorStop(1, `rgba(255,240,200,${0.16 * k})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - 14, 0); c.lineTo(x + 14, 0); c.lineTo(x + 80, STAGE_Y + 16); c.lineTo(x - 80, STAGE_Y + 16); c.closePath(); c.fill();
    const pool = c.createRadialGradient(x, STAGE_Y + 14, 4, x, STAGE_Y + 14, 90);
    pool.addColorStop(0, `rgba(255,240,200,${0.3 * k})`); pool.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = pool;
    c.beginPath(); c.ellipse(x, STAGE_Y + 14, 90, 14, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  private drawMic(c: CanvasRenderingContext2D): void {
    c.save();
    c.strokeStyle = "#cfc6d8"; c.lineWidth = 2.5; c.lineCap = "round";
    c.shadowColor = "#cfc6d8"; c.shadowBlur = 4;
    const base = STAGE_Y + 16;
    c.beginPath();
    c.moveTo(MIC_X - 14, base); c.lineTo(MIC_X, base - 4); c.lineTo(MIC_X + 14, base);
    c.moveTo(MIC_X, base - 4); c.lineTo(MIC_X, base - 62);
    c.lineTo(MIC_X - 12, base - 70);
    c.stroke();
    c.fillStyle = "#3a3344"; c.strokeStyle = "#e9e1f2";
    c.beginPath(); c.ellipse(MIC_X - 15, base - 72, 5, 4, -0.6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }

  private drawPerformers(c: CanvasRenderingContext2D, t: number): void {
    const foot = STAGE_Y + 16, m = !this.reduced;
    // Roastie: gold, with a little hat, gesturing while roasting
    const talking = this.phase === "roast" || this.phase === "intro";
    const smug = this.phase === "react" && this.lastKind === "bomb";
    const burnt = this.phase === "react" && this.lastKind === "killer";
    const wave = talking && m ? Math.sin(t * 7) * 0.5 : 0;
    stick(c, ROASTIE_X, foot, 1.25, GOLD, {
      armL: burnt ? 0.15 : 0.4,
      armR: smug ? 2.2 : talking ? 1.7 + wave : 0.9,
      lean: burnt ? -6 : talking ? 3 : 0,
      tilt: burnt ? 4 : 0,
    });
    c.save();
    c.strokeStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 8; c.lineWidth = 3; c.lineCap = "round";
    const hx = ROASTIE_X + (burnt ? -6 : talking ? 3 : 0) * 1.25, hy = foot - 60 * 1.25 + (burnt ? 5 : 0) - 10;
    c.beginPath(); c.moveTo(hx - 14, hy + 1); c.lineTo(hx + 14, hy + 1); c.moveTo(hx - 8, hy); c.lineTo(hx - 7, hy - 9); c.lineTo(hx + 7, hy - 9); c.lineTo(hx + 8, hy); c.stroke();
    c.restore();
    // Player: acid green
    const mine = this.phase === "react";
    const k = this.lastKind;
    const pw = mine && m ? Math.sin(t * 8) * 0.4 : 0;
    const flex = mine && k === "killer";
    stick(c, PLAYER_X, foot, 1.25, ACID, {
      armL: flex ? 2.6 : mine && k === "mid" ? 1.4 + pw : this.phase === "choose" ? 0.6 : 0.35,
      armR: flex ? 2.6 : mine && k === "bomb" ? 0.1 : 0.35,
      lean: mine && k === "bomb" ? 5 : 0,
      tilt: mine && k === "bomb" ? 5 : 0,
    });
    if (this.phase === "choose") {
      c.save();
      c.fillStyle = ACID; c.shadowColor = ACID; c.shadowBlur = 8;
      c.font = "900 20px Impact, 'Arial Black', sans-serif"; c.textAlign = "center";
      c.globalAlpha = m ? 0.6 + 0.4 * Math.sin(t * 5) : 1;
      c.fillText("?", PLAYER_X + 18, foot - 92);
      c.restore();
    }
  }

  private drawCrowd(c: CanvasRenderingContext2D, t: number): void {
    const m = !this.reduced;
    const mood = this.mood;
    for (const f of this.fans) {
      const lateIn = mood !== "idle" && this.moodT > 0 && m;
      let y = f.y, armL = 0.3, armR = 0.3, lean = 0, tilt = 0;
      if (mood === "laugh") {
        y -= m ? Math.abs(Math.sin(t * 14 + f.phase)) * 7 : 3;
        armL = 0.9; armR = 0.9;
      } else if (mood === "ohh") {
        const up = m ? 2.5 + Math.sin(t * 9 + f.phase) * 0.25 : 2.6;
        armL = up; armR = up;
        y -= m ? Math.abs(Math.sin(t * 6 + f.phase)) * 3 : 2;
      } else if (mood === "groan") {
        armL = 0.05; armR = 0.05; lean = 7; tilt = 6;
        y += 2;
      } else if (m) {
        y -= Math.sin(t * 1.5 + f.phase) * 0.8;
      }
      if (lateIn && this.moodT > 2.4 - f.delay) { armL = 0.3; armR = 0.3; lean = 0; tilt = 0; y = f.y; }
      stick(c, f.x, y, f.s, f.color, { armL, armR, lean, tilt, blur: 6 });
    }
  }
}
