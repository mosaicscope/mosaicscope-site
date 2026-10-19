import {BUILDINGS,GROUND_H,FLOOR_H} from '../content/buildings';
import {mappedBuildingStyle} from '../content/mappedBuildingStyle';
import {World,type Building} from '../world/World';
import {drawBuildingTile} from './Buildings';
import type {MappedBuilding} from '../ui/DestinationDistrict';

interface Sprite{canvas:HTMLCanvasElement;minX:number;minY:number;ox:number;oy:number;unit:number;top:number;sampleX?:number;sampleY?:number;covers?:boolean}
export class DestinationBuildings{
 private cache=new Map<number,Sprite>();
 clear():void{this.cache.clear();}
 top(b:MappedBuilding):number{const s=mappedBuildingStyle(b);return (GROUND_H+(s.floors-1)*FLOOR_H+(s.kind==='house'?1.3:.3))*3.25;}
 private sprite(m:MappedBuilding):Sprite{
  const old=this.cache.get(m.id);if(old){this.cache.delete(m.id);this.cache.set(m.id,old);return old;}
  const minX=Math.min(...m.points.map(p=>p[0])),minY=Math.min(...m.points.map(p=>p[1])),maxX=Math.max(...m.points.map(p=>p[0])),maxY=Math.max(...m.points.map(p=>p[1]));
  const unit=Math.max(4,(maxX-minX)/60,(maxY-minY)/60),nx=Math.max(1,Math.ceil((maxX-minX)/unit)),ny=Math.max(1,Math.ceil((maxY-minY)/unit)),w=new World(Math.max(nx,ny)+4),style=mappedBuildingStyle(m),def=BUILDINGS[style.kind];
  const b:Building={id:0,kind:style.kind,name:'',x0:1,y0:1,x1:nx,y1:ny,floors:style.floors,height:GROUND_H+(style.floors-1)*FLOOR_H,color:def.colors[m.id%def.colors.length],roof:def.roof,sign:def.sign,door:{x:Math.round(nx/2),y:ny,face:'s'},area:0,billboard:false};w.buildings=[b];
  const inside=(x:number,y:number)=>{let yes=false;for(let i=0,j=m.points.length-1;i<m.points.length;j=i++){const a=m.points[i],b=m.points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  const tiles:{x:number;y:number}[]=[];for(let y=1;y<=ny;y++)for(let x=1;x<=nx;x++){if(!inside(minX+(x-.5)*unit,minY+(y-.5)*unit))continue;w.buildingOf[y*w.size+x]=0;tiles.push({x,y});}
  // A narrow mapped footprint still gets a native one-tile building, rather than disappearing.
  if(!tiles.length){w.buildingOf[w.size+1]=0;tiles.push({x:1,y:1});}
  tiles.sort((a,b)=>a.x+a.y-b.x-b.y||a.y-b.y);
  const canvas=document.createElement('canvas'),pad=64,top=(b.height+(style.kind==='house'?1.5:2.5))*26,ox=(ny+1)*32+pad,oy=top+pad;
  canvas.width=(nx+ny+2)*32+pad*2;canvas.height=Math.ceil((nx+ny+2)*16+top+pad*2);const g=canvas.getContext('2d',{willReadFrequently:true})!,graffiti=new Map();
  for(const t of tiles)drawBuildingTile(g,w,b,t.x,t.y,ox+(t.x-t.y)*32,oy+(t.x+t.y)*16,1,0,0,1,graffiti);
  const sprite={canvas,minX:minX-unit,minY:minY-unit,ox,oy,unit,top:this.top(m)};this.cache.set(m.id,sprite);if(this.cache.size>16)this.cache.delete(this.cache.keys().next().value!);return sprite;
 }
 draw(g:CanvasRenderingContext2D,m:MappedBuilding,project:(x:number,y:number,z?:number)=>[number,number],scale:number,focus:[number,number]):void{
  const corners=m.points.map(p=>project(p[0],p[1])),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),height=this.top(m)*scale;
  if(Math.max(...xs)<-80||Math.min(...xs)>g.canvas.clientWidth+80||Math.max(...ys)<-80||Math.min(...ys)-height>g.canvas.clientHeight+80)return;
  const s=this.sprite(m),p=project(s.minX,s.minY),f=scale*s.unit/32,x=p[0]-s.ox*f,y=p[1]-s.oy*f,sx=Math.floor((focus[0]-x)/f),sy=Math.floor((focus[1]-y)/f);
  // The main world fades buildings hiding the player. Share that behaviour, rather than losing the character behind a roof.
  if(sx<0||sy<0||sx>=s.canvas.width||sy>=s.canvas.height)s.covers=false;
  else if(s.sampleX===undefined||Math.abs(sx-s.sampleX)>3||Math.abs(sy-s.sampleY!)>3){s.sampleX=sx;s.sampleY=sy;s.covers=s.canvas.getContext('2d')!.getImageData(sx,sy,1,1).data[3]>30;}
  g.save();if(s.covers)g.globalAlpha=.25;g.drawImage(s.canvas,x,y,s.canvas.width*f,s.canvas.height*f);g.restore();
 }
}
