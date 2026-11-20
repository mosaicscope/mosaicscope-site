import {seat,unseat} from './Traffic';
import {fireGun,drawGun} from './Turf';
import type { Simulation } from './Simulation';
import type { Character, Step } from '../entities/types';
import { Phys } from '../entities/types';
import { CREWS, startTurfWar, endTurfWar } from './Turf';
import { SALT_MILESTONES } from '../content/salt-story/milestones';
import { pickUp } from '../inventory/Inventory';

export const STREET_CREWS = [
  {id:'mongrel',name:'Mongrel Mob',color:'#b04f43'},
  {id:'blackpower',name:'Black Power',color:'#3e566d'},
  {id:'stormtroopers',name:'Stormtroopers',color:'#a59d86'},
  {id:'beez',name:'Killer Beez',color:'#c7a942'},
] as const;
export const STREET_KINDS = ['meetup','dispute','protection','nightlife','intoxication','police','truce','turf','busking','cafe_queue','neighbours','cleanup','nightout'] as const;
export type StreetKind = typeof STREET_KINDS[number];
export interface StreetIncident { id:number; kind:StreetKind; crew:string; x:number; y:number; area:string; actors:number[]; started:number; until:number; title:string; line:string; resolved:boolean }
export interface StreetLifeState { serial:number; nextAt:number; heat:Record<string,number>; history:StreetIncident[];driveBy?:{driver:number;vehicle:number;target:number;until:number;nextShot:number;shots:number} }
export const newStreetLife = ():StreetLifeState => ({serial:0,nextAt:900,heat:{},history:[]});
const free = (c:Character) => c.tier!=='player'&&c.inside<0&&c.inCar<0&&c.phys===Phys.OK&&c.jailUntil<=0&&c.arrestedBy<0&&c.talkWith<0&&c.mode!=='panic'&&!c.substances?.crisis&&!['fight','turf','arrest','chase','treat','flee','gunfight','steal','mug'].includes(c.goal?.id??'');
export function storyPhase(sim:Simulation):number {
  const reached=Math.max(sim.saltStory.position,sim.saltStory.furthest);
  let result=0;for(let i=0;i<SALT_MILESTONES.length;i++)if(reached>=SALT_MILESTONES[i].start)result=i;return result;
}
/** Crew references belong to the game's fiction. Recruitment uses role/position, never skin or hair. */
export function ensureStreetCrews(sim:Simulation):void {
  if(sim.chars.filter(c=>c.tier==='background').length<40)return;
  const areas=sim.world.areas.filter(a=>!['water','park','stage'].includes(a.kind));
  for(const [index,crew]of STREET_CREWS.entries()){
    CREWS[crew.id]??={name:crew.name,color:crew.color};
    const existing=sim.chars.filter(c=>c.crew===crew.id).length;if(existing>=8)continue;
    const area=areas[(index*7+3)%areas.length];if(!area)continue;
    const pool=sim.chars.filter(c=>c.tier==='background'&&!c.crew&&['local','thief','drifter'].includes(c.role)).sort((a,b)=>Math.hypot(a.x-area.cx,a.y-area.cy)-Math.hypot(b.x-area.cx,b.y-area.cy));
    for(const c of pool.slice(0,8-existing)){c.crew=crew.id;c.role='mobster';c.promoted=true;c.look.accent=crew.color;c.look.top='vest';c.look.color='#252927';c.bio+=` Runs with ${crew.name} in this fictional city.`;if(c.id%4===0){const gun=sim.spawnToy('pistol',c.x,c.y);if(gun)pickUp(c,gun,sim.tick,99);}}
    sim.streetLife.heat[crew.id]??=.3;
  }
}
const STAGES = [
  "Ruth's dairy is staying open. No one wants another protection argument.",
  'The blackout has everyone watching the stage shed and the back lanes.',
  "People are whispering about Velvet's painting and a meeting at the Market.",
  'Ruth and Vito are talking terms. The street crews are watching the Market.',
  'After the gala, every crew has a different version of what happened to that painting.',
  'The car-yard grudge is spreading. Brooke wants everyone to cool it.',
  'After the dairy standoff, Ruth wants the biscuit truce respected.',
  'Hobbs is doing the rounds after the station interviews. Keep the lanes clear.',
  'The Night Kiwi rumour has changed. People are finally listening to Hemi.',
  "The party invitations are out. Glitter doesn't want trouble following anyone in.",
  "The party brought everyone together. Ruth's dairy is still the place for the morning after.",
];
export function streetNews(sim:Simulation):string {
  const latest=[...sim.streetLife.history].reverse().find(e=>e.until>sim.tick&&!e.resolved);
  return latest?`${latest.title} near ${latest.area}. ${latest.line}`:STAGES[storyPhase(sim)];
}
function plan(sim:Simulation,c:Character,x:number,y:number,steps:Step[]):void{
  const point=sim.world.nearestWalkable(x,y);
  c.goal={id:'street_life',target:-1,plan:[{kind:'goto',x:point.x,y:point.y},...steps],stepIdx:0,stepTimer:0,started:sim.tick,replans:0};
  c.mode='goal';c.path=null;c.pathReq=0;c.nextThink=sim.tick;sim.lod.markHot(c.id,sim.tick,60*50);
}
/** Each scene has a real location and a small cast; nobody is teleported into it. */
export function triggerStreetIncident(sim:Simulation,kind:StreetKind,crewId?:string):StreetIncident|null {
  if(['busking','cafe_queue','neighbours','cleanup','nightout'].includes(kind))return null;
  ensureStreetCrews(sim);
  const state=sim.streetLife;
  if(state.history.filter(e=>!e.resolved&&e.until>sim.tick).length>=3)return null;
  const available=STREET_CREWS.map((_,i)=>STREET_CREWS[(state.serial+i)%STREET_CREWS.length].id);
  const crew=crewId??available.find(id=>sim.chars.some(c=>c.crew===id&&free(c)&&!c.goal?.id.startsWith('street_')));
  if(!crew)return null;
  const members=sim.chars.filter(c=>c.crew===crew&&free(c)&&!c.goal?.id.startsWith('street_')).sort((a,b)=>Math.hypot(a.x-sim.player.x,a.y-sim.player.y)-Math.hypot(b.x-sim.player.x,b.y-sim.player.y));
  const lead=members[0];if(!lead)return null;
  const area=sim.world.areaAt(lead.x,lead.y),point=sim.world.nearestWalkable(lead.x,lead.y);
  const actors=members.filter(c=>Math.hypot(c.x-lead.x,c.y-lead.y)<20).slice(0,3);
  if(!actors.length)return null;
  const group=CREWS[crew]?.name??crew, heat=state.heat[crew]??.3;
  const lines:Partial<Record<StreetKind,string>>={
    meetup:`${group} are meeting on the corner. ${STAGES[storyPhase(sim)]}`,
    dispute:`A street argument is drawing a crowd. ${STAGES[storyPhase(sim)]}`,
    protection:`A shopkeeper is pushing back against a protection demand. Ruth's stand at the dairy is being talked about.`,
    nightlife:'The late-night crowd is loud. Friends are keeping an eye on each other and the last buses.',
    intoxication:'Someone is unsteady outside. Friends are staying close; a serious reaction will bring paramedics.',
    police:'A patrol is asking about the recent disputes. Witnesses can point them toward actual trouble.',
    truce:`The crews are trying to keep the peace. ${STAGES[storyPhase(sim)]}`,
    turf:`Tensions are high around ${area?.name??'the street'}. Bystanders are moving clear.`,
  };
  const titles:Partial<Record<StreetKind,string>>={meetup:`${group} · corner meeting`,dispute:'Street dispute',protection:'Shopfront pressure',nightlife:'After-hours crowd',intoxication:'An unsteady night',police:'Patrol follow-up',truce:'Keeping the truce',turf:'Turf tension'};
  const e:StreetIncident={id:++state.serial,kind,crew,x:point.x,y:point.y,area:area?.name??sim.world.streetName(point.x,point.y),actors:actors.map(c=>c.id),started:sim.tick,until:sim.tick+60*90,title:titles[kind]!,line:lines[kind]!,resolved:false};
  state.history.push(e);if(state.history.length>24)state.history.splice(0,state.history.length-24);
  state.heat[crew]=Math.max(0,Math.min(1,heat+(kind==='truce'?-.16:kind==='dispute'||kind==='protection'?.16:.03)));
  actors.forEach((c,i)=>{
    const steps:Step[]=[{kind:'street_say',text:i===0?e.line:'Keep an eye on the street. We are here for a conversation.'},{kind:kind==='nightlife'?'dance':'wait',time:8+i*2}];
    if(kind==='intoxication'&&i===0){
      const item=sim.spawnToy(['beer','stimulant_powder','cannabis','sedative'][(Math.floor(state.serial/4)+sim.cfg.seed)%4],c.x,c.y);
      if(item){const held=pickUp(c,item,sim.tick,99);if(held==='hand'||held==='bag')steps.unshift({kind:'substance',toy:item.id});else{item.state='broken';item.x=-100;}}
    }
    plan(sim,c,e.x+(i-1)*1.1,e.y+(i%2)*.8,steps);
  });
  if(kind==='protection'){
    const witness=sim.chars.filter(c=>!c.crew&&c.tier!=='player'&&free(c)&&Math.hypot(c.x-e.x,c.y-e.y)<12).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
    if(witness){e.actors.push(witness.id);plan(sim,witness,e.x+2,e.y+1,[{kind:'street_say',text:'Ruth said no. So am I. Leave the shop alone.'},{kind:'wait',time:8}]);}
  }
  if(kind==='police'){
    const cop=sim.chars.find(c=>c.role==='cop'&&free(c)&&Math.hypot(c.x-e.x,c.y-e.y)<22);
    if(cop){e.actors.push(cop.id);plan(sim,cop,e.x+2,e.y-1,[{kind:'street_say',text:'We have had reports of trouble. Clear the entrance and talk to me.'},{kind:'watch',target:lead.id,time:10}]);}
  }
  if(kind==='turf'&&heat>.65&&storyPhase(sim)<8){
    const rivals=Object.keys(CREWS).filter(id=>id!==crew&&sim.chars.filter(c=>c.crew===id&&free(c)).length>=2),rival=rivals[state.serial%rivals.length];
    if(rival)startTurfWar(sim,true,[crew,rival],{...point,name:e.area});
  }
  sim.emit({type:'street_incident',x:e.x,y:e.y,actors:e.actors,summary:`${e.title} · ${e.area}. ${e.line}`});
  return e;
}
export function resolveStreetIncident(sim:Simulation,id:number,choice:'calm'|'warn'|'medical'):string {
  const e=sim.streetLife.history.find(e=>e.id===id);if(!e||e.resolved||e.until<=sim.tick)return 'That scene has finished.';
  if(Math.hypot(sim.player.x-e.x,sim.player.y-e.y)>8)return 'Walk closer to the scene first.';
  const people=e.actors.map(id=>sim.chars[id]).filter(Boolean);
  if(choice==='medical'){
    const hurt=people.find(c=>c.substances?.crisis||c.wounds.length||c.blood<.6);if(!hurt)return 'Nobody here currently needs an ambulance.';sim.callAmbulance(hurt);return 'Paramedics have been called.';
  }
  if(choice==='calm'&&sim.turfWar&&Math.hypot(sim.turfWar.x-e.x,sim.turfWar.y-e.y)<15)endTurfWar(sim);
  if(choice==='warn')for(const c of sim.chars.filter(c=>c.tier!=='player'&&!c.crew&&free(c)&&Math.hypot(c.x-e.x,c.y-e.y)<10).slice(0,4)){
    const dx=c.x-e.x,dy=c.y-e.y,d=Math.hypot(dx,dy)||1;plan(sim,c,c.x+dx/d*5,c.y+dy/d*5,[{kind:'wait',time:8}]);
  }
  if(choice==='calm')for(const c of people)if(c.goal?.id==='street_life'){c.goal=null;c.path=null;c.vx=c.vy=0;c.mode='idle';}
  e.resolved=true;sim.streetLife.heat[e.crew]=Math.max(0,(sim.streetLife.heat[e.crew]??.3)-(choice==='calm'?.2:.08));
  for(const c of people){c.emo.fear=Math.max(0,c.emo.fear-.18);c.emo.frustration=Math.max(0,c.emo.frustration-.15);const r=sim.relate(c,sim.playerId);r.trust=Math.min(1,r.trust+.05);}
  sim.emit({type:'street_incident',x:e.x,y:e.y,actors:[sim.playerId,...e.actors],summary:choice==='calm'?`You helped calm the scene at ${e.area}.`:`You warned bystanders at ${e.area}.`});
  return choice==='calm'?'You talked them down. Tension and fear eased.':'You warned the crowd. People are giving each other space.';
}
export function updateStreetLife(sim:Simulation):void{
  const ride=sim.streetLife.driveBy;
  if(ride){const c=sim.chars[ride.driver],v=sim.vehicles[ride.vehicle],target=sim.chars[ride.target];
   if(!c||!v||!target||sim.tick>ride.until||c.phys!==Phys.OK||!sim.turfWar){if(v&&v.driver===c?.id){v.state='parked';v.speed=0;unseat(sim,v);}sim.streetLife.driveBy=undefined;}
   else if(sim.tick>=ride.nextShot&&ride.shots<3&&Math.hypot(c.x-target.x,c.y-target.y)<9&&sim.world.lineOfSight(c.x,c.y,target.x,target.y)){ride.nextShot=sim.tick+150;if(drawGun(sim,c)&&fireGun(sim,c,target.x,target.y,target.id))ride.shots++;}
  }
  if(sim.tick%300!==0)return;
  ensureStreetCrews(sim);
  if(sim.tick%1200===0)for(const id of Object.keys(sim.streetLife.heat))sim.streetLife.heat[id]=Math.max(0,sim.streetLife.heat[id]-.015);
  if(sim.turfWar&&!sim.streetLife.driveBy&&storyPhase(sim)<8){
   const c=sim.chars.find(c=>c.crew&&free(c)&&(sim.streetLife.heat[c.crew]??0)>.75&&[c.hand,...c.bag].some(id=>sim.toys[id]?.def==='pistol'));
   const target=c?sim.chars.find(t=>t.crew&&t.crew!==c.crew&&t.inside<0&&t.phys===Phys.OK&&Math.hypot(t.x-c.x,t.y-c.y)<14):null;
   const v=c?sim.vehicles.find(v=>v.driver<0&&v.owner<0&&v.state==='drive'&&Math.hypot(v.x-c.x,v.y-c.y)<2.5):null;
   if(c&&target&&v){seat(sim,c,v);sim.streetLife.driveBy={driver:c.id,vehicle:v.id,target:target.id,until:sim.tick+1800,nextShot:sim.tick+120,shots:0};sim.emit({type:'street_incident',x:v.x,y:v.y,actors:[c.id,target.id],summary:'An armed crew vehicle entered the active turf dispute. Bystanders are clearing the street.'});}
  }
  if(sim.tick<sim.streetLife.nextAt)return;
  sim.streetLife.nextAt=sim.tick+60*45+(sim.streetLife.serial%4)*60*10;
  const phase=storyPhase(sim),night=sim.hour>=18||sim.hour<5;
  const list:StreetKind[]=phase>=8?['meetup','nightlife','truce','police']:night?['meetup','dispute','nightlife','intoxication','protection','turf']:['meetup','protection','police','dispute','truce'];
  triggerStreetIncident(sim,list[sim.streetLife.serial%list.length]);
}
