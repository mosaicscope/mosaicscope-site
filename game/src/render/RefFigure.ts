import {impairment} from '../sim/Substances';
import {drawCatalogueHair} from './HairArt';
import {HAIR_VARIANTS} from '../content/hair';
import {drawFaceAccessories} from './FaceAccessories';
import {currentReactionFace,drawReactionMouth,drawReactionAccents} from './ReactionFaces';
import {drawEmotionDetail} from './NegativeReactions';
import {drawFaceDamage,drawBodyDamage,detachedOn,damageBloodEnabled} from "./DamageArt";
import type { Character } from "../entities/types";
import { Phys } from "../entities/types";
import type { ModelSpec } from "./Models";
import { EYE_SHAPES,modelOf } from "./Models";
import { drawFaceGenes } from "./FaceGenes";

/**
 * Street model drawn after the reference cartoon: a big round head with an ink outline, a black spiky tuft,
 * ears, big round eyes with pupils and a highlight, blush, an open expressive mouth, a narrow white body with a
 * navel and shorts, single-line arms and legs, mitten hands with fingers and black shoes.
 * The skeleton J comes from solve(), so poses, gaits and animation are unchanged. Each model keeps its own colours
 * and hair; the face follows the person's current emotion (c.emo) and knock-downs.
 */
type Ctx = CanvasRenderingContext2D;
const INK = "#121010", WHITE = "#f7f4ee";
const smallHeads=new Map<Character,{key:string;canvas:HTMLCanvasElement}>();
/** Small faces retain their artwork in a bounded retina cache; close-ups always render as vectors. */
function paintHead(g:Ctx,c:Character,M:ModelSpec,P:FacePlan,r:number,k:number,dir:number,lw:number,alpha:number,hd:boolean,flash:boolean):void{
 if(k>=.8||flash||typeof document==='undefined'){drawRefHead(g,c,M,P,moodOf(c),0,0,r,k,dir,lw,alpha,hd,flash);return;}
 const f=currentReactionFace(c),key=JSON.stringify([M.id,M.skin,M.hair,M.hairColor,M.hat,M.hatColor,M.face,M.gear,c.look.face,c.look.accessories,c.look.accessoryWear,c.combat?.helmet,Math.round(impairment(c)*8),moodOf(c),dir,hd,damageBloodEnabled(),f&&Object.values(f).map(v=>Math.round(v*100)),(c.wounds??[]).filter(w=>w.part==='head')]);
 let entry=smallHeads.get(c);
 if(!entry||entry.key!==key){
  const canvas=entry?.canvas??document.createElement('canvas');canvas.width=176;canvas.height=200;
  const ctx=canvas.getContext('2d');if(!ctx){drawRefHead(g,c,M,P,moodOf(c),0,0,r,k,dir,lw,alpha,hd,flash);return;}
  ctx.setTransform(2,0,0,2,88,100);drawRefHead(ctx,c,M,P,moodOf(c),0,0,r/k,1,dir,2.3,1,hd,false);entry={key,canvas};
 }
 smallHeads.delete(c);smallHeads.set(c,entry);if(smallHeads.size>192)smallHeads.delete(smallHeads.keys().next().value!);
 g.globalAlpha=alpha;g.drawImage(entry.canvas,-44*k,-50*k,88*k,100*k);
}
/** Limbs are pale lines so they read on the night street (the drawing's black ink would vanish on dark ground). */
const LIMB = "#eee4d3";
// eye slots (liner, glasses) are left out: the figure's own eyes already carry the style, and stacking both looked cluttered
const REAL_GENES = [3, 4, 9, 10, 11, 13] as const;

const SKINS = ["#f1c9a5", "#d9a173", "#c78d5f", "#a06a43", "#6e452b", "#efe3d6", "#dd9a7c", "#e8b48c"];
const SPECS = new WeakMap<Character, ModelSpec>();
const LOOK_KEYS = new WeakMap<Character,string>();
/**
 * A reference-look spec for someone without a street model (the Mosaics, the player, the locals), built from their
 * own look: their line colour becomes their top, their accent their shorts, plus their hair, hat and face.
 */
export function lookSpec(c: Character): ModelSpec {
  const key=JSON.stringify(c.look);
  let m = SPECS.get(c);
  if (m && LOOK_KEYS.get(c)===key) return m;
  LOOK_KEYS.set(c,key);
  const L = c.look, h = Math.imul(c.id + 7, 0x9e3779b1) >>> 0, F = L.face;
  m = {
    id: `look-${c.id}`, label: c.name, kind: L.kind === "girl" ? "girl" : "guy",
    skin: L.skin??SKINS[h % SKINS.length], pattern:L.pattern, patternColor:L.accent, top: L.top??"tee", topColor: L.color, trim: L.accent,
    bottom: L.bottom??"shorts", bottomColor: L.accent, shoes: L.shoes??"sneakers", shoeColor: L.shoeColor??L.accent,
    sw: 10, belly: (h >>> 8) % 3, limb: L.build ?? 1,
    hair: L.hair, hairColor:L.hairColor?? ["#1a1410", "#3a2a1e", "#6b4a2a", "#c9a56a", "#2a2018", "#8a8a8a"][(h >>> 4) % 6],
    hat: L.hat, hatColor: L.accent,
    face: F ?? { eyes: "dots", brows: "none", mouth: "smile", nose: "none", facial: "none", extra: "none", head: "round" },
    gear: (L.accessories??[]).filter((v):v is "headband"|"eyepatch"|"bandage"=>["headband","eyepatch","bandage"].includes(v)),
  };
  SPECS.set(c, m);
  return m;
}

/** A shirt pattern inside the clipped body: stripes, a centre stripe, a chest logo, two-tone, a chevron, a pocket, dots. */
function drawPattern(g: Ctx, n: number, col: string, hx: number, hy: number, ux: number, uy: number, px: number, py: number, bw: number, k: number): void {
  g.fillStyle = col; g.strokeStyle = col;
  const at = (t: number, w: number): [number, number] => [hx + ux * t + px * bw * w, hy + uy * t + py * bw * w];
  const band = (t0: number, t1: number) => { const a = at(t0, 2), b = at(t0, -2), c = at(t1, -2), d = at(t1, 2); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); };
  switch (n) {
    case 1: for (const t of [0.45, 0.62, 0.79]) band(t, t + 0.07); break;                                           // stripes
    case 2: { const a = at(0.3, 0.18), b = at(1, 0.18), c = at(1, -0.18), d = at(0.3, -0.18); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); break; } // centre stripe
    case 3: { const c = at(0.72, 0.25); g.beginPath(); g.arc(c[0], c[1], bw * 0.32, 0, 6.283); g.fill(); break; }  // chest logo
    case 4: { const a = at(0.2, 0), b = at(1.1, 0), c = at(1.1, 2), d = at(0.2, 2); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); break; } // two-tone
    case 5: { const a = at(0.95, 1.2), b = at(0.7, 0), c = at(0.95, -1.2); g.lineWidth = bw * 0.35; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke(); break; } // chevron
    case 6: { const c = at(0.75, -0.35); g.fillRect(c[0] - bw * 0.25, c[1] - bw * 0.2, bw * 0.5, bw * 0.45); break; } // pocket
    case 7: for (const [t, w] of [[0.5, 0.4], [0.62, -0.4], [0.75, 0.35], [0.88, -0.3], [0.62, 0.6], [0.85, 0.65]]) { const c = at(t, w); g.beginPath(); g.arc(c[0], c[1], Math.max(0.6, 0.7 * k), 0, 6.283); g.fill(); } break; // dots
  }
}

