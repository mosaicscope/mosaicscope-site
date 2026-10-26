import type {Character} from '../entities/types';
/** Bound expensive artwork passes independently of population and AI promotion. */
export function detailedCrowd(chars:readonly Pick<Character,'id'|'x'|'y'|'tier'|'hand'|'wounds'>[],x:number,y:number,budget:number,selected=-1,hovered=-1,follow=-1):Set<number>{
 const ranked=chars.map(c=>({id:c.id,score:(c.x-x)**2+(c.y-y)**2-(c.tier==='player'||c.id===selected||c.id===hovered||c.id===follow?1e9:0)-(c.hand>=0?9:0)-(c.wounds.length?16:0)-(c.tier==='principal'&&(c.x-x)**2+(c.y-y)**2<24*24?1e6:0)}));
 ranked.sort((a,b)=>a.score-b.score||a.id-b.id);return new Set(ranked.slice(0,Math.max(4,budget)).map(c=>c.id));
}
