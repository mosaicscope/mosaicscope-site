import "./mobile.css";

/**
 * Mobile controls: a floating analog stick on the left, a thumb cluster on the right.
 * On foot: big context button + Throw / Swing / Talk / Rob / More (sheet: Pick up, Drop, Bandage, Horn, Map).
 * In a car: Gas / Brake / Horn / Exit (+ More), and the stick steers.
 */
export type TouchAction = "use" | "talk" | "throw" | "swing" | "rob" | "bandage" | "horn" | "map" | "view2d" | "pickup" | "drop" | "sprint";

export interface TouchHost {
  /** Analog stick, screen space -1..1 (up = -1). Called every frame while held, (0,0) once on release.
   *  In a car: x = steer, y = throttle (-1 gas, +1 brake/reverse). */
  move(x: number, y: number): void;
  action(name: TouchAction): void;
  /** What the big context button does right now (e.g. "Enter Casino", "Talk to Ruby", "Get in car"). */
  context(): { label: string; icon: string } | null;
  inCar(): boolean;
  /** Optional: Brake button held state in a car (Space on PC). Without it, Brake maps to move y = +1. */
  brake?(held: boolean): void;
  /** Zoom the camera in (+1) or out (-1); used by the on-screen zoom buttons. */
  zoom?(dir: number): void;
}

/** The joystick captures its own zone; the rest of the city keeps tap-to-walk and pinch gestures. */
const STICK_ON = true;

