import type {Simulation} from './Simulation';
import type {Character,Step} from '../entities/types';
import type {StreetIncident,StreetKind} from './StreetLife';
export const NEARBY_KINDS=['busking','cafe_queue','neighbours','cleanup','nightout'] as const;
export const isNearbyScene=(e:StreetIncident)=>NEARBY_KINDS.includes(e.kind as typeof NEARBY_KINDS[number]);
const free=(c:Character)=>c.tier!=='player'&&!c.crew&&!['cop','paramedic','mobster','thief'].includes(c.role)&&c.inside<0&&c.inCar<0&&c.phys===0&&c.arrestedBy<0&&c.jailUntil<=0&&c.talkWith<0&&c.pursuing<0&&c.emo.fear<.4&&(!c.goal||['wander','idle','socialize','busk'].includes(c.goal.id));
export function activeNearbyScenes(s:Simulation):StreetIncident[]{return s.streetLife.history.filter(e=>isNearbyScene(e)&&!e.resolved&&e.until>s.tick&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<45&&e.actors.some(id=>{const c=s.chars[id];return c&&c.inside<0&&c.inCar<0&&c.phys===0&&Math.hypot(c.x-e.x,c.y-e.y)<7;}));}
/** Existing casts on pavement; time, weather and mapped venue types determine the scene. */
export function startNearbyScene(s:Simulation,requested?:StreetKind):StreetIncident|null{
 const active=activeNearbyScenes(s);if(s.player.inside>=0||s.player.inCar>=0||active.length>=2)return null;
 const people=s.chars.filter(c=>free(c)&&Math.hypot(c.x-s.player.x,c.y-s.player.y)<28&&s.world.walkable(c.x,c.y)&&!s.world.carriageway(c.x,c.y)&&!s.world.buildingAt(Math.floor(c.x),Math.floor(c.y))).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y));
 const night=s.hour>=18||s.hour<6,choices=requested?[requested]:Array.from({length:5},(_,i)=>NEARBY_KINDS[(s.streetLife.serial+i)%5]);
 for(const kind of choices){if(!NEARBY_KINDS.includes(kind as typeof NEARBY_KINDS[number])||kind==='nightout'&&!night||kind==='cafe_queue'&&(s.hour<7||s.hour>=18)||['cleanup','busking'].includes(kind)&&s.env.raining)continue;
 const lead=people.find(c=>(kind==='busking'&&(c.role==='busker'||c.goal?.id==='busk')||people.some(o=>o!==c&&Math.hypot(o.x-c.x,o.y-c.y)<10&&s.world.lineOfSight(o.x,o.y,c.x,c.y)))&&(kind!=='cleanup'||s.litter.pieces.some(p=>!p.taken&&Math.hypot(p.x-c.x,p.y-c.y)<2))&&!active.some(e=>Math.hypot(e.x-c.x,e.y-c.y)<8)&&(!(kind==='cafe_queue'||kind==='nightout')||s.world.buildings.some(b=>(kind==='cafe_queue'?['cafe','bakery','diner','dairy']:['nightclub','stripclub','velvet','casino','hotel']).includes(b.kind)&&Math.hypot(b.door.x-c.x,b.door.y-c.y)<6)));
 if(!lead)continue;const cast=people.filter(c=>Math.hypot(c.x-lead.x,c.y-lead.y)<10&&s.world.lineOfSight(c.x,c.y,lead.x,lead.y)).slice(0,kind==='busking'?3:2);if(cast.length<(kind==='busking'?1:2))continue;
 const titles:Record<string,string>={busking:'Footpath freestyle',cafe_queue:'Coffee queue catch-up',neighbours:'Neighbours on the corner',cleanup:'A quick street tidy',nightout:'Friends heading out'};
 const lines:Record<string,string>={busking:'Got a verse about the city? Come listen or tip the performer.',cafe_queue:'Two locals compare their coffee orders while keeping the doorway clear.',neighbours:'Neighbours stop for a chat about the week. Say hello.',cleanup:'Locals tidy the pavement together. Lend a hand.',nightout:'Friends meet outside before their night out. Join the conversation.'};
 const e:StreetIncident={id:++s.streetLife.serial,kind,crew:'',x:lead.x,y:lead.y,area:s.world.streetName(lead.x,lead.y)||'Nearby footpath',actors:cast.map(c=>c.id),started:s.tick,until:s.tick+60*40,title:titles[kind],line:lines[kind],resolved:false};
 s.streetLife.history.push(e);s.streetLife.history=s.streetLife.history.slice(-24);
 cast.forEach((c,i)=>{const p=s.world.nearestFoot(lead.x+(i?1.1:0),lead.y+(i?.7:0),3);if(Math.hypot(p.x-lead.x,p.y-lead.y)>4)return;const steps:Step[]=[{kind:'goto',x:p.x,y:p.y},{kind:'street_say',text:i===0?(kind==='busking'?'Same old streets, new day to try. Keep your people close as the world goes by.':lines[kind]):'Good to see you out here.'},kind==='busking'&&i===0?{kind:'busk',x:p.x,y:p.y,time:30}:{kind:'wait',time:30,text:kind==='cleanup'?'clean':kind==='busking'?'clap':'talk'}];c.goal={id:'nearby_scene',target:-1,plan:steps,stepIdx:0,stepTimer:0,started:s.tick,replans:0};c.mode='goal';c.path=null;c.pathReq=0;c.nextThink=s.tick;s.lod.markHot(c.id,s.tick,60*45);});
 s.emit({type:'street_incident',x:e.x,y:e.y,actors:e.actors,summary:e.title+' · '+e.area+'. '+e.line});return e;
 }return null;
}
export function joinNearbyScene(s:Simulation,id:number):string{
 const e=activeNearbyScenes(s).find(e=>e.id===id);if(!e)return 'That scene has finished.';
 const p=s.player;if(p.inside>=0||p.inCar>=0||p.phys!==0||p.arrestedBy>=0||p.jailUntil>s.tick)return 'Step outside on foot when you are free to join in.';
 if(Math.hypot(p.x-e.x,p.y-e.y)>4)return 'Walk closer to the people first.';
 const lead=s.chars[e.actors[0]];if(!lead||lead.inside>=0||lead.inCar>=0||lead.phys!==0||Math.hypot(lead.x-p.x,lead.y-p.y)>4)return 'The people have moved on.';
 if(e.kind==='cleanup'){const piece=s.litter.pieces.find(l=>!l.taken&&Math.hypot(l.x-p.x,l.y-p.y)<3&&Math.hypot(l.x-e.x,l.y-e.y)<3);if(!piece)return 'The pavement here is already tidy.';piece.taken=true;}
 if(e.kind==='busking'){if(p.cash<2)return 'You need $2 in game cash to tip.';p.cash-=2;lead.cash+=2;}
 for(const id of e.actors){const c=s.chars[id];if(c){const r=s.relate(c,p.id);r.trust=Math.min(1,r.trust+.06);}}
 p.needs.fun=Math.min(1,p.needs.fun+.08);s.say(lead,e.kind==='busking'?'Cheers for supporting a local!':'Thanks for stopping. Good to meet you.','say',4);e.resolved=true;
 return e.kind==='busking'?'You tipped $2. The performer thanks you.':e.kind==='cleanup'?'You help tidy the pavement and meet your neighbours.':'You join the conversation and get to know the locals.';
}
export function updateNearbyScenes(s:Simulation):void{
 if(!s.world.mapped||s.tick%300!==0)return;
 for(const e of s.streetLife.history.filter(isNearbyScene))if(e.until<=s.tick)for(const id of e.actors){const c=s.chars[id];if(c?.goal?.id==='nearby_scene'&&c.goal.started===e.started){c.goal=null;c.path=null;c.vx=c.vy=0;c.anim.pose='auto';}}
 if(s.streetLife.history.some(e=>isNearbyScene(e)&&s.tick-e.started<1200))return;startNearbyScene(s);
}
