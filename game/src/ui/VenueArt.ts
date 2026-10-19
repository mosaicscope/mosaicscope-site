import type { Character } from "../entities/types";
import { pose, solve, drawFigure } from "../render/StickFigure";
import { fillTextured } from "../render/Textures";
import { canvasStage, roundBox, sceneText } from './CanvasStage';
import type { ExpansionState } from '../sim/Expansion';
import type { Simulation } from '../sim/Simulation';
import type { Encounter } from '../content/encounters';
import { Camera } from '../render/Camera';
import { drawBuildingTile, GLOW } from '../render/Buildings';

type Point = [number, number];
type Project = (x: number, y: number, z?: number) => Point;
const TAU = Math.PI * 2;

/** Street encounters use the real city facade and the same characters as the world outside. */
export function encounterScene(sim:Simulation,event:Encounter|undefined,completed=false) {
  const id=event?.id??'',player=sim.player;
  const domestic=['flat','wind','poster','parcel'].includes(id);
  const candidates=sim.world.buildings.filter(b=>domestic?(b.kind==='house'||b.kind==='apartments')&&b.floors<=3:b.floors<=3);
  const b=candidates.sort((a,b)=>Math.hypot(a.door.x-player.x,a.door.y-player.y)-Math.hypot(b.door.x-player.x,b.door.y-player.y))[0]??sim.world.buildings[0];
  const camera=new Camera();camera.resize(960,600);camera.x=b?b.door.x:player.x;camera.y=b?b.door.y:player.y;
  camera.zoom=b?Math.max(.65,Math.min(1.55,640/((b.x1-b.x0+b.y1-b.y0+4)*32+b.height*12))):1.5;
  const raw=(x:number,y:number,z=0):Point=>{const p=camera.toScreen(x,y,z,{x:0,y:0});return[p.x,p.y];};
  const bounds=b?[raw(b.x0,b.y0,b.height+1.5),raw(b.x0,b.y1+1),raw(b.x1+1,b.y0),raw(b.x1+1,b.y1+1)]:[[480,200],[480,350]];
  const ox=480-(Math.min(...bounds.map(p=>p[0]))+Math.max(...bounds.map(p=>p[0])))/2;
  const oy=240-(Math.min(...bounds.map(p=>p[1]))+Math.max(...bounds.map(p=>p[1])))/2;
  const P:Project=(x,y,z=0)=>{const [sx,sy]=raw(x,y,z);return[sx+ox,sy+oy];};
  const front=b?.door.face==='e',ax=(b?.door.x??player.x)+(front?1.2:.2),ay=(b?.door.y??player.y)+(front ? .2 : 1.2);
  // Local event coordinates run along the front wall and out into the footpath.
  const E:Project=(x,y,z=0)=>front?P(ax+y,ay+x,z):P(ax+x,ay+y,z);
  const background=document.createElement('canvas');background.width=960;background.height=600;
  const bg=background.getContext('2d')!;backdrop(bg);
  const gx=b?b.x0-2:ax-4,gy=b?b.y0-2:ay-4,gw=b?b.x1-b.x0+7:9,gd=b?b.y1-b.y0+7:9;
  box(bg,P,gx,gy,gw,gd,.1,'#444943',-.1);
  box(bg,P,gx,gy+gd-2,gw,2,.02,'#32363c');box(bg,P,gx+gw-2,gy,2,gd,.02,'#32363c');
  for(let x=0;x<gw-2;x++)for(let y=0;y<gd-2;y++){
    polygon(bg,[P(gx+x,gy+y),P(gx+x+1,gy+y),P(gx+x+1,gy+y+1),P(gx+x,gy+y+1)],(x+y)%2?'#9b94822b':'#777d7520');
  }
  if(b){
    const stamp=GLOW.length;
    try{
      const tiles:{x:number;y:number}[]=[];
      for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++)tiles.push({x,y});
      tiles.sort((a,b)=>a.x+a.y-b.x-b.y);
      const graffiti=new Map(sim.world.graffiti.map(q=>[`${q.tx},${q.ty},${q.face}`,q]));
      for(const q of tiles){const [x,y]=P(q.x,q.y);drawBuildingTile(bg,sim.world,b,q.x,q.y,x,y,camera.zoom,0,.18,1,graffiti);}
    }finally{GLOW.length=stamp;}
  }
  const people=[player,...sim.chars.filter(c=>c.id!==player.id&&c.tier==='principal').slice(0,3)];
  return canvasStage((g,time,reduced)=>{
    const t=reduced?0:time;g.drawImage(background,0,0);
    const smallBox=(x:number,y:number,color='#a88b62')=>{box(g,E,x,y,.48,.42,.4,color);};
    const bench=()=>{box(g,E,-.4,.4,1.8,.45,.4,'#70523f');box(g,E,-.4,.8,1.8,.12,.45,'#896750',.4);};
    const water=()=>{for(let i=0;i<4;i++){const[x,y]=E(i*.6-.5,1.2+Math.sin(t+i)*.08);g.fillStyle='#679ea875';g.beginPath();g.ellipse(x,y,35,11,0,0,TAU);g.fill();}};
    const wheels=(x:number,y:number)=>{for(const dx of[0,.7]){const[sx,sy]=E(x+dx,y);g.strokeStyle='#202c31';g.lineWidth=3;g.beginPath();g.arc(sx,sy,13,0,TAU);g.stroke();}const[a,c]=E(x,y,.2),[d,e]=E(x+.7,y,.2);g.strokeStyle='#bb925b';g.lineWidth=2;g.beginPath();g.moveTo(a,c);g.lineTo(d,e);g.lineTo(d-8,e-18);g.stroke();};
    switch(id){
      case 'flat': {
        const shift=completed?1.6:0,wobble=completed?0:Math.sin(t*1.6)*.035;
        box(g,E,-.6+shift,-.5+wobble,1.8,.7,.42,'#795362');box(g,E,-.6+shift,-.5+wobble,1.8,.15,.48,'#956a78',.42);
        for(const x of[-.6,1])box(g,E,x+shift,-.5+wobble,.2,.75,.3,'#8e6171',.42);
        if(!completed){smallBox(1.4,.6);smallBox(1.9,.6,'#a38b6e');}break;
      }
      case 'dog': animalSprite(g,...E(.8+Math.sin(t)*.15,1.4),'Working dogs',t,1.1);break;
      case 'duck':for(let i=0;i<5;i++)animalSprite(g,...E(-1+i*.45,1.5+Math.sin(t+i)*.05),'Ducks',t+i,.6);break;
      case 'water':case 'flood':case 'book':water();for(let i=0;i<3;i++)smallBox(-.7+i*.6,.5,'#9d977e');break;
      case 'bike':case 'bee':wheels(0,.8);break;
      case 'market':case 'hail':case 'seed':
        box(g,E,-.7,.5,2,1,.6,'#896c4c');for(let i=0;i<6;i++)smallBox(-.6+i%3*.6,.5+Math.floor(i/3)*.4,['#9da663','#c69b64','#b67658'][i%3]);break;
      case 'busker':case 'choir':case 'piano':case 'puppet':
        box(g,E,-.5,.4,1.4,.65,.65,'#513e36');for(let i=0;i<9;i++)box(g,E,-.45+i*.14,1.02,.11,.16,.03,i%3?'#e4d8be':'#292e30',.65);break;
      case 'wallet':case 'ring':case 'memorial':case 'skater':bench();smallBox(1.4,1.1,'#c2a672');break;
      case 'bus':case 'tram':
        box(g,E,-1.1,1.2,3,1.15,1.2,'#976d4f');box(g,E,-.9,1.14,2.6,.08,.55,'#789aa5',.5);break;
      case 'mural':case 'poster':
        box(g,E,.1,.2,1.6,.08,1.25,'#ba9b7c');for(let i=0;i<4;i++)box(g,E,.15+i*.35,.28,.25,.02,.8,['#648e91','#a76a69','#b9a566','#717894'][i],.2);break;
      case 'cone':case 'quake':
        for(let i=0;i<4;i++){const[x,y]=E(i*.5-.7,1);polygon(g,[[x-9,y],[x,y-25],[x+9,y]],'#bf784d');}break;
      case 'trolley':wheels(.4,1);box(g,E,.4,.9,.8,.55,.65,'#869394');break;
      case 'wind':
        for(let i=0;i<4;i++)box(g,E,i*.6-.7,1+Math.sin(t+i)*.1,.5,.6,.015,['#b8c3b1','#ab8a83','#798d9d'][i%3]);break;
      case 'wedding':case 'film':
        box(g,E,.5,1,.13,.13,1,'#59544c');box(g,E,.3,1,.5,.3,.3,'#303d45',1);break;
      default:for(let i=0;i<3;i++)smallBox(-.6+i*.65,.7,['#967d60','#a79172','#797e6a'][i]);
    }
    const poses=id==='flat'&&!completed?['craft','craft','idle','idle']:completed?['posecool','posecool','idle','idle']:['idle','phone','idle','idle'];
    const positions=[[-.9,.8],[1.4,.8],[-.3,2],[1.7,1.8]];
    positions.map(([x,y],i)=>({x,y,i})).sort((a,b)=>a.x+a.y-b.x-b.y).forEach(a=>{const[x,y]=E(a.x,a.y);drawVenuePerson(g,people[a.i],x,y,t,1.9,poses[a.i]);});
    roundBox(g,20,18,920,57,9,'#102b32ed');sceneText(g,event?.title.toUpperCase()??'STORIES AROUND EVERY CORNER',40,43,21,'#ead7a1','left');
    sceneText(g,completed?'RESOLVED · Your choice is recorded':sim.world.streetName(player.x,player.y)||'ŌTAUTAHI · STREET ENCOUNTER',40,63,12,'#b5c9bd','left');
    roundBox(g,20,542,920,38,8,'#102b32ed');sceneText(g,completed?'Keep walking to find your next story':event?'Choose how this scene unfolds below':'Explore the city to discover people who need a hand',40,566,14,'#e4d8b7','left');
  },{height:600,label:`${event?.title??'Neighbourhood'}: isometric street scene using the real city building and street character models${completed?' · resolved':''}`});
}
function polygon(g: CanvasRenderingContext2D, points: Point[], color: string) {
  g.fillStyle = color; g.beginPath(); points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.closePath(); g.fill();g.strokeStyle="rgba(14,11,10,.12)";g.lineWidth=.7;g.stroke();
}
function shade(hex: string, factor: number) {
  const n = parseInt(hex.slice(1),16);
  return `rgb(${[n>>16&255,n>>8&255,n&255].map(v=>Math.min(255,Math.round(v*factor))).join(',')})`;
}
function box(g: CanvasRenderingContext2D, P: Project, x:number,y:number,w:number,d:number,h:number,color:string,z=0) {
  polygon(g,[P(x,y+d,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x,y+d,z+h)],shade(color,.86));
  polygon(g,[P(x+w,y,z),P(x+w,y+d,z),P(x+w,y+d,z+h),P(x+w,y,z+h)],shade(color,.63));
  polygon(g,[P(x,y,z+h),P(x+w,y,z+h),P(x+w,y+d,z+h),P(x,y+d,z+h)],shade(color,1.12));
}
function ground(g:CanvasRenderingContext2D,P:Project,w:number,d:number,color:string){box(g,P,0,0,w,d,.18,color,-.18);}
function tree(g:CanvasRenderingContext2D,P:Project,x:number,y:number,size=1) {
  box(g,P,x-.08,y-.08,.16,.16,.8*size,'#856443');
  const [sx,sy]=P(x,y,1.1*size);g.fillStyle='#193c3133';g.beginPath();const [fx,fy]=P(x+.25,y+.2);g.ellipse(fx,fy,18*size,7*size,0,0,TAU);g.fill();
  for(let i=0;i<3;i++){g.fillStyle=['#326e4b','#4b8a55','#70a35c'][i];g.beginPath();g.ellipse(sx+(i-1)*6*size,sy-i*8*size,15*size,22*size,0,0,TAU);g.fill();}
}
/** Every venue uses the actual street figures, including their faces, hair, clothes and proportions. */
export function venueCast(people:readonly Character[]):readonly Character[] {
  const crew=people.filter(c=>c.tier==='principal'),locals=people.filter(c=>c.tier!=='principal'&&c.tier!=='player');
  const cast:Character[]=[];for(let i=0;i<Math.max(crew.length,Math.min(30,locals.length));i++){if(crew[i])cast.push(crew[i]);if(locals[i])cast.push(locals[i]);}
  return cast.length?cast:people;
}
function peoplePainter(people:readonly Character[]) {
  let index=0;
  return (g:CanvasRenderingContext2D,x:number,y:number,_color:string,t=0,size=1,actorId?:number,facing?:number)=>{
    const c=people[(actorId??index++)%people.length];if(!c)return;
    drawVenuePerson(g,c,x,y,t,size,t?'walk':'idle',facing);
  };
}
function drawVenuePerson(g:CanvasRenderingContext2D,c:Character,x:number,y:number,t:number,size:number,kind:string,facing?:number) {
  const k=.30*size*(c.look.scale||1),dir=facing??(c.id%2?1:-1);
  g.save();g.fillStyle='#10262533';g.beginPath();g.ellipse(x,y,7*size,2.5*size,0,0,TAU);g.fill();
  solve(pose(kind,c.style||'normal',t+c.id,t*5,kind==='walk'?1.5:0,0),x,y,k,dir);
  drawFigure(g,c,x,y,k,dir,t,0,1);g.restore();
}
function backdrop(g:CanvasRenderingContext2D,night=false) {
  const bg=g.createLinearGradient(0,0,960,600);bg.addColorStop(0,night?'#172c3a':'#33423f');bg.addColorStop(1,night?'#0a1721':'#1b2d33');g.fillStyle=bg;g.fillRect(0,0,960,600);
}

