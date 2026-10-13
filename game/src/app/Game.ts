import { nearestRecyclable, nearestBin, collectPiece, rummageBin, scrapCount, scrapValue } from "../sim/Litter";
import { LITTER, SACK_CAP } from "../content/litter";
import { Club } from "../ui/Club";
import "../ui/club.css";
import { Luxury } from "../ui/Luxury";
import { TouchControls } from "../ui/Touch";
import "../ui/casino.css";
import { RoastBattle } from "../ui/minigames/Roast";
import { BurgerShift } from "../ui/minigames/Burger";
import "../ui/minigames/minigames.css";
import { Travel } from "../ui/Travel";
import { HeistUI } from "../ui/Heist";
import "../ui/travel.css";
import { Minimap } from "../ui/Minimap";
import { ROLE_LABEL } from "../content/names";
import { Simulation } from "../sim/Simulation";
import { zooState } from "../mind/Town";
import { SimulationClock } from "../core/clock";
import { Renderer, Quality } from "../render/Renderer";
import { AudioSystem } from "../audio/Audio";
import { LocalStorageProvider } from "../persistence/storage";
import { SaveSystem, SaveError } from "../persistence/SaveSystem";
import { setGravityScale, gravityScale } from "../physics/PhysicsWorld";
import { Settings, loadSettings, saveSettings } from "../persistence/Settings";
import { newDebugFlags } from "../debug/flags";
import { DevPanel } from "../debug/DevPanel";
import { Inspector } from "../ui/Inspector";
import { EventLog } from "../ui/EventLog";
import { DialogueUI } from "../ui/DialogueUI";
import { TerranceUI } from "../ui/Terrance";
import { ModalHost, settingsBody, keysList } from "../ui/Modals";
import { h, fmtHour } from "../ui/dom";
import { moveTo, stop } from "../ai/steps";
import { canPickUp } from "../inventory/Inventory";
import { TOYS, canThrow, isMelee, BLACK_MARKET } from "../content/toys";
import { setImpactIntensity } from "../physics/combat";
import { Phys } from "../entities/types";
import { Casino } from "../ui/Casino";
import { Places, Radio } from "../ui/Places";
import { InteriorOverlay } from "../ui/InteriorOverlay";
import { nearestCar, playerInput, seat, unseat } from "../sim/Traffic";
import { useBandage } from "../sim/Life";
import { commitCrime, fmtCash } from "../sim/Society";
import { VEHICLES } from "../content/vehicles";
import { MOSAIC } from "../content/mosaicscope";
import { carried, detach } from "../inventory/Inventory";
import { BUILDINGS } from "../content/buildings";
import { billAbsence, collect } from "../sim/Arrears";
import { Photos } from "../ui/Photos";
import { MOMENTS } from "../content/photos";

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
  inspector: Inspector; log: EventLog; dialogue: DialogueUI; terrance: TerranceUI; modal = new ModalHost(); dev: DevPanel;
  private selected = -1; private hovered = -1;
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, dragging: false, sx: 0, sy: 0, button: 0 };
  private moveTarget: { x: number; y: number } | null = null;
  private pendingTalk = -1;
  private pendingEnter: { building: number; studio: boolean } | null = null;
  // auto starts at medium on desktop and high on phones (full detail, more battery), and steps down only if frames drop
  private quality: Quality = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? 2 : 1;
  private fpsAvg = 60; private slowFor = 0; private fastFor = 0;
  private ticksThisSecond = 0; private tickRate = 0; private tickWindow = 0;
  private toastEl: HTMLElement; private hintEl: HTMLElement; private clockEl: HTMLElement; private speedEls: HTMLButtonElement[] = [];
  private soundBtn!: HTMLButtonElement;
  private last = performance.now();
  private raf = 0;
  private reduceMotionOS = false;
  private touches = new Map<number, { x: number; y: number }>();
  photos!: Photos; casino: Casino; places: Places; radio: Radio; interior: InteriorOverlay;
  private hudEl: HTMLElement;
  private areaEl: HTMLElement = h("div.areaname", { "aria-live": "polite" }); private lastArea = ""; private bustedEl: HTMLElement; private lastBusted = -1;
  private gestured = false;
  private pinchDist = 0;

  private rootEl: HTMLElement;
  constructor(private canvas: HTMLCanvasElement, root: HTMLElement) {
    this.rootEl = root;
    this.settings = loadSettings(this.store);
    this.sim = new Simulation({ backgroundCount: Math.min(this.settings.density, 300) });
    this.renderer = new Renderer(canvas, this.sim);
    this.audio = new AudioSystem(() => this.renderer.cam);
    this.audio.attach(this.sim);
    this.ui = root;
    const S = () => this.sim;
    this.inspector = new Inspector(S, { talk: (id) => this.talkTo(id), follow: (id) => { this.renderer.cam.follow = id; }, select: (id) => this.select(id) });
    this.log = new EventLog(S, (x, y) => { this.renderer.cam.follow = -1; this.renderer.cam.lookAt(x, y); });
    this.dialogue = new DialogueUI(S);
    this.terrance = new TerranceUI(S);
    this.terrance.onSpeak = (t) => this.audio?.speak(t);
    this.dev = new DevPanel(S, this.renderer, this.debug, {
      quality: () => (this.settings.quality === "auto" ? "auto→" : "") + ["low", "medium", "high", "ultra"][this.quality], speed: () => (this.clock.paused ? 0 : this.clock.speed),
      fps: () => this.fpsAvg, tickRate: () => this.tickRate, reset: (seed) => this.reset(seed), toast: (t) => this.toast(t),
      teleport: () => { const p = this.renderer.cam.toWorld(this.mouse.x, this.mouse.y); const w = this.sim.world.nearestWalkable(p.x, p.y); this.sim.player.x = w.x; this.sim.player.y = w.y; },
    });
    // debug console: type mosaics.help() in the browser console
    (window as unknown as { mosaics: object }).mosaics = {
      help: () => "mosaics.gravity(v) sets toy gravity (0.1 to 2); mosaics.toast(text) shows a toast; mosaics.saveSlots() lists slots; mosaics.colourBlind(true|false) switches the palette; mosaics.toys() lists toy states; mosaics.people() counts people near you; mosaics.save('1') saves to a slot; mosaics.toyCount(), saveList(), clearSlot(slot), colourBlindState(), restart(), gravityToast(), helpers() lists all helpers",
      gravity: (v: number) => { setGravityScale(v); return `gravity ${gravityScale}`; },
      toast: (text: string) => this.toast(text),
      saveSlots: () => ["1", "2", "3"].map((s) => ({ slot: s, info: this.saves.info(s) })),
      repairToys: () => { let n = 0; for (const t of this.sim.toys) if (this.sim.physics.repairToy(t)) n++; return `repaired ${n} toy(s)`; },
      toys: () => this.sim.toys.map((t) => ({ def: t.def, state: t.state, durability: Math.round(t.durability), max: t.maxDurability })),
      people: () => ({ total: this.sim.chars.length, nearby: this.sim.chars.filter((c) => c !== this.sim.player && Math.hypot(c.x - this.sim.player.x, c.y - this.sim.player.y) < 12).length }),
      save: (slot: string) => { const r = this.saves.save(this.sim, slot); return r.ok ? `saved to slot ${slot} (${Math.round(r.bytes / 1024)} KB)` : `couldn't save: ${r.error}`; },
      toyCount: () => ({ total: this.sim.toys.length, broken: this.sim.toys.filter((t) => t.state === "broken").length }),
      saveList: () => ["1", "2", "3"].map((slot) => { const i = this.saves.info(slot); return { slot, when: i ? i.savedAt : "empty" }; }),
      clearSlot: (slot: string) => { this.saves.remove(slot); return `cleared slot ${slot}`; },
      colourBlindState: () => document.documentElement.classList.contains("cb") ? "on" : "off",
      restart: () => { this.reset(Math.floor(Math.random() * 1e9)); return "world restarted"; },
      gravityToast: () => { this.toast(`gravity ${gravityScale}`); return `gravity ${gravityScale}`; },
      helpers: () => ["help", "gravity", "toast", "saveSlots", "toys", "people", "save", "colourBlind", "repairToys", "toyCount", "saveList", "clearSlot", "colourBlindState", "restart", "gravityToast", "helpers"],
      colourBlind: (on: boolean) => { try { localStorage.setItem("ms-colourblind", on ? "1" : "0"); } catch { /* storage blocked */ } document.documentElement.classList.toggle("cb", on); return `colour-blind ${on ? "on" : "off"}`; },
    };
    try { if (localStorage.getItem("ms-colourblind") === "1") document.documentElement.classList.add("cb"); } catch { /* storage blocked: default palette */ }
    this.toastEl = h("div.toasts", { "aria-live": "polite" });
    this.hintEl = h("div.hint");
    this.clockEl = h("span.clock");
    this.casino = new Casino({
      getCash: () => this.sim.player.cash, setCash: (v) => { this.sim.player.cash = Math.round(v * 100) / 100; },
      onEvent: (t, big) => { this.toast(t, big ? "acid" : ""); if (big) this.sim.emit({ type: "casino", x: this.sim.player.x, y: this.sim.player.y, actors: [this.sim.playerId], data: { amount: 0, game: "player" }, summary: t }); },
      patrons: () => this.sim.chars.filter((c) => c.inside >= 0 && this.sim.world.buildings[c.inside]?.kind === "casino").length + 3,
    }, () => { this.clock.paused = this.pausedBefore; });
    this.places = new Places(() => this.sim, (t, b, cls) => this.modal.show(t, b, cls), () => this.modal.close(), (t, k) => this.toast(t, k));
    this.interior = new InteriorOverlay({
      sim: () => this.sim, toast: (t, k) => this.toast(t, k), launch: (what, b) => this.places.launch(what, b), modalOpen: () => this.modal.open,
      keys: () => ({ up: this.settings.keys.up, down: this.settings.keys.down, left: this.settings.keys.left, right: this.settings.keys.right, use: this.settings.keys.pickup }),
    });
    this.places.openInterior = (b) => this.interior.show(b);
    this.photos = new Photos({
      world: () => this.renderer.canvas, interior: () => (this.interior.open ? this.interior.canvas : null),
      show: (t, b, cls) => this.modal.show(t, b, cls), close: () => this.modal.close(), toast: (t, k) => this.toast(t, k),
      where: () => { const p = this.sim.player; return this.sim.world.streetName(p.x, p.y) || ""; }, simRep: () => this.sim.player.reputation,
    }, this.store);
    this.places.photos = this.photos;
    this.dialogue.onTrade = (id) => this.places.trade(this.sim.chars[id]);
    this.radio = new Radio(MOSAIC.soundcloud);
    this.hudEl = h("div.hud", { "aria-live": "polite" });
    this.bustedEl = h("div.busted.hidden", { role: "alert" });
    root.append(this.club.el, this.luxury.el, this.touch.el, this.travel.el, this.minimap.el, this.minimap.big, this.focusEl, this.phone.el, this.buildBar(), this.hudEl, this.areaEl, this.inspector.el, this.log.el, this.dialogue.el, this.terrance.el, this.dev.el, this.hintEl, this.toastEl, this.radio.el, this.buildTouch(), this.interior.el, this.modal.el, this.casino.el, this.bustedEl);
    this.loadMinigames();
    // browsers only allow sound after a gesture: the first click/key starts the playlist
    const firstGesture = () => { if (this.gestured) return; this.gestured = true; if (this.settings.sound) this.audio.setEnabled(true); }; // the radio only plays when you press ▶
    window.addEventListener("pointerdown", firstGesture, { once: false, capture: true });
    window.addEventListener("keydown", firstGesture, { capture: true });
    this.applySettings();
    this.bindInput();
    this.bindSim();
    this.bindStats();
    // phones: stop the browser's own pinch/double-tap page zoom from fighting the game's camera
    for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault());
    // iOS Safari ignores user-scalable=no: stop double-tap zoom, pinch-zoom of the page and long-press selection ourselves
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (e) => { const n = Date.now(); if (n - lastTouchEnd < 350 && (e.target as HTMLElement | null)?.closest?.("input,textarea,button,.tc") == null) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
    // block iPhone's page-scroll on every drag (one finger too), so the stick is not cancelled mid-drag; panels that scroll keep working
    document.addEventListener("touchmove", (e) => {
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) return;
        el = el.parentElement;
      }
      e.preventDefault();
    }, { passive: false });
    document.addEventListener("selectstart", (e) => { if (!(e.target as HTMLElement | null)?.closest?.("input,textarea")) e.preventDefault(); });
    addEventListener("error", (e) => this.fault("window", e.error ?? e.message));
    addEventListener("unhandledrejection", (e) => this.fault("promise", e.reason));
    this.loadEmpire();
    this.applyAbsence();
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
  /** Run one part of the frame; a failure is counted and survived, never fatal. */
  private guard(name: string, fn: () => void): void {
    try { fn(); } catch (e) { this.fault(name, e); }
  }
  private faults: number[] = []; private faultEl: HTMLElement | null = null;
  private fault(name: string, e: unknown): void {
    const now = performance.now();
    console.error(`[mosaics:${name}]`, e);
    this.faults.push(now); this.faults = this.faults.filter((t) => now - t < 5000);
    if (this.faults.length >= 8 && !this.faultEl) {
      // something keeps failing: stop the clock and let the player choose, instead of a dead screen
      this.setSpeed(0);
      this.faultEl = h("div.fault", { role: "alertdialog", "aria-label": "Something glitched" }, [
        h("h2", { text: "Something glitched" }), h("p", { text: "The city hit a snag. Your cash and progress are safe in this tab." }),
        h("div.row", null, [
          h("button.btn.acid", { onclick: () => { this.faultEl?.remove(); this.faultEl = null; this.faults = []; this.setSpeed(1); }, text: "Keep going" }),
          h("button.btn", { onclick: () => location.reload(), text: "Reload" }),
        ]),
      ]);
      this.rootEl.append(this.faultEl);
    }
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    this.guard("frame", () => this.frame());
  };

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const steps = this.clock.advance(dt);
    for (let i = 0; i < steps; i++) this.guard("sim", () => { this.controlPlayer(); this.sim.step(); });
    this.ticksThisSecond += steps; this.tickWindow += dt;
    if (this.tickWindow >= 1) { this.tickRate = this.ticksThisSecond / this.tickWindow; this.ticksThisSecond = 0; this.tickWindow = 0; }
    this.hovered = this.mouse.dragging ? -1 : this.renderer.pickCharacter(this.mouse.x, this.mouse.y);
    const ad = this.hovered < 0 && !this.mouse.dragging ? this.renderer.pickAd(this.mouse.x, this.mouse.y) : null;
    this.canvas.style.cursor = ad || this.hovered >= 0 ? "pointer" : "";
    this.canvas.title = ad ? `${ad.label} (opens in a new tab)` : "";
    if (!this.interior.open) this.guard("render", () => this.renderer.render(this.clock.paused ? 1 : this.clock.alpha, dt, { selected: this.selected, hovered: this.hovered, debug: this.debug, reduceMotion: this.reduceMotion, quality: this.quality, showNames: this.settings.showNames }));
    this.guard("audio", () => {
      const f = this.interior.footing;
      this.audio.scene = { interior: this.interior.building?.kind ?? null, moving: f.moving, running: f.running, in2D: this.renderer.street2D };
      this.audio.update(this.sim, this.interior.kind);
      this.canvas.style.filter = this.audio.dream > 0.01 && !this.reduceMotion ? `hue-rotate(${(this.audio.dream * 28).toFixed(1)}deg) saturate(${(1 + this.audio.dream * 0.12).toFixed(2)})` : "";
    });
    this.fpsAvg = this.fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    this.adaptQuality(dt);
    this.guard("dev", () => this.dev.update(dt));
    this.guard("ui", () => this.uiTick(now));
  }

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
    this.touch.update();
    if (now - this.clubTickAt > 1000) { const earned = this.club.tick(Math.min(5, (now - (this.clubTickAt || now)) / 1000)); this.clubTickAt = now; if (earned > 0) this.sim.player.cash += earned; }
    this.renderer.zooAnimals = this.luxury.empire.animals; zooState.animals = this.luxury.empire.animals.length;
    this.touch.el.classList.toggle("hidden", this.casino.open || this.interior.open || (this.modal.open && !this.modal.el.classList.contains("touch-tut")) || this.dialogue.open || this.terrance.open || this.travel.open || this.minimap.bigOpen || this.luxury.open || this.club.open);
    this.tickStory(now);
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
    this.dialogue.check(); this.terrance.check();
    this.updateHint();
    this.updateHud();
    this.speedEls.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.speed === (this.clock.paused ? "0" : String(this.clock.speed)))));
    // toasts for notable events near the player
    for (const t of sim.toasts.splice(0)) this.toast(t.text, t.kind);
    // zone splash: name the district when the player walks into a different area
    const here = sim.world.areaAt(sim.player.x, sim.player.y);
    if (here && here.id !== this.zoneId) { this.zoneId = here.id; this.toast(here.name, "zone"); }
  }
  /** id of the district the player was last in (-1 before the first frame), for the zone splash */
  private zoneId = -1;

  private adaptQuality(dt: number): void {
    if (this.settings.quality !== "auto") return;
    const ms = dt * 1000;
    // aim for 60fps: anything slower than ~55fps for a second steps quality down; recover slowly
    if (ms > 18.5) { this.slowFor += dt; this.fastFor = 0; } else if (ms < 13) { this.fastFor += dt; this.slowFor = Math.max(0, this.slowFor - dt); } else { this.fastFor = 0; }
    if (this.slowFor > 1 && this.quality > 0) { this.quality = (this.quality - 1) as Quality; this.slowFor = 0; this.renderer.resize(this.quality); }
    if (this.fastFor > 12 && this.quality < 2) { this.quality = (this.quality + 1) as Quality; this.fastFor = 0; this.renderer.resize(this.quality); }
  }

  // ------------------------------------------------------------------ player
  private controlPlayer(): void {
    const sim = this.sim, p = sim.player, k = this.settings.keys;
    if (this.interior.open) { p.vx = p.vy = 0; return; } // you're indoors; the street body waits at the door
    if (p.inCar >= 0) {
      const up = this.keys.has(k.up) || this.keys.has("arrowup"), down = this.keys.has(k.down) || this.keys.has("arrowdown");
      const left = this.keys.has(k.left) || this.keys.has("arrowleft"), right = this.keys.has(k.right) || this.keys.has("arrowright");
      playerInput.throttle = up ? 1 : down ? -1 : 0;
      playerInput.steer = (right ? 1 : 0) - (left ? 1 : 0);
      playerInput.brake = this.keys.has(" ") || this.touchBrake;
      // touch: stick x steers, y is gas (up) / reverse (down)
      if (this.touchMove.x || this.touchMove.y) { playerInput.steer = this.touchMove.x; playerInput.throttle = -this.touchMove.y; }
      this.renderer.cam.follow = p.id;
      return;
    }
    if (p.phys !== Phys.OK || sim.tick < p.stunUntil) { stop(p); return; }
    let ix = 0, iy = 0;
    if (this.keys.has(k.up) || this.keys.has("arrowup")) iy -= 1;
    if (this.keys.has(k.down) || this.keys.has("arrowdown")) iy += 1;
    if (this.keys.has(k.left) || this.keys.has("arrowleft")) ix -= 1;
    if (this.keys.has(k.right) || this.keys.has("arrowright")) ix += 1;
    // touch stick: analog, push past ~94% to sprint
    if (this.touchMove.x || this.touchMove.y) { ix = this.touchMove.x; iy = this.touchMove.y; }
    if (ix || iy) {
      // moving yourself brings the camera back to you (tapping someone to inspect had left it on them)
      if (this.renderer.cam.follow !== p.id) this.renderer.cam.follow = p.id;
      // screen directions -> world: screen up = (-1,-1), screen right = (1,-1)
      const wx = ix - iy, wy = -ix - iy, l = Math.hypot(wx, wy);
      p.vx = (wx / l) * p.speed; p.vy = (wy / l) * p.speed;
      this.moveTarget = null; this.pendingTalk = -1;
      if (this.dialogue.open) this.dialogue.close();
      if (this.terrance.open) this.terrance.close();
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

  private nearestLitter() { const p = this.sim.player; return p.phys === Phys.OK ? nearestRecyclable(this.sim.litter, p.x, p.y, 1.1) : null; }
  private nearestBin() { const p = this.sim.player; return p.phys === Phys.OK ? nearestBin(this.sim.world, p.x, p.y, 1.5) : null; }

  /** Pick a can or bottle off the street, or rummage a bin for the ones people left in it. */
  private scavenge(): boolean {
    const sim = this.sim, p = sim.player;
    const piece = this.nearestLitter();
    if (piece) {
      const what = LITTER[piece.kind].name, r = collectPiece(sim, p, piece);
      if (r === "full") this.toast(`Sack's full (${SACK_CAP}). Cash in at the recycling centre.`);
      else if (r === "ok") { p.anim.pose = "kick"; p.anim.poseT = 0.15; this.toast(`Picked up a ${what} · ${scrapCount(p)} in your sack (${fmtCash(scrapValue(p))})`, scrapCount(p) % 5 === 0 ? "spark" : ""); }
      return true;
    }
    const bin = this.nearestBin();
    if (bin) {
      const got = rummageBin(sim, p, bin);
      if (got.can + got.bottle) this.toast(`Rummaged the bin: ${[got.can && `${got.can} can${got.can > 1 ? "s" : ""}`, got.bottle && `${got.bottle} bottle${got.bottle > 1 ? "s" : ""}`].filter(Boolean).join(" and ")} · ${scrapCount(p)} in your sack`);
      else this.toast(got.full ? `Sack's full (${SACK_CAP}). Cash in at the recycling centre.` : "Nothing in this bin but regret.");
      return true;
    }
    return false;
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
    if ((b.kind as string) === "stripclub") { this.club.show("strip"); return; }
    if ((b.kind as string) === "velvet") { this.club.show("velvet"); return; }
    if (b.kind === "diner") { this.burger?.start(); return; } // pick up a shift flipping burgers
    if (b.kind === "casino") { this.statsCasino++; }
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
    if (this.scavenge()) return;
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

  /**
   * R: at a shop door with a weapon in hand you hold up the till; otherwise you pickpocket the nearest
   * person. Lifting is easier from behind and when they're distracted (talking, on a phone, busy), and
   * harder face to face or from someone nervous. Witnesses report it (wanted stars).
   */
  private rob(): void {
    const sim = this.sim, p = sim.player;
    const held = p.hand >= 0 ? sim.toys[p.hand] : null, armed = !!held && TOYS[held.def].category === "weapon";
    const door = this.nearDoor();
    if (door && !door.studio && armed) {
      const b = sim.world.buildings[door.building];
      const take = Math.round((sim.tills[b.id] ?? 0) + 120 + Math.random() * 380);
      sim.tills[b.id] = 0; p.cash += take;
      commitCrime(sim, p, "armed_robbery", null);
      p.wanted = Math.max(p.wanted, 3);
      this.focus("Hold-up", `${b.name} · ${fmtCash(take)} from the till · RUN`, 3);
      return;
    }
    if (door && !door.studio && !armed) { this.toast("You'd need something scarier in your hand to rob a till", "red"); return; }
    const id = this.nearestPerson(1.4);
    if (id < 0) { this.toast("Nobody close enough to rob"); return; }
    const v = sim.chars[id];
    const behind = Math.cos(Math.atan2(p.y - v.y, p.x - v.x) - v.facing) < -0.2; // you're behind their back
    const distracted = v.talkWith >= 0 || v.anim.pose === "phone" || v.goal?.id === "eat" || v.goal?.id === "shop";
    const notice = Math.max(0.05, Math.min(0.95, 0.55 - (behind ? 0.3 : 0) - (distracted ? 0.2 : 0) + v.emo.fear * 0.3 + v.pers.curiosity * 0.2));
    if (Math.random() < notice) {
      this.sim.say(v, "Oi! Hands off!", "shout", 1.6);
      const r = sim.relate(v, p.id); r.grudge = Math.min(1, r.grudge + 0.5); r.trust = Math.max(-1, r.trust - 0.5);
      commitCrime(sim, p, "pickpocket", v);
      this.toast(`${v.name.split(" ")[0]} caught you${behind ? "" : " (try from behind)"}`, "red");
      return;
    }
    const loot = carried(v).map((tid) => sim.toys[tid]).find((t) => t && ["phone", "watch", "chain", "headphones", "camera"].includes(t.def));
    if (loot && Math.random() < 0.5) { detach(v, loot.id); loot.holder = p.id; loot.state = "held"; p.bag.push(loot.id); this.toast(`Lifted ${v.name.split(" ")[0]}'s ${TOYS[loot.def].name} · pawn it for cash`, "acid"); }
    else { const take = Math.min(v.cash, 15 + Math.round(Math.random() * 70)); v.cash -= take; p.cash += take; this.toast(take ? `Lifted ${fmtCash(take)} clean` : "Empty pockets", take ? "acid" : ""); }
    // a clean lift can still be seen by someone else
    if (Math.random() < 0.35) commitCrime(sim, p, "pickpocket", v);
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
        // the swing always shows, even empty-handed (air swing); it only hits something when you hold a melee item
        p.facing = Math.atan2(cursor.y - p.y, cursor.x - p.x);
        // empty-handed, the swing key throws one of the 20 punches at random; holding a melee item swings it
        p.anim.pose = p.hand >= 0 && isMelee(sim.toys[p.hand].def) ? "swing" : `punch${Math.floor(Math.random() * 20)}`;
        p.anim.poseT = 0.3;
        if (p.hand >= 0 && isMelee(sim.toys[p.hand].def)) sim.swingHeld(p);
        else if (p.hand >= 0 && canThrow(sim.toys[p.hand].def)) this.act("throw");
        else { sim.punchHeld(p); const t = this.nearestToy(1.2); if (t) sim.kickToy(p, t, cursor.x, cursor.y); }
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
    // clicking someone zooms in on them: the camera follows them and they stand out on top
    const cam = this.renderer.cam;
    if (id >= 0 && id !== this.sim.playerId) { cam.follow = id; cam.setZoom(Math.max(cam.targetZoom, 5)); }
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
      if (key === "escape") { if (this.modal.open) this.modal.close(); else if (this.terrance.open) this.terrance.close(); else if (this.dialogue.open) this.dialogue.close(); else { this.select(-1); this.dev.toggle(false); this.log.toggle(false); } return; }
      if (this.modal.open) return;
      if (this.terrance.open && /^[1-9]$/.test(key)) { if (this.terrance.key(+key)) e.preventDefault(); return; }
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
      else if (key === "j") { this.settings.sfx = !this.settings.sfx; this.applySettings(); this.persistSettings(); this.toast(this.settings.sfx ? "World sounds on (J)" : "World sounds off (J). N still mutes the music", ""); }
      else if (key === k.dev || key === "~") this.dev.toggle();
      else if (key === "c") { this.renderer.cam.follow = this.sim.playerId; }
      else if (key === "o") this.photos.open();
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
      else if (!door) {
        const lit = this.nearestLitter(), bin = lit ? null : this.nearestBin();
        if (lit) parts.push(kb(k.pickup), " pick up ", h("b", { text: LITTER[lit.kind].name }), " · ");
        else if (bin) parts.push(kb(k.pickup), " rummage ", h("b", { text: "the bin" }), " · ");
      }
    }
    if (scrapCount(p) > 0) parts.push("Sack ", h("b", { text: `${scrapCount(p)} (${fmtCash(scrapValue(p))})` }), " · ");
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
        if (e.type in MOMENTS && (e.type !== "crime" || e.actors[0] === p.id)) this.photos.moment(e.type, street, on ? on.name.split(" ")[0] : "");
      }
    });
  }

  // ------------------------------------------------------------------ story contacts
  /**
   * Each contact has a chain of jobs. Talk to them for the next one; one job runs at a time. Stops are
   * "b:<building kind>" (nearest door) or "a:<area name>". The chains cross over: the Don wants the
   * Night Kiwi gone, Dr Quakenstein wants the Don's casino, Sir P bankrolls everyone, Mike moves the goods.
   */
  private story: Record<string, { ch: number }> = {};
  private job: { who: string; step: number; until: number } | null = null;
  private static STORY: Record<string, { title: string; brief: string; stops: [string, string][]; pay: number; heat?: number; secs?: number }[]> = {
    "Vito Tessera": [
      { title: "The Famiglia 1 · Pies for the Don", brief: "Take this box to Moorhouse Fuel. Don't open it. It's pies.", stops: [["b:garage", "Drop the box at Moorhouse Fuel"]], pay: 200 },
      { title: "The Famiglia 2 · The Tomato Fund", brief: "Visit our friends. They 'donate' to my tomato garden.", stops: [["b:dairy", "Collect from the dairy"], ["b:pizza", "Collect from the pizza shop"], ["b:sushi", "Collect from the sushi bar"]], pay: 500 },
      { title: "The Famiglia 3 · Moon Sherbet", brief: "SALT District has a parcel of Moon Sherbet. Casino. Ninety seconds.", stops: [["a:SALT District", "Pick up the Moon Sherbet"], ["b:casino", "Bring it to the Tessera, fast"]], pay: 1200, heat: 1, secs: 90 },
      { title: "The Famiglia 4 · The Riccarton Boys", brief: "They're selling hubcaps on my street. Go to the car yards. Make an impression.", stops: [["b:dealership", "Make an impression at the car yards"]], pay: 2500, heat: 2 },
      { title: "The Famiglia 5 · Made", brief: "Come back to the Tessera. Family dinner. Wear something nice.", stops: [["b:casino", "Family dinner at the Tessera"]], pay: 10000 },
    ],
    "Mike Dodd": [
      { title: "Mannequin Mike 1 · Leg Day", brief: "Forty mannequin legs at the airport. Riverside Market. Two minutes. Don't ask.", stops: [["b:airport", "Collect the legs at the airport"], ["a:Riverside Market", "Deliver to Riverside Market"]], pay: 600, secs: 120 },
      { title: "Mannequin Mike 2 · Gnome Run", brief: "The Botanic Gardens gnomes are 'retiring'. To the Tuam Laneways.", stops: [["a:Botanic Gardens", "Load the gnomes"], ["a:Tuam Laneways", "Drop them in the laneways"]], pay: 900, heat: 1 },
    ],
    "Sir Ponsonby Velvet": [
      { title: "Velvet 1 · Kevin's Escape", brief: "Kevin the giraffe has left the zoo. Last seen in Hagley Park North. Bring him home.", stops: [["a:Hagley Park North", "Find Kevin in Hagley Park"], ["a:Velvet Zoo", "Walk Kevin back to the zoo"]], pay: 1500 },
      { title: "Velvet 2 · The VELVET Cover", brief: "Book MosaicScope for my cover shoot, darling. Studio first, then the Hotel on Worcester.", stops: [["b:studio", "Book the shoot at MosaicScope Studio"], ["b:hotel", "Bring the crew to the hotel set"]], pay: 2000 },
      { title: "Velvet 3 · A Whale Too Far", brief: "My whale arrives at the airport. It doesn't fit anywhere. Find it a pool. Victoria Square will do.", stops: [["b:airport", "Meet the whale at the airport"], ["a:Victoria Square", "Release it into the Avon (temporarily)"]], pay: 5000, secs: 150 },
    ],
    "Bryce Wainui": [
      { title: "Night Kiwi 1 · The Kiwi-signal", brief: "*gravelly* Someone's lit the Kiwi-signal over Cathedral Square. Go. I'll... meet you there.", stops: [["a:Cathedral Square", "Answer the Kiwi-signal"]], pay: 300 },
      { title: "Night Kiwi 2 · The Cone Bandit", brief: "Someone's stealing road cones. The trail leads to the SALT District, then the station.", stops: [["a:SALT District", "Catch the cone bandit"], ["b:police", "Hand them in at the station"]], pay: 800 },
      { title: "Night Kiwi 3 · Secret Identity", brief: "My suit is at the dry cleaner's at the Arts Centre. Nobody can know. Bring it to Latimer Square.", stops: [["a:Arts Centre", "Collect the suit (discreetly)"], ["a:Latimer Square", "Deliver it to the Night Kiwi"]], pay: 1200, secs: 100 },
    ],
    "Hamish Quake": [
      { title: "Dr Quakenstein 1 · Freeze the Avon", brief: "MWAHAHA. Fetch ice from a dairy. Victoria Square. The Avon will FREEZE. (Bring a lot of ice.)", stops: [["b:dairy", "Buy every bag of ice"], ["a:Victoria Square", "Dump it in the Avon"]], pay: 400 },
      { title: "Dr Quakenstein 2 · The Spire Heist", brief: "The Cathedral spire! To my lair under the Arts Centre! Do not let the Night Kiwi see you.", stops: [["a:Cathedral Square", "'Borrow' the spire"], ["a:Arts Centre", "Into the lair"]], pay: 1500, heat: 2 },
      { title: "Dr Quakenstein 3 · The Cone Ransom", brief: "Every road cone in High St. Then we hold the Don's casino to ransom. Christchurch will KNEEL.", stops: [["a:High St", "Collect the cones"], ["b:casino", "Deliver the ransom note to the Don"]], pay: 3000, heat: 1 },
    ],
    "Robyn Kea": [
      { title: "Zoo 1 · Feeding Time", brief: "Kevin only eats fish and chips from Sumner-style shops. Grab a bag and bring it to the zoo. Don't ask.", stops: [["b:fishchips", "Buy fish and chips"], ["a:Velvet Zoo", "Feed Kevin"]], pay: 700 },
      { title: "Zoo 2 · Kea Heist", brief: "The kea stole four wiper blades and hid them at the car yards. Get them back before Sir P notices.", stops: [["b:dealership", "Find the stolen wiper blades"], ["a:Velvet Zoo", "Return them (to the kea's disappointment)"]], pay: 1100, secs: 120 },
      { title: "Zoo 3 · Whale Watch", brief: "The whale needs company. Sir P's idea: bring the Night Kiwi to cheer it up. Meet him in Victoria Square first.", stops: [["a:Victoria Square", "Find the Night Kiwi"], ["a:Velvet Zoo", "Introduce him to the whale"]], pay: 1800 },
    ],
    "Pete Gumboots": [
      { title: "Gumboots 1 · Penguin Break", brief: "Three penguins waddled off towards Cathedral Square. They're easy to spot. They're wearing nothing.", stops: [["a:Cathedral Square", "Round up the penguins"], ["a:Velvet Zoo", "Waddle them home"]], pay: 800, secs: 100 },
      { title: "Gumboots 2 · Peacock Politics", brief: "The peacocks have unionised and are bullying the butler. Take this bribe of pies to the Arts Centre hall, then talk terms.", stops: [["b:bakery", "Buy the pies"], ["a:Velvet Zoo", "Negotiate with the peacocks"]], pay: 1400 },
    ],
    "Roastie Malone": [
      { title: "Roastie 1 · Open Mic", brief: "Town Hall open mic tonight. You, me, a mic, and the entire Famiglia in the front row. Show up.", stops: [["a:Town Hall", "Play the Town Hall open mic"]], pay: 700 },
    ],
  };
  private stopTarget(spec: string, label: string): { x: number; y: number; label: string } | null {
    const w = this.sim.world, p = this.sim.player;
    if (spec.startsWith("b:")) {
      const b = w.buildings.filter((x) => x.kind === spec.slice(2)).sort((a, c) => Math.hypot(a.door.x - p.x, a.door.y - p.y) - Math.hypot(c.door.x - p.x, c.door.y - p.y))[0];
      return b ? { x: b.door.x + 0.5, y: b.door.y + 0.5, label } : null;
    }
    const a = w.areas.find((x) => x.name === spec.slice(2));
    return a ? { x: a.cx, y: a.cy, label } : null;
  }
  private currentJob() { return this.job ? Game.STORY[this.job.who]?.[this.story[this.job.who]?.ch ?? 0] ?? null : null; }
  private storyTarget(): { x: number; y: number; label: string } | null {
    const job = this.currentJob();
    if (!job || !this.job) return null;
    const st = job.stops[this.job.step - 1];
    return st ? this.stopTarget(st[0], st[1]) : null;
  }
  /** A story contact? (they get a marker in the world and on the radar) */
  isContact(c: { name: string }): boolean { return !!Game.STORY[c.name]; }
  hasJob(c: { name: string }): boolean { const ch = this.story[c.name]?.ch ?? 0; return !!Game.STORY[c.name]?.[ch]; }
  private talkToContact(name: string): void {
    const chain = Game.STORY[name], st = (this.story[name] ??= { ch: 0 }), job = chain[st.ch], first = name.split(" ")[0];
    if (!job) { this.focus(first, "\"Nothing for you right now. Legend.\"", 3); return; }
    if (this.job && this.job.who !== name) { this.focus(first, "\"Finish what you're doing first.\"", 3); return; }
    if (this.job) { this.focus(first, `"${this.storyTarget()?.label ?? "Get it done"}."`, 3); return; }
    this.job = { who: name, step: 1, until: job.secs ? performance.now() + job.secs * 1000 : 0 };
    this.focus(job.title, `"${job.brief}"`, 5);
  }
  private tickStory(now: number): void {
    this.tickContract();
    const job = this.currentJob(), ct = this.contract ? this.sim.chars[this.contract.target] : null;
    const t = this.storyTarget() ?? (ct ? { x: ct.x, y: ct.y, label: "contract" } : null);
    this.minimap.target = t;
    const live = this.sim.chars.filter((c) => this.isContact(c) && this.hasJob(c) && c.inside < 0);
    this.minimap.contacts = live.map((c) => ({ x: c.x, y: c.y }));
    this.renderer.markers = new Set(live.map((c) => c.id));
    if (!job || !t || !this.job) return;
    const p = this.sim.player, px = p.inCar >= 0 ? this.sim.vehicles[p.inCar].x : p.x, py = p.inCar >= 0 ? this.sim.vehicles[p.inCar].y : p.y;
    if (this.job.until && now > this.job.until) { this.job = null; this.focus("Too slow", "Talk to them again to retry.", 3); return; }
    if (Math.hypot(px - t.x, py - t.y) > 2.6) return;
    if (this.job.step < job.stops.length) { this.job.step++; this.toast(`✓ ${t.label}`, "acid"); return; }
    p.cash += job.pay; if (job.heat) p.wanted = Math.max(p.wanted, job.heat);
    this.story[this.job.who].ch++; this.job = null;
    this.statsMissions++;
    this.focus(job.title.split(" · ")[1] + " · done", `+${fmtCash(job.pay)}${job.heat ? ` · the cops noticed (${job.heat}★)` : ""}`, 4);
  }
  // ------------------------------------------------------------------ contracts (the target is gone for good)
  private contract: { target: number; pay: number; from: string } | null = null;
  private offerContract(from: { name: string }): void {
    const sim = this.sim, first = from.name.split(" ")[0];
    if (this.contract) { const t = sim.chars[this.contract.target]; this.focus(first, `"${t ? t.name : "They"} is still walking around. Fix that."`, 3); return; }
    const pool = sim.chars.filter((c) => c.tier === "mid" && c.role !== "mobster" && c.role !== "cop" && c.inside < 0 && c.inCar < 0 && !this.isContact(c));
    const t = pool[Math.floor(Math.random() * pool.length)];
    if (!t) return;
    const pay = 400 + Math.round(Math.random() * 1200);
    const why = ["owes the Don money", "put pineapple on the Don's pizza", "parked in the Don's spot", "called the tomatoes 'just okay'", "dated Gina and didn't call", "sold the Famiglia a dodgy hubcap"][Math.floor(Math.random() * 6)];
    this.contract = { target: t.id, pay, from: first };
    this.focus("Contract", `${t.name} ${why}. Whack them: ${fmtCash(pay)}.`, 4.5);
  }
  private tickContract(): void {
    const c = this.contract;
    if (!c) return;
    const t = this.sim.chars[c.target];
    if (!t) { this.contract = null; return; }
    if (t.phys === Phys.DOWN) {
      const sim = this.sim;
      sim.player.cash += c.pay; sim.player.wanted = Math.max(sim.player.wanted, 3);
      // whacked: a last cartoon burst, then they're gone from the city for good
      sim.bus.emit("fx", { kind: "blood", x: t.x, y: t.y, z: 0.6, n: 60, color: "#b3121b" });
      sim.bus.emit("fx", { kind: "gib", x: t.x, y: t.y, z: 1, n: 12 });
      sim.bus.emit("fx", { kind: "text", x: t.x, y: t.y, z: 2.2, n: 1, color: "#eee4d3", text: "💀 RIP" });
      if (t.talkWith >= 0) sim.dialogue.end(t);
      t.goal = null; t.path = null; t.vx = t.vy = 0; t.partner = -1;
      const morgue = sim.world.buildings.find((b) => b.kind === "hospital");
      t.inside = morgue ? morgue.id : 0; t.insideUntil = Number.MAX_SAFE_INTEGER; t.bubble = null;
      for (const o of sim.chars) if (o.partner === t.id) o.partner = -1;
      this.focus("Whacked", `RIP ${t.name}. ${c.from} paid ${fmtCash(c.pay)}. The cops want a word (3★).`, 4);
      this.toast(`📰 Press: ${t.name} found dead on ${sim.world.streetName(t.x, t.y) || "a city street"}. Police appeal for witnesses.`, "red");
      this.contract = null;
    }
  }

  objective(): string {
    if (this.contract && !this.job) { const t = this.sim.chars[this.contract.target]; return t ? `🎯 Whack ${t.name}` : ""; }
    const t = this.storyTarget();
    if (!t || !this.job) return "";
    const left = this.job.until ? Math.max(0, Math.ceil((this.job.until - performance.now()) / 1000)) : 0;
    return `★ ${t.label}${left ? ` · ${left}s` : ""}`;
  }

  /** Open a conversation with the camera on the two of you. */
  private openTalk(id: number): void {
    const don = this.sim.chars[id];
    if (don && this.isContact(don) && (this.hasJob(don) || this.job?.who === don.name) && !(don.role === "comic" && !this.job && (this.story[don.name]?.ch ?? 0) > 0)) { this.talkToContact(don.name); return; }
    if (don && don.role === "overcoder") { this.terrance.start(id); return; } // Terrance: latest changes and team drama
    if (don && don.role === "comic") { this.roast?.start(); return; } // Roastie Malone: roast battle
    if (don && don.role === "mogul") { this.luxury.show(); return; } // Sir P shows you his catalogue
    if (don && don.role === "smuggler" && !this.isContact(don)) { this.blackMarket(don.name.split(" ")[0]); return; }
    if (don && don.role === "mobster" && !this.isContact(don)) { this.offerContract(don); return; }
    this.dialogue.start(id);
    const c = this.sim.chars[id];
    if (!c || !this.dialogue.open) return;
    const r = this.sim.player.rel.get(id), close = (r?.aff ?? 0) > 0.35, first = c.name.split(" ")[0];
    const label = this.sim.player.partner === id ? "Your person" : close ? (c.look.kind === "girl" ? "Your homegirl" : "Your homie") : c.tier === "principal" ? "One of the Mosaics" : ROLE_LABEL[c.role] ? `The ${ROLE_LABEL[c.role]}` : "";
    this.focus(c.nickname ? `${first} "${c.nickname}"` : first, label, 0, true);
  }

  // ------------------------------------------------------------------ luxury & the zoo
  private luxury = new Luxury({ getCash: () => this.sim.player.cash, setCash: (v) => { this.sim.player.cash = v; this.saveEmpire(); }, toast: (t) => this.toast(t, "acid") });
  private roast?: RoastBattle;
  private burger?: BurgerShift;
  private heist?: HeistUI;
  /** Minigame and heist code is a separate chunk; it arrives shortly after first paint, then the buttons work. */
  private loadMinigames(): void {
    void Promise.all([import("../ui/minigames/Roast"), import("../ui/minigames/Burger"), import("../ui/Heist")])
      .then(([rm, bm, hm]) => {
        this.roast = new rm.RoastBattle((r) => { if (r.won) { this.sim.player.cash += 150; this.focus("You won the roast", `Crowd ${Math.round(r.crowd)}% · +$150 · Roastie respects you now`, 3.5); } else this.focus("Roasted", "Roastie Malone wins this one. Run it back.", 3); });
        this.burger = new bm.BurgerShift((r) => { this.sim.player.cash += r.pay; this.toast(`Shift done: ${r.orders} orders, ${r.perfect} perfect. Paid ${fmtCash(r.pay)}`, "acid"); this.focus("Shift over", `Lyttelton Diner paid you ${fmtCash(r.pay)}`, 3); });
        this.heist = new hm.HeistUI(this.modal);
        this.rootEl.append(this.roast.el, this.burger.el);
      })
      .catch((err) => console.warn("Minigames failed to load", err));
  }
  private saveEmpire(): void { try { localStorage.setItem("mosaics-world:empire", JSON.stringify(this.luxury.empire)); } catch { /* private mode */ } }
  private loadEmpire(): void { try { const e = JSON.parse(localStorage.getItem("mosaics-world:empire") ?? "null"); if (e && Array.isArray(e.items)) this.luxury.load(e); } catch { /* ignore */ } }

  // ------------------------------------------------------------------ black market (Dodge sells guns out of a boot)
  private blackMarket(who: string): void {
    const sim = this.sim, p = sim.player;
    const rows = BLACK_MARKET.map((id) => {
      const d = TOYS[id];
      return h("li.item", null, [h("div", null, [h("b", { text: d.name }), h("small", { text: d.blurb ?? "" })]), h("span.price", { text: fmtCash(d.value) }),
        h("button.btn", { disabled: p.cash < d.value, onclick: () => { if (p.cash < d.value) return; p.cash -= d.value; const t = sim.spawnToy(id, p.x, p.y); if (t) sim.pickupToy(p, t); this.toast(`${who}: "Never saw you."`, "acid"); this.modal.close(); }, text: "Buy" })]);
    });
    this.modal.show(`${who}'s boot`, [h("p", { text: `"Cash only. No refunds. If anyone asks, you bought a hubcap."` }), h("ul.items", null, rows)]);
  }

  // ------------------------------------------------------------------ the clubs
  private owned = new Set<string>((() => { try { return JSON.parse(localStorage.getItem("mosaics-world:owned") ?? "[]") as string[]; } catch { return []; } })());
  private club = new Club({
    getCash: () => this.sim.player.cash, setCash: (v) => { this.sim.player.cash = v; }, toast: (t) => this.toast(t, "acid"),
    playerName: () => "you", owned: (k) => this.owned.has(k),
    setOwned: (k, v) => { if (v) this.owned.add(k); else this.owned.delete(k); try { localStorage.setItem("mosaics-world:owned", JSON.stringify([...this.owned])); } catch { /* private mode */ } },
  });
  private clubTickAt = 0;

  // ------------------------------------------------------------------ touch controls
  private touchMove = { x: 0, y: 0 }; private touchBrake = false;
  private touch = new TouchControls({
    move: (x, y) => { this.touchMove.x = x; this.touchMove.y = y; },
    brake: (held: boolean) => { this.touchBrake = held; },
    zoom: (dir: number) => { const c = this.renderer.cam; c.setZoom(c.targetZoom * (dir > 0 ? 1.4 : 1 / 1.4)); },
    inCar: () => this.sim.player.inCar >= 0,
    action: (n) => {
      const sim = this.sim, p = sim.player;
      if (n === "use") this.interact();
      else if (n === "talk") { const id = this.nearestPerson(3); if (id >= 0) this.openTalk(id); else this.toast("Nobody close enough to talk to"); }
      else if (n === "throw") this.throwAtSelected();
      else if (n === "swing") this.act("swing");
      else if (n === "rob") this.rob();
      else if (n === "bandage") this.bandage();
      else if (n === "horn") sim.bus.emit("sound", { kind: "horn", x: p.x, y: p.y, vol: 0.8 });
      else if (n === "map") this.minimap.toggle();
      else if (n === "pickup") this.act("pickup");
      else if (n === "drop") this.act("drop");
      else if (n === "sprint") { p.speed = Math.min(3, p.speed * 1.35); setTimeout(() => { p.speed = Math.max(1.6, p.speed / 1.35); }, 2500); }
    },
    context: () => {
      const sim = this.sim, p = sim.player;
      if (p.inCar >= 0) return { label: "Get out", icon: "exit" };
      const d = this.nearDoor(); if (d) return { label: d.studio ? "Enter Studio" : `Enter ${sim.world.buildings[d.building].name}`, icon: "use" };
      if (this.nearestToy()) return { label: "Pick up", icon: "pickup" };
      if (this.nearestLitter()) return { label: "Pick up litter", icon: "use" };
      if (this.nearestBin()) return { label: "Rummage bin", icon: "use" };
      const id = this.nearestPerson(1.8); if (id >= 0) return { label: `Talk to ${sim.chars[id].name.split(" ")[0]}`, icon: "talk" };
      return null;
    },
  });

  // ------------------------------------------------------------------ life goes on while you're away
  /**
   * The world remembers when you last played. Stay away and there are consequences: you lose weight
   * and the fridge is empty, rent and bills come out of your cash, the crew misses you (and Tiles is
   * a little hurt), and the city has moved on a bit. Real elapsed time counts (capped at 30 days).
   */
  private applyAbsence(): void {
    let last = 0;
    try { last = +(localStorage.getItem("mosaics-world:last") ?? 0); } catch { /* private mode */ }
    const mark = () => { try { localStorage.setItem("mosaics-world:last", String(Date.now())); } catch { /* ignore */ } };
    mark(); addEventListener("pagehide", mark); setInterval(mark, 30000);
    if (!last) return;
    const hours = (Date.now() - last) / 3600000;
    if (hours < 6) return;
    const days = Math.min(30, hours / 24), sim = this.sim, p = sim.player;
    const notes: string[] = [];
    if (days >= 0.25) { p.hunger = Math.min(p.hunger, Math.max(0.12, 0.6 - days * 0.12)); notes.push("you're starving"); }
    if (days >= 1.5) { const k = Math.max(0.7, 1 - days * 0.025); p.look.build = Math.min(p.look.build ?? 1, k); notes.push(k < 0.85 ? "you've gone skinny" : "you've lost a bit of weight"); }
    // unpaid rent becomes arrears (capped, with interest) kept in localStorage, and the collector takes a share of what you hold
    let owed = 0;
    try { owed = +(localStorage.getItem("mosaics-world:arrears") ?? 0) || 0; } catch { /* private mode */ }
    const bill = billAbsence(days, p.cash, owed);
    if (bill.paid >= 5) { p.cash -= bill.paid; notes.push(`rent and bills took ${fmtCash(bill.paid)}`); }
    const visit = collect(p.cash, bill.arrears);
    if (visit.taken >= 5) { p.cash -= visit.taken; notes.push(`the landlord's nephew collected ${fmtCash(visit.taken)} of back rent`); }
    if (visit.left >= 5) notes.push(`you still owe ${fmtCash(visit.left)} in arrears`);
    try { localStorage.setItem("mosaics-world:arrears", String(visit.left)); } catch { /* ignore */ }
    const crew = sim.chars.filter((c) => c.tier === "principal" && c.name !== "Chris");
    if (days >= 1) for (const c of crew) { const r = sim.relate(c, p.id); r.aff = Math.min(1, r.aff + 0.05); r.fam = Math.min(1, r.fam + 0.05); }
    const tiles = crew.find((c) => c.name === "Tiles"), glitter = crew.find((c) => c.name === "Glitter");
    const miss = days < 3 ? "The crew says you were quiet." : days < 10 ? `Glitter: "${days.toFixed(0)} days?! We thought you'd moved to Auckland."` : "Tiles: \"Thought you were gone for good, bro.\"";
    if (tiles && glitter && days >= 3) { sim.say(glitter, days < 10 ? "There you are! We missed you!" : "Where have you BEEN?!", "shout", 4); }
    const when = days < 1 ? `${Math.round(hours)} hours` : `${days.toFixed(days < 3 ? 1 : 0)} days`;
    setTimeout(() => this.focus("Welcome back", `Gone ${when}: ${notes.join(", ") || "the city carried on"}. ${miss}`, 6), 1500);
  }

  // ------------------------------------------------------------------ anonymous play-time stats
  /** One beacon when the visitor leaves: seconds played, whether they've been before, missions, casino. */
  private statsStart = performance.now(); private statsSent = false; statsMissions = 0; statsCasino = 0;
  private bindStats(): void {
    let returning = false;
    try { const k = "mosaics-world:visits", v = +(localStorage.getItem(k) ?? 0); returning = v > 0; localStorage.setItem(k, String(v + 1)); } catch { /* private mode */ }
    const send = () => {
      if (this.statsSent) return;
      this.statsSent = true;
      const body = JSON.stringify({ seconds: Math.round((performance.now() - this.statsStart) / 1000), returning, missions: this.statsMissions, casino: this.statsCasino, mobile: matchMedia("(pointer: coarse)").matches });
      try { navigator.sendBeacon?.("/api/world-stats", new Blob([body], { type: "application/json" })); } catch { /* offline */ }
    };
    addEventListener("pagehide", send);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") send(); else { this.statsSent = false; } });
  }

  // ------------------------------------------------------------------ focus mode
  private minimap = new Minimap(() => this.sim);
  private travel = new Travel({
    getCash: () => this.sim.player.cash, setCash: (v) => { this.sim.player.cash = v; },
    companions: () => this.sim.chars.filter((c) => c.tier === "principal" && c.name !== "Chris").map((c) => ({ name: c.name, color: c.look.color })),
    carried: () => carried(this.sim.player).map((id) => this.sim.toys[id]).filter(Boolean).map((t) => ({ id: t.id, name: TOYS[t.def].name, category: TOYS[t.def].category ?? "toy" })),
    confiscate: (ids) => { const p = this.sim.player; for (const id of ids) { const t = this.sim.toys[id]; if (!t) continue; detach(p, id); t.state = "broken"; t.x = -100; t.holder = -1; } },
    onReturn: (summary, souvenirs, photos) => {
      this.toast(summary, "acid"); this.focus("Home", "Welcome back to Christchurch", 3);
      // the trip goes in the Empire tab as a travel log entry
      const when = new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
      this.luxury.empire.items.push(`✈ ${when}: ${summary}${souvenirs.length ? ` · souvenirs: ${souvenirs.join(", ")}` : ""}${photos ? ` · ${photos} photos for @mosaicscope` : ""}`);
      this.saveEmpire();
    },
    toast: (t) => this.toast(t),
  });
  private focusEl = h("div.focus", { "aria-hidden": "true" }, [h("div.focus-bar.top"), h("div.focus-bar.bot"), h("div.focus-cap", null, [h("b"), h("span")])]);
  private focusUntil = 0; private focusZoom = 0; private focusHeld = false;
  /** Letterbox, vignette, push in on the player, caption. `secs` <= 0 holds until unfocus(). */
  focus(title: string, sub = "", secs = 3.5, talk = false): void {
    const cam = this.renderer.cam;
    if (!this.focusEl.classList.contains("on")) this.focusZoom = cam.targetZoom;
    // a gentler push-in on phones (the screen is already small), never past street-view territory
    const coarse = matchMedia("(pointer: coarse)").matches;
    cam.setZoom(coarse ? Math.min(Math.max(this.focusZoom, 1.8), 2.2) : Math.max(this.focusZoom, 2.2));
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
      h("button.btn.menu-toggle", { "aria-label": "Menu", "aria-expanded": "false", text: "☰", onclick: (e: Event) => { const bar = (e.currentTarget as HTMLElement).closest(".bar")!; const on = bar.classList.toggle("open"); (e.currentTarget as HTMLElement).setAttribute("aria-expanded", String(on)); try { navigator.vibrate?.(8); } catch { /* ignore */ } } }),
      h("a.brand", { href: "/", title: "Back to MosaicScope" }, [h("b", { text: "The Mosaics" }), h("i", { text: "our world" })]),
      this.clockEl, h("div.spacer"),
      h("div.seg", { role: "group", "aria-label": "Simulation speed" }, this.speedEls),
      this.soundBtn,
      h("button.btn", { onclick: () => this.luxury.show(), text: "Luxury", title: "Velvet & Co. Luxury: property, rides, animals" }),
      h("button.btn", { onclick: () => this.heist?.open(), text: "Heist", title: "Velvet Heist Night: the crew's three-act mission" }),
      h("button.btn", { onclick: () => this.photos.open(), text: "Photo", title: "Photo mode (O)" }),
      h("button.btn", { onclick: () => { void import("../ui/VisitorNotes").then((m) => m.openVisitorNotes(this.modal)); }, text: "Notes", title: "Visitor notes: leave a note for the next visitor" }),      h("button.btn", { onclick: () => this.log.toggle(), text: "Log" }),
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
    this.audio.setSfx(s.sfx, s.sfxVolume);
    if (this.gestured && s.sound !== this.audio.enabled) this.audio.setEnabled(s.sound);
    this.soundBtn.textContent = s.sound ? "🔊" : "🔇";
    this.soundBtn.classList.toggle("on", s.sound);
    setImpactIntensity(s.gentle ? 0.55 : 1);
    const q = s.quality === "low" ? 0 : s.quality === "medium" ? 1 : s.quality === "high" ? 2 : s.quality === "ultra" ? 3 : this.quality;
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
        h("button.btn", { disabled: !info, onclick: () => this.exportSave(s, msg), text: "Export" }),
        h("button.btn", { onclick: () => this.importSave(s, msg, render), text: "Import" }),
      ]);
    }));
    render();
    this.modal.show("Save & load", [h("p", { style: { color: "var(--dim)" }, text: "Saves live in this browser only (local storage). They keep everyone's memories, friendships, grudges and toys." }), body, msg]);
  }

  /** Download a slot's save as a .json file. */
  private exportSave(slot: string, msg: HTMLElement): void {
    const raw = this.saves.raw(slot);
    if (!raw) { msg.textContent = "There is no save in that slot."; msg.className = "err"; return; }
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `mosaics-save-${slot}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    msg.textContent = `Exported slot ${slot}.`; msg.className = "";
  }

  /** Load a .json save file into a slot, after checking it is a valid save. */
  private importSave(slot: string, msg: HTMLElement, done: () => void): void {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      file.text().then((t) => {
        try { this.saves.importRaw(slot, t); msg.textContent = `Imported into slot ${slot}.`; msg.className = ""; done(); }
        catch (e) { msg.textContent = `Couldn't import: ${(e as Error).message}`; msg.className = "err"; }
      });
    };
    input.click();
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
    const sim = new Simulation({ seed: seed ?? this.sim.cfg.seed, backgroundCount: Math.min(this.settings.density, 300) });
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
    const touchUI = TouchControls.wanted();
    const steps: [string, string][] = [
      ["Welcome to <i>our world</i>", "You're the stranger in white and red. Tiles, Glitter and the rest of the Mosaics live here with a few hundred locals. Nothing is scripted."],
      ["Move & look", touchUI ? "Tap the ground to walk there. Use + and \u2212 (or pinch) to zoom. Tap anyone to see what they're feeling, what they remember and who they can't stand." : "WASD or arrow keys to walk, or click the ground. Drag to pan, scroll or pinch to zoom. Click anyone to see what they're feeling, what they remember and who they can't stand."],
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
    // on a phone the tutorial floats at the top and lets taps through, so the joystick works under it
    this.modal.el.classList.toggle("touch-tut", touchUI);
  }
}
