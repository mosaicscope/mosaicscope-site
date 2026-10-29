import {updateNearbyScenes} from './NearbyScenes';
import type {Simulation} from './Simulation';
import type {Character} from '../entities/types';
import {peek} from '../social/Social';
import {MOSAIC_BARS,STREET_NEIGHBOURS} from '../content/streetVoices';
const available=(c:Character)=>c.tier!=='player'&&c.phys===0&&c.inside<0&&c.inCar<0&&c.arrestedBy<0&&c.pursuing<0&&c.talkWith<0&&c.emo.fear<.4&&!['fight','chase','pursue','gunfight','flee','treat','arrest','steal','work','buy','eat'].includes(c.goal?.id??'');
/** Real nearby residents share conversations; pursuit requires an actual suspect and patrol. */
export function updateCityRoutine(sim:Simulation):void{
 updateNearbyScenes(sim);
 if(sim.world.mapped&&sim.tick%240===0){
  const voices=sim.chars.filter(c=>available(c)&&Math.hypot(c.x-sim.player.x,c.y-sim.player.y)<42&&(c.tier==='principal'||STREET_NEIGHBOURS.some(n=>n.name===c.name)));
  if(voices.length){const c=voices[Math.floor(sim.tick/240)%voices.length],neighbour=STREET_NEIGHBOURS.find(n=>n.name===c.name);
   sim.say(c,neighbour?.line??MOSAIC_BARS[Math.floor(sim.tick/240)%MOSAIC_BARS.length],'say',4);
  }
 }
 if(sim.tick%180===0&&sim.player.inside<0){
  // Restrict the search to nearby idle people and cap new conversations per update.
  const candidates=sim.chars.filter(c=>available(c)&&(!c.goal||['wander','idle','socialize'].includes(c.goal.id))&&Math.hypot(c.x-sim.player.x,c.y-sim.player.y)<32&&sim.world.walkable(c.x,c.y)&&!sim.world.carriageway(c.x,c.y)).slice(0,48);
  let started=0;for(let i=0;i<candidates.length&&started<2;i++){const a=candidates[(i+Math.floor(sim.tick/180))%candidates.length];if(!available(a))continue;
   const b=candidates.find(b=>b!==a&&available(b)&&Math.hypot(b.x-a.x,b.y-a.y)<1.8&&sim.world.lineOfSight(a.x,a.y,b.x,b.y)&&(peek(a,b.id)?.grudge??0)<.25);
   if(b&&sim.startConversation(a,b,'chat')){a.vx=a.vy=b.vx=b.vy=0;sim.lod.markHot(a.id,sim.tick,60*15);sim.lod.markHot(b.id,sim.tick,60*15);started++;}
  }
 }
 if(sim.tick%60!==0)return;
 for(const v of sim.vehicles){if(v.driver<0||v.driver===sim.playerId||v.state!=='drive')continue;const c=sim.chars[v.driver];if(!c||!['thief','mobster'].includes(c.role))continue;
  const patrol=sim.vehicles.find(p=>p.siren&&p.driver>=0&&sim.chars[p.driver]?.pursuing===c.id&&Math.hypot(v.x-p.x,v.y-p.y)<22);
  if(patrol){v.evadingUntil=sim.tick+300;v.evadingFrom=patrol.id;}
 }
}