/** Original pixel silhouettes, drawn at a small native resolution and enlarged without interpolation. */
const sprites=new Map<string,HTMLCanvasElement>();
export function animalSprite(g:CanvasRenderingContext2D,x:number,y:number,kind:string,time:number,size=1,color?:string,jockey?:number) {
  const bird=/chick|duck|chook|goose/i.test(kind),horse=/horse|trainer|race/i.test(kind),sheep=/sheep/i.test(kind),cow=/cattle|cow/i.test(kind),pig=/pig/i.test(kind),dog=/dog|greyhound/i.test(kind),deer=/deer/i.test(kind),goat=/goat/i.test(kind),alpaca=/alpaca/i.test(kind),bee=/bee/i.test(kind);
  const frame=Math.floor(time*7)%4,key=`${kind}:${frame}:${color??''}:${jockey??''}`;
  let cv=sprites.get(key);
  if(!cv){
    cv=document.createElement('canvas');cv.width=64;cv.height=52;const c=cv.getContext('2d')!;
    const rect=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
    const poly=(points:Point[],col:string)=>polygon(c,points,col);
    const ink='#2b302b',body=color??(horse?'#8b573b':cow?'#e4ddc5':pig?'#df9d9b':sheep?'#dedbca':dog?'#a18a67':deer?'#aa8563':goat?'#bdbaa3':alpaca?'#e0d3b5':'#e5dfc3');
    if(bee){rect(12,24,33,21,'#6c4a2d');for(let i=0;i<4;i++)rect(11,25+i*5,35,3,'#deb45e');rect(22,30,11,7,'#342f27');for(let i=0;i<3;i++){rect(43+i*5,10+i*4,5,3,'#f4d064');rect(44+i*5,9+i*4,2,5,'#42352a');}}
    else if(bird){
      const duck=/duck/i.test(kind),chick=/chick/i.test(kind);const col=duck?'#9a8d76':chick?'#e2d5aa':'#ad6841';
      poly([[11,24],[17,18],[34,18],[40,26],[36,36],[20,37],[12,32]],ink);poly([[14,24],[20,20],[34,21],[37,27],[33,34],[21,34]],col);
      poly([[11,26],[5,18],[7,33],[16,34]],duck?'#514e48':'#38684f');rect(34,13,9,15,ink);rect(35,14,8,12,duck?'#45694f':'#ddd3ba');rect(39,10,10,11,ink);rect(40,11,9,9,duck?'#3c7456':'#e6ddbf');rect(48,15,9,4,'#e8b74d');rect(44,13,2,2,ink);
      if(!duck){rect(40,6,3,5,'#bb403e');rect(44,7,3,4,'#d44941');rect(42,20,3,6,'#bc4540');}
      rect(21+frame%2*2,36,2,9,'#c28c3d');rect(30-frame%2*2,35,2,10,'#c28c3d');rect(18+frame%2*2,44,7,2,'#d9aa53');rect(27-frame%2*2,44,7,2,'#d9aa53');
      poly([[17,26],[24,23],[32,25],[29,31],[22,32]],shade(col,.8));
    }else{
      const neck=horse||deer||alpaca?12:goat?7:0,headY=20-neck;
      // Tail, four independently stepping legs, then body and neck.
      poly([[10,24],[5,22],[3,32],[6,35],[8,28],[12,29]],horse?'#362f29':shade(body,.7));
      for(let i=0;i<4;i++){const lx=15+(i%2)*20+(i>1?3:0),step=[-2,1,2,-1][(frame+i*2)%4];poly([[lx,31],[lx+4,31],[lx+3+step,40],[lx+4-step,47],[lx-step,47],[lx-1+step,39]],i>1?shade(body,.65):body);rect(lx-step,46,5,3,ink);}
      poly([[10,24],[15,19],[37,19],[43,25],[40,35],[16,36],[10,31]],ink);poly([[12,24],[17,21],[36,21],[40,26],[37,33],[16,34],[12,30]],body);
      poly([[33,25],[37,headY],[43,headY-2],[47,headY+5],[43,29]],body);
      poly([[38,headY-3],[45,headY-4],[48,headY],[56,headY+3],[56,headY+9],[47,headY+10],[40,headY+5]],ink);poly([[40,headY-2],[45,headY-2],[47,headY+2],[54,headY+4],[54,headY+8],[47,headY+8],[42,headY+4]],body);rect(48,headY+1,2,2,ink);
      if(horse||deer||goat||alpaca){poly([[40,headY-2],[40,headY-9],[44,headY-5],[45,headY-2]],shade(body,.7));rect(37,headY,3,15,horse?'#3f3029':shade(body,.85));}
      if(cow){for(const [px,py,w,h]of[[16,22,8,8],[30,25,7,7],[40,headY,4,7]])rect(px,py,w,h,'#555647');rect(47,headY+6,8,4,'#c79885');rect(39,headY-5,3,6,'#ddd1a8');}
      if(sheep){for(let i=0;i<9;i++)rect(12+i%5*5,19+Math.floor(i/5)*9,7,9,i%3?'#e5e0ce':'#c6c6b7');rect(43,headY,8,7,'#7e7769');}
      if(pig){rect(49,headY+4,8,6,'#edb6a8');rect(52,headY+5,1,2,ink);rect(55,headY+5,1,2,ink);rect(40,headY-5,5,7,'#bd7a7d');}
      if(goat||deer){poly([[39,headY],[37,headY-10],[34,headY-13],[36,headY-13],[41,headY-7],[42,headY]],'#cbb48b');if(deer){rect(33,headY-10,6,2,'#cbb48b');rect(35,headY-17,2,7,'#cbb48b');}}
      if(dog){rect(41,headY,4,10,'#68513c');rect(50,headY+4,6,4,'#40382d');}
      if(jockey!==undefined){rect(23,17,14,6,['#e45652','#5592db','#e1be4f','#65a879','#b181ca','#e9e3ce'][jockey%6]);}
    }
    // Cached per species/coat/frame, independent of the number of animals on screen.
    sprites.set(key,cv);
  }
  g.save();g.translate(x,y);g.fillStyle='#142a2930';g.beginPath();g.ellipse(0,2,36*size,8*size,0,0,TAU);g.fill();g.imageSmoothingEnabled=false;g.drawImage(cv,-43*size,-64*size,86*size,70*size);g.restore();
}

