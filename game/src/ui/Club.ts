import { h } from "./dom";

/**
 * Two comic venue interiors: The Pink Pukeko (a parody strip club with the "Make It Rain" money-gun
 * minigame and an owner path) and The Velvet Rooms (Sir Ponsonby Velvet's absurdly posh "gentlemen's
 * club", where doors only ever open on punchlines). Strictly PG-13: neon stick figures in cartoon
 * outfits, innuendo and slapstick, nothing shown. Styles live in ./club.css (classes prefixed `cl-`).
 */
export interface ClubHost { getCash(): number; setCash(v: number): void; toast(t: string): void; playerName(): string; owned(key: string): boolean; setOwned(key: string, v: boolean): void }

type Venue = "strip" | "velvet";
interface Spot { id: string; label: string; x: number; y: number; w: number; h: number }
interface Bill { x: number; y: number; vx: number; vy: number; r: number; vr: number; age: number; fly: number; col: string; landed: boolean; done: boolean; tx: number; ty: number; v: number }
interface Bubble { who: string; text: string; x: number; y: number; until: number }
interface Queued { who: string; text: string; at: number }
interface Floaty { x: number; y: number; text: string; age: number; col: string }
interface Dancer { name: string; x: number; col: string; seq: number[]; speed: number; hat?: boolean; boa?: boolean; sequins?: boolean; pole?: boolean; hit: number; tips: number; needsStage?: boolean }
interface Room { name: string; gag: string }

