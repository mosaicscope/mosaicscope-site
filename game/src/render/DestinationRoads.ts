import {GROUND} from './palette';
import {T} from '../world/World';
import {fillTextured} from './Textures';
import {ROAD_PAINT,paintRoadArrow} from './RoadArt';
import type {DistrictData} from '../ui/DestinationDistrict';
type P=(x:number,y:number)=>[number,number];
interface Segment{x:number;y:number;dx:number;dy:number;length:number;half:number;walk:boolean;start:boolean;end:boolean;distance:number;junctions:number[];crossings:{at:number;side:number}[]}
/** Mapped road routes, dressed with the town's asphalt, kerbs, four lanes, paint and zebra stripes. */
export class DestinationRoads{
 private signature='';private segments:Segment[]=[];
 draw(g:CanvasRenderingContext2D,data:DistrictData[],P:P,width:number,height:number):void{
  const signature=data.map(d=>d.cx+','+d.cy).join('/');if(signature!==this.signature){this.signature=signature;this.build(data);}
  const visible=this.segments.filter(s=>{const a=P(s.x,s.y),b=P(s.x+s.dx*s.length,s.y+s.dy*s.length);return Math.max(a[0],b[0])>-220&&Math.min(a[0],b[0])<width+220&&Math.max(a[1],b[1])>-120&&Math.min(a[1],b[1])<height+120;});
  const quad=(s:Segment,half:number,from=0,to=s.length)=>{const nx=-s.dy*half,ny=s.dx*half,a=P(s.x+s.dx*from+nx,s.y+s.dy*from+ny),b=P(s.x+s.dx*to+nx,s.y+s.dy*to+ny),c=P(s.x+s.dx*to-nx,s.y+s.dy*to-ny),d=P(s.x+s.dx*from-nx,s.y+s.dy*from-ny);g.moveTo(...a);g.lineTo(...b);g.lineTo(...c);g.lineTo(...d);g.closePath();};
  const origin=P(0,0),anchor={x:origin[0],y:origin[1],zoom:1};
  g.beginPath();for(const s of visible)quad(s,s.walk?1.7:s.half+4);g.fillStyle=GROUND[T.SIDEWALK][0];g.fill();fillTextured(g,'pavers',.9,anchor);
  g.beginPath();for(const s of visible)if(!s.walk)quad(s,s.half);g.fillStyle=GROUND[T.ROAD][0];g.fill();fillTextured(g,'asphalt',1,anchor);
  const stroke=(s:Segment,offset:number,from:number,to:number,col:string,lw:number,dash:number[]=[])=>{const a=P(s.x+s.dx*from-s.dy*offset,s.y+s.dy*from+s.dx*offset),b=P(s.x+s.dx*to-s.dy*offset,s.y+s.dy*to+s.dx*offset);g.strokeStyle=col;g.lineWidth=lw;g.setLineDash(dash);g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();g.setLineDash([]);};
  for(const s of visible){if(s.walk)continue;let ranges=[[0,s.length]];for(const j of s.junctions){const a=j-s.distance-8,b=j-s.distance+8;ranges=ranges.flatMap(([lo,hi])=>b<=lo||a>=hi?[[lo,hi]]:[[lo,Math.max(lo,a)],[Math.min(hi,b),hi]].filter(([a,b])=>b-a>.1));}
   for(const [from,to]of ranges){for(const side of[-1,1])stroke(s,side*(s.half-.3),from,to,ROAD_PAINT.edge,1.2);stroke(s,0,from,to,ROAD_PAINT.centre,2);if(s.half>4)for(const side of[-1,1])stroke(s,side*4,from,to,ROAD_PAINT.lane,1.3,[6,8]);}
   for(let along=Math.ceil((s.distance-16)/40)*40+16-s.distance;along<s.length;along+=40){if(along<0||s.junctions.some(j=>Math.abs(j-s.distance-along)<16))continue;for(const offset of(s.half>4?[-6,-2,2,6]:[-2,2])){const sign=offset<0?1:-1;paintRoadArrow(g,P,s.x+s.dx*along-s.dy*offset,s.y+s.dy*along+s.dx*offset,s.dx*sign,s.dy*sign,4);}}
   for(const crossing of s.crossings){const at=crossing.at-s.distance;
    g.fillStyle=ROAD_PAINT.zebra;g.beginPath();for(let across=-s.half+.4;across<s.half-.4;across+=.92){const half=.24,nx=-s.dy,ny=s.dx,points=[[-2.8,across-half],[2.8,across-half],[2.8,across+half],[-2.8,across+half]].map(([u,v])=>P(s.x+s.dx*(at+u)+nx*v,s.y+s.dy*(at+u)+ny*v));points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();}g.fill();
    const stop=at+crossing.side*4.2,edge=crossing.side*s.half,a=P(s.x+s.dx*stop,s.y+s.dy*stop),b=P(s.x+s.dx*stop-s.dy*edge,s.y+s.dy*stop+s.dx*edge);g.strokeStyle=ROAD_PAINT.stop;g.lineWidth=2.6;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();
   }
  }
 }
 private build(data:DistrictData[]):void{
  const roads=[...new Map(data.flatMap(d=>d.roads).map(r=>[r.id,r])).values()],nodes=new Map<string,Set<string>>(),key=(p:number[])=>p.map(v=>v.toFixed(1)).join(',');
  for(const r of roads)if(!['footway','path','pedestrian','steps'].includes(r.kind))for(let i=0;i<r.points.length;i++){const k=key(r.points[i]),edges=nodes.get(k)??new Set<string>();if(i>0)edges.add(key(r.points[i-1]));if(i+1<r.points.length)edges.add(key(r.points[i+1]));nodes.set(k,edges);}
  this.segments=[];for(const r of roads){const walk=['footway','path','pedestrian','steps'].includes(r.kind),half=['service','residential','living_street'].includes(r.kind)?4:8,cumulative=[0];for(let i=1;i<r.points.length;i++)cumulative.push(cumulative[i-1]+Math.hypot(r.points[i][0]-r.points[i-1][0],r.points[i][1]-r.points[i-1][1]));const junctions=cumulative.filter((_,i)=>(nodes.get(key(r.points[i]))?.size??0)>=3),crossings=junctions.flatMap(j=>[{at:j-11,side:-1},{at:j+11,side:1}]).filter(c=>c.at>0&&c.at<cumulative[cumulative.length-1]);
   for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],length=cumulative[i]-cumulative[i-1];if(length<.1)continue;this.segments.push({x:a[0],y:a[1],dx:(b[0]-a[0])/length,dy:(b[1]-a[1])/length,length,half,walk,start:(nodes.get(key(a))?.size??0)>=3,end:(nodes.get(key(b))?.size??0)>=3,distance:cumulative[i-1],junctions,crossings:crossings.filter(c=>c.at>=cumulative[i-1]&&c.at<cumulative[i])});}
  }
 }
}
