import {mappedLanes,mappedSpeed,roadOneWay} from '../content/roadLayout';
import snapshot from './christchurch.json';
import {World,T,type Building,type Area} from './World';
import {BUILDINGS,GROUND_H,FLOOR_H,type BuildingKind} from '../content/buildings';
import {mappedBuildingStyle,regionalArchitecture} from '../content/mappedBuildingStyle';
import {roadHalfWidth,type MappedRoad,type MappedTerrain} from '../content/destinationTerrain';
import type {DistrictData,MappedBuilding,MappedVenue} from '../ui/DestinationDistrict';

export interface CitySegment {id:number;name:string;kind:string;x:number;y:number;dx:number;dy:number;length:number;half:number;oneway:number;speed:number;lanes?:{sign:number;offset:number}[]}
export interface MappedCity {
 version:number;metresPerTile:number;offsetX:number;offsetY:number;data:DistrictData[];
 buildings:MappedBuilding[];byBuilding:Map<number,MappedBuilding>;buildingIds:Map<number,number>;
 roads:MappedRoad[];terrain:MappedTerrain[];venues:MappedVenue[];streetSegments:CitySegment[];
 origin:{lat:number;lon:number};coverage:typeof snapshot.coverage;
 damageFootprints:import('../sim/MappedFacadeDamage').DamageFootprint[];
 visibility:{aerialRoofs?:boolean;labels:boolean;traffic:boolean;people:boolean;fixtures:boolean;weather:boolean};
 liveConditions?:import('../ui/LiveCity').LiveCityData;
 closedRoads?:Set<number>;
 trafficMode?:'cruise'|'city'|'rush';
 revision?:number;
 streaming?:{loading:number;error:string|null;loaded:string[]};
 streamedData?:DistrictData[];streamedKeys?:Set<string>;streamedBuildingIds?:Set<number>;
}
export function polygonContains(x:number,y:number,points:number[][]):boolean{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const unique=<T extends {id:number}>(items:T[])=>[...new Map(items.map(b=>[b.id,b])).values()];
export const mappedPoint=(m:MappedCity,x:number,y:number)=>({x:x/m.metresPerTile+m.offsetX,y:y/m.metresPerTile+m.offsetY});
export const mapMetres=(m:MappedCity,x:number,y:number)=>({x:(x-m.offsetX)*m.metresPerTile,y:(y-m.offsetY)*m.metresPerTile});
const bounds=(points:number[][])=>({x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))});
const centroid=(b:MappedBuilding)=>{const p=b.points,close=p.length>1&&p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1]?p.slice(0,-1):p;return{x:close.reduce((n,p)=>n+p[0],0)/close.length,y:close.reduce((n,p)=>n+p[1],0)/close.length};};
const playable=(kind:string):BuildingKind=>kind==='house'||kind==='apartments'?kind:kind==='hotel'?'hotel':['cafe','bakery','bank','police','hospital'].includes(kind)?kind as BuildingKind:kind==='restaurant'||kind==='fast_food'?'diner':kind==='bar'||kind==='pub'?'nightclub':kind==='car'?'dealership':'office';

