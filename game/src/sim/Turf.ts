import { impairment } from './Substances';
import type { Simulation } from "./Simulation";
import { Character, Phys, Toy } from "../entities/types";
import { TOYS, isGun, isBullet } from "../content/toys";
import { applyImpact, shieldBlocks } from "../physics/combat";
import { GRAVITY } from "../physics/PhysicsWorld";
import { Rng } from "../core/rng";
import { clamp } from "../core/math";
import { commitCrime, reportCrime, exitBuilding } from "./Society";
import { wound, pickPart } from "./Life";
import { forceGoal } from "../ai/brain";
import { TICKS_PER_HOUR } from "./Environment";

/**
 * Cartoon firearms and the Famiglia / Riccarton Boys turf war.
 *
 * Guns fire real projectiles (bullets, buckshot) through the same physics as darts and pellets; a hit
 * goes through the wound system. Every shot is loud: bystanders panic, witnesses call it in and armed
 * officers respond. Turf skirmishes are rare by design: at most one every 10+ game hours, at night,
 * on the border between the two crews' patches (the SALT District off Tuam St).
 */

export const CREWS: Record<string, { name: string; color: string }> = {
  famiglia: { name: "the Famiglia", color: "#f6b62c" },
  riccarton: { name: "the Riccarton Boys", color: "#3dd6ff" },
};

const RICCARTON_NICKS = ["Hubcap", "Skids", "Two-Stroke", "Mullet", "Burnout", "Spoiler", "Muffler Steve", "Nitro"];
const RICCARTON_BIOS = [
  "Riccarton Boys. Sells hubcaps off the back of a ute. Wants the SALT District, mostly for the parking.",
  "Riccarton Boys. Has a neck tattoo of a turbo. Revs at pedestrians.",
  "Riccarton Boys. Claims he invented the burnout. Still owes the Don for a pie.",
  "Riccarton Boys. Runs the car-yard side hustle. Thinks the Famiglia's tomatoes are 'mid'.",
];

interface Skirmish { x: number; y: number; members: number[]; guns: number[]; until: number; area: string }
interface TurfState { rng: Rng; nextAt: number; active: Skirmish | null; shots: Map<number, number>; crimeAt: Map<number, number> }
const STATE = new WeakMap<Simulation, TurfState>();
const tmp: number[] = [];

function state(sim: Simulation): TurfState {
  let s = STATE.get(sim);
  if (!s) {
    // own stream so adding the turf war doesn't reshuffle the rest of the simulation
    s = { rng: new Rng((sim.cfg.seed ^ 0x7a2f) >>> 0), nextAt: sim.tick + 5 * TICKS_PER_HOUR, active: null, shots: new Map(), crimeAt: new Map() };
    STATE.set(sim, s);
  }
  return s;
}

const hourIn = (h: number, a: number, b: number) => (a < b ? h >= a && h < b : h >= a || h < b);
const heldDef = (sim: Simulation, c: Character | undefined): string | null => (c && c.hand >= 0 ? sim.toys[c.hand]?.def ?? null : null);
export const holdsGun = (sim: Simulation, c: Character | undefined): boolean => { const d = heldDef(sim, c); return !!d && isGun(d); };
const free = (c: Character) => c.tier !== "player" && c.jailUntil <= 0 && c.arrestedBy < 0 && c.inCar < 0 && c.phys === Phys.OK && c.mode !== "panic";

/* ================================================================ gangs */

