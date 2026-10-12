import type { Simulation } from "../sim/Simulation";
import type { Renderer } from "../render/Renderer";
import { DebugFlags, DEBUG_LABELS } from "./flags";
import { h } from "../ui/dom";
import { TOYS } from "../content/toys";
import { LodManager } from "../crowd/LodManager";

/** Developer panel: live metrics, frame graph, debug toggles and spawn/trigger/reset controls. */
export class DevPanel {
  el: HTMLElement;
  private grid: HTMLElement;
  private graph: HTMLCanvasElement;
  private frames: number[] = [];
  private lastUpdate = 0;
  constructor(private sim: () => Simulation, private renderer: Renderer, public flags: DebugFlags, private ctl: {
    quality: () => string; speed: () => number; fps: () => number; tickRate: () => number;
    reset: (seed?: number) => void; teleport: () => void; toast: (t: string) => void;
  }) {
    this.grid = h("div.grid");
    this.graph = h("canvas", { width: 360, height: 50, "aria-hidden": "true" }) as HTMLCanvasElement;
    const toggles = h("div.toggles", null, (Object.keys(DEBUG_LABELS) as (keyof DebugFlags)[]).map((k) =>
      h("label", null, [h("input", { type: "checkbox", checked: flags[k], onchange: (e: Event) => { flags[k] = (e.target as HTMLInputElement).checked; } }), DEBUG_LABELS[k]])));
    const toySel = h("select", { "aria-label": "Toy to spawn" }, Object.keys(TOYS).map((k) => h("option", { value: k, text: k }))) as HTMLSelectElement;
    const evSel = h("select", { "aria-label": "Event to trigger" }, ["party", "blackout", "rain", "storm", "clear", "argument", "toy_fight", "panic", "rare_meteor"].map((k) => h("option", { value: k, text: k }))) as HTMLSelectElement;
    const seedIn = h("input", { type: "number", "aria-label": "Seed", style: { width: "110px" }, value: String(this.sim().cfg.seed) }) as HTMLInputElement;
    const ctrls = h("div.ctrls", null, [
      h("button", { text: "+1 NPC", onclick: () => this.spawnNpc(1) }), h("button", { text: "+50 NPCs", onclick: () => this.spawnNpc(50) }), h("button", { text: "+500", onclick: () => this.spawnNpc(500) }),
      toySel, h("button", { text: "Spawn toy", onclick: () => { const s = this.sim(), p = s.player; s.spawnToy(toySel.value, p.x + 1, p.y + 0.5, 1); } }),
      evSel, h("button", { text: "Trigger", onclick: () => this.trigger(evSel.value) }),
      h("button", { text: "Teleport to cursor", onclick: () => this.ctl.teleport() }),
      seedIn, h("button", { text: "Reset with seed", onclick: () => this.ctl.reset(+seedIn.value || 1) }),
      h("button", { text: "Reset same seed", onclick: () => this.ctl.reset() }),
    ]);
    this.el = h("section.panel.dev.hidden", { "aria-label": "Developer panel", role: "region" }, [
      h("button.x", { "aria-label": "Close developer panel", onclick: () => this.toggle(false), text: "×" }),
      h("h2", { text: "Developer" }), this.grid, this.graph, h("h3", { text: "Overlays" }), toggles, h("h3", { text: "Controls" }), ctrls,
      h("p", { style: { color: "var(--dim)", margin: "8px 0 0" }, text: "Dev tools are separate from play. Seeds make runs reproducible." }),
    ]);
  }
  toggle(on?: boolean): void { const show = on ?? this.el.classList.contains("hidden"); this.el.classList.toggle("hidden", !show); }
  get visible(): boolean { return !this.el.classList.contains("hidden"); }

  private spawnNpc(n: number): void { const s = this.sim(), p = s.player; s.spawnNpcAt(p.x, p.y, n); this.ctl.toast(`Spawned ${n} (total ${s.chars.length})`); }

