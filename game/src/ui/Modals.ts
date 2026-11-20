import { h } from "./dom";
import type { Settings } from "../persistence/Settings";
import { DEFAULT_KEYS } from "../persistence/Settings";

/** Generic modal host with focus handling and Escape to close. */
export class ModalHost {
  el: HTMLElement;
  beforeOpen: () => boolean | void = () => {};
  private prevFocus: Element | null = null;
  constructor() { this.el = h("div.modal-wrap.hidden", { onclick: (e: MouseEvent) => { if (e.target === this.el) this.close(); } }); addEventListener("resize", () => { if (this.open) this.fit(); }); }
  get open(): boolean { return !this.el.classList.contains("hidden"); }
  show(title: string, body: (HTMLElement | null)[], cls = ""): void {
    if (this.beforeOpen() === false) return;
    if (!this.open) this.prevFocus = document.activeElement;
    if (title !== this.lastTitle) { this.page = 0; this.lastTitle = title; }
    const box = h("section.panel.modal" + (cls ? "." + cls : ""), { role: "dialog", "aria-modal": "true", "aria-label": title }, [
      h("header.modal-header",null,[h("h2", { text: title }),h("button.x", { "aria-label": "Close", onclick: () => this.close(), text: "×" })]),
      h("div.modal-body",null,body.filter(Boolean) as HTMLElement[]),
    ]);
    this.el.replaceChildren(box);
    this.el.classList.remove("hidden");
    this.el.closest('#ui')?.classList.add('modal-open');
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const controls = [...box.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    (box.querySelector("button:not(.x), input, select") as HTMLElement | null)?.focus();
    requestAnimationFrame(() => this.fit()); setTimeout(() => this.fit(), 250);
  }
  /**
   * No scrolling. If a panel's content is taller than the screen, first scale it down a little
   * (never below 85%, so text stays readable); if it still does not fit, split its card list into
   * pages with ‹ › buttons. Each page is exactly what fits.
   */
  fit(): void {
    const box = this.el.querySelector<HTMLElement>(":scope > .modal"), body = box?.querySelector<HTMLElement>(":scope > .modal-body");
    if (!box || !body) return;
    body.style.zoom = ""; body.querySelector(":scope > .fit-pager")?.remove();
    for (const el of body.querySelectorAll<HTMLElement>("[data-fit-hidden]")) { el.hidden = false; delete el.dataset.fitHidden; }
    const limit = () => box.getBoundingClientRect().bottom - 10;
    const bottom = () => Math.max(...[...body.querySelectorAll<HTMLElement>("*")].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().bottom), 0);
    const top = body.getBoundingClientRect().top;
    if (bottom() <= limit()) return;
    const base = Math.max(.85, (limit() - top) / (bottom() - top)); body.style.zoom = String(base);
    if (bottom() <= limit()) return;
    // Page the largest list of cards in the panel.
    const lists = [...body.querySelectorAll<HTMLElement>("*")].filter(e => e.children.length >= 3 && !e.closest(".fit-pager"));
    const roomH = (limit() - top) * .8, fits = (l: HTMLElement) => Math.max(...[...l.children].map(k => k.getBoundingClientRect().height)) <= roomH;
    const byHeight = (a: HTMLElement, b: HTMLElement) => b.getBoundingClientRect().height - a.getBoundingClientRect().height;
    const list = lists.filter(fits).sort(byHeight)[0] ?? lists.sort(byHeight)[0] ?? body;
    if (!list) return;
    const pager = h("nav.fit-pager", { "aria-label": "Pages" });
    body.append(pager); pager.append(h("button.btn", { text: "‹" }), h("span", { text: "1 / 1" }), h("button.btn", { text: "›" }));
    const kids = [...list.children].filter(k => !k.classList.contains("fit-pager")) as HTMLElement[];
    const pages: HTMLElement[][] = []; let rest = kids;
    while (rest.length && pages.length < 40) {
      kids.forEach(k => { k.hidden = !rest.includes(k); });
      const lim = limit() - pager.getBoundingClientRect().height - 8;
      let page = rest.filter(k => k.getBoundingClientRect().bottom <= lim);
      if (!page.length) page = [rest[0]];
      // keep reading order: a page is a leading run of the remaining cards
      const cut = rest.findIndex(k => !page.includes(k)); page = cut < 0 ? rest : rest.slice(0, Math.max(1, cut));
      pages.push(page); rest = rest.slice(page.length);
    }
    this.page = Math.min(this.page, pages.length - 1);
    const show = () => {
      kids.forEach(k => { const on = pages[this.page].includes(k); k.hidden = !on; if (!on) k.dataset.fitHidden = "1"; else delete k.dataset.fitHidden; });
      const [prev, label, next] = pager.children as unknown as HTMLElement[];
      label.textContent = `${this.page + 1} / ${pages.length}`;
      body.style.zoom = String(base); if (bottom() > limit()) body.style.zoom = String(Math.max(.7, base * (limit() - top) / (bottom() - top)));
      (prev as HTMLButtonElement).disabled = this.page === 0; (next as HTMLButtonElement).disabled = this.page >= pages.length - 1;
    };
    const [prev, , next] = pager.children as unknown as HTMLElement[];
    prev.onclick = () => { this.page = Math.max(0, this.page - 1); show(); };
    next.onclick = () => { this.page = Math.min(pages.length - 1, this.page + 1); show(); };
    if (pages.length < 2) { pager.remove(); kids.forEach(k => { k.hidden = false; delete k.dataset.fitHidden; }); return; }
    show();
  }
  private page = 0;
  private lastTitle = "";
  close(): void { this.el.classList.add("hidden"); this.el.classList.remove("touch-tut"); this.el.closest('#ui')?.classList.remove('modal-open'); this.el.replaceChildren(); if (this.prevFocus?.isConnected) (this.prevFocus as HTMLElement).focus?.(); this.prevFocus = null; }
}