/** Tag the Famiglia, recruit the Riccarton Boys and issue cops their sidearms. Idempotent (also fixes old saves). */
export function ensureGangs(sim: Simulation): void {
  const st = state(sim);
  for (const c of sim.chars) if (c.role === "mobster" && !c.crew) c.crew = "famiglia";
  for(const c of sim.chars){
    const def=c.role==='cop'?'pistol':c.role==='mobster'?(c.id%5===0?'rifle':c.id%3===0?'smg':'pistol'):c.role==='smuggler'?'revolver':undefined;
    if(def&&c.tier!=='player'&&!c.combat?.issued){if(!carriedGun(sim,c))issue(sim,c,def,c.role!=='cop');const reserve=c.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};reserve.ammo[def]=(TOYS[def].weapon?.mag??12)*3;reserve.issued=true;}
  }
  if (sim.chars.some((c) => c.crew === "riccarton")) return;
  const pool = sim.chars.filter((c) => c.tier === "mid" && (c.role === "local" || c.role === "student" || c.role === "office" || c.role === "car_enthusiast") && c.partner < 0 && !c.nickname && !c.crew);
  if (pool.length < 7) return; // tiny test worlds: leave the locals alone
  const yard = sim.world.areas.find((a) => a.kind === "dealership");
  const work = sim.world.buildings.find((b) => b.kind === "dealership" && b.name.startsWith("Riccarton")) ?? sim.world.buildings.find((b) => b.kind === "dealership");
  const boys: Character[] = [];
  for (let i = 0; i < 4; i++) {
    const c = pool.splice(st.rng.int(0, pool.length - 1), 1)[0];
    c.role = "mobster"; c.crew = "riccarton";
    c.nickname = RICCARTON_NICKS[i * 2 + st.rng.int(0, 1)];
    c.look.hat = "snapback"; c.look.accent = CREWS.riccarton.color; c.dirty = true;
    c.pers.boldness = clamp(c.pers.boldness + 0.25, 0, 1); c.pers.honesty = clamp(c.pers.honesty - 0.3, 0, 1); c.pers.temper = clamp(c.pers.temper + 0.15, 0, 1);
    if (yard) c.homeArea = yard.id;
    if (work) c.workplace = work.id;
    c.bio = `${c.name} ("${c.nickname}"). ${RICCARTON_BIOS[i]}`;
    issue(sim,c,'pistol',true);c.combat={style:'jab',xp:0,ammo:{pistol:36},vest:0,helmet:0,issued:true};
    boys.push(c);
  }
  const fam = sim.chars.filter((c) => c.crew === "famiglia");
  for (const a of boys) {
    for (const b of boys) if (a !== b) { const r = sim.relate(a, b.id); r.aff = Math.max(r.aff, 0.5); r.trust = Math.max(r.trust, 0.45); r.fam = Math.max(r.fam, 0.8); }
    for (const f of fam) for (const [x, y] of [[a, f], [f, a]] as const) { const r = sim.relate(x, y.id); r.rivalry = Math.max(r.rivalry, 0.25); r.aff = Math.min(r.aff, -0.1); r.fam = Math.max(r.fam, 0.4); }
  }
}

function hasCarried(sim: Simulation, c: Character, def: string): boolean {
  return [c.hand, ...c.bag].some((id) => id >= 0 && sim.toys[id]?.def === def && sim.toys[id].holder === c.id);
}

/** Put a new gun on someone: in hand (drawn) or in the bag (holstered). The bag stretches to fit a sidearm. */
function carriedGun(sim:Simulation,c:Character):boolean{return [c.hand,...c.bag].some(id=>id>=0&&TOYS[sim.toys[id]?.def]?.weapon?.gun);}

function issue(sim: Simulation, c: Character, def: string, draw: boolean): Toy | null {
  const t = sim.spawnToy(def, c.x, c.y, 1);
  if (!t) return null;
  t.owner = c.id; t.holder = c.id; t.state = "held"; t.vx = t.vy = t.vz = 0;
  if (draw) { if (c.hand >= 0) c.bag.push(c.hand); c.hand = t.id; }
  else if (c.hand < 0) c.hand = t.id; else c.bag.push(t.id);
  c.bagMax = Math.max(c.bagMax, c.bag.length);
  return t;
}

/** Bring a carried gun to hand (true if they now hold one). */
export function drawGun(sim: Simulation, c: Character): boolean {
  if (holdsGun(sim, c)) return true;
  const i = c.bag.findIndex((id) => isGun(sim.toys[id]?.def ?? ""));
  if (i < 0) return false;
  const id = c.bag[i];
  c.bag.splice(i, 1);
  if (c.hand >= 0) c.bag.push(c.hand);
  c.hand = id;
  return true;
}

/** Put the gun away (back in the bag), bringing out whatever else they carry. */
export function holster(sim: Simulation, c: Character): void {
  if (!holdsGun(sim, c)) return;
  const id = c.hand;
  c.hand = c.bag.length ? c.bag.shift()! : -1;
  c.bag.push(id);
}