function building(g:CanvasRenderingContext2D,P:Project,x:number,y:number,w:number,d:number,h:number,col:string,roof='#405764',columns=false) {
  box(g,P,x-.12,y-.12,w+.24,d+.24,.2,'#c3bbaa');box(g,P,x,y,w,d,h,col,.2);box(g,P,x-.08,y-.08,w+.16,d+.16,.18,roof,h+.2);
  polygon(g,[P(x,y,h+.39),P(x+w,y,h+.39),P(x+w,y+d,h+.39),P(x,y+d,h+.39)],roof);fillTextured(g,'concrete',.5,{x:0,y:0,zoom:1});
  for(let floor=0;floor<Math.floor(h/.65);floor++)for(let i=0;i<Math.floor(w/.4);i++){
    const a=x+.12+i*.4;polygon(g,[P(a,y+d+.01,.45+floor*.65),P(a+.22,y+d+.01,.45+floor*.65),P(a+.22,y+d+.01,.88+floor*.65),P(a,y+d+.01,.88+floor*.65)],'#92c0c4');
  }
  for(let floor=0;floor<Math.floor(h/.65);floor++)for(let i=0;i<Math.floor(d/.4);i++){
    const a=y+.12+i*.4;polygon(g,[P(x+w+.01,a,.45+floor*.65),P(x+w+.01,a+.2,.45+floor*.65),P(x+w+.01,a+.2,.88+floor*.65),P(x+w+.01,a,.88+floor*.65)],'#477c90');
  }
  if(columns)for(let i=0;i<=Math.floor(w/.6);i++)box(g,P,x+i*.6,y+d+.03,.12,.16,h,'#f3e5c9',.2);
}
function dome(g:CanvasRenderingContext2D,P:Project,x:number,y:number,z:number,r:number) {
  const [sx,sy]=P(x,y,z);g.fillStyle='#234e67';g.beginPath();g.ellipse(sx,sy,31*r,14*r,0,0,TAU);g.fill();const grd=g.createLinearGradient(sx-25*r,sy-40*r,sx+25*r,sy);grd.addColorStop(0,'#8eb3c1');grd.addColorStop(.45,'#3d7996');grd.addColorStop(1,'#244657');g.fillStyle=grd;g.beginPath();g.ellipse(sx,sy-5*r,28*r,34*r,0,Math.PI,TAU);g.fill();g.strokeStyle='#a6c4c1';g.lineWidth=1;for(let i=-1;i<=1;i++){g.beginPath();g.ellipse(sx,sy-5*r,Math.max(2,Math.abs(i)*16+3)*r,32*r,0,Math.PI,TAU);g.stroke();}g.fillStyle='#d4c495';g.fillRect(sx-2,sy-45*r,4,9*r);
}

