import type {Character} from '../entities/types';
import {drawFigure,pose,solve} from '../render/StickFigure';
import type {BuildingKind} from '../content/buildings';
import type {DestinationBuildings} from '../render/DestinationBuildings';
import {mappedBuildingStyle} from '../content/mappedBuildingStyle';
import {GROUND_H,FLOOR_H} from '../content/buildings';
import {GROUND} from '../render/palette';
import {T} from '../world/World';
import {fillTextured} from '../render/Textures';
import {DestinationRoads} from '../render/DestinationRoads';
export interface MappedBuilding{id:number;name:string;kind:string;points:number[][];height:number;heightEstimated:boolean;tags:Record<string,string>}
export interface MappedVenue{id:number;name:string;kind:string;point:number[];tags:Record<string,string>}
export interface DistrictData{code:string;cx:number;cy:number;centre:{name:string};buildings:MappedBuilding[];roads:{id:number;name:string;kind:string;points:number[][]}[];venues:MappedVenue[]}
export interface DistrictVisit{x:number;y:number;data:DistrictData[]}
export function insidePolygon(x:number,y:number,pts:number[][]):boolean{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
/** Distance to a facade, not just its corners (large buildings remain enterable). */
export function footprintDistance(x:number,y:number,points:number[][]):number{
 let distance=Infinity;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));distance=Math.min(distance,Math.hypot(x-a[0]-dx*u,y-a[1]-dy*u));}
 return distance;
}
export function venueKind(v:{kind:string;tags:Record<string,string>}):BuildingKind{const a=v.tags.amenity??v.kind;if(['cafe','bakery','bank','hospital','police','library'].includes(a))return a==='library'?'office':a as BuildingKind;if(['restaurant','fast_food','bar','pub'].includes(a))return a==='bar'||a==='pub'?'nightclub':'cafe';if(v.tags.tourism==='hotel')return 'hotel';return v.tags.shop?'dairy':'office';}
/** Real OSM footprint geometry; facade styles/interiors are authored game interpretations. */
export class DestinationDistrict{
 private nativeBuildings:DestinationBuildings|null=null;
 private nativeRoads=new DestinationRoads();
 private nativeTop(b:MappedBuilding):number{const s=mappedBuildingStyle(b);return (GROUND_H+(s.floors-1)*FLOOR_H+(s.kind==='house'?1.3:.3))*3.25;}
 private retryAfter=new Map<string,number>();
 private data:DistrictData[]=[];private pending=new Set<string>();private abort=new AbortController();private active=true;private keys=new Set<string>();private previous=0;private phase=0;
 private x=0;private y=0;private goal:{x:number;y:number}|null=null;private dir:1|-1=1;private width=960;private height=420;private scale=8;
 selected:MappedVenue|MappedBuilding|null=null;status='Loading mapped neighbourhood…';private lastStatus='';
 constructor(private canvas:HTMLCanvasElement,private code:string,private player:Character,private onStatus:(s:string)=>void,private onSelect:()=>void,visit?:DistrictVisit){
  void import('../render/DestinationBuildings').then(({DestinationBuildings})=>{if(this.active)this.nativeBuildings=new DestinationBuildings();});
  canvas.addEventListener('pointerdown',this.click);window.addEventListener('keyup',this.up,true);window.addEventListener('blur',this.blur);if(visit){this.x=visit.x;this.y=visit.y;this.data=visit.data;this.status=this.data[0]?.centre.name+' · real mapped footprints';this.announce();}else void this.load(0,0,true);
 }
 snapshot():DistrictVisit{return{x:this.x,y:this.y,data:this.data};}
 dispose():void{this.active=false;this.abort.abort();this.nativeBuildings?.clear();this.canvas.removeEventListener('pointerdown',this.click);window.removeEventListener('keyup',this.up,true);window.removeEventListener('blur',this.blur);}
 private up=(e:KeyboardEvent)=>this.keys.delete(e.key.toLowerCase());private blur=()=>this.keys.clear();
 key(e:KeyboardEvent):boolean{if(!/^(w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(e.key))return false;this.keys.add(e.key.toLowerCase());this.goal=null;e.preventDefault();return true;}
 private async load(cx:number,cy:number,first=false):Promise<void>{const key=cx+','+cy;if(this.pending.has(key)||(this.retryAfter.get(key)??0)>performance.now()||this.data.some(d=>d.cx===cx&&d.cy===cy)||Math.abs(cx)>20||Math.abs(cy)>20)return;this.pending.add(key);
  try{let r=await fetch(first?`${import.meta.env.BASE_URL}destinations/${this.code}.json`:`/api/destination-map?code=${this.code}&x=${cx}&y=${cy}`,{signal:this.abort.signal});if(!r.ok&&first)r=await fetch(`/api/destination-map?code=${this.code}`,{signal:this.abort.signal});if(!r.ok)throw Error();const d=await r.json() as DistrictData;if(!Array.isArray(d.buildings)||!d.buildings.length)throw Error();if(!this.active)return;this.data.push(d);if(this.data.length>30)this.data.shift();
   if(first){const venue=d.venues.find(v=>v.tags.amenity==='cafe')??d.venues[0],points=d.roads.flatMap(r=>r.points);if(venue)points.sort((a,b)=>Math.hypot(a[0]-venue.point[0],a[1]-venue.point[1])-Math.hypot(b[0]-venue.point[0],b[1]-venue.point[1]));const p=points[0];if(p){this.x=p[0];this.y=p[1];}this.escapeBuilding();}this.status=d.centre.name+' · mapped district, world building artwork';
  }catch{this.retryAfter.set(key,performance.now()+60000);if(this.active)this.status=this.data.length?'District edge: additional map data is temporarily unavailable.':'Map data is unavailable. Airport and trip activities remain available.';}finally{this.pending.delete(key);this.announce();}
 }
 private announce():void{if(this.status!==this.lastStatus){this.lastStatus=this.status;this.onStatus(this.status);}}
 private blocked(x:number,y:number):boolean{return this.data.some(d=>d.buildings.some(b=>insidePolygon(x,y,b.points)));}
 private escapeBuilding():void{if(!this.blocked(this.x,this.y))return;for(let r=2;r<80;r+=2)for(let a=0;a<6.28;a+=.4){const x=this.x+Math.cos(a)*r,y=this.y+Math.sin(a)*r;if(!this.blocked(x,y)){this.x=x;this.y=y;return;}}}
 private P(x:number,y:number,z=0):[number,number]{return [this.width/2+(x-this.x-y+this.y)*this.scale,this.height*.66+(x-this.x+y-this.y)*this.scale*.5-z*this.scale];}
 private click=(e:PointerEvent)=>{const r=this.canvas.getBoundingClientRect(),sx=(e.clientX-r.left-this.width/2)/this.scale,sy=2*(e.clientY-r.top-this.height*.66)/this.scale,x=this.x+(sx+sy)/2,y=this.y+(sy-sx)/2;
  let closest:MappedVenue|MappedBuilding|null=null,min=24;for(const d of this.data){for(const v of d.venues){const p=this.P(v.point[0],v.point[1]),dist=Math.hypot(e.clientX-r.left-p[0],e.clientY-r.top-p[1]);if(dist<min){min=dist;closest=v;}}for(const b of d.buildings){const points=b.points.map(p=>this.P(p[0],p[1],this.nativeTop(b)));if(insidePolygon(e.clientX-r.left,e.clientY-r.top,points)||insidePolygon(x,y,b.points))closest=b;}}
  this.selected=closest;if(closest){this.status=(closest.name||closest.tags.address||'Mapped building')+' · '+('heightEstimated'in closest&&closest.heightEstimated?'estimated height · ':'')+'interior is a game interpretation';this.announce();this.onSelect();}else this.goal={x,y};
 };
 canEnter():boolean{const v=this.selected;if(!v)return false;return 'point'in v?Math.hypot(v.point[0]-this.x,v.point[1]-this.y)<30:footprintDistance(this.x,this.y,v.points)<30;}
 draw(now:number):void{const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);this.width=r.width;this.height=r.height;if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}const g=this.canvas.getContext('2d')!;g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=GROUND[T.PAVE][0];g.fillRect(0,0,r.width,r.height);g.beginPath();g.rect(0,0,r.width,r.height);const origin=this.P(0,0);fillTextured(g,'pavers',.65,{x:origin[0],y:origin[1],zoom:1});
  const dt=Math.min(.05,this.previous?(now-this.previous)/1000:0);this.previous=now;
  let sx=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')),sy=Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup')),dx=sx+sy,dy=sy-sx;
  if(!dx&&!dy&&this.goal){dx=this.goal.x-this.x;dy=this.goal.y-this.y;if(Math.hypot(dx,dy)<1)this.goal=null;}const len=Math.hypot(dx,dy);let moved=0;
  if(len){dx=dx/len*dt*7;dy=dy/len*dt*7;if(!this.blocked(this.x+dx,this.y)){this.x+=dx;moved+=Math.abs(dx);}if(!this.blocked(this.x,this.y+dy)){this.y+=dy;moved+=Math.abs(dy);}this.dir=dx-dy>=0?1:-1;this.phase+=Math.hypot(dx,dy)*.5;}
  const cx=Math.round(this.x/400),cy=Math.round(-this.y/400),covered=this.data.some(d=>Math.abs(this.x-d.cx*400)<240&&Math.abs(this.y+d.cy*400)<240);if(this.data.length&&!covered&&Math.abs(cx)<=20&&Math.abs(cy)<=20)void this.load(cx,cy);
  this.nativeRoads.draw(g,this.data,(x,y)=>this.P(x,y),this.width,this.height);
  const buildings=[...new Map(this.data.flatMap(d=>d.buildings).map(b=>[b.id,b])).values()].sort((a,b)=>Math.max(...a.points.map(p=>p[0]+p[1]))-Math.max(...b.points.map(p=>p[0]+p[1])));
  const figure=()=>{const p=this.P(this.x,this.y),k=.47;g.fillStyle='rgba(0,0,0,.23)';g.beginPath();g.ellipse(...p,8,3,0,0,7);g.fill();solve(pose(moved>.001?'walk':'idle','normal',now/1000,this.phase,moved?2:0,0),p[0],p[1],k,this.dir);drawFigure(g,this.player,p[0],p[1],k,this.dir,now/1000,0,1);};let drawn=false;
  for(const b of buildings){const sum=Math.max(...b.points.map(p=>p[0]+p[1]));if(!drawn&&sum>this.x+this.y){figure();drawn=true;}
   this.nativeBuildings?.draw(g,b,(x,y,z)=>this.P(x,y,z),this.scale,[this.width/2,this.height*.66-30]);
  }if(!drawn)figure();
  const used:{x:number;y:number}[]=[];g.font='12px Arial, sans-serif';g.textAlign='center';for(const d of this.data)for(const v of d.venues){const q=this.P(...v.point as [number,number]);if(q[0]<20||q[0]>r.width-20||q[1]<30||q[1]>r.height-20||used.some(p=>Math.abs(p.x-q[0])<110&&Math.abs(p.y-q[1])<25))continue;used.push({x:q[0],y:q[1]});g.fillStyle='#25292bdd';const text=v.name.length>28?v.name.slice(0,27)+'…':v.name,w=g.measureText(text).width+14;g.fillRect(q[0]-w/2,q[1]-20,w,19);g.fillStyle='#eee5d4';g.fillText(text,q[0],q[1]-6);}
 }
}
