/**
 * A Mosaic in 3D. The joint hierarchy (hips > spine > chest > neck > head, shoulders > elbows > hands,
 * hip joints > knees > feet) and the five dance routines come from the Velvet Lounge sandbox; the body, skin,
 * hair, colours and build come from the Mosaic (the game's own Character). Dance style and outfit are plain data,
 * so "choose your dance" and "choose your clothes" are a one-field change. Everyone stays clothed (PG-13).
 */
import * as THREE from "three";
import type { Character } from "../../entities/types";
import { CHAR_HEIGHT } from "../../physics/PhysicsWorld";

export type Routine = "poleSpin" | "hipSway" | "floorWork" | "clubFreestyle" | "stagePose";
export const ROUTINES: readonly { id: Routine; label: string }[] = [
  { id: "poleSpin", label: "Pole spin" }, { id: "hipSway", label: "Hip sway" }, { id: "floorWork", label: "Floor work" },
  { id: "clubFreestyle", label: "Club freestyle" }, { id: "stagePose", label: "Stage pose" },
];
export interface Outfit { id: string; label: string; color?: number; metal: number; glow: number; hat?: boolean; boa?: boolean; skirt?: boolean }
export const OUTFITS: readonly Outfit[] = [
  { id: "own", label: "Own colours", metal: 0.45, glow: 0.12 },
  { id: "neon", label: "Neon glow", color: 0xff3da8, metal: 0.2, glow: 0.95 },
  { id: "noir", label: "Noir & gold", color: 0x17131c, metal: 0.7, glow: 0.04 },
  { id: "feather", label: "Feather boa", color: 0xff9fc2, metal: 0.25, glow: 0.1, boa: true },
  { id: "cowgirl", label: "Saloon cowgirl", color: 0x8a4b22, metal: 0.1, glow: 0.02, hat: true, skirt: true },
  { id: "showgirl", label: "Burlesque skirt", color: 0xd81b60, metal: 0.4, glow: 0.14, skirt: true, boa: true },
];

export interface Arm { shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Mesh }
export interface Leg { hipJoint: THREE.Group; knee: THREE.Group; foot: THREE.Group }
export interface Rig { hips: THREE.Group; spine: THREE.Group; chest: THREE.Group; head: THREE.Group; hairFlow: THREE.Group; armL: Arm; armR: Arm; legL: Leg; legR: Leg }
export type Role = "dancer" | "patron" | "bouncer" | "dj" | "bartender" | "mc" | "famiglia" | "cleaner";
export interface Billboard { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; sprite: THREE.Sprite; last: number; key: string }
/** Draws one Mosaic (their real face, hair, outfit and build) with the game's figure renderer. */
export type DrawFn = (c: Character | null, g: CanvasRenderingContext2D, x: number, y: number, k: number, t: number, doing: string, o: { fear: number; color?: string; glam: boolean }) => void;
export interface Mosaic {
  c: Character | null; bb: Billboard | null;
  root: THREE.Group; rig: Rig; role: Role; name: string; id: number;
  skin: THREE.MeshStandardMaterial; outfit: THREE.MeshStandardMaterial; hair: THREE.MeshStandardMaterial;
  base: THREE.Color; props: { hat: THREE.Group; boa: THREE.Mesh; skirt: THREE.Mesh; broom: THREE.Group; mic: THREE.Mesh };
  label: THREE.Sprite | null; outfitId: string; height: number;
}

