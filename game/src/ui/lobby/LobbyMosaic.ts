import * as THREE from "three";
import type { Character } from "../../entities/types";
import { fabric, paint, type Weave } from "./LobbyTextures";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A Mosaic for the 3D lobby: built from the game's own Character (their skin, hair, face, colours and build), dressed for the
 * job they do on the floor, and able to perform a wide range of actions. Nobody is a recolour of anybody else: outfit cut,
 * cloth weave, hair, hat, glasses, jewellery and body shape are all chosen per Mosaic.
 */
export type Role = "player" | "dealer" | "croupier" | "bartender" | "cashier" | "host" | "security" | "slot" | "cards" | "roulette" | "highroller" | "lounge" | "walker" | "crash";
export type Action = "idle" | "chat" | "sip" | "cheer" | "clap" | "wave" | "phone" | "think" | "lean" | "slots" | "cards" | "deal" | "spin" | "shuffle" | "count" | "shake" | "dance" | "fistpump" | "facepalm" | "bow" | "stretch" | "walk" | "toast" | "point";
export interface Arm { sh: THREE.Group; el: THREE.Group; hand: THREE.Group }
export interface Leg { hip: THREE.Group; knee: THREE.Group }
export interface Fig {
  c: Character; role: Role; name: string; root: THREE.Group; seated: boolean; id: number;
  rig: { hips: THREE.Group; spine: THREE.Group; chest: THREE.Group; neck: THREE.Group; head: THREE.Group; L: Arm; R: Arm; lL: Leg; lR: Leg };
  props: { glass: THREE.Group; phone: THREE.Group; cards: THREE.Group; chips: THREE.Group; shaker: THREE.Group; bills: THREE.Group };
  action: Action; clock: number; phase: number; hit: THREE.Object3D[]; hipY: number; scale: number;
}

const G = {
  sphere: new THREE.SphereGeometry(1, 14, 10), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 10),
  cap: (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 6, 10), torus: new THREE.TorusGeometry(1, .12, 8, 24),
};
const CAPS = new Map<string, THREE.CapsuleGeometry>();
const cap = (r: number, l: number) => { const k = r + "_" + l; let g = CAPS.get(k); if (!g) CAPS.set(k, g = G.cap(r, l)); return g; };
const hashOf = (n: number, k = 0) => { let x = Math.imul((n | 0) + k * 7919, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return (x >>> 0) / 4294967296; };
const pick = <T,>(a: readonly T[], r: number): T => a[Math.min(a.length - 1, Math.floor(r * a.length))];
const color = (s: string | undefined, fb: string) => { try { return new THREE.Color(s || fb); } catch { return new THREE.Color(fb); } };
const MATS = new Map<string, THREE.MeshStandardMaterial>();
const std = (c: THREE.ColorRepresentation, rough = .6, metal = 0, map?: THREE.Texture) => { const key = `${new THREE.Color(c).getHexString()}|${rough}|${metal}|${map?.uuid ?? ""}`; let m = MATS.get(key); if (!m) MATS.set(key, m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, map })); return m; };

