import type {Character} from '../entities/types';
/** Bound expensive artwork passes independently of population and AI promotion. */
export function detailedCrowd(chars:readonly Pick<Character,'id'|'x'|'y'|'tier'|'hand'|'wounds'>[],x:number,y:number,budget:number,selected=-1,hovered=-1,follow=-1):Set<number>{
 const ranked=chars.map(c=>({id:c.id,score:(c.x-x)**2+(c.y-y)**2-(c.tier==='player'||c.id===selected||c.id===hovered||c.id===follow?1e9:0)-(c.hand>=0?9:0)-(c.wounds.length?16:0)-(c.tier==='principal'&&(c.x-x)**2+(c.y-y)**2<24*24?1e6:0)}));
 ranked.sort((a,b)=>a.score-b.score||a.id-b.id);const chosen=new Set(ranked.slice(0,Math.max(2,budget)).map(c=>c.id));for(const c of chars)if(c.tier==='player'||c.id===selected||c.id===hovered||c.id===follow)chosen.add(c.id);return chosen;
}

/** Hysteresis keeps low-end scenes responsive without changing people or gameplay state. */
export class CrowdArtworkBudget{private quality=-1;private budget=8;private average=0;private stable=0;private cooldown=0;choose(quality:number,lastMs:number):number{const base=[8,16,24,40][quality]??8;if(quality!==this.quality){this.quality=quality;this.budget=base;this.average=0;this.stable=0;this.cooldown=0;}if(quality>0)return base;if(Number.isFinite(lastMs)&&lastMs>=0)this.average=this.average*.8+lastMs*.2;if(this.cooldown>0)this.cooldown--;if(this.average>9&&this.cooldown===0&&this.budget>2){this.budget=Math.max(2,this.budget/2);this.cooldown=30;this.stable=0;}else if(this.average<5){if(++this.stable>=180&&this.budget<base){this.budget=Math.min(base,this.budget*2);this.stable=0;this.cooldown=30;}}else this.stable=0;return this.budget;}}