const GEO = {
  hip: new THREE.SphereGeometry(0.155, 16, 12), waist: new THREE.CylinderGeometry(0.115, 0.125, 0.22, 14), torso: new THREE.CylinderGeometry(0.145, 0.115, 0.25, 16),
  neck: new THREE.CylinderGeometry(0.042, 0.048, 0.1, 10), head: new THREE.SphereGeometry(0.105, 16, 14), hairCap: new THREE.SphereGeometry(0.114, 16, 12),
  hairFlow: new THREE.CapsuleGeometry(0.07, 0.26, 6, 10), shoulder: new THREE.SphereGeometry(0.046, 10, 8), upperArm: new THREE.CapsuleGeometry(0.036, 0.21, 6, 8),
  foreArm: new THREE.CapsuleGeometry(0.029, 0.2, 6, 8), hand: new THREE.SphereGeometry(0.032, 8, 8), thigh: new THREE.CapsuleGeometry(0.068, 0.34, 6, 10),
  shin: new THREE.CapsuleGeometry(0.046, 0.34, 6, 10), shoe: new THREE.BoxGeometry(0.075, 0.06, 0.16), heel: new THREE.CylinderGeometry(0.012, 0.008, 0.09, 6),
  brim: new THREE.CylinderGeometry(0.2, 0.2, 0.012, 18), crown: new THREE.CylinderGeometry(0.1, 0.12, 0.12, 14), boa: new THREE.TorusGeometry(0.16, 0.035, 8, 20),
  skirt: new THREE.CylinderGeometry(0.15, 0.3, 0.26, 18, 1, true), pole: new THREE.CylinderGeometry(0.012, 0.012, 1.4, 6), bristle: new THREE.BoxGeometry(0.3, 0.06, 0.05),
  mic: new THREE.CylinderGeometry(0.014, 0.018, 0.1, 8), shades: new THREE.BoxGeometry(0.19, 0.035, 0.05), cans: new THREE.TorusGeometry(0.115, 0.012, 6, 14, Math.PI),
};
const SKINS = ["#f1c9a5", "#e6b595", "#c98f68", "#a46a47", "#7a4b32", "#ffdcbf"];
const HAIRS = ["#161018", "#3b2616", "#7a4a22", "#c9a24a", "#8a1f2e", "#6a6f78"];
const col = (s: string | undefined, fb: string): THREE.Color => { try { return new THREE.Color(s || fb); } catch { return new THREE.Color(fb); } };
const mat = (c: THREE.Color | number, rough = 0.5, metal = 0.05): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

function nameSprite(text: string): THREE.Sprite {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64; const g = cv.getContext("2d")!;
  g.font = "800 30px 'Big Shoulders Display', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "#000"; g.shadowBlur = 8; g.fillStyle = "#fff"; g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(1.05, 0.26, 1); s.position.y = 1.98; return s;
}

