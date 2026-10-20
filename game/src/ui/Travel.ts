import {DestinationConversation} from './DestinationConversation';
import {regionalInterior} from '../content/regionalInterior';
import {regionalFood} from '../content/regionalFood';
import {TOYS} from '../content/toys';
import {countryFor} from '../content/regions';
import { h } from "./dom";
import type {Character} from '../entities/types';
import {TravelRoom} from './TravelRoom';
import {airportRoom,LOUNGES,type LoungeId} from '../content/travelRooms';
import {DestinationDistrict,venueKind,type DistrictVisit} from './DestinationDistrict';
import {interiorForBuilding} from '../content/interiorVariety';
import {pose,solve,drawFigure} from '../render/StickFigure';
let travelCast:readonly Character[]=[];

/**
 * Christchurch Airport: a self-contained travel mini-experience.
 * Departures board -> check-in -> security x-ray -> flight -> destination -> arrivals home.
 * Procedural artwork over fetched OpenStreetMap geometry; optional bounded dialogue translation.
 */
export interface TravelHost {
  player():Character; people():readonly Character[];
  refresh?(kind:'rest'|'eat'):void;
  getCash(): number; setCash(v: number): void;
  /** the crew members who can come along: name + colour (hex) */
  companions(): { name: string; color: string }[];
  /** what the player is carrying (for the security x-ray) */
  carried(): { id: number; name: string; category: string }[];
  confiscate(ids: number[]): void;
  /** called when the trip ends, with a one-line summary and souvenirs bought (strings) */
  onReturn(summary: string, souvenirs: string[], photos: number): void;
  toast(text: string): void;
}

type Stage = "board" | "checkin" | "security" | "gate" | "flight" | "dest" | "return";
type G = CanvasRenderingContext2D;
interface Act { id: string; kind: "photo" | "eat" | "souvenir" | "fun"; label: string; cost: number; out: string; item?: string }
interface Dest { code: string; name: string; time: string; fare: number; lon: number; lat: number; sky: [string, string]; neon: string; tag: string; acts: Act[]; draw: (g: G, t: number) => void;country?:string }

const W = 960, H = 420, GROUND = 392;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-NZ");
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------ drawing helpers
function neon(g: G, color: string, width = 3, blur = 14): void { g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width; g.shadowColor = color; g.shadowBlur = blur; g.lineCap = "round"; g.lineJoin = "round"; }
function sky(g: G, a: string, b: string): void { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.shadowBlur = 0; g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function line(g: G, pts: number[]): void { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
function stars(g: G, t: number, n = 40): void { g.shadowBlur = 0; for (let i = 0; i < n; i++) { g.fillStyle = `rgba(238,228,211,${0.3 + 0.3 * Math.sin(t * 2 + i)})`; g.fillRect((i * 197) % W, (i * 83) % 170, 2, 2); } }

/** a neon stick figure, feet at (x, y), ~s px tall */
function stick(g: G, x: number, y: number, s: number, color: string, t: number, opts: { wave?: boolean; sit?: boolean; dir?: number } = {}): void {
  const c=(color==='#c6ff3d'?travelCast[0]:travelCast.find(c=>c.look.color===color))||travelCast[Math.abs(Math.round(x))%Math.max(1,travelCast.length)];
  if(c){const k=s/120,dir=opts.dir===-1?-1:1;solve(pose(opts.sit?'sit':opts.wave?'wave':'idle','normal',t,0,0,0),x,y,k,dir);drawFigure(g,c,x,y,k,dir,t,0,1);return;}
  const k = s / 70, sw = reduced() ? 0 : Math.sin(t * 3);
  neon(g, color, 3.2 * k, 10);
  const hip = y - (opts.sit ? 22 : 32) * k, neck = hip - 26 * k, head = neck - 10 * k;
  g.beginPath(); g.arc(x, head, 9 * k, 0, Math.PI * 2); g.stroke();
  line(g, [x, neck, x, hip]);
  if (opts.sit) { line(g, [x, hip, x + 18 * k * (opts.dir ?? 1), hip, x + 18 * k * (opts.dir ?? 1), y]); line(g, [x, hip, x + 14 * k * (opts.dir ?? 1), hip + 2 * k, x + 14 * k * (opts.dir ?? 1), y]); }
  else { line(g, [x, hip, x - (8 + 3 * sw) * k, y]); line(g, [x, hip, x + (8 - 3 * sw) * k, y]); }
  line(g, [x, neck + 5 * k, x - 14 * k, neck + 22 * k]);
  if (opts.wave) line(g, [x, neck + 5 * k, x + 12 * k, neck - 6 * k, x + 16 * k + 4 * sw * k, neck - 20 * k]);
  else line(g, [x, neck + 5 * k, x + 14 * k, neck + 22 * k]);
}

function palm(g: G, x: number, y: number, s: number, t: number, color: string): void {
  const sway = reduced() ? 0 : Math.sin(t * 1.2 + x) * 6;
  neon(g, color, 4, 10);
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - s * 0.5, x + sway, y - s); g.stroke();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.55; g.beginPath(); g.moveTo(x + sway, y - s); g.quadraticCurveTo(x + sway + Math.cos(a) * s * 0.35, y - s + Math.sin(a) * s * 0.35 - 10, x + sway + Math.cos(a) * s * 0.5, y - s + Math.sin(a) * s * 0.2 + 24); g.stroke(); }
}

// ------------------------------------------------------------------ the six scenes
function drawSydney(g: G, t: number): void {
  sky(g, "#070a24", "#1b0d36"); stars(g, t);
  g.fillStyle = "#06243a"; g.shadowBlur = 0; g.fillRect(0, 300, W, H - 300);
  neon(g, "#3dd6ff", 2, 6); for (let i = 0; i < 14; i++) { const y = 312 + i * 7, o = reduced() ? 0 : Math.sin(t + i) * 20; line(g, [120 + o + i * 9, y, 200 + o + i * 9, y]); line(g, [600 - o, y, 680 - o, y]); }
  g.shadowBlur = 0; g.fillStyle = "#14102a"; g.fillRect(0, 368, W, H - 368); neon(g, "#ff7ad9", 2, 8); line(g, [0, 368, W, 368]);
  // Harbour Bridge: arch, deck, hangers, pylons
  neon(g, "#3dd6ff", 3); g.beginPath(); g.moveTo(520, 262); g.quadraticCurveTo(710, 60, 900, 262); g.stroke();
  line(g, [470, 262, 960, 262]);
  for (let x = 545; x < 900; x += 25) { const u = (x - 520) / 380, yy = 262 - 4 * u * (1 - u) * 101; line(g, [x, yy, x, 262]); }
  g.lineWidth = 6; line(g, [500, 300, 500, 222]); line(g, [530, 300, 530, 222]); line(g, [890, 300, 890, 222]); line(g, [920, 300, 920, 222]);
  // Opera House sails
  neon(g, "#ff7ad9", 3); g.fillStyle = "rgba(255,122,217,.12)";
  line(g, [130, 300, 440, 300]);
  for (const [x, w, hh] of [[150, 90, 110], [215, 100, 150], [290, 95, 125], [350, 80, 90]] as const) {
    g.beginPath(); g.moveTo(x, 300); g.lineTo(x + w * 0.2, 300 - hh); g.quadraticCurveTo(x + w * 0.85, 300 - hh * 0.75, x + w, 300); g.closePath(); g.fill(); g.stroke();
  }
}

