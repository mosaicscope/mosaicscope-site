import {mappedLanes,mappedSpeed,roadOneWay} from '../content/roadLayout';
import {World,T,type Building} from './World';
import {mappedPoint,polygonContains} from './MappedWorld';
import {roadHalfWidth} from '../content/destinationTerrain';
import {BUILDINGS,GROUND_H,FLOOR_H,type BuildingKind} from '../content/buildings';
import {mappedBuildingStyle,regionalArchitecture} from '../content/mappedBuildingStyle';
import type {DistrictData,MappedBuilding} from '../ui/DestinationDistrict';

export function validDistrict(d:DistrictData):boolean{
 if(!d||d.code!=='CHC'||!Number.isInteger(d.cx)||!Number.isInteger(d.cy)||!Array.isArray(d.buildings)||!Array.isArray(d.roads)||d.buildings.length>300||d.roads.length>400||d.terrain!==undefined&&!Array.isArray(d.terrain)||(d.terrain?.length??0)>300)return false;
 const points=(p:number[][])=>Array.isArray(p)&&p.length>=2&&p.length<=5000&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6));
 return [...d.buildings,...d.roads,...(d.terrain??[])].every(b=>b&&Number.isSafeInteger(b.id)&&typeof b.kind==='string'&&b.tags&&typeof b.tags==='object'&&points(b.points))&&d.buildings.every(b=>b.points.length>=3&&Number.isFinite(b.height)&&b.height>0&&b.height<=180&&Math.max(...b.points.map(p=>p[0]))-Math.min(...b.points.map(p=>p[0]))<2000&&Math.max(...b.points.map(p=>p[1]))-Math.min(...b.points.map(p=>p[1]))<2000)&&(d.terrain??[]).every(t=>!t.holes||Array.isArray(t.holes)&&t.holes.length<100&&t.holes.every(points));
}
export function registerCityBuilding(w:World,source:MappedBuilding){const m=w.mapped!;let id=m.buildingIds.get(source.id);if(id!==undefined)return id;
 id=w.buildings.length;const points=source.points.map(p=>mappedPoint(m,p[0],p[1])),style=mappedBuildingStyle(source),arch=regionalArchitecture(source.tags),raw=source.kind;
 const kind:BuildingKind=raw in BUILDINGS?raw as BuildingKind:raw==='restaurant'||raw==='fast_food'?'diner':raw==='pub'||raw==='bar'?'nightclub':'office';
 const x0=Math.floor(Math.min(...points.map(p=>p.x))),y0=Math.floor(Math.min(...points.map(p=>p.y))),x1=Math.ceil(Math.max(...points.map(p=>p.x))),y1=Math.ceil(Math.max(...points.map(p=>p.y)));
 const b:Building={id,kind,name:source.name||source.tags.address||'Christchurch building',x0,y0,x1,y1,floors:style.floors,height:GROUND_H+(style.floors-1)*FLOOR_H,color:arch.wall,roof:arch.roof,sign:BUILDINGS[kind].sign,facadeMaterial:arch.material,roofShape:arch.shape,door:{x:Math.floor((x0+x1)/2),y:y1,face:'s'},area:0,billboard:false};
 w.buildings.push(b);m.buildings.push(source);m.byBuilding.set(id,source);m.buildingIds.set(source.id,id);m.damageFootprints.push({...source,points:points.map(p=>[p.x,p.y])});
 (m.streamedBuildingIds??=new Set()).add(id);return id;
}
/** Cooperative rasterizer: at most 256 candidate cells between yields, so loading never owns a whole frame. */
export function* bakeCityDistrict(w:World,d:DistrictData):Generator<void>{
 const m=w.mapped;if(!m||!validDistrict(d))return;let operations=0;
 const surveyed=(x:number,y:number)=>{const mx=(x-m.offsetX)*2,my=(y-m.offsetY)*2,c=m.coverage;return mx>=c.west&&mx<=c.east&&my>=c.north&&my<=c.south;};
 const put=(x:number,y:number,t:number,id=-1)=>{if(surveyed(x,y))return;w.set(x,y,t);if(id>=0){if(w.coreContains(x,y))w.buildingOf[y*w.size+x]=id;else w.cityTiles.set(x,y,t,id);}};
 function* polygon(points:number[][],t:number,holes:number[][][]=[],id=-1){if(points.length<3)return;const p=points.map(p=>mappedPoint(m!,p[0],p[1])),hh=holes.map(h=>h.map(p=>{const q=mappedPoint(m!,p[0],p[1]);return[q.x,q.y];})),xy=p.map(p=>[p.x,p.y]),x0=Math.floor(Math.min(...p.map(p=>p.x))),x1=Math.ceil(Math.max(...p.map(p=>p.x))),y0=Math.floor(Math.min(...p.map(p=>p.y))),y1=Math.ceil(Math.max(...p.map(p=>p.y)));
  // Upstream may include a very large polygon; raster only this district and its seam overlap.
  const centre=mappedPoint(m!,d.cx*400,-d.cy*400),radius=150;
  for(let y=Math.max(y0,Math.floor(centre.y-radius));y<=Math.min(y1,centre.y+radius);y++)for(let x=Math.max(x0,Math.floor(centre.x-radius));x<=Math.min(x1,centre.x+radius);x++){if(polygonContains(x+.5,y+.5,xy)&&!hh.some(h=>polygonContains(x+.5,y+.5,h)))put(x,y,t,id);if(++operations%256===0)yield;}
 }
 for(const terrain of d.terrain??[])if(['green','water','sand'].includes(terrain.kind))yield*polygon(terrain.points,terrain.kind==='water'?T.WATER:terrain.kind==='sand'?T.SAND:T.GRASS,terrain.holes??[]);
 for(const road of d.roads){const walk=['path','footway','pedestrian','cycleway','steps','corridor','platform'].includes(road.kind),half=roadHalfWidth(road)/2;
  for(let i=1;i<road.points.length;i++){const a=mappedPoint(m,road.points[i-1][0],road.points[i-1][1]),b=mappedPoint(m,road.points[i][0],road.points[i][1]),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;
   const centre=mappedPoint(m,d.cx*400,-d.cy*400);
   for(let y=Math.max(Math.floor(Math.min(a.y,b.y)-half-1.3),Math.floor(centre.y-150));y<=Math.min(Math.max(a.y,b.y)+half+1.3,centre.y+150);y++)for(let x=Math.max(Math.floor(Math.min(a.x,b.x)-half-1.3),Math.floor(centre.x-150));x<=Math.min(Math.max(a.x,b.x)+half+1.3,centre.x+150);x++){
    const u=Math.max(0,Math.min(len,((x+.5-a.x)*dx+(y+.5-a.y)*dy)/len)),distance=Math.hypot(x+.5-a.x-dx/len*u,y+.5-a.y-dy/len*u);
    if(distance<half+1.3&&(w.tile(x,y)!==T.WATER||road.tags?.bridge==='yes')){if(distance<half)put(x,y,walk?T.PATH:T.ROAD);else if(!w.carriageway(x,y))put(x,y,T.SIDEWALK);}if(++operations%256===0)yield;
   }
  }
 }
 for(const b of d.buildings){const id=registerCityBuilding(w,b);yield*polygon(b.points,T.BUILDING,[],id);}
 for(const b of d.buildings){const id=m.buildingIds.get(b.id)!,physical=w.buildings[id];if(m.streamedBuildingIds?.has(id)){
   const foot=w.nearestFoot(physical.door.x+.5,physical.door.y+.5,16);physical.door.x=Math.floor(foot.x);physical.door.y=Math.floor(foot.y);
   if(!w.pois.some(p=>p.kind==='door'&&p.building===id))w.pois.push({id:w.pois.length,kind:'door',x:foot.x,y:foot.y,area:0,building:id,name:physical.name,menu:BUILDINGS[physical.kind].menu});
  }}
 const key=d.cx+','+d.cy;m.streamedData??=[];if(!m.streamedData.some(p=>p.cx===d.cx&&p.cy===d.cy))m.streamedData.push(d);
 while(m.streamedData.length>32)m.streamedData.shift();
 const base=m.data.filter(d=>!m.streamedKeys?.has(d.cx+','+d.cy)&&d.cx+','+d.cy!==key);m.streamedKeys??=new Set();m.streamedKeys.add(key);m.data=[...base,...m.streamedData];
 const roadIds=new Set(m.roads.map(r=>r.id));for(const r of d.roads){if(roadIds.has(r.id))continue;m.roads.push(r);roadIds.add(r.id);if(['path','footway','pedestrian','cycleway','steps','corridor','platform'].includes(r.kind))continue;for(let i=1;i<r.points.length;i++){const a=mappedPoint(m,r.points[i-1][0],r.points[i-1][1]),b=mappedPoint(m,r.points[i][0],r.points[i][1]),length=Math.hypot(b.x-a.x,b.y-a.y);if(length>.25)m.streetSegments.push({id:r.id,name:r.name,kind:r.kind,x:a.x,y:a.y,dx:(b.x-a.x)/length,dy:(b.y-a.y)/length,length,half:roadHalfWidth(r)/2,oneway:roadOneWay(r),lanes:mappedLanes(r,roadHalfWidth(r)),speed:mappedSpeed(r)});}}
 // Fixtures are game dressing on surveyed footpaths; keep entrances and traffic clear.
 for(const road of d.roads){if(['motorway','trunk','steps'].includes(road.kind)||!road.points.length)continue;const tag='survey-fixture:'+road.id;if(w.pois.some(p=>p.name===tag))continue;
  const a=mappedPoint(m,road.points[0][0],road.points[0][1]),b=mappedPoint(m,road.points[1][0],road.points[1][1]),length=Math.hypot(b.x-a.x,b.y-a.y);if(length<8)continue;const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length,off=roadHalfWidth(road)/2+.8;
  const x=a.x+dx*5-dy*off,y=a.y+dy*5+dx*off;if(surveyed(x,y)||!w.walkable(x,y)||w.carriageway(x,y)||w.pois.some(p=>Math.hypot(p.x-x,p.y-y)<3))continue;
  w.pois.push({id:w.pois.length,kind:road.kind==='pedestrian'?'bench':'lamp',x,y,area:0,on:true,name:tag});
 }
 m.revision=(m.revision??0)+1;
}
