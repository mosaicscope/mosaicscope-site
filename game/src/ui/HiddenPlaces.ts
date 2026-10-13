import type { Simulation } from "../sim/Simulation";
import { TICKS_PER_HOUR } from "../sim/Environment";
import { fmtCash } from "../sim/Society";
import { h } from "./dom";
import {
  STATIONS, GARDENERS, hiddenSpots, nearestSpot, glitchOpen, glitchVisit, dayOf, hash, mossCover, panelCount, panelAt, hiddenState, saveHidden, loadHidden,
  type HiddenSpot,
} from "../content/hiddenPlaces";

export const FARE = 2;
const MAX_TAGS = 3;

/** The panels behind the hidden places: the garden, the subway, the glitch and the moss wall. */
export class HiddenPlaces {
  private wasOpen = false;
  constructor(
    private sim: () => Simulation,
    private show: (title: string, body: (HTMLElement | null)[], cls?: string) => void,
    private close: () => void,
    private toast: (t: string, kind?: string) => void,
  ) { loadHidden(); }

  private day(sim: Simulation): number { return dayOf(sim.env.startHour, sim.tick, TICKS_PER_HOUR); }
  near(): HiddenSpot | null { const s = this.sim(), p = s.player; return p.inCar >= 0 || p.inside >= 0 ? null : nearestSpot(s.world, p.x, p.y, s.hour); }

  /** Called every frame: a quiet nudge when the glitch alley opens. */
  tick(): void {
    const s = this.sim(), open = glitchOpen(s.hour);
    if (open && !this.wasOpen) this.toast("3:33. Something hums in the alleys.");
    this.wasOpen = open;
  }

  open(spot: HiddenSpot): void {
    if (spot.id === "ladder") this.garden();
    else if (spot.id === "subway" || spot.id === "station") this.subway(spot);
    else if (spot.id === "glitch") this.glitch();
    else this.wall();
  }

  // ---------------------------------------------------------------- garden
  private garden(): void {
    const sim = this.sim(), p = sim.player, day = this.day(sim);
    const lines = GARDENERS.map((g, i) => h("li.item", null, [h("div", null, [h("b", { text: `${g.name} · ${g.role}` }), h("small", { text: `"${g.lines[hash(day, i) % g.lines.length]}"` })])]));
    const tomato = hiddenState.tomatoDay === day;
    this.show("The rooftop garden", [
      h("p", { text: "A ladder, eight floors of rust, and then this: tomatoes, string lights, and three neighbours who never come down." }),
      h("ul.items", null, lines),
      h("div.row", null, [
        h("button.btn", { disabled: tomato, onclick: () => { hiddenState.tomatoDay = day; p.hunger = Math.min(1, p.hunger + 0.2); saveHidden(); this.toast("Auntie Fern hands you a warm tomato. You feel fed.", "acid"); this.close(); }, text: tomato ? "Tomatoes are resting today" : "Take a tomato" }),
        h("button.btn", { onclick: () => { p.emo.mood = Math.min(1, p.emo.mood + 0.12); p.needs.fun = Math.min(1, p.needs.fun + 0.2); this.toast("You sit with Old Gus and watch the city. Calm."); this.close(); }, text: "Sit and watch the sunset" }),
      ]),
    ]);
  }

  // ---------------------------------------------------------------- subway
  private subway(from: HiddenSpot): void {
    const sim = this.sim(), p = sim.player, here = from.station ?? -1;
    const rows = STATIONS.map((st, i) => i === here ? null : h("li.item", null, [
      h("div", null, [h("b", { text: st.name }), h("small", { text: st.blurb })]), h("span.price", { text: fmtCash(FARE) }),
      h("button.btn", { disabled: p.cash < FARE, onclick: () => this.ride(i), text: "Ride" }),
    ]));
    const back = here >= 0 ? hiddenSpots(sim.world).find((s) => s.id === "subway") : null;
    this.show(here >= 0 ? STATIONS[here].name : "The subway", [
      h("p", { text: here >= 0 ? STATIONS[here].blurb : "Six stops, six small neighbourhoods. Nobody can agree on the map." }),
      h("ul.items", null, rows),
      back ? h("div.row", null, [h("button.btn", { onclick: () => { this.arrive(back.x, back.y, "Back up the stairs. Daylight, mostly."); }, text: "Back to the plaza" })]) : null,
    ]);
  }

  private ride(i: number): void {
    const sim = this.sim(), p = sim.player, spot = hiddenSpots(sim.world).find((s) => s.id === "station" && s.station === i);
    if (!spot || p.cash < FARE) return;
    p.cash -= FARE;
    this.arrive(spot.x, spot.y, `${STATIONS[i].name}: ${STATIONS[i].blurb}`);
    const st = STATIONS[i];
    const locals = sim.chars.filter((c) => c.id !== p.id && c.inside < 0 && c.inCar < 0 && Math.hypot(c.x - p.x, c.y - p.y) < 9).slice(0, 2);
    locals.forEach((c, k) => sim.say(c, st.quips[k % st.quips.length], "say", 4));
  }

  private arrive(x: number, y: number, text: string): void {
    const sim = this.sim(), p = sim.player;
    p.x = p.px = x; p.y = p.py = y; p.vx = p.vy = 0;
    sim.rebuildHash();
    this.toast(text, "acid");
    this.close();
  }

  // ---------------------------------------------------------------- glitch alley
  private glitch(): void {
    const sim = this.sim(), p = sim.player, day = this.day(sim);
    if (hiddenState.glitchDay !== day) { hiddenState.glitchDay = day; hiddenState.glitchVisits = 0; hiddenState.firstGift = false; }
    const v = glitchVisit(day, hiddenState.glitchVisits++);
    let gift = "";
    if (v.cash > 0 && !hiddenState.firstGift) { hiddenState.firstGift = true; p.cash += v.cash; gift = ` You leave with ${fmtCash(v.cash)} you didn't have.`; }
    saveHidden();
    this.show(v.title, [
      ...v.lines.map((l) => h("p", { text: l })),
      gift ? h("p", { text: gift.trim() }) : null,
      h("p", { style: { opacity: "0.6" }, text: "The alley is different next time. So is the clock." }),
      h("div.row", null, [h("button.btn", { onclick: () => this.close(), text: "Step back out" })]),
    ], "glitch");
  }

  // ---------------------------------------------------------------- moss and neon wall
  private wall(): void {
    const sim = this.sim(), day = this.day(sim), n = panelCount(day, hiddenState.tags), cover = Math.round(mossCover(day) * 100);
    const words = Array.from({ length: n }, (_, i) => panelAt(i).word);
    const tagged = hiddenState.tags >= MAX_TAGS;
    this.show("The moss wall", [
      h("p", { text: `Neon on one side, moss on the other, and the paint keeps coming. ${n} pieces so far, moss ${cover}% of the way up.` }),
      h("p", { style: { opacity: "0.75" }, text: words.join(" · ") }),
      h("div.row", null, [
        h("button.btn", { disabled: tagged, onclick: () => { hiddenState.tags++; saveHidden(); this.toast("You add your own piece. The moss will want a word.", "acid"); this.close(); }, text: tagged ? "The wall is full of you" : "Add your own tag" }),
      ]),
    ]);
  }
}