const TOPS = ["#e8554f", "#2b7bd6", "#19b3a8", "#f6b62c", "#7b4fd6", "#ff7ad9", "#c6ff3d", "#3dd6ff", "#1a1a1e", "#efe6d2", "#5b4a3a", "#d9382c", "#2f7d3a", "#f08a1c", "#8aa0b4", "#b48cff", "#ffd1dc", "#4a5a3a", "#a33b2f", "#0e7c86"];
const BOTTOMS = ["#3b4f73", "#1a1a1e", "#55657a", "#2a2f3a", "#6a4a2a", "#9fb4c8", "#3a3a30", "#d9c9a0", "#7a1c2c", "#2c4a8a", "#4a4f5a", "#e8e0cf"];
const HAIRS = ["#1a1410", "#2a2018", "#3a2a1e", "#6b4a2a", "#8a6a3a", "#c9a56a", "#e8d9a8", "#8a8a8a", "#d9d9d9", "#a0402a", "#ff4fa3", "#3dd6ff", "#c6ff3d", "#7b2cff"];
const SHOES = ["#1a1a1e", "#efefef", "#e8554f", "#2b7bd6", "#f6b62c", "#6b4a2a", "#3dd6ff", "#ff7ad9"];
const GUY_HAIR = ["spiky", "buzz", "curly", "mohawk", "afro", "none", "sidepart", "long", "big"] as const;
const GIRL_HAIR = ["long", "bob", "pony", "braids", "pigtails", "bun", "curly", "afro", "topknot", "spiky"] as const;
const HATS = ["cap", "beanie", "bucket", "bandana", "beret", "snapback", "headphones", "cowboy", "hood"] as const;
const FACIAL = ["mustache", "goatee", "beard", "stubble", "soulpatch"] as const;
const PERSONAL = new WeakMap<Character, ModelSpec>();

/**
 * Per-person variation on top of a model, from the person's id: shirt colour and pattern, shorts, shoes, skin, hair
 * colour and style, hats on and off, build and face extras. With the 20-value face plan on top, no two people match.
 * The Mosaics and the player keep their own look untouched.
 */
export function personalize(M: ModelSpec, c: Character): ModelSpec {
  if (c.tier === "principal" || c.mode === "player" || c.look.main) return M;
  let v = PERSONAL.get(c);
  if (v) return v;
  let h = (Math.imul(c.id + 0x51ed, 0x2c1b3c6d) ^ 0x6a09e667) | 0;
  const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const girl = M.kind === "girl" || (M.kind === "any" && c.look.kind === "girl");
  const face = { ...M.face };
  if (r() < 0.3) face.head = pick(["round", "oval", "wide"] as const);
  const ex = r();
  face.extra = ex < 0.14 ? "freckles" : ex < 0.22 ? "mole" : ex < 0.28 ? "scar" : ex < 0.4 ? "earrings" : ex < 0.46 ? "nosering" : ex < 0.52 ? "blush" : face.extra ?? "none";
  if (!girl && r() < 0.35) face.facial = pick(FACIAL);
  const hatRoll = r();
  v = {
    ...M,
    topColor: r() < 0.55 ? pick(TOPS) : M.topColor,
    pattern: Math.floor(r() * 8), patternColor: pick(TOPS),
    bottomColor: r() < 0.5 ? pick(BOTTOMS) : M.bottomColor,
    shoeColor: pick(SHOES),
    skin: r() < 0.6 ? pick(SKINS) : M.skin,
    hairColor: pick(HAIRS),
    hair: r() < 0.7 ? HAIR_VARIANTS[(c.id * 37) % HAIR_VARIANTS.length].id : pick(girl ? GIRL_HAIR : GUY_HAIR),
    hat: M.hat === "none" ? (hatRoll < 0.22 ? pick(HATS) : "none") : hatRoll < 0.3 ? "none" : M.hat,
    hatColor: pick(TOPS),
    belly: Math.floor(r() * 4), wide: 0.85 + r() * 0.35,
    face,
  };
  PERSONAL.set(c, v);
  return v;
}

type Mood = "neutral" | "happy" | "sad" | "angry" | "scared" | "stunned";
export function moodOf(c: Character): Mood {
  const e = c.emo;
  if (c.phys === Phys.DOWN || (e && e.composure < 0.2)) return "stunned";
  if (!e) return "neutral";
  if (e.fear > 0.6) return "scared";
  if (e.frustration > 0.6) return "angry";
  if (impairment(c) > .12) return "neutral";
  if (e.mood > 0.4) return "happy";
  if (e.mood < -0.4) return "sad";
  return "neutral";
}