/** Actual OSM centre lines/footprints at 2 metres per simulation tile. No generated road grid. */
export function mappedChristchurch(legacy:World):World{
 const {west,east,north,south}=snapshot.coverage,metresPerTile=2,pad=8,size=Math.ceil(Math.max(east-west,south-north)/2)+pad*2,w=new World(size);
 const data=snapshot.tiles as unknown as DistrictData[],inCoverage=(p:{x:number;y:number})=>p.x>=west&&p.x<=east&&p.y>=north&&p.y<=south;
 const buildings=unique(data.flatMap(d=>d.buildings)).filter(b=>b.tags.building!=='no'&&b.points.length>=4&&inCoverage(centroid(b))).sort((a,b)=>a.id-b.id);
 const m:MappedCity={version:snapshot.version,metresPerTile,offsetX:pad-west/2,offsetY:pad-north/2,data,buildings,byBuilding:new Map(),buildingIds:new Map(),roads:unique(data.flatMap(d=>d.roads)),terrain:unique(data.flatMap(d=>d.terrain??[])),venues:unique(data.flatMap(d=>d.venues)),streetSegments:[],damageFootprints:[],visibility:{labels:true,traffic:true,people:true,fixtures:true,weather:true},origin:{lat:-43.5309,lon:172.6366},coverage:snapshot.coverage};w.mapped=m;
 m.damageFootprints=buildings.map(b=>({...b,points:b.points.map(p=>{const q=mappedPoint(m,p[0],p[1]);return[q.x,q.y];})}));
 w.tiles.fill(T.PAVE);w.blocked=new Uint8Array(size*size);
 const put=(x:number,y:number,t:number)=>{if(w.inBounds(x,y))w.tiles[y*size+x]=t;};
 const raster=(points:number[][],t:number,holes:number[][][]=[],id=-1)=>{const pts=points.map(p=>{const q=mappedPoint(m,p[0],p[1]);return[q.x,q.y];}),b=bounds(pts),hh=holes.map(h=>h.map(p=>{const q=mappedPoint(m,p[0],p[1]);return[q.x,q.y];}));
  for(let y=Math.max(pad,Math.floor(b.y0));y<=Math.min(size-pad-1,Math.ceil(b.y1));y++)for(let x=Math.max(pad,Math.floor(b.x0));x<=Math.min(size-pad-1,Math.ceil(b.x1));x++)if(polygonContains(x+.5,y+.5,pts)&&!hh.some(h=>polygonContains(x+.5,y+.5,h))){put(x,y,t);if(id>=0)w.buildingOf[y*size+x]=id;}
 };
 // Land cover is surveyed data. Water remains solid except where a mapped bridge crosses it.
 for(const t of m.terrain)if(t.kind==='green'||t.kind==='sand')raster(t.points,t.kind==='green'?T.GRASS:T.SAND,t.holes);
 for(const t of m.terrain)if(t.kind==='water')raster(t.points,T.WATER,t.holes);
 const roadStroke=(r:MappedRoad,extra:number,pavement:boolean)=>{const walk=['path','footway','pedestrian','steps','cycleway','corridor'].includes(r.kind),half=roadHalfWidth(r)/2+extra;
  for(let i=1;i<r.points.length;i++){const a=mappedPoint(m,...r.points[i-1] as [number,number]),b=mappedPoint(m,...r.points[i] as [number,number]),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;
   for(let y=Math.max(pad,Math.floor(Math.min(a.y,b.y)-half));y<=Math.min(size-pad-1,Math.ceil(Math.max(a.y,b.y)+half));y++)for(let x=Math.max(pad,Math.floor(Math.min(a.x,b.x)-half));x<=Math.min(size-pad-1,Math.ceil(Math.max(a.x,b.x)+half));x++){const u=Math.max(0,Math.min(1,((x+.5-a.x)*dx+(y+.5-a.y)*dy)/(len*len)));if(Math.hypot(x+.5-a.x-dx*u,y+.5-a.y-dy*u)>half)continue;const old=w.tile(x,y);if(old===T.WATER&&!(r.tags?.bridge && r.tags.bridge!=='no'))continue;if(pavement){if(old!==T.ROAD)put(x,y,walk?T.PATH:T.SIDEWALK);}else put(x,y,walk?T.PATH:T.ROAD);}
   if(!pavement&&!walk&&r.tags?.access!=='no')m.streetSegments.push({id:r.id,name:r.name,kind:r.kind,x:a.x,y:a.y,dx:dx/len,dy:dy/len,length:len,half:roadHalfWidth(r)/2,oneway:roadOneWay(r),lanes:mappedLanes(r,roadHalfWidth(r)),speed:mappedSpeed(r)});
  }
 };
 for(const r of m.roads)roadStroke(r,1.3,true);for(const r of m.roads)roadStroke(r,0,false);
 // Match the painted crossing strips to pedestrian navigation and collision tiles.
 const junctions=new Map<string,number>();for(const s of m.streetSegments)for(const p of[[s.x,s.y],[s.x+s.dx*s.length,s.y+s.dy*s.length]]){const key=p[0].toFixed(2)+','+p[1].toFixed(2);junctions.set(key,(junctions.get(key)??0)+1);}
 for(const s of m.streetSegments)for(const end of[0,1]){const x=s.x+s.dx*s.length*end,y=s.y+s.dy*s.length*end;if((junctions.get(x.toFixed(2)+','+y.toFixed(2))??0)<3||s.length<6)continue;const at=end?s.length-5.5:5.5,cx=s.x+s.dx*at,cy=s.y+s.dy*at;for(let yy=Math.floor(cy-s.half-2);yy<=cy+s.half+2;yy++)for(let xx=Math.floor(cx-s.half-2);xx<=cx+s.half+2;xx++){const along=(xx+.5-cx)*s.dx+(yy+.5-cy)*s.dy,cross=-(xx+.5-cx)*s.dy+(yy+.5-cy)*s.dx;if(Math.abs(along)<1.4&&Math.abs(cross)<s.half&&w.tile(xx,yy)===T.ROAD)put(xx,yy,T.CROSSWALK);}}
 // Preserve stable gameplay IDs, ownership and story services while assigning them to real footprints.
 const used=new Set<number>(),assigned=new Map<number,MappedBuilding>(),centres=new Map(buildings.map(b=>[b.id,centroid(b)]));
 const named=(pattern:RegExp)=>{const b=buildings.find(b=>pattern.test(b.name));if(b){const p=centroid(b);return[p.x,p.y];}return m.venues.find(v=>pattern.test(v.name)&&!['bus_stop','bus_station'].includes(v.kind)&&!(/stop|station/i.test(v.name)))?.point;};
 const anchor:Partial<Record<BuildingKind,number[]>>={casino:named(/christchurch casino/i),hospital:named(/waipapa|christchurch (?:public |womens )?hospital/i),gallery:named(/arts centre/i),police:named(/police/i),dealership:named(/miles toyota/i),airport:named(/bus interchange/i)};
 const order=[...legacy.buildings].sort((a,b)=>Number(!!anchor[b.kind])-Number(!!anchor[a.kind])||a.id-b.id);
 for(const old of order){const target=anchor[old.kind]??[(old.x0+old.x1)/2/legacy.size*(east-west)+west,(old.y0+old.y1)/2/legacy.size*(south-north)+north];let best:MappedBuilding|undefined,score=Infinity;
  for(const b of buildings){if(used.has(b.id))continue;const p=centres.get(b.id)!,style=mappedBuildingStyle(b),same=style.kind===old.kind||playable(b.kind)===old.kind,d=Math.hypot(p.x-target[0],p.y-target[1])+(same?0:110);if(d<score){best=b;score=d;}}
  if(best){assigned.set(old.id,best);used.add(best.id);}
 }
 const add=(source:MappedBuilding,old?:Building)=>{const id=old?.id??w.buildings.length,pts=source.points.map(p=>{const q=mappedPoint(m,p[0],p[1]);return[q.x,q.y];}),bb=bounds(pts),style=mappedBuildingStyle(source),arch=regionalArchitecture(source.tags),kind=old?.kind??playable(source.kind),def=BUILDINGS[kind];
  const b:Building={...(old??{}),id,kind,legacyName:old?.name,name:source.name||source.tags.address||old?.name||'Christchurch building',x0:Math.floor(bb.x0),y0:Math.floor(bb.y0),x1:Math.ceil(bb.x1)-1,y1:Math.ceil(bb.y1)-1,floors:style.floors,height:GROUND_H+(style.floors-1)*FLOOR_H,color:arch.wall,roof:arch.roof,sign:def.sign,facadeMaterial:arch.material,roofShape:arch.shape,architecture:arch.architecture,door:{x:Math.round((bb.x0+bb.x1)/2),y:Math.ceil(bb.y1),face:'s'},area:old?.area??0,billboard:!!old?.billboard};
  if(kind==='airport')b.name='Airport transfers · CHC is 10 km northwest';
  w.buildings[id]=b;m.byBuilding.set(id,source);m.buildingIds.set(source.id,id);raster(source.points,T.BUILDING,[],id);
 };
 for(const old of legacy.buildings){const source=assigned.get(old.id);if(source)add(source,old);}
 for(const b of buildings)if(!used.has(b.id))add(b);
 // Entrances face the nearest public pavement; the actual polygon remains solid.
 for(const b of w.buildings){let best=Infinity,door=b.door;const source=m.byBuilding.get(b.id)!;for(const p of source.points){const q=mappedPoint(m,p[0],p[1]);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=Math.floor(q.x)+dx,y=Math.floor(q.y)+dy,t=w.tile(x,y);if(!w.walkableTile(x,y)||t===T.WATER||t===T.ROAD)continue;const d=Math.hypot(x-q.x,y-q.y)+(t===T.SIDEWALK||t===T.PATH?0:5);if(d<best){best=d;door={x,y,face:y>=b.y1?'s':x>=b.x1?'e':y<=b.y0?'n':'w'};}}}b.door=door;}
 // Areas keep their story IDs but follow their relocated homes/venues, rather than the former grid.
 w.areas=legacy.areas.map(a=>{if(a.id===0)return{...a,x1:size-1,y1:size-1,cx:size/2,cy:size/2};const members=w.buildings.filter(b=>b.area===a.id),oldCentre={x:(a.cx/legacy.size*(east-west)+west)/2+m.offsetX,y:(a.cy/legacy.size*(south-north)+north)/2+m.offsetY};const focus=members[0]?.door??w.nearestWalkable(oldCentre.x,oldCentre.y);return{...a,name:members[0]?.name??a.name,x0:Math.max(pad,focus.x-9),x1:Math.min(size-pad-1,focus.x+9),y0:Math.max(pad,focus.y-9),y1:Math.min(size-pad-1,focus.y+9),cx:focus.x+.5,cy:focus.y+.5};});
 const studioArea=w.areas.find(a=>a.kind==='studio');if(studioArea){const anchor=worldStudioAnchor(m),studio=w.buildings.filter(b=>b.id>=legacy.buildings.length).sort((a,b)=>Math.hypot(a.door.x-anchor.x,a.door.y-anchor.y)-Math.hypot(b.door.x-anchor.x,b.door.y-anchor.y))[0];if(studio){studio.kind='studio';studio.area=studioArea.id;studio.name='MosaicScope Studio · Arts Centre';Object.assign(studioArea,{x0:studio.door.x-4,y0:studio.door.y-4,x1:studio.door.x+4,y1:studio.door.y+4,cx:studio.door.x+.5,cy:studio.door.y+.5});}}
 const setArea=(a:Area)=>{for(let y=Math.floor(a.y0);y<=a.y1;y++)for(let x=Math.floor(a.x0);x<=a.x1;x++)if(w.inBounds(x,y))w.areaOf[y*size+x]=a.id;};for(const a of w.areas.slice(1))setArea(a);
 // Cathedral Square is the shared arrival point for the story and live map.
 const squareSource=m.venues.find(v=>/^cathedral square$/i.test(v.name))?.point??[0,0],square=mappedPoint(m,squareSource[0],squareSource[1]),plaza=w.areas.find(a=>a.kind==='plaza')!;Object.assign(plaza,{x0:square.x-12,y0:square.y-10,x1:square.x+12,y1:square.y+10,cx:square.x,cy:square.y,name:'Cathedral Square'});setArea(plaza);
 const po=(kind:import('./World').PoiKind,x:number,y:number,area=0,extra:Partial<import('./World').Poi>={})=>w.pois.push({id:w.pois.length,kind,x,y,area,on:kind==='lamp',...extra});
 for(const b of w.buildings){po('door',b.door.x+.5,b.door.y+.5,b.area,{building:b.kind==='studio'?-2:b.id,name:b.name,menu:BUILDINGS[b.kind].menu});if(b.kind==='bank')po('atm',b.door.x+1.2,b.door.y+.5,b.area);}
 // Furniture follows real road tangents; no signs, trees or benches are placed in carriageways.
 let ordinal=0;for(const s of m.streetSegments){if(s.length<8)continue;for(let at=8;at<s.length;at+=22){ordinal++;for(const side of[-1,1]){const x=s.x+s.dx*at-s.dy*(s.half+1)*side,y=s.y+s.dy*at+s.dx*(s.half+1)*side;if(!w.walkable(x,y)||w.carriageway(x,y))continue;const close=w.pois.some(p=>Math.hypot(p.x-x,p.y-y)<2.2);if(close)continue;po(ordinal%7===0?'busstop':ordinal%5===0?'bin':'lamp',x,y,0,{dir:Math.abs(s.dx)>.5?0:1});if(side===1&&ordinal%5===0){const bx=x+s.dx*3,by=y+s.dy*3;if(w.walkable(bx,by)&&!w.carriageway(bx,by)&&!w.pois.some(p=>Math.hypot(p.x-bx,p.y-by)<2))po('bench',bx,by,0,{dir:Math.abs(s.dx)>.5?0:1});}}}}
 for(const p of legacy.pois){if(!['boombox','toychest','hoop','springpad','fountain','foodtruck','mural','billboard','hydrant','streetsign','roadsign'].includes(p.kind))continue;const a=w.areas[p.area]??plaza,foot=w.nearestFoot(a.cx+(p.id%5-2)*2,a.cy+(p.id%7-3)*2,12);if(!w.walkable(foot.x,foot.y)||w.carriageway(foot.x,foot.y)||w.pois.some(q=>Math.hypot(q.x-foot.x,q.y-foot.y)<1.7))continue;po(p.kind,foot.x,foot.y,a.id,{name:['streetsign','roadsign'].includes(p.kind)?w.streetName(foot.x,foot.y):p.name,dir:p.dir});}
 const stage=w.areas.find(a=>a.kind==='stage')!;const clear=w.nearestFoot(stage.cx,stage.cy);stage.cx=clear.x;stage.cy=clear.y;
 // Survey coverage is a streaming boundary, not a physical wall.
 w.dirtyTiles.clear();return w;
}

function worldStudioAnchor(m:MappedCity){const venue=m.venues.find(v=>/arts centre/i.test(v.name)),building=m.buildings.find(b=>/arts centre/i.test(b.name)),p=venue?.point??building?.points[0]??[-750,420];return mappedPoint(m,p[0],p[1]);}
