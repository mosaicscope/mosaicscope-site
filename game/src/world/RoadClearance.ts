import {surveyedHalfWidth,type MappedRoad} from '../content/destinationTerrain';
import {ROAD_WIDEN,ROAD_WIDEN_CAP,WIDENED_KINDS,hasRoadClearance,setRoadClearance} from '../content/roadLayout';

/** Pavement (1.3 tiles = 2.6 m) plus a small margin kept between a widened kerb and any facade or barrier. */
const PAVEMENT_METRES=3.2,CELL=32;
type Edge=[number,number,number,number];

const pointSegment=(px:number,py:number,ax:number,ay:number,bx:number,by:number)=>{const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l)):0;return Math.hypot(px-ax-dx*t,py-ay-dy*t);};
const side=(ax:number,ay:number,bx:number,by:number,px:number,py:number)=>Math.sign((bx-ax)*(py-ay)-(by-ay)*(px-ax));
/** Closest distance between two segments (0 when they cross). */
function segmentDistance(a:Edge,b:Edge):number{
 if(side(a[0],a[1],a[2],a[3],b[0],b[1])*side(a[0],a[1],a[2],a[3],b[2],b[3])<0&&side(b[0],b[1],b[2],b[3],a[0],a[1])*side(b[0],b[1],b[2],b[3],a[2],a[3])<0)return 0;
 return Math.min(pointSegment(a[0],a[1],b[0],b[1],b[2],b[3]),pointSegment(a[2],a[3],b[0],b[1],b[2],b[3]),pointSegment(b[0],b[1],a[0],a[1],a[2],a[3]),pointSegment(b[2],b[3],a[0],a[1],a[2],a[3]));
}

/**
 * Measure, in surveyed metres, how far each drivable road's carriageway can widen before its pavement meets a mapped
 * building or barrier. Centrelines never move; roads already measured (e.g. seen in an earlier district) keep their value.
 */
export function measureRoadClearances(roads:readonly MappedRoad[],obstacles:readonly {points:number[][]}[]):void{
 const pending=roads.filter(r=>WIDENED_KINDS.has(r.kind)&&!hasRoadClearance(r.id)&&r.points.length>1);if(!pending.length)return;
 const grid=new Map<number,Edge[]>(),key=(x:number,y:number)=>(y+32768)*65536+x+32768;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const r of pending)for(const [x,y] of r.points){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const margin=ROAD_WIDEN_CAP+PAVEMENT_METRES+200;x0-=margin;y0-=margin;x1+=margin;y1+=margin;
 for(const o of obstacles){const p=o.points;if(!p.length||p[0][0]<x0||p[0][0]>x1||p[0][1]<y0||p[0][1]>y1)continue;for(let i=1;i<p.length;i++){const e:Edge=[p[i-1][0],p[i-1][1],p[i][0],p[i][1]];
  for(let y=Math.floor(Math.min(e[1],e[3])/CELL);y<=Math.floor(Math.max(e[1],e[3])/CELL);y++)for(let x=Math.floor(Math.min(e[0],e[2])/CELL);x<=Math.floor(Math.max(e[0],e[2])/CELL);x++){const k=key(x,y),list=grid.get(k);if(list)list.push(e);else grid.set(k,[e]);}}}
 for(const r of pending){const surveyed=surveyedHalfWidth(r),reach=Math.min(ROAD_WIDEN_CAP,surveyed*ROAD_WIDEN)+PAVEMENT_METRES+1;let nearest=Infinity;
  for(let i=1;i<r.points.length&&nearest>0;i++){const s:Edge=[r.points[i-1][0],r.points[i-1][1],r.points[i][0],r.points[i][1]];
   for(let y=Math.floor((Math.min(s[1],s[3])-reach)/CELL);y<=Math.floor((Math.max(s[1],s[3])+reach)/CELL);y++)for(let x=Math.floor((Math.min(s[0],s[2])-reach)/CELL);x<=Math.floor((Math.max(s[0],s[2])+reach)/CELL);x++)for(const e of grid.get(key(x,y))??[])nearest=Math.min(nearest,segmentDistance(s,e));}
  setRoadClearance(r.id,Math.max(0,nearest-PAVEMENT_METRES));
 }
}
