import type { Runner } from './RaceBook';
export interface HorseRunner { distance:number;speed:number;stamina:number;lane:number;reaction:number;pace:number;skill:number;fitness:number;finish:number|null;stride?:number;drafting?:boolean;onBend?:boolean }
export interface HorseRace { start:number;lastTick:number;length:number;wet:boolean;runners:HorseRunner[];finished:boolean;order:number[] }
/** SI units: distance in metres, speed in m/s, game ticks at 60 Hz. */
export function newHorseRace(field:readonly Runner[],tick:number,random=Math.random,wet=false):HorseRace {
 return{start:tick,lastTick:tick,length:600,wet,finished:false,order:[],runners:field.map((r,i)=>({distance:0,speed:0,stamina:.55+r.fitness/220,lane:1+i*.82,reaction:.15+random()*.45,pace:random()*Math.PI*2,skill:r.skill,fitness:r.fitness,finish:null}))};
}
export function advanceHorseRace(race:HorseRace,tick:number){
 if(tick<=race.lastTick||race.finished)return;
 let now=race.lastTick/60,end=tick/60;
 while(now<end&&!race.finished){
  const dt=Math.min(.05,end-now),elapsed=now-race.start/60;
  const previous=race.runners.map(r=>({...r}));
  race.runners.forEach((r,i)=>{
   if(r.finish!==null||elapsed<r.reaction)return;
   const ahead=previous.filter((o,j)=>j!==i&&o.finish===null&&o.distance>r.distance&&o.distance-r.distance<8&&Math.abs(o.lane-r.lane)<.72).sort((a,b)=>a.distance-b.distance)[0];
   let desiredLane=Math.max(.8,r.lane-.14*dt);
   if(ahead&&ahead.speed<r.speed+.3){const outer=r.lane+.85;if(outer<6&&!previous.some((o,j)=>j!==i&&Math.abs(o.distance-r.distance)<3&&Math.abs(o.lane-outer)<.75))desiredLane=outer;}
   r.lane+=Math.max(-.55*dt,Math.min(.55*dt,desiredLane-r.lane));
   const closing=r.distance/race.length>.78,top=14+r.skill*.045+r.fitness*.018;
   const fatigue=.65+.35*Math.min(1,r.stamina/.35),surge=closing&&r.stamina>.15?1.035:1;
   let target=top*fatigue*surge*(1+.024*Math.sin(elapsed*.65+r.pace));
   const course=r.distance%600;r.onBend=course>=150&&course<300||course>=450;
   if(r.onBend)target=Math.min(target,Math.sqrt((race.wet?4.2:6)*(150/Math.PI+r.lane)));
   r.drafting=!!ahead&&ahead.distance-r.distance>2.5&&ahead.distance-r.distance<8;
   if(ahead&&Math.abs(ahead.lane-r.lane)<.72)target=Math.min(target,Math.max(0,ahead.speed+(ahead.distance-r.distance-2.5)*1.5));
   r.speed+=Math.max(-5*dt,Math.min((race.wet?2.15:2.9)*dt,target-r.speed));
   let travelled=r.speed*dt/(1+r.lane*.005);
   if(ahead&&Math.abs(ahead.lane-r.lane)<.72)travelled=Math.min(travelled,Math.max(0,ahead.distance-r.distance-2));
   r.distance+=travelled;r.stride=(r.stride??0)+travelled/(4.5+r.speed*.12);
   r.stamina=Math.max(0,r.stamina-dt*(.0075+r.speed*r.speed*.000024)*(closing?1.1:1)*(r.drafting?.85:1));
   if(r.distance>=race.length){r.finish=elapsed+dt-(r.distance-race.length)/Math.max(r.speed,1);r.distance=race.length;}
  });
  race.order=race.runners.map((r,i)=>({r,i})).filter(a=>a.r.finish!==null).sort((a,b)=>a.r.finish!-b.r.finish!).map(a=>a.i);
  race.finished=race.order.length===race.runners.length;now+=dt;
 }
 race.lastTick=tick;
}
