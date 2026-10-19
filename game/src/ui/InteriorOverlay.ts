import {setDamageBlood} from "../render/DamageArt";
import { useBandage } from "../sim/Life";
import { h, fmtHour } from "./dom";
import "./interior.css";
import type { Simulation } from "../sim/Simulation";
import type { Building } from "../world/World";
import { BUILDINGS, isOpen } from "../content/buildings";
import type { InteriorDef, Interactable, Launch } from "../content/interiors";
import { interiorForBuilding, FEEDS } from "../content/interiorVariety";
import { applyEffect } from "../content/interiorEffects";
import { moveInside, zoneAt, findPath } from "../content/interiorNav";
import { InteriorView, type ViewActor, type ViewState } from "../render/InteriorView";
import { InteriorCrowd } from "./InteriorCrowd";
import { fmtCash } from "../sim/Society";

/**
 * Walk-in interior scene. Opens for every building kind from Places.enter; specialised overlays
 * (shop menus, police desk, dealership, gallery, Putahi) are launched from interactables inside it.
 * Movement: WASD / arrows / the on-screen stick. E / Enter / Space uses; Esc or the Leave button exits.
 * The sim keeps running underneath; the player's sim body stays at the door, nothing in the sim is moved.
 */
export interface InteriorHost {
  sim(): Simulation;
  toast(text: string, kind?: string): void;
  /** Open one of the existing panels for this building. */
  launch(what: Launch, b: Building): void;
  modalOpen(): boolean;
  keys(): { up: string; down: string; left: string; right: string; use: string };
  onChange?(open: boolean): void;
}

const WALK = 3.0, RUN = 4.6;