function drawTokyo(g: G, t: number): void {
  sky(g, "#0a0418", "#240b2c"); stars(g, t, 20);
  const signs = ["#ff7ad9", "#3dd6ff", "#c6ff3d", "#f6b62c", "#ec2a1c"];
  for (let i = 0; i < 9; i++) {
    const x = i * 72 + 10, hh = 120 + ((i * 53) % 110); g.shadowBlur = 0; g.fillStyle = "#140a1e"; g.fillRect(x, 300 - hh, 64, hh);
    const on = reduced() || Math.sin(t * 4 + i * 1.7) > -0.6; neon(g, signs[i % 5], 2, on ? 16 : 0);
    g.strokeRect(x + 10, 300 - hh + 14, 44, 22); if (on) { g.globalAlpha = 0.3; g.fillRect(x + 10, 300 - hh + 14, 44, 22); g.globalAlpha = 1; }
  }
  // Tokyo Tower lattice
  neon(g, "#ff5a2a", 3, 16); line(g, [700, 300, 780, 70, 860, 300]);
  for (let i = 1; i < 9; i++) { const y = 300 - i * 26, half = 80 * (1 - (i * 26) / 230), below = 80 * (1 - ((i - 1) * 26) / 230); line(g, [780 - half, y, 780 + half, y]); line(g, [780 - half, y, 780 + below, y + 26]); }
  g.strokeRect(752, 175, 56, 14); g.strokeRect(764, 115, 32, 10); line(g, [780, 70, 780, 34]);
  // Shibuya scramble: zebra stripes + crowd
  g.shadowBlur = 0; g.fillStyle = "#1a1220"; g.fillRect(0, 300, W, H - 300);
  g.fillStyle = "rgba(238,228,211,.55)"; for (let i = 0; i < 16; i++) g.fillRect(40 + i * 40, 318, 22, 40);
  for (let i = 0; i < 26; i++) { const sp = reduced() ? 0 : t * (18 + (i % 5) * 6); const x = ((i * 97 + sp * (i % 2 ? 1 : -1)) % W + W) % W; neon(g, signs[i % 5], 2, 6); g.beginPath(); g.arc(x, 330 + (i * 13) % 50, 3, 0, Math.PI * 2); g.fill(); }
}

function drawLA(g: G, t: number): void {
  sky(g, "#2a0b3a", "#ff7a3d");
  neon(g, "#f6b62c", 0, 40); g.beginPath(); g.arc(700, 250, 60, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  for (const [y, c, a] of [[200, "#3a1440", 0.006], [240, "#2a0e30", 0.01], [290, "#1a0820", 0.014]] as const) {
    g.fillStyle = c; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * a + y) * 30); g.lineTo(W, H); g.fill();
  }
  g.font = "900 46px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center"; neon(g, "#eee4d3", 2, 12);
  "HOLLYWEIRD".split("").forEach((ch, i) => { g.save(); g.translate(180 + i * 46, 196 + Math.sin(i * 0.9) * 8); g.rotate(Math.sin(i * 1.3) * 0.06); g.fillText(ch, 0, 0); g.restore(); });
  palm(g, 80, GROUND, 220, t, "#c6ff3d"); palm(g, 880, GROUND, 190, t, "#c6ff3d");
}

function drawLondon(g: G, t: number): void {
  sky(g, "#0c1020", "#1e2236");
  neon(g, "#9ab0ff", 1, 0); if (!reduced()) for (let i = 0; i < 70; i++) { const x = (i * 131 + t * 60) % W, y = (i * 71 + t * 400) % H; line(g, [x, y, x - 3, y + 12]); }
  // Big Ben + Parliament
  neon(g, "#f6b62c", 3); g.strokeRect(170, 140, 70, 230); line(g, [165, 140, 205, 70, 245, 140]); line(g, [205, 70, 205, 40]);
  g.beginPath(); g.arc(205, 175, 24, 0, Math.PI * 2); g.stroke();
  const now = new Date(), hr = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * Math.PI * 2, mn = now.getMinutes() / 60 * Math.PI * 2;
  line(g, [205, 175, 205 + Math.sin(hr) * 13, 175 - Math.cos(hr) * 13]); line(g, [205, 175, 205 + Math.sin(mn) * 19, 175 - Math.cos(mn) * 19]);
  g.lineWidth = 2; line(g, [240, 370, 240, 250, 560, 250, 560, 370]); for (let x = 260; x < 560; x += 30) line(g, [x, 250, x, 236, x + 6, 228, x + 12, 236, x + 12, 250]);
  g.shadowBlur = 0; g.fillStyle = "#121420"; g.fillRect(0, 370, W, H - 370);
  // red bus
  const bx = reduced() ? 600 : ((t * 90) % (W + 320)) - 260;
  neon(g, "#ec2a1c", 3, 18); g.fillStyle = "rgba(236,42,28,.35)"; g.beginPath(); g.roundRect(bx, 262, 230, 104, 10); g.fill(); g.stroke();
  neon(g, "#eee4d3", 2, 6); for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) g.strokeRect(bx + 12 + i * 36, 274 + r * 42, 26, 22);
  neon(g, "#eee4d3", 3, 8); g.beginPath(); g.arc(bx + 50, 368, 14, 0, 7); g.stroke(); g.beginPath(); g.arc(bx + 185, 368, 14, 0, 7); g.stroke();
}

function drawRaro(g: G, t: number): void {
  sky(g, "#ff8a5c", "#ffcf7a");
  g.shadowBlur = 0; g.fillStyle = "#2d6b4a"; g.beginPath(); g.moveTo(380, 300); g.lineTo(470, 200); g.lineTo(520, 150); g.lineTo(540, 110); g.lineTo(560, 160); g.lineTo(640, 220); g.lineTo(760, 300); g.fill();
  const lg = g.createLinearGradient(0, 290, 0, H); lg.addColorStop(0, "#3dd6ff"); lg.addColorStop(1, "#0a8aa8"); g.fillStyle = lg; g.fillRect(0, 290, W, H - 290);
  neon(g, "#eee4d3", 2, 8); for (let i = 0; i < 10; i++) { const x = (i * 113 + (reduced() ? 0 : t * 25)) % W; line(g, [x, 300 + i * 8, x + 40, 300 + i * 8]); }
  g.fillStyle = "#f6dca0"; g.fillRect(0, 370, W, H - 370);
  palm(g, 120, 375, 210, t, "#1f8a3a"); palm(g, 200, 378, 160, t + 1, "#1f8a3a"); palm(g, 850, 376, 230, t + 2, "#1f8a3a");
}

