import type {Character} from '../entities/types';
export const FLOOR_AREAS=[
 {id:'pokies',label:'Kiwi Gold',x:-4.5,y:-3.5,w:3.3,d:1.9},
 {id:'poker',label:'Video poker',x:1.5,y:-3.5,w:3.4,d:1.9},
 {id:'cashier',label:'Cashier',x:5.5,y:-3.9,w:1.5,d:1.3},
 {id:'blackjack',label:'Blackjack',x:-3.9,y:-.2,w:3.7,d:2.5},
 {id:'holdem',label:'Poker tables',x:0,y:1,w:3.8,d:2.6},
 {id:'roulette',label:'Roulette',x:4,y:2,w:3.8,d:2.6},
 {id:'flight',label:'Crash flight',x:5.3,y:-1.3,w:1.5,d:1.4},
 {id:'bar',label:'Bar & company',x:-4.7,y:4.1,w:3.7,d:1.9},
];
const blocked=(x:number,y:number)=>x< -6.6||x>6.7||y< -3||y>6||FLOOR_AREAS.some(a=>Math.abs(x-a.x)<a.w/2+.18&&Math.abs(y-a.y)<a.d/2+.18);
/** Small interior navigation grid: guests walk through the aisles rather than through tables. */
export function casinoWalkPath(from:[number,number],to:[number,number]):[number,number][]{
 const cells:[number,number][]=[];for(let y=-6;y<=12;y++)for(let x=-13;x<=13;x++)if(!blocked(x/2,y/2))cells.push([x,y]);
 if(!cells.length)return[];const nearest=(p:[number,number])=>cells.reduce((a,b)=>Math.hypot(a[0]/2-p[0],a[1]/2-p[1])<Math.hypot(b[0]/2-p[0],b[1]/2-p[1])?a:b),start=nearest(from),end=nearest(to),key=(p:[number,number])=>p.join(','),open=[start],parents=new Map<string,[number,number]|null>([[key(start),null]]),valid=new Set(cells.map(key));
 for(let i=0;i<open.length;i++){const p=open[i];if(key(p)===key(end))break;for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const n:[number,number]=[p[0]+dx,p[1]+dy],k=key(n);if(valid.has(k)&&!parents.has(k)){parents.set(k,p);open.push(n);}}}
 if(!parents.has(key(end)))return[];const path:[number,number][]=[];let p:[number,number]|null=end;while(p){path.unshift([p[0]/2,p[1]/2]);p=parents.get(key(p))??null;}return path;
}
export function casinoCompany(people:readonly Character[],exclude:readonly number[]=[],count=12):Character[]{
 const pool=people.filter(c=>c.tier!=='player'&&c.phys===0&&!exclude.includes(c.id)),women=pool.filter(c=>c.look.kind==='girl'),men=pool.filter(c=>c.look.kind!=='girl'),out:Character[]=[];
 for(let i=0;out.length<count&&(i<women.length||i<men.length);i++){if(women[i])out.push(women[i]);if(out.length<count&&men[i])out.push(men[i]);}return out;
}