export const KEY_HELP: [string, string][] = [
  ["WASD / arrows", "move (or click the ground)"], ["Shift", "hold while moving to build sprint speed"], ["Click a person", "inspect them; with a gun equipped, tap to aim instead"], ["T", "talk to the selected or nearest person"],
  ["E", "pick up / enter a shop or car / get out"], ["R", "rob the nearest person (crime!)"], ["B", "bandage yourself or someone bleeding"], ["H", "horn (while driving)"], ["Driving", "W/S accelerate or brake/reverse · A/D steer · Space handbrake"], ["F / right-click", "fire your equipped gun / throw a held toy; hold for automatic fire"], ["Space", "unarmed attack / strike with a melee weapon / fire a held gun"],
  ["Q", "drop what you're holding"], ["Wheel / + and −", "zoom the game camera"], ["Drag", "pan the camera (C re-centres on you)"], ["P", "pause"], ["1–4", "pick a reply in conversations"],
  ["O", "photo mode: filters, frames, polaroids"], ["L", "event log"], ["I", "inspect yourself"], ["`", "developer panel"], ["Esc", "close panels"],
];

export function keysList(keys: Record<string, string>): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const [k, v] of KEY_HELP) {
    let label = k;
    if (k === "T") label = keys.talk.toUpperCase(); if (k === "E") label = keys.pickup.toUpperCase(); if (k === "Q") label = keys.drop.toUpperCase();
    if(k === "Space")label=keys.swing === " "?"Space":keys.swing.toUpperCase(); if(k === "F / right-click")label=keys.throw.toUpperCase()+" / right-click";
    rows.push(h("kbd", { text: label }), h("span", { text: v }));
  }
  return h("div.keys", null, rows);
}