const W = 960, H = 500;
const KEY = { club: "club.pukeko", gun: "club.moneygun", member: "velvet.member" };
const CLUB_PRICE = 250_000, GUN_PRICE = 500, MEMBER_PRICE = 5_000, BASE_INCOME = 8, BANKED_SHARE = 0.6, HOUSE_CUT = 0.4;
const UPGRADES = [
  { id: "stage", name: "Bigger stage", cost: 60_000, inc: 6, blurb: "Room for a kick line, and a second dancer who brought her own glitter." },
  { id: "smoke", name: "Smoke machine", cost: 20_000, inc: 3, blurb: "Mysterious. Atmospheric. Sets off the Fire Service every Thursday." },
  { id: "dj", name: "Celebrity DJ", cost: 90_000, inc: 10, blurb: "DJ Hokey Pokey, who once remixed the haka and got a stern email." },
];
const NOTES = [{ v: 5, c: "#f08a24" }, { v: 20, c: "#2fa35a" }, { v: 100, c: "#e0405a" }];
const NEON = ["#ff4fa3", "#3dd6ff", "#c6ff3d", "#f6b62c", "#b48cff", "#ff7a3d"];

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-NZ");
const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const dprOf = () => Math.min(3, window.devicePixelRatio || 1);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const shuffle = <T>(a: T[]): T[] => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ------------------------------------------------------------------ the jokes
// "WHO|line" with "||" between beats of an exchange. {name} is the player's name.
const STRIP_JOKES = [
  "MC|Tips are appreciated. Tips about crypto are not.",
  "MC|Give it up for Crystal! Your applause, not your savings. Well. Both.",
  "MC|Please keep your hands where the bouncer can see them. He gets lonely.",
  "MC|Next on stage, Destiny! She's from Rangiora, so be nice. She's got a ute.",
  "MC|Look, don't touch. Same rules as the Canterbury Museum.",
  "MC|Sir, did you just tip in Countdown vouchers? This is a classy joint. Pak'nSave only.",
  "MC|Our dancers do this for the love of the art. And the rent. Mostly the rent.",
  "MC|Big round of applause for Shazza, who did all of that in gumboots.",
  "MC|The stage is slippery, the drinks are pricey and the carpet has seen things. Welcome!",
  "MC|Make some noise if you told your partner you were at the rugby!",
  "MC|Hen party at table four! Ladies, the groom is not under the table. We checked. Twice.",
  "MC|No photos please. Our dancers have mortgages and Facebook aunties.",
  "MC|Stag do from Timaru in the house! Lads, the dancers can hear you counting coins.",
  "MC|Water's free. Dignity is extra.",
  "MC|This pole has seen more action than the Crusaders' trophy cabinet. And that's a lot of action.",
  "MC|Remember, folks: what happens at the Pukeko stays at the Pukeko. Except the glitter. The glitter goes home with you.",
  "DJ|This one goes out to the bloke who tipped with a Hell Pizza loyalty card.",
  "DJ|Turn it up! Not you, sir. The music. You're loud enough.",
  "DJ|I'm gonna drop the bass. Then I'm gonna pick it up, 'cos it's hired.",
  "DJ|No, we will not play Slice of Heaven a fourth time. ...Fine. Fourth time.",
  "DJ|Bass so deep it registered on GeoNet.",
  "DJ|This track's called Your Bank Balance, and it is going DOWN.",
  "DJ|Hands in the air! Wallets also in the air!",
  "DJ|Shout out to the Famiglia in the VIP. Please don't shout back.",
  "DJ|If you can feel this in your fillings, that's the vibe.",
  "BOUNCER|Name's Tiny. I'm not tiny. That's the joke. Laugh.",
  "BOUNCER|Shoes, ID and a positive attitude. Two out of three won't cut it.",
  "BOUNCER|No jandals. This isn't New Brighton pier.",
  "BOUNCER|Sir, the no-touching rule applies to the pole too. Let it go.",
  "BOUNCER|Threw out three accountants tonight. They kept auditing the tips.",
  "BOUNCER|If you're sick, go home. If you're sick of home, come in.",
  "BOUNCER|Sir, that's the hand dryer, not the VIP entrance.",
  "BOUNCER|Last bloke who made trouble is still walking home. He lives in Dunedin.",
  "BOUNCER|I don't do small talk. I do large silence.",
  "BARTENDER|House special: Sex on Sumner Beach. It's orange juice and regret.",
  "BARTENDER|Shaken or stirred? I'm also shaken. It's been a big night.",
  "BARTENDER|Bar tab's open. Like your shirt, mate. Do a button up.",
  "BARTENDER|Eighteen dollars. The ice is from a glacier. The glacier was furious.",
  "BARTENDER|'The usual' is not a drink. Unless you're Gary. Kia ora, Gary.",
  "BARTENDER|Three beers on tap: cold, colder and Speight's.",
  "BARTENDER|The Pink Pukeko cocktail: it's pink, it's strong and it'll nick your chips.",
  "BARTENDER|Mate, that's your sixth espresso martini. You can hear colours now.",
  "BARTENDER|I don't judge. I just remember. Forever.",
  "BARTENDER|Wine list: red, white, and whatever Sir Ponsonby left in the cellar.",
  "PATRON|Babe, I swear I'm at the library. The library has a DJ now.",
  "PATRON|Is this cash only? Because I'm a card-only personality.",
  "PATRON|Bro, I've been tipping Monopoly money for an hour and nobody's said a thing.",
  "PATRON|My wife thinks I'm at bowls. Technically I'm watching skill and balance.",
  "PATRON|Do they do a Gold Card discount?",
  "PATRON|I came in to ask directions to the Cathedral. That was four hours ago.",
  "PATRON|First time at one of these. Mum told me to bring a cardigan.",
  "PATRON|I tipped her a sausage roll. She looked confused but grateful.",
  "PATRON|Is the stage gluten free?",
  "PATRON|I'm a Hurricanes fan. I'm used to watching people work harder than me.",
  "PATRON|My mate's opening a wallet. Everyone take cover, there's moths.",
  "MC|This club was won by Sir Ponsonby Velvet in a game of croquet. Nobody knows who lost.",
  "BOUNCER|Famiglia's in the VIP. If anyone asks, it's a book club. Very aggressive book club.",
  "MC|Tuesday nights: Roastie Malone! Last week he roasted a bloke so hard the bloke tipped him.",
  "BARTENDER|Roastie Malone drinks free on Tuesdays. Mostly because he roasted the till.",
  "PATRON|Is Roastie Malone on tonight? I need someone to tell me my haircut's bad. Professionally.",
  "DJ|Sir Ponsonby Velvet requests harpsichord remixes only. Request denied, Sir!",
  "MC|Sir Ponsonby sends his love from his yacht. The yacht also sends love. It's very well trained.",
  "BOUNCER|The Famiglia tip in envelopes. I don't ask. The envelopes don't tell.",
  "PATRON|Don Famiglia just ordered a 'quiet word'. The bartender brought him a glass of milk.",
  "BARTENDER|Sir Ponsonby's standing order: one gin, one tonic, one tiny umbrella, no questions.",
  "MC|Roastie Malone, Tuesdays. Bring thick skin and a cardigan. He'll roast the cardigan.",
  "PATRON|Can I get a lap dance?||BOUNCER|You can get a lap of the car park.",
  "PATRON|What's the dress code?||BOUNCER|Dressed.",
  "PATRON|Do you take Afterpay?||BARTENDER|We take after nobody, mate.",
  "PATRON|Which one's the VIP?||BOUNCER|Very Insistent Person? That's you. Sit down.",
  "MC|Who's celebrating tonight?||PATRON|My divorce!||MC|Congratulations! The prenup doesn't cover tips.",
  "PATRON|What's this song called?||DJ|You Owe Me Twenty Bucks.",
  "PATRON|Where's the loo?||BARTENDER|Past the stage, left at regret, right at the mirror.",
  "PATRON|Is that pole load-tested?||MC|Rated for one dancer or three engineers.",
  "PATRON|I'm a big deal in Hornby.||BOUNCER|Then Hornby's right where you left it.",
  "DJ|Can I get a YEAH?||PATRON|YEAH!||DJ|Can I get a twenty?||PATRON|...yeah.",
  "PATRON|This all feels a bit risqué.||MC|Sir, risqué is the dress code. Also pants.",
  "PATRON|Honey, the money gun is not a toy.||PATRON|It's an investment vehicle!",
  "BARTENDER|What'll it be?||PATRON|Something to help me forget.||BARTENDER|Your tab? Coming right up.",
  "MC|Our dancers train eight hours a day.||PATRON|Doing what?||MC|Avoiding eye contact with you, Kevin.",
  "PATRON|Do the dancers take requests?||MC|Yes. Mostly 'please leave'.",
  "PATRON|How much for the VIP booth?||BOUNCER|More than your car. Less than your ego.",
  "PATRON|Can I sit near the stage?||BOUNCER|You can sit near the exit. It's got better lighting.",
];
const RAIN_SHOUTS = [
  "MAKE IT RAAAIN!", "Somebody ring MetService, it's a cash storm!", "That's not a wallet, that's a leaf blower!",
  "Combo! The ATM just felt that!", "Big spender or big mistake? Either way, LOUDER!", "The Reserve Bank wants to know your location!",
  "The dancers are WADING! Wading in it!", "Your accountant just sat bolt upright in bed!", "Hype level: Rangiora A&P Show!",
  "Forecast for Ōtautahi: one hundred percent chance of twenties!", "Someone's paying off their karma in cash!",
];
const OWNER_LINES = [
  "MC|Please welcome the new owner, {name}! Clap, or they'll fire you!",
  "BARTENDER|Boss, the till's full. Emotionally and financially.",
  "BOUNCER|Boss. Nobody gets in without your say-so. Except Gary. Gary's always here.",
  "DJ|Boss bought the place! First order of business: more bass, fewer harpsichords!",
];
const VELVET_LINES = [
  "Welcome to the Velvet Rooms. Please leave your coat, your shame and your surname at the door.",
  "Sir Ponsonby insists all guests be dressed. He has never specified in what.",
  "Dress code: smart casual. Mostly smart. A little casual. Nothing hanging out.",
  "Established 1887. Renovated 2011. Unrepentant since forever.",
  "Discretion is our motto. Our previous motto was 'Ooh, saucy', but the board voted.",
  "Members receive a monocle. Non-members receive a long, disappointed look.",
  "Sir Ponsonby says 'Nothing is shown, everything is implied.' He was describing his tax return.",
  "Please don't knock on the doors. Some guests are already knocking. On wood. For luck.",
  "Do not feed the peacock. He's had enough, and frankly so have we.",
  "Tea is served at four. What happens at five is between you and your conscience.",
  "A locked door is for your protection. An unlocked one is for our amusement.",
  "We had a scandal in 1952. Someone used the wrong fork.",
  "The fainting couch is reserved. Lady Featherstonehaugh faints on a strict schedule.",
  "Sir Ponsonby sends his regards. And his invoice.",
];
const ROOMS: Room[] = [
  { name: "The Room of Mild Regret", gag: "A man in a silk dressing gown stares at a receipt. 'It said tapas. It did not say TWELVE tapas.'" },
  { name: "Suite 7", gag: "Occupied by a wedding party from Ashburton. The bride waves. The groom is asleep in the ice bucket." },
  { name: "The Library of Forbidden Volumes", gag: "Every romance novel ever printed, and one very flushed librarian who shushes you with enormous force." },
  { name: "The Spanking New Room", gag: "Freshly painted. Smells of primer. A sign reads: 'Wet paint. Please, sir. Do not.'" },
  { name: "The Chamber of Whispers", gag: "Two accountants, whispering. One gasps: 'You can claim the YACHT?'" },
  { name: "The Velvet Handcuff Suite", gag: "A magician, stuck in an escape trick he started in 1997. 'Any minute now,' he says." },
  { name: "The Tickle Trunk", gag: "A dress-up box. A lawyer in a pirate hat says 'Arrr-bitration' and gently closes the door." },
  { name: "The Steam Room", gag: "So much steam. A voice from inside: 'Is this the sauna, or did someone leave the jug on?'" },
  { name: "The Oyster Bar", gag: "Bluff oysters, in season. A couple gazes meaningfully at each other. Then at the bill. Then at the exit." },
  { name: "The Room Where It Happens", gag: "Nothing is happening. A man is assembling flat-pack furniture with one Allen key and enormous passion." },
  { name: "The Massage Suite", gag: "A physio says 'Ooh, that's tight.' It is genuinely about a hamstring. $85, ACC claimable." },
  { name: "The Boudoir", gag: "French for 'room'. Inside: a Frenchman, sulking. 'Nobody uses the word correctly.'" },
  { name: "The Cuddle Puddle", gag: "Eight golden retrievers. Absolutely nobody is leaving. You almost don't either." },
  { name: "The Dungeon", gag: "It's the wine cellar. Sir Ponsonby is murmuring sweet nothings to a 1984 pinot. You give them privacy." },
  { name: "The Mirror Room", gag: "Mirrors on every wall. A man from Rolleston winks at you. He is winking at himself." },
  { name: "The Honeymoon Suite", gag: "A couple married sixty-one years, doing a jigsaw. 'Don't you DARE take that corner piece, Maureen.'" },
  { name: "The Whip Room", gag: "Parliamentary whips, counting votes. 'We're two short.' They look at you hopefully." },
  { name: "The Lounge of Loose Morals", gag: "Strip poker, but nobody's taken off anything except their reading glasses. Everyone is cheating." },
  { name: "The Love Seat Showroom", gag: "A genuine furniture showroom. Interest free until 2031. The salesman is VERY excited." },
  { name: "Room 69", gag: "A maths tutor explaining to a deflated stag party that it is simply a number between 68 and 70." },
  { name: "The Champagne Room", gag: "Sparkling grape juice. Sir Ponsonby says the real champagne was the friends we made. He drank it." },
  { name: "The Feather Room", gag: "A pillow fight began here in 2019. Nobody has won. Feathers drift like snow over Arthur's Pass." },
  { name: "The Naughty Corner", gag: "A grown man faces the wall. 'I double-dipped at the cheese board,' he whispers, ashamed." },
  { name: "The Chamber of Secrets", gag: "A woman tells a fund manager her sourdough starter's real name. He weeps openly." },
  { name: "The Slow Dance Salon", gag: "Two retirees slow-dancing to the marine forecast. 'Moderate seas,' she murmurs. He swoons." },
  { name: "The Rubber Room", gag: "Hundreds of gumboots. A farmer from Methven tries each on. 'None of these are Gary's.'" },
  { name: "The Knotty Room", gag: "A scout leader teaches three investment bankers the sheepshank. Very intense. Very nautical." },
  { name: "The Red Room", gag: "Red walls, red chair, red apple, red tie. 'Crusaders fan,' the man explains. That explains it." },
  { name: "The Afterglow Lounge", gag: "Glow sticks. A rave of three Lincoln University students, discussing soil. Passionately." },
  { name: "The Tradesman's Entrance", gag: "A plumber, actually here to fix the plumbing. Nobody believes him. He is livid." },
  { name: "Room 101: Hot Tub", gag: "Lukewarm. The bubbles are just Derek. Everyone has asked Derek to leave." },
  { name: "The Discretion Suite", gag: "Behind the door: another door. Behind that: a note that says 'Nice try.'" },
  { name: "The Ballroom", gag: "It's a ball pit. Two barristers throw balls at each other. It's billable." },
];

/** Joint angles (radians, 0 = straight down, + = toward screen-right): lShoulder, lElbow, rShoulder, rElbow, lHip, lKnee, rHip, rKnee, lean, hop. */
const POSES: number[][] = [
  [-2.6, 0.3, 2.6, -0.3, -0.25, 0, 0.25, 0, 0, 0], // hands up
  [-0.6, -1.2, 0.6, 1.2, -0.3, 0.2, 0.15, -0.1, 0.12, 0], // hip sway
  [-0.4, -0.8, 2.4, 0.2, -0.3, 0.1, 0.5, -0.6, -0.1, 0], // disco point
  [-0.5, -1, 2.9, 0.6, -0.25, 0.4, 0.25, -0.4, 0, 4], // lasso
  [-1.5, -1.5, 1.5, 1.5, -0.2, 0, 0.2, 0, 0.05, 2], // shimmy
  [-2.0, 0, 2.0, 0, -0.2, 0, 1.6, 0, -0.15, 0], // high kick
  [-0.3, 0, 3.0, 0, -0.15, 0.1, 0.9, -1.4, 0.1, 0], // pole hang
  [-0.3, 0, 3.0, 0, -0.9, 1.4, 0.15, 0, -0.1, 0], // pole swing
  [-1.2, 1.8, 1.2, -1.8, -0.1, 0, 0.1, 0, 0, 0], // arms crossed (bouncer)
];