export class InteriorOverlay {
  el: HTMLElement;
  private path: {x:number;y:number}[]=[];
  private destination: Interactable|null=null;
  private actionsEl:HTMLElement;
  private actionUntil=0;
  private actionPose="idle";
  private cv: HTMLCanvasElement;
  private view: InteriorView;
  private titleEl: HTMLElement; private zoneEl: HTMLElement; private clockEl: HTMLElement; private cashEl: HTMLElement;
  private needsEl: HTMLElement; private bars: Record<string, HTMLElement> = {}; private wantEl: HTMLElement; private hudAt = -9;
  private promptBtn: HTMLButtonElement; private capEl: HTMLElement;
  private stickEl: HTMLElement; private knobEl: HTMLElement;
  private def: InteriorDef | null = null;
  private b: Building | null = null;
  private crowd: InteriorCrowd | null = null;
  private raf = 0; private last = 0; private t0 = 0; private t = 0; private closeCheck = 0; private shoutAt = 8;
  private held = new Set<string>();
  private stick = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
  private me: ViewActor = { id: "you", look: null as never, x: 0, y: 0, dir: 1, pose: "idle", phase: 0, poseT: 0, speed: 0, seed: 0, style: "normal", isPlayer: true };
  private near: Interactable | null = null; private exitNear = false; private nearActor: string | number | null = null;
  private capUntil = 0; private cool = new Map<string, number>();
  private ro: ResizeObserver | null = null;
  private onKey = (e: KeyboardEvent) => this.key(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.key(e, false);
  private onBlur = () => { this.held.clear(); };

  constructor(private host: InteriorHost) {
    this.cv = h("canvas.iv-cv", { role: "img", "aria-label": "Inside the building" }) as HTMLCanvasElement;
    this.view = new InteriorView(this.cv);
    this.titleEl = h("b.iv-title"); this.zoneEl = h("span.iv-zone-name"); this.clockEl = h("span.iv-clock"); this.cashEl = h("span.iv-cash");
    this.promptBtn = h("button.iv-prompt.hidden", { type: "button" }) as HTMLButtonElement;
    this.promptBtn.addEventListener("click", () => this.use());
    this.capEl = h("div.iv-cap.hidden", { "aria-live": "polite" });
    // Sims-style needs panel: what you need, and the nearest thing in this room that fixes it
    this.wantEl = h("div.iv-want");
    this.needsEl = h("div.iv-needs", { "aria-label": "Your needs" }, [
      ...(["hunger", "energy", "social", "fun"] as const).map((k) => { const fill = h("i"); this.bars[k] = fill; return h("div.iv-need", { title: k }, [h("span", { text: k }), h("b", null, [fill])]); }),
      this.wantEl,
    ]);
    this.actionsEl=h("div.iv-action-list",{"aria-label":"Things to do inside"});
    this.cv.addEventListener("click",e=>this.clickRoom(e.clientX,e.clientY));
    this.knobEl = h("i.iv-knob");
    this.stickEl = h("div.iv-stick.hidden", null, [this.knobEl]);
    const zone = h("div.iv-touch", { "aria-hidden": "true" });
    this.bindStick(zone);
    const leave = h("button.iv-leave", { type: "button", text: "Leave", "aria-label": "Leave the building", onclick: () => this.close() });
    this.el = h("div.iv.hidden", { role: "dialog", "aria-label": "Interior" }, [
      this.cv,
      h("div.iv-top", null, [h("div.iv-head", null, [this.titleEl, this.zoneEl]), h("div.iv-meta", null, [this.clockEl, this.cashEl]), leave]),
      this.needsEl, this.capEl, this.actionsEl, this.promptBtn,
    ]);
    // never let gestures reach the world canvas beneath, and never let the page zoom
    for (const ev of ["wheel", "contextmenu", "dblclick", "gesturestart"]) this.el.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }

  /** the kind of building you are in, or null outside (the score reads this) */
  get kind(): string | null { return this.open && this.b ? this.b.kind : null; }
  /** The interior's canvas, for photo mode. */
  get canvas(): HTMLCanvasElement { return this.cv; }
  get open(): boolean { return !this.el.classList.contains("hidden"); }
  /** the building you are standing in, while its interior is open (audio muffles the street and plays the room) */
  get building(): Building | null { return this.open ? this.b : null; }
  /** walking and running right now, for footstep sounds */
  get footing(): { moving: boolean; running: boolean } { return { moving: this.open && this.me.speed > 0.2, running: this.open && this.me.speed > 3.6 }; }

  show(b: Building): void {
    const sim = this.host.sim(), def = interiorForBuilding(b);
    this.b = b; this.def = def;this.path=[];this.destination=null;
    this.actionsEl.replaceChildren(...def.interactables.map(it=>h("button",{text:it.label,onclick:()=>this.walkTo(it)})));
    this.crowd = new InteriorCrowd(def, sim, b);
    const p = sim.player;
    this.me.look = p.look; this.me.style = p.style || "normal"; this.me.char = p;
    this.me.x = def.door.x; this.me.y = def.door.y; this.me.dir = 1; this.me.pose = "idle"; this.me.speed = 0;
    this.titleEl.textContent = b.name; this.zoneEl.textContent = def.title;
    this.view.setDef(def);
    this.t0 = performance.now(); this.t = 0; this.last = this.t0; this.closeCheck = 0; this.shoutAt = 8; this.cool.clear();
    this.held.clear(); this.stick.x = this.stick.y = 0;
    this.el.classList.remove("hidden");
    this.say(def.flavour[b.id % def.flavour.length], 7);
    this.measure();
    this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.measure()) : null; this.ro?.observe(this.el);
    window.addEventListener("keydown", this.onKey, true); window.addEventListener("keyup", this.onKeyUp, true);
    window.addEventListener("blur", this.onBlur); window.addEventListener("resize", this.measure);
    window.visualViewport?.addEventListener("resize", this.measure);
    this.crowd.sync(0);
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.loop);
    this.host.onChange?.(true);
    (this.el.querySelector(".iv-leave") as HTMLElement | null)?.blur();
  }

  close(): void {
    if (!this.open) return;
    this.el.classList.add("hidden");
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.ro?.disconnect(); this.ro = null;
    window.removeEventListener("keydown", this.onKey, true); window.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("blur", this.onBlur); window.removeEventListener("resize", this.measure);
    window.visualViewport?.removeEventListener("resize", this.measure);
    this.held.clear(); this.stick.x = this.stick.y = 0; this.stickEl.classList.add("hidden");
    this.crowd = null; this.b = null;
    this.host.onChange?.(false);
  }

  private measure = (): void => {
    const r = this.el.getBoundingClientRect();
    this.view.resize(r.width || window.innerWidth, r.height || window.innerHeight, window.devicePixelRatio || 1);
  };

  // ------------------------------------------------------------------ input
  private key(e: KeyboardEvent, down: boolean): void {
    if (!this.open) return;
    if (this.host.modalOpen()) return; // panels launched from here own the keyboard while they are up
    const k = e.key.toLowerCase(), m = this.host.keys();
    const move = [m.up, m.down, m.left, m.right, "arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
    if (down) {
      if(k==='b'){e.stopImmediatePropagation();e.preventDefault();if(!e.repeat){const sim=this.host.sim();this.host.toast(useBandage(sim,sim.player,sim.player)?"Bandaged. Bleeding controlled.":"You need a bandage and an untreated wound.");}return;}
      if (k === "escape") { e.stopImmediatePropagation(); e.preventDefault(); this.close(); return; }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if ((k === m.use || k === "enter" || k === " ") && !(tag === "BUTTON" && (k === " " || k === "enter"))) { e.stopImmediatePropagation(); e.preventDefault(); if (!e.repeat) this.use(); return; }
      if (move.includes(k) || k === "shift") { e.stopImmediatePropagation(); if (k.startsWith("arrow")) e.preventDefault(); this.path=[];this.destination=null;this.held.add(k); return; }
      if (k === "tab") return;
      e.stopImmediatePropagation(); // nothing else (throw, rob, horn...) reacts while you are indoors
    } else if (move.includes(k) || k === "shift") this.held.delete(k);
  }

  private bindStick(zone: HTMLElement): void {
    const R = 46;
    const upd = (e: PointerEvent) => {
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy; const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      this.stick.x = Math.abs(dx) < 6 && Math.abs(dy) < 6 ? 0 : dx / R; this.stick.y = Math.abs(dx) < 6 && Math.abs(dy) < 6 ? 0 : dy / R;
      this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    zone.addEventListener("pointerdown", (e) => {
      if (this.stick.id >= 0) return;
      e.preventDefault(); this.stick.id = e.pointerId; this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const r = this.el.getBoundingClientRect();
      this.stickEl.style.left = e.clientX - r.left + "px"; this.stickEl.style.top = e.clientY - r.top + "px";
      this.stickEl.classList.remove("hidden"); this.knobEl.style.transform = "translate(0,0)"; upd(e);
    });
    zone.addEventListener("pointermove", (e) => { if (e.pointerId === this.stick.id) upd(e); });
    const end = (e: PointerEvent) => { if (e.pointerId !== this.stick.id) return; if(e.type==="pointerup"&&Math.hypot(e.clientX-this.stick.ox,e.clientY-this.stick.oy)<8)this.clickRoom(e.clientX,e.clientY); this.stick.id = -1; this.stick.x = this.stick.y = 0; this.stickEl.classList.add("hidden"); };
    zone.addEventListener("pointerup", end); zone.addEventListener("pointercancel", end);
  }

  // ------------------------------------------------------------------ actions
  private walkTo(it:Interactable):void {
    if(!this.def)return;
    const path=findPath(this.def,this.me,it);
    if(!path){this.say("That spot is blocked. Try approaching from the aisle.",3);return;}
    this.path=path;this.destination=it;this.say(`Walking to ${it.label}…`,5);
  }
  private clickRoom(clientX:number,clientY:number):void {
    if(!this.def||this.host.modalOpen())return;
    const rect=this.cv.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
    let closest:Interactable|null=null,distance=65;
    for(const it of this.def.interactables){const [sx,sy]=this.view.screenPoint(it.x,it.y);const d=Math.hypot(sx-x,sy-y);if(d<distance){distance=d;closest=it;}}
    if(closest){this.walkTo(closest);return;}
    const target=this.view.groundPoint(x,y);this.path=findPath(this.def,this.me,target)??[];this.destination=null;
  }
  private use(): void {
    if (!this.def || !this.b) return;
    if (this.near) { this.activate(this.near); return; }
    if (this.nearActor !== null) { this.chat(); return; }
    if (this.exitNear) this.close();
  }

  private activate(it: Interactable): void {
    const b = this.b!, sim = this.host.sim(), p = sim.player;
    this.say(it.lines?.length ? it.lines[Math.floor(Math.random() * it.lines.length)] : it.text, 7);
    const now = this.t, cd = this.cool.get(it.id) ?? 0;
    if (it.effect && now >= cd) {
      const r = applyEffect(it.effect, p, { wage: sim.wagePerHour(p), worksHere: p.workplace === b.id, cost: it.cost });
      if (r.ok) {this.cool.set(it.id, now + r.cooldown);this.actionUntil=this.t+2.5;this.actionPose=["eat","cuppa","vend"].includes(it.effect!)?"eat":["sit","rest","read"].includes(it.effect!)?"sit":it.effect==="dance"||it.effect==="music"?"dance":"phone";}
      this.host.toast(r.toast, r.tone);
      this.hudAt = -9;
    } else if (it.effect && now < cd) this.host.toast("Give it a minute.");
    if (it.launch) this.host.launch(it.launch, b);
  }

  private static CHAT = [
    "'Yeah, good, busy. You?'", "'Have you tried the thing by the window? Life-changing.'", "'Don't tell anyone, but the owner's selling up.'",
    "'Saw you on the street before. You walk like you're late.'", "'I come here every day. Same seat. Don't take it.'", "'Did you hear what happened down by the river?'",
    "'Mean shirt. Where'd you get it?'", "'I'm only here for the wifi, honestly.'",
  ];
  private chat(): void {
    const sim = this.host.sim(), p = sim.player, id = this.nearActor!, key = `chat:${id}`;
    const a = this.crowd?.actors.find((q) => q.id === id);
    if ((this.cool.get(key) ?? 0) > this.t) { this.say(`${a?.name ?? "They"} gives you a polite nod. You've already talked.`, 4); return; }
    this.cool.set(key, this.t + 40);
    const seed = (typeof id === "number" ? id : id.length * 31) + Math.floor(this.t / 40);
    this.say(`${a?.name ?? "Someone"}: ${InteriorOverlay.CHAT[seed % InteriorOverlay.CHAT.length]}`, 6);
    p.needs.social = Math.min(1, p.needs.social + 0.12); p.needs.fun = Math.min(1, p.needs.fun + 0.03);
    // a real local remembers you a little more fondly
    if (typeof id === "number") { const c = sim.chars[id]; const r = c?.rel.get(p.id); if (r) { r.aff = Math.min(1, r.aff + 0.05); r.fam = Math.min(1, r.fam + 0.05); } }
    this.host.toast("Chatted. Social up."); this.hudAt = -9;
  }

  private hud(): void {
    if (this.t - this.hudAt < 0.5 || !this.def) return;
    this.hudAt = this.t;
    const p = this.host.sim().player, v: Record<string, number> = { hunger: p.hunger, energy: p.needs.energy, social: p.needs.social, fun: p.needs.fun };
    for (const k in v) { const el = this.bars[k]; el.style.width = `${Math.round(v[k] * 100)}%`; el.className = v[k] < 0.25 ? "low" : v[k] < 0.5 ? "mid" : ""; }
    const worst = Object.entries(v).sort((a, b) => a[1] - b[1])[0];
    let want = "";
    if (worst[1] < 0.5) {
      const need = worst[0], me = this.me;
      const fix = this.def.interactables.filter((i) => (i.effect && FEEDS[i.effect] === need) || (need === "hunger" && i.launch === "shop")).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      const word = { hunger: "Hungry", energy: "Tired", social: "Lonely", fun: "Bored" }[need];
      want = fix ? `${word}: try ${fix.label}` : need === "social" && this.crowd?.actors.length ? `${word}: talk to someone` : `${word}: nothing for that here`;
    }
    this.wantEl.textContent = p.bleed>0?"Bleeding · B to bandage. Find medical help.":want;
  }

  private say(text: string, secs: number): void {
    this.capEl.textContent = text; this.capEl.classList.remove("hidden"); this.capUntil = this.t + secs;
  }

  // ------------------------------------------------------------------ frame
  private loop = (now: number): void => {
    if (!this.open || !this.def || !this.b || !this.crowd) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)); this.last = now; this.t = (now - this.t0) / 1000;
    const def = this.def, sim = this.host.sim(), me = this.me;
    if(this.path.length&&!this.host.modalOpen()){
      const next=this.path[0],dx=next.x-me.x,dy=next.y-me.y,d=Math.hypot(dx,dy),step=Math.min(d,WALK*dt);
      if(d<.09)this.path.shift();else {const np=moveInside(def,me.x,me.y,dx/d*step,dy/d*step);me.x=np.x;me.y=np.y;me.dir=dx-dy>=0?1:-1;me.phase+=step*5.5;}
      if(!this.path.length&&this.destination){const target=this.destination;this.destination=null;if(Math.hypot(target.x-me.x,target.y-me.y)<1.35)this.activate(target);}
    }
    // input -> world direction
    const m = this.host.keys();
    let ix = 0, iy = 0;
    const H = this.held;
    if (H.has("w") || H.has("arrowup") || H.has(m.up)) iy -= 1;
    if (H.has("s") || H.has("arrowdown") || H.has(m.down)) iy += 1;
    if (H.has("a") || H.has("arrowleft") || H.has(m.left)) ix -= 1;
    if (H.has("d") || H.has("arrowright") || H.has(m.right)) ix += 1;
    let mag = 1;
    if (this.stick.x || this.stick.y) { ix = this.stick.x; iy = this.stick.y; mag = Math.min(1, Math.hypot(ix, iy)); }
    const moving = (ix || iy) && !this.host.modalOpen();
    let spd = 0, pushW = false;
    if (moving) {
      const run = H.has("shift") || mag > 0.94 && (this.stick.x || this.stick.y) ? RUN : WALK; spd = run * (this.stick.x || this.stick.y ? Math.max(0.35, mag) : 1);
      const [wx, wy] = InteriorView.screenToWorld(ix, iy); pushW = wx < -0.3;
      const np = moveInside(def, me.x, me.y, wx * spd * dt, wy * spd * dt);
      const moved = Math.hypot(np.x - me.x, np.y - me.y);
      me.x = np.x; me.y = np.y; spd = moved / dt;
      const sdx = ix; if (Math.abs(sdx) > 0.01) me.dir = sdx >= 0 ? 1 : -1; else me.dir = (wx - wy) >= 0 ? 1 : -1;
    }
    if(this.path.length)spd=WALK;
    me.speed = spd; me.pose = spd > 0.2 ? (spd > 3.6 ? "run" : "walk") : this.t<this.actionUntil?this.actionPose:"idle";
    if (spd > 0.2) { me.phase += spd * dt * 3.8; me.poseT = 0; } else me.poseT += dt;
    // walking into the doorway leaves
    if (me.x < 0.5 && Math.abs(me.y - def.door.y) < 0.85 && pushW) { this.close(); return; }
    // proximity
    let best: Interactable | null = null, bd = 1.35;
    for (const it of def.interactables) { const d = Math.hypot(it.x - me.x, it.y - me.y); if (d < bd) { bd = d; best = it; } }
    this.near = best;
    this.exitNear = !best && me.x < 1.7 && Math.abs(me.y - def.door.y) < 1.4;
    this.crowd.sync(this.t); this.crowd.update(dt, this.t);
    const people = this.crowd.actors;
    let na: string | number | null = null, nd = 1.4;
    for (const a of people) { const d = Math.hypot(a.x - me.x, a.y - me.y); if (d < nd && a.name) { nd = d; na = a.id; } }
    this.nearActor = na;
    // HUD
    const z = zoneAt(def, me.x, me.y);
    if (this.zoneEl.textContent !== z.name) this.zoneEl.textContent = z.name;
    this.clockEl.textContent = fmtHour(sim.hour); this.cashEl.textContent = fmtCash(sim.player.cash);
    const label = best ? `${m.use.toUpperCase()} · ${best.label}` : this.exitNear ? `${m.use.toUpperCase()} · Leave` : "";
    if (label) { if (this.promptBtn.textContent !== label) this.promptBtn.textContent = label; this.promptBtn.classList.remove("hidden"); } else this.promptBtn.classList.add("hidden");
    if (this.capUntil && this.t > this.capUntil) { this.capEl.classList.add("hidden"); this.capUntil = 0; }
    // a kitchen in full service: the head chef's voice carries across the room every so often
    if (def.shouts?.length && !this.capUntil && this.t > this.shoutAt) { this.say(def.shouts[Math.floor(Math.random() * def.shouts.length)], 5); this.shoutAt = this.t + 10 + Math.random() * 8; }
    if (this.t - this.closeCheck > 1) {
      this.closeCheck = this.t;
      if (!isOpen(BUILDINGS[this.b.kind], sim.hour)) { this.host.toast(`${this.b.name} is closing. Out you go.`); this.close(); return; }
    }
    this.hud();
    setDamageBlood(sim.fakeBlood);
    const st: ViewState = { fakeBlood:sim.fakeBlood,t: this.t, hour: sim.hour, player: me, actors: people, near: best?.id ?? null, nearActor: this.nearActor, exitNear: this.exitNear };
    this.view.render(st, def);
    this.raf = requestAnimationFrame(this.loop);
  };
}