export function drawRefFigure(g: Ctx, J: Float32Array, c: Character, M: ModelSpec, k: number, dir: number, alpha: number, hd: boolean, flash: boolean, gripped = false): void {
  const lw = Math.max(1.1, 2.3 * k);
  const ink = flash ? "#ffffff" : INK;
  g.globalAlpha = alpha; g.lineCap = "round"; g.lineJoin = "round";
  const line = (pts: number[], w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  // a soft pale halo under every line, so the black ink reads on the night street
  const halo = (pts: number[], w: number) => { if (!hd) return; line(pts, w + 1.6 * k, INK); }; // thin dark edge under each pale limb
  const limbCol = flash ? "#ffffff" : LIMB;

  // body frame: spine direction and its perpendicular (screen sideways for an upright figure)
  const hx = J[0], hy = J[1], sx = J[6], sy = J[7];
  const ux = sx - hx, uy = sy - hy, len = Math.hypot(ux, uy) || 1, px = -uy / len, py = ux / len;
  const bw = 5.2 * k * (0.9 + M.belly * 0.08) * (M.wide ?? 1); // half width

  // ---- legs and shoes (behind the body): hips apart, feet a little wider, as in the drawing
  for (const [kn, ft, side] of [[16, 18, -1], [20, 22, 1]] as const) {
    const o = bw * 0.55 * side, ox = px * o, oy = py * o;
    const rx = hx + ox, ry = hy + oy;
    const kp = [J[kn]+ox,J[kn+1]+oy], fp = [J[ft]+side*bw*.65,J[ft+1]];
    const detached=detachedOn(c,"leg",side);
    const pts = detached?[rx,ry,kp[0],kp[1]]:[rx, ry, kp[0], kp[1], fp[0], fp[1]];
    J[kn]=kp[0];J[kn+1]=kp[1];J[ft]=fp[0];J[ft+1]=fp[1];
    halo(pts, lw); line(pts, lw, limbCol);
    if(c.look.bottom&&['jeans','ripped','trackies','slacks'].includes(M.bottom)){line(pts,lw+2*k,ink);line(pts,lw,M.bottomColor);if(M.bottom==='trackies')line([rx,ry,kp[0],kp[1]],.6*k,M.trim);if(M.bottom==='ripped')line([kp[0]-2*k,kp[1],kp[0]+2*k,kp[1]],1.5*k,limbCol);}
    if(detached)continue;
    g.fillStyle = flash ? "#ffffff" : INK;
    const fx0 = pts[4], fy0 = pts[5];
    if(c.look.shoes&&['boots','workboots'].includes(M.shoes)){g.fillStyle=M.shoeColor;g.fillRect(fx0-3*k,fy0-7*k,6*k,7*k);g.strokeStyle=ink;g.strokeRect(fx0-3*k,fy0-7*k,6*k,7*k);}
    g.fillStyle=c.look.shoes&&M.shoes==='bare'?M.skin:flash?'#fff':INK;
    g.beginPath(); g.ellipse(fx0 + 2.5 * k * side, fy0 + 0.5 * k, (M.shoes==='heels'?4:5.2)*k, (['bare','sandals','jandals'].includes(M.shoes)?1.5:2.6)*k, 0, 0, 6.283); g.fill();
    if(c.look.shoes&&M.shoes==='heels'){g.fillStyle=M.shoeColor;g.fillRect(fx0-k,fy0,2*k,5*k);}
    g.strokeStyle = flash ? "#ffffff" : M.shoeColor; g.lineWidth = Math.max(0.7, 0.9 * k); g.stroke(); // shoe edge in the model's shoe colour
    if (hd) { // little motion ticks at the feet, as in the drawing
      g.strokeStyle = "rgba(238,228,211,.55)"; g.lineWidth = Math.max(0.6, 0.8 * k); g.beginPath();
      for (const a of side < 0 ? [-2.4, -2.0, -1.6] : [-1.5, -1.1, -0.7]) { g.moveTo(fx0 + Math.cos(a) * 7 * k, fy0 + Math.sin(a) * 4 * k); g.lineTo(fx0 + Math.cos(a) * 10 * k, fy0 + Math.sin(a) * 6 * k); }
      g.stroke();
    }
  }

  if(c.look.accessories?.includes("backpack")){g.fillStyle=M.trim;g.strokeStyle=INK;g.lineWidth=1.5*k;g.beginPath();g.roundRect(sx-bw-8*k,sy+5*k,18*k,27*k,5*k);g.fill();g.stroke();}
  // ---- body: narrow rounded torso, navel, shorts
  const body = (inset: number) => {
    g.beginPath();
    g.moveTo(sx + px * (bw - inset) * 0.85, sy + py * (bw - inset) * 0.85);
    g.quadraticCurveTo(hx + ux * 0.5 + px * (bw - inset) * 1.15, hy + uy * 0.5 + py * (bw - inset) * 1.15, hx + px * (bw - inset), hy + py * (bw - inset) + 2 * k);
    g.lineTo(hx - px * (bw - inset), hy - py * (bw - inset) + 2 * k);
    g.quadraticCurveTo(hx + ux * 0.5 - px * (bw - inset) * 1.15, hy + uy * 0.5 - py * (bw - inset) * 1.15, sx - px * (bw - inset) * 0.85, sy - py * (bw - inset) * 0.85);
    g.quadraticCurveTo(sx + ux * 0.12, sy + uy * 0.12, sx + px * (bw - inset) * 0.85, sy + py * (bw - inset) * 0.85);
    g.closePath();
  };
  if (hd) { g.globalAlpha = alpha * 0.35; g.strokeStyle = "#eee4d3"; g.lineWidth = lw + 3 * k; body(0); g.stroke(); g.globalAlpha = alpha; }
  g.fillStyle = flash ? "#ffffff" : M.top === "bare" ? M.skin : M.topColor === "#f4f1ea" ? WHITE : M.topColor;
  body(0); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.9; g.stroke();
  // shorts: the lower third of the body in the model's bottom colour (the shirt pattern goes on first, under them)
  g.save(); body(0); g.clip();
  if (M.pattern && hd) drawPattern(g, M.pattern, flash ? "#ffffff" : M.patternColor ?? M.trim, hx, hy, ux, uy, px, py, bw, k);
  g.fillStyle = flash ? "#ffffff" : M.bottomColor;
  const cut = 0.32;
  g.beginPath(); g.moveTo(hx + ux * cut + px * bw * 2, hy + uy * cut + py * bw * 2); g.lineTo(hx + ux * cut - px * bw * 2, hy + uy * cut - py * bw * 2);
  g.lineTo(hx - px * bw * 2 - ux * 0.3, hy - py * bw * 2 - uy * 0.3); g.lineTo(hx + px * bw * 2 - ux * 0.3, hy + py * bw * 2 - uy * 0.3); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = ink; g.lineWidth = lw * 0.9; body(0); g.stroke();
  if(c.look.top){
    const col=flash?'#fff':M.trim;
    if(['suit','coat','hoodie','vest'].includes(M.top)){line([sx,sy+4*k,hx,hy],1.2*k,col);for(const side of[-1,1])line([sx+side*bw*.7,sy+3*k,sx+side*bw*.35,sy+12*k],k,col);}
    if(['apron','dress','poncho'].includes(M.top)){g.fillStyle=M.top==='apron'?col:M.topColor;g.strokeStyle=ink;g.beginPath();g.moveTo(sx-3*k,sy+5*k);g.lineTo(sx+3*k,sy+5*k);g.lineTo(hx+9*k,hy+6*k);g.lineTo(hx-9*k,hy+6*k);g.closePath();g.fill();g.stroke();}
    if(['thobe','abaya','kurta','sari'].includes(M.top)){const hem=M.top==='kurta'?hy+16*k:Math.min(J[19],J[23])-3*k;g.fillStyle=M.topColor;g.strokeStyle=ink;g.lineWidth=k;g.beginPath();g.moveTo(sx-bw*.8,sy+4*k);g.lineTo(sx+bw*.8,sy+4*k);g.lineTo(hx+9*k,hem);g.lineTo(hx-9*k,hem);g.closePath();g.fill();g.stroke();line([sx,sy+4*k,hx,hy+10*k],.9*k,col);if(M.top==='sari')line([sx+bw,sy+2*k,hx-7*k,hy+5*k,hx-8*k,hem],3*k,col);else{line([sx-3*k,sy+4*k,sx,sy+8*k,sx+3*k,sy+4*k],k,col);}}
    if(M.top==='jersey')line([sx-bw,sy+14*k,sx+bw,sy+14*k],4*k,col);
    if(M.top==='hawaiian'){for(let i=0;i<3;i++){g.fillStyle=col;g.beginPath();g.arc(sx+(i%2?2:-2)*k,sy+(8+i*7)*k,2*k,0,7);g.fill();}}
  }
  if(c.look.bottom&&['skirt','kilt'].includes(M.bottom)){g.fillStyle=M.bottomColor;g.strokeStyle=ink;g.beginPath();g.moveTo(hx-bw,hy-6*k);g.lineTo(hx+bw,hy-6*k);g.lineTo(hx+9*k,hy+10*k);g.lineTo(hx-9*k,hy+10*k);g.closePath();g.fill();g.stroke();if(M.bottom==='kilt')for(let i=-6;i<=6;i+=4)line([hx+i*k,hy-4*k,hx+i*k,hy+9*k],k,M.trim);}
  // navel
  g.fillStyle = ink; g.beginPath(); g.ellipse(hx + ux * 0.42, hy + uy * 0.42, 0.9 * k, 0.6 * k, 0, 0, 6.283); g.fill();

  if(c.look.accessories?.includes("bowtie")){g.fillStyle=M.trim;g.beginPath();g.moveTo(sx,sy+7*k);g.lineTo(sx-7*k,sy+2*k);g.lineTo(sx-7*k,sy+12*k);g.lineTo(sx+7*k,sy+2*k);g.lineTo(sx+7*k,sy+12*k);g.closePath();g.fill();}
  if(c.look.accessories?.includes("chain")){g.strokeStyle='#d9b75e';g.lineWidth=1.7*k;g.beginPath();g.moveTo(sx-5*k,sy+3*k);g.quadraticCurveTo(sx,sy+20*k,sx+5*k,sy+3*k);g.stroke();}
  if(c.look.accessories?.includes("scarf")){g.strokeStyle=M.trim;g.lineWidth=5*k;g.beginPath();g.moveTo(sx-6*k,sy);g.lineTo(sx+6*k,sy);g.lineTo(sx+5*k,sy+24*k);g.stroke();}
  // ---- arms and mitten hands
  for (const [el, hn, side] of [[8, 10, -1], [12, 14, 1]] as const) { // arms leave from each shoulder and splay outward
    const o = bw * 0.85 * side, ox = px * o, oy = py * o;
    const rx = sx + ox, ry = sy + oy;
    const ep = gripped ? [J[el], J[el+1]] : [J[el] + ox, J[el + 1] + oy], hp = gripped ? [J[hn],J[hn+1]] : [J[hn] + ox, J[hn + 1] + oy];
    const detached=detachedOn(c,"arm",side);
    const pts = detached?[rx,ry,ep[0],ep[1]]:[rx, ry, ep[0], ep[1], hp[0], hp[1]];
    halo(pts, lw); line(pts, lw, limbCol);
    if(c.look.top&&!['tank','bare','vest'].includes(M.top)){const long=['long','coat','hoodie','suit','thobe','abaya','kurta'].includes(M.top);line([rx,ry,ep[0],ep[1],...(long&&!detached?[hp[0],hp[1]]:[])],lw+2*k,ink);line([rx,ry,ep[0],ep[1],...(long&&!detached?[hp[0],hp[1]]:[])],lw,flash?'#fff':M.topColor);}
    J[el]=ep[0];J[el+1]=ep[1];
    if(detached){J[hn]=ep[0];J[hn+1]=ep[1];continue;}
    const ax = pts[4] - pts[2], ay = pts[5] - pts[3], al = Math.hypot(ax, ay) || 1, dx = ax / al, dy = ay / al;
    const cx = pts[4] + dx * (gripped ? 0 : 2 * k), cy = pts[5] + dy * (gripped ? 0 : 2 * k);
    J[el]=ep[0];J[el+1]=ep[1];J[hn]=cx;J[hn+1]=cy;
    g.fillStyle = limbCol; g.strokeStyle = INK; g.lineWidth = Math.max(0.6, 0.8 * k); g.beginPath(); g.arc(cx, cy, 2.2 * k, 0, 6.283); g.fill(); g.stroke();
    g.strokeStyle = limbCol; g.lineWidth = Math.max(0.7, 1.15 * k); g.lineCap="round"; g.beginPath();
    for (const a of (gripped ? [] : [-0.65, -0.22, 0.22, 0.65])) { // four splayed fingers
      const fa = Math.atan2(dy, dx) + a, fl = 3.5 * k;
      g.moveTo(cx + Math.cos(fa) * 2 * k, cy + Math.sin(fa) * 2 * k); g.lineTo(cx + Math.cos(fa) * fl, cy + Math.sin(fa) * fl);
    }
    g.stroke();
  }

  if(c.look.accessories?.includes("watch")){g.fillStyle='#d0bb7a';g.strokeStyle=INK;g.lineWidth=k;g.beginPath();g.arc(J[14],J[15],3.5*k,0,Math.PI*2);g.fill();g.stroke();}
  if(c.crew&&c.role==='mobster'&&k>.35){const x=(sx+hx)/2,y=(sy+hy)/2;g.save();g.translate(x,y);g.fillStyle='#202522';g.strokeStyle=M.trim;g.lineWidth=.7*k;g.beginPath();g.roundRect(-4*k,-5*k,8*k,8*k,2*k);g.fill();g.stroke();g.fillStyle=M.trim;g.font=`700 ${4*k}px Arial`;g.textAlign='center';g.fillText(c.crew.slice(0,2).toUpperCase(),0,k);g.restore();}
  drawBodyDamage(g,c,J,k);
  // ---- neck and head
  const nx = J[2], ny = J[3];
  const hdx = J[4] - nx, hdy = J[5] - ny, hl = Math.hypot(hdx, hdy) || 1;
  const P = facePlan(c.look.face?.gene ?? c.id * 2654435761);
  const r = 15 * k * P.size; // big round head, as in the drawing
  const x = nx + (hdx / hl) * (r + 2 * k), y = ny + (hdy / hl) * (r + 2 * k);
  halo([nx, ny, x - (hdx / hl) * r, y - (hdy / hl) * r], lw); line([nx, ny, x - (hdx / hl) * r, y - (hdy / hl) * r], lw, limbCol);
  J[4]=x;J[5]=y;
  g.save();g.translate(x,y);g.rotate(Math.atan2(hdx,-hdy));
  paintHead(g,c,M,P,r,k,dir,lw,alpha,hd,flash);g.restore();
  g.globalAlpha = alpha;
}

/**
 * Continuous face proportions for one person, from their face gene (or id): eye size, spacing, height and tilt,
 * pupil size, brow weight, lift and length, nose type and size, mouth width and lip, ears, head width and jaw,
 * cheek colour, freckles and hair density. About 20 continuous values, so the pool of faces is effectively endless;
 * the model's own traits and the 14-slot face genes (FaceGenes.ts) layer on top.
 */
export interface FacePlan {
  size: number; wide: number; tall: number; jaw: number;
  eyeR: number; eyeSep: number; eyeY: number; eyeTilt: number; pupil: number; lid: number;
  browW: number; browY: number; browLen: number; browTilt: number;
  nose: number; noseSize: number; mouthW: number; mouthY: number; lip: number;
  ear: number; blush: number; freckles: number; spikes: number; spikeLen: number;
}
export function facePlan(seed: number): FacePlan {
  let h = (seed | 0) ^ 0x2545f491;
  const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const span = (a: number, b: number) => a + r() * (b - a);
  return {
    size: span(0.92, 1.08), wide: span(0.88, 1.08), tall: span(0.95, 1.12), jaw: span(0, 1),
    eyeR: span(0.22, 0.34), eyeSep: span(0.32, 0.42), eyeY: span(-0.08, 0.08), eyeTilt: span(-0.18, 0.18), pupil: span(0.38, 0.56), lid: span(0, 0.25),
    browW: span(0.7, 1.6), browY: span(1.5, 2.0), browLen: span(0.45, 0.75), browTilt: span(-0.25, 0.25),
    nose: Math.floor(r() * 5), noseSize: span(0.8, 1.3), mouthW: span(0.42, 0.56), mouthY: span(0.5, 0.58), lip: span(0, 1),
    ear: span(0.15, 0.24), blush: span(0, 0.35), freckles: r() < 0.25 ? span(0.3, 1) : 0, spikes: 5 + Math.floor(r() * 7), spikeLen: span(0.7, 1.3),
  };
}

function drawRefHead(g: Ctx, c: Character, M: ModelSpec, P: FacePlan, mood: Mood, x: number, y: number, r: number, k: number, dir: number, lw: number, alpha: number, hd: boolean, flash: boolean): void {
  const ink = flash ? "#ffffff" : INK, skin = flash ? "#ffffff" : M.skin, hairCol = flash ? "#ffffff" : M.hairColor;
  const F = M.face, ES = EYE_SHAPES[M.id],expression=currentReactionFace(c);
  const rx = r * P.wide * (F.head === "wide" ? 1.08 : 1), ry = r * P.tall * (F.head === "oval" ? 1.1 : 1);
  const dot = (px: number, py: number, rr: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(px, py, rr, 0, 6.283); g.fill(); };
  // ears
  for (const s of [-1, 1]) {
    g.fillStyle = skin; g.strokeStyle = ink; g.lineWidth = lw * 0.8;
    g.beginPath(); g.ellipse(x + s * rx * 0.98, y + ry * 0.08, r * P.ear, r * P.ear * 1.25, 0, 0, 6.283); g.fill(); g.stroke();
    if (F.extra === "earrings" || c.look.accessories?.includes("earrings")) { g.strokeStyle = "#f6b62c"; g.lineWidth = lw * 0.6; g.beginPath(); g.arc(x + s * rx * 0.98, y + ry * 0.08 + r * P.ear * 1.4, r * 0.07, 0, 6.283); g.stroke(); }
  }
  // head: round top, jaw from soft (0) to square (1)
  const headPath = () => {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, Math.PI, 0);
    const jw = rx * (0.72 + P.jaw * 0.2);
    g.bezierCurveTo(x + rx, y + ry * 0.75, x + jw, y + ry * (0.95 + P.jaw * 0.08), x, y + ry * (1.0 + P.jaw * 0.05));
    g.bezierCurveTo(x - jw, y + ry * (0.95 + P.jaw * 0.08), x - rx, y + ry * 0.75, x - rx, y);
    g.closePath();
  };
  if (hd) { g.globalAlpha = alpha * 0.35; g.strokeStyle = "#eee4d3"; g.lineWidth = lw + 3 * k; headPath(); g.stroke(); g.globalAlpha = alpha; }
  g.fillStyle = skin; g.strokeStyle = ink; g.lineWidth = lw; headPath(); g.fill(); g.stroke();
  if (hd) { g.save(); headPath(); g.clip(); g.fillStyle = "rgba(0,0,0,.1)"; g.beginPath(); g.ellipse(x - rx * 0.55 * dir, y + ry * 0.2, rx * 0.7, ry * 1.1, 0, 0, 6.283); g.fill(); g.restore(); } // soft shade on the far side

  // hair: a spiky tuft in the model's hair colour, density and length per person; hats replace the tuft
  const hatted = M.hat !== "none";
  if (M.hair !== "none" && !hatted && !drawCatalogueHair(g,M.hair,x,y,rx,ry,hairCol,ink)) {
    const n = M.hair === "buzz" ? P.spikes + 2 : P.spikes;
    const len = (M.hair === "buzz" ? 0.14 : M.hair === "spiky" || M.hair === "mohawk" ? 0.5 : M.hair === "curly" || M.hair === "afro" ? 0.3 : 0.38) * P.spikeLen;
    g.fillStyle = hairCol; g.beginPath();
    g.moveTo(x - rx * 0.9, y - ry * 0.42);
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (1.12 + (i / n) * 0.76), tip = a + 0.12 * dir;
      g.lineTo(x + Math.cos(tip) * rx * (1 + len), y + Math.sin(tip) * ry * (1 + len));
      const b = Math.PI * (1.12 + ((i + 0.5) / n) * 0.76);
      if (i < n) g.lineTo(x + Math.cos(b) * rx * 0.92, y + Math.sin(b) * ry * 0.92);
    }
    g.lineTo(x + rx * 0.9, y - ry * 0.42);
    g.quadraticCurveTo(x + rx * 0.2 * dir, y - ry * 0.72, x - rx * 0.9, y - ry * 0.42);
    g.closePath(); g.fill();
  }
  if (M.hair === "long" || M.hair === "braids" || M.hair === "bob" || M.hair === "pony" || M.hair === "pigtails") { g.strokeStyle = hairCol; g.lineWidth = lw * 1.6; g.beginPath(); g.moveTo(x - rx * 0.95, y - ry * 0.2); g.lineTo(x - rx * 1.02, y + ry * (M.hair === "bob" ? 0.6 : 1.1)); g.moveTo(x + rx * 0.95, y - ry * 0.2); g.lineTo(x + rx * 1.02, y + ry * (M.hair === "bob" ? 0.6 : 1.1)); g.stroke(); }
  if (hatted) drawHat(g, M, x, y, rx, ry, dir, lw, ink, flash);

  // face, shifted a touch toward where they look
  const fx = x + r * 0.06 * dir, ey = y + r * (0.02 + P.eyeY), sep = r * P.eyeSep;
  const eR = r * P.eyeR * (ES ? 0.85 + ES.w * 0.15 : 1);
  // cheeks and freckles
  g.fillStyle = F.extra === "blush" ? "rgba(255,110,140,.45)" : `rgba(220,120,120,${(0.12 + P.blush * 0.4).toFixed(2)})`;
  for (const s of [-1, 1]) { g.beginPath(); g.arc(fx + s * r * 0.56, y + r * 0.34, r * 0.14, 0, 6.283); g.fill(); }
  if (P.freckles > 0 || F.extra === "freckles") { const n = F.extra === "freckles" ? 5 : Math.round(P.freckles * 4); for (const s of [-1, 1]) for (let i = 0; i < n; i++) dot(fx + s * r * (0.4 + (i % 3) * 0.08), y + r * (0.2 + Math.floor(i / 3) * 0.08 + (i % 2) * 0.03), r * 0.025, "rgba(120,60,40,.7)"); }

  // eyes: per-person size, spacing and tilt; the model's eye kind sets a resting lid; the mood can override it all
  const restLid = Math.max(impairment(c)*.65, P.lid, ES ? (ES.kind === "heavy" ? ES.lid + 0.15 : ES.kind === "closed" ? 0.5 : ES.kind === "cross" ? 0.25 : 0) : 0);
  const eyeH = ES ? (ES.kind === "slit" ? 0.7 : ES.kind === "almond" ? 0.8 : 1) * (0.85 + ES.h * 0.15) : 1;
  for (const s of [-1, 1]) {
    const ex = fx + s * sep;
    if (F.eyes === "shades" || F.eyes === "aviator") { g.fillStyle = ink; g.beginPath(); g.ellipse(ex, ey, eR * 1.2, eR * 0.85, 0, 0, 6.283); g.fill(); if (s > 0) { g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(fx - sep + eR, ey); g.lineTo(fx + sep - eR, ey); g.stroke(); } continue; }
    if (mood === "stunned"&&!expression) {
      g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.moveTo(ex - eR * 0.6, ey - eR * 0.6); g.lineTo(ex + eR * 0.6, ey + eR * 0.6); g.moveTo(ex + eR * 0.6, ey - eR * 0.6); g.lineTo(ex - eR * 0.6, ey + eR * 0.6); g.stroke();
      continue;
    }
    if (mood === "happy"&&!expression) { g.strokeStyle = ink; g.lineWidth = lw; g.beginPath(); g.arc(ex, ey + eR * 0.3, eR * 0.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
    const open = (expression?(s<0?expression.eyeL:expression.eyeR):(mood === "scared" ? 1.15 : mood === "angry" ? 0.85 : 1))*eyeH;
    if(expression&&open<.18){g.strokeStyle=ink;g.lineWidth=lw*.8;g.beginPath();g.moveTo(ex-eR,ey);g.quadraticCurveTo(ex,ey+eR*.25,ex+eR,ey);g.stroke();continue;}
    const tilt = s * (P.eyeTilt + (ES ? ES.tilt * 0.5 : 0));
    g.fillStyle = flash ? "#ffffff" : WHITE; g.strokeStyle = ink; g.lineWidth = lw * 0.85;
    g.beginPath(); g.ellipse(ex, ey, eR, eR * open, tilt, 0, 6.283); g.fill(); g.stroke();
    const pr = eR * (expression?Math.min(.45,open*.55):mood === "scared" ? 0.3 : P.pupil), pdx = expression?expression.pupilX*eR*.45:r*.05*dir+(ES?ES.pupil*eR*.3*dir:0), pdy = expression?expression.pupilY*eR*.35:mood === "sad" ? eR*.2:0;
    dot(ex + pdx, ey + pdy, pr, ink);
    dot(ex + pdx - pr * 0.35, ey + pdy - pr * 0.35, pr * 0.3, WHITE);
    // lids: resting lid per person, deeper for angry and sad
    const lidIn = mood === "angry" ? 0.45 : mood === "sad" ? 0.1 : mood === "scared" ? 0 : restLid;
    const lidOut = mood === "angry" ? 0.1 : mood === "sad" ? 0.45 : mood === "scared" ? 0 : restLid;
    if (!expression&&(lidIn > 0.02 || lidOut > 0.02)) {
      g.save(); g.beginPath(); g.ellipse(ex, ey, eR, eR * open, tilt, 0, 6.283); g.clip();
      g.fillStyle = skin; g.beginPath();
      g.moveTo(ex - s * eR * 1.2, ey - eR * open + lidIn * 2 * eR * open); g.lineTo(ex + s * eR * 1.2, ey - eR * open + lidOut * 2 * eR * open);
      g.lineTo(ex + s * eR * 1.2, ey - eR * 3); g.lineTo(ex - s * eR * 1.2, ey - eR * 3); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(ex - s * eR * 1.2, ey - eR * open + lidIn * 2 * eR * open); g.lineTo(ex + s * eR * 1.2, ey - eR * open + lidOut * 2 * eR * open); g.stroke();
      g.restore();
    }
    if (ES?.lash) { g.strokeStyle = ink; g.lineWidth = lw * 0.5; g.beginPath(); for (const t of [0, 0.35, 0.7]) { const a = -Math.PI / 2 + s * (0.6 + t * 0.6); g.moveTo(ex + Math.cos(a) * eR, ey + Math.sin(a) * eR * open); g.lineTo(ex + Math.cos(a) * eR * 1.35, ey + Math.sin(a) * eR * open * 1.35); } g.stroke(); }
  }
  // brows: weight, height, length and slant per person; the model's brow style and the mood bend them
  const browStyle = mood === "angry" ? "angry" : mood === "sad" || mood === "scared" ? "worried" : F.brows;
  g.strokeStyle = flash ? "#ffffff" : M.hair === "none" ? ink : hairCol; g.lineWidth = lw * P.browW * (F.brows === "thick" ? 1.4 : 1); g.beginPath();
  for (const s of [-1, 1]) {
    const bx = fx + s * sep, by = ey - eR * P.browY + (expression?expression.browY*eR:mood === "scared" ? -eR*.3:0), L = eR * P.browLen * 1.4;
    if(expression){const slope=s<0?expression.browL:expression.browR;g.moveTo(bx-L,by-slope*eR*.5);g.quadraticCurveTo(bx,by-eR*.15,bx+L,by+slope*eR*.5);continue;}
    const inner = browStyle === "angry" ? eR * 0.45 : browStyle === "worried" ? -eR * 0.4 : browStyle === "raised" ? -eR * 0.15 : P.browTilt * eR;
    const outer = browStyle === "raised" ? -eR * 0.15 : 0;
    g.moveTo(bx - s * L, by + inner); g.quadraticCurveTo(bx, by - eR * 0.15 + (inner + outer) * 0.3, bx + s * L, by + outer);
  }
  g.stroke();
  // nose: five shapes, sized per person, or the model's own
  const nT = F.nose === "dot" ? 0 : F.nose === "line" ? 1 : F.nose === "hook" ? 2 : P.nose;
  const nx = fx + r * 0.05 * dir, ny = y + r * 0.3, ns = r * 0.09 * P.noseSize;
  g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.beginPath();
  switch (nT) {
    case 0: g.moveTo(nx - ns, ny + ns * 0.4); g.quadraticCurveTo(nx, ny + ns * 1.2, nx + ns, ny + ns * 0.4); break;            // button
    case 1: g.moveTo(nx, ny - ns * 1.6); g.lineTo(nx + ns * 0.8 * dir, ny + ns * 0.6); g.lineTo(nx - ns * 0.2 * dir, ny + ns * 0.7); break; // straight
    case 2: g.moveTo(nx, ny - ns * 1.8); g.quadraticCurveTo(nx + ns * 1.8 * dir, ny + ns * 0.2, nx, ny + ns * 0.8); break;      // hooked
    case 3: g.moveTo(nx - ns * 0.9, ny + ns * 0.3); g.arc(nx, ny + ns * 0.3, ns * 0.9, Math.PI, 0, true); break;               // round
    default: g.moveTo(nx - ns * 0.6, ny + ns * 0.5); g.lineTo(nx + ns * 0.6, ny + ns * 0.5);                                    // flat bridge
  }
  g.stroke();
  if (F.extra === "nosering") { g.strokeStyle = "#f6b62c"; g.lineWidth = lw * 0.5; g.beginPath(); g.arc(nx + ns * 0.6 * dir, ny + ns * 0.9, ns * 0.4, 0, Math.PI); g.stroke(); }

  // mouth: width and lip per person; the mood sets the shape
  const mx = fx, my = y + r * P.mouthY, mw = r * P.mouthW;
  g.lineWidth = lw * (0.75 + P.lip * 0.4);
  if(expression)drawReactionMouth(g,expression,mx,my,mw,ink,WHITE);else switch (mood) {
    case "scared": case "stunned": {
      g.fillStyle = ink; g.beginPath(); g.ellipse(mx, my, mw * 0.85, mw * 0.65, 0, 0, 6.283); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.ellipse(mx, my - mw * 0.42, mw * 0.55, mw * 0.16, 0, 0, Math.PI, true); g.fill();
      g.fillStyle = "#e0505a"; g.beginPath(); g.ellipse(mx, my + mw * 0.32, mw * 0.45, mw * 0.25, 0, 0, Math.PI, true); g.fill();
      break;
    }
    case "happy": {
      g.fillStyle = ink; g.beginPath(); g.moveTo(mx - mw, my - mw * 0.3); g.quadraticCurveTo(mx, my + mw * 1.3, mx + mw, my - mw * 0.3); g.closePath(); g.fill();
      g.fillStyle = WHITE; g.beginPath(); g.moveTo(mx - mw * 0.8, my - mw * 0.22); g.lineTo(mx + mw * 0.8, my - mw * 0.22); g.lineTo(mx + mw * 0.6, my + mw * 0.05); g.lineTo(mx - mw * 0.6, my + mw * 0.05); g.closePath(); g.fill();
      break;
    }
    case "angry": {
      g.fillStyle = WHITE; g.strokeStyle = ink; g.beginPath(); g.rect(mx - mw * 0.8, my - mw * 0.3, mw * 1.6, mw * 0.6); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(mx - mw * 0.8, my); g.lineTo(mx + mw * 0.8, my); for (const t of [-0.4, 0, 0.4]) { g.moveTo(mx + mw * t, my - mw * 0.3); g.lineTo(mx + mw * t, my + mw * 0.3); } g.stroke();
      break;
    }
    case "sad": { g.strokeStyle = ink; g.beginPath(); g.moveTo(mx - mw * 0.7, my + mw * 0.3); g.quadraticCurveTo(mx, my - mw * 0.45, mx + mw * 0.7, my + mw * 0.3); g.stroke(); break; }
    default: { // the model's resting mouth
      g.strokeStyle = ink; g.beginPath();
      if (F.mouth === "flat") { g.moveTo(mx - mw * 0.6, my); g.lineTo(mx + mw * 0.6, my); }
      else if (F.mouth === "smirk") { g.moveTo(mx - mw * 0.6, my + mw * 0.05); g.quadraticCurveTo(mx + mw * 0.1, my + mw * 0.2, mx + mw * 0.7, my - mw * 0.25); }
      else if (F.mouth === "frown") { g.moveTo(mx - mw * 0.6, my + mw * 0.2); g.quadraticCurveTo(mx, my - mw * 0.25, mx + mw * 0.6, my + mw * 0.2); }
      else if (F.mouth === "o") { g.arc(mx, my, mw * 0.3, 0, 6.283); }
      else if ((c.emo?.mood ?? 0) < 0.2) {
        // not everyone is grinning: a closed mouth that follows the mood, varied per person
        const m = c.emo?.mood ?? 0, v = (Math.imul(c.id + 7, 2654435761) >>> 0) % 3;
        if (m < -0.15) { g.moveTo(mx - mw * 0.55, my + mw * 0.15); g.quadraticCurveTo(mx, my - mw * 0.15, mx + mw * 0.55, my + mw * 0.15); }   // a bit down
        else if (v === 0) { g.moveTo(mx - mw * 0.6, my); g.quadraticCurveTo(mx, my + mw * 0.35, mx + mw * 0.6, my); }                    // slight smile
        else if (v === 1) { g.moveTo(mx - mw * 0.55, my + mw * 0.05); g.lineTo(mx + mw * 0.55, my + mw * 0.05); }                         // flat
        else { g.moveTo(mx - mw * 0.55, my + mw * 0.05); g.quadraticCurveTo(mx + mw * 0.1, my + mw * 0.15, mx + mw * 0.6, my - mw * 0.2); } // smirk
      }
      else { // in a good mood: the comic big open smile with teeth and a tongue, like the reference
        g.fillStyle = ink; g.moveTo(mx - mw * 0.85, my - mw * 0.2); g.quadraticCurveTo(mx, my + mw * 1.3, mx + mw * 0.85, my - mw * 0.2); g.closePath(); g.fill();
        g.save(); g.clip();
        g.fillStyle = WHITE; g.fillRect(mx - mw, my - mw * 0.3, mw * 2, mw * 0.28);
        dot(mx, my + mw * 0.62, mw * 0.42, "#e0505a");
        g.restore();
        g.beginPath();
      }
      g.stroke();
      if (F.mouth === "tongue") dot(mx + mw * 0.1, my + mw * 0.3, mw * 0.22, "#e0505a");
    }
  }
  // facial hair in the hair colour
  g.fillStyle = hairCol; g.strokeStyle = hairCol;
  switch (F.facial) {
    case "mustache": g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(mx - mw * 0.8, my - mw * 0.25); g.quadraticCurveTo(mx, my - mw * 0.65, mx + mw * 0.8, my - mw * 0.25); g.stroke(); break;
    case "goatee": g.beginPath(); g.moveTo(mx - mw * 0.35, my + mw * 0.5); g.lineTo(mx + mw * 0.35, my + mw * 0.5); g.lineTo(mx, my + mw * 1.3); g.closePath(); g.fill(); break;
    case "soulpatch": g.fillRect(mx - mw * 0.12, my + mw * 0.4, mw * 0.24, mw * 0.3); break;
    case "beard": g.save(); headPath(); g.clip(); g.globalAlpha = alpha * 0.9; g.beginPath(); g.ellipse(x, y + ry * 0.95, rx * 1.05, ry * 0.55, 0, Math.PI, 0, true); g.lineTo(x + rx * 1.05, y + ry * 0.35); g.fill(); g.globalAlpha = alpha; g.fillStyle = skin; g.beginPath(); g.ellipse(mx, my, mw * 0.8, mw * 0.4, 0, 0, 6.283); g.fill(); g.restore(); break;
    case "stubble": g.globalAlpha = alpha * 0.55; for (let i = 0; i < 14; i++) dot(x + (i / 13 - 0.5) * rx * 1.4, y + ry * (0.62 + Math.abs(i / 13 - 0.5) * -0.35 + (i % 2) * 0.05), r * 0.02, hairCol); g.globalAlpha = alpha; break;
  }
  // marks
  if (F.extra === "scar") { g.strokeStyle = "#b03030"; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(fx + sep - eR * 0.4, ey - eR * 2); g.lineTo(fx + sep + eR * 0.5, ey + eR * 1.6); g.stroke(); }
  if (F.extra === "mole") dot(mx + mw * 0.9 * dir, my - mw * 0.4, r * 0.03, ink);
  if (F.extra === "tattoo") { g.strokeStyle = "#2a8ab0"; g.lineWidth = lw * 0.5; g.beginPath(); g.moveTo(fx - sep - eR, y + r * 0.2); g.lineTo(fx - sep - eR * 0.6, y + r * 0.35); g.lineTo(fx - sep - eR * 1.1, y + r * 0.45); g.stroke(); }

  // head gear from the model
  if (M.gear.includes("eyepatch")) { const ex = fx + sep; g.fillStyle = ink; g.beginPath(); g.ellipse(ex, ey, eR * 1.15, eR * 0.95, 0, 0, 6.283); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(ex - eR, ey - eR * 0.6); g.lineTo(x - rx, y - ry * 0.4); g.moveTo(ex + eR, ey - eR * 0.6); g.lineTo(x + rx, y - ry * 0.3); g.stroke(); }
  if (M.gear.includes("bandage")) { g.strokeStyle = "#f2ead8"; g.lineWidth = r * 0.16; g.beginPath(); g.moveTo(x - rx * 0.95, y - ry * 0.55); g.lineTo(x + rx * 0.95, y - ry * 0.7); g.stroke(); }
  if (M.gear.includes("headband")) { g.strokeStyle = M.trim === "#f2ead8" ? "#e8554f" : M.trim; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - rx * 0.98, y - ry * 0.5); g.quadraticCurveTo(x, y - ry * 0.8, x + rx * 0.98, y - ry * 0.5); g.stroke(); }
  // the 14-slot face genes (glasses, liner, piercings, paint, tattoos, age marks...) layered on top
  const gene = c.look.face?.gene;
  if (gene !== undefined && hd) {
    const kk = r / 10.5;
    // realistic slots only (brow piercing, nose bit, ear, chin, scar, age), at most two per face so it stays clean
    drawFaceGenes(g, gene, { x, y, k: kk, dir, lw: lw * 0.8, col: ink, alpha, fx, ey, my, rx, ry, covered: F.eyes === "shades" || F.eyes === "aviator" }, { allow: REAL_GENES, max: 2 });
  }
  drawFaceAccessories(g,c,fx,y,r,k,sep,ey,eR);
  if((c.combat?.helmet??0)>0){g.fillStyle='#69745a';g.strokeStyle='#27382d';g.lineWidth=k;g.beginPath();g.ellipse(x,y-ry*.46,rx*1.09,ry*.67,0,Math.PI,Math.PI*2);g.lineTo(x+rx*1.12,y-ry*.36);g.lineTo(x-rx*1.12,y-ry*.36);g.closePath();g.fill();g.stroke();}
  drawFaceDamage(g,c,x,y,rx,ry,k);if(expression)drawReactionAccents(g,expression,x,y,r,k);else drawEmotionDetail(g,c,x,y,r,k);
  g.globalAlpha = alpha;
}