export function buildMosaic(c: Character | null, role: Role, name: string, accent: string): Mosaic {
  const id = c?.id ?? 0, look = c?.look;
  const skinC = col(look?.skin, SKINS[Math.abs(id) % SKINS.length]), hairC = col(look?.hairColor, HAIRS[Math.abs(id * 3) % HAIRS.length]);
  const own = col(look?.color, accent);
  const palette: Record<Role, THREE.Color> = { dancer: own, patron: own.clone().multiplyScalar(0.8), bouncer: new THREE.Color(0x0e0e12), dj: new THREE.Color(0x1d1a26), bartender: new THREE.Color(0x4a1620), mc: new THREE.Color(0xe4e0dd), famiglia: new THREE.Color(0x1b1b24), cleaner: new THREE.Color(0x2e6f8e) };
  const skin = mat(skinC, 0.45), outfit = mat(palette[role], role === "dancer" ? 0.25 : 0.7, role === "dancer" ? 0.45 : 0.05), hair = mat(hairC, 0.4, 0.15);
  outfit.emissive = palette[role].clone(); outfit.emissiveIntensity = role === "dancer" ? 0.12 : 0;
  const pants = mat(role === "dancer" ? skinC : new THREE.Color(0x15151c), 0.6), shoe = mat(0x111116, 0.2, 0.7);
  const sleeve = role === "dancer" || role === "patron" || role === "cleaner" ? skin : outfit;
  const mk = (geo: THREE.BufferGeometry, m: THREE.Material, y = 0, sx = 1, sy = 1, sz = 1): THREE.Mesh => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.scale.set(sx, sy, sz); o.castShadow = role === "dancer"; o.receiveShadow = true; return o; };
  const root = new THREE.Group(), wide = (look?.build ?? 1) * (look?.kind === "guy" || role !== "dancer" ? 1.12 : 1);
  const hips = new THREE.Group(); hips.position.y = 0.94; root.add(hips);
  hips.add(mk(GEO.hip, role === "dancer" ? outfit : pants, 0, 1.12 * wide, 0.85, 0.82 * wide));
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine); spine.add(mk(GEO.waist, outfit, 0.11, wide, 1, 0.78 * wide));
  const chest = new THREE.Group(); chest.position.y = 0.22; spine.add(chest); chest.add(mk(GEO.torso, outfit, 0.12, 1.05 * wide, 1, 0.76 * wide));
  const neck = new THREE.Group(); neck.position.y = 0.26; chest.add(neck); neck.add(mk(GEO.neck, skin, 0.04));
  const head = new THREE.Group(); head.position.y = 0.12; neck.add(head); head.add(mk(GEO.head, skin, 0.05, 0.92, 1.08, 0.95));
  const style = String(look?.hair ?? "bob"), bald = /none|buzz|mohawk/.test(style), long = look?.kind === "girl" && !/bob|buzz|none|topknot|bun/.test(style);
  const cap = mk(GEO.hairCap, hair, 0.07, 0.98, bald ? 0.55 : 1.06, 1.04); cap.position.z = -0.015; head.add(cap);
  const hairFlow = new THREE.Group(); hairFlow.position.set(0, 0.04, -0.1); if (long) hairFlow.add(mk(GEO.hairFlow, hair, -0.15, 1.15, 1, 0.65)); head.add(hairFlow);
  const arm = (side: number): Arm => {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.185 * wide, 0.22, 0); chest.add(shoulder);
    shoulder.add(mk(GEO.shoulder, sleeve)); shoulder.add(mk(GEO.upperArm, sleeve, -0.13));
    const elbow = new THREE.Group(); elbow.position.y = -0.26; shoulder.add(elbow); elbow.add(mk(GEO.foreArm, sleeve, -0.12));
    const hand = new THREE.Mesh(GEO.hand, skin); hand.scale.set(0.8, 1.25, 0.6); hand.position.y = -0.25; elbow.add(hand); return { shoulder, elbow, hand };
  };
  const leg = (side: number): Leg => {
    const hipJoint = new THREE.Group(); hipJoint.position.set(side * 0.098 * wide, -0.04, 0); hips.add(hipJoint); hipJoint.add(mk(GEO.thigh, pants, -0.21));
    const knee = new THREE.Group(); knee.position.y = -0.43; hipJoint.add(knee); knee.add(mk(GEO.shin, pants, -0.21));
    const foot = new THREE.Group(); foot.position.y = -0.42; knee.add(foot);
    const sh = mk(GEO.shoe, shoe, -0.02); sh.position.z = 0.04; const hl = mk(GEO.heel, shoe, -0.04); hl.position.set(0, -0.035, -0.03); if (role !== "dancer") hl.visible = false; foot.add(sh, hl);
    return { hipJoint, knee, foot };
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
  // props: all hidden until an outfit or role asks for them
  const hat = new THREE.Group(); hat.add(mk(GEO.brim, mat(0x5a3a1c, 0.7), 0.0), mk(GEO.crown, mat(0x5a3a1c, 0.7), 0.06)); hat.position.y = 0.19; hat.visible = false; head.add(hat);
  const boa = new THREE.Mesh(GEO.boa, mat(0xff9fc2, 0.9)); boa.rotation.x = Math.PI / 2; boa.position.y = 0.22; boa.visible = false; chest.add(boa);
  const skirt = new THREE.Mesh(GEO.skirt, outfit); skirt.position.y = -0.14; skirt.material = outfit; skirt.visible = false; (outfit as THREE.Material).side = THREE.DoubleSide; hips.add(skirt);
  const broom = new THREE.Group(); const stick = mk(GEO.pole, mat(0x8a6a3a)), brs = mk(GEO.bristle, mat(0xc9a24a), -0.7); broom.add(stick, brs); broom.visible = role === "cleaner"; broom.position.set(0, -0.22, 0.05); armR.hand.add(broom);
  const mic = mk(GEO.mic, mat(0xdddddd, 0.3, 0.8), 0, 1, 1, 1) as THREE.Mesh; mic.visible = role === "mc"; mic.position.y = -0.04; armR.hand.add(mic);
  if (role === "bouncer") { const s = mk(GEO.shades, mat(0x050505, 0.1), 0.06); s.position.z = 0.085; head.add(s); }
  if (role === "dj") { const hp = new THREE.Mesh(GEO.cans, mat(0xc74d57, 0.4, 0.5)); hp.position.y = 0.06; hp.rotation.z = 0; head.add(hp); }
  if (role === "famiglia") { hat.visible = true; hat.children.forEach((k) => ((k as THREE.Mesh).material = mat(0x1b1b24, 0.6))); hat.scale.setScalar(0.8); }
  const height = THREE.MathUtils.clamp((look?.scale ?? 1) * (role === "dancer" ? 0.98 : 1), 0.9, 1.1); root.scale.setScalar(height * (CHAR_HEIGHT / 1.75));
  const m: Mosaic = { c: null, bb: null, root, rig: { hips, spine, chest, head, hairFlow, armL, armR, legL, legR }, role, name, id, skin, outfit, hair, base: palette[role].clone(), props: { hat, boa, skirt, broom, mic }, label: null, outfitId: "own", height };
  m.c = c; attachBillboard(m);
  if (role === "dancer") { m.label = nameSprite(name); root.add(m.label); }
  return m;
}