/** Cops carry a sidearm; anyone else counts if they're holding a gun or fired one in the last 20 seconds. */
export function isArmed(sim: Simulation, c: Character): boolean {
  if (holdsGun(sim, c)) return true;
  const at = state(sim).crimeAt.get(c.id);
  return at !== undefined && sim.tick - at < 60 * 20 && [c.hand, ...c.bag].some((id) => id >= 0 && isGun(sim.toys[id]?.def ?? ""));
}

/** Nearest rival worth shooting at during a skirmish: the other crew, or a cop who is after me. */
export function nearestFoe(sim: Simulation, c: Character, r: number): Character | null {
  const n = sim.charHash.query(c.x, c.y, r, tmp);
  let best: Character | null = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const o = sim.chars[tmp[i]];
    if (o === c || o.phys === Phys.DOWN || o.inside >= 0 || o.inCar >= 0 || o.jailUntil > 0 || o.arrestedBy >= 0) continue;
    const rival = (o.crew && c.crew && o.crew !== c.crew) || (o.role === "cop" && o.pursuing === c.id);
    if (!rival) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < bd && sim.world.lineOfSight(c.x, c.y, o.x, o.y)) { bd = d; best = o; }
  }
  return best;
}

/* ================================================================ firing */

/** Pull the trigger on a held gun. Respects rate of fire and magazine reloads. Returns true if it fired. */
export function fireGun(sim: Simulation, c: Character, tx: number, ty: number, targetId: number): boolean {
  const def = heldDef(sim, c);
  const ws = def ? TOYS[def].weapon : undefined;
  if (!def || !ws?.gun || (c.substances?.actionUntil??0)>sim.tick || c.phys!==Phys.OK || c.wounds.some(w=>w.part==='arm'&&w.detached)||!Number.isFinite(tx+ty)) return false;
  if ((sim.nextAttack.get(c.id) ?? 0) > sim.tick) return false;
  if(c.combat?.reloadWeapon===def&&(c.combat.reloadUntil??0)>sim.tick||c.weaponAction?.weapon===def&&(c.weaponAction.reloadUntil??0)>sim.tick)return false;
  if(c.combat){const base=def==='golden_pistol'?'pistol':def,key=(c.combat.load??'standard')==='standard'?base:base+':'+c.combat.load,rounds=c.combat.ammo[key]??0;if(rounds<=0)return false;c.combat.ammo[key]=rounds-1;}
  const st = state(sim);
  let wait = ws.rate;
  const fired = (c.combat ? c.combat.magUsed?.[def]??0 : st.shots.get(c.id)??0) + 1;
  if (ws.mag && fired >= ws.mag) { st.shots.set(c.id, 0); wait += ws.reload ?? 1.5; sim.bus.emit("sound", { kind: "reload_"+def, x: c.x, y: c.y, vol: 0.5 }); }
  else st.shots.set(c.id, fired);
  if(c.combat){c.combat.magUsed??={};c.combat.magUsed[def]=ws.mag&&fired>=ws.mag?0:fired;if(ws.mag&&fired>=ws.mag){c.combat.reloadUntil=sim.tick+Math.round(wait*60);c.combat.reloadWeapon=def;}}
  sim.nextAttack.set(c.id, sim.tick + Math.round(wait * 60));

  c.weaponAction={weapon:def,firedAt:sim.tick,shots:fired,...(ws.mag&&fired>=ws.mag?{reloadFrom:sim.tick+Math.round(ws.rate*60),reloadUntil:sim.tick+Math.round(wait*60)}:{})};
  sim.bus.emit('sound',{kind:'mechanism_'+def,x:c.x,y:c.y,vol:.5});
  const base = Math.atan2(ty - c.y, tx - c.x);
  c.facing = base; c.anim.pose = "shoot"; c.anim.poseT = 0;
  const steady = c.tier === "player" ? 1.1 : (0.7 + c.emo.confidence * 0.3) * (c.emo.fear > 0.5 ? 0.8 : 1);
  const recoil=c.combat?Math.max(0,(c.combat.recoil??0)-(sim.tick-(c.combat.recoilTick??0))/60*.9):0;
  const moving=Math.min(1,Math.hypot(c.vx,c.vy)/2),hurt=c.wounds.filter(w=>w.part==='arm').reduce((sum,w)=>sum+w.severity,0);
  const acc = clamp(ws.accuracy * steady - moving*.16 - impairment(c)*.25 - hurt*.045 - recoil*.18, 0.05, 0.97);
  if(c.combat){c.combat.recoil=Math.min(1.5,recoil+(def==='shotgun'?.55:def==='rifle'?.35:.2));c.combat.recoilTick=sim.tick;}
  const kick=(def==='shotgun'?.18:.06)*(c.combat?.load==='heavy'?1.3:1);
  c.kx-=Math.cos(base)*kick;c.ky-=Math.sin(base)*kick;
  const muzzleReach=Math.min(def==='rifle'||def==='shotgun'?.8:.5,Math.hypot(tx-c.x,ty-c.y)*.4);
  const mx = c.x + Math.cos(base) * muzzleReach, my = c.y + Math.sin(base) * muzzleReach, mz = c.z + 1.6;
  const pellets = ws.pellets ?? 1, speed = 18;
  for (let i = 0; i < pellets; i++) {
    const b = sim.spawnToy(ws.ammo ?? "bullet", mx, my, mz);
    if (!b) break;
    const a = base + sim.rng.gauss() * (1 - acc) * (c.tier === "player" ? 0.12 : 0.3) + (pellets > 1 ? sim.rng.range(-(ws.spread ?? 0.2), ws.spread ?? 0.2) : 0);
    const time = Math.max(.04,Math.min(ws.reach,Math.hypot(tx-mx,ty-my))/speed), tz = 1.05 + sim.rng.gauss() * (c.tier === "player" ? 0.045 : 0.2);
    b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed; b.vz = (tz - mz) / time + 0.5 * GRAVITY * time;
    b.state = "flying"; b.thrower = c.id; b.throwTick = sim.tick; b.angle = a;
    b.load=c.combat?.load??'standard';b.weaponOrigin=def;
    if (targetId >= 0) sim.throwIntent.set(b.id, targetId); else sim.throwIntent.delete(b.id);
  }
  // muzzle flash, a spent casing, the bang
  sim.bus.emit("fx", { kind: "flash", x: mx, y: my, z: mz, n: 1 });
  sim.bus.emit("fx", { kind: "spark", x: mx, y: my, z: mz, n: 3, color: "#ff9a3d" });
  sim.bus.emit("fx", { kind: "spark", x: c.x - Math.sin(base) * 0.25, y: c.y + Math.cos(base) * 0.25, z: c.z + 1.5, n: 1, color: pellets > 1 ? "#ec2a1c" : "#f6b62c" });
  if (def === "golden_pistol") sim.bus.emit("fx", { kind: "confetti", x: mx, y: my, z: mz, n: 6 });
  sim.bus.emit("sound", { kind: def === "shotgun" ? "bang_shotgun" : def === "smg" ? "bang_smg" : "bang", x: c.x, y: c.y, vol: 1 });
  c.stats.throws++;
  sim.lod.markHot(c.id, sim.tick, 600);
  afterShot(sim, c, def, targetId);
  return true;
}

