import type {MappedBuilding} from '../ui/DestinationDistrict';
import {mappedBuildingStyle,regionalArchitecture} from '../content/mappedBuildingStyle';
import {paintWindowStories,type Win} from './NightGlow';

type Pt=[number,number];type Project=(x:number,y:number,z?:number)=>Pt;
interface Mesh{cv:HTMLCanvasElement;life:HTMLCanvasElement;at:Pt;ox:number;oy:number;unit:number;windows:Win[];stamp:number;bytes:number;top:number}
const shade=(hex:string,n:number)=>{const s=hex.replace('#','');return '#'+[0,2,4].map(i=>Math.max(0,Math.min(255,parseInt(s.slice(i,i+2),16)+n)).toString(16).padStart(2,'0')).join('');};
/** Exact polygon extrusion. Static architecture is cached; a small room layer updates at 12 Hz. */
export class MappedArchitecture{
 private cache=new Map<number,Mesh>();private bytes=0;private jobs=0;private deadline=0;
 beginFrame():void{this.jobs=0;this.deadline=performance.now()+2.5;}
 clear():void{this.cache.clear();this.bytes=0;}
 top(b:MappedBuilding):number{return b.height;}
 private create(b:MappedBuilding):Mesh{
  const points=b.points.filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);if(points.length>3&&points[0][0]===points[points.length-1][0]&&points[0][1]===points[points.length-1][1])points.pop();
  const arch=regionalArchitecture(b.tags),style=mappedBuildingStyle(b),top=b.height,origin=points[0] as Pt,raw=(x:number,y:number,z=0):Pt=>[x-origin[0]-y+origin[1],(x-origin[0]+y-origin[1])*.5-z],all=points.flatMap(p=>[raw(p[0],p[1]),raw(p[0],p[1],top)]),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1])),unit=Math.min(10,1900/Math.max(maxX-minX,maxY-minY)),pad=16,cv=document.createElement('canvas');
  cv.width=Math.ceil((maxX-minX)*unit+pad*2);cv.height=Math.ceil((maxY-minY)*unit+pad*2);const g=cv.getContext('2d')!,ox=pad-minX*unit,oy=pad-minY*unit,P:Project=(x,y,z=0)=>{const p=raw(x,y,z);return[p[0]*unit+ox,p[1]*unit+oy];},windows:Win[]=[];
  const polygon=(ps:Pt[],color:string,stroke='#222c2d')=>{g.beginPath();ps.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fillStyle=color;g.fill();g.strokeStyle=stroke;g.lineWidth=.7;g.stroke();};
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),winding=area>=0?1:-1;
  const edges=points.map((p,i)=>({a:p,b:points[(i+1)%points.length],i})).filter(({a,b})=>((b[1]-a[1])-(b[0]-a[0]))*winding>0).sort((a,b)=>a.a[0]+a.a[1]+a.b[0]+a.b[1]-b.a[0]-b.a[1]-b.b[0]-b.b[1]);
  for(const {a,c:unused,b:e,i} of edges.map(e=>({...e,c:0}))){void unused;const dx=e[0]-a[0],dy=e[1]-a[1],length=Math.hypot(dx,dy),at=(u:number,z:number)=>P(a[0]+dx*u,a[1]+dy*u,z),wall=shade(arch.wall,dx>dy?-18:4);
   polygon([at(0,0),at(1,0),at(1,top),at(0,top)],wall);
   const rows=Math.max(1,Math.min(14,style.floors)),floor=top/rows,columns=Math.max(1,Math.min(30,Math.floor(length/3.4))),bay=1/columns;
   // Continuous cornice/plinth and real edge-aligned floor bands anchor every facade part.
   for(const h of[.22,top-.22,...Array.from({length:rows-1},(_,i)=>(i+1)*floor)]){g.strokeStyle=shade(wall,-22);g.lineWidth=Math.max(.6,unit*.09);g.beginPath();g.moveTo(...at(0,h));g.lineTo(...at(1,h));g.stroke();}
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const u=(col+.19)*bay,v=(col+.81)*bay,z0=row*floor+Math.min(.85,floor*.25),z1=(row+1)*floor-.5;if(z1<=z0)continue;const seed=(b.id*131+i*233+row*31+col*17)>>>0,lit=seed%7<3,win:Win={A:at(u,z0),B:at(v,z0),C:at(v,z1),D:at(u,z1),seed,col:lit?'#e3cd91':'#667c7e'};
    polygon([win.A,win.B,win.C,win.D],lit?'#b6af84':'#526771',shade(wall,-30));g.strokeStyle='#afb6a077';g.lineWidth=.65;g.beginPath();g.moveTo(...at((u+v)/2,z0));g.lineTo(...at((u+v)/2,z1));g.moveTo(...at(u,z1-.12));g.lineTo(...at(v,z1-.12));g.stroke();windows.push(win);
    if(row===0&&style.kind!=='house'&&col%4===0)polygon([at(u-.03,.05),at(v+.03,.05),at(v+.03,z1),at(u-.03,z1)],'#354b4e','#a7aa91');
   }
   // Rainwater pipes follow wall ends; shop awnings share the same polygon coordinates.
   g.strokeStyle=shade(wall,-35);g.lineWidth=Math.max(1,unit*.08);for(const u of[.025,.975]){g.beginPath();g.moveTo(...at(u,.15));g.lineTo(...at(u,top-.1));g.stroke();}
   if(['dairy','cafe','hotel'].includes(style.kind)&&length>5){const u0=.08,u1=.92,h=Math.min(3,top-.7),out=.65,nx=(dy/length)*winding,ny=(-dx/length)*winding;polygon([at(u0,h),at(u1,h),P(a[0]+dx*u1+nx*out,a[1]+dy*u1+ny*out,h-.3),P(a[0]+dx*u0+nx*out,a[1]+dy*u0+ny*out,h-.3)],'#b3a873');}
  }
  polygon(points.map(p=>P(p[0],p[1],top)),arch.roof,'#343e3c');
  // Roof seams are clipped to the exact surveyed outline, with restrained service fittings.
  g.save();g.beginPath();points.forEach((p,i)=>i?g.lineTo(...P(p[0],p[1],top)):g.moveTo(...P(p[0],p[1],top)));g.closePath();g.clip();const bb={x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))};g.strokeStyle=shade(arch.roof,-16);g.lineWidth=.6;for(let x=bb.x0;x<bb.x1;x+=2.5){g.beginPath();g.moveTo(...P(x,bb.y0,top));g.lineTo(...P(x,bb.y1,top));g.stroke();}g.restore();
  // A bounded detail set per roof, positioned within the footprint rather than floating beside it.
  const cx=points.reduce((n,p)=>n+p[0],0)/points.length,cy=points.reduce((n,p)=>n+p[1],0)/points.length,r=P(cx,cy,top);g.fillStyle='#737d75';g.fillRect(r[0]-unit*.65,r[1]-unit*.45,unit*1.3,unit*.8);g.strokeStyle='#a1aaa0';g.strokeRect(r[0]-unit*.65,r[1]-unit*.45,unit*1.3,unit*.8);
  const life=document.createElement('canvas');life.width=cv.width;life.height=cv.height;return{cv,life,at:origin,ox,oy,unit,windows,stamp:-1,bytes:cv.width*cv.height*8,top};
 }
 draw(g:CanvasRenderingContext2D,b:MappedBuilding,P:Project,scale:number,focus:Pt):void{
  const corners=b.points.map(p=>P(p[0],p[1])),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),height=b.height*scale,W=g.canvas.clientWidth||g.canvas.width,H=g.canvas.clientHeight||g.canvas.height;
  if(Math.max(...xs)<-70||Math.min(...xs)>W+70||Math.max(...ys)<-70||Math.min(...ys)-height>H+70)return;
  let mesh=this.cache.get(b.id);if(!mesh){if(this.jobs&&performance.now()>this.deadline){g.fillStyle='#6f7b72';g.beginPath();b.points.forEach((p,i)=>i?g.lineTo(...P(p[0],p[1],b.height)):g.moveTo(...P(p[0],p[1],b.height)));g.closePath();g.fill();return;}mesh=this.create(b);this.jobs++;this.cache.set(b.id,mesh);this.bytes+=mesh.bytes;while(this.cache.size>100||this.bytes>128*1024*1024){const id=this.cache.keys().next().value!;if(id===b.id)break;const old=this.cache.get(id)!;this.bytes-=old.bytes;this.cache.delete(id);}}
  else{this.cache.delete(b.id);this.cache.set(b.id,mesh);}
  const p=P(...mesh.at),f=scale/mesh.unit,x=p[0]-mesh.ox*f,y=p[1]-mesh.oy*f,ground=pointInside(focus,corners),cover=!ground&&focus[0]>=Math.min(...xs)&&focus[0]<=Math.max(...xs)&&focus[1]<Math.max(...ys)&&focus[1]>Math.min(...ys)-height;
  g.save();if(cover)g.globalAlpha=.25;g.drawImage(mesh.cv,x,y,mesh.cv.width*f,mesh.cv.height*f);
  if(scale>=3){const stamp=Math.floor(performance.now()/83),visible=mesh.windows.filter(w=>{const sx=x+w.A[0]*f,sy=y+w.A[1]*f;return sx>-20&&sx<W+20&&sy>-20&&sy<H+20&&Math.hypot(w.A[0]-w.B[0],w.A[1]-w.B[1])*f>=5;}).slice(0,36);if(stamp!==mesh.stamp){mesh.stamp=stamp;const lg=mesh.life.getContext('2d')!;lg.clearRect(0,0,mesh.life.width,mesh.life.height);paintWindowStories(lg,visible,stamp/12);}g.drawImage(mesh.life,x,y,mesh.life.width*f,mesh.life.height*f);}
  g.restore();
 }
}
function pointInside(p:Pt,points:Pt[]):boolean{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