export class Club {
  el: HTMLElement;
  open = false;
  private venue: Venue = "strip";
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private now = 0;
  private reduce = false;
  private hover = "";
  private tickerEl: HTMLElement = h("p.cl-ticker", { role: "status", "aria-live": "polite" });
  private live: { mag?: HTMLElement; spent?: HTMLElement; till?: HTMLElement; cash?: HTMLElement; combo?: HTMLElement; comboNum?: HTMLElement } = {};
  private bubbles: Bubble[] = [];
  private queue: Queued[] = [];
  private deck: string[] = [];
  private nextAmbient = 0;
  // money gun
  private mag = 0; private spent = 0; private note = 20; private firing = false; private fireAcc = 0;
  private aim = { x: W / 2, y: 250 }; private aimByPointer = false;
  private combo = 0; private tier = 0; private hype = 0;
  private bills: Bill[] = [];
  private floaties: Floaty[] = [];
  private dancers: Dancer[] = [
    { name: "Velocity", x: 480, col: "#ff4fa3", seq: [6, 7], speed: 0.7, pole: true, sequins: true, hit: 0, tips: 0 },
    { name: "Crystal", x: 380, col: "#3dd6ff", seq: [0, 1, 4, 2], speed: 0.9, sequins: true, hit: 0, tips: 0 },
    { name: "Shazza", x: 585, col: "#f6b62c", seq: [3, 1, 3, 5], speed: 0.8, hat: true, hit: 0, tips: 0 },
    { name: "Destiny", x: 300, col: "#b48cff", seq: [1, 2, 4, 0], speed: 1, boa: true, hit: 0, tips: 0, needsStage: true },
    { name: "Pearl", x: 665, col: "#c6ff3d", seq: [5, 4, 0, 1], speed: 1.1, boa: true, hat: true, hit: 0, tips: 0, needsStage: true },
  ];
  private dancerPos: { d: Dancer; x: number; y: number }[] = [];
  private patrons = Array.from({ length: 9 }, (_, i) => ({ x: 290 + i * 62, col: NEON[i % NEON.length], ph: i * 1.7 }));
  // owner
  private till = 0;
  // velvet
  private doors: Room[] = [];
  private roomDeck: Room[] = [];
  private opening = -1; private openT = 0;
  private card: { door: number; room: Room } | null = null;

  constructor(private host: ClubHost) {
    this.dpr = dprOf();
    this.cv = h("canvas.cl-canvas", { width: Math.round(W * this.dpr), height: Math.round(H * this.dpr), role: "img" }) as HTMLCanvasElement;
    this.g = this.cv.getContext("2d")!;
    this.el = h("div.club.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "Club" });
    const pos = (e: PointerEvent) => { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
    this.cv.addEventListener("pointermove", (e) => {
      const p = pos(e); this.hover = this.hit(p.x, p.y)?.id ?? ""; this.cv.style.cursor = this.hover ? "pointer" : this.canSpray() ? "crosshair" : "";
      if (this.firing && this.aimByPointer) this.aim = p;
    });
    this.cv.addEventListener("pointerdown", (e) => {
      const p = pos(e); const s = this.hit(p.x, p.y);
      if (s) { this.activate(s.id); return; }
      if (this.venue === "strip" && this.canSpray()) { this.aim = p; this.aimByPointer = true; this.firing = true; this.cv.setPointerCapture(e.pointerId); e.preventDefault(); }
      else if (this.venue === "strip" && this.host.owned(KEY.gun)) this.say("DJ|Your money gun's empty! Load it up, legend!");
    });
    const stop = () => { this.firing = false; this.aimByPointer = false; };
    this.cv.addEventListener("pointerup", stop);
    this.cv.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", (e) => {
      if (!this.open || e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (this.card) { this.card = null; this.render(); } else this.close();
    }, true);
  }

  show(venue: Venue): void {
    this.venue = venue; this.open = true; this.reduce = reducedMotion();
    this.el.setAttribute("aria-label", venue === "strip" ? "The Pink Pukeko" : "The Velvet Rooms");
    this.cv.setAttribute("aria-label", venue === "strip" ? "Inside the Pink Pukeko: neon stage, pole, DJ booth, VIP booth, bar and bouncer. Hold on the stage to spray cash if your money gun is loaded." : "The Velvet Rooms corridor: plush doors, chandeliers and a doorman. Choose a door below.");
    this.bubbles = []; this.queue = []; this.card = null; this.opening = -1; this.combo = 0; this.tier = 0; this.firing = false;
    this.deck = shuffle(STRIP_JOKES);
    this.nextAmbient = performance.now() / 1000 + 1.2;
    if (venue === "velvet") {
      this.roomDeck = shuffle(ROOMS); this.doors = this.roomDeck.splice(0, 6);
      this.say(this.isMember() ? `DOORMAN|Good evening, ${this.host.playerName()}. Your monocle has been polished. Your reputation has not.` : "DOORMAN|" + VELVET_LINES[0]);
    } else this.say(this.ownsClub() ? pick(OWNER_LINES) : "MC|Welcome to the Pink Pukeko, Ōtautahi's third-classiest establishment!");
    this.el.classList.remove("hidden");
    this.render();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    (this.el.querySelector(".cl-x") as HTMLElement | null)?.focus();
  }

  close(): void {
    if (!this.open) return;
    this.firing = false;
    if (this.mag > 0) { this.host.setCash(this.host.getCash() + this.mag); this.host.toast(`${money(this.mag)} unsprayed cash went back in your wallet. The money gun is disappointed in you.`); this.mag = 0; }
    if (this.spent > 0) this.host.toast(`You made it rain ${money(this.spent)} at the Pink Pukeko. Worth it? Absolutely not. Did it look cool? Yes.`);
    this.spent = 0; this.bills = []; this.floaties = []; this.card = null;
    this.open = false; this.el.classList.add("hidden");
    cancelAnimationFrame(this.raf);
  }

  /** Call every real second. Accrues the club's takings: the banked share is returned (host adds it to cash), the rest lands in the till for "Collect takings". */
  tick(dtSec: number): number {
    if (!this.ownsClub() || dtSec <= 0) return 0;
    const earned = this.income() * Math.min(dtSec, 3600);
    this.till = Math.min(this.till + earned * (1 - BANKED_SHARE), this.income() * 3600);
    return Math.round(earned * BANKED_SHARE * 100) / 100;
  }

  // ------------------------------------------------------------------ state helpers
  private ownsClub(): boolean { return this.host.owned(KEY.club); }
  private isMember(): boolean { return this.host.owned(KEY.member); }
  private hasUp(id: string): boolean { return this.host.owned("club.up." + id); }
  private income(): number { return BASE_INCOME + UPGRADES.reduce((s, u) => s + (this.hasUp(u.id) ? u.inc : 0), 0); }
  private canSpray(): boolean { return this.venue === "strip" && this.host.owned(KEY.gun) && this.mag >= this.note; }
  private djName(): string { return this.hasUp("dj") ? "DJ HOKEY POKEY" : "DJ KUMARA"; }
  private pay(n: number, what: string): boolean {
    if (this.host.getCash() < n) { this.host.toast(`You need ${money(n)} for ${what}. Your wallet makes a small, sad noise.`); return false; }
    this.host.setCash(this.host.getCash() - n); return true;
  }

  /** Queue a line (or an exchange) as speech bubbles + the ticker. */
  private say(spec: string): void {
    const t = Math.max(this.now, performance.now() / 1000);
    const start = Math.max(t, this.queue.length ? this.queue[this.queue.length - 1].at + 2.6 : t);
    spec.split("||").forEach((beat, i) => {
      const [who, ...rest] = beat.split("|");
      this.queue.push({ who, text: rest.join("|").replace(/\{name\}/g, this.host.playerName()), at: start + i * 2.6 });
    });
  }

  private speakerAt(who: string): { x: number; y: number } {
    if (this.venue === "velvet") return who === "DOORMAN" ? { x: 80, y: 330 } : { x: 140, y: 350 };
    switch (who) {
      case "MC": return { x: 250, y: 278 };
      case "DJ": return { x: 115, y: 150 };
      case "BOUNCER": return { x: 838, y: 365 };
      case "BARTENDER": return { x: 135, y: 342 };
      case "PATRON": { const p = pick(this.patrons); return { x: p.x, y: 418 }; }
      default: return { x: W / 2, y: 300 };
    }
  }

  private spots(): Spot[] {
    if (this.venue === "strip") return [
      { id: "dj", label: "DJ booth", x: 25, y: 140, w: 180, h: 115 },
      { id: "vip", label: "VIP booth", x: 755, y: 130, w: 190, h: 130 },
      { id: "bar", label: "Bar", x: 15, y: 330, w: 240, h: 150 },
      { id: "bouncer", label: "Bouncer", x: 800, y: 300, w: 150, h: 175 },
    ];
    return [
      { id: "doorman", label: "Doorman", x: 40, y: 300, w: 80, h: 160 },
      ...this.doors.map((r, i) => ({ id: "door" + i, label: r.name, x: 190 + i * 125, y: 140, w: 84, h: 196 })),
    ];
  }
  private hit(x: number, y: number): Spot | undefined { return this.spots().find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h); }