/** Everyone nearby hears it: panic, a "shots fired" report, armed police. */
function afterShot(sim: Simulation, c: Character, def: string, targetId: number): void {
  const st = state(sim);
  const n = sim.charHash.query(c.x, c.y, 13, tmp);
  for (let i = 0; i < n; i++) {
    const o = sim.chars[tmp[i]];
    if (o === c || o.tier === "player" || o.role === "cop" || o.inside >= 0) continue;
    if (o.crew && st.active?.members.includes(o.id)) continue; // the other shooters are in it already
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    const near = 1 - d / 14;
    o.emo.fear = Math.min(1, o.emo.fear + (o.tier === "background" ? 0.7 : (0.35 + (1 - o.pers.boldness) * 0.45) * (0.5 + near)));
    if (o.talkWith >= 0 && o.emo.fear > 0.6) sim.endConversation(o);
  }
  sim.emit({ type: "gunshot", x: c.x, y: c.y, actors: targetId >= 0 ? [c.id, targetId] : [c.id], toy: def, summary: `Gunshots near ${sim.world.areaAt(c.x, c.y)?.name ?? "the street"}!` });
  if (c.role === "cop") return; // police fire is not a crime (in this city, anyway)
  const last = st.crimeAt.get(c.id);
  st.crimeAt.set(c.id, sim.tick);
  if (last !== undefined && sim.tick - last < 60 * 6) return; // one report per burst
  const victim = targetId >= 0 ? sim.chars[targetId] ?? null : null;
  const seen = commitCrime(sim, c, "gunfire", victim, def);
  const crime = sim.crimes[sim.crimes.length - 1];
  // unseen gunfire is still heard: someone usually rings it in (no wanted stars without a witness)
  if (!seen && crime && crime.perp === c.id && st.rng.chance(0.6)) reportCrime(sim, crime, -1);
  if (crime?.reported) dispatchArmed(sim, c, 2);
}