function drawBali(g: G, t: number): void {
  const glowT = reduced() ? 30 : 26 + Math.sin(t) * 6;
  sky(g, "#ffb36b", "#ff6a8a");
  // terraces
  for (let i = 0; i < 9; i++) { const y = 200 + i * 24, wave = (x: number) => y + Math.sin(x * 0.01 + i * 0.7) * 12 + x * 0.04;
    g.shadowBlur = 0; g.fillStyle = i % 2 ? "#3f7a2a" : "#2f6a24"; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= 560; x += 20) g.lineTo(x, wave(x)); g.lineTo(560, H); g.fill();
    neon(g, i % 2 ? "#c6ff3d" : "#7ad94a", 2.5, 8); g.beginPath(); for (let x = 0; x <= 560; x += 20) { if (x) g.lineTo(x, wave(x)); else g.moveTo(x, wave(x)); } g.stroke(); }
  // meru tower (stacked roofs) + split gate
  neon(g, "#2a0e30", 3, 0); g.fillStyle = "#3a1a2a";
  for (let i = 0; i < 7; i++) { const w = 130 - i * 15, y = 340 - i * 30; g.beginPath(); g.moveTo(720 - w / 2, y); g.lineTo(720 + w / 2, y); g.lineTo(720 + w / 3, y - 20); g.lineTo(720 - w / 3, y - 20); g.fill(); }
  g.fillRect(712, 120, 16, 20); g.fillRect(690, 340, 60, 52);
  for (const side of [-1, 1]) { g.beginPath(); const x0 = side < 0 ? 560 : 880; for (let s = 0; s < 6; s++) { const ww = 50 - s * 6; g.rect(x0 - (side < 0 ? 0 : ww), 392 - (s + 1) * 34, ww, 34); } g.fill(); }
  neon(g, "#f6b62c", 0, glowT); g.beginPath(); g.arc(300, 110, 36, 0, 7); g.fill();
}

const DESTS: Dest[] = [
  { code: "SYD", name: "Sydney", time: "3h 10m", fare: 389, lon: 151.2, lat: -33.9, sky: ["#070a24", "#1b0d36"], neon: "#3dd6ff", tag: "Harbour lights and arguably better coffee (don't say that in Wellington).", draw: drawSydney, acts: [
    { id: "photo", kind: "photo", label: "Shoot the Opera House at blue hour", cost: 0, out: "Long exposure, glowing sails. The algorithm weeps." },
    { id: "eat", kind: "eat", label: "Meat pie at a harbourside cart", cost: 12, out: "Sauce on the pie, sauce on the shirt, sauce on the soul." },
    { id: "souv", kind: "souvenir", label: "Buy a boomerang", cost: 29, out: "It's a boomerang that never returns. Like your ex.", item: "Boomerang that doesn't come back" },
    { id: "fun", kind: "fun", label: "Climb the Harbour Bridge", cost: 180, out: "You reach the top, look down, and briefly believe in gravity." }] },
  { code: "RAR", name: "Rarotonga", time: "4h 20m", fare: 849, lon: -159.8, lat: -21.2, sky: ["#ff8a5c", "#ffcf7a"], neon: "#3dd6ff", tag: "Kia orana. The lagoon is a colour cameras argue about.", draw: drawRaro, acts: [
    { id: "photo", kind: "photo", label: "Golden hour over Muri lagoon", cost: 0, out: "No filter needed. You add one anyway, out of habit." },
    { id: "eat", kind: "eat", label: "Ika mata from a beach shack", cost: 18, out: "Raw fish, coconut cream, lime. You're moving here." },
    { id: "souv", kind: "souvenir", label: "Buy a black pearl (tiny)", cost: 65, out: "Very small, very shiny, very hard to find once dropped in sand.", item: "Tiny black pearl" },
    { id: "fun", kind: "fun", label: "Snorkel with the fish", cost: 25, out: "A parrotfish judges your technique. Fair." }] },
  { code: "DPS", name: "Bali", time: "8h 05m", fare: 1149, lon: 115.2, lat: -8.7, sky: ["#ffb36b", "#ff6a8a"], neon: "#c6ff3d", tag: "Rice terraces, temple gates and suspicious monkeys.", draw: drawBali, acts: [
    { id: "photo", kind: "photo", label: "Shoot the terraces at sunrise", cost: 0, out: "Green on green on green. Your histogram is just one spike." },
    { id: "eat", kind: "eat", label: "Nasi goreng from a warung", cost: 7, out: "Seven dollars of perfection with a fried egg on top." },
    { id: "souv", kind: "souvenir", label: "Buy a carved frog with umbrella", cost: 16, out: "Hand-carved, waterproof-themed, inexplicably charming.", item: "Carved frog with umbrella" },
    { id: "fun", kind: "fun", label: "Visit the monkey forest", cost: 10, out: "A macaque steals your sunglasses and trades them back for a banana." }] },
  { code: "NRT", name: "Tokyo", time: "11h 05m via AKL", fare: 1390, lon: 140, lat: 35.7, sky: ["#0a0418", "#240b2c"], neon: "#ff7ad9", tag: "Neon, scramble crossings and vending machines with opinions.", draw: drawTokyo, acts: [
    { id: "photo", kind: "photo", label: "Shoot Shibuya scramble from above", cost: 0, out: "3,000 people, one shutter press, zero collisions." },
    { id: "eat", kind: "eat", label: "Ramen at a ticket-machine counter", cost: 19, out: "You slurp loudly. It's polite here. You are finally home." },
    { id: "souv", kind: "souvenir", label: "Spin a gashapon capsule machine", cost: 6, out: "You win a tiny plastic sushi with a face.", item: "Gashapon sushi with a face" },
    { id: "fun", kind: "fun", label: "Private karaoke booth", cost: 35, out: "Ninety minutes of power ballads. The booth asks you to stop." }] },
  { code: "LAX", name: "Los Angeles", time: "13h 50m via AKL", fare: 1690, lon: -118.4, lat: 33.9, sky: ["#2a0b3a", "#ff7a3d"], neon: "#f6b62c", tag: "Palm trees, smog sunsets and a famous sign, sort of.", draw: drawLA, acts: [
    { id: "photo", kind: "photo", label: "Shoot the HOLLYWEIRD sign", cost: 0, out: "Legally distinct. Spiritually identical." },
    { id: "eat", kind: "eat", label: "Al pastor from a taco truck", cost: 9, out: "Best meal of the trip, served from a van in a car park." },
    { id: "souv", kind: "souvenir", label: "Buy a HOLLYWEIRD snow globe", cost: 24, out: "It snows in LA now. Only in the globe.", item: "HOLLYWEIRD snow globe" },
    { id: "fun", kind: "fun", label: "Audition as an extra", cost: 0, out: "You're cast as 'Background Stick Figure #4'. Your agent is thrilled." }] },
  { code: "LHR", name: "London", time: "27h 40m via SIN", fare: 2390, lon: -0.5, lat: 51.5, sky: ["#0c1020", "#1e2236"], neon: "#ec2a1c", tag: "Drizzle, double-deckers and a clock that's always on time.", draw: drawLondon, acts: [
    { id: "photo", kind: "photo", label: "Big Ben with a bus streaking past", cost: 0, out: "Red light trails, slow shutter. Peak postcard." },
    { id: "eat", kind: "eat", label: "Fish and chips in the rain", cost: 26, out: "Slightly soggy. You'd expect nothing less." },
    { id: "souv", kind: "souvenir", label: "Buy a tiny red bus", cost: 15, out: "Die-cast, double-decker, already lost a wheel.", item: "Tiny red double-decker" },
    { id: "fun", kind: "fun", label: "Try to make a royal guard laugh", cost: 0, out: "Forty minutes of material. Not a flicker. A tourist laughs instead." }] },
];