export function campusScene(s:ExpansionState,select?:(x:number,y:number)=>void,people:readonly Character[]=[]) {
  const P:Project=(x,y,z=0)=>[480+(x-y)*43,125+(x+y)*21-z*43];
  const sites=[{x:1,y:1,w:4.4,d:2.2,id:400,label:'LECTURE HALL'},{x:7,y:1,w:2.4,d:3.2,id:100,label:'LIBRARY'},{x:1,y:6,w:3.1,d:2.2,id:600,label:'EXAM STUDIO'},{x:7,y:7,w:2.3,d:2,id:850,label:'STUDENT CAFE'}];
  return canvasStage((g,t,reduced)=>{
  const person=peoplePainter(venueCast(people));
    backdrop(g);ground(g,P,11,11,'#697e58');
    for(let i=0;i<11;i++)for(let j=0;j<11;j++)if((i+j)%2===0)polygon(g,[P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1)],'#88955c22');
    box(g,P,5.4,0,1,11,.02,'#dcd7c2');box(g,P,0,4.3,11,1,.02,'#dcd7c2');box(g,P,0,9.6,11,.55,.03,'#c2bdb0');
    for(let i=0;i<9;i++){tree(g,P,.35,i+1,.65);tree(g,P,10.4,i+1,.65);}
    const objects:{depth:number;draw:()=>void}[]=[
      {depth:5.3,draw:()=>{building(g,P,1,1,4.4,2.2,2.05,'#c6bdad','#354d5d',true);dome(g,P,3.2,1.95,2.6,1);}},
      {depth:10.8,draw:()=>building(g,P,7,1,2.4,3.2,2.3,'#c8c6b5','#3b5965')},
      {depth:9.65,draw:()=>building(g,P,1,6,3.1,2.2,1.3,'#b67f64','#536367')},
      {depth:16.15,draw:()=>building(g,P,7,7,2.3,2,1,'#cead80','#777f65')},
    ];
    for(let i=0;i<12;i++){
      const travel=(i*.8+(reduced?0:t*.22))%18.4,forward=travel<9.2,along=.6+(forward?travel:18.4-travel);
      const wx=i%2?along:5.9+(i%3-1)*.15,wy=i%2?4.8+(i%3-1)*.12:along;
      objects.push({depth:wx+wy,draw:()=>{const[x,y]=P(wx,wy);person(g,x,y,'',reduced?0:t*1.8,1.15,i,(i%2?forward:!forward)?1:-1);}});
    }

    objects.sort((a,b)=>a.depth-b.depth);for(const o of objects)o.draw();
    // A planted quad, fountain, bike racks and campus life make this a place, not four cards.
    box(g,P,4.5,6.3,1.5,1.5,.12,'#c9c2aa');const [fx,fy]=P(5.2,7,.2);g.fillStyle='#6eb4b8';g.beginPath();g.ellipse(fx,fy,33,15,0,0,TAU);g.fill();g.strokeStyle='#c1e4dc';g.lineWidth=2;g.beginPath();g.moveTo(fx,fy);g.quadraticCurveTo(fx-12,fy-40,fx-20,fy-7);g.moveTo(fx,fy);g.quadraticCurveTo(fx+12,fy-40,fx+20,fy-7);g.stroke();

    for(const a of sites){const [x,y]=P(a.x+a.w/2,a.y+a.d+.3);roundBox(g,x-83,y+7,166,25,6,'#173a35e8');sceneText(g,a.label,x,y+24,12,'#efdfb4');}
    roundBox(g,24,20,330,55,10,'#163d38ed');sceneText(g,'UNIVERSITY OF CANTERBURY',42,43,15,'#efe4c3','left');sceneText(g,'ILAM · GAME CAMPUS',42,62,11,'#9fc6b7','left');
    roundBox(g,26,535,908,46,9,'#153b35ed');sceneText(g,s.degree?`${s.degree} · ${s.credits} course credits`:'Explore campus · choose a qualification below',47,563,17,'#e8ddbd','left');
  },{height:600,label:'Isometric Ilam university campus: click the library, lecture hall, exam studio or cafe',pointer:select?p=>{if(p.type!=='up')return;let best=sites[0],dist=Infinity;for(const a of sites){const [x,y]=P(a.x+a.w/2,a.y+a.d/2,.7),d=Math.hypot(p.x-x,p.y-y);if(d<dist){best=a;dist=d;}}if(dist<140)select(best.id,0);}:undefined});
}