/** Send up to `n` officers (counting any already on it) after an armed suspect, sidearms drawn. */
export function dispatchArmed(sim: Simulation, perp: Character, n: number): void {
  const on = sim.chars.filter((c) => c.role === "cop" && c.pursuing === perp.id);
  for (const c of on) if (!hasCarried(sim, c, "pistol")) issue(sim, c, "pistol", false);
  if (on.length >= n) return;
  const cops = sim.chars
    .filter((c) => c.role === "cop" && c.tier !== "player" && c.pursuing < 0 && c.jailUntil <= 0 && c.phys === Phys.OK)
    .map((c) => ({ c, d: Math.hypot(c.x - perp.x, c.y - perp.y) + (c.inside >= 0 ? 20 : 0) }))
    .filter((x) => x.d < 45)
    .sort((a, b) => a.d - b.d)
    .slice(0, n - on.length);
  for (const { c } of cops) {
    if (!hasCarried(sim, c, "pistol")) issue(sim, c, "pistol", false);
    c.pursuing = perp.id;
    if (c.inside >= 0) exitBuilding(sim, c);
    if (c.inCar >= 0) { const v = sim.vehicles[c.inCar]; if (v) v.siren = true; }
    else sim.afterConversation(() => forceGoal(c, sim, "pursue", { u: 1, target: perp.id }));
    sim.emit({ type: "police", x: perp.x, y: perp.y, actors: [c.id, perp.id], summary: `Armed police: Officer ${c.name.split(" ")[0]} is responding to shots fired` });
  }
}

/** A bullet or buckshot pellet hit someone. Called from Rules before the normal toy-hit handling. */
export function bulletHit(sim: Simulation, t: Toy, c: Character, nx: number, ny: number): void {
  const shooter = sim.chars[t.thrower];
  const gunDef = t.weaponOrigin??heldDef(sim, shooter);
  const gun = gunDef && isGun(gunDef) ? gunDef : "pistol";
  const original=TOYS[gun].weapon!,factor=t.load==='rubber'?.4:t.load==='heavy'?1.3:1;
  const ws={...original,damage:original.damage*factor,knockback:original.knockback*factor};
  // spent: out of play straight away (no bounce, no "broken toy" event)
  t.state = "broken"; t.brokenAt = sim.tick; t.holder = -1; t.vx = t.vy = t.vz = 0; t.durability = 1;
  const hx = t.x, hy = t.y, hz = t.z;
  t.x = -100; t.y = -100;
  sim.throwIntent.delete(t.id);
  const blocked = shooter ? shieldBlocks(c, sim.toys, shooter.x, shooter.y) : false;
  const kb = ws.knockback / (ws.pellets ?? 1) * (ws.pellets ? 2 : 1);
  const res = applyImpact(c, kb, nx, ny, blocked, sim.cfg.maxImpulse, ws.damage);
  sim.bus.emit("fx", { kind: blocked ? "spark" : "impact", x: hx, y: hy, z: hz, n: 6, color: blocked ? "#eee4d3" : "#ff9a3d" });
  sim.bus.emit("sound", { kind: blocked ? "ricochet" : "hit_metal", x: hx, y: hy, vol: 0.7 });
  if (!blocked) {
    const part = pickPart(sim, hz);
    const heavy = ws.damage >= 2.8;
    const sev = (part === "head" ? 3 : part === "torso" ? (heavy || sim.rng.chance(0.35) ? 3 : 2) : sim.rng.chance(heavy ? 0.8 : 0.55) ? 2 : 1) as 1 | 2 | 3;
    wound(sim, c, part, t.load==='rubber'?1:sev, t.load==='rubber'?"bruise":part === "head" ? "gash" : sev >= 2 ? "cut" : "graze", shooter?.id ?? -1, shooter?.x ?? hx, shooter?.y ?? hy,gun,t.load);
    // a bad hit puts them on the floor for a while (paramedics do the rest)
    if (sev >= 3 && c.tier !== "player" && c.phys !== Phys.DOWN) { c.phys = Phys.DOWN; c.physTimer = 5 + sim.rng.range(0, 4); c.vz = 2; c.stats.falls++; }
  }
  if (shooter && shooter !== c) sim.onImpact(shooter, c, gun, res, false);
}

