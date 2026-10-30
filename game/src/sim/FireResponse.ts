import type {Simulation} from './Simulation';
import {makeVehicle,snapToLane} from './Traffic';
import {wound} from './Life';
import {waterDepth} from './WaterPhysics';
/** Bounded response: one fire engine at a time; water particles use the shared liquid pool. */
export function updateFireResponse(sim:Simulation):void{
 const fire=sim.vehicles.find(v=>v.burning&&!v.burnt),truck=sim.vehicles.find(v=>v.cls==='fire'&&v.fireTarget!==undefined);
 if(!fire&&truck){truck.fireTarget=undefined;truck.fireHoseAt=undefined;truck.siren=false;truck.state='parked';truck.speed=0;}
 let engine=truck;
 if(engine&&(!sim.vehicles[engine.fireTarget!]?.burning)){engine.fireTarget=undefined;engine.fireHoseAt=undefined;engine.siren=false;engine.state='parked';engine=undefined;}
 if(fire&&!engine&&sim.tick%60===0){engine=sim.vehicles.filter(v=>v.cls==='fire'&&v.driver<0&&v.owner!==sim.playerId&&!v.burning&&!v.burnt&&v.fireTarget===undefined).sort((a,b)=>Math.hypot(a.x-fire.x,a.y-fire.y)-Math.hypot(b.x-fire.x,b.y-fire.y))[0];
  if(!engine){for(let r=12;r<=25&&!engine;r+=2)for(let a=0;a<24&&!engine;a++){const x=fire.x+Math.cos(a*Math.PI/12)*r,y=fire.y+Math.sin(a*Math.PI/12)*r;if(sim.world.drivable(x,y)&&!sim.vehicles.some(v=>Math.hypot(v.x-x,v.y-y)<4))engine=makeVehicle(sim,'fire',x,y,0,'parked');}}
  if(engine){engine.fireTarget=fire.id;engine.siren=true;engine.state='drive';if(!snapToLane(sim,engine)){engine.fireTarget=undefined;engine.siren=false;engine.state='parked';engine=undefined;}}
 }
 if(engine){const target=sim.vehicles[engine.fireTarget!];if(target&&Math.hypot(engine.x-target.x,engine.y-target.y)<8){engine.state='parked';engine.speed=0;engine.vx=engine.vy=0;engine.fireHoseAt??=sim.tick;
   const dx=target.x-engine.x,dy=target.y-engine.y,d=Math.hypot(dx,dy)||1;sim.liquids.spray('water',engine.x,engine.y,1,dx/d*7,dy/d*7,4);
   if(sim.tick-engine.fireHoseAt>=360){target.burning=false;target.heat=0;target.burnTime=0;engine.fireTarget=undefined;engine.fireHoseAt=undefined;engine.siren=false;}
  }}
 const fires=sim.vehicles.filter(v=>v.burning);if(!fires.length&&!sim.chars.some(c=>(c.fireUntil??0)>sim.tick))return;
 for(const c of sim.chars){if(c.inside>=0||c.inCar>=0)continue;const close=fires.some(v=>Math.hypot(v.x-c.x,v.y-c.y)<1.3);
  if(close&&(c.fireUntil??0)<=sim.tick){c.fireUntil=sim.tick+360;c.emo.fear=1;sim.say(c,'Help! Fire!', 'shout',2);}
  if((c.fireUntil??0)>sim.tick){if(waterDepth(sim.world,c.x,c.y)>.15){c.fireUntil=sim.tick;continue;}c.emo.fear=1;
   if((c.fireWoundAt??0)<=sim.tick){wound(sim,c,'torso',1,'bruise',-1,c.x,c.y);c.fireWoundAt=sim.tick+180;}}
 }
}
