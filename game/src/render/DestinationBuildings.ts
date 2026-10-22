import {BUILDINGS,GROUND_H,FLOOR_H} from '../content/buildings';
import {mappedBuildingStyle,regionalArchitecture} from '../content/mappedBuildingStyle';
import {World,type Building} from '../world/World';
import {drawBuildingTile} from './Buildings';
import type {MappedBuilding} from '../ui/DestinationDistrict';

interface Sprite{canvas:HTMLCanvasElement;minX:number;minY:number;ox:number;oy:number;unit:number;top:number;sampleX?:number;sampleY?:number;covers?:boolean;ready:boolean;bytes:number}
export class DestinationBuildings{
 private cache=new Map<number,Sprite>();private jobs:{sprite:Sprite;world:World;building:Building;tiles:{x:number;y:number}[];at:number;g:CanvasRenderingContext2D;ox:number;oy:number}[]=[];private bytes=0;
 beginFrame():void{const until=performance.now()+3;while(this.jobs.length&&performance.now()<until){const job=this.jobs[0],t=job.tiles[job.at++];if(t)drawBuildingTile(job.g,job.world,job.building,t.x,t.y,job.ox+(t.x-t.y)*32,job.oy+(t.x+t.y)*16,1,0,0,1,new Map(),4/job.sprite.unit);if(job.at>=job.tiles.length){job.sprite.ready=true;this.jobs.shift();}}}
 clear():void{this.cache.clear();this.jobs=[];this.bytes=0;}
 top(b:MappedBuilding):number{const s=mappedBuildingStyle(b);return (GROUND_H+(s.floors-1)*FLOOR_H+(s.kind==='house'?1.3:.3))*3.25;}
 private sprite(m:MappedBuilding):Sprite{
  const old=this.cache.get(m.id);if(old){this.cache.delete(m.id);this.cache.set(m.id,old);return old;}
  const minX=Math.min(...m.points.map(p=>p[0])),minY=Math.min(...m.points.map(p=>p[1])),maxX=Math.max(...m.points.map(p=>p[0])),maxY=Math.max(...m.points.map(p=>p[1]));
  const unit=Math.max(4,(maxX-minX)/28,(maxY-minY)/28),nx=Math.max(1,Math.ceil((maxX-minX)/unit)),ny=Math.max(1,Math.ceil((maxY-minY)/unit)),w=new World(Math.max(nx,ny)+4),style=mappedBuildingStyle(m),architecture=regionalArchitecture(m.tags),def=BUILDINGS[style.kind];
  const b:Building={id:0,kind:style.kind,name:'',x0:1,y0:1,x1:nx,y1:ny,floors:style.floors,height:GROUND_H+(style.floors-1)*FLOOR_H,color:architecture.wall,roof:architecture.roof,sign:def.sign,facadeMaterial:architecture.material,roofShape:architecture.shape,architecture:architecture.architecture,door:{x:Math.round(nx/2),y:ny,face:'s'},area:0,billboard:false};w.buildings=[b];
  const inside=(x:number,y:number)=>{let yes=false;for(let i=0,j=m.points.length-1;i<m.points.length;j=i++){const a=m.points[i],b=m.points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  const tiles:{x:number;y:number}[]=[];for(let y=1;y<=ny;y++)for(let x=1;x<=nx;x++){if(!inside(minX+(x-.5)*unit,minY+(y-.5)*unit))continue;w.buildingOf[y*w.size+x]=0;tiles.push({x,y});}
  // A narrow mapped footprint still gets a native one-tile building, rather than disappearing.
  if(!tiles.length){w.buildingOf[w.size+1]=0;tiles.push({x:1,y:1});}
  tiles.sort((a,b)=>a.x+a.y-b.x-b.y||a.y-b.y);
  const canvas=document.createElement('canvas'),pad=64,top=(b.height+(style.kind==='house'?1.5:2.5))*26,ox=(ny+1)*32+pad,oy=top+pad;
  const quality=.5;canvas.width=Math.ceil(((nx+ny+2)*32+pad*2)*quality);canvas.height=Math.ceil(((nx+ny+2)*16+top+pad*2)*quality);const g=canvas.getContext('2d',{willReadFrequently:true})!;g.scale(quality,quality);
  const sprite:Sprite={canvas,minX:minX-unit,minY:minY-unit,ox:ox*quality,oy:oy*quality,unit,top:this.top(m),ready:false,bytes:canvas.width*canvas.height*4};this.cache.set(m.id,sprite);this.bytes+=sprite.bytes;this.jobs.push({sprite,world:w,building:b,tiles,at:0,g,ox,oy});while(this.cache.size>96||this.bytes>128*1024*1024){const id=this.cache.keys().next().value!;const old=this.cache.get(id)!;this.bytes-=old.bytes;this.cache.delete(id);this.jobs=this.jobs.filter(j=>j.sprite!==old);}return sprite;
 }
 draw(g:CanvasRenderingContext2D,m:MappedBuilding,project:(x:number,y:number,z?:number)=>[number,number],scale:number,focus:[number,number]):void{
  const corners=m.points.map(p=>project(p[0],p[1])),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),height=this.top(m)*scale;
  if(Math.max(...xs)<-80||Math.min(...xs)>g.canvas.clientWidth+80||Math.max(...ys)<-80||Math.min(...ys)-height>g.canvas.clientHeight+80)return;
  const s=this.sprite(m);if(!s.ready){g.save();g.fillStyle='#626b69';g.beginPath();m.points.forEach((p,i)=>{const a=project(p[0],p[1],this.top(m));if(i)g.lineTo(...a);else g.moveTo(...a);});g.closePath();g.fill();g.fillStyle='#4f5b5e';for(let i=1;i<m.points.length;i++){const a=m.points[i-1],b=m.points[i],q=[project(a[0],a[1]),project(b[0],b[1]),project(b[0],b[1],this.top(m)),project(a[0],a[1],this.top(m))];g.beginPath();q.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();}g.restore();return;}const p=project(s.minX,s.minY),f=scale*s.unit/16,x=p[0]-s.ox*f,y=p[1]-s.oy*f,sx=Math.floor((focus[0]-x)/f),sy=Math.floor((focus[1]-y)/f);
  // The main world fades buildings hiding the player. Share that behaviour, rather than losing the character behind a roof.
  if(sx<0||sy<0||sx>=s.canvas.width||sy>=s.canvas.height)s.covers=false;
  else if(s.sampleX===undefined||Math.abs(sx-s.sampleX)>3||Math.abs(sy-s.sampleY!)>3){s.sampleX=sx;s.sampleY=sy;s.covers=s.canvas.getContext('2d')!.getImageData(sx,sy,1,1).data[3]>30;}
  g.save();if(s.covers)g.globalAlpha=.25;g.drawImage(s.canvas,x,y,s.canvas.width*f,s.canvas.height*f);g.restore();
 }
}