  private trigger(kind: string): void {
    const s = this.sim();
    if (kind === "party") s.toggleBoombox(null, true);
    else if (kind === "blackout") { s.env.power = false; s.env.powerBackAt = s.tick + 60 * 40; for (const p of s.world.pois) if (p.kind === "lamp") p.on = false; s.emit({ type: "blackout", x: 32, y: 32, summary: "Power cut (dev)" }); }
    else if (kind === "rain" || kind === "storm" || kind === "clear") { s.env.weather = kind === "clear" ? "clear" : kind; s.env.raining = kind !== "clear"; s.env.storm = kind === "storm"; s.emit({ type: "weather", x: 32, y: 32, data: { to: kind }, summary: `Weather set to ${kind} (dev)` }); }
    else if (kind === "argument" || kind === "toy_fight") {
      const ps = s.chars.filter((c) => c.tier === "principal");
      const a = ps[s.rng.int(0, ps.length - 1)], b = ps.filter((x) => x !== a).sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y))[0];
      const r = s.relate(a, b.id); r.grudge = Math.max(r.grudge, 0.6);
      if (kind === "argument") s.emitArgument(a, b, null); else { a.goalCooldowns.fight = 0; a.goal = null; a.emo.frustration = 0.8; }
      this.ctl.toast(`${a.name} vs ${b.name}`);
    } else if (kind === "panic") { const c = s.chars.find((x) => x.tier === "principal" && x.lod === 0) ?? s.chars[1]; c.emo.fear = 1; s.emit({ type: "panic", x: c.x, y: c.y, actors: [c.id], summary: `${c.name} panicked (dev)` }); }
    else if (kind === "rare_meteor") s.emit({ type: "rare_meteor", x: 32, y: 32, summary: "Shooting star (dev)" });
  }

  update(dt: number): void {
    this.frames.push(dt * 1000); if (this.frames.length > 180) this.frames.shift();
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastUpdate < 250) return;
    this.lastUpdate = now;
    const s = this.sim(), r = this.renderer, m = s.metrics, tiers = LodManager.countTiers(s.chars);
    const mem = (performance as any).memory?.usedJSHeapSize;
    const rows: [string, string][] = [
      ["FPS", this.ctl.fps().toFixed(0)], ["Frame (render) ms", r.stats.frameMs.toFixed(2)], ["Sim step ms (last)", m.stepMs.toFixed(3)],
      ["  ai / move / physics / events", `${m.aiMs.toFixed(2)} / ${m.moveMs.toFixed(2)} / ${m.physicsMs.toFixed(2)} / ${m.eventsMs.toFixed(2)}`],
      ["Sim ticks per second", this.ctl.tickRate().toFixed(0)], ["Speed", this.ctl.speed() + "x"],
      ["Entities", String(s.chars.length)], ["  principal / mid / crowd / promoted", `${tiers.principal} / ${tiers.mid} / ${tiers.background} / ${tiers.promoted}`],
      ["  LOD full / reduced / group / bg / sleep", s.lod.counts.join(" / ")], ["Drawn figures / silhouettes / batches", `${r.stats.figures} / ${r.stats.silhouettes} / ${r.stats.batches}`],
      ["Physics bodies (awake / total)", `${s.physics.activeBodies} / ${s.toys.filter((t) => t.state !== "broken").length}`], ["Contacts this tick", String(s.physics.contacts)],
      ["Spatial queries / candidates", `${s.charHash.queries} / ${s.charHash.candidatesVisited}`], ["AI decisions this tick", String(m.aiDecisions + m.bgThinks)],
      ["Path queue / searches", `${s.nav.queueLength} / ${s.nav.searchesThisTick}`], ["Event queue / processed", `${s.events.depthOfQueue} / ${s.events.history.length}`],
      ["Events deduped / dropped / too deep", `${s.events.deduped} / ${s.events.dropped} / ${s.events.tooDeep}`], ["Conversations", String(s.dialogue.convs.size)],
      ["Groups", String(s.groups.groups.size)], ["Particles", String(r.particles.active)], ["Heap", mem ? (mem / 1048576).toFixed(1) + " MB" : "n/a in this browser"],
      ["Quality", this.ctl.quality()], ["Seed", String(s.cfg.seed)], ["Tick", String(s.tick)],
    ];
    this.grid.replaceChildren(...rows.flatMap(([a, b]) => [h("span", { text: a }), h("span", { text: b })]));
    const g = this.graph.getContext("2d")!, W = this.graph.width, H = this.graph.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = "rgba(238,228,211,.2)"; g.beginPath(); g.moveTo(0, H - (16.7 / 50) * H); g.lineTo(W, H - (16.7 / 50) * H); g.stroke();
    g.strokeStyle = "#c6ff3d"; g.beginPath();
    this.frames.forEach((f, i) => { const x = (i / 180) * W, y = H - Math.min(1, f / 50) * H; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
}