function drawHat(g: Ctx, M: ModelSpec, x: number, y: number, rx: number, ry: number, dir: number, lw: number, ink: string, flash: boolean): void {
  const col = flash ? "#ffffff" : M.hat === "police" ? "#1c2836" : M.hatColor ?? M.trim;
  g.fillStyle = col; g.strokeStyle = ink; g.lineWidth = lw * 0.8;
  const dome = (ext: number, top = 1) => { g.beginPath(); g.ellipse(x, y - ry * 0.25, rx * ext, ry * 0.85 * ext * top, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); };
  switch (M.hat) {
    case "cap": case "police": dome(1.04); g.beginPath(); g.ellipse(x + rx * 0.8 * dir, y - ry * 0.27, rx * 0.65, ry * 0.12, 0, 0, 6.283); g.fill(); g.stroke(); if (M.hat === "police") { g.fillStyle = "#f6b62c"; g.beginPath(); g.arc(x, y - ry * 0.7, rx * 0.12, 0, 6.283); g.fill(); } break;
    case "snapback": dome(1.04); g.beginPath(); g.ellipse(x - rx * 0.8 * dir, y - ry * 0.3, rx * 0.55, ry * 0.12, 0, 0, 6.283); g.fill(); g.stroke(); break;
    case "beanie": dome(1.08, 1.15); g.beginPath(); g.arc(x, y - ry * 1.3, rx * 0.17, 0, 6.283); g.fill(); g.stroke(); g.beginPath(); g.rect(x - rx * 1.08, y - ry * 0.4, rx * 2.16, ry * 0.2); g.fill(); g.stroke(); break;
    case "bucket": dome(0.98, 1.05); g.beginPath(); g.ellipse(x, y - ry * 0.25, rx * 1.45, ry * 0.2, 0, 0, 6.283); g.fill(); g.stroke(); break;
    case "bandana": dome(1.03); g.beginPath(); g.moveTo(x - rx * 0.95 * dir, y - ry * 0.3); g.lineTo(x - rx * 1.5 * dir, y - ry * 0.05); g.lineTo(x - rx * 1.35 * dir, y - ry * 0.45); g.closePath(); g.fill(); g.stroke(); break;
    case "beret": g.beginPath(); g.ellipse(x - rx * 0.15 * dir, y - ry * 0.75, rx * 1.15, ry * 0.42, -0.15 * dir, 0, 6.283); g.fill(); g.stroke(); break;
    case "cowboy": g.beginPath(); g.ellipse(x, y - ry * 0.35, rx * 1.75, ry * 0.22, 0, 0, 6.283); g.fill(); g.stroke(); g.beginPath(); g.rect(x - rx * 0.75, y - ry * 1.35, rx * 1.5, ry * 1.0); g.fill(); g.stroke(); break;
    case "helmet": dome(1.12, 1.1); break;
    case "hood": g.lineWidth = lw * 3; g.strokeStyle = col; g.beginPath(); g.ellipse(x, y + ry * 0.05, rx * 1.18, ry * 1.18, 0, Math.PI * 0.85, Math.PI * 2.15); g.stroke(); break;
    case "headphones": g.strokeStyle = ink; g.lineWidth = lw * 1.1; g.beginPath(); g.ellipse(x, y - ry * 0.05, rx * 1.1, ry * 1.1, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = col; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * rx * 1.02, y, rx * 0.2, ry * 0.3, 0, 0, 6.283); g.fill(); g.stroke(); } break;
    default: dome(1.04);
  }
}

/** Face close-up uses exactly the same identity, accessories and animated expression as the full figure. */
export function drawReactionPortrait(g:Ctx,c:Character,x:number,y:number,r:number):void{
 const M=personalize(modelOf(c)??lookSpec(c),c),P=facePlan(c.look.face?.gene??c.id*2654435761),k=r/(15*P.size);
 drawRefHead(g,c,M,P,moodOf(c),x,y,r,k,1,Math.max(1.1,2.3*k),1,true,false);
}
