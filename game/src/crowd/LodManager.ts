import type { Simulation } from "../sim/Simulation";
import { Character, Lod } from "../entities/types";

/**
 * Promotes and demotes characters between simulation detail levels based on distance to the camera
 * focus, tier and event involvement. Same entity object at every level, so no state is ever reset:
 * a level only changes how often (and how expensively) the entity is updated.
 */
export class LodManager {
  /** entity id -> tick until which it stays at full detail (involved in an event) */
  hot = new Map<number, number>();
  counts = [0, 0, 0, 0, 0];
  promotions = 0; demotions = 0;

  markHot(id: number, tick: number, ticks = 300): void { this.hot.set(id, Math.max(this.hot.get(id) ?? 0, tick + ticks)); }

  update(sim: Simulation): void {
    const cfg = sim.cfg, fx = sim.focus.x, fy = sim.focus.y, tick = sim.tick;
    this.counts.fill(0);
    if(sim.world.mapped){
      const ranked=sim.chars.filter(c=>c.tier!=='player'&&c.inCar<0&&c.inside<0).map(c=>({c,d:Math.hypot(c.x-fx,c.y-fy),important:(this.hot.get(c.id)??0)>tick||c.phys!==0||c.talkWith>=0||c.pursuing>=0}));
      ranked.sort((a,b)=>Number(b.important)-Number(a.important)||a.d-b.d||a.c.id-b.c.id);
      const detailed=new Set(ranked.filter(c=>c.d<cfg.lodReduced||c.important).slice(0,sim.detailBudget).map(c=>c.c.id));
      for(const c of sim.chars){const d=Math.hypot(c.x-fx,c.y-fy),urgent=c.phys!==0||c.talkWith>=0||c.pursuing>=0;
        c.lod=c.tier==='player'?Lod.FULL:urgent||detailed.has(c.id)?d<cfg.lodFull?Lod.FULL:Lod.REDUCED:d<cfg.lodBackground?Lod.BACKGROUND:Lod.SLEEP;
        if(c.tier==='background'){const promoted=detailed.has(c.id)||urgent;if(c.promoted!==promoted){c.promoted=promoted;c.nextThink=tick+c.id%15;}}
        this.counts[c.lod]++;
      }
      if(tick%600===0)for(const[id,t]of this.hot)if(t<tick)this.hot.delete(id);
      return;
    }
    for (const c of sim.chars) {
      const d = Math.hypot(c.x - fx, c.y - fy);
      const hot = (this.hot.get(c.id) ?? 0) > tick;
      let lod: Lod;
      if (c.tier === "player") lod = Lod.FULL;
      else if (c.tier === "principal") lod = d < cfg.lodFull || hot ? Lod.FULL : Lod.REDUCED;
      else if (c.tier === "mid") {
        lod = hot || d < cfg.lodFull ? Lod.FULL : d < cfg.lodReduced ? Lod.REDUCED : d < cfg.lodGroup ? (c.group >= 0 ? Lod.GROUP : Lod.REDUCED) : d < cfg.lodBackground ? Lod.BACKGROUND : Lod.SLEEP;
      } else {
        const near = d < cfg.lodFull * 0.7 || hot;
        lod = near ? Lod.REDUCED : d < cfg.lodBackground ? Lod.BACKGROUND : Lod.SLEEP;
        // promotion keeps memories/relations; demotion waits until the entity is between activities
        if (near && !c.promoted) { c.promoted = true; this.promotions++; c.pathGoalX = c.x; c.pathGoalY = c.y; }
        else if (!near && c.promoted) {
          if (c.goal || c.talkWith >= 0) lod = Lod.REDUCED;
          else { c.promoted = false; this.demotions++; c.pathGoalX = c.x; c.pathGoalY = c.y; c.anim.pose = "auto"; }
        }
      }
      if (lod !== c.lod) { c.lod = lod; c.dirty = true; }
      this.counts[c.lod]++;
    }
    if (tick % 600 === 0) for (const [id, t] of this.hot) if (t < tick) this.hot.delete(id);
  }

  static countTiers(chars: Character[]): Record<string, number> {
    const out: Record<string, number> = { player: 0, principal: 0, mid: 0, background: 0, promoted: 0 };
    for (const c of chars) { out[c.tier]++; if (c.promoted) out.promoted++; }
    return out;
  }
}