/** A bullet hit a wall or the ground: a spark and a ricochet, nothing else. */
export function bulletBounce(sim: Simulation, t: Toy): void {
  sim.bus.emit("fx", { kind: "spark", x: t.x, y: t.y, z: t.z, n: 4, color: "#fff6c8" });
  sim.bus.emit("sound", { kind: "ricochet", x: t.x, y: t.y, vol: 0.3 });
  t.state = "broken"; t.brokenAt = sim.tick; t.vx = t.vy = t.vz = 0; t.x = -100; t.y = -100;
  sim.throwIntent.delete(t.id);
}
export { isBullet };

/* ================================================================ turf war */

function borderPoint(sim: Simulation, rng: Rng): { x: number; y: number; name: string } | null {
  const a = sim.world.areas.find((x) => x.name === "SALT District") ?? sim.world.areas.find((x) => x.name === "Tuam Laneways") ?? sim.world.areas.find((x) => x.kind === "alley");
  if (!a) return null;
  const p = sim.world.randomPointIn(a, rng);
  return { x: p.x, y: p.y, name: a.name };
}

/** Start a skirmish between the Famiglia and the Riccarton Boys. `force` skips the time and cooldown checks. */
export function startTurfWar(sim: Simulation, force = false, sides: [string,string] = ["famiglia","riccarton"], location?: {x:number;y:number;name:string}): boolean {
  ensureGangs(sim);
  const st = state(sim);
  if (st.active) return false;
  if (!force && (sim.tick < st.nextAt || !hourIn(sim.hour, 19, 3))) return false;
  const spot = location ?? borderPoint(sim, st.rng);
  if (!spot) return false;
  const pickSide = (crew: string) => sim.chars
    .filter((c) => c.crew === crew && c.nickname !== "The Don" && free(c))
    .map((c) => ({ c, d: Math.hypot(c.x - spot.x, c.y - spot.y) + (c.inside >= 0 ? 15 : 0) }))
    .sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.c);
  const fam = pickSide(sides[0]), ric = pickSide(sides[1]);
  if (fam.length < 2 || ric.length < 2) return false;
  const sk: Skirmish = { x: spot.x, y: spot.y, members: [], guns: [], until: sim.tick + 60 * 150, area: spot.name };
  const armoury: Record<string, string[]> = { famiglia: ["revolver", "pistol", "shotgun"], riccarton: ["smg", "pistol", "shotgun"] };
  [fam, ric].forEach((side, s) => side.forEach((c, i) => {
    if (c.inside >= 0) exitBuilding(sim, c);
    if (c.talkWith >= 0) sim.endConversation(c);
    let def = (armoury[c.crew]??["pistol","shotgun","smg"])[i % 3];
    if (c.crew === "famiglia" && c.nickname === "" && st.rng.chance(0.15)) def = "golden_pistol"; // someone always brings the flashy one
    const gun = issue(sim, c, def, false);
    if (gun) sk.guns.push(gun.id);
    sk.members.push(c.id);
    sim.lod.markHot(c.id, sim.tick, 60 * 150);
    // each crew lines up on its own side of the street
    const p = sim.world.nearestWalkable(spot.x + (s === 0 ? -4 : 4) + st.rng.range(-1, 1), spot.y + st.rng.range(-2, 2));
    c.goalCooldowns.turf = 0;
    sim.afterConversation(() => forceGoal(c, sim, "turf", { u: 2, target: -1, x: p.x, y: p.y }));
  }));
  st.active = sk;
  st.nextAt = sim.tick + Math.round(st.rng.range(10, 16) * TICKS_PER_HOUR);
  sim.emit({ type: "turf_war", x: spot.x, y: spot.y, actors: [fam[0].id, ric[0].id], summary: `Turf war! ${CREWS[sides[0]]?.name??sides[0]} and ${CREWS[sides[1]]?.name??sides[1]} are squaring off in ${spot.name}` });
  sim.toast(`Turf war brewing in ${spot.name}: ${CREWS[sides[0]]?.name??sides[0]} vs ${CREWS[sides[1]]?.name??sides[1]}. Keep your head down.`, "red");
  return true;
}

