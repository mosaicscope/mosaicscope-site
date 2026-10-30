import {validElevation,type ElevationTile} from './Elevation';
import type {Simulation} from '../sim/Simulation';
import type {DistrictData} from '../ui/DestinationDistrict';
import {mapMetres} from './MappedWorld';
import {bakeCityDistrict,validDistrict} from './CitySurvey';
import {refreshCityPopulation} from '../sim/MappedTraffic';

/** Prioritize nearby districts, including those intersecting the perspective horizon. */
export function cityDistrictQueue(east:number,north:number,far:boolean):{x:number;y:number;distance:number}[]{
 const cx=Math.round(east/400),cy=Math.round(north/400),radius=far?3:1,out:{x:number;y:number;distance:number}[]=[];
 for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){
  const dx=x*400-east,dy=y*400-north;if(far&&Math.hypot(Math.max(0,Math.abs(dx)-260),Math.max(0,Math.abs(dy)-260))>1000)continue;
  out.push({x,y,distance:Math.hypot(dx,dy)});
 }
 return out.sort((a,b)=>a.distance-b.distance);
}

/** Survey downloads run ahead of the player; rasterization is cooperatively budgeted per frame. */
export class CityStreamer{
 private current?:Simulation;
 private requests=new Map<string,AbortController>();
 private ready=new Map<string,{x:number;y:number}>();
 private retry=new Map<string,number>();
 private jobs:{key:string;data:DistrictData;work:Generator<void>}[]=[];
 private next=0;
 private detailDone=new Set<string>();
 private elevationRequest?:AbortController;private elevationRetry=new Map<string,number>();
 update(sim:Simulation,now:number,perspective=false){
  const m=sim.world.mapped;if(!m)return;
  if(this.current!==sim){this.requests.forEach(c=>c.abort());this.requests.clear();this.jobs=[];this.retry.clear();this.ready.clear();this.detailDone.clear();this.elevationRequest?.abort();this.elevationRequest=undefined;this.elevationRetry.clear();this.current=sim;const c=m.coverage;for(let y=Math.ceil((-c.south+260)/400);y<=Math.floor((-c.north-260)/400);y++)for(let x=Math.ceil((c.west+260)/400);x<=Math.floor((c.east-260)/400);x++)this.ready.set(x+','+y,{x,y});for(const d of m.streamedData??[])this.ready.set(d.cx+','+d.cy,{x:d.cx,y:d.cy});this.next=0;}
  const status=m.streaming??={loading:0,error:null,loaded:[]};
  const end=performance.now()+1;
  // A hard iteration cap also works with coarse privacy timers.
  for(let i=0;i<16&&this.jobs.length&&performance.now()<end;i++){
   const job=this.jobs[0];if(job.work.next().done){this.ready.set(job.key,{x:job.data.cx,y:job.data.cy});this.jobs.shift();sim.world.cityTiles.trim(sim.player.x,sim.player.y,perspective?2048:512);status.error=null;}
  }
  status.loading=this.requests.size+this.jobs.length;
  if(now<this.next)return;this.next=now+1000;
  refreshCityPopulation(sim);
  const p=mapMetres(m,sim.player.x,sim.player.y),cx=Math.round(p.x/400),cy=Math.round(-p.y/400);
  // Coarse Copernicus elevation streams independently of street geometry.
  if(!this.elevationRequest){const grids=m.elevation??=new Map<string,ElevationTile>(),candidates:{x:number;y:number;distance:number}[]=[];for(let dy=-(perspective?2:1);dy<=(perspective?2:1);dy++)for(let dx=-(perspective?2:1);dx<=(perspective?2:1);dx++)candidates.push({x:cx+dx,y:cy+dy,distance:dx*dx+dy*dy});candidates.sort((a,b)=>a.distance-b.distance);
   const next=candidates.find(q=>{const key=q.x+','+q.y;return Math.abs(q.x)<=128&&Math.abs(q.y)<=128&&!grids.has(key)&&(this.elevationRetry.get(key)??0)<=now;});
   if(next){const key=next.x+','+next.y,controller=new AbortController();this.elevationRequest=controller;const timeout=setTimeout(()=>controller.abort(),18000);
    void fetch('/api/city-elevation?x='+next.x+'&y='+next.y,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Elevation unavailable');const tile=await r.json() as ElevationTile;if(!validElevation(tile,next.x,next.y))throw Error('Invalid elevation');if(this.current!==sim)return;grids.set(key,tile);while(grids.size>36)grids.delete(grids.keys().next().value!);}).catch(()=>{if(this.current===sim)this.elevationRetry.set(key,now+60000);}).finally(()=>{clearTimeout(timeout);if(this.elevationRequest===controller)this.elevationRequest=undefined;});
   }
  }
  // The sparse cache covers a moving ~1.4km radius. Revisit districts after their terrain was evicted.
  for(const [key,d]of this.ready)if(Math.abs(d.x-cx)>(perspective?3:1)||Math.abs(d.y-cy)>(perspective?3:1)){if(m.streamedKeys?.has(key))this.ready.delete(key);}
  const queue=cityDistrictQueue(p.x,-p.y,perspective);
  for(const d of queue){if(this.requests.size+this.jobs.length>=2)break;const key=d.x+','+d.y;if(this.ready.has(key)||this.requests.has(key)||this.jobs.some(j=>j.key===key)||(this.retry.get(key)??0)>now)continue;
   const cached=m.data.find(q=>q.cx===d.x&&q.cy===d.y);if(cached){this.jobs.push({key,data:cached,work:bakeCityDistrict(sim.world,cached)});continue;}
   const controller=new AbortController();this.requests.set(key,controller);const timeout=setTimeout(()=>controller.abort(),30000);
   void fetch(`/api/destination-map?code=CHC&x=${d.x}&y=${d.y}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('District map unavailable');const data=await r.json() as DistrictData;if(!validDistrict(data)||data.cx!==d.x||data.cy!==d.y)throw Error('Invalid district map');if(this.current===sim)this.jobs.push({key,data,work:bakeCityDistrict(sim.world,data)});
   }).catch(()=>{if(this.current===sim){this.retry.set(key,now+60000);status.error='Map connection unavailable · exploring remains open';}}).finally(()=>{clearTimeout(timeout);if(this.current===sim)this.requests.delete(key);});
  }
  // Older bundled districts have no barrier field. Fetch only the nearest missing
  // detail in the background; leave the already loaded streets and buildings intact.
  if(this.requests.size+this.jobs.length<2){const d=queue.find(d=>{const key=d.x+','+d.y,cached=m.data.find(t=>t.cx===d.x&&t.cy===d.y);return this.ready.has(key)&&!this.detailDone.has(key)&&!this.requests.has(key)&&!this.jobs.some(j=>j.key===key)&&(this.retry.get(key)??0)<=now&&cached?.barriers===undefined;});
   if(d){const key=d.x+','+d.y,controller=new AbortController();this.requests.set(key,controller);const timeout=setTimeout(()=>controller.abort(),30000);
    void fetch('/api/destination-map?code=CHC&x='+d.x+'&y='+d.y,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Map detail unavailable');const data=await r.json() as DistrictData;if(!validDistrict(data)||data.cx!==d.x||data.cy!==d.y||!Array.isArray(data.barriers))throw Error('Map detail invalid');if(this.current!==sim)return;const existing=m.data.find(t=>t.cx===d.x&&t.cy===d.y);if(existing)existing.barriers=data.barriers;else m.data.push({...data,buildings:[],roads:[],terrain:[],venues:[]});this.detailDone.add(key);m.revision=(m.revision??0)+1;}).catch(()=>{if(this.current===sim)this.retry.set(key,now+60000);}).finally(()=>{clearTimeout(timeout);if(this.current===sim)this.requests.delete(key);});
   }
  }
  status.loaded=[...this.ready.keys()];status.loading=this.requests.size+this.jobs.length;
 }
}
