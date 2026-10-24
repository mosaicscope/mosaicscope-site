import type {Simulation} from './Simulation';
export const CITY_CHALLENGES=[
 {id:'coffee',title:'Coffee trail',description:'Walk to three different cafes, bakeries or diners.',kinds:['cafe','bakery','diner'],count:3,reward:35},
 {id:'culture',title:'Culture circuit',description:'Find three galleries, studios or civic offices.',kinds:['gallery','studio','office'],count:3,reward:40},
 {id:'night',title:'After-dark scout',description:'Scout three nightlife, casino or hotel entrances on foot.',kinds:['nightclub','casino','hotel'],count:3,reward:45},
 {id:'delivery',title:'Courier practice',description:'Learn a four-stop route between shops, offices and the hospital.',kinds:['dairy','office','hospital'],count:4,reward:50},
 {id:'architecture',title:'Architecture ramble',description:'Explore five different building entrances across the city.',kinds:[],count:5,reward:60},
 {id:'frames',title:'Four streets, four frames',description:'Use Photograph this street on four different named streets.',action:'photowalk',count:4,reward:40},
 {id:'spotter',title:'Car-spotter notebook',description:'Use Spot a parked car model on six different models.',action:'carspot',count:6,reward:55},
 {id:'voices',title:'Meet the neighbourhood',description:'Use Meet a street neighbour with three different neighbours.',action:'streetchat',count:3,reward:35},
 {id:'verses',title:'Mosaic cypher',description:'Trade bars with three different Mosaics.',action:'freestyle',count:3,reward:45},
 {id:'table',title:'A place at the table',description:'Share lunch with three different neighbours.',action:'sharedmeal',count:3,reward:40},
] as const;
export interface ChallengeState{completed:string[];active?:{id:string;seen:string[];stops:number[]}}
export function restoreChallenges(raw:unknown):ChallengeState{
 const out:ChallengeState={completed:[]};if(!raw||typeof raw!=='object')return out;const r=raw as ChallengeState;
 out.completed=Array.isArray(r.completed)?[...new Set(r.completed.filter(id=>CITY_CHALLENGES.some(d=>d.id===id)))]:[];
 if(r.active&&CITY_CHALLENGES.some(d=>d.id===r.active!.id)&&!out.completed.includes(r.active.id)&&Array.isArray(r.active.seen)&&Array.isArray(r.active.stops))out.active={id:r.active.id,seen:[...new Set(r.active.seen.filter(s=>typeof s==='string').map(s=>s.slice(0,160)))].slice(0,6),stops:r.active.stops.filter(n=>Number.isSafeInteger(n)&&n>=0).slice(0,5)};
 return out;
}
export function startChallenge(sim:Simulation,id:string):string{
 const def=CITY_CHALLENGES.find(d=>d.id===id);if(!def)return 'Unknown city challenge.';
 const state=sim.worldFun.challenges??={completed:[]};if(state.completed.includes(id))return 'You have already completed this challenge.';
 const stops='kinds'in def?sim.world.buildings.filter(b=>!def.kinds.length||(def.kinds as readonly string[]).includes(b.kind)).sort((a,b)=>Math.hypot(a.door.x-sim.player.x,a.door.y-sim.player.y)-Math.hypot(b.door.x-sim.player.x,b.door.y-sim.player.y)).slice(0,def.count).map(b=>b.id):[];
 if('kinds'in def&&stops.length<def.count)return 'This map does not have enough matching places for this route.';
 state.active={id,seen:[],stops};return def.title+' started. Progress is saved automatically.';
}
export function nextChallengeStop(sim:Simulation){const a=sim.worldFun.challenges?.active;if(!a)return null;const id=a.stops.find(id=>!a.seen.includes(String(id))),b=id===undefined?null:sim.world.buildings[id];return b?{x:b.door.x+.5,y:b.door.y+.5,name:b.name}:null;}
function finish(sim:Simulation){const state=sim.worldFun.challenges,a=state?.active,def=CITY_CHALLENGES.find(d=>d.id===a?.id);if(!state||!a||!def||a.seen.length<def.count)return;
 if(!state.completed.includes(def.id)){state.completed.push(def.id);sim.player.cash+=def.reward;sim.player.needs.fun=Math.min(1,sim.player.needs.fun+.2);sim.toasts.push({text:def.title+' complete · $'+def.reward+' game cash',tick:sim.tick,kind:'acid'});}state.active=undefined;
}
export function challengeAction(sim:Simulation,action:string,identity:string){const a=sim.worldFun.challenges?.active,def=CITY_CHALLENGES.find(d=>d.id===a?.id);if(!a||!def||!('action'in def)||def.action!==action||!identity||a.seen.includes(identity))return;a.seen.push(identity);finish(sim);}
export function updateChallenges(sim:Simulation){if(sim.tick%30||sim.player.inCar>=0||sim.player.inside>=0||sim.player.phys!==0)return;const a=sim.worldFun.challenges?.active,next=nextChallengeStop(sim);if(!a||!next||Math.hypot(next.x-sim.player.x,next.y-sim.player.y)>3)return;const id=a.stops.find(id=>!a.seen.includes(String(id)));if(id!==undefined){a.seen.push(String(id));finish(sim);}}
export function challengeStatus(sim:Simulation):string{const a=sim.worldFun.challenges?.active,def=CITY_CHALLENGES.find(d=>d.id===a?.id);if(!a||!def)return '';const next=nextChallengeStop(sim);return `${def.title} · ${a.seen.length}/${def.count}`+(next?' · '+next.name+' · '+Math.round(Math.hypot(next.x-sim.player.x,next.y-sim.player.y)*2)+' m':' · open Street play for actions');}