function fence(g:CanvasRenderingContext2D,P:Project,x:number,y:number,w:number,d:number) {
  for(const [ax,ay,bx,by]of[[x,y,x+w,y],[x,y,x,y+d],[x+w,y,x+w,y+d],[x,y+d,x+w,y+d]]){
    const n=Math.ceil(Math.hypot(bx-ax,by-ay)*2);for(let i=0;i<=n;i++){const f=i/n;box(g,P,ax+(bx-ax)*f,ay+(by-ay)*f,.06,.06,.48,'#ddd2b5');}
    for(const z of [.19,.38]){g.strokeStyle='#cfbea0';g.lineWidth=2;g.beginPath();g.moveTo(...P(ax,ay,z));g.lineTo(...P(bx,by,z));g.stroke();}
  }
}
export function farmScene(s:ExpansionState,horseOnly=false,people:readonly Character[]=[]) {
 const P:Project=(x,y,z=0)=>[480+(x-y)*40,90+(x+y)*20-z*40];
 return canvasStage((g,t,reduced)=>{
  const person=peoplePainter(venueCast(people));
  if(reduced)t=0;backdrop(g);ground(g,P,12,12,'#6b8053');
  for(let i=0;i<12;i++)for(let j=0;j<12;j++)polygon(g,[P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1)],(i+j)%2?'#82955b33':'#9c9f6322');
  box(g,P,0,5.3,12,.8,.02,'#c5b18b');box(g,P,5.6,0,.7,12,.02,'#c5b18b');
  building(g,P,.7,.7,3.1,2.4,1.3,'#a85743','#62534a');building(g,P,8,.7,2.3,1.8,.9,'#a99b78','#556659');
  for(let i=0;i<6;i++)box(g,P,7.4+i*.38,3.25,.24,1.5,.07,'#a4bb63');
  for(const [x,y,w,d]of[[.4,6.7,4.6,4.7],[6.9,6.7,4.6,4.7],[.4,3.5,4.6,1.3],[6.9,3.5,4.6,1.3]])fence(g,P,x,y,w,d);
  for(let i=0;i<6;i++){tree(g,P,i*2+.3,11.7,.75);tree(g,P,11.7,i*2+.3,.75);}
  if(s.machines.includes('Tractor')){box(g,P,4.3,2.6,.9,1.4,.45,'#c64c3f');box(g,P,4.35,2.7,.8,.6,.7,'#599c9d',.45);for(let i=0;i<4;i++){const [x,y]=P(4.2+i%2*1.1,2.7+Math.floor(i/2),.1);g.fillStyle='#2e3830';g.beginPath();g.ellipse(x,y,8,12,0,0,TAU);g.fill();}}
  for(let i=0;i<3;i++){const travel=(i*3+t*.2)%18,forward=travel<9;const[x,y]=P(5.95,1+(forward?travel:18-travel));person(g,x,y,'',reduced?0:t*1.7,1.1,i,forward?-1:1);}
  const animals=horseOnly?(s.horse?[['Horse',1] as const]:[]):Object.entries(s.animals);
  let idx=0;const actors:{x:number;y:number;kind:string;index:number}[]=[];
  for(const [kind,count]of animals)for(let n=0;n<Math.min(count,12)&&idx<36;n++,idx++){const q=idx%2;actors.push({x:(q?7.5:1.1)+(Math.floor(idx/2)%4)*.9+Math.sin(t*.3+idx)*.15,y:7.4+Math.floor(idx/8)*.9+Math.cos(t*.3+idx)*.15,kind,index:idx});}
  actors.sort((a,b)=>(a.x+a.y)-(b.x+b.y));for(const a of actors){const [x,y]=P(a.x,a.y);animalSprite(g,x,y,a.kind,t+a.index,horseOnly?1.5:.74);}
  // Feed troughs and hay visibly appear when those resources have been purchased.
  for(const x of[1,8]){box(g,P,x,10.5,1.1,.35,.18,'#66797a');if(s.feed>0)box(g,P,x+.07,10.55,.96,.25,.02,'#cbb965',.2);}
  const [bx,by]=P(3.9,1.7,1);sceneText(g,horseOnly?'STABLES':'CANTERBURY FARM',bx,by,12,'#f6e0b3');
  roundBox(g,24,20,350,58,10,'#1b4034ed');sceneText(g,horseOnly?(s.horse?.name??'YOUR RACING STABLE'):'YOUR CANTERBURY BLOCK',42,45,18,'#ebd89f','left');sceneText(g,horseOnly?'TRAIN · REST · RACE':'LIVING STOCK · PADDOCKS · FARM WORK',42,64,11,'#adc5a0','left');
  if(horseOnly){animalSprite(g,784,213,'Horse',s.horse&&s.horse.fitness>35?t:0,2.3);roundBox(g,646,240,285,83,10,'#153e35e8');sceneText(g,s.horse?`FITNESS ${s.horse.fitness}% · SKILL ${s.horse.skill}`:'Buy your first horse below',788,266,13);sceneText(g,`${s.horse?.wins??0} WINS`,788,291,18,'#ebcf7f');}
  roundBox(g,24,540,912,40,8,'#173b31e8');sceneText(g,horseOnly?'Your horse’s condition and career are saved':s.farm?`${Object.values(s.animals).reduce((a,b)=>a+b,0)} animals · ${s.feed} feed · ${s.machines.length} equipment upgrades`:'Preview your future farm · buy a lifestyle block below',45,565,15,'#e9dfbf','left');
 },{height:600,label:horseOnly?'Isometric stables and detailed pixel-art racehorse':'Isometric farm with distinct pixel-art animals, fenced paddocks, crops and purchased machinery'});
}

