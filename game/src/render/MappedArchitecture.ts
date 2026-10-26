import {AerialRoofs} from './AerialRoofs';
import {mappedFacadeStyle} from '../content/mappedFacadeStyle';
import {MAPPED_HEIGHT_RATIO} from '../world/WorldScale';
import {architectureRaster} from './ArchitectureRaster';
import type {MappedBuilding} from '../ui/DestinationDistrict';
import {mappedBuildingStyle} from '../content/mappedBuildingStyle';
import {paintWindowStories,type Win} from './NightGlow';

type Pt=[number,number];type Project=(x:number,y:number,z?:number)=>Pt;
interface Mesh{aerial:string;cv:HTMLCanvasElement;life:HTMLCanvasElement|null;at:Pt;ox:number;oy:number;unit:number;windows:Win[];stamp:number;bytes:number;top:number;extent:number;tags:MappedBuilding['tags'];name:string}
const shade=(hex:string,n:number)=>{const s=hex.replace('#','');return '#'+[0,2,4].map(i=>Math.max(0,Math.min(255,parseInt(s.slice(i,i+2),16)+n)).toString(16).padStart(2,'0')).join('');};
/** Exact polygon extrusion. Static architecture is cached; a small room layer updates at 12 Hz. */
export class MappedArchitecture{
 readonly aerial=new AerialRoofs();aerialEnabled=false;
 get aerialStatus(){return{loaded:this.aerial.loaded,failed:this.aerial.failed,surveys:[...this.aerial.surveys],owners:[...this.aerial.owners]};}
 private cache=new Map<number,Mesh>();private bytes=0;private jobs=0;private deadline=0;private quality=1;private windowJobs=0;private zoomMoving=false;
 beginFrame(quality=1,zoomMoving=false):void{this.aerial.beginFrame();this.zoomMoving=zoomMoving;this.jobs=0;this.windowJobs=0;this.quality=quality;this.deadline=performance.now()+1;}
 clear():void{this.cache.clear();this.bytes=0;this.aerial.clear();}
 top(b:MappedBuilding):number{return b.height;}
 private create(b:MappedBuilding,scale:number,dpr:number):Mesh{
  const points=b.points.filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);if(points.length>3&&points[0][0]===points[points.length-1][0]&&points[0][1]===points[points.length-1][1])points.pop();
  const arch=mappedFacadeStyle(b),style=mappedBuildingStyle(b),top=b.height,origin=points[0] as Pt,raw=(x:number,y:number,z=0):Pt=>[x-origin[0]-y+origin[1],(x-origin[0]+y-origin[1])*.5-z*MAPPED_HEIGHT_RATIO],all=points.flatMap(p=>[raw(p[0],p[1]),raw(p[0],p[1],top)]),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1])),extent=Math.max(maxX-minX,maxY-minY),unit=architectureRaster(extent,scale,dpr,this.quality),pad=16,cv=document.createElement('canvas');
  cv.width=Math.ceil((maxX-minX)*unit+pad*2);cv.height=Math.ceil((maxY-minY)*unit+pad*2);const g=cv.getContext('2d')!,ox=pad-minX*unit,oy=pad-minY*unit,P:Project=(x,y,z=0)=>{const p=raw(x,y,z);return[p[0]*unit+ox,p[1]*unit+oy];},windows:Win[]=[];
  const pitched=points.length===4&&['gabled','gable'].includes(arch.shape)&&top<20;
  const side0=Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]),side1=Math.hypot(points[2][0]-points[1][0],points[2][1]-points[1][1]);
  const roofRise=pitched?Math.min(top*.24,Math.min(side0,side1)*.28,3):0,wallTop=top-roofRise;
  const polygon=(ps:Pt[],color:string,stroke='#222c2d')=>{g.beginPath();ps.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fillStyle=color;g.fill();g.strokeStyle=stroke;g.lineWidth=.7;g.stroke();};
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),winding=area>=0?1:-1;
  const edges=points.map((p,i)=>({a:p,b:points[(i+1)%points.length],i})).filter(({a,b})=>((b[1]-a[1])-(b[0]-a[0]))*winding>0).sort((a,b)=>a.a[0]+a.a[1]+a.b[0]+a.b[1]-b.a[0]-b.a[1]-b.b[0]-b.b[1]);
  for(const {a,b:e,i} of edges){const dx=e[0]-a[0],dy=e[1]-a[1],length=Math.hypot(dx,dy),at=(u:number,z:number)=>P(a[0]+dx*u,a[1]+dy*u,z),wall=shade(arch.wall,dx>dy?-18:4);
   polygon([at(0,0),at(1,0),at(1,wallTop),at(0,wallTop)],wall);
   // Material courses are baked once, with no per-frame texture work.
   if(/brick|stone|timber|wood/.test(arch.material)){
    const spacing=/brick|stone/.test(arch.material)?.45:.3;
    g.strokeStyle=shade(wall,-10);g.lineWidth=Math.max(.7,unit*.025);
    for(let h=spacing;h<wallTop;h+=spacing){g.beginPath();g.moveTo(...at(0,h));g.lineTo(...at(1,h));g.stroke();}
   }
   const rows=Math.max(1,Math.min(18,style.floors)),floor=wallTop/rows,columns=Math.max(1,Math.min(30,Math.floor(length/arch.bayWidth))),bay=1/columns;
   // Continuous cornice/plinth and real edge-aligned floor bands anchor every facade part.
   for(const h of[.22,wallTop-.22,...Array.from({length:rows-1},(_,i)=>(i+1)*floor)]){g.strokeStyle=shade(wall,-22);g.lineWidth=Math.max(.6,unit*.09);g.beginPath();g.moveTo(...at(0,h));g.lineTo(...at(1,h));g.stroke();}
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const inset=arch.window==='ribbon'?.08:arch.heritage?.3:.19,u=(col+inset)*bay,v=(col+1-inset)*bay,z0=row*floor+Math.min(.85,floor*.25),z1=(row+1)*floor-.5;if(z1<=z0)continue;const seed=(b.id*131+i*233+row*31+col*17)>>>0,lit=seed%7<3,win:Win={A:at(u,z0),B:at(v,z0),C:at(v,z1),D:at(u,z1),seed,col:lit?'#e3cd91':'#667c7e'};
    if(arch.heritage){const shoulder=z1-Math.min(.7,(z1-z0)*.3);g.beginPath();g.moveTo(...at(u,z0));g.lineTo(...at(v,z0));g.lineTo(...at(v,shoulder));g.quadraticCurveTo(...at(v,z1-.2),...at((u+v)/2,z1));g.quadraticCurveTo(...at(u,z1-.2),...at(u,shoulder));g.closePath();g.fillStyle=lit?'#829599':'#415a67';g.fill();g.strokeStyle=arch.trim;g.lineWidth=Math.max(1,unit*.12);g.stroke();}
    else polygon([win.A,win.B,win.C,win.D],lit?'#839b9e':'#486673',shade(wall,-30));g.strokeStyle='#afb6a077';g.lineWidth=.65;g.beginPath();g.moveTo(...at((u+v)/2,z0));g.lineTo(...at((u+v)/2,z1));g.moveTo(...at(u,z1-.12));g.lineTo(...at(v,z1-.12));g.stroke();if(!arch.heritage)windows.push(win);
    if(row===0&&style.kind!=='house'&&col%4===0)polygon([at(u-.03,.05),at(v+.03,.05),at(v+.03,z1),at(u-.03,z1)],'#354b4e','#a7aa91');
   }
   if(style.kind==='house'&&i===edges[0].i){const h=Math.min(2.2,wallTop*.7);polygon([at(.4,.06),at(.6,.06),at(.6,h),at(.4,h)],'#35474b',shade(wall,-28));const knob=at(.56,h*.45);g.fillStyle='#cfb986';g.beginPath();g.arc(knob[0],knob[1],Math.max(1,unit*.035),0,Math.PI*2);g.fill();}
   if(arch.heritage){for(let col=0;col<=columns;col++){const u=col/columns,w=.065;polygon([at(u-w,0),at(u+w,0),at(u+w,wallTop),at(u-w,wallTop)],shade(arch.wall,-9),arch.trim);}}
   // Rainwater pipes follow wall ends; shop awnings share the same polygon coordinates.
   g.strokeStyle=shade(wall,-35);g.lineWidth=Math.max(1,unit*.08);for(const u of[.025,.975]){g.beginPath();g.moveTo(...at(u,.15));g.lineTo(...at(u,wallTop-.1));g.stroke();}
   if(['dairy','cafe','hotel'].includes(style.kind)&&length>5){const u0=.08,u1=.92,h=Math.min(3,top-.7),out=.65,nx=(dy/length)*winding,ny=(-dx/length)*winding;polygon([at(u0,h),at(u1,h),P(a[0]+dx*u1+nx*out,a[1]+dy*u1+ny*out,h-.3),P(a[0]+dx*u0+nx*out,a[1]+dy*u0+ny*out,h-.3)],'#b3a873');}
   const name=b.name||b.tags.address;if(name&&style.kind!=='house'&&length>7&&i===edges[0].i){const p0=at(.12,Math.min(wallTop-.35,3)),p1=at(.88,Math.min(wallTop-.35,3)),[start,end]=p0[0]<=p1[0]?[p0,p1]:[p1,p0],width=Math.hypot(end[0]-start[0],end[1]-start[1]);g.save();g.translate(...start);g.transform((end[0]-start[0])/width,(end[1]-start[1])/width,0,1,0,0);g.fillStyle='#233b3e';g.fillRect(0,-unit*.65,width,unit*.7);g.font=`600 ${Math.min(10,unit*.45)}px Arial`;g.textAlign='center';g.fillStyle='#dbce9f';g.fillText(name.slice(0,36),width/2,-unit*.16,width-unit*.5);g.restore();}
  }
  let photo=false;
  if(pitched){
   // Keep the mapped footprint and total height; the pitched roof replaces the upper wall volume.
   const q=(side0>=side1?points:[points[1],points[2],points[3],points[0]]) as Pt[],mid=(a:Pt,b:Pt):Pt=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const r0=mid(q[0],q[3]),r1=mid(q[1],q[2]),e=q.map(p=>P(p[0],p[1],wallTop)),a=P(...r0,top),b=P(...r1,top);
   polygon([e[0],e[3],a],shade(arch.wall,-12));polygon([e[1],e[2],b],arch.wall);
   const faces=[{ps:[e[0],e[1],b,a],depth:q[0][0]+q[0][1]+q[1][0]+q[1][1],color:shade(arch.roof,12)},{ps:[e[3],e[2],b,a],depth:q[3][0]+q[3][1]+q[2][0]+q[2][1],color:shade(arch.roof,-10)}];
   faces.sort((a,b)=>a.depth-b.depth);for(const f of faces)polygon(f.ps,f.color);
   if(this.aerialEnabled){photo=this.aerial.paint(g,[[...q[0],wallTop],[...q[1],wallTop],[...r1,top],[...r0,top]],P)||photo;photo=this.aerial.paint(g,[[...q[3],wallTop],[...q[2],wallTop],[...r1,top],[...r0,top]],P)||photo;}
  }else{polygon(points.map(p=>P(p[0],p[1],top)),arch.roof,'#343e3c');if(this.aerialEnabled)photo=this.aerial.paint(g,points.map(p=>[p[0],p[1],top]),P);}
  // Roof seams are clipped to the exact surveyed outline, with restrained service fittings.
  if(!pitched&&!photo){g.save();g.beginPath();points.forEach((p,i)=>i?g.lineTo(...P(p[0],p[1],top)):g.moveTo(...P(p[0],p[1],top)));g.closePath();g.clip();const bb={x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))};g.strokeStyle=shade(arch.roof,-16);g.lineWidth=.6;for(let x=bb.x0;x<bb.x1;x+=2.5){g.beginPath();g.moveTo(...P(x,bb.y0,top));g.lineTo(...P(x,bb.y1,top));g.stroke();}g.restore();
  // A bounded detail set per roof, positioned within the footprint rather than floating beside it.
  const cx=points.reduce((n,p)=>n+p[0],0)/points.length,cy=points.reduce((n,p)=>n+p[1],0)/points.length,r=P(cx,cy,top);g.fillStyle='#737d75';g.fillRect(r[0]-unit*.65,r[1]-unit*.45,unit*1.3,unit*.8);g.strokeStyle='#a1aaa0';g.strokeRect(r[0]-unit*.65,r[1]-unit*.45,unit*1.3,unit*.8);}
  return{aerial:this.aerialEnabled?this.aerial.prepare(points):'off',cv,life:null,at:origin,ox,oy,unit,windows,stamp:-1,bytes:cv.width*cv.height*4,top,extent,tags:b.tags,name:b.name};
 }
 draw(g:CanvasRenderingContext2D,b:MappedBuilding,P:Project,scale:number,focus:Pt):void{
  const corners=b.points.map(p=>P(p[0],p[1])),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),height=b.height*scale*MAPPED_HEIGHT_RATIO,W=g.canvas.clientWidth||g.canvas.width,H=g.canvas.clientHeight||g.canvas.height;
  if(Math.max(...xs)<-70||Math.min(...xs)>W+70||Math.max(...ys)<-70||Math.min(...ys)-height>H+70)return;
  const aerial=this.aerialEnabled?this.aerial.prepare(b.points):'off';let mesh=this.cache.get(b.id);if(mesh&&(mesh.aerial!==aerial||mesh.top!==b.height||mesh.tags!==b.tags||mesh.name!==b.name)){this.bytes-=mesh.bytes;this.cache.delete(b.id);mesh=undefined;}if(mesh&&!this.zoomMoving&&mesh.unit<architectureRaster(mesh.extent,scale,g.getTransform().a,this.quality)*.7&&(!this.jobs||performance.now()<this.deadline)){this.bytes-=mesh.bytes;this.cache.delete(b.id);mesh=undefined;}if(!mesh){if(this.jobs&&performance.now()>this.deadline){g.fillStyle='#6f7b72';g.beginPath();b.points.forEach((p,i)=>i?g.lineTo(...P(p[0],p[1],b.height)):g.moveTo(...P(p[0],p[1],b.height)));g.closePath();g.fill();return;}mesh=this.create(b,scale,g.getTransform().a);this.jobs++;this.cache.set(b.id,mesh);this.bytes+=mesh.bytes;while(this.cache.size>96||this.bytes>64*1024*1024){const id=this.cache.keys().next().value!;if(id===b.id)break;const old=this.cache.get(id)!;this.bytes-=old.bytes;this.cache.delete(id);}}
  else{this.cache.delete(b.id);this.cache.set(b.id,mesh);}
  const p=P(...mesh.at),f=scale/mesh.unit,x=p[0]-mesh.ox*f,y=p[1]-mesh.oy*f,ground=pointInside(focus,corners),cover=!ground&&focus[0]>=Math.min(...xs)&&focus[0]<=Math.max(...xs)&&focus[1]<Math.max(...ys)&&focus[1]>Math.min(...ys)-height;
  g.save();if(cover)g.globalAlpha=.25;g.drawImage(mesh.cv,x,y,mesh.cv.width*f,mesh.cv.height*f);
  if(scale>=3&&this.quality>=2&&this.windowJobs++<6){const stamp=Math.floor(performance.now()/83),visible=mesh.windows.filter(w=>{const sx=x+w.A[0]*f,sy=y+w.A[1]*f;return sx>-20&&sx<W+20&&sy>-20&&sy<H+20&&Math.hypot(w.A[0]-w.B[0],w.A[1]-w.B[1])*f>=5;}).slice(0,36);if(stamp!==mesh.stamp){mesh.stamp=stamp;if(!mesh.life){mesh.life=document.createElement('canvas');mesh.life.width=mesh.cv.width;mesh.life.height=mesh.cv.height;const extra=mesh.cv.width*mesh.cv.height*4;mesh.bytes+=extra;this.bytes+=extra;}const lg=mesh.life.getContext('2d')!;lg.clearRect(0,0,mesh.life.width,mesh.life.height);paintWindowStories(lg,visible,stamp/12);}if(mesh.life)g.drawImage(mesh.life,x,y,mesh.life.width*f,mesh.life.height*f);}
  g.restore();
 }
 glow(g:CanvasRenderingContext2D,b:MappedBuilding,P:Project,scale:number,strength:number):void{const m=this.cache.get(b.id);if(!m)return;const p=P(...m.at),f=scale/m.unit,x=p[0]-m.ox*f,y=p[1]-m.oy*f;g.save();g.globalCompositeOperation='destination-out';g.drawImage(m.cv,x,y,m.cv.width*f,m.cv.height*f);g.globalCompositeOperation='source-over';g.globalAlpha=Math.min(.65,strength*.8);g.translate(x,y);g.scale(f,f);for(const w of m.windows){if(w.seed%7>=3)continue;g.beginPath();g.moveTo(...w.A);g.lineTo(...w.B);g.lineTo(...w.C);g.lineTo(...w.D);g.closePath();g.fillStyle=w.col;g.fill();}g.globalAlpha=Math.min(.8,strength);if(m.life)g.drawImage(m.life,0,0);g.restore();}
}
function pointInside(p:Pt,points:Pt[]):boolean{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
