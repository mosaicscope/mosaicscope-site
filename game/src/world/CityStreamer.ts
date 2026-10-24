import type {Simulation} from '../sim/Simulation';
import type {DistrictData} from '../ui/DestinationDistrict';
import {mapMetres} from './MappedWorld';
import {bakeCityDistrict,validDistrict} from './CitySurvey';
import {refreshCityPopulation} from '../sim/MappedTraffic';

/** Survey downloads run ahead of the player; rasterization is cooperatively budgeted per frame. */
export class CityStreamer{
 private current?:Simulation;
 private requests=new Map<string,AbortController>();
 private ready=new Map<string,{x:number;y:number}>();
 private retry=new Map<string,number>();
 private jobs:{key:string;data:DistrictData;work:Generator<void>}[]=[];
 private next=0;
 update(sim:Simulation,now:number){
  const m=sim.world.mapped;if(!m)return;
  if(this.current!==sim){this.requests.forEach(c=>c.abort());this.requests.clear();this.jobs=[];this.retry.clear();this.ready.clear();this.current=sim;const c=m.coverage;for(let y=Math.ceil((-c.south+260)/400);y<=Math.floor((-c.north-260)/400);y++)for(let x=Math.ceil((c.west+260)/400);x<=Math.floor((c.east-260)/400);x++)this.ready.set(x+','+y,{x,y});for(const d of m.streamedData??[])this.ready.set(d.cx+','+d.cy,{x:d.cx,y:d.cy});this.next=0;}
  const status=m.streaming??={loading:0,error:null,loaded:[]};
  const end=performance.now()+1;
  // A hard iteration cap also works with coarse privacy timers.
  for(let i=0;i<16&&this.jobs.length&&performance.now()<end;i++){
   const job=this.jobs[0];if(job.work.next().done){this.ready.set(job.key,{x:job.data.cx,y:job.data.cy});this.jobs.shift();sim.world.cityTiles.trim(sim.player.x,sim.player.y);status.error=null;}
  }
  status.loading=this.requests.size+this.jobs.length;
  if(now<this.next)return;this.next=now+1000;
  refreshCityPopulation(sim);
  const p=mapMetres(m,sim.player.x,sim.player.y),cx=Math.round(p.x/400),cy=Math.round(-p.y/400);
  // The sparse cache covers a moving ~1.4km radius. Revisit districts after their terrain was evicted.
  for(const [key,d]of this.ready)if(Math.abs(d.x-cx)>1||Math.abs(d.y-cy)>1){if(m.streamedKeys?.has(key))this.ready.delete(key);}
  const queue:{x:number;y:number;distance:number}[]=[];
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)queue.push({x,y,distance:Math.hypot(x*400-p.x,-y*400-p.y)});
  queue.sort((a,b)=>a.distance-b.distance);
  for(const d of queue){if(this.requests.size+this.jobs.length>=2)break;const key=d.x+','+d.y;if(this.ready.has(key)||this.requests.has(key)||this.jobs.some(j=>j.key===key)||(this.retry.get(key)??0)>now)continue;
   const cached=m.data.find(q=>q.cx===d.x&&q.cy===d.y);if(cached){this.jobs.push({key,data:cached,work:bakeCityDistrict(sim.world,cached)});continue;}
   const controller=new AbortController();this.requests.set(key,controller);const timeout=setTimeout(()=>controller.abort(),30000);
   void fetch(`/api/destination-map?code=CHC&x=${d.x}&y=${d.y}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('District map unavailable');const data=await r.json() as DistrictData;if(!validDistrict(data)||data.cx!==d.x||data.cy!==d.y)throw Error('Invalid district map');if(this.current===sim)this.jobs.push({key,data,work:bakeCityDistrict(sim.world,data)});
   }).catch(()=>{if(this.current===sim){this.retry.set(key,now+60000);status.error='Map connection unavailable · exploring remains open';}}).finally(()=>{clearTimeout(timeout);if(this.current===sim)this.requests.delete(key);});
  }
  status.loaded=[...this.ready.keys()];status.loading=this.requests.size+this.jobs.length;
 }
}