export interface RaceSceneState { sport:string; order:number[]; until:number; names:string[] }
export function raceScene(r:RaceSceneState|null,tick:()=>number,sport='Horse',people:readonly Character[]=[]) {
 let camera:'course'|'trackside'='course';
 const figure=canvasStage((g,t,reduced)=>{
  const person=peoplePainter(venueCast(people));
  backdrop(g);const active=!!r&&tick()<r.until,p=r?Math.max(0,Math.min(1,1-(r.until-tick())/270)):0,progress=reduced?(p>=1?1:0):p;
  const names=r?.names??["Nor’wester","Ilam Rocket","Rakaia Rebel","Dairy Debt","Riccarton Rain","Last Pie"],order=r?.order??[0,1,2,3,4,5];
  if(camera==='course'){
   const P:Project=(x,y,z=0)=>[480+(x-y)*35,95+(x+y)*18-z*35];ground(g,P,13,13,'#64934e');
   g.save();const o=P(6.5,6.5);g.translate(...o);g.transform(1,.5,-1,.5,0,0);
   g.lineWidth=66;g.strokeStyle='#c49b72';g.beginPath();g.ellipse(0,0,185,125,0,0,TAU);g.stroke();g.strokeStyle='#d0af87';g.lineWidth=52;g.stroke();
   for(const offset of[-34,34]){g.strokeStyle='#ece8d4';g.lineWidth=2;g.beginPath();g.ellipse(0,0,185+offset,125+offset,0,0,TAU);g.stroke();}g.restore();
   for(let i=0;i<8;i++){box(g,P,.4,1.2+i*.8,1.25,.7,.2+i%2*.08,'#a6a79a');}
   for(let row=0;row<3;row++)box(g,P,.3+row*.42,1,.42,6.6,.8-row*.23,'#a9a595');
   for(const y of[1,3.2,5.4,7.6])box(g,P,.25,y,.08,.08,1.9,'#586a75');box(g,P,.1,.8,.7,7,.08,'#586a75',1.9);building(g,P,4,4.7,3,1.3,.5,'#ded4bf','#4e6d6c');
   for(let i=0;i<16;i++){const [x,y]=P(.5,i*.4+1,.85);person(g,x,y,['#cd6b58','#c5ba7a','#6784a4'][i%3],0,.7);}
   const runners=names.map((_,i)=>{const rank=order.indexOf(i),lead=progress*(1-rank*.018),angle=(lead*.88+.1)*TAU;return {i,x:6.5+Math.cos(angle)*(5.05+i*.16),y:6.5+Math.sin(angle)*(3.65+i*.16)};}).sort((a,b)=>a.x+a.y-b.x-b.y);
   for(const a of runners){const [x,y]=P(a.x,a.y);g.save();g.translate(x,y);if(Math.sin((progress*.88+.1)*TAU)>0)g.scale(-1,1);animalSprite(g,0,0,r?.sport??sport,active&&!reduced?t+a.i:0,.68,undefined,/Horse|Trainer/.test(r?.sport??sport)?a.i:undefined);if(/Horse|Trainer/.test(r?.sport??sport)&&people.length)drawVenuePerson(g,people[a.i%people.length],0,-23,0,.72,'sit');g.restore();}
   for(let i=0;i<10;i++){tree(g,P,12.5,i+1,.55);tree(g,P,i+1,12.5,.55);}
  }else{
   g.fillStyle='#8dad5b';g.fillRect(0,90,960,510);for(let y=110;y<600;y+=60){g.fillStyle=(y/60)%2?'#83a653':'#7c9c4e';g.fillRect(0,y,960,60);}
   g.fillStyle='#45594c';g.fillRect(0,90,960,75);for(let i=0;i<50;i++)person(g,i*21,137,['#d4bb75','#85a7b4','#d0886c'][i%3],0,.6);
   for(const y of[179,198,478,497]){g.strokeStyle='#e6e4d2';g.lineWidth=4;g.beginPath();g.moveTo(0,y);g.lineTo(960,y);g.stroke();}
   names.forEach((_,i)=>{const rank=order.indexOf(i),x=progress>=1?800-rank*80:150+progress*580-rank*progress*75,y=270+i*28;animalSprite(g,x,y,r?.sport??sport,active&&!reduced?t+i:0,1.35,undefined,/Horse|Trainer/.test(r?.sport??sport)?i:undefined);if(/Horse|Trainer/.test(r?.sport??sport)&&people.length)drawVenuePerson(g,people[i%people.length],x,y-45,0,1.35,'sit');roundBox(g,x-25,y+7,26,19,3,['#d6594c','#537fbc','#c3a54f','#51996a','#9c76b5','#ccc9b7'][i%6]);sceneText(g,String(i+1),x-12,y+21,12);});
   g.fillStyle='#e9e4cf';g.fillRect(872,173,6,327);
  }
  roundBox(g,20,18,610,53,9,'#173b35ed');sceneText(g,`${(r?.sport??sport).toUpperCase()} · ${r?active?'LIVE RACE':'OFFICIAL RESULT':'STARTING PADDOCK'}`,37,41,20,'#ead7a1','left');sceneText(g,'HORNCASTLE RACING CLUB',37,59,11,'#acc8bb','left');
  roundBox(g,21,528,918,55,9,'#173b35ed');names.forEach((n,i)=>{const x=39+i*150;sceneText(g,`${i+1}  ${n.slice(0,15)}`,x,551,11,i===order[0]&&p>=1?'#f4d57d':'#e8ddbe','left');if(p>=1)sceneText(g,`${order.indexOf(i)+1}${order.indexOf(i)===0?' · WINNER':''}`,x,570,11,'#c0cfbb','left');});
 },{height:600,label:'Racecourse with animated horses and jockeys. Switch between course and trackside cameras.'});
 const controls=document.createElement('div');controls.className='venue-controls';for(const [id,label]of[['course','Course camera'],['trackside','Trackside camera']] as const){const b=document.createElement('button');b.textContent=label;b.type='button';b.setAttribute('aria-pressed',String(camera===id));b.onclick=()=>{camera=id;for(const el of controls.children)el.setAttribute('aria-pressed',String(el===b));};controls.append(b);}figure.append(controls);return figure;
}