/** Dress a dancer: colour, shine, glow and the props that come with the outfit. Own colours = the Mosaic's own. */
function attachBillboard(m: Mosaic): void {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 320; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sprite.center.set(0.5, 0.06); sprite.scale.set(1.9, 2.38, 1);
  m.root.add(sprite); m.bb = { cv, g: cv.getContext("2d")!, tex, sprite, last: -1e9, key: "" };
  m.rig.hips.visible = false; // the joint rig still drives position and bounce; the Mosaic herself is the picture
}
export function paintBillboard(m: Mosaic, draw: DrawFn, now: number, doing: string, fear: number, color: string | undefined, every: number): void {
  const b = m.bb; if (!b || !m.root.visible) return; if (now - b.last < every) return; b.last = now;
  b.g.setTransform(1, 0, 0, 1, 0, 0); b.g.clearRect(0, 0, 256, 320);
  try { draw(m.c, b.g, 128, 296, m.role === "bouncer" ? 2.1 : 1.9, now, doing, { fear, color, glam: m.role === "dancer" }); } catch { /* one bad figure never stops the show */ }
  b.tex.needsUpdate = true;
}

export function applyOutfit(m: Mosaic, id: string, glowBoost = 0): void {
  const o = OUTFITS.find((x) => x.id === id) ?? OUTFITS[0]; m.outfitId = o.id;
  m.outfit.color.copy(o.color !== undefined ? new THREE.Color(o.color) : m.base); m.outfit.emissive.copy(m.outfit.color); m.outfit.metalness = o.metal; m.outfit.emissiveIntensity = o.glow + glowBoost;
  m.props.hat.visible = !!o.hat; m.props.boa.visible = !!o.boa; m.props.skirt.visible = !!o.skirt;
}

export function resetPose(m: Mosaic): void {
  const r = m.rig; m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0);
  r.hips.position.set(0, 0.94, 0); for (const g of [r.hips, r.spine, r.chest, r.head, r.hairFlow, r.armL.shoulder, r.armL.elbow, r.armR.shoulder, r.armR.elbow, r.legL.hipJoint, r.legL.knee, r.legR.hipJoint, r.legR.knee]) g.rotation.set(0, 0, 0);
}