/** Periodic director: roll for a skirmish (rarely), and tidy up after one. */
export function updateTurf(sim: Simulation): void {
  const st = state(sim);
  if (sim.tick % 600 === 0) ensureGangs(sim);
  if(sim.tick%15===0)for(const c of sim.chars){if(c.tier==='player'||c.role==='cop'||c.inside>=0||c.inCar>=0||c.phys!==Phys.OK||sim.tick-c.lastHitTick>300||c.lastHitBy<0||!carriedGun(sim,c))continue;const a=sim.chars[c.lastHitBy];if(a&&Math.hypot(a.x-c.x,a.y-c.y)<11&&sim.world.lineOfSight(c.x,c.y,a.x,a.y)&&drawGun(sim,c))fireGun(sim,c,a.x,a.y,a.id);}
  const sk = st.active;
  if (sk) {
    const busy = sk.members.some((id) => sim.chars[id]?.goal?.id === "turf");
    if (sim.tick > sk.until || (!busy && sim.tick > sk.until - 60 * 120)) endTurfWar(sim);
    return;
  }
  if (sim.tick % TICKS_PER_HOUR === 0 && sim.tick >= st.nextAt && hourIn(sim.hour, 19, 3) && st.rng.chance(0.3)) startTurfWar(sim);
}

export function endTurfWar(sim: Simulation): void {
  const st = state(sim), sk = st.active;
  if (!sk) return;
  st.active = null;
  // the crews stash their guns again; a gun left lying in the street gets picked up by the police
  for (const id of sk.guns) {
    const t = sim.toys[id];
    if (!t || t.state === "broken") continue;
    const h = t.holder >= 0 ? sim.chars[t.holder] : undefined;
    if (h && (h.tier === "player" || !sk.members.includes(h.id))) continue; // someone else has it now: theirs to keep
    if (h) { if (h.hand === id) h.hand = h.bag.length ? h.bag.shift()! : -1; else { const i = h.bag.indexOf(id); if (i >= 0) h.bag.splice(i, 1); } }
    t.state = "broken"; t.brokenAt = sim.tick; t.holder = -1; t.x = -100; t.y = -100;
  }
  for (const id of sk.members) { const c = sim.chars[id]; if (c) { if(c.goal?.id==='turf'){c.goal=null;c.path=null;c.vx=c.vy=0;c.mode='idle';} c.bagMax = c.tier === "principal" ? 3 : 1; if (c.bag.length > c.bagMax) c.bagMax = c.bag.length; } }
  sim.emit({ type: "turf_war_end", x: sk.x, y: sk.y, summary: `The shooting in ${sk.area} has stopped. Sirens everywhere.` });
}

/** Whether a skirmish is on right now (for the UI / missions). */
export function turfWarActive(sim: Simulation): { x: number; y: number; area: string } | null {
  const sk = state(sim).active;
  return sk ? { x: sk.x, y: sk.y, area: sk.area } : null;
}

/** The new event types this module emits (registered at install time). */
export function registerTurfEvents(sim: Simulation): void {
  const reg = (type: string, label: string, priority: number, severity: 1 | 2 | 3 | 4, radius: number, cooldown: number, propagation: "sight" | "sound", key?: (e: { x: number; y: number; actors: number[] }) => string) => {
    if (!sim.events.defs.has(type)) sim.events.register({ type, label, priority, severity, radius, cooldown, propagation, topic: "crime", key });
  };
  reg("gunshot", "Gunshots", 8, 4, 14, 90, "sound", (e) => `gunshot:${Math.round(e.x / 6)}:${Math.round(e.y / 6)}`);
  reg("substance_use", "Substance use", 3, 2, 9, 120, "sight");
  reg("turf_war", "Turf war", 9, 4, 18, 600, "sound", () => "turf_war");
  reg("turf_war_end", "Turf war over", 5, 2, 18, 600, "sound", () => "turf_war_end");
}
