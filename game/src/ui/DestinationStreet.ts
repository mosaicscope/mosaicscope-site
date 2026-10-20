import {roadHalfWidth} from '../content/destinationTerrain';
import {regionProfile} from '../content/regions';
import {VEHICLES} from '../content/vehicles';
import {Camera} from '../render/Camera';
import {drawCar} from '../render/Cars';
import {drawPoi} from '../render/Terrain';
import type {Vehicle} from '../entities/types';
import type {DistrictData} from './DestinationDistrict';
export interface MapStreetObject{x:number;y:number;car?:Vehicle;fixture?:'busstop'|'lamp'|'bin'|'streetsign';name?:string}
interface Route{id:number;name:string;points:number[][];length:number;lengths:number[];half:number;oneway:boolean;speed:number}
/** The mapped preview uses the same vehicle and street-furniture artwork as full city play. */
export class DestinationStreet{
 private signature='';private routes:Route[]=[];private camera=new Camera();
 constructor(private country:string){}
 items(data:DistrictData[],time:number):MapStreetObject[]{const signature=data.map(d=>d.cx+','+d.cy).join('/');if(signature!==this.signature){this.signature=signature;this.routes=[...new Map(data.flatMap(d=>d.roads).map(r=>[r.id,r])).values()].filter(r=>!['footway','pedestrian','steps','path','cycleway','construction'].includes(r.kind)&&!['no','private'].includes(r.tags?.access??'')).flatMap(r=>{const lengths=[0];for(let i=1;i<r.points.length;i++)lengths.push(lengths[i-1]+Math.hypot(r.points[i][0]-r.points[i-1][0],r.points[i][1]-r.points[i-1][1]));const length=lengths[lengths.length-1];return length>24?[{...r,length,lengths,half:roadHalfWidth(r),oneway:!!r.tags?.oneway&&r.tags.oneway!=='no',speed:Math.min(12,Math.max(3,(Number.parseFloat(r.tags?.maxspeed??'')||30)/3.6))}]:[];});}
  const profile=regionProfile(this.country),out:MapStreetObject[]=[];if(!this.routes.length)return out;
  for(let i=0;i<Math.min(30,this.routes.length*2);i++){const r=this.routes[i%this.routes.length],parked=i%5===0,cycle=(time*(parked?0:r.speed*.7)+i*41)%(r.length*(r.oneway?1:2)),reverse=!r.oneway&&cycle>r.length,distance=reverse?r.length*2-cycle:cycle;let n=1;while(n<r.lengths.length-1&&r.lengths[n]<distance)n++;const a=r.points[n-1],b=r.points[n],length=r.lengths[n]-r.lengths[n-1]||1,t=(distance-r.lengths[n-1])/length,dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length,offset=(profile.side==='left'?-1:1)*(reverse?-1:1)*(parked?r.half+1.2:r.half*.55),x=a[0]+(b[0]-a[0])*t-dy*offset,y=a[1]+(b[1]-a[1])*t+dx*offset,cls=profile.cars[i%profile.cars.length];
   out.push({x,y,car:{id:r.id*10+Math.floor(i/this.routes.length),cls,x:x/2,y:y/2,px:x/2,py:y/2,heading:Math.atan2(dy,dx)+(reverse?Math.PI:0),speed:parked?0:3,damage:0,color:VEHICLES[cls].colors[i%VEHICLES[cls].colors.length],plate:(this.country||'MS')+' '+(1000+i*37),state:parked?'parked':'drive',driver:-1,owner:-1,siren:false} as Vehicle});
  }
  this.routes.slice(0,28).forEach((r,i)=>{const a=r.points[0],b=r.points[1],length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,side=r.half+2,x=a[0]-(b[1]-a[1])/length*side,y=a[1]+(b[0]-a[0])/length*side;out.push({x,y,fixture:i%7===0?'busstop':i%4===0?'bin':i%3===0?'streetsign':'lamp',name:r.name});});return out;
 }
 draw(g:CanvasRenderingContext2D,o:MapStreetObject,P:(x:number,y:number,z?:number)=>[number,number],scale:number,time:number):void{
  if(o.car){this.camera.zoom=scale/14;this.camera.toScreen=(x,y,z,out)=>{const p=P(x*2,y*2,z*2);out.x=p[0];out.y=p[1];return out;};drawCar(g,this.camera,o.car,1,time,0,false);}else{const p=P(o.x,o.y);drawPoi(g,{id:0,kind:o.fixture!,x:o.x,y:o.y,area:0,name:o.name},p[0],p[1],scale/12,time,false,false);}
 }
}
