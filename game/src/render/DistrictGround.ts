import {DestinationRoads} from './DestinationRoads';
import type {DistrictData} from '../ui/DestinationDistrict';
type Project=(x:number,y:number)=>[number,number];
/** Bounded static scenery cache for mapped travel, with translation reuse while walking/driving. */
export class DistrictGround{
 private roads=new DestinationRoads();private cv=document.createElement('canvas');private signature='';private anchor:[number,number]=[0,0];private scale=0;private w=0;private h=0;
 clear(){this.signature='';}
 draw(g:CanvasRenderingContext2D,data:DistrictData[],P:Project,scale:number,width:number,height:number,right:boolean):void{const signature=data.map(d=>d.cx+','+d.cy).join('/'),origin=P(0,0),ratio=scale/(this.scale||scale),dx=origin[0]-this.anchor[0]*ratio,dy=origin[1]-this.anchor[1]*ratio,pad=160;
  if(signature!==this.signature||width!==this.w||height!==this.h||Math.abs(dx)>100||Math.abs(dy)>100||Math.abs(ratio-1)>.08){this.signature=signature;this.anchor=origin;this.scale=scale;this.w=width;this.h=height;this.cv.width=width+pad*2;this.cv.height=height+pad*2;const cg=this.cv.getContext('2d')!,Q:Project=(x,y)=>{const p=P(x,y);return[p[0]+pad,p[1]+pad];};cg.fillStyle='#53564b';cg.fillRect(0,0,this.cv.width,this.cv.height);
   const terrain=[...new Map(data.flatMap(d=>d.terrain??[]).map(t=>[t.id,t])).values()].sort((a,b)=>Number(a.kind==='water')-Number(b.kind==='water'));
   for(const t of terrain){if(t.kind==='land')continue;cg.beginPath();for(const ring of[t.points,...(t.holes??[])]){ring.forEach((p,i)=>i?cg.lineTo(...Q(p[0],p[1])):cg.moveTo(...Q(p[0],p[1])));cg.closePath();}cg.fillStyle=t.kind==='water'?'#34545b':t.kind==='green'?'#4d6147':'#af9f79';cg.fill('evenodd');}
   this.roads.draw(cg,data,Q,this.cv.width,this.cv.height,right);
  }const r=scale/this.scale;g.drawImage(this.cv,origin[0]-(this.anchor[0]+pad)*r,origin[1]-(this.anchor[1]+pad)*r,this.cv.width*r,this.cv.height*r);
 }
}