  private activate(id: string): void {
    switch (id) {
      case "dj":
        if (this.pay(50, "a song request")) this.say(pick(["PATRON|Can you play something by Six60?||DJ|I can play it AT six-sixty decibels.", "PATRON|Play something romantic!||DJ|Here's the sound of your bank account. Very moving.", "PATRON|Play Slice of Heaven!||DJ|Again? ...Fine. For fifty bucks I'd play the Countdown jingle.", "DJ|Fifty bucks? Request granted. This one's called 'Generous Stranger (Extended Mix)'."]));
        break;
      case "vip": this.say(pick(["BOUNCER|VIP's the Famiglia's tonight. They're discussing 'olive oil imports'. Don't ask.", "PATRON|Don Famiglia says the VIP is free for friends.||BOUNCER|And everyone else pays in kidneys. Kidding. In cash.", "MC|The Famiglia drinks here every Friday. They tip well and stare even better.", "BOUNCER|Famiglia rule: nobody sits in Nonna's chair. Nonna isn't here. Nobody sits in it anyway."])); break;
      case "bar":
        if (this.pay(14, "a drink")) { this.host.toast("Lemon & Paeroa on the rocks. World famous in New Zealand."); this.say("BARTENDER|" + pick(["One L&P, shaken by an actual earthquake.", "Fourteen dollars. The straw is free. The straw is judging you.", "Here you go. Sip slowly, it's the most expensive soft drink in Canterbury."])); }
        break;
      case "bouncer": this.say(pick(STRIP_JOKES.filter((j) => j.startsWith("BOUNCER|")))); break;
      case "doorman": this.say("DOORMAN|" + (this.isMember() && Math.random() < 0.4 ? `${this.host.playerName()}! Always a pleasure. Mostly a pleasure.` : pick(VELVET_LINES))); break;
      default: if (id.startsWith("door")) this.openDoor(Number(id.slice(4)));
    }
    this.render();
  }

  private openDoor(i: number): void {
    if (this.opening >= 0 || this.card) return;
    if (i >= 2 && !this.isMember()) { this.say("DOORMAN|" + pick(["Members only beyond the rope. That door has been reserved since 1887.", "I'm afraid that room requires a membership and a monocle. You have neither.", "Non-members may look at the rope. Admire the rope. The rope is lovely."])); return; }
    if (this.reduce) { this.card = { door: i, room: this.doors[i] }; this.render(); return; }
    this.opening = i; this.openT = this.now;
  }
  private shutDoor(): void {
    if (!this.card) return;
    const used = this.card.door; this.roomDeck.push(this.doors[used]);
    this.doors[used] = this.roomDeck.shift()!;
    this.card = null; this.render();
  }

  // ------------------------------------------------------------------ DOM
  private render(): void {
    const strip = this.venue === "strip";
    this.live = {};
    const cash = h("b", { text: money(this.host.getCash()) }); this.live.cash = cash;
    const head = h("header.cl-head", null, [
      h("div", null, [
        h("h2", { text: strip ? "The Pink Pukeko" : "The Velvet Rooms" }),
        h("p.cl-sub", { text: strip ? (this.ownsClub() ? `Proprietor: ${this.host.playerName()} · adults only · all cash is in-game` : "Prop. Sir Ponsonby Velvet · adults only · all cash is in-game") : `Est. 1887 · Sir Ponsonby Velvet, proprietor${this.isMember() ? " · Member" : ""}` }),
      ]),
      h("div.cl-bank", null, [h("span", { text: "Wallet" }), cash]),
      h("button.cl-x", { "aria-label": "Leave (Escape)", onclick: () => this.close(), text: "×" }),
    ]);
    const stage = h("div.cl-stage", null, [this.cv, this.card ? this.cardEl() : null]);
    const panel = strip ? this.stripPanel() : this.velvetPanel();
    const spotBtns = h("div.cl-row", null, this.spots().map((s) => h("button.cl-btn.sm", { onclick: () => this.activate(s.id), text: s.label + (s.id === "dj" ? " · request $50" : s.id === "bar" ? " · L&P $14" : "") })));
    this.el.replaceChildren(h("div.cl-frame." + (strip ? "pink" : "velvet"), null, [head, stage, this.tickerEl, spotBtns, panel,
      h("footer.cl-foot", { text: strip ? "All performers are fictional adult stick figures. Nobody is ever unclothed; the sequins are load-bearing." : "Nothing is ever shown. Everything is implied. Sir Ponsonby's lawyers insist." })]));
  }

