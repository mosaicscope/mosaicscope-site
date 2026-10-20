import {ensureStreetCrews,updateStreetLife} from './StreetLife';
import type { Simulation } from "./Simulation";
import { Character, MemoryKind, Phys, Toy } from "../entities/types";
import { TOYS } from "../content/toys";
import { applyImpact, shieldBlocks } from "../physics/combat";
import { applyInteraction, friendship, hostility, peek, remember } from "../social/Social";
import { WorldEvent } from "../events/WorldEvents";
import { forceGoal } from "../ai/brain";
import { commitCrime } from "./Society";
import { drop } from "../inventory/Inventory";
import { wound, pickPart } from "./Life";
import { bulletHit, bulletBounce, isBullet, registerTurfEvents, ensureGangs, updateTurf } from "./Turf";
import { registerRepEvents, updateRep } from "./Rep";

/**
 * Causal rules: physical outcomes become world events; world events change minds, memories and goals;
 * changed goals produce new physical outcomes. Everything here reacts to simulated facts; randomness
 * only decides between plausible reactions, weighted by personality.
 */
export function installRules(sim: Simulation): void {
  const tmp: number[] = [];
  const areaId = (x: number, y: number) => sim.world.areaAt(x, y)?.id ?? 0;
  const name = (id: number) => sim.chars[id]?.name ?? "someone";
  const fx = sim.bus;
  registerTurfEvents(sim);
  sim.events.register({type:"street_incident",label:"Street life",priority:4,severity:2,radius:14,cooldown:30,propagation:"sound"});
  registerRepEvents(sim);

  sim.hooks = {
    onToyHitChar(t: Toy, c: Character, impulse: number, nx: number, ny: number) {
      if (isBullet(t.def)) { bulletHit(sim, t, c, nx, ny); return; } // firearms: wounds, police, panic (sim/Turf.ts)
      const thrower = sim.chars[t.thrower];
      // a gentle, unaimed toss that bumps into someone is a startle, not an attack
      if (!sim.throwIntent.has(t.id) && impulse < 2 && thrower) {
        c.kx += nx * impulse * 0.5; c.ky += ny * impulse * 0.5; c.anim.flash = 0.1;
        if (c.tier !== "player" && c.phys === Phys.OK) sim.say(c, sim.dialogue.bark(c, "startled"), "shout", 1);
        sim.emit({ type: "near_miss", x: c.x, y: c.y, actors: [c.id, thrower.id], toy: t.def, summary: `${thrower.name}'s ${TOYS[t.def].name} bonked ${c.name}` });
        fx.emit("sound", { kind: "hit_" + TOYS[t.def].material, x: t.x, y: t.y, vol: 0.3 });
        return;
      }
      const blocked = thrower ? shieldBlocks(c, sim.toys, thrower.x, thrower.y) : false;
      const ammo = TOYS[t.def];
      const shooterWeapon = thrower && thrower.hand >= 0 ? TOYS[sim.toys[thrower.hand]?.def]?.weapon : undefined;
      const res = applyImpact(c, impulse, nx, ny, blocked, sim.cfg.maxImpulse, t.def === "droplet" ? 0.15 : shooterWeapon?.damage ?? 1);
      fx.emit("fx", { kind: t.def === "pellet" ? "paint" : t.def === "droplet" ? "water" : "impact", x: t.x, y: t.y, z: t.z, color: t.def === "pellet" ? thrower?.look.color ?? t.color : t.color, n: 8 });
      // wounds: hard projectiles cut; a hit high up is a headshot
      if (!blocked && (t.def === "pebble" || impulse > 5)) {
        const part = pickPart(sim, t.z);
        const sev = (t.def === "pebble" ? (part === "head" ? 2 : sim.rng.chance(0.4) ? 2 : 1) : impulse > 7 ? 2 : 1) as 1 | 2 | 3;
        wound(sim, c, part, sev, part === "head" ? "gash" : sev >= 2 ? "cut" : "bruise", thrower?.id ?? -1, t.x, t.y);
      }
      if (t.def === "probe" && !blocked) { c.stunUntil = sim.tick + 60 * (shooterWeapon?.stun ?? 3); c.vx = c.vy = 0; fx.emit("fx", { kind: "spark", x: c.x, y: c.y, z: 1.2, n: 10, color: "#f6b62c" }); }
      if (!blocked && sim.fakeBlood && (t.def === "pebble" || ammo.uses.includes("throw") && impulse > 4.5) && sim.rng.chance(shooterWeapon?.blood ?? 0.25)) fx.emit("fx", { kind: "blood", x: c.x, y: c.y, z: 1.2, n: 7, color: "#b3121b" });
      fx.emit("sound", { kind: "hit_" + TOYS[t.def].material, x: t.x, y: t.y, vol: Math.min(1, impulse / 6) });
      if (thrower && thrower !== c) {
        sim.onImpact(thrower, c, t.def, res, false);
        // the toy was aimed at someone else: a bystander got caught in it
        const intended = sim.throwIntent.get(t.id);
        if (intended !== undefined && intended !== c.id) {
          const e = sim.emit({ type: "startled", x: c.x, y: c.y, actors: [c.id, thrower.id], toy: t.def, summary: `${thrower.name}'s ${TOYS[t.def].name} missed ${name(intended)} and hit ${c.name}` });
          c.emo.fear = Math.min(1, c.emo.fear + 0.2 * (1 - c.pers.boldness));
          if (e && c.pers.temper > 0.45 && c.tier !== "player") sim.emitArgument(c, thrower, e);
        }
        sim.throwIntent.delete(t.id);
      }
    },
    onToyHitToy(a: Toy, b: Toy, impulse: number) {
      fx.emit("sound", { kind: "clack_" + TOYS[a.def].material, x: a.x, y: a.y, vol: Math.min(0.8, impulse) });
      fx.emit("fx", { kind: "spark", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: a.z, n: 4, color: "#eee4d3" });
    },
    onToyBounce(t: Toy, speed: number, wall: boolean) {
      if (isBullet(t.def)) { bulletBounce(sim, t); return; }
      fx.emit("sound", { kind: wall ? "thud" : "bounce_" + TOYS[t.def].material, x: t.x, y: t.y, vol: Math.min(0.7, speed / 10) });
      if (!wall && speed > 3) fx.emit("fx", { kind: "dust", x: t.x, y: t.y, z: 0, n: 3 });
      // a loud bang next to someone startles them (and can start trouble with whoever threw it)
      if (speed < 4) return;
      const n = sim.charHash.query(t.x, t.y, 1.6, tmp);
      for (let i = 0; i < n; i++) {
        const c = sim.chars[tmp[i]];
        if (c.id === t.thrower || c.tier === "player" || c.phys !== Phys.OK) continue;
        if (c.tier === "background" && !c.promoted) { c.emo.fear = Math.min(1, c.emo.fear + 0.2); continue; }
        c.emo.fear = Math.min(1, c.emo.fear + 0.25 * (1 - c.pers.boldness));
        sim.say(c, sim.dialogue.bark(c, "startled"), "shout", 1.2);
        const e = sim.emit({ type: "near_miss", x: c.x, y: c.y, actors: [c.id, t.thrower], toy: t.def, summary: `${c.name} nearly got hit by ${name(t.thrower)}'s ${TOYS[t.def].name}` });
        if (e && t.thrower >= 0 && sim.chars[t.thrower] && hostility(peek(c, t.thrower)) + c.pers.temper * 0.5 > 0.55) sim.emitArgument(c, sim.chars[t.thrower], e);
        break;
      }
    },
    onToyBreak(t: Toy, by: number) {
      if(t.def==='cannonball'){
        fx.emit('fx',{kind:'impact',x:t.x,y:t.y,z:.4,n:24,color:'#e6b15d'});fx.emit('fx',{kind:'dust',x:t.x,y:t.y,z:.1,n:20});
        const n=sim.charHash.query(t.x,t.y,2.8,tmp),att=sim.chars[by];
        for(const id of tmp.slice(0,n)){const v=sim.chars[id],dist=Math.hypot(v.x-t.x,v.y-t.y);if(dist>2.8)continue;const norm=Math.max(.1,dist),res=applyImpact(v,8*(1-dist/3),(v.x-t.x)/norm,(v.y-t.y)/norm,false,sim.cfg.maxImpulse,2);if(att)sim.onImpact(att,v,'cannonball',res,false);if(dist<1.8)wound(sim,v,'leg',2,'graze',by,t.x,t.y);}
        for(const v of sim.vehicles){const d=Math.hypot(v.x-t.x,v.y-t.y);if(d<3)v.damage=Math.min(1,v.damage+.3*(1-d/3));}return;
      }
      fx.emit("fx", { kind: "break", x: t.x, y: t.y, z: t.z + 0.2, color: t.color, n: 14 });
      fx.emit("sound", { kind: "break_" + TOYS[t.def].material, x: t.x, y: t.y, vol: 0.8 });
      if (t.def === "dart") return;
      const holder = t.holder >= 0 ? sim.chars[t.holder] : null;
      if (holder) drop(holder, t);
      t.holder = -1; t.state = "broken";
      const e = sim.emit({ type: "toy_broken", x: t.x, y: t.y, actors: by >= 0 ? [by, t.owner] : [t.owner], toy: t.def, data: { toyId: t.id }, summary: `${by >= 0 ? name(by) + " broke" : "Broken:"} ${t.owner >= 0 ? name(t.owner) + "'s " : "a "}${TOYS[t.def].name}` });
      const owner = sim.chars[t.owner];
      if (owner && owner.tier !== "player") {
        sim.say(owner, sim.dialogue.bark(owner, "broken", null, { toy: TOYS[t.def].name }), "shout", 1.6);
        owner.emo.frustration = Math.min(1, owner.emo.frustration + 0.3);
        owner.prefs[t.def] = (owner.prefs[t.def] ?? 0) - 0.1;
        if (by >= 0 && by !== owner.id && sim.chars[by]) {
          applyInteraction(owner, sim.chars[by], "steal", true, sim.tick);
          if (e && owner.pers.temper > 0.4) sim.emitArgument(owner, sim.chars[by], e);
        }
      }
    },
    onSpring(_t: Toy | null, c: Character | null, x: number, y: number) {
      fx.emit("fx", { kind: "spring", x, y, z: 0.1, n: 6 });
      fx.emit("sound", { kind: "boing", x, y, vol: 0.5 });
      if (c && c.tier !== "background") {
        if (sim.rng.chance(0.4)) sim.say(c, sim.dialogue.bark(c, "spring"), "shout", 1);
        c.needs.fun = Math.min(1, c.needs.fun + 0.15);
        sim.emit({ type: "spring", x, y, actors: [c.id], summary: `${c.name} went boing` });
      }
    },
  };

  /** Shared consequences of any landed hit (thrown or melee). */
  sim.onImpact = (att, v, def, res, melee) => {
    const tick = sim.tick, area = areaId(v.x, v.y);
    att.stats.hits++; v.stats.hitsTaken++;
    v.lastHitBy = att.id; v.lastHitTick = tick;
    sim.lod.markHot(att.id, tick); sim.lod.markHot(v.id, tick);
    if (res.blocked) {
      applyInteraction(att, v, "block", true, tick);
      fx.emit("fx", { kind: "spark", x: v.x, y: v.y, z: 1, n: 6, color: "#9a8d80" });
      sim.emit({ type: "blocked", x: v.x, y: v.y, actors: [v.id, att.id], toy: def, summary: `${v.name} blocked ${att.name}` });
      return;
    }
    // sparring between friends is fun; a hit from a rival is personal
    const spar = friendship(peek(v, att.id)) > 0.3 && hostility(peek(v, att.id)) < 0.2 && v.pers.playfulness > 0.5;
    applyInteraction(v, att, "hit", true, tick, spar ? 0.3 : 1);
    applyInteraction(att, v, "hit", false, tick, spar ? 0.3 : 1);
    if (spar) { v.needs.fun = Math.min(1, v.needs.fun + 0.1); att.needs.fun = Math.min(1, att.needs.fun + 0.1); }
    else { v.emo.frustration = Math.min(1, v.emo.frustration + 0.15 + v.pers.temper * 0.15); v.emo.fear = Math.min(1, v.emo.fear + 0.15 * (1 - v.pers.boldness)); }
    if(!v.bubble||tick>v.bubble.until||v.stats.hitsTaken%3===1)sim.say(v,res.down?"Oof! Somebody help!":v.pers.boldness>.6?"Oi! Back off!":"Stop! Leave me alone!","shout",2);
    fx.emit("fx",{kind:res.down?"star":"impact",x:v.x,y:v.y,z:1.4,n:res.down?9:5,color:'#e1c894'});
    att.emo.confidence = Math.min(1, att.emo.confidence + 0.03);
    att.prefs[def] = Math.min(1, (att.prefs[def] ?? 0) + 0.05); // learning: this toy works for me
    remember(v, { t: tick, kind: "hit_by", subj: att.id, obj: v.id, toy: def, area, val: spar ? -0.1 : -0.5, ev: -1, src: "did" });
    remember(att, { t: tick, kind: "hit", subj: att.id, obj: v.id, toy: def, area, val: spar ? 0.2 : 0.1, ev: -1, src: "did" });
    const e = sim.emit({ type: melee ? "melee_hit" : "toy_hit", x: v.x, y: v.y, actors: [att.id, v.id], toy: def, summary: `${att.name} hit ${v.name} with a ${TOYS[def].name}` });
    // melee wounds by weapon: knives stab, bats and pans gash (often the head), foam only bruises
    const ws = TOYS[def].weapon;
    if (melee && ws && ws.blood > 0 && sim.rng.chance(ws.blood)) {
      const part = pickPart(sim, null);
      const sev = (def === "knife" ? 3 : ws.damage >= 1.8 ? (part === "head" ? 2 : sim.rng.chance(0.5) ? 2 : 1) : 1) as 1 | 2 | 3;
      const fracture=ws.damage>=2.4&&(part==='arm'||part==='leg');
      wound(sim, v, part, fracture?3:sev, fracture?"fracture":def === "knife" ? "stab" : part === "head" ? "gash" : sev >= 2 ? "cut" : "bruise", att.id, att.x, att.y,def);
      if (def === "knife" || sev >= 2) commitCrime(sim, att, "assault", v);
    } else if (melee && ws && ws.damage >= 1.5 && !spar && v.tier !== "player" && att.tier === "player") commitCrime(sim, att, "assault", v);
    if (res.down) {
      if(!v.wounds.some(w=>w.part==='leg'))wound(sim,v,'leg',1,'graze',att.id,att.x,att.y);
      fx.emit("fx", { kind: "star", x: v.x, y: v.y, z: 1.6, n: 5 });
      if (v.hand >= 0) { const toy = sim.toys[v.hand]; drop(v, toy); toy.vx = -Math.cos(v.facing) * 2; toy.vy = -Math.sin(v.facing) * 2; toy.vz = 3; if (toy.owner === v.id) { toy.lostBy = v.id; remember(v, { t: tick, kind: "lost_item", subj: v.id, obj: -1, toy: toy.def, area, val: -0.4, ev: -1, src: "did" }); } }
      sim.say(v, sim.dialogue.bark(v, "down"), "shout", 1.6);
      sim.emit({ type: "knockdown", x: v.x, y: v.y, actors: [v.id, att.id], toy: def, cause: e, summary: `${v.name} got knocked down by ${att.name}` });
      if (v.talkWith >= 0) sim.endConversation(v);
    } else if (v.tier !== "player") {
      sim.say(v, sim.dialogue.bark(v, "hit", att), "shout", 1.2);
      // immediate reaction: retaliate, flee or shrug it off, by personality
      const r = peek(v, att.id);
      const retaliate = spar ? v.pers.playfulness * 0.6 : v.pers.temper * 0.6 + v.pers.boldness * 0.4 + hostility(r) * 0.4 - v.pers.kindness * 0.2;
      if (retaliate > 0.55 && !v.wounds.some(w=>w.severity===3) && !(TOYS[def]?.weapon?.gun && !TOYS[sim.toys[v.hand]?.def]?.weapon?.gun)) sim.afterConversation(() => forceGoal(v, sim, "fight", { u: 1, target: att.id }));
      else if (!spar) {v.emo.fear = Math.min(1, v.emo.fear + 0.4);sim.afterConversation(()=>{v.goal={id:"flee",target:att.id,plan:[{kind:"flee",x:att.x,y:att.y,time:4}],stepIdx:0,stepTimer:0,started:sim.tick,replans:0};v.path=null;v.nextThink=sim.tick;});}
    }
  };

  // ---------------------------------------------------------------- perception of events
  const MEMORY_FOR: Record<string, MemoryKind> = {
    toy_hit: "saw_fight", melee_hit: "saw_fight", knockdown: "saw_fight", toy_fight: "saw_fight", argument: "argued", help: "helped",
    reconcile: "made_up", gift: "gift_to", toy_broken: "saw_break", party: "party", prank: "event", player: "player_action",
  };
  const FEARFUL = new Set(["knockdown", "toy_fight", "panic", "blackout", "argument", "gunshot", "turf_war"]);

  sim.events.onAny((e: WorldEvent) => {
    fx.emit("event", e);
    const def = sim.events.defs.get(e.type)!;
    if (e.severity >= 2 && def.propagation !== "global" && e.type !== "weather") {
      sim.hotspots.push({ x: e.x, y: e.y, severity: e.severity, tick: sim.tick, ev: e.id, watchers: 0 });
    }
    if (def.propagation === "global") { globalReaction(e); return; }
    const n = sim.charHash.query(e.x, e.y, e.radius, tmp);
    let watchers = 0;
    for (let i = 0; i < n; i++) {
      const c = sim.chars[tmp[i]];
      if (c.tier === "player") continue;
      const involved = e.actors.includes(c.id);
      if (c.tier === "background" && !c.promoted) {
        if (FEARFUL.has(e.type) && e.severity >= 3) c.emo.fear = Math.min(1, c.emo.fear + 0.3);
        continue;
      }
      // perception: sight needs line of sight (principals also need to be roughly facing it, or be close)
      if (!involved && def.propagation === "sight") {
        if (!sim.world.lineOfSight(c.x, c.y, e.x, e.y)) continue;
        if (c.tier === "principal") {
          const d = Math.hypot(e.x - c.x, e.y - c.y);
          const ang = Math.abs(((Math.atan2(e.y - c.y, e.x - c.x) - c.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (d > 3 && ang > 1.9) continue;
        }
      }
      if (!involved) {
        const kind = MEMORY_FOR[e.type];
        if (kind) remember(c, { t: sim.tick, kind, subj: e.actors[0] ?? -1, obj: e.actors[1] ?? -1, toy: e.toy, area: areaId(e.x, e.y), val: e.type === "help" || e.type === "reconcile" || e.type === "gift" || e.type === "party" ? 0.3 : -0.25 * e.severity / 2, ev: e.id, src: def.propagation === "sound" ? "heard" : "saw" });
        if (FEARFUL.has(e.type) && !c.fears.includes("nothing")) {
          const scared = (c.fears.includes("fight") ? 0.25 : 0) + (1 - c.pers.boldness) * 0.15 * e.severity / 3;
          c.emo.fear = Math.min(1, c.emo.fear + scared);
        }
        // reputations: witnesses judge the aggressor and the helper
        if ((e.type === "toy_hit" || e.type === "melee_hit" || e.type === "knockdown") && e.actors.length > 1) {
          const agg = e.type === "knockdown" ? e.actors[1] : e.actors[0], vic = e.type === "knockdown" ? e.actors[0] : e.actors[1];
          const fv = friendship(peek(c, vic));
          if (fv > 0.3 && agg !== c.id && sim.chars[agg]) {
            const r = sim.relate(c, agg); r.grudge = Math.min(1, r.grudge + 0.08 * fv); r.rivalry = Math.min(1, r.rivalry + 0.05);
            // coalition: friends of the victim may jump in on their side
            if (e.type === "knockdown" && c.pers.boldness > 0.6 && fv > 0.45 && sim.rng.chance(0.5)) {
              sim.afterConversation(() => { if (forceGoal(c, sim, "fight", { u: 1, target: agg })) sim.emit({ type: "alliance", x: c.x, y: c.y, actors: [c.id, vic, agg], cause: e, summary: `${c.name} jumped in for ${name(vic)} against ${name(agg)}` }); });
            }
          }
          if (sim.chars[agg]) sim.chars[agg].reputation = Math.max(-1, sim.chars[agg].reputation - 0.002);
        }
        if (e.type === "help" && sim.chars[e.actors[0]]) sim.chars[e.actors[0]].reputation = Math.min(1, sim.chars[e.actors[0]].reputation + 0.003);
        if (e.type === "player") { const r = sim.relate(c, sim.playerId); r.fam = Math.min(1, r.fam + 0.02); }
        if (e.severity >= 2) watchers++;
      }
      if (e.type === "party" && c.phys === Phys.OK && c.talkWith < 0 && sim.rng.chance(0.3)) sim.say(c, sim.dialogue.bark(c, "party"), "shout", 1.5);
    }
    // emergent crowd: a big enough audience turns an incident into a gathering
    if (watchers >= 5 && (e.type === "toy_fight" || e.type === "knockdown" || e.type === "argument" || e.type === "party" || e.type === "competition")) {
      sim.emit({ type: "gathering", x: e.x, y: e.y, cause: e, data: { watchers }, summary: `A crowd gathered (${watchers} watching)` });
    }
  });

  function globalReaction(e: WorldEvent): void {
    for (const c of sim.chars) {
      if (c.tier === "player") continue;
      if (e.type === "blackout") {
        const afraid = c.fears.includes("blackout") ? 0.6 : (1 - c.pers.boldness) * 0.25;
        c.emo.fear = Math.min(1, c.emo.fear + afraid);
        if (c.tier === "principal") remember(c, { t: sim.tick, kind: "event", subj: -1, obj: -1, toy: null, area: areaId(c.x, c.y), val: -0.3, ev: e.id, src: "saw" });
      } else if (e.type === "weather" && (e.data.to === "storm")) {
        if (c.fears.includes("storm")) c.emo.fear = Math.min(1, c.emo.fear + 0.4);
      } else if (e.type === "rare_meteor") {
        c.needs.curiosity = 1; c.emo.mood = Math.min(1, c.emo.mood + 0.2);
      }
    }
    // a few principals say something about it
    const topic = e.type === "blackout" ? "blackout" : e.type === "power_back" ? "power_back" : e.type === "rare_meteor" ? "wonder" : e.type === "weather" && (e.data.to === "rain" || e.data.to === "storm") ? "rain" : "";
    if (topic) for (const c of sim.chars) if (c.tier === "principal" && c.lod === 0 && sim.rng.chance(0.5)) sim.say(c, sim.dialogue.bark(c, topic), "shout", 1.8);
    if (e.type === "blackout") {
      // the scared ones may panic: a chain of its own
      for (const c of sim.chars) if (c.tier === "principal" && c.emo.fear > 0.7) { sim.emit({ type: "panic", x: c.x, y: c.y, actors: [c.id], cause: e, summary: `${c.name} panicked in the dark` }); break; }
    }
  }

  // ---------------------------------------------------------------- specific event follow-ups
  sim.events.on("argument", (e) => {
    const [a, b] = e.actors.map((id) => sim.chars[id]);
    if (!a || !b) return;
    for (const [s, o] of [[a, b], [b, a]] as const) {
      applyInteraction(s, o, "argue", true, sim.tick);
      remember(s, { t: sim.tick, kind: "argued", subj: s.id, obj: o.id, toy: null, area: areaId(s.x, s.y), val: -0.35, ev: e.id, src: "did" });
      s.emo.frustration = Math.min(1, s.emo.frustration + 0.15);
    }
    // if both are free, the argument becomes a conversation (that may escalate to a toy fight)
    if (a.talkWith < 0 && b.talkWith < 0 && a.phys === Phys.OK && b.phys === Phys.OK && a.tier !== "player" && b.tier !== "player") {
      if (sim.dialogue.start(a, b, "argue")) { a.goal = null; b.goal = null; }
    }
    sim.lod.markHot(a.id, sim.tick, 600); sim.lod.markHot(b.id, sim.tick, 600);
  });

  sim.events.on("help", (e) => {
    const [h, v] = e.actors.map((id) => sim.chars[id]);
    if (!h || !v) return;
    remember(v, { t: sim.tick, kind: "helped_by", subj: h.id, obj: v.id, toy: null, area: areaId(v.x, v.y), val: 0.6, ev: e.id, src: "did" });
    remember(h, { t: sim.tick, kind: "helped", subj: h.id, obj: v.id, toy: null, area: areaId(h.x, h.y), val: 0.3, ev: e.id, src: "did" });
    const r = peek(v, h.id);
    if (r && r.aff > 0.45 && r.trust > 0.35) sim.emit({ type: "friendship", x: v.x, y: v.y, actors: [v.id, h.id], cause: e, summary: `${v.name} and ${h.name} are proper friends now` });
  });

  sim.events.on("reconcile", (e) => {
    for (const id of e.actors) { const c = sim.chars[id]; if (c) { c.emo.frustration = Math.max(0, c.emo.frustration - 0.3); c.emo.mood = Math.min(1, c.emo.mood + 0.2); } }
    fx.emit("fx", { kind: "heart", x: e.x, y: e.y, z: 1.8, n: 4 });
  });

  sim.events.on("party", () => { fx.emit("fx", { kind: "confetti", x: sim.stagePoint.x, y: sim.stagePoint.y, z: 1.5, n: 40 }); });

  sim.events.on("panic", (e) => {
    // fear is contagious for nearby timid characters (bounded by event cooldown and causal depth)
    const n = sim.charHash.query(e.x, e.y, 6, tmp);
    for (let i = 0; i < n; i++) { const c = sim.chars[tmp[i]]; if (c.tier !== "player" && !e.actors.includes(c.id)) c.emo.fear = Math.min(1, c.emo.fear + 0.2 * (1 - c.pers.boldness)); }
  });

  sim.events.on("toy_dispute", (e) => {
    const [a, b] = e.actors.map((id) => sim.chars[id]);
    if (a && b && a.pers.temper + a.pers.boldness > 1.1) sim.afterConversation(() => forceGoal(a, sim, "fight", { u: 1, target: b.id }));
  });

  // ball games emerge when enough people kick the same ball around the court
  const gameCheck = () => {
    for (const t of sim.toys) {
      if (t.def !== "ball" || t.state === "held" || t.state === "broken" || sim.games.some((g) => g.toy === t.id)) continue;
      const n = sim.charHash.query(t.x, t.y, 5, tmp);
      let players = 0;
      for (let i = 0; i < n; i++) { const c = sim.chars[tmp[i]]; if (c.goal && (c.goal.id === "play" || c.goal.id === "ballgame")) players++; }
      if (players >= 2) {
        const area = areaId(t.x, t.y);
        const e = sim.emit({ type: "game", x: t.x, y: t.y, data: { area }, summary: `Ball game at ${sim.world.areas[area]?.name ?? "the block"}` });
        if (e) sim.games.push({ toy: t.id, x: t.x, y: t.y, until: sim.tick + 60 * 60, area });
      }
    }
  };

  // periodic emergent checks (cheap scans, run rarely)
  const origStep = sim.step.bind(sim);
  sim.step = () => {
    origStep();
    const tick = sim.tick;
    if (tick % 240 === 0) gameCheck();
    if (tick % 300 === 0) friendshipCheck();
    if (tick % 3000 === 0) arrivals();
    if (tick % 600 === 0 && sim.isDark && sim.env.weather === "clear" && sim.rng.chance(0.04)) sim.emit({ type: "rare_meteor", x: sim.world.size / 2, y: sim.world.size / 2, summary: "A shooting star crossed the sky" });
    if (tick % 1200 === 0) competitionCheck();
    updateTurf(sim);
    updateStreetLife(sim);
    updateRep(sim);
  };
  ensureGangs(sim);
  ensureStreetCrews(sim);

  const knownFriends = new Set<string>();
  let primed = false; // first pass (new world or loaded save) records existing friendships silently
  function friendshipCheck(): void {
    for (const c of sim.chars) {
      if (c.tier !== "principal" && c.tier !== "mid") continue;
      for (const [id, r] of c.rel) {
        if (id < c.id || r.aff < 0.45 || r.trust < 0.3) continue;
        const k = c.id + ":" + id;
        if (knownFriends.has(k)) continue;
        const o = sim.chars[id], back = o?.rel.get(c.id);
        // friendships that already existed when the world began are not news
        if (back && back.aff > 0.4) { knownFriends.add(k); if (primed && (r.shared > 0 || r.fam > 0.5)) sim.emit({ type: "friendship", x: c.x, y: c.y, actors: [c.id, id], summary: `${c.name} and ${o.name} became friends` }); }
      }
    }
    primed = true;
  }

  function arrivals(): void {
    // a mid-ground regular who is far from the camera heads off; another wanders in from the street
    const far = sim.chars.filter((c) => c.tier === "mid" && c.lod >= 3 && !c.goal && c.talkWith < 0);
    if (!far.length) return;
    const c = sim.rng.pick(far);
    sim.emit({ type: "departure", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} left ${sim.world.areaAt(c.x, c.y)?.name ?? "the block"}` });
    const p = sim.streetPoint(c);
    c.x = c.px = p.x; c.y = c.py = p.y; c.path = null;
    const areas = sim.world.areas.filter((a) => a.kind !== "street");
    c.homeArea = sim.rng.pick(areas).id;
    sim.emit({ type: "arrival", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} turned up from the street` });
  }

  function competitionCheck(): void {
    const court = sim.world.areas.find((a) => a.kind === "court");
    if (!court) return;
    const inCourt = sim.chars.filter((c) => (c.tier === "principal" || c.tier === "mid") && sim.world.areaAt(c.x, c.y)?.id === court.id && c.phys === Phys.OK);
    const comp = inCourt.filter((c) => c.pers.boldness + c.pers.playfulness > 1.3 && c.needs.fun < 0.6);
    if (comp.length >= 2) {
      const [a, b] = comp;
      const e = sim.emit({ type: "competition", x: court.cx, y: court.cy, actors: [a.id, b.id], summary: `${a.name} and ${b.name} started a throwing contest` });
      if (e) for (const c of [a, b]) { c.goalCooldowns.play = 0; c.needs.fun = Math.min(c.needs.fun, 0.3); c.goal = null; }
    }
  }

}