export const CASINO_STATIONS=[
 {id:'blackjack',label:'Blackjack',x:3,y:6.2}, {id:'roulette',label:'Roulette',x:7.2,y:5.5},
 {id:'pokies',label:'Kiwi Gold',x:2,y:1.1}, {id:'poker',label:'Video poker',x:8.2,y:1.1},
 {id:'cashier',label:'Cashier',x:10.1,y:4.4},
];
export function casinoVenue(select:(id:string)=>void,outside=false,patrons=12,people:readonly Character[]=[]) {
 const P:Project=(x,y,z=0)=>[480+(x-y)*39,130+(x+y)*19.5-z*39];
 let hover='';
 return canvasStage((g,t,reduced)=>{
  const person=peoplePainter(venueCast(people));
  if(reduced)t=0;backdrop(g,true);
  if(outside){
   ground(g,P,12,12,'#b9bd9a');box(g,P,0,7,12,3.5,.04,'#e2d3b6');box(g,P,0,10.5,12,1.5,.03,'#647a65');
   building(g,P,1,1,4.5,5,3.3,'#c8a78e','#986d66',true);building(g,P,7,1,3.7,5,4.4,'#b6c8cb','#54718a');
   box(g,P,1,5.8,4.5,.5,.18,'#d4aa5c',1.5);box(g,P,7,5.8,3.7,.5,.18,'#d4aa5c',1.5);
   for(const x of[1,2.1,3.2,4.3,7.2,8.3,9.4])box(g,P,x,5.9,.15,.3,1.9,'#e6c18a');
   for(let i=0;i<5;i++){const [x,y]=P(8.8,2+i*.7,4.4);g.strokeStyle='#79cae1';g.lineWidth=2;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-45);g.stroke();}
   for(const x of[3.3,8.8]){const [sx,sy]=P(x,6.25,2.1);sceneText(g,'TESSERA',sx,sy,20,'#ffe1a2');sceneText(g,'C A S I N O',sx,sy+18,11,'#d8e8df');}
   box(g,P,5,7.5,2,2,.25,'#a39378');box(g,P,5.2,7.7,1.6,1.6,.28,'#c9b890',.25);const [fx,fy]=P(6,8.5,.55);g.fillStyle='#67abb0';g.beginPath();g.ellipse(fx,fy,40,18,0,0,TAU);g.fill();g.strokeStyle='#d1b05c';g.lineWidth=6;g.beginPath();g.ellipse(fx,fy-45,16,35,.5,0,TAU);g.ellipse(fx,fy-45,16,35,-.5,0,TAU);g.stroke();
   for(let i=0;i<10;i++){tree(g,P,i+.8,11.5,.6);const [x,y]=P(1+i,7.3+(i%3)*.7);person(g,x,y,['#d6bd7d','#7195ad','#ab6b82'][i%3],t*2+i,1);}
   roundBox(g,24,18,345,53,9,'#112c35ed');sceneText(g,'THE TESSERA · AFTER HOURS',42,42,19,'#f2d99b','left');sceneText(g,'Click the entrance to step inside',42,61,12,'#b5cfca','left');
  }else{
   ground(g,P,12,10,'#702e34');
   for(let x=0;x<12;x++)for(let y=0;y<10;y++)polygon(g,[P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],(x+y)%2?'#943f4144':'#602c3633');
   // Two back walls, wainscoting, gilded pilasters and framed art, open towards the camera.
   box(g,P,0,-.18,12,.18,2.7,'#d2b99b');box(g,P,-.18,0,.18,10,2.7,'#c7ad91');box(g,P,0,0,12,.05,.8,'#683139');box(g,P,0,0,.05,10,.8,'#683139');
   for(let i=0;i<12;i+=2)box(g,P,i,0,.12,.13,2.7,'#ddbc7a');for(let i=0;i<10;i+=2)box(g,P,0,i,.13,.12,2.7,'#ddbc7a');
   polygon(g,[P(0,.8,1.1),P(0,3.7,1.1),P(0,3.7,2.4),P(0,.8,2.4)],'#b79353');polygon(g,[P(.01,.95,1.2),P(.01,3.55,1.2),P(.01,3.55,2.3),P(.01,.95,2.3)],'#42879a');
   for(let i=0;i<5;i++)polygon(g,[P(.02,1+i*.45,1.3),P(.02,1.25+i*.45,1.3),P(.02,1.8+i*.3,2.25)],['#dcaf72','#75b6b0','#d07968'][i%3]);
   // Slot cabinets have projecting bodies, bevelled screens, reel windows and stools.
   for(const start of[1.2,6.7])for(let i=0;i<4;i++){
    const x=start+i*.72;box(g,P,x,.35,.58,.58,1.45,'#c49d59');box(g,P,x+.06,.91,.46,.03,.69,'#242e39',.55);const [sx,sy]=P(x+.3,.98,1.03);roundBox(g,sx-9,sy-12,18,20,2,i%2?'#b8588d':'#3eafad');sceneText(g,i%2?'7':'◆',sx,sy+2,15,'#ffe6a2');box(g,P,x,.9,.58,.4,.1,'#b2a078',.45);box(g,P,x+.14,1.6,.32,.32,.4,'#703743');const [px,py]=P(x+.25,2.05);person(g,px,py,['#ae7790','#7299a1','#e1bd78'][i%3],0,.95);
   }
   // Central carpet border.
   const line=(x:number,y:number,w:number,d:number)=>{g.strokeStyle='#c49a61';g.lineWidth=2;g.beginPath();[P(x,y),P(x+w,y),P(x+w,y+d),P(x,y+d),P(x,y)].forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.stroke();};line(.6,3.3,10.8,6);
   for(const a of CASINO_STATIONS.slice(0,2)){
    const [dx,dy]=P(a.x,a.y-.65);person(g,dx,dy,'#e5dcc4',0,1);
    box(g,P,a.x-.75,a.y-.5,1.5,1,.55,'#3e302c');const [x,y]=P(a.x,a.y,.66);g.save();g.translate(x,y);g.transform(1,.5,-1,.5,0,0);g.fillStyle='#c19b58';g.beginPath();g.ellipse(0,0,52,29,0,0,TAU);g.fill();g.fillStyle='#2b7157';g.beginPath();g.ellipse(0,0,46,23,0,0,TAU);g.fill();
    if(a.id==='roulette'){g.fillStyle='#312824';g.beginPath();g.arc(-22,0,14,0,TAU);g.fill();g.strokeStyle='#d2b274';g.beginPath();g.arc(-22,0,10,0,TAU);g.stroke();for(let i=0;i<12;i++){g.fillStyle=i%2?'#bf655b':'#263c36';g.fillRect(0+i%4*8,-12+Math.floor(i/4)*8,6,6);}}
    else{g.strokeStyle='#e1d09b';g.beginPath();g.ellipse(0,0,32,12,0,0,Math.PI);g.stroke();for(let i=0;i<3;i++){g.fillStyle='#eae2c7';g.fillRect(-18+i*14,-4,7,10);}}
    g.restore();for(let i=0;i<4;i++){const [px,py]=P(a.x-.8+i*.55,a.y+.9);box(g,P,a.x-.9+i*.55,a.y+.8,.25,.3,.35,'#62313b');person(g,px,py,['#ad8b77','#7493ac','#d1b273','#aa778d'][i],0,1);}
   }
   box(g,P,9.8,3.5,.8,2,.9,'#ac895c');box(g,P,9.75,3.45,.9,2.1,.1,'#cbb68e',.9);const [cx,cy]=P(10.1,4.4,1.5);sceneText(g,'CASHIER',cx,cy,12,'#f4ddad');
   for(const [x,y]of[[.6,4.4],[.6,8.7],[11.3,2.4],[11.3,8.8]]){box(g,P,x,y,.38,.38,.35,'#a78360');tree(g,P,x+.19,y+.19,.6);}
   for(let i=0;i<Math.min(12,patrons);i++){const [x,y]=P(1.4+(i*.91)%9.3,8.8+Math.sin(i+t*.3)*.15);person(g,x,y,['#9a779f','#5d91a2','#d9bd78','#a26764'][i%4],t*3+i);}
   for(const a of CASINO_STATIONS){const [x,y]=P(a.x,a.y+.8);roundBox(g,x-58,y+14,116,25,6,hover===a.id?'#d4b779':'#152e35ec');sceneText(g,a.label,x,y+31,12,hover===a.id?'#19392e':'#efddb4');}
   roundBox(g,24,18,355,52,9,'#102c35ed');sceneText(g,'THE TESSERA · CASINO FLOOR',42,41,19,'#efd59e','left');sceneText(g,'Choose a table or cabinet to play',42,60,12,'#b8cbc5','left');
  }
 },{height:600,label:outside?'Isometric Tessera casino exterior with two illuminated buildings and a sculptural fountain':'Interactive isometric casino interior with slots, blackjack, roulette, video poker, dealers and cashier',pointer:p=>{
  if(outside){if(p.type==='up')select('floor');return;}
  let found='',best=85;for(const a of CASINO_STATIONS){const [x,y]=P(a.x,a.y,.5),d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;found=a.id;}}hover=found;if(p.type==='up'&&found)select(found);
 }});
}