const REACT: Record<Act["kind"], string[]> = {
  photo: ["{c} photobombs every single frame.", "{c}: \"Tag me. Actually don't, my eyes are shut in all of them.\""],
  eat: ["{c} steals the last bite and denies everything.", "{c}: \"Ten out of ten. Eleven if you're paying.\""],
  souvenir: ["{c}: \"And where's mine?\"", "{c} says it'll look great on the dashboard of a stolen car."],
  fun: ["{c} is already texting the crew back home.", "{c}: \"Best. Trip. Ever. Don't tell my mum.\""],
};
const SOLO = ["You narrate it to yourself in a nature-documentary voice.", "You high-five yourself. Nobody saw. Perfect.", "A pigeon nods approvingly."];
const AGENT = ["\"Window or aisle? Or wing? Kidding. Mostly.\"", "\"Did you pack this bag yourself? Weird answer, but okay.\"", "\"Your boarding group is 'eventually'.\"", "\"Lovely photo in your passport. Very... stick-figure.\""];
const ARGUE = ["The officer listens patiently, nods, and confiscates it anyway.", "\"It's for self-defence against the in-flight meal.\" The officer is not moved.", "You cite your rights. The officer cites a much larger binder."];
const PRICE_OVERWEIGHT = 75;

export class Travel {
  el: HTMLElement;
  open = false;
  private stage: Stage = "board";
  private room:TravelRoom|null=null;private district:DestinationDistrict|null=null;
  private visits=new Map<string,DistrictVisit>();
  private lounge:LoungeId='terminal';private passes=new Set<LoungeId>(['terminal','quiet','family']);
  private sel = 0;
  private comp: { name: string; color: string } | null = null;
  private spent = 0; private photos = 0; private souvenirs: string[] = []; private done = new Set<string>();
  private msg = ""; private line = "";
  private bagKg = 0; private bagOk = false;
  private scanDone = false; private argued = false; private cleared = false; private scanNote = "";
  private canvas: HTMLCanvasElement | null = null; private lineEl: HTMLElement | null = null; private lineIdx = -1;
  private raf = 0; private stageStart = 0; private landed = false; private animate = true; private timers: number[] = [];

  constructor(private host: TravelHost) {
    this.el = h("div.travel.hidden", { role: "dialog", "aria-modal": "true", "aria-label": "Christchurch International Airport" });
  }

  show(): void {
    travelCast=[this.host.player(),...this.host.people()];
    this.reset(); this.open = true; this.el.classList.remove("hidden");
    window.addEventListener("keydown", this.onKey, true);
    this.go("board");
    const tick = (now: number) => { if (!this.open) return; this.raf = requestAnimationFrame(tick); this.frame(now); };
    this.raf = requestAnimationFrame(tick);
  }

  close(): void {
    this.conversation?.dispose();this.conversation=null;this.room?.dispose();this.room=null;this.district?.dispose();this.district=null;
    this.open = false; this.el.classList.add("hidden");
    cancelAnimationFrame(this.raf); this.timers.forEach((id) => clearTimeout(id)); this.timers = [];
    window.removeEventListener("keydown", this.onKey, true);
    this.el.replaceChildren(); this.canvas = null;
  }

  autoHome(): void {
    if (!this.open) return;
    const summary = this.summary();
    this.close();
    this.host.onReturn(summary, [...this.souvenirs], this.photos);
  }

  private reset(): void {
    this.privateFlight=false;this.lounge='terminal';this.passes=new Set(['terminal','quiet','family']);
    this.globalDestination=null;this.sel = 0; this.comp = null; this.spent = 0; this.photos = 0; this.souvenirs = []; this.done.clear();
    this.bagOk = false; this.scanDone = false; this.argued = false; this.cleared = false; this.scanNote = ""; this.landed = false;
  }

  private privateFlight=false;
  arriveFromSea():void {this.show();this.sel=0;this.go("dest");}
  privateDeparture():void {this.show();this.privateFlight=true;this.go("board");}