export function settingsBody(s: Settings, onChange: (s: Settings, needsReset?: boolean) => void): HTMLElement[] {
  const sel = (label: string, value: string, opts: [string, string][], set: (v: string) => void) =>
    h("label", null, [label, h("select", { onchange: (e: Event) => set((e.target as HTMLSelectElement).value) }, opts.map(([v, l]) => h("option", { value: v, selected: v === value, text: l })))]);
  const chk = (label: string, value: boolean, set: (v: boolean) => void) => h("label", null, [label, h("input", { type: "checkbox", checked: value, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) })]);
  const rng = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => h("label", null, [label, h("input", { type: "range", min, max, step, value, onchange: (e: Event) => set(+(e.target as HTMLInputElement).value) })]);
  const change = (fn: () => void, reset = false) => { fn(); onChange(s, reset); };
  const keyRows = (["pickup", "drop", "throw", "talk"] as const).map((k) => h("label", null, [`Key: ${k}`, h("input", { type: "text", maxlength: 1, size: 2, value: s.keys[k] === " " ? "space" : s.keys[k], onchange: (e: Event) => change(() => { const v = (e.target as HTMLInputElement).value.toLowerCase(); s.keys[k] = v === "space" ? " " : v.slice(0, 1) || DEFAULT_KEYS[k]; }) })]));
  let gpuButton:HTMLButtonElement;
  const qualityPicker=sel("Graphics quality", s.quality, [["auto", "Auto (adapts to your device)"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["ultra", "Ultra (best textures, needs a strong device)"], ["ultra-ultra", "Ultra Ultra (request high-performance GPU)"]], v=>change(()=>{s.quality=v as Settings["quality"];gpuButton?.setAttribute('aria-pressed',String(v==='ultra-ultra'));}));
  gpuButton=h('button.btn',{type:'button',text:'Ultra Ultra · use high-performance GPU','aria-pressed':String(s.quality==='ultra-ultra'),onclick:()=>change(()=>{s.quality='ultra-ultra';const select=qualityPicker.querySelector('select');if(select)select.value=s.quality;gpuButton.setAttribute('aria-pressed','true');})}) as HTMLButtonElement;
  return [
    h("h3", { text: "Play your way" }),
    chk("Pause when switching tabs", s.autoPause, v => change(() => { s.autoPause = v; })),
    chk("Gamepad: left stick to move, A to interact, B to close, Start to pause", s.gamepad, v => change(() => { s.gamepad = v; })),
    sel("Colour-blind palette", s.palette, [["standard", "Original"], ["deuteranopia", "Blue & gold"], ["protanopia", "Cyan & amber"], ["tritanopia", "Rose & teal"]], v => change(() => { s.palette = v as Settings["palette"]; })),
    sel("Device preset", "custom", [["custom", "Custom"], ["phone", "Phone · low graphics, 60 people"], ["laptop", "Laptop · medium graphics, 150 people"], ["desktop", "Desktop · high graphics, 350 people"]], v => change(() => {
      if (v === "phone") { s.quality = "low"; s.density = 60; }
      if (v === "laptop") { s.quality = "medium"; s.density = 150; }
      if (v === "desktop") { s.quality = "high"; s.density = 350; }
    }, true)),
    sel("Control preset", "custom", [["custom", "Custom"], ["wasd", "WASD"], ["arrows", "Arrow keys + Enter to interact"], ["left", "IJKL + U to interact"]], v => change(() => {
      if (v === "wasd") s.keys = { ...DEFAULT_KEYS };
      if (v === "arrows") s.keys = { ...DEFAULT_KEYS, up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", pickup: "enter" };
      if (v === "left") s.keys = { ...DEFAULT_KEYS, up: "i", down: "k", left: "j", right: "l", pickup: "u", inspect: "v", log: "g" };
    })),
    h("p", { text: "F5 quick-saves · F9 cinema mode · M city map. Save menu includes export and import backups." }),
    qualityPicker, gpuButton, h("p",{text:"Ultra Ultra requests a high-performance GPU for perspective ground; the game falls back when unavailable."}),
    rng(`Crowd size (${s.density} background people, applies on reset)`, s.density, 0, 2000, 50, (v) => change(() => { s.density = v; }, true)),
    chk("Sound", s.sound, (v) => change(() => { s.sound = v; })),
    rng("Volume", s.volume, 0, 1, 0.05, (v) => change(() => { s.volume = v; })),
    chk("World sounds: footsteps, cars, weather (J)", s.sfx, (v) => change(() => { s.sfx = v; })),
    rng("World sound volume", s.sfxVolume, 0, 1, 0.05, (v) => change(() => { s.sfxVolume = v; })),
    sel("Reduced motion", s.reducedMotion === null ? "os" : s.reducedMotion ? "on" : "off", [["os", "Follow my device"], ["on", "On"], ["off", "Off"]], (v) => change(() => { s.reducedMotion = v === "os" ? null : v === "on"; })),
    rng("Text size", s.textScale, 0.85, 1.5, 0.05, (v) => change(() => { s.textScale = v; })),
    chk("Gentle toy fights (softer knockback)", s.gentle, (v) => change(() => { s.gentle = v; })),
    chk("Fake blood and visible wounds (cartoon)", s.fakeBlood, (v) => change(() => { s.fakeBlood = v; })),
    chk("Show names above the Mosaics", s.showNames, (v) => change(() => { s.showNames = v; })),
    ...keyRows,
  ];
}