function faceTex(c: Character, skin: THREE.Color): THREE.CanvasTexture {
  return paint("face" + c.id + c.look.skin, 128, 128, (g) => {
    const f = c.look.face ?? { eyes: "dots", brows: "straight", mouth: "smile" }, ink = "#1a1214";
    g.clearRect(0, 0, 128, 128); g.lineCap = "round";
    g.fillStyle = "rgba(255,120,120,.16)"; g.beginPath(); g.ellipse(34, 78, 11, 7, 0, 0, 7); g.ellipse(94, 78, 11, 7, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(${skin.r * 160 | 0},${skin.g * 130 | 0},${skin.b * 110 | 0},.5)`; g.beginPath(); g.ellipse(64, 76, 4, 7, 0, 0, 7); g.fill();
    const eye = (x: number, wink = false) => {
      g.fillStyle = "#fff"; g.strokeStyle = ink; g.lineWidth = 3;
      if (f.eyes === "happy" || wink) { g.beginPath(); g.arc(x, 62, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); return; }
      if (f.eyes === "sleepy") { g.beginPath(); g.moveTo(x - 10, 62); g.lineTo(x + 10, 62); g.stroke(); g.fillStyle = ink; g.beginPath(); g.arc(x, 64, 3.5, 0, 7); g.fill(); return; }
      if (f.eyes === "dots") { g.fillStyle = ink; g.beginPath(); g.arc(x, 62, 6, 0, 7); g.fill(); return; }
      const rx = f.eyes === "wide" ? 11 : 9; g.beginPath(); g.ellipse(x, 62, rx, f.eyes === "wide" ? 12 : 9, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = ink; g.beginPath(); g.arc(x + 1, 63, 4.6, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 3, 60, 1.6, 0, 7); g.fill();
    };
    eye(40); eye(88, f.eyes === "wink");
    if (f.eyes === "shades" || f.eyes === "visor" || f.eyes === "aviator" || f.eyes === "shutter") { g.fillStyle = f.eyes === "aviator" ? "rgba(40,30,20,.85)" : "#0a0a0e"; g.beginPath(); g.roundRect(20, 50, 88, 24, 8); g.fill(); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(30, 54, 20, 4); }
    else if (f.eyes === "cateye") { g.strokeStyle = "#111"; g.lineWidth = 4; g.beginPath(); g.moveTo(24, 66); g.lineTo(52, 54); g.moveTo(104, 66); g.lineTo(76, 54); g.stroke(); }
    g.strokeStyle = ink; g.lineWidth = f.brows === "thick" ? 6 : 3.5;
    if (f.brows !== "none") for (const s of [-1, 1]) { const x = 64 + s * 24, tilt = f.brows === "angry" ? s * -7 : f.brows === "worried" ? s * 7 : f.brows === "raised" ? -4 : 0; const lift = f.brows === "raised" ? 5 : 0; g.beginPath(); g.moveTo(x - 11, 46 - lift + tilt * s * .5); g.lineTo(x + 11, 46 - lift - tilt * s * .5); g.stroke(); }
    g.lineWidth = 3.5; g.strokeStyle = "#7a1c28"; g.fillStyle = "#7a1c28";
    switch (f.mouth) {
      case "grin": case "teeth": g.fillStyle = "#fff"; g.beginPath(); g.moveTo(40, 92); g.quadraticCurveTo(64, 116, 88, 92); g.closePath(); g.fill(); g.strokeStyle = "#7a1c28"; g.stroke(); break;
      case "o": g.fillStyle = "#4a0f18"; g.beginPath(); g.ellipse(64, 98, 7, 9, 0, 0, 7); g.fill(); break;
      case "flat": g.beginPath(); g.moveTo(48, 98); g.lineTo(80, 98); g.stroke(); break;
      case "smirk": g.beginPath(); g.moveTo(48, 98); g.quadraticCurveTo(70, 104, 84, 90); g.stroke(); break;
      case "frown": g.beginPath(); g.arc(64, 112, 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); break;
      case "tongue": g.beginPath(); g.arc(64, 90, 18, .15 * Math.PI, .85 * Math.PI); g.stroke(); g.fillStyle = "#e8636f"; g.beginPath(); g.ellipse(64, 108, 7, 9, 0, 0, 7); g.fill(); break;
      default: g.beginPath(); g.arc(64, 88, 20, .15 * Math.PI, .85 * Math.PI); g.stroke();
    }
  });
}

interface Style { top: Weave; topCol: string; accent: string; bottom: Weave; botCol: string; vest?: string; tie?: "bow" | "long"; skirt?: boolean; apron?: boolean; jacket?: boolean; rolled?: boolean; short?: boolean; hat?: string; glasses?: boolean; jewel?: boolean; ear?: boolean; shirt: string; shoe: string }

/** What each role wears, with the Mosaic's own colour and a per-person roll deciding the cut, weave and extras. */
function styleFor(c: Character, role: Role): Style {
  const h = (k: number) => hashOf(c.id, k), own = c.look.color || "#6a2a3c", acc = c.look.accent || "#d4af37", girl = c.look.kind === "girl";
  const shirt = pick(["#f6f2ea", "#e9eef7", "#fbe7ea", "#f0ead8"], h(1)), dark = pick(["#15151b", "#1c1a26", "#201418", "#102018"], h(2));
  const base: Style = { top: "plain", topCol: own, accent: acc, bottom: "plain", botCol: dark, shirt, shoe: pick(["#111116", "#3a2216", "#5a1620", "#222a3a"], h(3)) };
  switch (role) {
    case "dealer": return { ...base, top: "plain", topCol: shirt, vest: "#16161e", tie: "bow", accent: "#b01a2b", bottom: "pinstripe", botCol: "#15151b", jewel: false, ear: false };
    case "croupier": return { ...base, top: "plain", topCol: shirt, vest: "#5a0d20", tie: "bow", accent: "#e5c566", bottom: "herringbone", botCol: "#1a1a22" };
    case "bartender": return { ...base, top: "plain", topCol: shirt, rolled: true, apron: true, tie: undefined, accent: "#c9a24a", bottom: "plain", botCol: "#17171d" };
    case "cashier": return { ...base, top: "plain", topCol: "#0f5c46", tie: "long", accent: "#e5c566", bottom: "plain", botCol: "#0d3a2e", jacket: true, glasses: h(5) > .5 };
    case "host": return { ...base, top: "satin", topCol: "#a3142b", jacket: true, tie: "bow", accent: "#e5c566", bottom: "plain", botCol: "#17171d" };
    case "security": return { ...base, top: "plain", topCol: "#0e0e12", jacket: true, tie: "long", accent: "#8a8a96", bottom: "plain", botCol: "#0e0e12", ear: true, glasses: true };
    case "highroller": return girl
      ? { ...base, top: "sequin", topCol: pick(["#7a1b9a", "#0b6e8f", "#b3123f", "#1c1c28"], h(6)), skirt: true, accent: "#f4d777", bottom: "satin", botCol: "#2a1030", jewel: true }
      : { ...base, top: "satin", topCol: "#0f0f14", jacket: true, tie: "bow", accent: "#e5c566", bottom: "plain", botCol: "#0f0f14", hat: h(7) > .5 ? "top" : undefined, jewel: true };
    case "lounge": return girl
      ? { ...base, top: pick<Weave>(["satin", "brocade", "sequin"], h(8)), skirt: h(9) > .35, accent: "#f1c4d6", jewel: true, bottom: "plain", botCol: "#241624" }
      : { ...base, top: pick<Weave>(["herringbone", "plaid", "brocade"], h(8)), jacket: true, tie: h(9) > .5 ? "long" : undefined, bottom: "plain", botCol: dark, hat: h(10) > .85 ? "fedora" : undefined };
    case "cards": case "roulette": return girl
      ? { ...base, top: pick<Weave>(["plain", "satin", "plaid"], h(8)), skirt: h(9) > .6, bottom: "plain", botCol: dark, jewel: true }
      : { ...base, top: pick<Weave>(["plaid", "herringbone", "pinstripe", "plain"], h(8)), vest: h(9) > .5 ? "#2a1c14" : undefined, bottom: "plain", botCol: dark, hat: h(10) > .8 ? "fedora" : undefined, glasses: h(11) > .6 };
    case "slot": return { ...base, top: pick<Weave>(["plain", "denim", "plaid", "sequin"], h(8)), short: h(9) > .5, skirt: girl && h(12) > .5, bottom: pick<Weave>(["denim", "plain"], h(13)), botCol: pick(["#27385a", "#222", "#4a2a2a"], h(14)), hat: h(15) > .75 ? "cap" : undefined, glasses: h(16) > .65 };
    case "crash": return { ...base, top: "plain", topCol: "#1b1f3a", jacket: true, accent: "#46aaff", bottom: "plain", botCol: "#12142a", glasses: true };
    case "player": return { ...base, top: "satin", topCol: own, jacket: true, tie: "long", accent: "#f4d777", bottom: "plain", botCol: "#17171d", jewel: true };
    default: return { ...base, top: pick<Weave>(["plain", "denim", "plaid", "brocade", "satin", "herringbone"], h(8)), short: h(9) > .6, skirt: girl && h(10) > .45, bottom: pick<Weave>(["denim", "plain", "pinstripe"], h(11)), botCol: pick(["#27385a", "#1c1c24", "#3a2a1c", "#2a2a3c"], h(12)), jacket: h(13) > .55, hat: h(14) > .85 ? "cap" : undefined, glasses: h(15) > .7, jewel: h(16) > .5 };
  }
}

function buildHair(style: string, kind: string, m: THREE.Material, head: THREE.Group, r: number) {
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.x = rx; o.castShadow = true; head.add(o); return o; };
  const capShell = (up: number, ht = 1) => add(G.sphere, 0, .015, -.008, r * 1.07, r * 1.07 * ht * up, r * 1.08);
  const s = style.startsWith("hair-") ? pick(["sidepart", "bob", "curly", "long", "spiky", "pony"], hashOf(+style.slice(5) || 0)) : style;
  switch (s) {
    case "none": return;
    case "buzz": capShell(.55, .9); return;
    case "mohawk": capShell(.5, .85); add(G.box, 0, r * .95, -.01, r * .16, r * .5, r * 1.4); return;
    case "afro": case "big": add(G.sphere, 0, r * .25, -.01, r * 1.5, r * 1.45, r * 1.5); return;
    case "bun": case "topknot": capShell(.9); add(G.sphere, 0, r * 1.15, -.02, r * .42, r * .42, r * .42); return;
    case "pony": capShell(.95); add(cap(r * .2, r * 1.2), 0, -r * .6, -r * 1.05, 1, 1, 1, .35); add(G.sphere, 0, r * .25, -r * 1.02, r * .22, r * .22, r * .22); return;
    case "long": capShell(1); add(cap(r * .5, r * 1.4), 0, -r * .9, -r * .55, 1.3, 1, .7); add(cap(r * .28, r * 1.1), -r * 1.0, -r * .6, -r * .1); add(cap(r * .28, r * 1.1), r * 1.0, -r * .6, -r * .1); return;
    case "braids": capShell(.95); for (const x of [-.7, 0, .7]) add(cap(r * .14, r * 1.7), x * r, -r * .95, -r * .85); return;
    case "curly": capShell(.95); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, y = (i % 3 - 1) * r * .4; add(G.sphere, Math.cos(a) * r * 1.0, r * .3 + y, Math.sin(a) * r * 1.0, r * .32, r * .32, r * .32); } add(G.sphere, 0, r * 1.05, 0, r * .5, r * .4, r * .5); return;
    case "spiky": capShell(.9); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(G.cone, Math.cos(a) * r * .7, r * 1.0, Math.sin(a) * r * .7, r * .22, r * .6, r * .22, Math.sin(a) * .5); } return;
    case "pigtails": capShell(.95); for (const x of [-1, 1]) { add(cap(r * .2, r * 1.0), x * r * 1.15, -r * .35, -r * .1); add(G.sphere, x * r * 1.1, r * .3, -r * .05, r * .2, r * .2, r * .2); } return;
    case "bob": capShell(.98); add(G.sphere, -r * .9, -r * .35, -r * .1, r * .35, r * .72, r * .75); add(G.sphere, r * .9, -r * .35, -r * .1, r * .35, r * .72, r * .75); add(G.sphere, 0, -r * .35, -r * .72, r * 1.0, r * .75, r * .4); return;
    default: capShell(1); add(G.sphere, kind === "girl" ? -r * .55 : -r * .35, r * .7, r * .45, r * .55, r * .3, r * .6); // side part sweep
  }
}

export function buildFigure(c: Character, role: Role, name: string, opts: { seated?: boolean } = {}): Fig {
  const L = c.look, id = c.id, girl = L.kind === "girl", st = styleFor(c, role);
  const skinC = color(L.skin, pick(["#f1c9a5", "#e6b595", "#c98f68", "#a46a47", "#7a4b32"], hashOf(id, 20))), hairC = color(L.hairColor, "#2a1a12");
  const build = (L.build ?? 1) * (.94 + hashOf(id, 21) * .2), w = build * (girl ? .92 : 1.08), H = THREE.MathUtils.clamp((L.scale || 1) * (.97 + hashOf(id, 22) * .09), .92, 1.1) * (girl ? .96 : 1);
  const skin = std(skinC, .5), hair = std(hairC, .45, .12), shirtM = std(st.shirt, .7, 0, fabric("plain", st.shirt, "#fff"));
  const topM = std("#ffffff", st.top === "satin" || st.top === "sequin" ? .3 : .75, st.top === "sequin" ? .5 : 0, fabric(st.top, st.topCol, st.accent)); topM.side = THREE.DoubleSide;
  const botM = std("#ffffff", .7, 0, fabric(st.bottom, st.botCol, st.accent)); botM.side = THREE.DoubleSide;
  const trim = std(st.accent, .3, .7), shoeM = std(st.shoe, .3, .3);
  const root = new THREE.Group(), hit: THREE.Object3D[] = [];
  const mk = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); p.add(o); hit.push(o); return o; };
  const bones: THREE.Bone[] = [];
  /** Joints are bones (the whole figure is baked into a few skinned meshes at the end); props and hair roots are plain groups. */
  const grp = (p: THREE.Object3D, x = 0, y = 0, z = 0, bone = false) => { const g: THREE.Object3D = bone ? new THREE.Bone() : new THREE.Group(); g.position.set(x, y, z); p.add(g); if (bone) bones.push(g as THREE.Bone); return g as THREE.Group; };

  const hipY = .93, hips = grp(root, 0, hipY, 0, true), spine = grp(hips, 0, .06, 0, true), chest = grp(spine, 0, .2, 0, true), neck = grp(chest, 0, .3, 0, true), head = grp(neck, 0, .09, 0, true);
  const sleeveM = st.jacket ? topM : st.short || st.top === "sequin" && girl ? skin : st.rolled ? skin : topM;
  // torso: shirt core, then the outer garment over it
  mk(G.cyl, std("#ffffff", .7, 0, fabric("plain", st.shirt, "#fff")), spine, 0, .09, 0, .125 * w, .24, .095 * w);
  mk(G.cyl, st.vest ? shirtM : topM, chest, 0, .1, 0, .15 * w, .36, .105 * w);
  if (st.vest) { const v = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true, -Math.PI * .75, Math.PI * 1.5), std("#ffffff", .6, 0, fabric(st.vest === "#5a0d20" ? "brocade" : "pinstripe", st.vest, st.accent))); (v.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; v.rotation.y = Math.PI; v.position.set(0, .1, 0); v.scale.set(.162 * w, .37, .115 * w); chest.add(v); v.castShadow = true; hit.push(v); }
  if (st.jacket) { mk(G.cyl, topM, spine, 0, .09, 0, .135 * w, .26, .1 * w); const lap = new THREE.Mesh(G.box, std(st.accent, .4, .5)); lap.scale.set(.02, .3, .01); lap.position.set(.045 * w, .1, .108 * w); lap.rotation.z = .2; chest.add(lap); const l2 = lap.clone(); l2.position.x = -.045 * w; l2.rotation.z = -.2; chest.add(l2); }
  if (st.apron) mk(G.box, std("#15151b", .7), chest, 0, -.02, .108 * w, .26 * w, .55, .012);
  if (st.tie === "long") mk(G.box, std(st.accent, .3, .2), chest, 0, .12, .112 * w, .028, .26, .008);
  if (st.tie === "bow") { mk(G.cone, trim, chest, -.04, .27, .1 * w, .03, .06, .03).rotation.z = Math.PI / 2; mk(G.cone, trim, chest, .04, .27, .1 * w, .03, .06, .03).rotation.z = -Math.PI / 2; mk(G.sphere, trim, chest, 0, .27, .1 * w, .014, .014, .014); }
  if (st.jewel) { const n = new THREE.Mesh(G.torus, std("#f4d777", .2, .9)); n.scale.set(.085, .085, .085); n.rotation.x = Math.PI / 2 + .25; n.position.set(0, .26, .06); chest.add(n); }
  mk(G.cyl, skin, neck, 0, .02, 0, .045, .1, .045);
  // hips and legs (a skirt or dress hides the thigh tops)
  mk(G.sphere, botM, hips, 0, 0, 0, .15 * w * (girl ? 1.08 : 1), .1, .1 * w);
  const mkArm = (side: number): Arm => {
    const sh = grp(chest, side * (.19 * w), .24, 0, true), el = grp(sh, 0, -.27, 0, true), hand = grp(el, 0, -.26, 0, true);
    mk(G.sphere, sleeveM === skin ? skin : topM, sh, 0, 0, 0, .05, .05, .05); mk(cap(.04, .2), sleeveM, sh, 0, -.14, 0); mk(cap(.033, .19), st.jacket && !st.short ? topM : sleeveM === skin ? skin : topM, el, 0, -.12, 0);
    if (st.jacket) mk(G.cyl, std(st.shirt, .6), el, 0, -.235, 0, .034, .03, .034);
    mk(G.sphere, skin, hand, 0, -.02, 0, .036, .05, .026);
    if (st.jewel && side > 0) { const wt = new THREE.Mesh(G.torus, std("#d8c27a", .2, .9)); wt.scale.set(.04, .04, .04); wt.rotation.x = Math.PI / 2; wt.position.y = .02; el.add(wt); wt.position.y = -.22; }
    return { sh, el, hand };
  };
  const L_ = mkArm(-1), R_ = mkArm(1);
  const mkLeg = (side: number): Leg => {
    const hip = grp(hips, side * .095 * w, -.04, 0, true), knee = grp(hip, 0, -.44, 0, true);
    mk(cap(.07 * (girl ? .92 : 1) * w, .34), botM, hip, 0, -.21, 0); mk(cap(.05, .34), st.skirt ? skin : botM, knee, 0, -.21, 0);
    mk(G.box, shoeM, knee, 0, -.445, .035, .08, .06, .19); const heel = mk(G.cyl, shoeM, knee, 0, -.47, -.03, .014, .05, .014); heel.visible = girl && st.skirt === true;
    return { hip, knee };
  };
  const lL = mkLeg(-1), lR = mkLeg(1);
  if (st.skirt) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(.17 * w, .3 * w, .52, 24, 1, true), topM); sk.position.y = -.27; hips.add(sk); sk.castShadow = true; hit.push(sk); }
  // head: skull, face, ears, hair, hat, glasses
  const r = .108; mk(G.sphere, skin, head, 0, .05, 0, r * .94, r * 1.08, r * .98);
  const face = new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, 28, 18, Math.PI * .5 - .66, 1.32, .5, 1.55), new THREE.MeshStandardMaterial({ map: faceTex(c, skinC), transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.set(0, .05, 0); face.scale.set(.94, 1.08, .98); head.add(face);
  for (const s of [-1, 1]) mk(G.sphere, skin, head, s * r * .93, .04, 0, .02, .035, .02);
  const hairRoot = grp(head, 0, .05, 0); buildHair(String(L.hair), L.kind, hair, hairRoot, r);
  const hatKind = st.hat ?? (L.hat === "cap" || L.hat === "beanie" || L.hat === "beret" || L.hat === "cowboy" || L.hat === "bucket" || L.hat === "snapback" ? (hashOf(id, 30) > .55 ? L.hat : undefined) : undefined);
  if (hatKind) {
    const hc = hatKind === "top" ? "#0c0c10" : hatKind === "cowboy" ? "#6a4222" : hatKind === "fedora" ? "#2a2430" : pick(["#a3142b", "#1b2a5a", "#23232a", "#e5e1d6"], hashOf(id, 31)), hm = std(hc, .6);
    const hatG = grp(head, 0, .13, 0);
    const brim = (rad: number, th = .014) => mk(G.cyl, hm, hatG, 0, 0, 0, rad, th, rad);
    if (hatKind === "top") { brim(.17); mk(G.cyl, hm, hatG, 0, .1, 0, .105, .2, .105); mk(G.cyl, std("#a3142b", .5), hatG, 0, .04, 0, .108, .03, .108); }
    else if (hatKind === "fedora") { brim(.19); mk(G.cyl, hm, hatG, 0, .05, 0, .1, .1, .1); mk(G.cyl, std("#c9a24a", .5), hatG, 0, .02, 0, .103, .025, .103); }
    else if (hatKind === "cowboy") { brim(.23); mk(G.cyl, hm, hatG, 0, .06, 0, .1, .12, .1); }
    else if (hatKind === "beanie") { mk(G.sphere, hm, hatG, 0, -.01, 0, .118, .1, .118); }
    else if (hatKind === "beret") { mk(G.cyl, hm, hatG, 0, -.005, 0, .15, .035, .15); }
    else if (hatKind === "bucket") { brim(.16, .012); mk(G.cyl, hm, hatG, 0, .04, 0, .11, .08, .11); }
    else { mk(G.sphere, hm, hatG, 0, -.012, 0, .116, .09, .12); mk(G.box, hm, hatG, 0, -.03, .12, .13, .012, .09); }
  }
  if (st.glasses && !(L.face && /shades|visor|aviator/.test(L.face.eyes))) { const gm = std("#111", .2, .5); for (const s of [-1, 1]) { const rim = new THREE.Mesh(G.torus, gm); rim.scale.set(.038, .038, .038); rim.position.set(s * .042, .06, r * .95); head.add(rim); } mk(G.box, gm, head, 0, .065, r * .95, .03, .008, .008); }
  if (st.ear) { mk(G.box, std("#111", .3), head, r * .95, .03, 0, .01, .02, .015); const cord = new THREE.Mesh(cap(.004, .12), std("#222")); cord.position.set(r * .95, -.04, -.01); head.add(cord); }

  // props, hidden until an action asks for them
  const glass = grp(R_.hand, 0, -.05, .02); mk(G.cyl, std("#cfe8f5", .05, 0), glass, 0, 0, 0, .026, .07, .026); (glass.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: "#cfe8f5", transparent: true, opacity: .55, roughness: .05 }); mk(G.cyl, std(pick(["#ff8a3d", "#d81b60", "#7be08a", "#f4d777"], hashOf(id, 40)), .3), glass, 0, -.012, 0, .022, .04, .022); mk(G.sphere, std("#e8e050", .4), glass, .02, .04, 0, .012, .012, .012); glass.visible = false;
  const phone = grp(R_.hand, 0, -.04, .03); mk(G.box, std("#0d0d12", .2, .5), phone, 0, 0, 0, .04, .075, .008); mk(G.box, std("#7fd0ff", .1), phone, 0, 0, .005, .034, .066, .002); phone.visible = false;
  const cards = grp(L_.hand, 0, -.04, .03); for (let i = 0; i < 4; i++) { const k = mk(G.box, std("#f7f4ea", .5), cards, (i - 1.5) * .018, 0, 0, .042, .06, .003); k.rotation.z = (i - 1.5) * .22; } cards.visible = false;
  const chips = grp(R_.hand, 0, -.05, .03); for (let i = 0; i < 4; i++) mk(G.cyl, std(pick(["#c0273d", "#1c4fa3", "#1f8a50", "#111"], i / 4), .4), chips, 0, i * .008, 0, .028, .007, .028); chips.visible = false;
  const shaker = grp(R_.hand, 0, -.08, .02); mk(G.cyl, std("#c8ccd2", .15, .95), shaker, 0, 0, 0, .03, .16, .03); mk(G.cone, std("#c8ccd2", .15, .95), shaker, 0, .1, 0, .022, .05, .022); shaker.visible = false;
  const bills = grp(R_.hand, 0, -.05, .03); for (let i = 0; i < 3; i++) mk(G.box, std("#7fc99a", .6), bills, 0, i * .006, 0, .07, .003, .035); bills.visible = false;

  for (const pr of [glass, phone, cards, chips, shaker, bills]) pr.userData.prop = true;
  bake(root, bones);
  const scale = H; root.scale.setScalar(H);
  const f: Fig = { c, role, name, root, seated: !!opts.seated, id, rig: { hips, spine, chest, neck, head, L: L_, R: R_, lL, lR }, props: { glass, phone, cards, chips, shaker, bills }, action: "idle", clock: hashOf(id, 50) * 20, phase: hashOf(id, 51) * 6.28, hit, hipY, scale };
  root.userData.fig = f;
  return f;
}

const ZERO = (o: THREE.Object3D) => o.rotation.set(0, 0, 0);
const sm = (x: number) => x * x * (3 - 2 * x);
/** Pose a figure for `action` at its own clock. Everything is driven from a neutral pose each frame so actions never leak into each other. */
export function poseFigure(f: Fig, action: Action, dt: number, speed = 0): void {
  f.clock += dt; const t = f.clock + f.phase, { hips, spine, chest, neck, head, L, R, lL, lR } = f.rig;
  for (const o of [spine, chest, neck, head, L.sh, L.el, R.sh, R.el, lL.hip, lL.knee, lR.hip, lR.knee]) ZERO(o);
  hips.rotation.set(0, 0, 0); hips.position.set(0, f.hipY, 0);
  const arm = (a: Arm, side: number, fwd: number, out: number, bend: number) => { a.sh.rotation.set(-fwd, 0, side * out); a.el.rotation.set(-bend, 0, 0); };
  const P = f.props; P.glass.visible = action === "sip" || action === "toast" || (f.role === "lounge" && action === "chat"); P.phone.visible = action === "phone"; P.cards.visible = action === "cards" || action === "deal" && false; P.chips.visible = action === "cards" && f.role === "cards"; P.shaker.visible = action === "shake"; P.bills.visible = action === "count";
  if (f.seated) { hips.position.y = f.hipY - .38; lL.hip.rotation.x = lR.hip.rotation.x = -1.5; lL.knee.rotation.x = lR.knee.rotation.x = 1.55; lL.hip.rotation.z = -.08; lR.hip.rotation.z = .08; spine.rotation.x = .08; }
  const relaxArms = () => { arm(L, -1, .05 + Math.sin(t * .8) * .03, .12, .25); arm(R, 1, .05 + Math.cos(t * .8) * .03, .12, .25); };
  const bob = Math.sin(t * 1.3);
  switch (action) {
    case "walk": { const s = Math.sin(t * (4 + speed * 1.2)), k = .45 + speed * .05; lL.hip.rotation.x = s * k; lR.hip.rotation.x = -s * k; lL.knee.rotation.x = Math.max(0, -s) * .8; lR.knee.rotation.x = Math.max(0, s) * .8; arm(L, -1, -s * .45, .08, .15); arm(R, 1, s * .45, .08, .15); hips.position.y += Math.abs(Math.cos(t * (4 + speed * 1.2))) * .03 - .015; spine.rotation.y = s * .08; break; }
    case "chat": relaxArms(); arm(R, 1, .75 + Math.sin(t * 2.3) * .3, .35, 1.1 + Math.sin(t * 3.1) * .3); arm(L, -1, .4 + Math.sin(t * 1.7) * .15, .25, .9); head.rotation.set(Math.sin(t * 2) * .06, Math.sin(t * .9) * .3, Math.sin(t * 1.1) * .05); spine.rotation.y = Math.sin(t * .7) * .1; hips.position.x = Math.sin(t * .4) * .02; break;
    case "sip": { const p = sm(Math.max(0, Math.sin(t * .7)) ** .6); arm(R, 1, .5 + p * 1.0, .15, .6 + p * 1.5); arm(L, -1, .6, .3, 1.4); head.rotation.x = -p * .22; spine.rotation.x = -p * .05; break; }
    case "toast": { const p = Math.sin(t * 3); arm(R, 1, 1.6 + p * .08, .15, .7); arm(L, -1, .3, .2, .5); head.rotation.x = -.08; spine.rotation.x = -.05; hips.position.y += Math.abs(Math.sin(t * 1.5)) * .02; break; }
    case "cheer": { const j = Math.abs(Math.sin(t * 5)); arm(L, -1, 2.9 + Math.sin(t * 9) * .15, .35, .15); arm(R, 1, 2.9 - Math.sin(t * 9) * .15, .35, .15); hips.position.y += j * .1 - .03; lL.hip.rotation.x = lR.hip.rotation.x = -j * .3; lL.knee.rotation.x = lR.knee.rotation.x = j * .5; head.rotation.x = -.2; spine.rotation.x = -.1; break; }
    case "fistpump": { const p = Math.max(0, Math.sin(t * 4)); arm(R, 1, 2.6 + p * .4, .25, .6 - p * .5); arm(L, -1, .3, .2, .7); hips.position.y += p * .08; lL.knee.rotation.x = lR.knee.rotation.x = p * .3; lL.hip.rotation.x = lR.hip.rotation.x = -p * .2; head.rotation.x = -.15; spine.rotation.z = Math.sin(t * 4) * .06; break; }
    case "clap": { const c = Math.abs(Math.sin(t * 6)); arm(L, -1, 1.0, .02 + c * .25, 1.35); arm(R, 1, 1.0, .02 + c * .25, 1.35); head.rotation.x = -.05; hips.position.y += c * .015; break; }
    case "wave": relaxArms(); arm(R, 1, 2.2, .55, .35 + Math.sin(t * 7) * .4); head.rotation.z = -.08; head.rotation.y = -.2; break;
    case "point": arm(R, 1, 1.45, .2, .08); arm(L, -1, .1, .15, .3); head.rotation.y = -.15; spine.rotation.y = .1; break;
    case "phone": arm(R, 1, .55, .5, 2.35); arm(L, -1, .55, .1, 1.5); head.rotation.set(.05, -.1, .14); spine.rotation.y = Math.sin(t * .5) * .08; break;
    case "think": arm(R, 1, 1.0, .15, 2.1); arm(L, -1, .8, .1, 1.5); head.rotation.set(.12, Math.sin(t * .6) * .25, -.1); spine.rotation.x = .04; break;
    case "lean": spine.rotation.x = .3; chest.rotation.x = .1; arm(R, 1, 1.0, .25, 1.0); arm(L, -1, .35, .1, .4); head.rotation.set(-.15, Math.sin(t * .5) * .3, 0); lL.hip.rotation.x = -.1; lR.hip.rotation.set(.1, 0, 0); break;
    case "slots": { const p = Math.max(0, Math.sin(t * .9 + 1)); spine.rotation.x = .12 + p * .05; arm(R, 1, 1.0 + p * .5, .3, .5 - p * .2); arm(L, -1, .6, .25, 1.0); head.rotation.set(-.12, Math.sin(t * .7) * .08, 0); break; }
    case "cards": { const f2 = Math.sin(t * 1.1); arm(L, -1, 1.1, .12, 1.65); arm(R, 1, .9 + Math.max(0, f2) * .5, .25, 1.0); head.rotation.set(.18, Math.sin(t * .6) * .12, 0); spine.rotation.x = .12; break; }
    case "deal": { const s = (t * .7) % 1, throwP = s < .3 ? s / .3 : 1 - (s - .3) / .7; arm(R, 1, .55 + throwP * .8, .2 + throwP * .5, .7 - throwP * .4); arm(L, -1, .9, .25, .6); head.rotation.set(.2, Math.sin(t * .5) * .2, 0); spine.rotation.x = .08; spine.rotation.y = Math.sin(t * .7) * .14; break; }
    case "spin": { const a = t * 4; arm(R, 1, 1.15, .25 + Math.sin(a) * .35, .55); arm(L, -1, .7, .25, .9); head.rotation.set(.32, Math.sin(t * 3) * .28, 0); spine.rotation.x = .1; spine.rotation.y = Math.sin(a) * .12; break; }
    case "shuffle": { const q = Math.sin(t * 9) * .12; arm(L, -1, 1.0 + q, .1, 1.5); arm(R, 1, 1.0 - q, .1, 1.5); head.rotation.x = .25; spine.rotation.x = .08; break; }
    case "count": { const q = Math.sin(t * 7); arm(L, -1, .95, .12, 1.7); arm(R, 1, .95 + q * .12, .12, 1.4 + q * .25); head.rotation.set(.3, 0, 0); spine.rotation.x = .08; break; }
    case "shake": { const q = Math.sin(t * 14) * .2; arm(R, 1, 2.2 + q, .3, .9); arm(L, -1, 2.0 - q, .3, 1.0); head.rotation.x = -.1; spine.rotation.z = Math.sin(t * 7) * .05; hips.position.y += Math.abs(q) * .02; break; }
    case "dance": { const b = Math.abs(Math.sin(t * 3)), s = Math.sin(t * 3); hips.position.y += b * .05 - .03; hips.rotation.z = s * .16; hips.rotation.y = Math.cos(t * 3) * .3; spine.rotation.z = -s * .12; arm(L, -1, 1.6 + Math.sin(t * 6) * .6, .5, .9); arm(R, 1, 1.6 - Math.sin(t * 6) * .6, .5, .9); lL.hip.rotation.x = -.15 + s * .25; lR.hip.rotation.x = -.15 - s * .25; lL.knee.rotation.x = lR.knee.rotation.x = .3 + b * .3; head.rotation.z = s * .1; break; }
    case "facepalm": { const q = Math.sin(t * 5) * .03; arm(R, 1, 1.9, .1, 2.4); arm(L, -1, .2, .2, .4); head.rotation.set(.35 + q, 0, 0); spine.rotation.x = .12; break; }
    case "bow": { const p = sm((Math.sin(t * .9) + 1) / 2); spine.rotation.x = p * .75; chest.rotation.x = p * .2; arm(R, 1, .9, .1, 1.7); arm(L, -1, .15, .15, .3); head.rotation.x = p * .15; break; }
    case "stretch": { const p = sm((Math.sin(t * .7) + 1) / 2); arm(L, -1, 2.9, .3 + p * .2, .1); arm(R, 1, 2.9, .3 + p * .2, .1); spine.rotation.x = -.2 * p; head.rotation.x = -.3 * p; hips.position.y += p * .02; break; }
    default: { relaxArms(); head.rotation.set(Math.sin(t * .4) * .04, Math.sin(t * .35) * .35, 0); hips.position.x = Math.sin(t * .5) * .018; hips.rotation.z = Math.sin(t * .5) * .03; spine.rotation.z = -Math.sin(t * .5) * .03; if (!f.seated) { lL.hip.rotation.x = bob * .02; lR.hip.rotation.x = -bob * .02; } else arm(R, 1, .15, .1, 1.1); }
  }
  f.action = action;
}

/** Bake every part of a figure into one skinned mesh per material. Each part is rigid to its nearest joint, so poses still drive everything. */
function bake(root: THREE.Group, bones: THREE.Bone[]) {
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(), used: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o.userData.prop) return; for (const c of o.children) visit(c);
    const m = o as THREE.Mesh; if (!m.isMesh || Array.isArray(m.material)) return;
    let bone: THREE.Object3D | null = m.parent; while (bone && !(bone as THREE.Bone).isBone) bone = bone.parent; if (!bone) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    const n = g.attributes.position.count, idx = bones.indexOf(bone as THREE.Bone), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = idx; sw[i * 4] = 1; }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    const list = buckets.get(m.material as THREE.Material) ?? []; list.push(g); buckets.set(m.material as THREE.Material, list); used.push(m);
  };
  visit(root);
  for (const m of used) m.parent?.remove(m);
  const skeleton = new THREE.Skeleton(bones);
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false); if (!merged) continue; merged.computeBoundingSphere();
    const sm = new THREE.SkinnedMesh(merged, mat); sm.frustumCulled = false; root.add(sm); sm.bind(skeleton, new THREE.Matrix4());
  }
}
