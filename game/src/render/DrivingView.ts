import type {Simulation} from '../sim/Simulation';
import {T} from '../world/World';
import {worldIndex} from '../world/WorldIndex';
import {Camera} from './Camera';
import {DrivingCamera} from './DrivingCamera';
import {drawCar,drawVehicleFragment} from './Cars';
import {drawStreetProp} from './StreetProps';
import {GLOW} from './Buildings';
import type {Particles} from './Particles';
import type {Rain} from './Lighting';
import {drawToy} from './ToyArt';
import {textureCanvas,type Material} from './Textures';
import {TOYS} from '../content/toys';
import {drawPoi} from './Terrain';
import {mappedFacadeStyle} from '../content/mappedFacadeStyle';
import {paintFacadeDamage,openingOutline} from './FacadeDamageArt';
import {paintWindowStories,type Win} from './NightGlow';
import {pose,solve,drawFigure,J,gaitOf,applyGait,applyLegVariation} from './StickFigure';
import {Phys} from '../entities/types';
import {impactRagdollPose} from '../physics/ImpactRagdoll';

/** Third-person projection of the same simulation. Geometry is clipped at the near plane. */
export class DrivingView {
 private cam=new Camera();private chase=new DrivingCamera();
 draw(g:CanvasRenderingContext2D,sim:Simulation,w:number,h:number,dpr:number,time:number,alpha:number,dt:number,particles:Particles,rain:Rain,quality:number,reduceMotion:boolean):void {
  const car=sim.vehicles[sim.player.inCar];if(!car)return;
  const chase=this.chase.update(car,alpha,dt,reduceMotion),angle=chase.heading,fx=Math.cos(angle),fy=Math.sin(angle),rx=-fy,ry=fx;
  const ex=chase.x-fx*chase.distance,ey=chase.y-fy*chase.distance,eye=chase.height,near=.6,focal=Math.min(w,h)*chase.focalFactor,horizon=h*.18;
  type P={x:number;y:number;z:number};
  const local=(x:number,y:number,z:number):P=>({x:(x-ex)*rx+(y-ey)*ry,y:z-eye,z:(x-ex)*fx+(y-ey)*fy});
  const screen=(p:P)=>({x:w/2+p.x*focal/p.z,y:horizon-p.y*focal/p.z});
  const polygon=(points:P[],fill:string,stroke?:string)=>{let clipped:P[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ai=a.z>=near,bi=b.z>=near;if(ai)clipped.push(a);if(ai!==bi){const t=(near-a.z)/(b.z-a.z);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:near});}}if(clipped.length<3)return;g.beginPath();clipped.forEach((p,i)=>{const q=screen(p);if(i)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y);});g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=.6;g.stroke();}};
  const quad=(points:[number,number,number][],fill:string,stroke?:string)=>polygon(points.map(p=>local(...p)),fill,stroke);
  // Project the same cached materials used by the city onto nearby surfaces.
  const texture=(corners:[number,number,number][],material:Material,opacity:number)=>{const ps=corners.map(v=>local(...v));if(ps.some(p=>p.z<near+1))return;const [a,b,c,d]=ps.map(screen),image=textureCanvas(material);g.save();g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(c.x,c.y);g.lineTo(d.x,d.y);g.closePath();g.clip();g.globalAlpha=opacity;g.transform((b.x-a.x)/image.width,(b.y-a.y)/image.width,(d.x-a.x)/image.height,(d.y-a.y)/image.height,a.x,a.y);g.drawImage(image,0,0);g.restore();};
  g.setTransform(dpr,0,0,dpr,0,0);const daylight=sim.daylight;const sky=g.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,daylight>.3?'#607f93':'#10192a');sky.addColorStop(1,daylight>.3?'#c3c5b7':'#30394a');g.fillStyle=sky;g.fillRect(0,0,w,h);g.fillStyle=daylight>.3?'#51564b':'#20282d';g.fillRect(0,horizon,w,h-horizon);
  // Ground remains tied to the world's collision tiles, including bridge and water tiles.
  const ground:{x:number;y:number;d:number;t:number}[]=[];const cx=Math.floor(car.x),cy=Math.floor(car.y),radius=36;
  for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){const d=(x+.5-ex)*fx+(y+.5-ey)*fy,side=Math.abs((x+.5-ex)*rx+(y+.5-ey)*ry);if(d<near||d>38||side>d*.9+3)continue;ground.push({x,y,d,t:sim.world.tile(x,y)});}
  ground.sort((a,b)=>b.d-a.d);
  let textureBudget=quality===0?0:120;
  for(const q of ground){
   const hash=Math.abs(Math.imul(q.x,73856093)^Math.imul(q.y,19349663)),variation=hash%5,color=q.t===T.WATER?(variation<2?'#315b65':'#365f68'):q.t===T.GRASS?(variation<2?'#405c3d':'#496543'):q.t===T.ROAD?(variation<2?'#323537':'#383a3a'):q.t===T.CROSSWALK?'#777875':q.t===T.SAND?'#837a62':q.t===T.SIDEWALK||q.t===T.PATH?'#6a6860':'#58574f';
   quad([[q.x,q.y,0],[q.x+1,q.y,0],[q.x+1,q.y+1,0],[q.x,q.y+1,0]],color);
   if(q.d<15&&textureBudget>0&&(q.t===T.GRASS||q.t===T.ROAD||q.t===T.SIDEWALK||q.t===T.PAVE)){textureBudget--;texture([[q.x,q.y,.008],[q.x+1,q.y,.008],[q.x+1,q.y+1,.008],[q.x,q.y+1,.008]],q.t===T.GRASS?'grass':q.t===T.ROAD?'asphalt':'concrete',.32);}
   if(q.d<24){const x=q.x+.15+(hash%37)/70,y=q.y+.15+(hash%29)/60;
    if(q.t===T.WATER){const wave=.06*Math.sin(time*2+q.x*.9+q.y);quad([[x,y,.025],[x+.24,y+.06,.025],[x+.29,y+.09,.025],[x+.04,y+.03,.025]],wave>0?'#7499a080':'#254c5780');}
    else if(q.t===T.GRASS)quad([[x,y,.015],[x+.035,y,.015],[x+.035,y+.14,.015],[x,y+.14,.015]],'#76907088');
    else if(q.t===T.ROAD||q.t===T.SIDEWALK||q.t===T.PAVE)quad([[x,y,.015],[x+.08,y,.015],[x+.08,y+.035,.015],[x,y+.035,.015]],'#a09e8a55');
   }
  }
  // Lane lines follow the actual mapped road segments and disappear beneath bridges/ground only where appropriate.
  const map=sim.world.mapped;
  if(map)for(const id of worldIndex(sim.world).roads.query(cx-radius,cy-radius,cx+radius,cy+radius)){const r=map.streetSegments[id];if(!r)continue;const offsetList=[-r.half+.1,r.half-.1,...(r.oneway===0?[0]:[])];for(const offset of offsetList)for(let at=Math.max(0,Math.floor((((car.x-r.x)*r.dx+(car.y-r.y)*r.dy)-48)/3.2)*3.2);at<Math.min(r.length,((car.x-r.x)*r.dx+(car.y-r.y)*r.dy)+48);at+=3.2){if(offset===0&&Math.floor(at/3.2)%2)continue;const end=Math.min(r.length,at+2.4),a=r.x+r.dx*at-r.dy*offset,b=r.y+r.dy*at+r.dx*offset,c=r.x+r.dx*end-r.dy*offset,d=r.y+r.dy*end+r.dx*offset;if(Math.hypot(a-car.x,b-car.y)>48&&Math.hypot(c-car.x,d-car.y)>48)continue;const tile=sim.world.tile(Math.floor((a+c)/2),Math.floor((b+d)/2));if(tile!==T.ROAD&&tile!==T.CROSSWALK)continue;const width=.035;quad([[a-r.dy*width,b+r.dx*width,.012],[c-r.dy*width,d+r.dx*width,.012],[c+r.dy*width,d-r.dx*width,.012],[a+r.dy*width,b-r.dx*width,.012]],offset===0?'#c4a466':'#b0b2a4');}}
  const items:{depth:number;draw:()=>void}[]=[];let windowBudget=quality===0?0:quality===1?18:36;
  for(const id of worldIndex(sim.world).buildings.query(cx-radius,cy-radius,cx+radius,cy+radius)){
   const b=sim.world.buildings[id];if(!b)continue;const source=map?.byBuilding.get(id),pts=source&&map?source.points.map(p=>[p[0]/map.metresPerTile+map.offsetX,p[1]/map.metresPerTile+map.offsetY] as [number,number]):[[b.x0,b.y0],[b.x1+1,b.y0],[b.x1+1,b.y1+1],[b.x0,b.y1+1]] as [number,number][];
   if(pts.length>3&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1])pts.pop();if(pts.length<3)continue;const depths=pts.map(point=>(point[0]-ex)*fx+(point[1]-ey)*fy),depth=Math.max(near,Math.min(...depths));if(Math.max(...depths)<near||depth>55)continue;
   items.push({depth,draw:()=>{
    const height=Math.max(1,b.height),arch=source?mappedFacadeStyle(source):null,wall=arch?.wall??b.color,roof=arch?.roof??b.roof;
    const pitched=pts.length===4&&(arch?.shape==='gable'||arch?.shape==='gabled'),rise=pitched?Math.min(height*.22,1.2):0,wallTop=height-rise;
    const damage=source?[...sim.mappedDamage.values()].filter(d=>d.buildingId===source.id):[];
    const projectDamage=(d:typeof damage[number],u:number,z:number,out=0):[number,number]=>{const p=local(d.a[0]+(d.b[0]-d.a[0])*u-d.normal[0]*out*d.units,d.a[1]+(d.b[1]-d.a[1])*u-d.normal[1]*out*d.units,z*1.625*d.units),q=screen({...p,z:Math.max(near,p.z)});return[q.x,q.y];};
    g.save();if(damage.some(d=>d.opening)){g.beginPath();g.rect(-w*3,-h*3,w*7,h*7);for(const d of damage)if(d.opening){openingOutline(d).forEach(([u,z],i)=>{const p=projectDamage(d,u,z);if(i)g.lineTo(...p);else g.moveTo(...p);});g.closePath();}g.clip('evenodd');}
    const area=pts.reduce((sum,a,i)=>{const z=pts[(i+1)%pts.length];return sum+a[0]*z[1]-z[0]*a[1];},0),winding=area>=0?1:-1;
    let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],z=pts[j];if((a[1]>ey)!==(z[1]>ey)&&ex<(z[0]-a[0])*(ey-a[1])/(z[1]-a[1])+a[0])inside=!inside;}
    const faces=pts.map((a,i)=>{const z=pts[(i+1)%pts.length];return {a,z,dist:((a[0]+z[0])/2-ex)*fx+((a[1]+z[1])/2-ey)*fy,visible:inside||((z[0]-a[0])*(ey-a[1])-(z[1]-a[1])*(ex-a[0]))*winding<0};}).filter(f=>f.visible).sort((a,z)=>z.dist-a.dist);
    for(const {a,z,dist} of faces){const length=Math.hypot(z[0]-a[0],z[1]-a[1]);if(length<.01)continue;const at=(u:number,h:number):[number,number,number]=>[a[0]+(z[0]-a[0])*u,a[1]+(z[1]-a[1])*u,h];quad([at(0,0),at(1,0),at(1,wallTop),at(0,wallTop)],wall,'#353b3b');if(dist<22&&quality>0)texture([at(0,0),at(1,0),at(1,height),at(0,height)],arch?.material==='brick'||arch?.material==='stone'?'brick':'concrete',.18);
     const cols=Math.min(20,Math.max(1,Math.floor(length/(arch?.bayWidth?arch.bayWidth/2:1.4)))),floors=Math.min(18,Math.max(1,b.floors)),floor=wallTop/floors;
     if(dist<30){for(let f=0;f<floors;f++){const level=f*floor;quad([at(0,level+.08),at(1,level+.08),at(1,level+.14),at(0,level+.14)],arch?.trim??'#929a92');
      for(let c=0;c<cols;c++){const inset=arch?.window==='ribbon'?.08:arch?.heritage?.3:.2,u=(c+inset)/cols,v=(c+1-inset)/cols,lo=level+floor*.25,hi=level+floor*.76,seed=Math.abs((b.id*31+f*13+c*7)%9),lit=daylight<.45&&seed<4&&sim.env.power;quad([at(u,lo),at(v,lo),at(v,hi),at(u,hi)],lit?'#dacb95':'#4e6a76',arch?.trim??'#a0aea8');const mid=(u+v)/2;quad([at(mid-.008,lo),at(mid+.008,lo),at(mid+.008,hi),at(mid-.008,hi)],'#a3aca4');
       if(dist<18&&windowBudget>0){const corners=[at(u,lo),at(v,lo),at(v,hi),at(u,hi)].map(q=>local(...q));if(corners.every(q=>q.z>near+1)){const pp=corners.map(screen);const win:Win={A:[pp[0].x,pp[0].y],B:[pp[1].x,pp[1].y],C:[pp[2].x,pp[2].y],D:[pp[3].x,pp[3].y],col:lit?'#dacb95':'#4e6a76',seed:b.id*131+f*31+c*17};if(Math.hypot(win.B[0]-win.A[0],win.B[1]-win.A[1])>=7){windowBudget--;paintWindowStories(g,[win],reduceMotion?0:time);}}}
       if(dist<15&&seed%3===0){const reflection=lo+(hi-lo)*.75;quad([at(u+.02/cols,reflection),at(v-.02/cols,reflection),at(v-.02/cols,reflection+.025),at(u+.02/cols,reflection+.025)],'#c8dedb77');}}}
      if(/brick|stone|timber|wood/.test(arch?.material??''))for(let z0=.2;z0<height;z0+=.55)quad([at(0,z0),at(1,z0),at(1,z0+.025),at(0,z0+.025)],'#6f706b');
      if(b.kind==='house'){quad([at(.42,.05),at(.58,.05),at(.58,Math.min(1.4,height*.7)),at(.42,Math.min(1.4,height*.7))],'#34484a',arch?.trim);}
     }
    }
    if(pitched){const [a,b,c,d]=pts,mid=(p:[number,number],q:[number,number]):[number,number]=>[(p[0]+q[0])/2,(p[1]+q[1])/2],r0=mid(a,d),r1=mid(b,c);quad([[a[0],a[1],wallTop],[b[0],b[1],wallTop],[r1[0],r1[1],height],[r0[0],r0[1],height]],roof,'#384647');quad([[d[0],d[1],wallTop],[c[0],c[1],wallTop],[r1[0],r1[1],height],[r0[0],r0[1],height]],roof,'#384647');polygon([[a[0],a[1],wallTop],[d[0],d[1],wallTop],[r0[0],r0[1],height]].map(p=>local(p[0],p[1],p[2])),wall,'#384647');polygon([[b[0],b[1],wallTop],[c[0],c[1],wallTop],[r1[0],r1[1],height]].map(p=>local(p[0],p[1],p[2])),wall,'#384647');}else polygon(pts.map(p=>local(p[0],p[1],height)),roof,'#384647');g.restore();
    for(const d of damage){const mid=local((d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2,0);if(mid.z<near)continue;paintFacadeDamage(g,d,(u,z,out)=>projectDamage(d,u,z,out),Math.max(.2,focal/mid.z/16),time);}
   }});
  }
  this.cam.viewW=w;this.cam.viewH=h;this.cam.toScreen=(x,y,z,out)=>{const p=local(x,y,z),s=screen({...p,z:Math.max(near,p.z)});out.x=s.x;out.y=s.y;return out;};
  for(const v of sim.vehicles){const p=local(v.x,v.y,0);if(p.z<(v.id===car.id?2:4)||p.z>38||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);this.cam.viewVector=[ex-v.x,ey-v.y,eye];drawCar(g,this.cam,v,alpha,time,1-daylight,false,sim.chars[v.driver]);}});}
  for(const v of sim.vehicles)for(let i=0;i<(v.components?.debris.length??0);i++){const d=v.components!.debris[i],p=local(d.x,d.y,d.z);if(p.z<1||p.z>38||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);drawVehicleFragment(g,this.cam,v,i);}});}
  for(const prop of sim.cityPlay.props){const p=local(prop.x,prop.y,prop.z);if(p.z<1||p.z>32||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);drawStreetProp(g,this.cam,prop,time);}});}
  for(const id of worldIndex(sim.world).pois.query(cx-radius,cy-radius,cx+radius,cy+radius)){
   const prop=sim.world.pois[id];if(!prop||prop.kind==='door')continue;const p=local(prop.x,prop.y,0);if(p.z<1||p.z>32||Math.abs(p.x)>p.z+2)continue;
   items.push({depth:p.z,draw:()=>{
    if(prop.kind==='busstop'||prop.kind==='bench'||prop.kind==='foodtruck'){
     // Build fixtures in world space so their sides and roof turn with the road and camera.
     const dir=prop.dir===1?Math.PI/2:0,co=Math.cos(dir),si=Math.sin(dir),point=(x:number,y:number,z:number):[number,number,number]=>[prop.x+x*co-y*si,prop.y+x*si+y*co,z];
     const face=(ps:[number,number,number][],color:string,edge='#66746e')=>quad(ps.map(q=>point(...q)),color,edge);
     const box=(x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,col:string,top:string)=>{face([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],col);face([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],col);face([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],col);face([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],top);};
     if(prop.kind==='busstop'){
      box(-.95,-.33,0,-.88,-.26,1.45,'#667771','#9aaba3');box(.88,-.33,0,.95,-.26,1.45,'#667771','#9aaba3');box(-.95,.26,0,-.88,.33,1.45,'#667771','#9aaba3');box(.88,.26,0,.95,.33,1.45,'#667771','#9aaba3');
      face([[-.88,.3,.1],[.88,.3,.1],[.88,.3,1.35],[-.88,.3,1.35]],'#8bb5ba80');face([[-.88,-.29,.1],[-.88,.29,.1],[-.88,.29,1.35],[-.88,-.29,1.35]],'#7aa0aa99');
      box(-1,-.38,1.4,1,.38,1.49,'#475956','#697e79');box(-.72,-.02,.38,.72,.2,.44,'#806b52','#b59d76');box(-.62,.02,0,-.56,.15,.38,'#64716b','#87968d');box(.56,.02,0,.62,.15,.38,'#64716b','#87968d');
      face([[.7,-.32,1.02],[.98,-.32,1.02],[.98,-.32,1.34],[.7,-.32,1.34]],'#d9b75e');
      // Route board, poster frame, glass dividers and timber seating stay fixed to the shelter.
      face([[.72,-.335,1.14],[.95,-.335,1.14],[.95,-.335,1.24],[.72,-.335,1.24]],'#f4e5b4');
      face([[.69,.295,.2],[.85,.295,.2],[.85,.295,1.18],[.69,.295,1.18]],'#445a5a');
      face([[.7,.292,.7],[.84,.292,.7],[.84,.292,1.14],[.7,.292,1.14]],'#e2d8b6');
      for(let j=0;j<6;j++){const z=.76+j*.055;face([[.715,.289,z],[.83,.289,z],[.83,.289,z+.012],[.715,.289,z+.012]],j===0?'#c65b43':'#718681');}
      for(const x of[-.3,.3])box(x-.018,.27,.1,x+.018,.32,1.35,'#6d827b','#aab9ae');
      for(let i=0;i<4;i++){const y=-.015+i*.06;face([[-.70,y,.445],[.70,y,.445],[.70,y+.012,.445],[-.70,y+.012,.445]],'#69503b');}
     }else if(prop.kind==='bench'){
      box(-.75,-.18,.38,.75,.18,.44,'#735943','#ab895d');box(-.75,.14,.44,.75,.2,.85,'#7e6348','#a88961');for(const x of[-.62,.56])box(x,-.12,0,x+.06,.13,.38,'#5d6961','#7a8a7f');
     }else{
      box(-1.0,-.48,.18,1,.48,1.05,'#dfd5bf','#a43f32');face([[-.65,-.49,.55],[.35,-.49,.55],[.35,-.49,.9],[-.65,-.49,.9]],'#354e55');box(-1.02,-.52,1.04,1.02,.52,1.13,'#aa3b31','#c95b46');
     }return;
    }
    const at=screen(p);drawPoi(g,prop,at.x,at.y,focal/p.z/26,time,false,daylight<.3);
   }});
  }
  for(const c of sim.chars){if(c.inCar>=0||c.inside>=0)continue;const p=local(c.x,c.y,c.z);if(p.z<1||p.z>32||Math.abs(p.x)>p.z+2)continue;items.push({depth:p.z,draw:()=>{const at=screen(p),k=Math.max(.025,focal/p.z/110),dir=Math.cos(c.facing-angle)>=0?1:-1;const a=pose(Math.hypot(c.vx,c.vy)>.12?"walk":c.anim.pose,c.style,time,time*5+c.seedPhase,Math.hypot(c.vx,c.vy),c.anim.poseT);applyGait(a,gaitOf(c.id));applyLegVariation(a,c.id,c.anim.pose,time*5+c.seedPhase);if(c.phys===Phys.DOWN){const limbs=impactRagdollPose(c);a.armL+=limbs[0];a.armR+=limbs[1];a.thighL+=limbs[2];a.thighR+=limbs[3];a.foreL+=limbs[4]*.5;a.foreR+=limbs[5]*.5;a.bendL+=limbs[6]*.5;a.bendR+=limbs[7]*.5;a.tilt+=limbs[8]*.35;}solve(a,at.x,at.y,k,dir);drawFigure(g,c,at.x,at.y,k,dir,time,c.anim.flash,1,false);if(c.hand>=0){const toy=sim.toys[c.hand],def=toy&&TOYS[toy.def];if(def)drawToy(g,toy.def,J[14],J[15],k,def.uses.includes("melee")?Math.atan2(J[15]-J[13],J[14]-J[12]):0,toy.color,1,dir);}if((c.fireUntil??0)>sim.tick){g.fillStyle="rgba(255,120,25,.8)";for(let j=0;j<4;j++){const x=J[j*4],y=J[j*4+1],size=Math.max(2,k*6);g.beginPath();g.moveTo(x-size,y);g.quadraticCurveTo(x-size,y-size*2,x+Math.sin(time*8+j)*size,y-size*4);g.quadraticCurveTo(x+size,y-size*2,x+size,y);g.fill();}}}});}
  items.sort((a,b)=>b.depth-a.depth);for(const item of items)item.draw();
  g.save();for(const glow of GLOW)glow(g);g.restore();GLOW.length=0;
  particles.update(dt);particles.draw(g,this.cam,(x,y)=>{const p=local(x,y,0);return p.z>near?Math.min(4,focal/p.z/26):0;});
  if(!map||map.visibility.weather)rain.draw(g,sim.env.rain,w,h,dt,quality===0?60:quality===1?160:260,reduceMotion);
 }
}

