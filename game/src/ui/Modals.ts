import { h } from "./dom";
import type { Settings } from "../persistence/Settings";
import { DEFAULT_KEYS } from "../persistence/Settings";

/** Generic modal host with focus handling and Escape to close. */
export class ModalHost {
  el: HTMLElement;
  private prevFocus: Element | null = null;
  constructor() { this.el = h("div.modal-wrap.hidden", { onclick: (e: MouseEvent) => { if (e.target === this.el) this.close(); } }); }
  get open(): boolean { return !this.el.classList.contains("hidden"); }
  show(title: string, body: (HTMLElement | null)[], cls = ""): void {
    this.prevFocus = document.activeElement;
    const box = h("section.panel.modal" + (cls ? "." + cls : ""), { role: "dialog", "aria-modal": "true", "aria-label": title }, [
      h("button.x", { "aria-label": "Close", onclick: () => this.close(), text: "×" }), h("h2", { text: title }), ...body.filter(Boolean) as HTMLElement[],
    ]);
    this.el.replaceChildren(box);
    this.el.classList.remove("hidden");
    (box.querySelector("button:not(.x), input, select") as HTMLElement | null)?.focus();
  }
  close(): void { this.el.classList.add("hidden"); this.el.replaceChildren(); (this.prevFocus as HTMLElement | null)?.focus?.(); }
}

export const KEY_HELP: [string, string][] = [
  ["WASD / arrows", "walk (or click the ground)"], ["Click a person", "inspect them"], ["T", "talk to the selected or nearest person"],
  ["E", "pick up / enter a shop or car / get out"], ["R", "rob the nearest person (crime!)"], ["B", "bandage yourself or someone bleeding"], ["H", "horn (while driving)"], ["F / right-click", "throw your toy at the cursor"], ["Space", "swing a foam sword / noodle (or throw)"],
  ["Q", "drop what you're holding"], ["Wheel / pinch", "zoom"], ["Drag", "pan the camera (C re-centres on you)"], ["P", "pause"], ["1–4", "pick a reply in conversations"],
  ["L", "event log"], ["I", "inspect yourself"], ["`", "developer panel"], ["Esc", "close panels"],
];

export function keysList(keys: Record<string, string>): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const [k, v] of KEY_HELP) {
    let label = k;
    if (k === "T") label = keys.talk.toUpperCase(); if (k === "E") label = keys.pickup.toUpperCase(); if (k === "Q") label = keys.drop.toUpperCase();
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
  return [
    sel("Graphics quality", s.quality, [["auto", "Auto (adapts to your device)"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["ultra", "Ultra (best textures, needs a strong device)"]], (v) => change(() => { s.quality = v as Settings["quality"]; })),
    rng(`Crowd size (${s.density} background people, applies on reset)`, s.density, 0, 2000, 50, (v) => change(() => { s.density = v; }, true)),
    chk("Sound", s.sound, (v) => change(() => { s.sound = v; })),
    rng("Volume", s.volume, 0, 1, 0.05, (v) => change(() => { s.volume = v; })),
    sel("Reduced motion", s.reducedMotion === null ? "os" : s.reducedMotion ? "on" : "off", [["os", "Follow my device"], ["on", "On"], ["off", "Off"]], (v) => change(() => { s.reducedMotion = v === "os" ? null : v === "on"; })),
    rng("Text size", s.textScale, 0.85, 1.5, 0.05, (v) => change(() => { s.textScale = v; })),
    chk("Gentle toy fights (softer knockback)", s.gentle, (v) => change(() => { s.gentle = v; })),
    chk("Fake blood and visible wounds (cartoon)", s.fakeBlood, (v) => change(() => { s.fakeBlood = v; })),
    chk("Show names above the Mosaics", s.showNames, (v) => change(() => { s.showNames = v; })),
    ...keyRows,
  ];
}