const SVG = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS: Record<string, string> = {
  throw: SVG('<path d="M5 19 19 5"/><path d="M10 5h9v9"/>'),
  swing: SVG('<path d="M4 20 15 9"/><path d="M13 4a8 8 0 0 1 7 7"/><path d="M6 14l4 4"/>'),
  talk: SVG('<path d="M4 5h16v10H9l-5 4z"/>'),
  rob: SVG('<path d="M7 11V6a2 2 0 0 1 4 0v4"/><path d="M11 10V5a2 2 0 0 1 4 0v6"/><path d="M15 9a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a2 2 0 0 1 3-2l2 2"/>'),
  more: SVG('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  gas: SVG('<path d="M12 4v16"/><path d="m5 11 7-7 7 7"/>'),
  brake: SVG('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  horn: SVG('<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/>'),
  exit: SVG('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>'),
  pickup: SVG('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  drop: SVG('<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>'),
  bandage: SVG('<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M11 11h.01M13 13h.01M11 13h.01M13 11h.01"/>'),
  map: SVG('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  view2d: SVG('<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
  use: SVG('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
};

const buzz = (ms: number | number[]): void => {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* unsupported */ }
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const DEADZONE = 0.14, SPRINT_ON = 0.94, SPRINT_OFF = 0.8;

export class TouchControls {
  el: HTMLElement;
  private host: TouchHost;
  private zone: HTMLElement; private base: HTMLElement; private knob: HTMLElement;
  private ctxBtn: HTMLButtonElement; private ctxIcon: HTMLElement; private ctxLabel: HTMLElement;
  private exitLabel: HTMLElement;
  private sheet: HTMLElement;
  // stick state
  private stickId = -1; private ox = 0; private oy = 0; private sx = 0; private sy = 0; private sprinting = false; private sentZero = true;
  // car pedals
  private gas = false; private brakeHeld = false;
  private lastCtx = ""; private lastCar: boolean | null = null;

  static wanted(): boolean {
    try {
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      return navigator.maxTouchPoints > 0 && !window.matchMedia("(hover: hover)").matches;
    } catch { return false; }
  }

  constructor(host: TouchHost) {
    this.host = host;
    this.el = el("div", "tc");
    this.el.setAttribute("aria-label", "Touch controls");
    if (TouchControls.wanted()) this.el.classList.add("on");
    // a real finger on the screen turns the controls on (hybrid laptops, desktop-mode browsers)
    window.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && !this.el.classList.contains("on")) this.el.classList.add("on"); }, { capture: true, passive: true });

    // ---- joystick
    this.zone = el("div", "tc-zone");
    this.base = el("div", "tc-base"); this.knob = el("div", "tc-knob");
    this.base.append(this.knob);
    this.zone.append(this.base);
    // the stick starts from a touch anywhere on the left half that isn't a button, so it works wherever the thumb lands
    window.addEventListener("pointerdown", (e) => {
      if (!STICK_ON || e.pointerType !== "touch" || this.stickId >= 0 || e.clientX > innerWidth * 0.5) return;
      const t = e.target;
      if (!(t instanceof Element) || !this.zone.contains(t) || t.closest("button, .tc-btn, .tc-sheet, .tc-cluster, .tc-sheet *")) return;
      if (this.el.classList.contains("hidden") || !this.el.classList.contains("on")) return;
      this.stickDown(e);
    }, { capture: true });
    window.addEventListener("pointermove", (e) => this.stickMove(e), { capture: true, passive: false });
    // Safari fallback: raw touch events drive the same stick, in case Safari drops the pointer events mid-drag
    const asPointer = (t: Touch, target: EventTarget | null): PointerEvent => ({ pointerId: 9000 + t.identifier, clientX: t.clientX, clientY: t.clientY, target, preventDefault: () => {}, stopPropagation: () => {} }) as unknown as PointerEvent;
    window.addEventListener("touchstart", (e) => {
      if (!STICK_ON || this.stickId >= 0 || e.touches.length === 0) return;
      const t = e.changedTouches[0]; if (!t || t.clientX > innerWidth * 0.5) return;
      const target = e.target; if (!(target instanceof Element) || !this.zone.contains(target) || target.closest("button, .tc-btn, .tc-sheet, .tc-cluster")) return;
      if (this.el.classList.contains("hidden") || !this.el.classList.contains("on")) return;
      this.stickDown(asPointer(t, target));
    }, { capture: true, passive: true });
    window.addEventListener("touchmove", (e) => { const t = [...e.changedTouches].find((x) => x.identifier + 9000 === this.stickId); if (t) this.stickMove(asPointer(t, e.target)); }, { capture: true, passive: true });
    window.addEventListener("touchend", (e) => { if ([...e.changedTouches].some((x) => x.identifier + 9000 === this.stickId)) this.stickUp(); }, { capture: true, passive: true });
    window.addEventListener("touchcancel", (e) => { if ([...e.changedTouches].some((x) => x.identifier + 9000 === this.stickId)) this.stickUp(); }, { capture: true, passive: true });
    for (const t of ["pointerup", "pointercancel"] as const) window.addEventListener(t, (e) => { if (e.pointerId === this.stickId) this.stickUp(); }, { capture: true });

    // ---- right cluster
    const cluster = el("div", "tc-cluster");
    this.ctxBtn = el("button", "tc-btn tc-ctx foot");
    this.ctxIcon = el("span", "tc-ico"); this.ctxLabel = el("span", "tc-lbl", "Use");
    this.ctxIcon.innerHTML = ICONS.use;
    this.ctxBtn.append(this.ctxIcon, this.ctxLabel);
    this.ctxBtn.setAttribute("aria-label", "Use");
    this.press(this.ctxBtn, () => { buzz(18); this.host.action("use"); });

    const arc = (b: HTMLElement, deg: number, r = 112) => {
      const a = (deg * Math.PI) / 180;
      b.style.setProperty("--dx", String(Math.round(Math.cos(a) * r)));
      b.style.setProperty("--dy", String(Math.round(-Math.sin(a) * r)));
      return b;
    };
    const small = (cls: string, icon: string, label: string, fn: () => void, hold?: (on: boolean) => void) => {
      const b = el("button", "tc-btn tc-arc " + cls);
      const i = el("span", "tc-ico"); i.innerHTML = ICONS[icon] ?? "";
      b.append(i, el("span", "tc-lbl", label));
      b.setAttribute("aria-label", label);
      this.press(b, fn, hold);
      return b;
    };

    // on foot
    const foot = [
      arc(small("foot t-throw", "throw", "Throw", () => { buzz(14); this.host.action("throw"); }), 192),
      arc(small("foot t-swing", "swing", "Swing", () => { buzz([10, 20, 18]); this.host.action("swing"); }), 162),
      arc(small("foot t-talk", "talk", "Talk", () => { buzz(8); this.host.action("talk"); }), 132),
      arc(small("foot t-rob", "rob", "Rob", () => { buzz(12); this.host.action("rob"); }), 102),
    ];
    // in a car
    const gasBtn = el("button", "tc-btn tc-ctx tc-gas car");
    const gi = el("span", "tc-ico"); gi.innerHTML = ICONS.gas;
    gasBtn.append(gi, el("span", "tc-lbl", "Gas"));
    gasBtn.setAttribute("aria-label", "Gas");
    this.press(gasBtn, () => buzz(10), (on) => { this.gas = on; });
    const exitBtn = small("car t-exit", "exit", "Exit", () => { buzz(18); this.host.action("use"); });
    this.exitLabel = exitBtn.querySelector(".tc-lbl") as HTMLElement;
    const car = [
      arc(small("car t-brake", "brake", "Brake", () => buzz(12), (on) => { this.brakeHeld = on; if (this.host.brake) this.host.brake(on); }), 186, 116),
      arc(small("car t-horn", "horn", "Horn", () => { buzz([30, 20, 30]); this.host.action("horn"); }), 146, 116),
      arc(exitBtn, 106, 116),
    ];
    const more = arc(small("t-more", "more", "More", () => { buzz(8); this.toggleSheet(); }), 72);

    // ---- More sheet
    this.sheet = el("div", "tc-sheet");
    this.sheet.setAttribute("role", "menu");
    const item = (icon: string, label: string, name: TouchAction, cls = "") => {
      const b = el("button", "tc-item " + cls);
      b.setAttribute("role", "menuitem");
      const i = el("span", "tc-ico"); i.innerHTML = ICONS[icon] ?? "";
      b.append(i, el("span", "tc-lbl", label));
      this.press(b, () => { buzz(10); this.toggleSheet(false); this.host.action(name); });
      return b;
    };
    this.sheet.append(
      item("pickup", "Pick up", "pickup", "foot"), item("drop", "Drop", "drop", "foot"), item("bandage", "Bandage", "bandage", "foot"),
      item("horn", "Horn", "horn"), item("map", "Map", "map"),
    );

    cluster.append(...foot, ...car, more, this.ctxBtn, gasBtn, this.sheet);
    // on-screen zoom buttons: pinch can fail on some phones, these always work
    const zoomBox = el("div", "tc-zoom");
    for (const [txt, dir, label] of [["+", 1, "Zoom in"], ["\u2212", -1, "Zoom out"]] as const) {
      const b = el("button", "tc-zbtn", txt); b.setAttribute("aria-label", label);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); this.host.zoom?.(dir); });
      zoomBox.append(b);
    }
    this.el.append(this.zone, cluster, zoomBox);

    // nothing we touch leaks into the canvas / page handlers
    for (const t of ["pointerdown", "pointerup", "pointermove", "click", "dblclick", "contextmenu", "touchstart", "touchend", "touchmove", "wheel"]) {
      this.el.addEventListener(t, (e) => { e.stopPropagation(); if (t === "contextmenu" || t === "dblclick") e.preventDefault(); });
    }
    // tapping anywhere else closes the sheet
    document.addEventListener("pointerdown", (e) => { if (this.sheet.classList.contains("open") && !(e.target instanceof Node && cluster.contains(e.target))) this.toggleSheet(false); }, { capture: true });
  }

  /** Call every frame: feeds the stick/pedals to the host and refreshes the context button. */
  update(): void {
    if (!this.el.classList.contains("on")) return;
    const inCar = this.host.inCar();
    if (inCar !== this.lastCar) {
      this.lastCar = inCar;
      this.el.classList.toggle("in-car", inCar);
      this.toggleSheet(false);
      if (!inCar) { this.gas = false; this.brakeHeld = false; }
    }
    // stick / pedals
    if (inCar) {
      const brakeY = this.host.brake ? 0 : 1;
      const y = this.gas ? -1 : this.brakeHeld ? brakeY : 0;
      const x = this.stickId >= 0 ? this.sx : 0;
      if (x || y) { this.host.move(x, y); this.sentZero = false; }
      else if (!this.sentZero) { this.host.move(0, 0); this.sentZero = true; }
    } else if (this.stickId >= 0) {
      this.host.move(this.sx, this.sy); this.sentZero = false;
    } else if (!this.sentZero) { this.host.move(0, 0); this.sentZero = true; }

    // context button
    const c = this.host.context();
    const key = c ? c.label + "\u0000" + c.icon : "";
    if (key === this.lastCtx) return;
    this.lastCtx = key;
    if (inCar) {
      this.exitLabel.textContent = c?.label || "Exit";
      return;
    }
    this.ctxBtn.classList.toggle("idle", !c);
    this.ctxLabel.textContent = c?.label || "Use";
    this.ctxBtn.setAttribute("aria-label", c?.label || "Use");
    if (c?.icon && !ICONS[c.icon]) this.ctxIcon.textContent = c.icon; // host gave a glyph
    else this.ctxIcon.innerHTML = ICONS[c?.icon ?? "use"] ?? ICONS.use;
    if (c) { this.ctxBtn.classList.remove("pop"); void this.ctxBtn.offsetWidth; this.ctxBtn.classList.add("pop"); buzz(6); }
  }

  // ---------------------------------------------------------------- internals
  private press(b: HTMLElement, fn: () => void, hold?: (on: boolean) => void): void {
    const ids = new Set<number>();
    const up = (e: PointerEvent) => {
      if (!ids.delete(e.pointerId)) return;
      if (ids.size === 0) { b.classList.remove("down"); hold?.(false); }
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch { /* fine */ }
      if (ids.size === 0) { b.classList.add("down"); hold?.(true); }
      ids.add(e.pointerId);
      fn();
    });
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    // keyboard / screen reader activation still works (pointer presses already fired on down)
    b.addEventListener("click", (e) => { e.stopPropagation(); if (e.detail === 0) fn(); });
  }

  private toggleSheet(open?: boolean): void {
    const on = open ?? !this.sheet.classList.contains("open");
    this.sheet.classList.toggle("open", on);
    this.el.classList.toggle("sheet-open", on);
  }

  private stickDown(e: PointerEvent): void {
    if (this.stickId >= 0) return;
    e.preventDefault(); e.stopPropagation();
    this.stickId = e.pointerId;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* fine */ }
    const r = this.radius();
    // keep the whole base on screen
    this.ox = Math.max(r + 8, Math.min(innerWidth - r - 8, e.clientX));
    this.oy = Math.max(r + 8, Math.min(innerHeight - r - 8, e.clientY));
    const zr = this.zone.getBoundingClientRect();
    this.base.style.left = `${this.ox - zr.left}px`;
    this.base.style.top = `${this.oy - zr.top}px`;
    this.base.classList.add("live");
    this.sx = this.sy = 0; this.sprinting = false;
    this.setKnob(0, 0);
    this.toggleSheet(false);
    buzz(6);
    this.stickMove(e);
  }

  private stickMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();
    const r = this.radius();
    let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
    let d = Math.hypot(dx, dy);
    // floating base: drag past the rim and the base follows your thumb
    if (d > r * 1.35) {
      const k = (d - r * 1.35) / d;
      this.ox += dx * k; this.oy += dy * k;
      const zr = this.zone.getBoundingClientRect();
      this.base.style.left = `${this.ox - zr.left}px`;
      this.base.style.top = `${this.oy - zr.top}px`;
      dx = e.clientX - this.ox; dy = e.clientY - this.oy; d = Math.hypot(dx, dy);
    }
    const kd = Math.min(d, r);
    const nx = d ? dx / d : 0, ny = d ? dy / d : 0;
    this.setKnob(nx * kd, ny * kd);
    const raw = Math.min(1, d / r);
    const mag = raw < DEADZONE ? 0 : Math.min(1, (raw - DEADZONE) / (1 - DEADZONE));
    // gentle curve: fine control near the centre, full speed at the rim
    const m = mag * (0.35 + 0.65 * mag);
    this.sx = nx * m; this.sy = ny * m;
    if (!this.sprinting && raw >= SPRINT_ON && !this.host.inCar()) {
      this.sprinting = true; this.base.classList.add("sprint"); buzz([12, 30, 12]); this.host.action("sprint");
    } else if (this.sprinting && raw < SPRINT_OFF) { this.sprinting = false; this.base.classList.remove("sprint"); }
  }

  private stickUp(): void {
    this.stickId = -1;
    this.sx = this.sy = 0; this.sprinting = false;
    this.base.classList.remove("live", "sprint");
    this.base.style.left = ""; this.base.style.top = "";
    this.setKnob(0, 0);
    if (!this.host.inCar() || (!this.gas && !this.brakeHeld)) { this.host.move(0, 0); this.sentZero = true; }
  }

  private setKnob(x: number, y: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`;
  }

  private radius(): number {
    return this.base.offsetWidth / 2 || 60;
  }
}