  private globalDestination:Dest|null=null;
  private get dest(): Dest { return this.globalDestination??DESTS[this.sel]; }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if(e.target instanceof HTMLElement&&e.target.closest('select,input,textarea')&&e.key!=='Escape'){e.stopImmediatePropagation();return;}
    e.stopImmediatePropagation();
    if(this.room?.key(e)||this.district?.key(e))return;
    const target = e.target as HTMLElement;
    if (e.key === "Escape") { if (this.stage === "board") this.close(); else this.autoHome(); e.preventDefault(); return; }
    if (e.key === "Enter" || e.key === " ") {
      if (target.tagName === "BUTTON" && this.el.contains(target)) return; // native activation
      e.preventDefault(); (this.el.querySelector("button[data-primary]:not([disabled])") as HTMLButtonElement | null)?.click(); return;
    }
    if (/^[1-9]$/.test(e.key)) { const b = this.el.querySelector(`button[data-key="${e.key}"]:not([disabled])`) as HTMLButtonElement | null; if (b) { e.preventDefault(); b.click(); } }
  };

  private go(stage: Stage): void {
    this.stage = stage; this.stageStart = performance.now(); this.msg = ""; this.line = ""; this.lineIdx = -1; this.animate = true;
    if (stage === "checkin") { this.bagKg = Math.round((12 + Math.random() * 15) * 10) / 10; this.bagOk = this.bagKg <= 23; this.line = pick(AGENT); }
    if (stage === "security") this.startScan();
    if (stage === "flight") this.landed = false;
    this.render();
    (this.el.querySelector("button[data-primary]:not([disabled])") as HTMLElement | null ?? this.el.querySelector("button") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private later(fn: () => void, ms: number): void { this.timers.push(window.setTimeout(() => { if (this.open) fn(); }, ms)); }

  // ------------------------------------------------------------------ dom helpers
  private btn(label: string, fn: () => void, o: { key?: string; primary?: boolean; disabled?: boolean; aria?: string; cls?: string } = {}): HTMLElement {
    return h("button.tv-btn" + (o.primary ? ".primary" : "") + (o.cls ? "." + o.cls : ""), {
      type: "button", onclick: fn, disabled: o.disabled, "data-key": o.key, "data-primary": o.primary, "aria-label": o.aria ?? label + (o.key ? ` (key ${o.key})` : ""),
    }, [o.key ? h("kbd", { text: o.key }) : null, label]);
  }

  private makeCanvas(label: string): HTMLCanvasElement {
    this.canvas = h("canvas.tv-canvas", { width: W, height: H, role: "img", "aria-label": label }) as HTMLCanvasElement;
    return this.canvas;
  }

  private scene(kicker: string, title: string, body: (Node | null)[], actions: HTMLElement[]): void {
    const anim = this.animate; this.animate = false;
    this.el.replaceChildren(...(this.stage === "board" ? [] : [this.btn("Auto Home", () => this.autoHome(), {cls:"auto-home", aria:"Auto Home · return to Christchurch"})]), h("div.tv-scene" + (anim ? ".tv-in" : ""), { "data-stage": this.stage }, [
      h("header.tv-cap", null, [h("p.tv-kick", { text: kicker }), h("h2.tv-title", { text: title }),
        h("div.tv-wallet", { "aria-label": "Cash" }, [h("span", { text: "Cash" }), h("b", { text: money(this.host.getCash()) })])]),
      h("div.tv-body", null, body),
      h("p.tv-msg", { role: "status", "aria-live": "polite", text: this.msg }),
      h("div.tv-actions", null, actions),
    ]));
  }

  private render(): void {
    if(this.district)this.visits.set(this.dest.code,this.district.snapshot());
    this.conversation?.dispose();this.conversation=null;this.room?.dispose();this.room=null;this.district?.dispose();this.district=null;
    this.canvas = null; this.lineEl = null;
    switch (this.stage) {
      case "board": return this.boardView();
      case "checkin": return this.checkinView();
      case "security": return this.securityView();
      case "gate": return this.gateView();
      case "flight": return this.flightView();
      case "dest": return this.destView();
      case "return": return this.returnView();
    }
  }

  // ------------------------------------------------------------------ 1. departures
  private fareFor(d: Dest): number { return this.privateFlight?0:d.fare * (this.comp ? 2 : 1); }

  private boardView(): void {
    const flap = (s: string, w: number) => h("span.flap", { "aria-hidden": "true" }, s.toUpperCase().padEnd(w).split("").map((c, i) => h("i", { style: { animationDelay: `${i * 35}ms` }, text: c })));
    const rows = DESTS.map((d, i) => h("button.tv-row" + (i === this.sel ? ".on" : ""), {
      type: "button", role: "radio", "aria-checked": String(i === this.sel), "data-key": String(i + 1),
      "aria-label": `${i + 1}: ${d.name}, ${d.time}, return fare ${money(d.fare)} each`, onclick: () => { this.globalDestination=null;this.sel = i; this.msg = ""; this.render(); },
    }, [h("span.tv-num", { text: String(i + 1) }), flap(`MS${100 + i * 7} ${d.code}`, 9), flap(d.name, 11), h("span.tv-time", { text: d.time }), h("span.tv-fare", { text: money(d.fare) }), h("span.tv-status", { text: i === this.sel ? "SELECTED" : "ON TIME" })]));
    const crew = this.host.companions();
    const comps = h("div.tv-comps", { role: "radiogroup", "aria-label": "Travel companion" }, [
      h("button.tv-chip" + (!this.comp ? ".on" : ""), { type: "button", role: "radio", "aria-checked": String(!this.comp), onclick: () => { this.comp = null; this.render(); } }, ["Solo (cheaper)"]),
      ...crew.map((c) => h("button.tv-chip" + (this.comp?.name === c.name ? ".on" : ""), { type: "button", role: "radio", "aria-checked": String(this.comp?.name === c.name), onclick: () => { this.comp = c; this.render(); } }, [h("i.dot", { style: { background: c.color } }), c.name])),
    ]);
    const results=h('select',{'aria-label':'Worldwide city results'},[h('option',{text:'Search a city or country code',value:''})]) as HTMLSelectElement;
    const worldSearch=h('input',{type:'search',placeholder:'Find a world city · e.g. Kuwait or IN','aria-label':'Search worldwide cities',oninput:async(e:Event)=>{const term=(e.target as HTMLInputElement).value.trim().toLowerCase();if(term.length<2){results.replaceChildren(h('option',{text:'Type at least two letters',value:''}));return;}const {default:cities}=await import('../../../data/world-cities.mjs');if(!worldSearch.isConnected)return;const countries:Record<string,string>={IN:'india',KW:'kuwait',AE:'united arab emirates uae',QA:'qatar',OM:'oman',BH:'bahrain',SA:'saudi arabia',NZ:'new zealand',AU:'australia',US:'united states america usa',CA:'canada',GB:'united kingdom britain england',JP:'japan'};const matches=cities.filter(c=>c.name.toLowerCase().includes(term)||c.country.toLowerCase()===term||(countries[c.country]??'').includes(term)).sort((a,b)=>Number(b.name.toLowerCase().includes(term))-Number(a.name.toLowerCase().includes(term))).slice(0,30);results.replaceChildren(h('option',{text:matches.length?'Choose a mapped city':'No matching city in this catalogue',value:''}),...matches.map(c=>h('option',{value:c.id,text:c.name+' · '+c.country})));}});
    results.onchange=async()=>{const {default:cities}=await import('../../../data/world-cities.mjs'),city=cities.find(c=>c.id===+results.value);if(!city||!this.open)return;this.globalDestination={...DESTS[0],code:'G'+city.id,name:city.name+', '+city.country,lat:city.lat,lon:city.lon,country:city.country,time:'Connecting service',fare:850,tag:'Mapped neighbourhood · available OSM footprints and game-authored interiors',acts:[{id:'district-photo',kind:'photo',label:'Photograph this neighbourhood',cost:0,out:'A photo walk through the mapped streets and local architecture.'}]};this.render();};
    const fare = this.fareFor(this.dest);
    this.scene("Christchurch International · CHC", "Departures", [
      h("div.tv-board", { role: "radiogroup", "aria-label": "Destinations" }, [h("div.tv-row.head", { "aria-hidden": "true" }, ["#", "Flight", "Destination", "Time", "Fare", "Status"].map((t) => h("span", { text: t }))), ...rows]),
      h('div.tv-world-search',null,[worldSearch,results]),
      h('p.tv-note',{text:this.globalDestination?'Selected: '+this.dest.name:this.dest.tag}),
      h("h3.tv-h3", { text: "Who's coming?" }), comps,
    ], [
      this.btn(`Buy ticket${this.comp ? "s" : ""} · ${money(fare)}`, () => this.buy(), { primary: true, aria: `Buy ${this.comp ? "two return tickets" : "a return ticket"} to ${this.dest.name} for ${money(fare)}` }),
      this.btn("Leave airport", () => this.close(), { aria: "Leave the airport (Escape)" }),
      this.btn('Explore terminal & lounges',()=>this.go('gate')),
    ]);
  }

  private buy(): void {
    const fare = this.fareFor(this.dest), cash = this.host.getCash();
    if (cash < fare) { this.msg = `Card declined. You're ${money(fare - cash)} short of ${this.dest.name}. ${this.comp ? "Try going solo?" : "Maybe Sydney?"}`; this.render(); return; }
    this.host.setCash(cash - fare); this.spent += fare;
    this.host.toast(`Booked: CHC to ${this.dest.code}${this.comp ? " with " + this.comp.name : ""}`);
    this.go("checkin");
  }

  // ------------------------------------------------------------------ 2. check-in
  private checkinView(): void {
    const over = this.bagKg > 23;
    const body = [
      h("div.tv-desk", null, [
        h("div.tv-scale", { role: "img", "aria-label": `Bag weighs ${this.bagKg} kilograms, limit 23` }, [h("span", { text: "BAG" }), h("b", { text: this.bagKg.toFixed(1) + " kg" }), h("span" + (over && !this.bagOk ? ".bad" : ".ok"), { text: over ? (this.bagOk ? "SORTED" : "OVER 23 KG") : "OK" })]),
        h("div", null, [h("p.tv-agent", { text: `Check-in agent: ${this.line}` }),
          h("p.tv-note", { text: over && !this.bagOk ? "That bag is over the limit. Pay the excess or wear the excess." : `Tagged to ${this.dest.code}. Seat ${14 + this.sel}A${this.comp ? ` and ${14 + this.sel}B for ${this.comp.name}` : ""}.` })]),
      ]),
    ];
    const acts = over && !this.bagOk ? [
      this.btn(`Pay excess ${money(PRICE_OVERWEIGHT)}`, () => {
        const c = this.host.getCash(); if (c < PRICE_OVERWEIGHT) { this.msg = "Not enough cash. Looks like you're wearing it."; this.render(); return; }
        this.host.setCash(c - PRICE_OVERWEIGHT); this.spent += PRICE_OVERWEIGHT; this.bagOk = true; this.msg = "Paid. The bag sails off on the belt like it owns the place."; this.render();
      }, { key: "1" }),
      this.btn("Wear it all", () => { this.bagOk = true; this.bagKg = 22.9; this.msg = `You now wear four jumpers, two hoodies and a beanie. It's 31° in ${this.dest.name}.`; this.render(); }, { key: "2" }),
    ] : [this.btn("To security", () => this.go("security"), { primary: true })];
    this.scene(`Check-in · ${this.dest.name}`, "Bag drop", body, acts);
  }

  // ------------------------------------------------------------------ 3. security
  private startScan(): void {
    const items = this.host.carried();
    this.scanDone = false; this.argued = false; this.cleared = !items.some((i) => this.flagged(i.category));
    const notes: string[] = [];
    if (items.some((i) => i.category === "food")) notes.push("Biosecurity squints at your snacks. \"Declare those on the way back or the beagle will find out.\"");
    if (items.some((i) => /water|drink|juice|coffee|beer|wine|bottle|milk|soda/i.test(i.name))) notes.push("Liquids over 100 ml? You chug it on the spot. Officer: \"Impressive. Still no.\"");
    if (!items.length) notes.push("Empty pockets. The scanner looks almost disappointed.");
    this.scanNote = notes.join(" ");
    this.later(() => { this.scanDone = true; this.render(); }, reduced() ? 300 : 2600);
  }

  private flagged(cat: string): boolean { return cat === "weapon" || cat === "ammo"; }

  private securityView(): void {
    const bad = this.host.carried().filter((i) => this.flagged(i.category));
    let acts: HTMLElement[];
    if (!this.scanDone) acts = [this.btn("Scanning…", () => undefined, { disabled: true, aria: "Scanning your items" })];
    else if (!this.cleared) {
      acts = [this.btn(`Surrender ${bad.length} item${bad.length === 1 ? "" : "s"}`, () => {
        this.host.confiscate(bad.map((i) => i.id)); this.cleared = true;
        this.msg = `Bin ${Math.floor(Math.random() * 900 + 100)} now contains: ${bad.map((i) => i.name).join(", ")}. The officer gives you a sticker.`; this.render();
      }, { key: "1", primary: true, aria: `Surrender ${bad.map((i) => i.name).join(", ")}` })];
      if (!this.argued) acts.push(this.btn("Argue", () => { this.argued = true; this.msg = pick(ARGUE) + " You must surrender the items."; this.render(); }, { key: "2" }));
    } else acts = [this.btn("To the gate", () => this.go("gate"), { primary: true })];
    const list = this.scanDone ? h("ul.tv-flags", { "aria-label": "Scan results" }, this.host.carried().map((i) => h("li" + (this.flagged(i.category) ? ".bad" : ""), { text: `${i.name}${this.flagged(i.category) ? (this.cleared ? " · surrendered" : " · FLAGGED") : " · ok"}` }))) : null;
    if (!this.msg && this.scanDone) this.msg = bad.length && !this.cleared ? `${bad.length} prohibited item${bad.length === 1 ? "" : "s"} detected. ${this.scanNote}` : this.scanNote || "All clear. Have a nice flight.";
    this.scene("Security screening", "X-ray", [this.makeCanvas("Conveyor belt x-ray scanner showing your items as silhouettes"), list], acts);
  }

  private drawSecurity(g: G, t: number): void {
    sky(g, "#07090c", "#10141a");
    const items = this.host.carried().slice(0, 8), n = Math.max(items.length, 1);
    g.shadowBlur = 0; g.fillStyle = "#1a1e24"; g.fillRect(0, 260, W, 40);
    neon(g, "#3a4048", 2, 0); for (let x = (-t * 80) % 30; x < W; x += 30) line(g, [x, 262, x + 10, 298]);
    // scanner tunnel
    g.fillStyle = "rgba(61,214,255,.08)"; g.fillRect(360, 80, 240, 220); neon(g, "#3dd6ff", 3, 16); g.strokeRect(360, 80, 240, 220);
    g.font = "600 13px 'IBM Plex Mono', monospace"; g.fillText("X-RAY 02 · CHC", 372, 100);
    const speed = this.scanDone ? 0 : 1;
    items.forEach((it, i) => {
      const x = this.scanDone ? 120 + i * (720 / n) : ((t * 140 * speed + i * (W / n)) % (W + 120)) - 60;
      const inside = this.scanDone || (x > 360 && x < 600), bad = this.flagged(it.category);
      const col = inside ? (bad ? (Math.sin(t * 10) > 0 || this.cleared ? "#ec2a1c" : "#ff9a8a") : it.category === "food" ? "#f6b62c" : "#3dd6ff") : "#5a5f66";
      neon(g, col, 3, inside ? 14 : 0); g.fillStyle = inside ? col + "44" : "#2a2e34";
      this.silhouette(g, it.category, x, 236, bad && this.cleared ? 0.4 : 1);
      if (inside) { g.shadowBlur = 0; g.fillStyle = col; g.font = "500 12px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.fillText(it.name.slice(0, 11), x, 176); g.textAlign = "left"; }
    });
    if (!items.length) { neon(g, "#c6ff3d", 2); g.font = "900 32px 'Big Shoulders Display', Impact"; g.fillText("NOTHING TO SCAN", 380, 200); }
    stick(g, 760, GROUND, 72, "#c6ff3d", t, { wave: this.scanDone });
    if (this.comp) stick(g, 820, GROUND, 72, this.comp.color, t + 1);
    neon(g, "#9aa0a8", 3, 6); stick(g, 250, GROUND, 76, "#9aa0a8", t + 2); g.strokeRect(236, 306, 28, 8);
  }

  private silhouette(g: G, cat: string, x: number, y: number, alpha: number): void {
    g.globalAlpha = alpha; g.beginPath();
    switch (cat) {
      case "weapon": g.moveTo(x - 30, y - 30); g.lineTo(x + 30, y - 30); g.lineTo(x + 30, y - 18); g.lineTo(x - 8, y - 18); g.lineTo(x - 14, y + 4); g.lineTo(x - 28, y + 4); g.lineTo(x - 22, y - 18); g.closePath(); break;
      case "ammo": for (let i = 0; i < 4; i++) g.rect(x - 22 + i * 12, y - 26, 8, 26); break;
      case "food": g.arc(x, y - 16, 18, 0, Math.PI * 2); g.moveTo(x + 8, y - 34); g.lineTo(x + 2, y - 44); break;
      case "valuable": g.moveTo(x, y); g.lineTo(x - 20, y - 22); g.lineTo(x - 10, y - 34); g.lineTo(x + 10, y - 34); g.lineTo(x + 20, y - 22); g.closePath(); break;
      case "tool": g.moveTo(x - 24, y - 4); g.lineTo(x + 12, y - 28); g.arc(x + 18, y - 32, 9, Math.PI * 0.8, Math.PI * 2.6); break;
      case "toy": for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; g.lineTo(x + Math.cos(a) * r, y - 20 + Math.sin(a) * r); } g.closePath(); break;
      default: g.rect(x - 20, y - 30, 40, 30);
    }
    g.fill(); g.stroke(); g.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ 4. flight
  private flightLines(): string[] {
    const d = this.dest;
    if (!this.comp) return ["The stranger in 14B is watching a film about plane crashes. Bold.", `Captain: "We'll be landing in ${d.name} shortly-ish."`, "You get the whole armrest. Living the dream."];
    const c = this.comp.name;
    return [`${c}: "Window seat's wasted on you. You're asleep in five minutes."`, `${c}: "Do you reckon the pilot's ever been to ${d.name}? Should we ask?"`, `${c}: "These peanuts are the best thing I've ever eaten. Is that altitude?"`, `${c}: "Wake me when we're there. Actually, don't. Actually, do."`];
  }

  private flightView(): void {
    this.lineEl = h("p.tv-speech", { "aria-live": "polite", text: this.flightLines()[0] });
    this.scene(`Flight MS${100 + this.sel * 7} · CHC to ${this.dest.code}`, this.landed ? `Landed in ${this.dest.name}` : "In flight", [this.makeCanvas(`Plane window view and a map of the route from Christchurch to ${this.dest.name}`), this.lineEl],
      [this.btn(this.landed ? "Step off the plane" : "Skip to landing", () => this.go("dest"), { primary: true })]);
  }

  private drawFlight(g: G, t: number, p: number): void {
    sky(g, "#0b0814", "#120c1e");
    const d = this.dest, rm = reduced();
    // window
    g.save(); g.beginPath(); g.roundRect(60, 40, 300, 300, 120); g.clip();
    const sg = g.createLinearGradient(0, 40, 0, 340); sg.addColorStop(0, d.sky[0]); sg.addColorStop(1, d.sky[1]); g.fillStyle = sg; g.fillRect(60, 40, 300, 300);
    g.fillStyle = "rgba(238,228,211,.75)";
    for (let i = 0; i < 7; i++) { const x = 380 - (((rm ? 20 : t * 60) * (1 + (i % 3) * 0.6) + i * 90) % 420), y = 90 + (i * 47) % 230; g.beginPath(); g.ellipse(x, y, 46 + (i % 3) * 14, 14, 0, 0, Math.PI * 2); g.ellipse(x + 26, y - 8, 26, 12, 0, 0, Math.PI * 2); g.fill(); }
    neon(g, "#c8c8d8", 6, 0); line(g, [60, 300, 360, 262]);
    g.restore(); neon(g, "#eee4d3", 6, 10); g.beginPath(); g.roundRect(60, 40, 300, 300, 120); g.stroke();
    // map
    const mx = (lon: number) => 440 + ((((lon - 60) % 360) + 360) % 360) / 300 * 460, my = (lat: number) => 150 - lat * 1.5;
    neon(g, "#2a2a3a", 1, 0); g.strokeRect(440, 40, 480, 210); for (let x = 470; x < 920; x += 40) line(g, [x, 40, x, 250]); for (let y = 60; y < 250; y += 30) line(g, [440, y, 920, y]);
    const ax = mx(172.6), ay = my(-43.5), bx = mx(d.lon), by = my(d.lat), cx = (ax + bx) / 2, cy = Math.min(ay, by) - 50;
    neon(g, d.neon, 2, 10); g.setLineDash([6, 6]); g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(cx, cy, bx, by); g.stroke(); g.setLineDash([]);
    const q = (a: number, c: number, b: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * c + p * p * b;
    g.beginPath(); g.arc(q(ax, cx, bx), q(ay, cy, by), 6, 0, 7); g.fill();
    neon(g, "#eee4d3", 2, 4); g.font = "600 13px 'IBM Plex Mono', monospace"; g.fillText("CHC", ax + 8, ay + 4); g.fillText(d.code, bx + 8, by + 4);
    g.fillText(`${Math.round(p * 100)}% · ${p >= 1 ? "ARRIVED" : "CRUISING 38,000 FT"}`, 450, 238);
    // seats
    g.shadowBlur = 0; g.fillStyle = "#1e1830"; g.fillRect(470, 290, 90, 110); g.fillRect(620, 290, 90, 110);
    const bob = rm ? 0 : Math.sin(t * 2) * 2;
    stick(g, 500, 392 + bob, 80, "#c6ff3d", t, { sit: true });
    stick(g, 650, 392 - bob, 80, this.comp ? this.comp.color : "#6a6a7a", t + 1, { sit: true, wave: !!this.comp && Math.sin(t) > 0.6 });
  }

  // ------------------------------------------------------------------ 5. destination
  private gateView():void{
    const info=LOUNGES.find(l=>l.id===this.lounge)!;
    const canvas=this.makeCanvas('Christchurch airport · '+info.name+' · walkable isometric interior');
    this.scene('Christchurch International · Departures',info.name,[
      h('div.tv-comps',null,LOUNGES.map(l=>this.btn(l.name+(this.passes.has(l.id)?' · included':` · ${money(l.cost)}`),()=>{
        if(!this.passes.has(l.id)){if(this.host.getCash()<l.cost){this.msg='Insufficient cash for this lounge pass.';this.render();return;}this.host.setCash(this.host.getCash()-l.cost);this.spent+=l.cost;this.passes.add(l.id);}this.lounge=l.id;this.render();
      },{cls:l.id===this.lounge?'on':undefined}))),canvas,
      h('p.tv-note',{text:info.benefit+' Walk with WASD / arrows, or tap the floor. Approach a service and use it.'}),
    ],[this.btn(this.cleared?'Board flight':'Back to departures',()=>this.go(this.cleared?'flight':'board'),{primary:true}),this.btn('Use nearby service',()=>{
      const text=this.room?.use()??'';const msg=this.el.querySelector('.tv-msg');if(msg)msg.textContent=text;if(this.room?.effect==='eat'||this.room?.effect==='rest')this.host.refresh?.(this.room.effect);
    })]);
    this.room=new TravelRoom(canvas,airportRoom(this.lounge),this.host.people(),this.host.player());
  }
  private conversation:DestinationConversation|null=null;
  private destView(): void {
    const d = this.dest;
    const acts = d.acts.map((a, i) => this.btn(`${a.label}${a.cost ? " · " + money(a.cost) : ""}`, () => this.doAct(a), { key: String(i + 1), disabled: this.done.has(a.id) && a.kind !== "photo", aria: `${a.label}${a.cost ? ", costs " + money(a.cost) : ", free"} (key ${i + 1})` }));
    acts.push(this.btn("Fly home", () => this.go("return"), { primary: true, aria: "Fly home to Christchurch" }));
    const canvas=this.makeCanvas(`${d.name}: real mapped buildings and roads with your Mosaics character`),status=h('p.tv-note',{text:'Loading mapped neighbourhood…'}),enter=this.btn('Enter selected venue',()=>this.enterMappedVenue());enter.setAttribute('disabled','');
    this.scene(`${d.name} · ${this.comp ? "with " + this.comp.name : "solo"} · ${this.photos} photos`, d.name,
      [canvas,h('div.destination-zoom',{'aria-label':'Map zoom'},[this.btn('−',()=>this.district?.zoom(-1),{aria:'Zoom out destination map'}),this.btn('+',()=>this.district?.zoom(1),{aria:'Zoom in destination map'})]),h('a.destination-credit',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener',text:'© OpenStreetMap contributors'}),h('details.destination-guide',null,[h('summary',{text:'Map & controls'}),status,h('p.tv-note',{text:'WASD / arrows to walk. Tap the ground to move; tap a building or venue to inspect it. Approach within 30 metres to enter. Map footprints, roads and available land cover come from OpenStreetMap. Water blocks walking; sand and grass affect your pace. Traffic is simulated on mapped roads.'}),
       h('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener',text:'© OpenStreetMap contributors · ODbL 1.0'}),h('a',{href:'https://www.geonames.org/',target:'_blank',rel:'noopener',text:'City centres: GeoNames · CC BY 4.0'})])], [enter,this.btn('Drive / park · E',()=>this.district?.vehicle()),this.btn('Talk to a local',()=>this.conversation?.talk()),...acts]);
    this.district=new DestinationDistrict(canvas,d.code,this.host.player(),s=>{status.textContent=s;},()=>{enter.removeAttribute('disabled');},this.visits.get(d.code),this.comp?this.host.people().filter(c=>c.name===this.comp!.name||c.name.startsWith(this.comp!.name+' ')).slice(0,1):[],this.host.people().filter(c=>c.tier==='background').slice(0,12),d.country??'',()=>this.conversation?.talk());
    this.conversation=new DestinationConversation(countryFor(d.code,d.country??''),()=>this.district!.context(),text=>{const msg=this.el.querySelector('.tv-msg');if(msg)msg.textContent=text;});this.el.querySelector('.tv-body')?.append(this.conversation.el);
  }

  private enterMappedVenue():void{
    const district=this.district,v=district?.selected;if(!v)return;if(!district.canEnter()){const msg=this.el.querySelector('.tv-msg');if(msg)msg.textContent='Walk closer to this venue (within 30 metres).';return;}
    this.visits.set(this.dest.code,district.snapshot());district.dispose();this.district=null;this.conversation?.dispose();this.conversation=null;const canvas=this.makeCanvas((v.name||'Mapped venue')+' · game interior');
    this.scene(this.dest.name,v.name||v.tags.address||'Mapped venue',[canvas,h('p.tv-note',{text:'Game-authored interior informed by the mapped venue type. Walk with WASD / arrows or tap the floor.'})],[this.btn('Back outside',()=>{this.room?.dispose();this.room=null;this.render();},{primary:true}),this.btn('Use nearby service',()=>{this.useMappedService();})]);
    const country=countryFor(this.dest.code,this.dest.country??''),def=regionalInterior(country,this.dest.name,interiorForBuilding({id:v.id,name:v.name||'Mapped venue',kind:venueKind(v)})),food=regionalFood(country,venueKind(v));if(food)for(const q of def.interactables)if(q.effect==='eat')q.text='Enjoy '+food.slice(0,2).map(id=>TOYS[id].name).join(' or ')+'.';this.room=new TravelRoom(canvas,def,this.host.people(),this.host.player());
  }

  private useMappedService():void{const text=this.room?.use()??'',effect=this.room?.effect;let message=text;if(effect==='eat'){if(this.host.getCash()<12)message='A meal costs $12 in game money. You do not have enough cash.';else{this.host.setCash(this.host.getCash()-12);this.host.refresh?.('eat');message=text+' · $12 paid';}}else if(effect==='rest')this.host.refresh?.('rest');const msg=this.el.querySelector('.tv-msg');if(msg)msg.textContent=message;const wallet=this.el.querySelector('.tv-wallet b');if(wallet)wallet.textContent=money(this.host.getCash());}

  private doAct(a: Act): void {
    const cash = this.host.getCash();
    if (a.cost > cash) { this.msg = `Card declined for ${money(a.cost)}. ${this.comp ? this.comp.name + " pretends not to know you." : "Awkward."}`; this.render(); return; }
    if (a.cost) { this.host.setCash(cash - a.cost); this.spent += a.cost; }
    let out = a.out;
    if (a.kind === "photo") { const n = 8 + Math.floor(Math.random() * 17); this.photos += n; out = `+${n} photos for @mosaicscope. ${this.done.has(a.id) ? "Different angle, same magic." : out}`; }
    if (a.kind === "souvenir" && a.item) this.souvenirs.push(a.item);
    this.done.add(a.id);
    this.msg = out;
    this.line = this.comp ? pick(REACT[a.kind]).replace("{c}", this.comp.name) : pick(SOLO);
    this.render();
  }

  // ------------------------------------------------------------------ 6. return
  private summary(): string {
    return `Back from ${this.dest.name}${this.comp ? " with " + this.comp.name : ""}: ${this.photos} photo${this.photos === 1 ? "" : "s"} for @mosaicscope, ${this.souvenirs.length} souvenir${this.souvenirs.length === 1 ? "" : "s"}, ${money(this.spent)} spent.`;
  }

  private returnView(): void {
    const rows: [string, string][] = [["Destination", `${this.dest.name} (${this.dest.code})`], ["Crew", this.comp ? this.comp.name : "Solo"], ["Spent", money(this.spent)], ["Photos", `${this.photos} for @mosaicscope`], ["Souvenirs", this.souvenirs.length ? this.souvenirs.join(", ") : "None. Just memories (and a tan line)."]];
    this.scene("Arrivals · Christchurch", "Kia ora, welcome home", [
      this.makeCanvas("Christchurch arrivals hall with the Port Hills outside"),
      h("dl.tv-card", { "aria-label": "Trip summary" }, rows.flatMap(([k, v]) => [h("dt", { text: k }), h("dd", { text: v })])),
      h("p.tv-note", { text: this.souvenirs.length ? "The biosecurity beagle sniffs your souvenirs, finds nothing, and seems personally let down." : "The biosecurity beagle sniffs you anyway. Good boy." }),
    ], [this.btn("Back to the city", () => { const s = this.summary(); this.close(); this.host.onReturn(s, [...this.souvenirs], this.photos); }, { primary: true })]);
  }

  private drawHome(g: G, t: number): void {
    sky(g, "#0a1428", "#2a1a3a"); stars(g, t, 30);
    g.shadowBlur = 0; g.fillStyle = "#151022"; g.beginPath(); g.moveTo(0, 300); for (let x = 0; x <= W; x += 30) g.lineTo(x, 250 - Math.sin(x * 0.008) * 60 - Math.sin(x * 0.03) * 10); g.lineTo(W, 300); g.fill();
    g.fillStyle = "#0e0b0a"; g.fillRect(0, 300, W, H - 300);
    g.font = "900 54px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center"; neon(g, "#c6ff3d", 2, reduced() ? 14 : 10 + Math.sin(t * 3) * 6);
    g.fillText("KIA ORA · WELCOME TO ŌTAUTAHI", W / 2, 120); g.textAlign = "left";
    stick(g, 420, GROUND, 78, "#c6ff3d", t, { wave: true });
    if (this.comp) stick(g, 500, GROUND, 78, this.comp.color, t + 1, { wave: true });
    neon(g, "#f6b62c", 2, 8); g.strokeRect(560, 352, 46, 34); g.strokeRect(566, 344, 34, 8);
  }

  // ------------------------------------------------------------------ animation
  private frame(now: number): void {
    if(this.room){this.room.draw(now);return;}if(this.district){this.district.draw(now);return;}
    const c = this.canvas; if (!c || !c.isConnected) return;
    const g = c.getContext("2d"); if (!g) return;
    const el = (now - this.stageStart) / 1000, t = reduced() ? 0 : el;
    g.save(); g.clearRect(0, 0, W, H);
    switch (this.stage) {
      case "security": this.drawSecurity(g, t); break;
      case "flight": {
        const p = Math.min(1, el / (reduced() ? 4 : 10));
        this.drawFlight(g, t, p);
        const lines = this.flightLines(), idx = Math.floor(el / 3.3) % lines.length;
        if (idx !== this.lineIdx && this.lineEl) { this.lineIdx = idx; this.lineEl.textContent = lines[idx]; }
        if (p >= 1 && !this.landed) { this.landed = true; this.render(); }
        break;
      }
      case "dest": {
        this.dest.draw(g, t);
        stick(g, 420, GROUND, 74, "#c6ff3d", t, { wave: !!this.msg });
        if (this.comp) stick(g, 480, GROUND, 74, this.comp.color, t + 0.7, { wave: !!this.line });
        break;
      }
      case "return": this.drawHome(g, t); break;
    }
    g.restore();
  }
}