/** The five routines from the sandbox. `t` advances PI per beat; `elapsed` is seconds; `bpmK` is tempo over 118. */
export function applyRoutine(m: Mosaic, routine: Routine, t: number, elapsed: number, bpmK: number, hasPole: boolean): void {
  const rig = m.rig, root = m.root;
  if (routine === "poleSpin" && hasPole) {
    const a = elapsed * bpmK * 1.35; root.position.x = Math.sin(a) * 0.34; root.position.z = Math.cos(a) * 0.34; root.rotation.y = a - Math.PI / 2;
    rig.hips.position.y = 1.06 + Math.sin(t * 0.5) * 0.16; rig.hips.rotation.z = -0.22; rig.spine.rotation.z = -0.14; rig.chest.rotation.x = -0.16; rig.head.rotation.set(-0.18, 0.25, 0); rig.hairFlow.rotation.z = -0.35 + Math.sin(t) * 0.12;
    rig.armL.shoulder.rotation.set(-2.55, 0, 0.32); rig.armL.elbow.rotation.set(-0.35, 0, 0); rig.armR.shoulder.rotation.set(-0.4 + Math.sin(t * 0.5) * 0.2, 0, -1.25); rig.armR.elbow.rotation.set(-0.3, 0, -0.25);
    rig.legL.hipJoint.rotation.set(-0.65, 0, 0.15); rig.legL.knee.rotation.set(1.25, 0, 0); rig.legR.hipJoint.rotation.set(0.42 + Math.sin(t * 0.5) * 0.18, 0, -0.35); rig.legR.knee.rotation.set(0.28, 0, 0);
  } else if (routine === "hipSway") {
    root.position.z = hasPole ? 0.36 : 0; const s = Math.sin(t), w = Math.sin(t * 2);
    rig.hips.position.x = s * 0.13; rig.hips.position.y = 0.9 + Math.abs(Math.cos(t)) * 0.04; rig.hips.rotation.z = -s * 0.18; rig.hips.rotation.y = Math.cos(t) * 0.26;
    rig.spine.rotation.z = s * 0.16; rig.spine.rotation.x = w * 0.12; rig.chest.rotation.x = -w * 0.14; rig.chest.rotation.y = -Math.cos(t) * 0.18; rig.head.rotation.z = -s * 0.1; rig.head.rotation.y = s * 0.15; rig.hairFlow.rotation.z = -s * 0.22;
    rig.armL.shoulder.rotation.set(-1.75 + Math.sin(t) * 0.25, 0, 0.55); rig.armL.elbow.rotation.set(-1.35, 0, 0.3); rig.armR.shoulder.rotation.set(-0.35, 0, -0.52 - Math.cos(t) * 0.18); rig.armR.elbow.rotation.set(-0.85, 0, 0.45);
    rig.legL.hipJoint.rotation.set(-0.18 - s * 0.12, 0, 0.12); rig.legL.knee.rotation.set(0.32 + s * 0.14, 0, 0); rig.legR.hipJoint.rotation.set(-0.18 + s * 0.12, 0, -0.12); rig.legR.knee.rotation.set(0.32 - s * 0.14, 0, 0);
  } else if (routine === "floorWork") {
    root.position.z = hasPole ? 0.52 : 0; const a = Math.sin(t * 0.75);
    rig.hips.position.y = 0.46 + a * 0.06; rig.hips.rotation.x = 0.42; rig.hips.rotation.z = Math.cos(t * 0.75) * 0.12; rig.spine.rotation.x = -0.35 - a * 0.2; rig.chest.rotation.x = -0.25 - a * 0.15; rig.head.rotation.x = 0.2 + a * 0.18; rig.hairFlow.rotation.x = 0.35;
    rig.armL.shoulder.rotation.set(-0.95, 0, 0.32); rig.armL.elbow.rotation.set(-0.25, 0, 0); rig.armR.shoulder.rotation.set(-1.1 + a * 0.4, 0, -0.45); rig.armR.elbow.rotation.set(-0.4, 0, 0);
    rig.legL.hipJoint.rotation.set(-1.25, 0, 0.38); rig.legL.knee.rotation.set(1.95, 0, 0); rig.legR.hipJoint.rotation.set(-0.85 + a * 0.22, 0, -0.58); rig.legR.knee.rotation.set(1.25 - a * 0.25, 0, 0);
  } else if (routine === "clubFreestyle") {
    root.position.set(Math.sin(t * 0.5) * 0.16, 0, hasPole ? 0.44 : 0); root.rotation.y = Math.sin(t * 0.5) * 0.28; const b = Math.abs(Math.sin(t * 2));
    rig.hips.position.y = 0.88 + b * 0.075; rig.hips.rotation.y = Math.sin(t) * 0.32; rig.hips.rotation.z = Math.sin(t) * 0.12; rig.spine.rotation.y = -Math.sin(t) * 0.22; rig.chest.rotation.x = b * 0.1; rig.head.rotation.x = b * 0.14; rig.hairFlow.rotation.x = b * 0.2;
    rig.armL.shoulder.rotation.set(-1.2 + Math.sin(t * 2) * 0.65, 0, 0.48); rig.armL.elbow.rotation.set(-0.95, 0, 0.2); rig.armR.shoulder.rotation.set(-1.2 - Math.sin(t * 2) * 0.65, 0, -0.48); rig.armR.elbow.rotation.set(-0.95, 0, -0.2);
    rig.legL.hipJoint.rotation.set(-0.22 + Math.sin(t) * 0.24, 0, 0.14); rig.legL.knee.rotation.set(0.36 + b * 0.25, 0, 0); rig.legR.hipJoint.rotation.set(-0.22 - Math.sin(t) * 0.24, 0, -0.14); rig.legR.knee.rotation.set(0.36 + b * 0.25, 0, 0);
  } else {
    root.position.z = hasPole ? 0.36 : 0; const br = Math.sin(elapsed * 1.8);
    rig.hips.position.x = 0.06; rig.hips.position.y = 0.93; rig.hips.rotation.z = -0.1; rig.hips.rotation.y = 0.18; rig.spine.rotation.z = 0.08; rig.chest.rotation.x = br * 0.035; rig.head.rotation.y = -0.14 + Math.sin(elapsed * 0.7) * 0.08;
    rig.armL.shoulder.rotation.set(-0.2, 0, 0.48); rig.armL.elbow.rotation.set(-0.95, 0, -0.45); rig.armR.shoulder.rotation.set(0.08, 0, -0.16); rig.armR.elbow.rotation.set(-0.22, 0, 0);
    rig.legL.hipJoint.rotation.set(-0.08, 0, 0.08); rig.legL.knee.rotation.set(0.14, 0, 0); rig.legR.hipJoint.rotation.set(0.04, 0, -0.12); rig.legR.knee.rotation.set(0.06, 0, 0);
  }
}
