import { Simulation } from "../sim/Simulation";
import { SimulationClock } from "../core/clock";
import { Renderer, Quality } from "../render/Renderer";
import { AudioSystem } from "../audio/Audio";
import { LocalStorageProvider } from "../persistence/storage";
import { SaveSystem, SaveError } from "../persistence/SaveSystem";
import { Settings, loadSettings, saveSettings } from "../persistence/Settings";
import { newDebugFlags } from "../debug/flags";
import { DevPanel } from "../debug/DevPanel";
import { Inspector } from "../ui/Inspector";
import { EventLog } from "../ui/EventLog";
import { DialogueUI } from "../ui/DialogueUI";
import { ModalHost, settingsBody, keysList } from "../ui/Modals";
import { h, fmtHour } from "../ui/dom";
import { moveTo, stop } from "../ai/steps";
import { canPickUp } from "../inventory/Inventory";
import { TOYS, canThrow, isMelee } from "../content/toys";
import { setImpactIntensity } from "../physics/combat";
import { Phys } from "../entities/types";

/** Wires simulation, renderer, input, audio, UI and persistence together and runs the loop. */
export class Game {
  sim: Simulation;
  clock = new SimulationClock({ step: 1 / 60, maxStepsPerFrame: 8 });
  renderer: Renderer;
  audio: AudioSystem;
  store = new LocalStorageProvider();
  saves = new SaveSystem(this.store);
  settings: Settings;
  debug = newDebugFlags();
  ui: HTMLElement;
  inspector: Inspector; log: EventLog; dialogue: DialogueUI; modal = new ModalHost(); dev: DevPanel;
  private selected = -1; private hovered = -1;
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, dragging: false, sx: 0, sy: 0, button: 0 };
  private moveTarget: { x: number; y: number } | null = null;
  private pendingTalk = -1;
  private quality: Quality = 2;
  private fpsAvg = 60; private slowFor = 0; private fastFor = 0;
  private ticksThisSecond = 0; private tickRate = 0; private tickWindow = 0;
  private toastEl: HTMLElement; private hintEl: HTMLElement; private clockEl: HTMLElement; private speedEls: HTMLButtonElement[] = [];
  private soundBtn!: HTMLButtonElement;
  private last = performance.now();
  private raf = 0;
  private reduceMotionOS = false;
  private touches = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  constructor(private canvas: HTMLCanvasElement, root: HTMLElement) {
    this.settings = loadSettings(this.store);
    this.sim = new Simulation({ backgroundCount: this.settings.density });
    this.renderer = new Renderer(canvas, this.sim);
    this.audio = new AudioSystem(() => this.renderer.cam);
    this.audio.attach(this.sim);
    this.ui = root;
    const S = () => this.sim;
    this.inspector = new Inspector(S, { talk: (id) => this.talkTo(id), follow: (id) => { this.renderer.cam.follow = id; }, select: (id) => this.select(id) });
    this.log = new EventLog(S, (x, y) => { this.renderer.cam.follow = -1; this.renderer.cam.lookAt(x, y); });
    this.dialogue = new DialogueUI(S);
    this.dev = new DevPanel(S, this.renderer, this.debug, {
      quality: () => (this.settings.quality === "auto" ? "auto→" : "") + ["low", "medium", "high"][this.quality], speed: () => (this.clock.paused ? 0 : this.clock.speed),
      fps: () => this.fpsAvg, tickRate: () => this.tickRate, reset: (seed) => this.reset(seed), toast: (t) => this.toast(t),
      teleport: () => { const p = this.renderer.cam.toWorld(this.mouse.x, this.mouse.y); const w = this.sim.world.nearestWalkable(p.x, p.y); this.sim.player.x = w.x; this.sim.player.y = w.y; },
    });
    this.toastEl = h("div.toasts", { "aria-live": "polite" });
    this.hintEl = h("div.hint");
    this.clockEl = h("span.clock");
    root.append(this.buildBar(), this.inspector.el, this.log.el, this.dialogue.el, this.dev.el, this.hintEl, this.toastEl, this.buildTouch(), this.modal.el);
    this.applySettings();
    this.bindInput();
    this.bindSim();
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reduceMotionOS = !!mq?.matches;
    mq?.addEventListener?.("change", (e) => { this.reduceMotionOS = e.matches; });
    window.addEventListener("resize", () => this.renderer.resize(this.quality));
    canvas.addEventListener("contextlost", (e) => { e.preventDefault(); cancelAnimationFrame(this.raf); });
    canvas.addEventListener("contextrestored", () => { this.renderer.terrain.invalidateAll(); this.loop(); });
    document.addEventListener("visibilitychange", () => { this.last = performance.now(); });
    if (!this.settings.tutorialDone) this.tutorial(0);
  }

  get reduceMotion(): boolean { return this.settings.reducedMotion ?? this.reduceMotionOS; }

  start(): void { this.renderer.resize(this.quality); this.loop(); }

  // ------------------------------------------------------------------ main loop
  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const steps = this.clock.advance(dt);
    for (let i = 0; i < steps; i++) { this.controlPlayer(); this.sim.step(); }
    this.ticksThisSecond += steps; this.tickWindow += dt;
    if (this.tickWindow >= 1) { this.tickRate = this.ticksThisSecond / this.tickWindow; this.ticksThisSecond = 0; this.tickWindow = 0; }
    this.hovered = this.mouse.dragging ? -1 : this.renderer.pickCharacter(this.mouse.x, this.mouse.y);
    this.renderer.render(this.clock.paused ? 1 : this.clock.alpha, dt, { selected: this.selected, hovered: this.hovered, debug: this.debug, reduceMotion: this.reduceMotion, quality: this.quality, showNames: this.settings.showNames });
    this.audio.update(this.sim);
    this.fpsAvg = this.fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    this.adaptQuality(dt);
    this.dev.update(dt);
    this.uiTick(now);
  };

  private lastUi = 0;
  private uiTick(now: number): void {
    if (now - this.lastUi < 250) return;
    this.lastUi = now;
    const sim = this.sim;
    const wx = { clear: "clear", cloudy: "cloudy", rain: "rain", storm: "storm" }[sim.env.weather];
    this.clockEl.replaceChildren(h("b", { text: fmtHour(sim.hour) }), h("span.wx", { text: ` · ${wx}${sim.env.power ? "" : " · power out"}${sim.env.party ? " · party on" : ""} · ${sim.chars.length} people` }));
    this.inspector.update();
    this.log.update();
    this.dialogue.check();
    this.updateHint();
    this.speedEls.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.speed === (this.clock.paused ? "0" : String(this.clock.speed)))));
    // toasts for notable events near the player
    for (const t of sim.toasts.splice(0)) this.toast(t.text, t.kind);
  }

  private adaptQuality(dt: number): void {
    if (this.settings.quality !== "auto") return;
    const ms = dt * 1000;
    if (ms > 26) { this.slowFor += dt; this.fastFor = 0; } else if (ms < 14) { this.fastFor += dt; this.slowFor = Math.max(0, this.slowFor - dt); } else { this.fastFor = 0; }
    if (this.slowFor > 2 && this.quality > 0) { this.quality = (this.quality - 1) as Quality; this.slowFor = 0; this.renderer.resize(this.quality); }
    if (this.fastFor > 8 && this.quality < 2) { this.quality = (this.quality + 1) as Quality; this.fastFor = 0; this.renderer.resize(this.quality); }
  }

  // ------------------------------------------------------------------ player
  private controlPlayer(): void {
    const sim = this.sim, p = sim.player, k = this.settings.keys;
    if (p.phys !== Phys.OK) { stop(p); return; }
    let ix = 0, iy = 0;
    if (this.keys.has(k.up) || this.keys.has("arrowup")) iy -= 1;
    if (this.keys.has(k.down) || this.keys.has("arrowdown")) iy += 1;
    if (this.keys.has(k.left) || this.keys.has("arrowleft")) ix -= 1;
    if (this.keys.has(k.right) || this.keys.has("arrowright")) ix += 1;
    if (ix || iy) {
      // screen directions -> world: screen up = (-1,-1), screen right = (1,-1)
      const wx = ix - iy, wy = -ix - iy, l = Math.hypot(wx, wy);
      p.vx = (wx / l) * p.speed; p.vy = (wy / l) * p.speed;
      this.moveTarget = null; this.pendingTalk = -1;
      if (this.dialogue.open) this.dialogue.close();
      this.renderer.cam.follow = p.id;
    } else if (this.moveTarget) {
      if (moveTo(p, this.moveTarget.x, this.moveTarget.y, sim, 0.3)) { this.moveTarget = null; stop(p); }
    } else if (this.pendingTalk >= 0) {
      const t = sim.chars[this.pendingTalk];
      if (!t) this.pendingTalk = -1;
      else if (Math.hypot(t.x - p.x, t.y - p.y) < 1.8) { stop(p); const id = this.pendingTalk; this.pendingTalk = -1; this.dialogue.start(id); }
      else moveTo(p, t.x, t.y, sim, 1.4);
    } else stop(p);
    if (p.anim.pose !== "auto" && sim.tick % 30 === 0) p.anim.pose = "auto";
  }

  private nearestToy(maxD = 1.4) {
    const p = this.sim.player;
    let best = null, bd = maxD;
    for (const t of this.sim.toys) { if (canPickUp(p, t, maxD) === "unavailable") continue; const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd && t.z < 1.6) { bd = d; best = t; } }
    return best;
  }

  private nearestPerson(maxD = 2.5): number {
    const p = this.sim.player;
    let best = -1, bd = maxD;
    for (const c of this.sim.chars) { if (c === p || (c.tier === "background" && !c.promoted)) continue; const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c.id; } }
    return best;
  }

  private act(kind: "pickup" | "drop" | "throw" | "swing" | "talk"): void {
    const sim = this.sim, p = sim.player;
    if (p.phys !== Phys.OK) return;
    const cursor = this.renderer.cam.toWorld(this.mouse.x, this.mouse.y);
    switch (kind) {
      case "pickup": {
        const t = this.nearestToy();
        if (!t) { this.toast("No toy in reach"); return; }
        const r = sim.pickupToy(p, t);
        if (r === "full") this.toast("Hands and bag are full (Q to drop)");
        else if (r === "hand" || r === "bag") { if (t.owner >= 0 && t.owner !== p.id) sim.playerAct(`picked up ${sim.chars[t.owner].name}'s ${TOYS[t.def].name}`, null); }
        break;
      }
      case "drop": if (p.hand >= 0) sim.dropHeld(p); break;
      case "throw": {
        if (p.hand < 0 || !canThrow(sim.toys[p.hand].def)) { const t = this.nearestToy(); if (t && TOYS[t.def].uses.includes("heavy")) sim.kickToy(p, t, cursor.x, cursor.y); else this.toast(p.hand < 0 ? "Pick something up first (E)" : "That one doesn't throw. Swing it (Space)"); return; }
        const target = this.hovered >= 0 && this.hovered !== p.id ? this.hovered : -1;
        p.facing = Math.atan2(cursor.y - p.y, cursor.x - p.x);
        p.anim.pose = "throw"; p.anim.poseT = 0.4;
        sim.throwHeld(p, cursor.x, cursor.y, target);
        break;
      }
      case "swing": {
        if (p.hand >= 0 && isMelee(sim.toys[p.hand].def)) { p.facing = Math.atan2(cursor.y - p.y, cursor.x - p.x); p.anim.pose = "swing"; p.anim.poseT = 0.3; sim.swingHeld(p); }
        else if (p.hand >= 0 && canThrow(sim.toys[p.hand].def)) this.act("throw");
        else { const t = this.nearestToy(1.2); if (t) sim.kickToy(p, t, cursor.x, cursor.y); }
        break;
      }
      case "talk": {
        const id = this.selected >= 0 && this.selected !== p.id && Math.hypot(sim.chars[this.selected].x - p.x, sim.chars[this.selected].y - p.y) < 12 ? this.selected : this.nearestPerson();
        if (id < 0) { this.toast("Nobody close enough to talk to"); return; }
        this.talkTo(id);
      }
    }
  }

  private talkTo(id: number): void {
    const p = this.sim.player, c = this.sim.chars[id];
    if (!c || c === p) return;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 1.8) this.dialogue.start(id);
    else { this.pendingTalk = id; this.moveTarget = null; }
  }

  select(id: number): void {
    this.selected = id;
    this.inspector.show(id);
  }

  // ------------------------------------------------------------------ input
  private bindInput(): void {
    const cv = this.canvas;
    window.addEventListener("keydown", (e) => {
      const tag = (e.target as HTMLElement).tagName;
      const key = e.key.toLowerCase(), k = this.settings.keys;
      if (key !== "escape" && (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")) return;
      if (key === "escape") { if (this.modal.open) this.modal.close(); else if (this.dialogue.open) this.dialogue.close(); else { this.select(-1); this.dev.toggle(false); this.log.toggle(false); } return; }
      if (this.modal.open) return;
      if (this.dialogue.open && /^[1-9]$/.test(key)) { if (this.dialogue.key(+key)) e.preventDefault(); return; }
      if ((e.target as HTMLElement).tagName === "BUTTON" && (key === " " || key === "enter")) return;
      this.keys.add(key);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      if (e.repeat) return;
      if (key === k.pickup) this.act("pickup");
      else if (key === k.drop) this.act("drop");
      else if (key === k.throw) this.act("throw");
      else if (key === k.swing) this.act("swing");
      else if (key === k.talk) this.act("talk");
      else if (key === k.pause) this.setSpeed(this.clock.paused ? this.clock.speed : 0);
      else if (key === k.inspect) this.select(this.sim.playerId);
      else if (key === k.log) this.log.toggle();
      else if (key === k.dev || key === "~") this.dev.toggle();
      else if (key === "c") { this.renderer.cam.follow = this.sim.playerId; }
      else if (key === "=" || key === "+") this.renderer.cam.setZoom(this.renderer.cam.targetZoom * 1.2);
      else if (key === "-") this.renderer.cam.setZoom(this.renderer.cam.targetZoom / 1.2);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) { const [a, b] = [...this.touches.values()]; this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
      this.mouse = { ...this.mouse, x: e.clientX, y: e.clientY, down: true, dragging: false, sx: e.clientX, sy: e.clientY, button: e.button };
    });
    cv.addEventListener("pointermove", (e) => {
      const prev = this.touches.get(e.pointerId);
      if (prev) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.renderer.cam.setZoom(this.renderer.cam.targetZoom * (d / this.pinchDist));
        this.pinchDist = d; this.mouse.dragging = true; return;
      }
      if (this.mouse.down && (this.mouse.dragging || Math.hypot(e.clientX - this.mouse.sx, e.clientY - this.mouse.sy) > 8)) {
        this.mouse.dragging = true;
        this.renderer.cam.panBy(e.clientX - this.mouse.x, e.clientY - this.mouse.y);
      }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      this.touches.delete(e.pointerId);
      if (this.touches.size < 2) this.pinchDist = 0;
      if (!this.mouse.down) return;
      this.mouse.down = false;
      if (this.mouse.dragging) { this.mouse.dragging = false; return; }
      this.click(e.clientX, e.clientY, e.button);
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", () => { this.mouse.down = false; this.mouse.dragging = false; this.touches.clear(); });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); this.renderer.cam.setZoom(this.renderer.cam.targetZoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }

  private click(x: number, y: number, button: number): void {
    const sim = this.sim, p = sim.player;
    if (button === 2) { this.mouse.x = x; this.mouse.y = y; this.act("throw"); return; }
    const id = this.renderer.pickCharacter(x, y);
    if (id >= 0) { this.select(id === this.selected && id !== p.id ? -1 : id); if (id !== p.id && this.selected === id && Math.hypot(sim.chars[id].x - p.x, sim.chars[id].y - p.y) < 1.8) this.dialogue.start(id); return; }
    const tid = this.renderer.pickToy(x, y);
    if (tid >= 0) {
      const t = sim.toys[tid];
      if (Math.hypot(t.x - p.x, t.y - p.y) < 1.4 && TOYS[t.def].portable) { sim.pickupToy(p, t); return; }
      this.moveTarget = { x: t.x, y: t.y }; this.renderer.cam.follow = p.id; return;
    }
    const w = this.renderer.cam.toWorld(x, y);
    if (sim.world.walkable(w.x, w.y)) { this.moveTarget = { x: w.x, y: w.y }; this.pendingTalk = -1; this.renderer.cam.follow = p.id; this.sim.bus.emit("fx", { kind: "spring", x: w.x, y: w.y, z: 0, n: 1 }); }
  }

  private updateHint(): void {
    const sim = this.sim, p = sim.player, k = this.settings.keys;
    const parts: (HTMLElement | string)[] = [];
    const kb = (s: string) => h("kbd", { text: s === " " ? "Space" : s.toUpperCase() });
    if (p.hand >= 0) {
      const d = sim.toys[p.hand].def;
      parts.push("Holding ", h("b", { text: TOYS[d].name }), " · ");
      if (canThrow(d)) parts.push(kb(k.throw), " throw at cursor · ");
      if (isMelee(d)) parts.push(kb(k.swing), " swing · ");
      parts.push(kb(k.drop), " drop · ");
    } else {
      const t = this.nearestToy();
      if (t) parts.push(kb(k.pickup), " pick up ", h("b", { text: TOYS[t.def].name }), " · ");
    }
    const n = this.nearestPerson();
    if (n >= 0) parts.push(kb(k.talk), " talk to ", h("b", { text: sim.chars[n].name }), " · ");
    parts.push("click people to inspect · ", kb("?"), " help");
    this.hintEl.replaceChildren(...parts);
  }

  // ------------------------------------------------------------------ sim hooks
  private bindSim(): void {
    const sim = this.sim;
    setImpactIntensity(this.settings.gentle ? 0.55 : 1);
    sim.bus.on("event", (e) => {
      const p = sim.player, near = Math.hypot(e.x - p.x, e.y - p.y) < 14 || e.radius > 100;
      if (e.type === "party") this.toast("🎵 " + e.summary, "acid");
      else if (e.type === "blackout") this.toast(e.summary, "red");
      else if (e.type === "power_back" || e.type === "rare_meteor" || e.type === "weather") this.toast(e.summary);
      else if (near && (e.type === "knockdown" || e.type === "toy_fight" || e.type === "reconcile" || e.type === "friendship" || e.type === "alliance" || e.type === "gathering")) this.toast(e.summary, e.type === "knockdown" || e.type === "toy_fight" ? "red" : "");
      if (e.actors.includes(p.id) && e.type === "knockdown") this.toast("You got knocked down!", "red");
    });
  }

  private toast(text: string, kind = ""): void {
    const el = h("div.toast" + (kind ? "." + kind : ""), { text });
    this.toastEl.prepend(el);
    while (this.toastEl.children.length > 3) this.toastEl.lastElementChild?.remove();
    setTimeout(() => el.remove(), 3500);
  }

  // ------------------------------------------------------------------ chrome
  private buildBar(): HTMLElement {
    const speeds: [string, string][] = [["0", "❚❚"], ["1", "1×"], ["2", "2×"], ["4", "4×"]];
    this.speedEls = speeds.map(([v, l]) => h("button", { "data-speed": v, "aria-label": v === "0" ? "Pause" : `Speed ${v}x`, "aria-pressed": "false", onclick: () => this.setSpeed(+v), text: l }) as HTMLButtonElement);
    this.soundBtn = h("button.btn.iconbtn", { "aria-label": "Sound on/off", title: "Sound", onclick: () => { this.settings.sound = !this.settings.sound; this.applySettings(); this.persistSettings(); } }) as HTMLButtonElement;
    return h("header.bar", null, [
      h("a.brand", { href: "/", title: "Back to MosaicScope" }, [h("b", { text: "The Mosaics" }), h("i", { text: "our world" })]),
      this.clockEl, h("div.spacer"),
      h("div.seg", { role: "group", "aria-label": "Simulation speed" }, this.speedEls),
      this.soundBtn,
      h("button.btn", { onclick: () => this.log.toggle(), text: "Log" }),
      h("button.btn", { onclick: () => this.select(this.selected === this.sim.playerId ? -1 : this.sim.playerId), text: "Me", class: "btn wide" }),
      h("button.btn", { onclick: () => this.openSaves(), text: "Save" }),
      h("button.btn", { onclick: () => this.openSettings(), text: "Settings" }),
      h("button.btn.iconbtn", { onclick: () => this.openHelp(), "aria-label": "Help", text: "?" }),
    ]);
  }

  private buildTouch(): HTMLElement {
    const b = (label: string, fn: () => void) => h("button", { onpointerdown: (e: Event) => { e.preventDefault(); fn(); }, text: label });
    return h("div.touch", { "aria-label": "Touch actions" }, [
      b("Pick up", () => this.act("pickup")), b("Throw", () => { this.mouse.x = innerWidth / 2 + 60; this.mouse.y = innerHeight / 2 - 20; this.throwAtSelected(); }),
      b("Swing", () => this.act("swing")), b("Talk", () => this.act("talk")),
    ]);
  }

  private throwAtSelected(): void {
    const sim = this.sim, p = sim.player;
    const t = this.selected >= 0 && this.selected !== p.id ? sim.chars[this.selected] : null;
    if (t) { const s = this.renderer.cam; const pt = { x: 0, y: 0 }; s.toScreen(t.x, t.y, 0, pt); this.mouse.x = pt.x; this.mouse.y = pt.y; this.hovered = t.id; }
    else { const a = p.facing; const pt = { x: 0, y: 0 }; this.renderer.cam.toScreen(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, 0, pt); this.mouse.x = pt.x; this.mouse.y = pt.y; }
    this.act("throw");
  }

  setSpeed(v: number): void {
    if (v === 0) this.clock.paused = true; else { this.clock.paused = false; this.clock.speed = v; }
  }

  private applySettings(): void {
    const s = this.settings;
    document.documentElement.style.setProperty("--ts", String(s.textScale));
    this.audio.setVolume(s.volume);
    if (s.sound !== this.audio.enabled) this.audio.setEnabled(s.sound);
    this.soundBtn.textContent = s.sound ? "🔊" : "🔇";
    this.soundBtn.classList.toggle("on", s.sound);
    setImpactIntensity(s.gentle ? 0.55 : 1);
    const q = s.quality === "low" ? 0 : s.quality === "medium" ? 1 : s.quality === "high" ? 2 : this.quality;
    if (q !== this.quality || s.quality !== "auto") { this.quality = q as Quality; this.renderer.resize(this.quality); }
  }

  private persistSettings(): void { saveSettings(this.store, this.settings); }

  private openSettings(): void {
    this.modal.show("Settings", [
      ...settingsBody(this.settings, (s, needsReset) => { this.settings = s; this.applySettings(); this.persistSettings(); if (needsReset) this.toast("Crowd size applies when you reset the world"); }),
      h("div.row", null, [
        h("button.btn", { onclick: () => { if (confirm("Start a fresh world? Unsaved progress is lost.")) { this.modal.close(); this.reset(Math.floor(Math.random() * 1e9)); } }, text: "New world (new seed)" }),
        h("button.btn", { onclick: () => { this.modal.close(); this.reset(); }, text: "Restart this world" }),
        h("button.btn", { onclick: () => { this.settings.tutorialDone = false; this.modal.close(); this.tutorial(0); }, text: "Replay tutorial" }),
      ]),
    ]);
  }

  private openSaves(): void {
    const slots = ["1", "2", "3"];
    const body = h("div.slots");
    const msg = h("p", { "aria-live": "polite" });
    const render = () => body.replaceChildren(...slots.map((s) => {
      const info = this.saves.info(s);
      return h("div.slot", null, [
        h("div", null, [h("b", { text: `Slot ${s}` }), h("small", { text: info ? `${info.savedAt === "corrupted" ? "damaged" : new Date(info.savedAt).toLocaleString()} · day time ${fmtHour((this.sim.env.startHour + info.tick / 3600) % 24)}` : "empty" })]),
        h("button.btn", { onclick: () => { const r = this.saves.save(this.sim, s); msg.textContent = r.ok ? `Saved to slot ${s} (${Math.round(r.bytes / 1024)} KB).` : `Couldn't save: ${r.error}`; msg.className = r.ok ? "" : "err"; render(); }, text: "Save" }),
        h("button.btn", { disabled: !info, onclick: () => this.load(s, msg), text: "Load" }),
      ]);
    }));
    render();
    this.modal.show("Save & load", [h("p", { style: { color: "var(--dim)" }, text: "Saves live in this browser only (local storage). They keep everyone's memories, friendships, grudges and toys." }), body, msg]);
  }

  private load(slot: string, msg: HTMLElement): void {
    try {
      const sim = this.saves.load(slot);
      this.swapSim(sim);
      msg.textContent = `Loaded slot ${slot}.`; msg.className = "";
      this.modal.close(); this.toast("World loaded");
    } catch (e) {
      msg.textContent = e instanceof SaveError ? e.message : "That save couldn't be loaded (it may be damaged)."; msg.className = "err";
      console.warn(e);
    }
  }

  reset(seed?: number): void {
    const sim = new Simulation({ seed: seed ?? this.sim.cfg.seed, backgroundCount: this.settings.density });
    this.swapSim(sim);
    this.toast(seed !== undefined ? `New world · seed ${seed}` : "World restarted");
  }

  private swapSim(sim: Simulation): void {
    this.dialogue.close();
    this.sim = sim;
    this.renderer.setSim(sim);
    this.audio.attach(sim);
    this.select(-1); this.moveTarget = null; this.pendingTalk = -1;
    this.bindSim();
    this.clock.tick = sim.tick;
  }

  private openHelp(): void {
    this.modal.show("How to play", [
      h("p", { text: "This is the Mosaics' world: Tiles, Glitter and the crew from the bottom of mosaicscope.co.nz, plus hundreds of locals. Everyone has needs, moods, memories and opinions. Nothing is scripted: fights, friendships, rumours and parties come out of what people actually see and do." }),
      keysList(this.settings.keys),
      h("p", { style: { color: "var(--dim)" }, text: "Tip: throw a ball near someone and watch who gets blamed. Open the Log to see why things happened." }),
    ]);
  }

  private tutorial(step: number): void {
    const steps: [string, string][] = [
      ["Welcome to <i>our world</i>", "You're the stranger in white and red. Tiles, Glitter and the rest of the Mosaics live here with a few hundred locals. Nothing is scripted."],
      ["Move & look", "WASD or arrow keys to walk, or click the ground. Drag to pan, scroll or pinch to zoom. Click anyone to see what they're feeling, what they remember and who they can't stand."],
      ["Toys", "E picks up the nearest toy. F (or right-click) throws it at your cursor, Space swings a foam sword. Hits have consequences: people remember who threw what."],
      ["Talk", "T talks to the nearest person. They only know what they've seen or heard, and they'll tell you where they heard it. Press L for the event log, and ? for all controls."],
    ];
    const [title, text] = steps[step];
    const h2 = h("h2"); h2.innerHTML = title; // static, trusted markup
    const next = step < steps.length - 1;
    this.modal.show("Tutorial", [
      h("p.step", { text: `${step + 1} / ${steps.length}` }), h2, h("p", { text }),
      h("div.row", null, [
        h("button.btn.red", { onclick: () => { if (next) this.tutorial(step + 1); else { this.settings.tutorialDone = true; this.persistSettings(); this.modal.close(); } }, text: next ? "Next" : "Let's go" }),
        h("button.btn", { onclick: () => { this.settings.tutorialDone = true; this.persistSettings(); this.modal.close(); }, text: "Skip" }),
      ]),
    ], "tut");
  }
}
