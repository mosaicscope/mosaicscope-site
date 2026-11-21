import { h } from "./dom";
import type { Simulation } from "../sim/Simulation";
import type { Vehicle } from "../entities/types";
import { TUNING, TUNE_GROUPS, NEUTRAL, type TuneDef } from "../content/tuning";
import { install, installed, remove } from "../sim/VehicleTuning";

/** The tuning shop: fifty upgrades in seven groups. Each shows what it changes; fit or remove it on the car you are next to. */
const LABEL: Record<string, string> = { power: "power", launch: "launch", top: "top speed", brake: "braking", fade: "fade resistance", grip: "grip", steer: "steering lock", steerSpeed: "steering response", oversteer: "tail looseness", frontBite: "front bite", diff: "traction out of corners",
  mass: "weight", roll: "body roll", drag: "drag", resp: "throttle response", shift: "shift loss", hand: "handbrake", puncture: "puncture upset", boost: "boost", nitro: "nitrous bursts", wet: "wet grip", rough: "rough-road ability", down: "downforce", cooling: "cooling", durable: "engine durability", warm: "pre-warmed tyres", launchCtl: "launch control" };
const ADD = new Set(["boost", "nitro", "wet", "rough", "down", "cooling", "durable", "warm", "launchCtl", "lag"]);
const summary = (t: TuneDef): string => Object.entries(t.fx).map(([k, v]) => {
  if (k === "drive") return `drivetrain: ${String(v).toUpperCase()}`; if (k === "lag") return "";
  const n = v as number, name = LABEL[k] ?? k;
  if (ADD.has(k)) return `${name} ${n >= 0 ? "+" : ""}${k === "nitro" ? n : Math.round(n * 100) + "%"}`;
  const pct = Math.round((n - NEUTRAL[k as "power"]) * 100); return `${name} ${pct >= 0 ? "+" : ""}${pct}%`;
}).filter(Boolean).join(" · ");

export function tuningShop(sim: Simulation, car: () => Vehicle | undefined, say: (m: string) => void): HTMLElement {
  const wrap = h("section.tuning-shop"), group = h("select", { "aria-label": "Tuning group" }, TUNE_GROUPS.map((g) => h("option", { value: g, text: g }))) as HTMLSelectElement, list = h("div");
  const render = (): void => {
    const v = car(), fitted = v ? installed(sim, v) : [];
    list.replaceChildren(...TUNING.filter((t) => t.group === group.value).map((t) => {
      const on = fitted.includes(t.id);
      return h("article.street-card", null, [h("h3", { text: t.name + (on ? " · fitted" : "") }), h("p", { text: t.blurb }), h("small", { text: summary(t) + `  ·  $${t.cost.toLocaleString()}` }),
        h("div", null, [h("button.btn" + (on ? "" : ".acid"), { type: "button", disabled: !v, text: on ? `Remove (refund $${Math.round(t.cost / 2).toLocaleString()})` : "Fit it", onclick: () => { const c = car(); if (!c) { say("Walk up to a vehicle first."); return; } say(on ? remove(sim, c, t.id) : install(sim, c, t.id)); render(); } })])]);
    }));
    wrap.querySelector("h3.ts-head")!.textContent = v ? `Tuning shop · ${v.plate} · ${fitted.length}/${TUNING.length} fitted` : "Tuning shop · stand next to a car";
  };
  group.addEventListener("change", render);
  wrap.append(h("h3.ts-head"), h("p", { text: "Fifty upgrades that change how the car really drives: power and boost, brakes, tyres, balance, differentials, weight, aero and electronics. Rear-drive cars will slide under power; all-wheel drive grips and pushes; front-drive understeers." }), group, list);
  render(); return wrap;
}
