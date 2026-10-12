import { BurgerShift } from "../ui/minigames/Burger";
import "../ui/minigames/minigames.css";
import { Travel } from "../ui/Travel";
import "../ui/travel.css";
import { Minimap } from "../ui/Minimap";
import { ROLE_LABEL } from "../content/names";
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
import { Casino } from "../ui/Casino";
import { Places, Radio } from "../ui/Places";
import { nearestCar, playerInput, seat, unseat } from "../sim/Traffic";
import { useBandage } from "../sim/Life";
import { commitCrime, fmtCash } from "../sim/Society";
import { VEHICLES } from "../content/vehicles";
import { MOSAIC } from "../content/mosaicscope";
import { carried, detach } from "../inventory/Inventory";
import { BUILDINGS } from "../content/buildings";

/** Wires simulation, renderer, input, audio, UI and persistence together and runs the loop. */
/** People who ring you. Lines can mention {place} and {cash}. */
interface Call { name: string; label: string; missed: string; script: { say: string; opts: [string, number, ("money" | "send")?][] }[] }
const FAMILY: Call[] = [
  { name: "Mum", label: "Mum", missed: "Fine. I'll just talk to the dog then.", script: [
    { say: "Hello love! Have you eaten today? Proper food, not a pie.", opts: [["Yes Mum", 1], ["...it was a pie", 2]] },
    { say: "Good. Your aunty saw you on Instagram at {place}. Very famous!", opts: [["It's @mosaicscope Mum", 3], ["Tell her hi", 3]] },
    { say: "A pie is not a meal. I'm sending you some money for vegetables.", opts: [["Love you Mum", 3, "money"], ["I'm fine, honest", 3]] },
    { say: "Call your nana this week. And wear a jacket, the nor'wester's coming.", opts: [["Will do. Love you", -1], ["Gotta go, love you", -1]] },
  ] },
  { name: "Dad", label: "Dad", missed: "Righto. Ring back when you've got a minute.", script: [
    { say: "G'day. Quick one. How's the car going?", opts: [["Haven't crashed it", 1], ["Define 'going'", 1]] },
    { say: "Check the oil. And the tyres. When did you last check the tyres?", opts: [["Yesterday", 2], ["What's a tyre", 2]] },
    { say: "Your mother says you're doing photos now. Proud of you. Don't tell her I said that.", opts: [["Cheers Dad", -1], ["Can I borrow $40?", 3]] },
    { say: "...Fine. But I want it back. With interest. Love you, bye.", opts: [["Legend", -1, "money"]] },
  ] },
  { name: "Little sis", label: "Sister", missed: "ok rude 🙄", script: [
    { say: "omg are you at {place}?? can you get me a hokey pokey", opts: [["Sure", 1], ["Get your own", 2]] },
    { say: "ur the best. also I need $40 for a concert don't tell mum", opts: [["Send it", -1, "send"], ["Nice try", -1]] },
    { say: "wow ok. telling mum you ate a pie for dinner", opts: [["...fine, sending money", -1, "send"], ["Do it, coward", -1]] },
  ] },
  { name: "Nana", label: "Nana", missed: "Nana left a voicemail. It's four minutes long and mostly about the cat.", script: [
    { say: "Is that you, sweetheart? I can never work this phone.", opts: [["It's me Nana", 1]] },
    { say: "Are you keeping warm? Are you courting anyone nice?", opts: [["Working on it", 2], ["Nana!", 2]] },
    { say: "Well I've put a little something in your account. Don't spend it on the pokies.", opts: [["Thanks Nana ❤", -1, "money"]] },
  ] },
];

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
  private pendingEnter: { building: number; studio: boolean } | null = null;
  private quality: Quality = 2;
  private fpsAvg = 60; private slowFor = 0; private fastFor = 0;
  private ticksThisSecond = 0; private tickRate = 0; private tickWindow = 0;
  private toastEl: HTMLElement; private hintEl: HTMLElement; private clockEl: HTMLElement; private speedEls: HTMLButtonElement[] = [];
  private soundBtn!: HTMLButtonElement;
  private last = performance.now();
  private raf = 0;
  private reduceMotionOS = false;
  private touches = new Map<number, { x: number; y: number }>();
  casino: Casino; places: Places; radio: Radio;
  private hudEl: HTMLElement;
  private areaEl: HTMLElement = h("div.areaname", { "aria-live": "polite" }); private lastArea = ""; private bustedEl: HTMLElement; private lastBusted = -1;
  private gestured = false;
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
    this.casino = new Casino({
      getCash: () => this.sim.player.cash, setCash: (v) => { this.sim.player.cash = Math.round(v * 100) / 100; },
      onEvent: (t, big) => { this.toast(t, big ? "acid" : ""); if (big) this.sim.emit({ type: "casino", x: this.sim.player.x, y: this.sim.player.y, actors: [this.sim.playerId], data: { amount: 0, game: "player" }, summary: t }); },
      patrons: () => this.sim.chars.filter((c) => c.inside >= 0 && this.sim.world.buildings[c.inside]?.kind === "casino").length + 3,
    }, () => { this.clock.paused = this.pausedBefore; });
    this.places = new Places(() => this.sim, (t, b, cls) => this.modal.show(t, b, cls), () => this.modal.close(), (t, k) => this.toast(t, k));
    this.dialogue.onTrade = (id) => this.places.trade(this.sim.chars[id]);
    this.radio = new Radio(MOSAIC.soundcloud);
    this.hudEl = h("div.hud", { "aria-live": "polite" });
    this.bustedEl = h("div.busted.hidden", { role: "alert" });
    root.append(this.burger.el, this.travel.el, this.minimap.el, this.minimap.big, this.focusEl, this.phone.el, this.buildBar(), this.hudEl, this.areaEl, this.inspector.el, this.log.el, this.dialogue.el, this.dev.el, this.hintEl, this.toastEl, this.radio.el, this.buildTouch(), this.modal.el, this.casino.el, this.bustedEl);
    // browsers only allow sound after a gesture: the first click/key starts the playlist
    const firstGesture = () => { if (this.gestured) return; this.gestured = true; if (this.settings.sound) this.audio.setEnabled(true); }; // the radio only plays when you press ▶
    window.addEventListener("pointerdown", firstGesture, { once: false, capture: true });
    window.addEventListener("keydown", firstGesture, { capture: true });
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
    const ad = this.hovered < 0 && !this.mouse.dragging ? this.renderer.pickAd(this.mouse.x, this.mouse.y) : null;
    this.canvas.style.cursor = ad || this.hovered >= 0 ? "pointer" : "";
    this.canvas.title = ad ? `${ad.label} (opens in a new tab)` : "";
    this.renderer.render(this.clock.paused ? 1 : this.clock.alpha, dt, { selected: this.selected, hovered: this.hovered, debug: this.debug, reduceMotion: this.reduceMotion, quality: this.quality, showNames: this.settings.showNames });
    this.audio.update(this.sim);
    this.fpsAvg = this.fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    this.adaptQuality(dt);
    this.dev.update(dt);
    this.uiTick(now);
  };

  private lastUi = 0;
  private pausedBefore = false;

  private updateHud(): void {
    const sim = this.sim, p = sim.player;
    const stars = "★".repeat(p.wanted) + "☆".repeat(5 - p.wanted);
    const bar = (label: string, v: number, col: string) => [h("span", { text: label }), h("div.gauge", null, [h("i", { style: { width: Math.round(v * 100) + "%", background: col } })])];
    const kids: HTMLElement[] = [h("div.cash", { text: fmtCash(p.cash) }), h("div.stars" + (p.wanted ? ".flash" : ""), { "aria-label": `Wanted level ${p.wanted}` }, [h("b", { text: stars.slice(0, p.wanted) }), stars.slice(p.wanted)]),
      h("div.bars", null, [...bar("health", p.blood * p.emo.composure ** 0.3, p.bleed > 0 ? "#ec2a1c" : "#c6ff3d"), ...bar("hunger", p.hunger, "#f6b62c")])];
    if (p.inCar >= 0) { const v = sim.vehicles[p.inCar]; kids.push(h("div.car", null, [h("b", { text: String(Math.round(Math.abs(v.speed) * 7.2)) }), " km/h · " + VEHICLES[v.cls].name])); }
    if (p.bleed > 0) kids.push(h("div.car", { text: "You're bleeding. B to bandage." }));
    const obj = this.objective(); if (obj) kids.push(h("div.car.obj", { text: obj }));
    this.hudEl.replaceChildren(...kids);
    if (sim.bustedAt !== this.lastBusted && sim.bustedAt >= 0) {
      this.lastBusted = sim.bustedAt;
      this.bustedEl.replaceChildren(h("div", null, [h("h1", { text: "Busted" }), h("p", { text: `Fined ${fmtCash(sim.bustedFine)}. Your weapons were confiscated.` })]));
      this.bustedEl.classList.remove("hidden");
      setTimeout(() => this.bustedEl.classList.add("hidden"), 3200);
    }
  }

  private uiTick(now: number): void {
    this.tickFocus(now);
    this.tickMafia(now);
    this.minimap.update(now);
    if (now - this.lastUi < 250) return;
    this.maybeCall();
    this.lastUi = now;
    const sim = this.sim;
    const wx = { clear: "clear", cloudy: "cloudy", rain: "rain", storm: "storm" }[sim.env.weather];
    const pl = sim.player, area = sim.world.areaAt(pl.x, pl.y);
    const where = [sim.world.streetName(pl.x, pl.y), area && area.kind !== "street" ? area.name : ""].filter(Boolean).join(" · ");
    this.clockEl.replaceChildren(h("b", { text: fmtHour(sim.hour) }), h("span.wx", { text: ` · ${wx}${sim.env.power ? "" : " · power out"}${sim.env.party ? " · party on" : ""} · ${where}` }));
    // GTA-style district title when you walk into a new place
    const areaName = area && area.kind !== "street" ? area.name : "";
    if (areaName && areaName !== this.lastArea) {
      this.areaEl.textContent = areaName;
      this.areaEl.classList.remove("show"); void this.areaEl.offsetWidth; this.areaEl.classList.add("show");
    }
    if (areaName) this.lastArea = areaName;
    this.inspector.update();
    this.log.update();
    this.dialogue.check();
    this.updateHint();
    this.updateHud();
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
    if (p.inCar >= 0) {
      const up = this.keys.has(k.up) || this.keys.has("arrowup"), down = this.keys.has(k.down) || this.keys.has("arrowdown");
      const left = this.keys.has(k.left) || this.keys.has("arrowleft"), right = this.keys.has(k.right) || this.keys.has("arrowright");
      playerInput.throttle = up ? 1 : down ? -1 : 0;
      playerInput.steer = (right ? 1 : 0) - (left ? 1 : 0);
      playerInput.brake = this.keys.has(" ");
      this.renderer.cam.follow = p.id;
      return;
    }
    if (p.phys !== Phys.OK || sim.tick < p.stunUntil) { stop(p); return; }
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
      if (moveTo(p, this.moveTarget.x, this.moveTarget.y, sim, 0.3)) {
        this.moveTarget = null; stop(p);
        // walked to a door you clicked: go in
        if (this.pendingEnter) { const d = this.pendingEnter; this.pendingEnter = null; this.enterPlace(d); }
      }
    } else if (this.pendingTalk >= 0) {
      const t = sim.chars[this.pendingTalk];
      if (!t) this.pendingTalk = -1;
      else if (Math.hypot(t.x - p.x, t.y - p.y) < 1.8) { stop(p); const id = this.pendingTalk; this.pendingTalk = -1; this.openTalk(id); }
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

  /** Door (POI) within reach of the player, if any. */
  private nearDoor(): { building: number; studio: boolean } | null {
    const sim = this.sim, p = sim.player;
    let best: { building: number; studio: boolean } | null = null, bd = 1.5;
    for (const poi of sim.world.pois) {
      if (poi.kind !== "door") continue;
      const d = Math.hypot(poi.x - p.x, poi.y - p.y);
      if (d >= bd) continue;
      if (poi.building === -2) { bd = d; best = { building: -1, studio: true }; continue; }
      const b = sim.world.buildings[poi.building ?? -1];
      if (b && BUILDINGS[b.kind].enterable) { bd = d; best = { building: b.id, studio: false }; }
    }
    return best;
  }

  private enterPlace(door: { building: number; studio: boolean }): void {
    const sim = this.sim;
    if (door.studio) { this.places.enter(null, true); return; }
    const b = sim.world.buildings[door.building];
    if (b.kind === "airport") { this.travel.show(); return; }
    if (b.kind === "diner") { this.burger.start(); return; } // pick up a shift flipping burgers
    if (b.kind === "casino") { this.pausedBefore = this.clock.paused; this.casino.show(); return; }
    this.places.enter(b);
  }

  /** E: get out of the car / go into a place / pick up / get into a car. */
  private interact(): void {
    const sim = this.sim, p = sim.player;
    // Pay 'n' Spray: roll up to the fuel station in a car to lose the heat
    if (p.inCar >= 0) {
      const v = sim.vehicles[p.inCar], fuel = sim.world.buildings.find((b) => b.kind === "garage");
      if (fuel && Math.hypot(fuel.door.x + 0.5 - v.x, fuel.door.y + 0.5 - v.y) < 4 && Math.abs(v.speed) < 2 && (p.wanted > 0 || v.damage > 0.2)) {
        const cost = 150 + p.wanted * 100;
        if (p.cash < cost) { this.toast(`Respray is ${fmtCash(cost)}. You're short.`, "red"); return; }
        p.cash -= cost; p.wanted = 0; v.damage = 0;
        for (const c of sim.chars) if (c.pursuing === p.id) { c.pursuing = -1; c.goal = null; }
        const cols = VEHICLES[v.cls].colors; v.color = cols[(cols.indexOf(v.color) + 1) % cols.length]; v.plate = v.plate.split("").reverse().join("");
        this.focus("Fresh paint", `${fmtCash(cost)} · new plates · cops lost you`, 2.6);
        return;
      }
    }
    if (p.inCar >= 0) { const v = sim.vehicles[p.inCar]; if (Math.abs(v.speed) > 2) { this.toast("Slow down to get out"); return; } v.speed = 0; unseat(sim, v); v.state = "parked"; this.renderer.cam.follow = p.id; return; }
    const door = this.nearDoor();
    if (door) { this.enterPlace(door); return; }
    if (this.nearestToy()) { this.act("pickup"); return; }
    const car = nearestCar(sim, p.x, p.y, 2.2);
    if (!car) { this.toast("Nothing to pick up here"); return; }
    if (car.forSale) { this.toast(`For sale: ${fmtCash(car.price)}. Buy it inside the dealership.`); return; }
    const mine = car.owner === p.id;
    if (car.driver >= 0) {
      // carjacking: drag the driver out
      const d = unseat(sim, car);
      if (d) { d.phys = Phys.STUMBLE; d.physTimer = 0.8; d.kx = Math.cos(car.heading + 1.5) * 3; d.ky = Math.sin(car.heading + 1.5) * 3; this.sim.say(d, "Hey! My car!", "shout", 2); const r = sim.relate(d, p.id); r.grudge = Math.min(1, r.grudge + 0.7); }
      commitCrime(sim, p, "car_theft", d);
    } else if (!mine) commitCrime(sim, p, "car_theft", car.owner >= 0 ? sim.chars[car.owner] : null);
    seat(sim, p, car);
    car.state = "free"; car.siren = false;
    this.toast(`${mine ? "Your" : "Stolen"} ${VEHICLES[car.cls].name}: W/S drive, A/D steer, Space brake, H horn, E get out`);
  }

  private rob(): void {
    const sim = this.sim, p = sim.player;
    const id = this.nearestPerson(1.3);
    if (id < 0) { this.toast("Nobody close enough to rob"); return; }
    const v = sim.chars[id];
    const caught = sim.rng.chance(0.3 + v.pers.curiosity * 0.3);
    const loot = carried(v).map((tid) => sim.toys[tid]).find((t) => t && t.def !== "camera" && (t.def === "phone" || t.def === "watch" || t.def === "chain" || t.def === "headphones"));
    if (!caught && loot && sim.rng.chance(0.5)) { detach(v, loot.id); loot.holder = p.id; loot.state = "held"; p.bag.push(loot.id); this.toast(`Lifted a ${loot.def}`); }
    else { const take = Math.min(v.cash, 10 + Math.round(Math.random() * 50)); v.cash -= take; p.cash += take; this.toast(take ? `Lifted ${fmtCash(take)}` : "Empty pockets"); }
    commitCrime(sim, p, "pickpocket", v);
  }

  private bandage(): void {
    const sim = this.sim, p = sim.player;
    const target = p.wounds.some((w) => !w.bandaged) ? p : (() => { const id = this.nearestPerson(1.6); return id >= 0 && sim.chars[id].wounds.some((w) => !w.bandaged) ? sim.chars[id] : null; })();
    if (!target) { this.toast("Nobody here needs a bandage"); return; }
    if (!useBandage(sim, p, target)) { this.toast("You need a bandage (dairies and the Z station sell them)"); return; }
    if (target !== p) { const r = sim.relate(target, p.id); r.trust = Math.min(1, r.trust + 0.25); r.aff = Math.min(1, r.aff + 0.2); this.toast(`You bandaged ${target.name}`, "acid"); }
    else this.toast("Bandaged up");
  }

  private act(kind: "pickup" | "drop" | "throw" | "swing" | "talk"): void {
    const sim = this.sim, p = sim.player;
    if (p.phys !== Phys.OK || p.inCar >= 0) return;
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
    if (Math.hypot(c.x - p.x, c.y - p.y) < 1.8) this.openTalk(id);
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
      const el = e.target as HTMLElement, tag = el.tagName;
      const key = e.key.toLowerCase(), k = this.settings.keys;
      // only fields you type into swallow keys; a ticked checkbox or slider shouldn't freeze the controls
      const typing = tag === "SELECT" || tag === "TEXTAREA" || tag === "INPUT" && !["checkbox", "radio", "range", "button"].includes((el as HTMLInputElement).type);
      if (key !== "escape" && typing) return;
      if (key === "escape" && this.casino.open) { this.casino.close(); return; }
      if (key === "escape" && this.minimap.bigOpen) { this.minimap.toggle(false); return; }
      if (key === "escape") { if (this.modal.open) this.modal.close(); else if (this.dialogue.open) this.dialogue.close(); else { this.select(-1); this.dev.toggle(false); this.log.toggle(false); } return; }
      if (this.modal.open) return;
      if (this.dialogue.open && /^[1-9]$/.test(key)) { if (this.dialogue.key(+key)) e.preventDefault(); return; }
      if ((tag === "BUTTON" || tag === "INPUT") && (key === " " || key === "enter")) return;
      this.keys.add(key);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      if (e.repeat) return;
      if (this.casino.open) return;
      if (this.sim.player.inCar >= 0 && key === k.horn) { const v = this.sim.vehicles[this.sim.player.inCar]; this.sim.bus.emit("sound", { kind: "horn", x: v.x, y: v.y, vol: 0.8 }); return; }
      if (key === k.pickup) this.interact();
      else if (key === k.rob) this.rob();
      else if (key === k.bandage) this.bandage();
      else if (key === k.drop) this.act("drop");
      else if (key === k.throw) this.act("throw");
      else if (key === k.swing) this.act("swing");
      else if (key === k.talk) this.act("talk");
      else if (key === k.pause) this.setSpeed(this.clock.paused ? this.clock.speed : 0);
      else if (key === k.inspect) this.select(this.sim.playerId);
      else if (key === k.log) this.log.toggle();
      else if (key === "m") this.minimap.toggle();
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
    if (id >= 0) { this.select(id === this.selected && id !== p.id ? -1 : id); if (id !== p.id && this.selected === id && Math.hypot(sim.chars[id].x - p.x, sim.chars[id].y - p.y) < 1.8) this.openTalk(id); return; }
    const ad = this.renderer.pickAd(x, y);
    if (ad) { window.open(ad.url, "_blank", "noopener"); this.toast("Opening the MosaicScope site in a new tab"); return; }
    const tid = this.renderer.pickToy(x, y);
    if (tid >= 0) {
      const t = sim.toys[tid];
      if (Math.hypot(t.x - p.x, t.y - p.y) < 1.4 && TOYS[t.def].portable) { sim.pickupToy(p, t); return; }
      this.moveTarget = { x: t.x, y: t.y }; this.renderer.cam.follow = p.id; return;
    }
    const w = this.renderer.cam.toWorld(x, y);
    // clicked a building you can go into: walk to its door and step inside
    const b = this.buildingAtScreen(w.x, w.y);
    if (b) {
      const door = sim.world.pois.find((q) => q.kind === "door" && q.building === b.id);
      if (door) {
        const d = { building: b.id, studio: false };
        if (Math.hypot(door.x - p.x, door.y - p.y) < 1.6) { this.enterPlace(d); return; }
        this.moveTarget = { x: door.x, y: door.y }; this.pendingEnter = d; this.pendingTalk = -1; this.renderer.cam.follow = p.id;
        this.toast(`Heading into ${b.name}`);
        return;
      }
    }
    this.pendingEnter = null;
    if (sim.world.walkable(w.x, w.y)) { this.moveTarget = { x: w.x, y: w.y }; this.pendingTalk = -1; this.renderer.cam.follow = p.id; this.sim.bus.emit("fx", { kind: "spring", x: w.x, y: w.y, z: 0, n: 1 }); }
  }

  /**
   * The enterable building under a ground point picked from the screen. Walls and roofs sit above
   * the ground, so we walk the view ray towards the camera (+x, +y) looking for a footprint.
   */
  private buildingAtScreen(wx: number, wy: number): import("../world/World").Building | null {
    const w = this.sim.world;
    for (let k = 0; k <= 14; k += 0.5) {
      const b = w.buildingAt(Math.floor(wx + k), Math.floor(wy + k));
      if (b && BUILDINGS[b.kind].enterable) { if (k * 0.8 <= b.height * 1.25 + 1) return b; }
    }
    return null;
  }

  private updateHint(): void {
    const sim = this.sim, p = sim.player, k = this.settings.keys;
    const parts: (HTMLElement | string)[] = [];
    const kb = (s: string) => h("kbd", { text: s === " " ? "Space" : s.toUpperCase() });
    if (p.inCar >= 0) { this.hintEl.replaceChildren(kb("W"), "/", kb("S"), " drive · ", kb("A"), "/", kb("D"), " steer · ", kb(" "), " brake · ", kb("H"), " horn · ", kb(k.pickup), " get out"); return; }
    const door = this.nearDoor();
    if (door) parts.push(kb(k.pickup), " go into ", h("b", { text: door.studio ? "MosaicScope Studio" : sim.world.buildings[door.building].name }), " · ");
    else { const car = nearestCar(sim, p.x, p.y, 2.2); if (car && !this.nearestToy()) parts.push(kb(k.pickup), car.forSale ? " (for sale) " : car.owner === p.id ? " get in your car · " : " steal the car · "); }
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
      else if (near && e.actors.includes(p.id) && (e.type === "reconcile" || e.type === "friendship")) this.toast(e.summary);
      if (e.actors.includes(p.id) && e.type === "knockdown") this.toast("You got knocked down!", "red");
      // important moments in your life get the camera's full attention
      if (e.actors.includes(p.id)) {
        const street = sim.world.streetName(e.x, e.y) || "the street";
        const other = e.actors.find((id) => id !== p.id), on = other !== undefined && other >= 0 ? sim.chars[other] : null;
        const F: Record<string, () => [string, string] | null> = {
          crime: () => (e.actors[0] === p.id ? ["Caught in the act", `${street}. Someone saw that.`] : ["Mugged", `${street}. ${on ? on.name.split(" ")[0] + " got you." : ""}`]),
          arrest: () => ["Busted", `${street}`], busted: () => ["Busted", "Hands where we can see them"],
          car_crash: () => ["Crash", `${street}`], car_hit: () => (e.actors[0] === p.id ? ["Hit and run?", street] : ["Hit by a car", street]),
          kiss: () => ["A moment", on ? `You and ${on.name.split(" ")[0]}` : ""], date: () => ["Date night", on ? `With ${on.name.split(" ")[0]}` : ""],
          collapse: () => ["Down", "Someone call an ambulance"], hospital: () => ["Patched up", "Christchurch Hospital"],
          caught_cheating: () => ["Caught", "This is going to be a conversation"], breakup: () => ["It's over", on ? on.name.split(" ")[0] : ""],
          injury: () => (+e.data.level >= 2 ? ["Hurt", "That's going to need a bandage (B)"] : null),
        };
        const f = F[e.type]?.();
        if (f) this.focus(f[0], f[1], 3.6);
      }
    });
  }

  // ------------------------------------------------------------------ the Famiglia (mafia story)
  private mafia = { ch: 0, step: 0, until: 0 };
  /** Five chapters from errand runner to made: Don Vito hands out each job when you talk to him. */
  private mafiaJob(): { title: string; brief: string; stops: [string, string][]; pay: number; heat: number; secs: number } | null {
    return [
      { title: "Chapter 1 · Pies for the Don", brief: "Take this box to Moorhouse Fuel. Don't open it. It's pies.", stops: [["garage", "Drop the box at Moorhouse Fuel"]], pay: 200, heat: 0, secs: 0 },
      { title: "Chapter 2 · The Tomato Fund", brief: "Visit our friends. They 'donate' to my tomato garden.", stops: [["dairy", "Collect from the dairy"], ["pizza", "Collect from the pizza shop"], ["sushi", "Collect from the sushi bar"]], pay: 500, heat: 0, secs: 0 },
      { title: "Chapter 3 · Moon Sherbet", brief: "SALT District has a parcel of Moon Sherbet. Casino. Ninety seconds.", stops: [["alley", "Pick up the Moon Sherbet in the SALT District"], ["casino", "Bring it to the Tessera, fast"]], pay: 1200, heat: 1, secs: 90 },
      { title: "Chapter 4 · The Riccarton Boys", brief: "They're selling hubcaps on my street. Go to the car yards. Make an impression.", stops: [["dealership", "Make an impression at the car yards"]], pay: 2500, heat: 2, secs: 0 },
      { title: "Chapter 5 · Made", brief: "Come back to the Tessera. Family dinner. Wear something nice.", stops: [["casino", "Family dinner at the Tessera"]], pay: 10000, heat: 0, secs: 0 },
    ][this.mafia.ch] as { title: string; brief: string; stops: [string, string][]; pay: number; heat: number; secs: number } | undefined ?? null;
  }
  private mafiaTarget(): { x: number; y: number; label: string } | null {
    const job = this.mafiaJob();
    if (!job || this.mafia.step === 0) return null;
    const [kind, label] = job.stops[this.mafia.step - 1] ?? [];
    if (!kind) return null;
    const w = this.sim.world, p = this.sim.player;
    const b = kind === "alley" ? null : w.buildings.filter((x) => x.kind === kind).sort((a, c) => Math.hypot(a.door.x - p.x, a.door.y - p.y) - Math.hypot(c.door.x - p.x, c.door.y - p.y))[0];
    if (b) return { x: b.door.x + 0.5, y: b.door.y + 0.5, label };
    const a = w.areas.find((x) => x.name === "SALT District") ?? w.areas.find((x) => x.kind === "alley");
    return a ? { x: a.cx, y: a.cy, label } : null;
  }
  private talkToDon(): void {
    const job = this.mafiaJob();
    if (!job) { this.focus("Capo", "\"You're family now. Go enjoy the city.\" (Don Vito)", 3.5); return; }
    if (this.mafia.step > 0) { this.focus("Don Vito", `"${this.mafiaTarget()?.label ?? "Get it done"}. Capisce?"`, 3); return; }
    this.mafia.step = 1; this.mafia.until = job.secs ? performance.now() + job.secs * 1000 : 0;
    this.focus(job.title, `"${job.brief}"`, 4.5);
  }
  private tickMafia(now: number): void {
    const job = this.mafiaJob(), t = this.mafiaTarget();
    this.minimap.target = t;
    if (!job || !t) return;
    const p = this.sim.player, px = p.inCar >= 0 ? this.sim.vehicles[p.inCar].x : p.x, py = p.inCar >= 0 ? this.sim.vehicles[p.inCar].y : p.y;
    if (this.mafia.until && now > this.mafia.until) { this.mafia.step = 0; this.mafia.until = 0; this.focus("Too slow", "The Don is disappointed. Talk to him again.", 3); return; }
    if (Math.hypot(px - t.x, py - t.y) > 2.2) return;
    if (this.mafia.step < job.stops.length) { this.mafia.step++; this.toast(`✓ ${t.label}`, "acid"); return; }
    p.cash += job.pay; p.wanted = Math.max(p.wanted, job.heat);
    this.mafia.ch++; this.mafia.step = 0; this.mafia.until = 0;
    this.focus(job.title.split(" · ")[1] + " · done", `The Famiglia paid you ${fmtCash(job.pay)}${job.heat ? ` · the cops noticed (${job.heat}★)` : ""}`, 4);
  }
  objective(): string {
    const t = this.mafiaTarget();
    if (!t) return "";
    const left = this.mafia.until ? Math.max(0, Math.ceil((this.mafia.until - performance.now()) / 1000)) : 0;
    return `🌹 ${t.label}${left ? ` · ${left}s` : ""}`;
  }

  /** Open a conversation with the camera on the two of you. */
  private openTalk(id: number): void {
    const don = this.sim.chars[id];
    if (don && don.role === "mobster" && don.nickname === "The Don") { this.talkToDon(); return; }
    this.dialogue.start(id);
    const c = this.sim.chars[id];
    if (!c || !this.dialogue.open) return;
    const r = this.sim.player.rel.get(id), close = (r?.aff ?? 0) > 0.35, first = c.name.split(" ")[0];
    const label = this.sim.player.partner === id ? "Your person" : close ? (c.look.kind === "girl" ? "Your homegirl" : "Your homie") : c.tier === "principal" ? "One of the Mosaics" : ROLE_LABEL[c.role] ? `The ${ROLE_LABEL[c.role]}` : "";
    this.focus(c.nickname ? `${first} "${c.nickname}"` : first, label, 0, true);
  }

  // ------------------------------------------------------------------ focus mode
  private minimap = new Minimap(() => this.sim);
  private burger = new BurgerShift((r) => { this.sim.player.cash += r.pay; this.toast(`Shift done: ${r.orders} orders, ${r.perfect} perfect. Paid ${fmtCash(r.pay)}`, "acid"); this.focus("Shift over", `Lyttelton Diner paid you ${fmtCash(r.pay)}`, 3); });
  private travel = new Travel({
    getCash: () => this.sim.player.cash, setCash: (v) => { this.sim.player.cash = v; },
    companions: () => this.sim.chars.filter((c) => c.tier === "principal" && c.name !== "Chris").map((c) => ({ name: c.name, color: c.look.color })),
    carried: () => carried(this.sim.player).map((id) => this.sim.toys[id]).filter(Boolean).map((t) => ({ id: t.id, name: TOYS[t.def].name, category: TOYS[t.def].category ?? "toy" })),
    confiscate: (ids) => { const p = this.sim.player; for (const id of ids) { const t = this.sim.toys[id]; if (!t) continue; detach(p, id); t.state = "broken"; t.x = -100; t.holder = -1; } },
    onReturn: (summary) => { this.toast(summary, "acid"); this.focus("Home", "Welcome back to Christchurch", 3); },
    toast: (t) => this.toast(t),
  });
  private focusEl = h("div.focus", { "aria-hidden": "true" }, [h("div.focus-bar.top"), h("div.focus-bar.bot"), h("div.focus-cap", null, [h("b"), h("span")])]);
  private focusUntil = 0; private focusZoom = 0; private focusHeld = false;
  /** Letterbox, vignette, push in on the player, caption. `secs` <= 0 holds until unfocus(). */
  focus(title: string, sub = "", secs = 3.5, talk = false): void {
    const cam = this.renderer.cam;
    if (!this.focusEl.classList.contains("on")) this.focusZoom = cam.targetZoom;
    cam.setZoom(Math.max(this.focusZoom, 2.2));
    cam.follow = this.sim.playerId;
    (this.focusEl.querySelector(".focus-cap b") as HTMLElement).textContent = title;
    (this.focusEl.querySelector(".focus-cap span") as HTMLElement).textContent = sub;
    this.focusEl.classList.remove("on"); this.focusEl.classList.toggle("talk", talk); void this.focusEl.offsetWidth; this.focusEl.classList.add("on");
    this.focusHeld = secs <= 0;
    this.focusUntil = secs > 0 ? performance.now() + secs * 1000 : Infinity;
  }
  unfocus(): void {
    if (!this.focusEl.classList.contains("on")) return;
    this.focusEl.classList.remove("on"); this.focusHeld = false; this.focusUntil = 0;
    this.renderer.cam.setZoom(this.focusZoom || 1.5);
  }
  private tickFocus(now: number): void {
    if (this.focusEl.classList.contains("on") && !this.focusHeld && now > this.focusUntil) this.unfocus();
    if (this.focusHeld && !this.dialogue.open && !this.phone.open) this.unfocus();
  }

  // ------------------------------------------------------------------ family
  private phone = { open: false, el: h("div.phone.hidden", { role: "dialog", "aria-label": "Phone call" }), nextCall: 0, calls: 0 };
  private maybeCall(): void {
    const sim = this.sim;
    if (this.phone.open || this.dialogue.open || this.casino.open || this.modal.open) return;
    if (!this.phone.nextCall) { this.phone.nextCall = sim.tick + 60 * 60 * 3; return; }
    if (sim.tick < this.phone.nextCall) return;
    this.phone.nextCall = sim.tick + 60 * 60 * (6 + Math.random() * 6);
    const who = FAMILY[this.phone.calls++ % FAMILY.length];
    this.phone.open = true;
    this.focus(`${who.name} is calling`, "Answer or decline", 0);
    const p = sim.player;
    const close = (msg?: string) => { this.phone.open = false; this.phone.el.classList.add("hidden"); if (msg) this.toast(msg); this.unfocus(); };
    const step = (i: number) => {
      const line = who.script[i];
      if (!line) { close(); return; }
      this.phone.el.replaceChildren(
        h("div.who", null, [h("b", { text: who.name }), h("span", { text: who.label })]),
        h("p.line", { text: `“${line.say.replace("{place}", sim.world.areaAt(p.x, p.y)?.name ?? "town").replace("{cash}", "$" + Math.round(p.cash))}”` }),
        h("div.opts", null, line.opts.map(([label, next, effect], k) => h("button", { onclick: () => { if (effect === "money") { p.cash += 50; this.toast(`${who.name} sent you $50`, "acid"); } if (effect === "send") { const amt = Math.min(p.cash, 40); p.cash -= amt; this.toast(`You sent ${who.name} $${amt}`); } if (next < 0) close(); else step(next); } }, [h("kbd", { text: String(k + 1) }), label]))),
      );
    };
    this.phone.el.classList.remove("hidden");
    this.phone.el.replaceChildren(h("div.who", null, [h("b", { text: who.name }), h("span", { text: `${who.label} · calling…` })]), h("div.opts", null, [
      h("button.btn.acid", { onclick: () => step(0), text: "Answer" }),
      h("button.btn", { onclick: () => close(`${who.name}: "${who.missed}"`), text: "Decline" }),
    ]));
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
      b("Use / Enter", () => this.interact()), b("Bandage", () => this.bandage()),
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
    this.renderer.fakeBlood = s.fakeBlood; this.sim.fakeBlood = s.fakeBlood;
    // muting silences everything, radio included; unmuting never restarts the radio on its own
    if (this.radio) { if (!s.sound && this.radio.playing) this.radio.pause(); this.radio.setVolume(s.volume); }
    document.documentElement.style.setProperty("--ts", String(s.textScale));
    this.audio.setVolume(s.volume);
    if (this.gestured && s.sound !== this.audio.enabled) this.audio.setEnabled(s.sound);
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
    sim.fakeBlood = this.settings.fakeBlood;
    this.dialogue.close();
    this.sim = sim; this.minimap.reset();
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
