import type {Simulation} from './Simulation';
import type {Character} from '../entities/types';
const available=(c:Character)=>c.tier!=='player'&&c.phys===0&&c.inside<0&&c.inCar<0&&c.arrestedBy<0&&c.pursuing<0&&c.talkWith<0&&c.emo.fear<.4&&!['fight','chase','pursue','gunfight','flee','treat','arrest','steal','work','buy','eat'].includes(c.goal?.id??'');
/** Real nearby residents share conversations; pursuit requires an actual suspect and patrol. */
export function updateCityRoutine(sim:Simulation):void{
 if(sim.tick%300===0&&sim.chars.length){const a=sim.chars[Math.floor(sim.tick/300)%sim.chars.length];
  if(available(a)){const b=sim.chars.find(b=>b!==a&&available(b)&&Math.hypot(b.x-a.x,b.y-a.y)<1.8&&sim.world.lineOfSight(a.x,a.y,b.x,b.y));if(b){const relation=sim.relate(a,b.id);if(relation.grudge<.25&&relation.trust>.1)sim.startConversation(a,b,'chat');}}
 }
 if(sim.tick%60!==0)return;
 for(const v of sim.vehicles){if(v.driver<0||v.driver===sim.playerId||v.state!=='drive')continue;const c=sim.chars[v.driver];if(!c||!['thief','mobster'].includes(c.role))continue;
  const patrol=sim.vehicles.find(p=>p.siren&&p.driver>=0&&sim.chars[p.driver]?.pursuing===c.id&&Math.hypot(v.x-p.x,v.y-p.y)<22);
  if(patrol){v.evadingUntil=sim.tick+300;v.evadingFrom=patrol.id;}
 }
}