  private stripPanel(): HTMLElement {
    const cash = this.host.getCash();
    const gunBox: (HTMLElement | null)[] = [h("h3", { text: "Make It Rain" })];
    if (!this.host.owned(KEY.gun)) {
      gunBox.push(h("p.cl-note", { text: "A pink money gun: point at the stage and fire banknotes. Financially ruinous, visually spectacular." }),
        h("button.cl-btn.hot", { disabled: cash < GUN_PRICE, onclick: () => { if (this.pay(GUN_PRICE, "the money gun")) { this.host.setOwned(KEY.gun, true); this.host.toast("Money gun acquired. Your financial adviser has started drinking."); this.say("DJ|Oh, we got a MONEY GUN in the house! Load it up!"); this.render(); } } }, [`Buy money gun · ${money(GUN_PRICE)}`]));
    } else {
      const mag = h("b", { text: money(this.mag) }), spent = h("b", { text: money(this.spent) });
      const fill = h("i"), num = h("span.cl-combonum", { text: "x1" });
      Object.assign(this.live, { mag, spent, combo: fill, comboNum: num });
      const load = (n: number) => h("button.cl-btn", { disabled: cash < n, onclick: () => { if (this.pay(n, "ammo")) { this.mag += n; this.render(); } } }, [`Load ${money(n)}`]);
      const spray = h("button.cl-btn.hot.big", { "aria-label": "Hold to spray cash at the stage (Space or Enter while focused)" }, ["Hold to spray"]);
      const on = () => { if (this.canSpray()) { this.firing = true; this.aimByPointer = false; } else this.say("DJ|Your money gun's empty! Load it up, legend!"); };
      const off = () => { this.firing = false; };
      spray.addEventListener("pointerdown", (e) => { e.preventDefault(); on(); });
      spray.addEventListener("pointerup", off); spray.addEventListener("pointerleave", off);
      spray.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); on(); } });
      spray.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") off(); });
      gunBox.push(
        h("div.cl-stats", null, [h("span", { text: "Loaded" }), mag, h("span", { text: "Sprayed tonight" }), spent]),
        h("div.cl-row", null, [load(100), load(1_000), load(10_000)]),
        h("div.cl-row", { role: "group", "aria-label": "Note" }, NOTES.map((n) => h("button.cl-note-btn" + (this.note === n.v ? ".on" : ""), { style: `--c:${n.c}`, "aria-pressed": String(this.note === n.v), onclick: () => { this.note = n.v; this.render(); } }, [`$${n.v} notes`]))),
        spray,
        h("div.cl-combo", { "aria-hidden": "true" }, [h("span", { text: "Combo" }), h("div.cl-track", null, [fill]), num]),
        h("p.cl-note", { text: "Or press and hold anywhere on the stage. Keep spraying to build the combo." }),
      );
    }
    const own: (HTMLElement | null)[] = [h("h3", { text: "Blow money, make money" })];
    if (!this.ownsClub()) {
      own.push(h("p.cl-note", { text: "Sir Ponsonby Velvet won the Pukeko in a croquet match and has 'grown bored of neon'. He'll sell for the right price." }),
        h("button.cl-btn.gold", { disabled: cash < CLUB_PRICE, onclick: () => this.buyClub() }, [`Buy the club · ${money(CLUB_PRICE)}`]));
    } else {
      const till = h("b", { text: money(this.till) }); this.live.till = till;
      own.push(h("div.cl-stats", null, [h("span", { text: "In the till" }), till, h("span", { text: "Income" }), h("b", { text: `${money(this.income())}/s` })]),
        h("button.cl-btn.gold", { onclick: () => this.collect() }, ["Collect takings"]),
        h("p.cl-note", { text: `${Math.round(BANKED_SHARE * 100)}% of takings bank straight to your wallet; the rest piles up in the till. Sprayed cash comes back ${Math.round(HOUSE_CUT * 100)}% as the house cut.` }),
        h("ul.cl-ups", null, UPGRADES.map((u) => h("li", null, [
          h("div", null, [h("b", { text: u.name }), h("span", { text: ` +${money(u.inc)}/s · ${u.blurb}` })]),
          this.hasUp(u.id) ? h("span.cl-owned", { text: "Installed" }) : h("button.cl-btn.sm", { disabled: cash < u.cost, onclick: () => this.buyUp(u.id) }, [money(u.cost)]),
        ]))));
    }
    return h("div.cl-panels", null, [h("section.cl-box", null, gunBox), h("section.cl-box", null, own),
      h("section.cl-box.small", null, [h("h3", { text: "Tonight" }), h("p.cl-note", { text: "Fridays: the Famiglia in the VIP. Tuesdays: Roastie Malone, live and merciless." }), h("button.cl-btn.sm", { onclick: () => this.show("velvet") }, ["Sir Ponsonby's other place: The Velvet Rooms"])])]);
  }

  private velvetPanel(): HTMLElement {
    const member = this.isMember();
    return h("div.cl-panels", null, [
      h("section.cl-box", null, [h("h3", { text: "Membership" }),
        member ? h("p.cl-note", { text: `Member in good standing: ${this.host.playerName()}. Monocle issued. All doors open to you. Most of them regret it.` })
          : h("p.cl-note", { text: "Non-members may open the first two doors. Members get every door, a monocle, and a doorman who pretends to remember them." }),
        member ? null : h("button.cl-btn.gold", { disabled: this.host.getCash() < MEMBER_PRICE, onclick: () => this.buyMembership() }, [`Join · ${money(MEMBER_PRICE)}`])]),
      h("section.cl-box.small", null, [h("h3", { text: "Elsewhere" }), h("button.cl-btn.sm", { onclick: () => this.show("strip") }, ["Back to the Pink Pukeko"])]),
    ]);
  }

  private cardEl(): HTMLElement {
    const c = this.card!;
    return h("div.cl-card", { role: "dialog", "aria-label": c.room.name }, [
      h("p.cl-card-k", { text: `Door ${c.door + 1}` }), h("h3", { text: c.room.name }), h("p", { text: c.room.gag }),
      h("button.cl-btn.gold", { onclick: () => this.shutDoor() }, ["Close the door quietly"]),
    ]);
  }

  private buyClub(): void {
    if (!this.pay(CLUB_PRICE, "the Pink Pukeko")) return;
    this.host.setOwned(KEY.club, true);
    this.host.toast("You bought the Pink Pukeko! Sir Ponsonby signed it over with a quill and a single tear.");
    this.say(OWNER_LINES[0]); this.say("BOUNCER|New boss. Same rules. Shoes, ID, positive attitude.");
    this.render();
  }
  private buyUp(id: string): void {
    const u = UPGRADES.find((x) => x.id === id)!;
    if (!this.pay(u.cost, u.name)) return;
    this.host.setOwned("club.up." + id, true);
    this.host.toast(`${u.name} installed. Income now ${money(this.income())}/s.`);
    this.say(id === "stage" ? "MC|Bigger stage! Please welcome Destiny and Pearl, who've been waiting in the car park since March!" : id === "smoke" ? "DJ|Smoke machine's on! I can't see my decks! PERFECTION!" : "DJ|DJ Hokey Pokey in the house! Vanilla beats with chunks of toffee!");
    this.render();
  }
  private collect(): void {
    if (this.till < 1) { this.host.toast("The till's empty. The bartender has checked the couch cushions."); return; }
    this.host.setCash(this.host.getCash() + this.till);
    this.host.toast(`Collected ${money(this.till)} from the Pink Pukeko till. Some of it is slightly damp. Don't ask.`);
    this.till = 0; this.render();
  }
  private buyMembership(): void {
    if (!this.pay(MEMBER_PRICE, "a Velvet Rooms membership")) return;
    this.host.setOwned(KEY.member, true);
    this.host.toast("Monocle unlocked! You now look 40% more likely to own a racehorse.");
    this.say(`DOORMAN|Welcome, ${this.host.playerName()}. Your monocle, your key, and our sincerest discretion.`);
    this.render();
  }

  // ------------------------------------------------------------------ loop
  private loop = (ms: number): void => {
    if (!this.open) return;
    const dt = Math.min(0.05, (ms - this.last) / 1000); this.last = ms; this.now = ms / 1000;
    this.updateTalk();
    if (this.venue === "strip") { this.updateGun(dt); this.drawStrip(this.reduce ? 0 : this.now); } else this.drawVelvet(this.reduce ? 0 : this.now);
    this.drawBubbles();
    this.raf = requestAnimationFrame(this.loop);
  };

  private updateTalk(): void {
    while (this.queue.length && this.queue[0].at <= this.now) {
      const q = this.queue.shift()!; const p = this.speakerAt(q.who);
      this.bubbles = this.bubbles.filter((b) => b.who !== q.who).slice(-2);
      this.bubbles.push({ who: q.who, text: q.text, x: p.x, y: p.y, until: this.now + 2.4 + q.text.length * 0.035 });
      const label = q.who === "DJ" ? this.djName() : q.who === "PATRON" ? "Patron" : q.who.charAt(0) + q.who.slice(1).toLowerCase();
      this.tickerEl.replaceChildren(h("b", { text: label + ": " }), q.text);
    }
    this.bubbles = this.bubbles.filter((b) => b.until > this.now);
    if (this.now > this.nextAmbient && !this.queue.length) {
      if (this.venue === "strip") { if (!this.deck.length) this.deck = shuffle(STRIP_JOKES); this.say(this.deck.pop()!); }
      else this.say("DOORMAN|" + pick(VELVET_LINES));
      this.nextAmbient = this.now + 6 + Math.random() * 4;
    }
  }

  private updateGun(dt: number): void {
    if (this.firing && !this.aimByPointer) this.aim = { x: W / 2 + Math.sin(this.now * 1.3) * 160, y: 250 + Math.sin(this.now * 2.1) * 30 };
    if (this.firing) {
      this.fireAcc += dt * 12;
      while (this.fireAcc >= 1) {
        this.fireAcc -= 1;
        if (this.mag < this.note) { this.firing = false; this.say("DJ|Out of ammo! The rain has stopped! Somebody fetch an ATM!"); break; }
        this.mag -= this.note; this.spent += this.note;
        if (this.ownsClub()) this.till += this.note * HOUSE_CUT;
        this.combo = Math.min(100, this.combo + 1.4 + this.note / 100);
        this.spawnBill();
      }
    } else this.combo = Math.max(0, this.combo - dt * 16);
    const tier = Math.floor(this.combo / 25);
    if (tier > this.tier) { this.say("DJ|" + pick(RAIN_SHOUTS)); if (tier >= 3) this.say("PATRON|" + pick(["WOOOO!", "Chur! Chur! Chur!", "Somebody stop them! No, don't!", "That's my rent money! Worth it!"])); }
    this.tier = tier;
    this.hype += ((this.combo / 100) - this.hype) * Math.min(1, dt * 3);
    // particles
    const grav = 520;
    for (const b of this.bills) {
      b.age += dt;
      if (!b.landed) {
        b.vy += grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        if (b.age >= b.fly) { b.landed = true; b.vx = (Math.random() - 0.5) * 30; b.vy = 25 + Math.random() * 25; this.tip(b); }
      } else if (!b.done) {
        b.x += (b.vx + (this.reduce ? 0 : Math.sin(b.age * 5 + b.r) * 40)) * dt; b.y += b.vy * dt; b.r += (this.reduce ? 0 : Math.sin(b.age * 3) * 2) * dt;
        if (b.y > 330 && b.ty < 330 || b.y > 470) b.done = true;
      }
    }
    if (this.bills.length > (this.reduce ? 120 : 420)) this.bills.splice(0, this.bills.length - (this.reduce ? 120 : 420));
    this.bills = this.bills.filter((b) => b.age < 9);
    for (const f of this.floaties) { f.age += dt; f.y -= dt * 30; }
    this.floaties = this.floaties.filter((f) => f.age < 1.2);
    for (const d of this.dancers) d.hit = Math.max(0, d.hit - dt);
    if (this.live.mag) {
      this.live.mag.textContent = money(this.mag); this.live.spent!.textContent = money(this.spent);
      this.live.combo!.style.width = this.combo.toFixed(1) + "%"; this.live.comboNum!.textContent = "x" + (1 + this.tier);
    }
    if (this.live.till) this.live.till.textContent = money(this.till);
    if (this.live.cash) this.live.cash.textContent = money(this.host.getCash());
  }

  private spawnBill(): void {
    const n = NOTES.find((x) => x.v === this.note)!;
    const x = W / 2 + (Math.random() - 0.5) * 20, y = H - 18, T = 0.45 + Math.random() * 0.2;
    const tx = this.aim.x + (Math.random() - 0.5) * 70, ty = this.aim.y + (Math.random() - 0.5) * 50;
    this.bills.push({ x, y, tx, ty, vx: (tx - x) / T, vy: (ty - y) / T - 0.5 * 520 * T, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18, age: 0, fly: T, col: n.c, landed: false, done: false, v: n.v });
  }

  private tip(b: Bill): void {
    let best: { d: Dancer; x: number; y: number } | null = null, bd = 55;
    for (const p of this.dancerPos) { const d = Math.hypot(p.x - b.x, p.y - 30 - b.y); if (d < bd) { bd = d; best = p; } }
    if (!best) return;
    best.d.hit = 0.5; best.d.tips += b.v;
    if (Math.random() < 0.25) this.floaties.push({ x: best.x, y: best.y - 70, text: "+$" + b.v, age: 0, col: b.col });
  }

  // ------------------------------------------------------------------ drawing
  private begin(): CanvasRenderingContext2D { const g = this.g; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.shadowBlur = 0; g.globalAlpha = 1; g.textAlign = "center"; g.lineCap = "round"; g.lineJoin = "round"; return g; }

  private neonText(text: string, x: number, y: number, size: number, col: string, t: number, font = "'Big Shoulders Display', Impact, sans-serif"): void {
    const g = this.g;
    g.font = `900 ${size}px ${font}`; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = this.reduce ? 8 : 12 + Math.sin(t * 3) * 4;
    g.fillText(text, x, y); g.shadowBlur = 0;
  }

  /** A neon stick figure in a pose, feet at (x, y). */
  private fig(x: number, y: number, pose: number[], col: string, o: { hat?: boolean; boa?: boolean; sequins?: boolean; fedora?: boolean; tophat?: boolean; shades?: boolean; headphones?: boolean; monocle?: boolean; skirt?: boolean; s?: number; t?: number; mic?: boolean } = {}): void {
    const g = this.g, s = o.s ?? 1, t = o.t ?? 0;
    const [lsa, lea, rsa, rea, lha, lka, rha, rka, lean, hop] = pose;
    const hip = { x, y: y - 26 * s - hop };
    const up = { x: Math.sin(lean), y: -Math.cos(lean) };
    const sh = { x: hip.x + up.x * 22 * s, y: hip.y + up.y * 22 * s };
    const head = { x: sh.x + up.x * 9 * s, y: sh.y + up.y * 9 * s };
    const limb = (b: { x: number; y: number }, a1: number, a2: number, l1: number, l2: number) => {
      const p1 = { x: b.x + Math.sin(a1) * l1 * s, y: b.y + Math.cos(a1) * l1 * s };
      const p2 = { x: p1.x + Math.sin(a1 + a2) * l2 * s, y: p1.y + Math.cos(a1 + a2) * l2 * s };
      g.moveTo(b.x, b.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); return p2;
    };
    g.strokeStyle = col; g.lineWidth = 3 * s; g.shadowColor = col; g.shadowBlur = this.reduce ? 3 : 6;
    g.beginPath(); g.arc(head.x, head.y, 7 * s, 0, 6.283); g.stroke();
    g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(sh.x, sh.y);
    limb(sh, lsa, lea, 12, 11); const rh = limb(sh, rsa, rea, 12, 11);
    limb(hip, lha, lka, 13, 13); limb(hip, rha, rka, 13, 13); g.stroke(); g.shadowBlur = 0;
    if (o.sequins || o.skirt) { // a sparkly cartoon dress/leotard
      g.fillStyle = col + "66"; g.beginPath(); g.moveTo(sh.x - 5 * s, sh.y + 3 * s); g.lineTo(sh.x + 5 * s, sh.y + 3 * s); g.lineTo(hip.x + 9 * s, hip.y + 5 * s); g.lineTo(hip.x - 9 * s, hip.y + 5 * s); g.closePath(); g.fill();
      if (o.sequins) for (let k = 0; k < 7; k++) { const f = k / 7; g.fillStyle = ((Math.floor(t * 8) + k) % 3) ? "#fff7ea" : col; g.fillRect(sh.x + (hip.x - sh.x) * f + Math.sin(k * 2.3) * 5 * s - 1, sh.y + (hip.y - sh.y) * f + 2, 2, 2); }
    }
    if (o.boa) { g.fillStyle = "#ff9ad5"; for (let k = 0; k <= 12; k++) { const f = k / 12, a = -1.2 + f * 2.4; g.beginPath(); g.arc(sh.x + Math.sin(a) * 9 * s + Math.sin(t * 4 + k) * 1.5, sh.y + Math.cos(a) * 6 * s + (Math.abs(f - 0.5) * 18 * s), 2.6 * s, 0, 6.283); g.fill(); } }
    if (o.hat) { g.fillStyle = "#c98a3a"; g.beginPath(); g.ellipse(head.x, head.y - 6 * s, 13 * s, 3 * s, 0, 0, 6.283); g.fill(); g.fillRect(head.x - 6 * s, head.y - 14 * s, 12 * s, 8 * s); }
    if (o.fedora) { g.fillStyle = "#2b2b33"; g.strokeStyle = "#eee4d3"; g.lineWidth = 1; g.beginPath(); g.ellipse(head.x, head.y - 6 * s, 11 * s, 2.5 * s, 0, 0, 6.283); g.fill(); g.fillRect(head.x - 6 * s, head.y - 13 * s, 12 * s, 7 * s); g.strokeRect(head.x - 6 * s, head.y - 8 * s, 12 * s, 1.5); }
    if (o.tophat) { g.fillStyle = "#111"; g.strokeStyle = "#e7c46a"; g.lineWidth = 1; g.fillRect(head.x - 10 * s, head.y - 8 * s, 20 * s, 2.5 * s); g.fillRect(head.x - 6 * s, head.y - 22 * s, 12 * s, 14 * s); g.strokeRect(head.x - 6 * s, head.y - 12 * s, 12 * s, 2); }
    if (o.shades) { g.fillStyle = "#0b0b0b"; g.fillRect(head.x - 6 * s, head.y - 2 * s, 12 * s, 3.5 * s); }
    if (o.headphones) { g.strokeStyle = "#3dd6ff"; g.lineWidth = 2.5; g.beginPath(); g.arc(head.x, head.y, 10 * s, Math.PI, 0); g.stroke(); g.fillStyle = "#3dd6ff"; g.fillRect(head.x - 11 * s, head.y - 2, 4, 7); g.fillRect(head.x + 7 * s, head.y - 2, 4, 7); }
    if (o.monocle) { g.strokeStyle = "#f6d77c"; g.lineWidth = 1.5; g.beginPath(); g.arc(head.x + 3 * s, head.y - 1, 3.2 * s, 0, 6.283); g.stroke(); g.beginPath(); g.moveTo(head.x + 3 * s, head.y + 2.5 * s); g.quadraticCurveTo(head.x + 8 * s, head.y + 10 * s, sh.x + 4, sh.y + 8); g.stroke(); }
    if (o.mic) { g.fillStyle = "#eee4d3"; g.beginPath(); g.arc(rh.x, rh.y - 4, 3, 0, 6.283); g.fill(); }
  }

  private poseOf(d: Dancer, t: number): number[] {
    const k = t * d.speed * (1 + this.hype * 0.8) + d.x * 0.01, n = d.seq.length;
    const i = Math.floor(k) % n, f0 = k - Math.floor(k), f = this.reduce ? 0 : f0 * f0 * (3 - 2 * f0);
    const a = POSES[d.seq[i]], b = POSES[d.seq[(i + 1) % n]];
    return a.map((v, j) => v + (b[j] - v) * f);
  }

  private drawStrip(t: number): void {
    const g = this.begin(), big = this.hasUp("stage"), smoke = this.hasUp("smoke"), hype = this.hype;
    // walls & floor
    const wall = g.createLinearGradient(0, 0, 0, 120); wall.addColorStop(0, "#1f0719"); wall.addColorStop(1, "#0d0410");
    g.fillStyle = wall; g.fillRect(0, 0, W, 120); g.fillStyle = "#120812"; g.fillRect(0, 120, W, H - 120);
    g.strokeStyle = "rgba(255,79,163,.06)"; g.lineWidth = 1;
    for (let x = -H; x < W; x += 34) { g.beginPath(); g.moveTo(x, 120); g.lineTo(x + H, H + 120); g.moveTo(x + H, 120); g.lineTo(x, H + 120); g.stroke(); }
    // sign + pukeko
    this.neonText("THE PINK PUKEKO", W / 2 + 20, 60, 42, "#ff4fa3", t);
    g.save(); g.translate(W / 2 - 205, 46); g.shadowBlur = 10; g.shadowColor = "#3d7bff"; g.strokeStyle = "#3d7bff"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, 16, 11, -0.3, 0, 6.283); g.stroke(); g.beginPath(); g.arc(14, -14, 6, 0, 6.283); g.stroke();
    g.strokeStyle = "#ff2d3d"; g.shadowColor = "#ff2d3d"; g.beginPath(); g.moveTo(19, -16); g.lineTo(29, -12); g.lineTo(19, -10); g.stroke();
    g.strokeStyle = "#ff7a3d"; g.shadowColor = "#ff7a3d"; g.beginPath(); g.moveTo(-2, 10); g.lineTo(-4, 24); g.moveTo(5, 10); g.lineTo(7, 24); g.stroke(); g.restore();
    g.shadowBlur = 0;
    this.neonText(this.ownsClub() ? `UNDER NEW MANAGEMENT: ${this.host.playerName().toUpperCase()}` : "EST. BY SIR PONSONBY VELVET · NO JANDALS", W / 2, 96, 15, this.ownsClub() ? "#3dd6ff" : "#f6b62c", t + 1, "'IBM Plex Mono', monospace");
    // light beams
    const sx0 = big ? 250 : 300, sx1 = big ? 710 : 660;
    for (let k = 0; k < 4; k++) {
      const a = this.reduce ? (k - 1.5) * 0.25 : Math.sin(t * (0.7 + k * 0.2) + k) * 0.5, ox = 200 + k * 190;
      g.fillStyle = NEON[k] + (hype > 0.5 ? "2a" : "16"); g.beginPath(); g.moveTo(ox, 110); g.lineTo(ox + Math.sin(a) * 300 - 60, 330); g.lineTo(ox + Math.sin(a) * 300 + 60, 330); g.closePath(); g.fill();
    }
    // stage
    const st = g.createLinearGradient(0, 230, 0, 330); st.addColorStop(0, "#3a0f3a"); st.addColorStop(1, "#7a1f6a");
    g.fillStyle = st; g.beginPath(); g.moveTo(sx0 + 40, 235); g.lineTo(sx1 - 40, 235); g.lineTo(sx1 + 20, 330); g.lineTo(sx0 - 20, 330); g.closePath(); g.fill();
    g.fillStyle = "#24071f"; g.fillRect(sx0 - 20, 330, sx1 - sx0 + 40, 18);
    for (let x = sx0 - 14; x < sx1 + 20; x += 14) { const on = this.reduce ? (x % 28 === 0) : (Math.floor(t * 8 - x / 14) % 4 === 0); g.fillStyle = on ? "#ff4fa3" : "#5a1a4a"; g.beginPath(); g.arc(x, 339, 2.5, 0, 6.283); g.fill(); }
    const poleG = g.createLinearGradient(476, 0, 484, 0); poleG.addColorStop(0, "#777"); poleG.addColorStop(0.5, "#fff"); poleG.addColorStop(1, "#888");
    g.fillStyle = poleG; g.fillRect(477, 110, 6, 190);
    // dancers
    this.dancerPos = [];
    for (const d of this.dancers) {
      if (d.needsStage && !big) continue;
      let x = d.x, y = 300;
      if (d.pole) { x = 480 + (this.reduce ? -10 : Math.sin(t * 1.4) * 14); y = 292 - (this.reduce ? 0 : (Math.sin(t * 0.7) * 0.5 + 0.5) * 50); }
      else if (!this.reduce) x += Math.sin(t * 0.5 + d.x) * 14;
      const pose = d.pole ? this.poseOf(d, t).map((v, j) => (j === 2 ? (x < 480 ? 2.6 : 3.4) : v)) : this.poseOf(d, t);
      if (d.hit > 0) { pose[9] += d.hit * 8; pose[0] = -2.6; }
      this.fig(x, y, pose, d.col, { hat: d.hat, boa: d.boa, sequins: d.sequins, skirt: true, t });
      if (d.hit > 0 && !this.reduce) for (let k = 0; k < 4; k++) { const a = t * 6 + k * 1.6; g.fillStyle = "#fff7ea"; g.fillRect(x + Math.cos(a) * 22, y - 50 + Math.sin(a) * 22, 2, 2); }
      this.dancerPos.push({ d, x, y });
    }
    if (smoke) for (let k = 0; k < 7; k++) { const sx = sx0 + ((k * 83 + (this.reduce ? 0 : t * 18)) % (sx1 - sx0)); const gr = g.createRadialGradient(sx, 318, 0, sx, 318, 60); gr.addColorStop(0, "rgba(220,200,255,.16)"); gr.addColorStop(1, "rgba(220,200,255,0)"); g.fillStyle = gr; g.fillRect(sx - 60, 258, 120, 120); }
    // MC
    this.fig(250, 330, POSES[2].map((v, j) => (j === 2 ? 2.2 : v)), "#eee4d3", { mic: true, t });
    // DJ booth
    g.fillStyle = "#1c0c24"; g.fillRect(30, 210, 170, 42); g.strokeStyle = "#3dd6ff"; g.lineWidth = 2; g.strokeRect(30, 210, 170, 42);
    const djPose = this.reduce ? POSES[0] : POSES[Math.floor(t * 2) % 2 ? 0 : 4];
    this.fig(115, 236, djPose, "#c6ff3d", { headphones: true, shades: this.hasUp("dj"), t });
    g.fillStyle = "#1c0c24"; g.fillRect(30, 214, 170, 38); g.strokeStyle = "#3dd6ff"; g.strokeRect(30, 214, 170, 38);
    for (const cx of [70, 160]) { g.fillStyle = "#0b0b0b"; g.beginPath(); g.arc(cx, 224, 13, 0, 6.283); g.fill(); g.strokeStyle = "#3dd6ff"; g.lineWidth = 1; g.beginPath(); g.arc(cx, 224, 13, t * 4, t * 4 + 1.2); g.stroke(); }
    g.fillStyle = "#3dd6ff"; g.font = "800 13px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(this.djName(), 115, 246);
    // VIP booth with the Famiglia
    g.fillStyle = "#2a0f36"; g.beginPath(); g.roundRect(770, 175, 165, 70, 30); g.fill();
    this.fig(800, 236, POSES[8], "#eee4d3", { fedora: true, s: 0.9 }); this.fig(850, 236, POSES[1], "#ffd27a", { fedora: true, s: 0.9 }); this.fig(900, 236, POSES[8], "#eee4d3", { fedora: true, s: 0.9 });
    g.fillStyle = "#4a1650"; g.beginPath(); g.roundRect(770, 222, 165, 24, 10); g.fill();
    g.strokeStyle = "#e7c46a"; g.lineWidth = 3; g.beginPath(); g.moveTo(762, 262); g.quadraticCurveTo(850, 285, 942, 262); g.stroke();
    g.fillStyle = "#e7c46a"; g.fillRect(758, 240, 6, 30); g.fillRect(940, 240, 6, 30);
    g.font = "700 11px 'IBM Plex Mono', monospace"; g.fillText("VIP · FAMIGLIA (AND FRIENDS)", 852, 160);
    // bar
    g.fillStyle = "#24101a"; g.fillRect(20, 360, 230, 20);
    for (let k = 0; k < 9; k++) { g.fillStyle = NEON[k % NEON.length] + "aa"; g.fillRect(30 + k * 24, 344 - (k % 3) * 4, 8, 16 + (k % 3) * 4); }
    this.fig(135, 438, this.reduce ? POSES[1] : POSES[Math.floor(t) % 2 ? 1 : 4], "#ff7a3d", { t });
    g.fillStyle = "#3a1a10"; g.fillRect(20, 400, 230, 70); g.fillStyle = "#6b3a12"; g.fillRect(14, 396, 242, 8);
    g.fillStyle = "#ff4fa3"; g.font = "800 14px 'Big Shoulders Display', Impact, sans-serif"; g.fillText("BAR · L&P $14", 135, 440);
    // door & bouncer
    g.fillStyle = "#1a0a14"; g.fillRect(880, 300, 66, 170); g.strokeStyle = "#c6ff3d"; g.lineWidth = 2; g.strokeRect(880, 300, 66, 170);
    g.fillStyle = "#3dd6a0"; g.font = "800 12px monospace"; g.fillText("EXIT", 913, 292);
    this.fig(842, 472, POSES[8], "#eee4d3", { shades: true, s: 1.45 });
    // crowd, cheering with hype
    for (const p of this.patrons) {
      const bounce = this.reduce ? 0 : Math.abs(Math.sin(t * 5 + p.ph)) * hype * 6;
      const pose = hype > 0.3 && (Math.sin(t * 3 + p.ph) > -0.2 || this.reduce) ? POSES[0] : POSES[8];
      this.fig(p.x, 498 - bounce, pose, p.col, { s: 0.95 });
    }
    // the player with the money gun
    if (this.host.owned(KEY.gun)) { g.fillStyle = "#ff4fa3"; g.beginPath(); g.roundRect(W / 2 - 9, H - 30, 18, 12, 3); g.fill(); g.fillRect(W / 2 - 3, H - 20, 6, 10); }
    // bills
    for (const b of this.bills) {
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.globalAlpha = b.age > 7 ? Math.max(0, 9 - b.age) / 2 : 1;
      g.fillStyle = b.col; g.fillRect(-8, -4, 16, 8); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(-5, -2, 10, 4); g.restore();
    }
    g.globalAlpha = 1;
    for (const f of this.floaties) { g.globalAlpha = 1 - f.age / 1.2; g.fillStyle = f.col; g.font = "900 16px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(f.text, f.x, f.y); }
    g.globalAlpha = 1;
    if (this.tier > 0) this.neonText(`x${this.tier + 1} HYPE`, W / 2, 200, 26 + this.tier * 4, NEON[this.tier % NEON.length], t * 3);
    this.drawSpots(t);
  }

  private drawVelvet(t: number): void {
    const g = this.begin(), member = this.isMember();
    g.fillStyle = "#4a0d1c"; g.fillRect(0, 0, W, 360);
    g.fillStyle = "rgba(231,196,106,.07)";
    for (let y = 30; y < 330; y += 36) for (let x = (y / 36) % 2 ? 18 : 0; x < W; x += 36) { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 6, y); g.lineTo(x, y + 8); g.lineTo(x - 6, y); g.closePath(); g.fill(); }
    g.fillStyle = "#e7c46a"; g.fillRect(0, 18, W, 3); g.fillStyle = "#2a130b"; g.fillRect(0, 300, W, 80);
    g.strokeStyle = "rgba(231,196,106,.35)"; g.lineWidth = 1; for (let x = 10; x < W; x += 80) g.strokeRect(x, 312, 64, 56);
    const carpet = g.createLinearGradient(0, 380, 0, H); carpet.addColorStop(0, "#5a0f1a"); carpet.addColorStop(1, "#2c050c");
    g.fillStyle = carpet; g.fillRect(0, 380, W, H - 380); g.strokeStyle = "#e7c46a"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 410); g.lineTo(W, 410); g.moveTo(0, 480); g.lineTo(W, 480); g.stroke();
    for (const cx of [260, 520, 780]) {
      g.strokeStyle = "rgba(231,196,106,.5)"; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, 40); g.stroke();
      for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.283 + t * 0.15; g.fillStyle = `rgba(255,236,170,${0.6 + 0.4 * Math.sin(t * 2 + k)})`; g.beginPath(); g.arc(cx + Math.cos(a) * 30, 50 + Math.sin(a) * 8, 3, 0, 6.283); g.fill(); }
      const gr = g.createRadialGradient(cx, 55, 0, cx, 55, 190); gr.addColorStop(0, "rgba(255,220,150,.15)"); gr.addColorStop(1, "rgba(255,220,150,0)"); g.fillStyle = gr; g.fillRect(cx - 190, 0, 380, 300);
    }
    this.neonText("THE VELVET ROOMS", W / 2, 110, 34, "#f6d77c", t * 0.3, "'Instrument Serif', Georgia, serif");
    g.font = "italic 14px 'Instrument Serif', Georgia, serif"; g.fillStyle = "rgba(246,215,124,.7)"; g.fillText("Discretion · Decorum · Doilies", W / 2, 130);
    this.doors.forEach((r, i) => {
      const x = 190 + i * 125, y = 150, w = 84, hh = 180;
      g.fillStyle = "#e7c46a"; g.fillRect(x - 5, y - 5, w + 10, hh + 5);
      g.fillStyle = "#0a0204"; g.fillRect(x, y, w, hh);
      let p = 0;
      if (this.opening === i) p = clamp((this.now - this.openT) / 0.45, 0, 1);
      if (this.card?.door === i) p = 1;
      if (p > 0) { const gl = g.createRadialGradient(x + w / 2, y + hh / 2, 0, x + w / 2, y + hh / 2, 70); gl.addColorStop(0, `rgba(255,190,120,${0.35 * p})`); gl.addColorStop(1, "rgba(255,190,120,0)"); g.fillStyle = gl; g.fillRect(x, y, w, hh); }
      const dw = w * (1 - p * 0.85);
      g.fillStyle = "#4a2512"; g.fillRect(x, y, dw, hh);
      if (dw > 20) { g.strokeStyle = "rgba(231,196,106,.4)"; g.strokeRect(x + dw * 0.15, y + 14, dw * 0.7, 66); g.strokeRect(x + dw * 0.15, y + 96, dw * 0.7, 70); g.fillStyle = "#f6d77c"; g.beginPath(); g.arc(x + dw - 10, y + 92, 4, 0, 6.283); g.fill(); }
      g.fillStyle = "#e7c46a"; g.fillRect(x + w / 2 - 20, y - 26, 40, 16); g.fillStyle = "#2a130b"; g.font = "700 11px 'IBM Plex Mono', monospace"; g.fillText(`No. ${i + 1}`, x + w / 2, y - 14);
      g.fillStyle = this.hover === "door" + i ? "#c6ff3d" : "rgba(251,243,223,.85)"; g.font = "italic 14px 'Instrument Serif', Georgia, serif";
      this.wrap(r.name, 118).slice(0, 2).forEach((ln, k) => g.fillText(ln, x + w / 2, 350 + k * 15));
    });
    if (!member) {
      g.strokeStyle = "#b0182c"; g.lineWidth = 5; g.beginPath(); g.moveTo(430, 395); for (let k = 0; k < 4; k++) { const a = 430 + k * 125; g.quadraticCurveTo(a + 62, 420, a + 125, 395); } g.stroke();
      g.fillStyle = "#e7c46a"; for (let k = 0; k <= 4; k++) g.fillRect(426 + k * 125, 385, 8, 60);
      g.font = "700 11px 'IBM Plex Mono', monospace"; g.fillText("MEMBERS ONLY", 680, 462);
    }
    this.fig(80, 450, POSES[8], "#eee4d3", { tophat: true, s: 1.2 });
    this.fig(140, 460, POSES[1], "#c6ff3d", { monocle: member, s: 1.1 });
    if (this.opening >= 0) {
      const e = this.now - this.openT;
      if (e > 0.45) { g.fillStyle = `rgba(0,0,0,${clamp((e - 0.45) / 0.5, 0, 1)})`; g.fillRect(0, 0, W, H); }
      if (e > 0.95) { this.card = { door: this.opening, room: this.doors[this.opening] }; this.opening = -1; this.render(); }
    } else if (this.card) { g.fillStyle = "rgba(0,0,0,.85)"; g.fillRect(0, 0, W, H); }
    this.drawSpots(t);
  }

  private drawSpots(t: number): void {
    const g = this.g;
    for (const s of this.spots()) {
      const on = s.id === this.hover;
      if (!on && s.id.startsWith("door")) continue;
      g.strokeStyle = on ? "#c6ff3d" : "rgba(238,228,211,.14)"; g.lineWidth = on ? 2 + Math.sin(t * 6) * 0.5 : 1; g.setLineDash(on ? [] : [5, 6]);
      g.strokeRect(s.x, s.y, s.w, s.h); g.setLineDash([]);
    }
  }

  private wrap(text: string, maxW: number): string[] {
    const out: string[] = []; let cur = "";
    for (const w of text.split(" ")) { const tt = cur ? cur + " " + w : w; if (this.g.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; }
    if (cur) out.push(cur);
    return out;
  }

  private drawBubbles(): void {
    const g = this.g;
    g.font = "600 12px 'IBM Plex Mono', monospace";
    for (const b of this.bubbles) {
      const lines = this.wrap(b.text, 230), lw = Math.max(...lines.map((l) => g.measureText(l).width));
      const bw = lw + 18, bh = lines.length * 15 + 12, bx = clamp(b.x - bw / 2, 6, W - bw - 6), by = clamp(b.y - bh - 18, 6, H - bh - 6);
      const velvet = this.venue === "velvet";
      g.fillStyle = velvet ? "#fbf3df" : "#fff0fa"; g.strokeStyle = velvet ? "#e7c46a" : "#ff4fa3"; g.lineWidth = 2;
      g.beginPath(); g.roundRect(bx, by, bw, bh, 9); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(clamp(b.x - 6, bx + 8, bx + bw - 20), by + bh - 1); g.lineTo(clamp(b.x, bx + 10, bx + bw - 10), Math.min(b.y - 4, by + bh + 10)); g.lineTo(clamp(b.x + 6, bx + 20, bx + bw - 8), by + bh - 1); g.fill();
      g.fillStyle = "#1a0a14"; g.textAlign = "left";
      lines.forEach((l, i) => g.fillText(l, bx + 9, by + 18 + i * 15));
      g.textAlign = "center";
    }
  }
}
