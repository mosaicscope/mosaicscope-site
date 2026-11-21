import {sampledElevation,type ElevationTile} from '../world/Elevation';
import type {Simulation} from '../sim/Simulation';
import {T} from '../world/World';
import {worldIndex} from '../world/WorldIndex';
import type {MappedCity} from '../world/MappedWorld';
import type {MappedBuilding} from '../ui/DestinationDistrict';
import {Camera} from './Camera';
import {DrivingCamera} from './DrivingCamera';
import {PerspectiveGroundGPU} from './PerspectiveGroundGPU';
import {PerspectivePrepared} from './PerspectivePrepared';
import {mappedRails,railSpan} from '../world/MappedRails';
import {drawCar,drawHeli,drawVehicleFragment} from './Cars';
import {drawStreetProp} from './StreetProps';
import {decorGrid,mappedStreetDecor,D} from './StreetDecor';
import {drawPanel,gatherFlora,flora,setPanelResolution} from './Flora';
import {GLOW} from './Buildings';
import type {Particles} from './Particles';
import type {Rain} from './Lighting';
import {drawToy} from './ToyArt';
import {GROUND} from './palette';
import {fillTextured} from './Textures';
import {ROAD_PAINT} from './RoadArt';
import {perspectiveRoadLines} from './PerspectiveRoadPaint';
import {TOYS} from '../content/toys';
import {drawPoi} from './Terrain';
import {mappedFacadeStyle} from '../content/mappedFacadeStyle';
import {paintFacadeDamage,openingOutline} from './FacadeDamageArt';
import {paintWindowStories,type Win} from './NightGlow';
import {pose,solve,drawFigure,J,gaitOf,applyGait,applyLegVariation} from './StickFigure';
import {Phys} from '../entities/types';
import {impactRagdollPose} from '../physics/ImpactRagdoll';
import {vehicleGeometry} from '../sim/VehicleGeometry';

/** Monotone-chain convex hull of screen points, for distant building silhouettes. */
function convexHull(points:[number,number][]):[number,number][]{if(points.length<3)return points;const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o:[number,number],a:[number,number],b:[number,number])=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower:[number,number][]=[],upper:[number,number][]=[];for(const q of p){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],q)<=0)lower.pop();lower.push(q);}for(let i=p.length-1;i>=0;i--){const q=p[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],q)<=0)upper.pop();upper.push(q);}lower.pop();upper.pop();return lower.concat(upper);}

/** Third-person projection of the same simulation. Geometry is clipped at the near plane. */
export class DrivingView {
 private cam=new Camera();private chase=new DrivingCamera();private gpuGround?:PerspectiveGroundGPU;private highPerformanceGpu=false;private prepared=new PerspectivePrepared();
 setGpuPreference(highPerformance:boolean):void{if(this.highPerformanceGpu===highPerformance)return;this.highPerformanceGpu=highPerformance;this.gpuGround?.dispose();this.gpuGround=undefined;}
 private facadeStyles=new WeakMap<import('../ui/DestinationDistrict').MappedBuilding,ReturnType<typeof mappedFacadeStyle>>();
 private facadeStyle(source:import('../ui/DestinationDistrict').MappedBuilding){let style=this.facadeStyles.get(source);if(!style){style=mappedFacadeStyle(source);this.facadeStyles.set(source,style);}return style;}
 private footprintCache=new WeakMap<MappedBuilding,{map:MappedCity;points:[number,number][];winding:number}>();
 private warmMap?:MappedCity;private warmRevision=-1;private warmQueue:MappedBuilding[]=[];private warming=false;
 private footprint(source:MappedBuilding,map:MappedCity){let cached=this.footprintCache.get(source);if(cached?.map===map)return cached;const points=source.points.map(p=>[p[0]/map.metresPerTile+map.offsetX,p[1]/map.metresPerTile+map.offsetY] as [number,number]);if(points.length>3&&points[0][0]===points[points.length-1][0]&&points[0][1]===points[points.length-1][1])points.pop();const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0);cached={map,points,winding:area>=0?1:-1};this.footprintCache.set(source,cached);return cached;}
 private warmFootprints(map:MappedCity){const revision=map.revision??0;if(this.warmMap!==map||this.warmRevision!==revision){this.warmMap=map;this.warmRevision=revision;this.warmQueue=[...map.byBuilding.values()].filter(source=>this.footprintCache.get(source)?.map!==map);}if(this.warming||!this.warmQueue.length)return;this.warming=true;const activeMap=map,work=()=>{this.warming=false;if(this.warmMap!==activeMap)return;const end=performance.now()+2;let count=0;while(this.warmQueue.length&&count++<16&&performance.now()<end){const source=this.warmQueue.pop()!;this.footprint(source,activeMap);this.facadeStyle(source);}if(this.warmQueue.length)this.warmFootprints(activeMap);};if(typeof requestIdleCallback==='function')requestIdleCallback(work,{timeout:1000});else setTimeout(work,50);}
 private eyeHeight?:number;private eyeFocus?:{x:number;y:number};private buildingFade=new Map<number,number>();
 private projection?:{ex:number;ey:number;fx:number;fy:number;rx:number;ry:number;eye:number;focal:number;horizon:number;width:number;heading:number;terrain:(x:number,y:number)=>number};
 private picks:{id:number;x:number;y:number;size:number;depth:number}[]=[];
 get heading():number{return this.projection?.heading??0;}
 project(x:number,y:number,z=0):{x:number;y:number}{const a=this.projection;if(!a)return{x:0,y:0};const dx=x-a.ex,dy=y-a.ey,depth=Math.max(.6,dx*a.fx+dy*a.fy);return{x:a.width/2+(dx*a.rx+dy*a.ry)*a.focal/depth,y:a.horizon-(z+a.terrain(x,y)-a.eye)*a.focal/depth};}
 unproject(x:number,y:number,z=0):{x:number;y:number}{const a=this.projection;if(!a)return{x:0,y:0};const delta=y-a.horizon;if(delta<=1)return{x:a.ex+a.fx*5,y:a.ey+a.fy*5};let depth=Math.min(100,Math.max(.6,(a.eye-z)*a.focal/delta)),wx=0,wy=0;for(let i=0;i<4;i++){const side=(x-a.width/2)*depth/a.focal;wx=a.ex+a.fx*depth+a.rx*side;wy=a.ey+a.fy*depth+a.ry*side;depth=Math.min(100,Math.max(.6,(a.eye-z-a.terrain(wx,wy))*a.focal/delta));}return{x:wx,y:wy};}
 pickCharacter(x:number,y:number):number{let best=-1,depth=Infinity;for(const p of this.picks)if(Math.abs(x-p.x)<p.size*.25&&y>=p.y-p.size&&y<=p.y+p.size*.1&&p.depth<depth){best=p.id;depth=p.depth;}return best;}
 /** Adaptive detail: the 3D view measures its own frame cost and trims far-ground work and the near ground radius a little at a time when it runs slow, then restores it when there is headroom, so frames stay even instead of spiking. */
 lod=1;private ema=12;private lodAt=0;
 draw(g:CanvasRenderingContext2D,sim:Simulation,w:number,h:number,dpr:number,time:number,alpha:number,dt:number,particles:Particles,rain:Rain,quality:number,reduceMotion:boolean):void{
  const t0=performance.now();
  // At speed the world is a blur and every new street is new work: trim detail in proportion to speed so the frame cost stays flat instead of spiking when it matters most.
  const car=sim.player.inCar>=0?sim.vehicles[sim.player.inCar]:undefined,fast=car?Math.min(1,Math.max(0,(Math.abs(car.speed)-10)/30)):0,keep=this.lod;
  this.lod=Math.min(keep,1-.5*fast);
  try{this.drawFrame(g,sim,w,h,dpr,time,alpha,dt,particles,rain,quality,reduceMotion);}finally{this.lod=keep;}
  const spent=performance.now()-t0;this.ema+=(Math.min(spent,60)-this.ema)*.08;
  if(spent>20)this.lod=Math.max(.4,this.lod-.1);   // fast attack: a slow frame trims the next one straight away, recovery stays gradual
  if(t0-this.lodAt>250){this.lodAt=t0;if(this.ema>9.5)this.lod=Math.max(.4,this.lod-.06);else if(this.ema<7)this.lod=Math.min(1,this.lod+.02);}
 }
 private drawFrame(g:CanvasRenderingContext2D,sim:Simulation,w:number,h:number,dpr:number,time:number,alpha:number,dt:number,particles:Particles,rain:Rain,quality:number,reduceMotion:boolean):void {
  const player=sim.player,car=sim.vehicles[player.inCar],focus=car??player;
  const chase=car?this.chase.update(car,alpha,dt,reduceMotion):this.chase.updateFoot(player,alpha,dt,reduceMotion),angle=chase.heading,fx=Math.cos(angle),fy=Math.sin(angle),rx=-fy,ry=fx;
  // Resolve each elevation district once per frame; thousands of vertices share the same grid.
  const elevationGrids=new Map<string,ElevationTile|null>(),mapForHeight=sim.world.mapped;
  const terrain=(x:number,y:number)=>{const map=mapForHeight,grids=map?.elevation;if(!map||!grids?.size)return 0;const east=(x-map.offsetX)*map.metresPerTile,north=-(y-map.offsetY)*map.metresPerTile,cx=Math.round(east/400),cy=Math.round(north/400),key=cx+','+cy;let tile=elevationGrids.get(key);if(tile===undefined){tile=grids.get(key)??null;if(!tile){let best=Infinity;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const candidate=grids.get((cx+dx)+','+(cy+dy));if(!candidate)continue;const d=Math.hypot((cx-candidate.cx)*400,(cy-candidate.cy)*400);if(d<best){best=d;tile=candidate;}}if(best>600)tile=null;}elevationGrids.set(key,tile);}return tile?sampledElevation(tile,east,north)/map.metresPerTile:0;};
  const ex=chase.x-fx*chase.distance,ey=chase.y-fy*chase.distance,targetEye=chase.height+sim.world.groundZ(chase.x,chase.y)+terrain(chase.x,chase.y),near=.6,focal=Math.min(w,h)*chase.focalFactor,horizon=h*.18;
  if(this.eyeHeight===undefined||!this.eyeFocus||Math.hypot(chase.x-this.eyeFocus.x,chase.y-this.eyeFocus.y)>35||reduceMotion)this.eyeHeight=targetEye;else this.eyeHeight+=(targetEye-this.eyeHeight)*(1-Math.exp(-Math.min(.1,Math.max(0,dt))*7));this.eyeFocus={x:chase.x,y:chase.y};const eye=this.eyeHeight;
  this.projection={ex,ey,fx,fy,rx,ry,eye,focal,horizon,width:w,heading:angle,terrain};this.picks.length=0;
  type P={x:number;y:number;z:number};
  const local=(x:number,y:number,z:number):P=>({x:(x-ex)*rx+(y-ey)*ry,y:z+terrain(x,y)-eye,z:(x-ex)*fx+(y-ey)*fy});
  const screen=(p:P)=>({x:w/2+p.x*focal/p.z,y:horizon-p.y*focal/p.z});
  const polygon=(points:P[],fill:string,stroke?:string)=>{let clipped:P[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ai=a.z>=near,bi=b.z>=near;if(ai)clipped.push(a);if(ai!==bi){const t=(near-a.z)/(b.z-a.z);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:near});}}if(clipped.length<3)return;const projected=clipped.map(screen);if(projected.every(p=>p.x<0)||projected.every(p=>p.x>w)||projected.every(p=>p.y<0)||projected.every(p=>p.y>h))return;g.beginPath();projected.forEach((q,i)=>{if(i)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y);});g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=.6;g.stroke();}};
  const quad=(points:[number,number,number][],fill:string,stroke?:string)=>polygon(points.map(p=>local(...p)),fill,stroke);
  g.setTransform(dpr,0,0,dpr,0,0);const daylight=sim.daylight;const sky=g.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,daylight>.3?'#607f93':'#10192a');sky.addColorStop(1,daylight>.3?'#c3c5b7':'#30394a');g.fillStyle=sky;g.fillRect(0,0,w,h);g.fillStyle=daylight>.3?'#51564b':'#20282d';g.fillRect(0,horizon,w,h-horizon);
  // Coarse distance terrain extends the horizon without drawing thousands of full-detail tiles.
  // LOD: distant flat ground and road ribbons join the near ground in one GPU batch (or one canvas fill per colour).
  this.gpuGround??=new PerspectiveGroundGPU(false,this.highPerformanceGpu);const gpu=this.gpuGround.begin(w*dpr,h*dpr),flatPaths=new Map<string,Path2D>();
  const flat=(pts:[number,number,number][],color:string)=>{const ps=pts.map(q=>local(q[0],q[1],q[2]));if(ps.some(q=>q.z<near))return quad(pts,color);const sc=ps.map(screen);if(sc.every(q=>q.x<0)||sc.every(q=>q.x>w)||sc.every(q=>q.y<0)||sc.every(q=>q.y>h))return;if(gpu){this.gpuGround!.polygon(sc,color,w,h,0);return;}let path=flatPaths.get(color);if(!path){path=new Path2D();flatPaths.set(color,path);}for(let i=0;i<sc.length;i++)if(i)path.lineTo(sc[i].x,sc[i].y);else path.moveTo(sc[i].x,sc[i].y);path.closePath();};
  const flushFlat=()=>{for(const [color,path] of flatPaths){g.fillStyle=color;g.fill(path);}flatPaths.clear();};
  const farRadius=Math.round(500*Math.max(.3,this.lod)),farStep=Math.round((quality===0?40:32)/Math.max(.35,this.lod)),far:{x:number;y:number;d:number;t:number}[]=[];
  const centreX=Math.floor(focus.x/farStep)*farStep,centreY=Math.floor(focus.y/farStep)*farStep;
  for(let y=centreY-farRadius;y<=centreY+farRadius;y+=farStep)for(let x=centreX-farRadius;x<=centreX+farRadius;x+=farStep){const mx=x+farStep*.5,my=y+farStep*.5,d=(mx-ex)*fx+(my-ey)*fy,side=Math.abs((mx-ex)*rx+(my-ey)*ry);if(d<33||d>farRadius||side>d*.9+farStep)continue;far.push({x,y,d,t:sim.world.tile(Math.floor(mx),Math.floor(my))});}
  far.sort((a,b)=>b.d-a.d);for(const q of far){const color=(GROUND[q.t===T.TREE?T.GRASS:q.t]??GROUND[T.PAVE])[0];flat([[q.x,q.y,0],[q.x+farStep,q.y,0],[q.x+farStep,q.y+farStep,0],[q.x,q.y+farStep,0]],color);}flushFlat();
  // Distant surveyed streets remain visible even where a coarse ground sample misses a narrow road.
  const distantMap=sim.world.mapped;if(distantMap)for(const id of worldIndex(sim.world).roads.query(focus.x-farRadius,focus.y-farRadius,focus.x+farRadius,focus.y+farRadius)){const r=distantMap.streetSegments[id];if(!r)continue;const nearest=(focus.x-r.x)*r.dx+(focus.y-r.y)*r.dy,start=Math.max(0,nearest-farRadius),end=Math.min(r.length,nearest+farRadius);const ox=r.dy*r.half,oy=r.dx*r.half;
   // LOD: ribbon pieces lengthen with distance (12 tiles near, up to 96 far), so far streets cost a handful of quads.
   for(let at=start;at<end;){const mx=r.x+r.dx*(at+6),my=r.y+r.dy*(at+6),depth=(mx-ex)*fx+(my-ey)*fy,step=depth<90?12:Math.min(96,Math.floor(depth/90)*24),to=Math.min(end,at+step),cx2=r.x+r.dx*(at+to)/2,cy2=r.y+r.dy*(at+to)/2,p=local(cx2,cy2,0);const from=at;at=to;if(p.z<38||p.z>farRadius||Math.abs(p.x)>p.z+10+step)continue;if(sim.world.tile(Math.floor(cx2),Math.floor(cy2))===T.WATER)continue;const x=r.x+r.dx*from,y=r.y+r.dy*from,u=r.x+r.dx*to,v=r.y+r.dy*to;flat([[x-ox,y+oy,.01],[u-ox,v+oy,.01],[u+ox,v-oy,.01],[x+ox,y-oy,.01]],GROUND[T.ROAD][0]);}}flushFlat();
  // Ground remains tied to the world's collision tiles, including bridge and water tiles.
  const ground:{x:number;y:number;d:number;t:number;z:number}[]=[];const cx=Math.floor(focus.x),cy=Math.floor(focus.y),radius=Math.max(26,Math.round(40*this.lod));
  for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){const d=(x+.5-ex)*fx+(y+.5-ey)*fy,side=Math.abs((x+.5-ex)*rx+(y+.5-ey)*ry);if(d<near||d>radius+2||side>d*.9+3)continue;const t=sim.world.tile(x,y);ground.push({x,y,d,t,z:sim.world.groundZ(x+.5,y+.5)+(t===T.SIDEWALK?.1:0)});}
  // Elevation can overlap neighbouring tiles in projection; paint distant tiles first.
  ground.sort((a,b)=>b.d-a.d);
    if(gpu){
   // LOD: beyond 16 tiles, 2x2 runs of identical ground merge into one GPU quad.
   type G=typeof ground[number];const cell=new Map<number,G>(),done=new Set<number>(),key=(x:number,y:number)=>y*65536+x;for(const q of ground)cell.set(key(q.x,q.y),q);
   const emit=(x0:number,y0:number,size:number,q:G)=>{const prepared=this.prepared.tile(x0,y0,q.t),baseX=Math.floor(x0/3)*3,baseY=Math.floor(y0/3)*3,ps=[[x0,y0],[x0+size,y0],[x0+size,y0+size],[x0,y0+size]].map(([x,y])=>({...local(x,y,q.z),u:(x-baseX)/3,v:(y-baseY)/3})),clip:(P&{u:number;v:number})[]=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],ai=a.z>=near,bi=b.z>=near;if(ai)clip.push(a);if(ai!==bi){const t=(near-a.z)/(b.z-a.z);clip.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:near,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}}if(clip.length>=3)this.gpuGround!.polygon(clip.map(p=>({...screen(p),depth:p.z,u:p.u,v:p.v})),prepared.color,w,h,q.t===T.ROAD||q.t===T.CROSSWALK?1:q.t===T.SIDEWALK?2:q.t===T.GRASS?3:0);};
   for(const q of ground){const k=key(q.x,q.y);if(done.has(k))continue;done.add(k);
    if(q.d>16){const bx=q.x&~1,by=q.y&~1,block=[key(bx,by),key(bx+1,by),key(bx,by+1),key(bx+1,by+1)];if(block.every(n=>{const o=cell.get(n);return !!o&&(n===k||!done.has(n))&&o.t===q.t&&o.z===q.z;})){for(const n of block)done.add(n);emit(bx,by,2,q);continue;}}
    emit(q.x,q.y,1,q);}
   this.gpuGround.finish(g,w,h);}

  // Accumulate road surfaces into a single asphalt texture pass, using the same texture as the isometric map.
  const roadGrain=new Map<string,{x:number;y:number;material:'asphalt'|'pavers'|'grass';path:Path2D}>();
  for(const q of ground){
   if(!gpu&&(q.t===T.ROAD||q.t===T.CROSSWALK||q.t===T.SIDEWALK||(q.t===T.GRASS&&q.d<18))){const ps=[[q.x,q.y,q.z+.012],[q.x+1,q.y,q.z+.012],[q.x+1,q.y+1,q.z+.012],[q.x,q.y+1,q.z+.012]].map(p=>local(p[0],p[1],p[2])),clip:P[]=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],ai=a.z>=near,bi=b.z>=near;if(ai)clip.push(a);if(ai!==bi){const t=(near-a.z)/(b.z-a.z);clip.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:near});}}if(clip.length>=3){const x=Math.floor(q.x/4)*4,y=Math.floor(q.y/4)*4,material=q.t===T.SIDEWALK?'pavers':q.t===T.GRASS?'grass':'asphalt',key=material+','+x+','+y;let patch=roadGrain.get(key);if(!patch){patch={x,y,material,path:new Path2D()};roadGrain.set(key,patch);}clip.forEach((p,i)=>{const q=screen(p);if(i)patch!.path.lineTo(q.x,q.y);else patch!.path.moveTo(q.x,q.y);});patch.path.closePath();}}
   const {hash,color}=this.prepared.tile(q.x,q.y,q.t);
   if(!gpu)quad([[q.x,q.y,q.z],[q.x+1,q.y,q.z],[q.x+1,q.y+1,q.z],[q.x,q.y+1,q.z]],color);
   // Show actual simulated height steps, rather than inventing terrain elevation data.
   if(q.z>0&&q.d<28){const sides:[[number,number],[number,number],number,number][]=[[[q.x,q.y],[q.x+1,q.y],q.x,q.y-1],[[q.x+1,q.y],[q.x+1,q.y+1],q.x+1,q.y],[[q.x+1,q.y+1],[q.x,q.y+1],q.x,q.y+1],[[q.x,q.y+1],[q.x,q.y],q.x-1,q.y]];for(const [a,b,nx,ny] of sides){const low=sim.world.groundZ(nx+.5,ny+.5)+(sim.world.tile(nx,ny)===T.SIDEWALK?.1:0);if(low<q.z)quad([[a[0],a[1],low],[b[0],b[1],low],[b[0],b[1],q.z],[a[0],a[1],q.z]],'#686860');}}
   // A small kerb lip delineates pavement from traffic lanes; it is visual, not a new road obstacle.
   if(q.t===T.SIDEWALK&&q.d<22){const sides:[[number,number],[number,number],number,number][]=[[[q.x,q.y],[q.x+1,q.y],q.x,q.y-1],[[q.x+1,q.y],[q.x+1,q.y+1],q.x+1,q.y],[[q.x+1,q.y+1],[q.x,q.y+1],q.x,q.y+1],[[q.x,q.y+1],[q.x,q.y],q.x-1,q.y]];for(const [a,b,nx,ny] of sides){const t=sim.world.tile(nx,ny);if(t===T.ROAD||t===T.CROSSWALK)quad([[a[0],a[1],q.z],[b[0],b[1],q.z],[b[0],b[1],q.z+.045],[a[0],a[1],q.z+.045]],'#a6a49a');}}
   if(q.t===T.SIDEWALK&&q.d<15){quad([[q.x,q.y+.49,q.z+.012],[q.x+1,q.y+.49,q.z+.012],[q.x+1,q.y+.505,q.z+.012],[q.x,q.y+.505,q.z+.012]],'#514f4c80');}
   if(q.d<24){const x=q.x+.15+(hash%37)/70,y=q.y+.15+(hash%29)/60;
    if(q.t===T.WATER){const wave=.06*Math.sin(time*2+q.x*.9+q.y);quad([[x,y,.025],[x+.24,y+.06,.025],[x+.29,y+.09,.025],[x+.04,y+.03,.025]],wave>0?'#7499a080':'#254c5780');}
    else if(q.t===T.GRASS)quad([[x,y,.015],[x+.035,y,.015],[x+.035,y+.14,.015],[x,y+.14,.015]],'#76907088');
    else if(q.t===T.ROAD||q.t===T.SIDEWALK||q.t===T.PAVE)quad([[x,y,.015],[x+.08,y,.015],[x+.08,y+.035,.015],[x,y+.035,.015]],'#a09e8a55');
   }
    // Real-street ground detail, seeded by tile so it never shimmers: manhole covers, kerbside drain grates, patched asphalt and hairline cracks on the road; slab joints, grease stains and chewing gum on the footpath.
    if(q.d<30){const hh=(Math.imul(q.x*73856093^q.y*19349663,2654435761)>>>0),cx=q.x+.5,cy=q.y+.5;
     if(q.t===T.ROAD){
      if(hh%9===0&&sim.world.tile(q.x,q.y+1)===T.SIDEWALK){quad([[q.x+.3,q.y+.8,q.z+.015],[q.x+.7,q.y+.8,q.z+.015],[q.x+.7,q.y+.98,q.z+.015],[q.x+.3,q.y+.98,q.z+.015]],'#141313','#5a5855');for(let i=1;i<4;i++)quad([[q.x+.3+i*.1,q.y+.8,q.z+.016],[q.x+.32+i*.1,q.y+.8,q.z+.016],[q.x+.32+i*.1,q.y+.98,q.z+.016],[q.x+.3+i*.1,q.y+.98,q.z+.016]],'#6a6865');}
      if(hh%53===0){const pts=(r:number)=>Array.from({length:12},(_,i)=>[cx+Math.cos(i/12*6.283)*r,cy+Math.sin(i/12*6.283)*r,q.z+.016] as [number,number,number]);quad(pts(.42),'#1d1c1b','#585653');quad(pts(.3),'#2b2a28','#444240');}
      else if(hh%41===0)quad([[q.x+.1,q.y+.15,q.z+.014],[q.x+.8,q.y+.12,q.z+.014],[q.x+.85,q.y+.6,q.z+.014],[q.x+.15,q.y+.65,q.z+.014]],'#2b2b2cb0');
      else if(hh%29===0){let x0=q.x+.1,y0=q.y+(hh%7)/10+.1;for(let i=0;i<4;i++){const x1=x0+.2,y1=y0+((hh>>(i+2))%5-2)/40;quad([[x0,y0,q.z+.014],[x1,y1,q.z+.014],[x1,y1+.025,q.z+.014],[x0,y0+.025,q.z+.014]],'#0d0d0d99');x0=x1;y0=y1;}}
     } else if(q.t===T.SIDEWALK&&q.d<24){
      quad([[q.x,q.y+.5,q.z+.013],[q.x+1,q.y+.5,q.z+.013],[q.x+1,q.y+.512,q.z+.013],[q.x,q.y+.512,q.z+.013]],'#3a3835a0');quad([[q.x+.5,q.y,q.z+.013],[q.x+.512,q.y,q.z+.013],[q.x+.512,q.y+1,q.z+.013],[q.x+.5,q.y+1,q.z+.013]],'#3a3835a0');
      if(hh%11===0)quad([[cx-.12,cy-.1,q.z+.014],[cx+.14,cy-.08,q.z+.014],[cx+.1,cy+.12,q.z+.014],[cx-.1,cy+.1,q.z+.014]],'#2c2a28a0');
      else if(hh%7===0)quad([[cx,cy,q.z+.015],[cx+.05,cy,q.z+.015],[cx+.05,cy+.05,q.z+.015],[cx,cy+.05,q.z+.015]],'#d8c9d9');
     }}
  }
  // Project small world-aligned patches; the asphalt pattern stays attached to the pavement.
  for(const patch of roadGrain.values()){const z=sim.world.groundZ(patch.x+2,patch.y+2)+.012,ps=[[patch.x,patch.y,z],[patch.x+4,patch.y,z],[patch.x,patch.y+4,z]].map(p=>local(p[0],p[1],p[2]));if(ps.some(p=>p.z<near+1))continue;const [a,b,c]=ps.map(screen);g.save();g.clip(patch.path);g.transform((b.x-a.x)/4,(b.y-a.y)/4,(c.x-a.x)/4,(c.y-a.y)/4,a.x,a.y);g.beginPath();g.rect(0,0,4,4);fillTextured(g,patch.material,patch.material==='asphalt'?1:.9,{x:-((patch.x%3)+3)%3,y:-((patch.y%3)+3)%3,zoom:1/32});g.restore();}
  // Lane lines follow the actual mapped road segments and disappear beneath bridges/ground only where appropriate.
  const map=sim.world.mapped;
  if(map)for(const id of worldIndex(sim.world).roads.query(cx-radius,cy-radius,cx+radius,cy+radius)){const r=map.streetSegments[id];if(!r)continue;const lineList=perspectiveRoadLines(r,map.metresPerTile);for(const line of lineList)for(let at=Math.max(0,Math.floor((((focus.x-r.x)*r.dx+(focus.y-r.y)*r.dy)-48)/3.2)*3.2);at<Math.min(r.length,((focus.x-r.x)*r.dx+(focus.y-r.y)*r.dy)+48);at+=3.2){if(line.dashed&&Math.floor(at/3.2)%2)continue;const offset=line.offset,end=Math.min(r.length,at+(line.dashed?2.4:3.2)),a=r.x+r.dx*at-r.dy*offset,b=r.y+r.dy*at+r.dx*offset,c=r.x+r.dx*end-r.dy*offset,d=r.y+r.dy*end+r.dx*offset;if(Math.hypot(a-focus.x,b-focus.y)>48&&Math.hypot(c-focus.x,d-focus.y)>48)continue;const tile=sim.world.tile(Math.floor((a+c)/2),Math.floor((b+d)/2));if(tile!==T.ROAD)continue;const mx=(a+c)/2,my=(b+d)/2;if(at<3||end>r.length-3)continue;
   let junction=false;for(const otherId of worldIndex(sim.world).roads.query(mx-2,my-2,mx+2,my+2)){const other=map.streetSegments[otherId];if(!other||other.id===r.id||Math.abs(r.dx*other.dx+r.dy*other.dy)>.88)continue;const u=Math.max(0,Math.min(other.length,(mx-other.x)*other.dx+(my-other.y)*other.dy));if(Math.hypot(mx-other.x-other.dx*u,my-other.y-other.dy*u)<other.half+1){junction=true;break;}}if(junction)continue;
   const width=.035,z=sim.world.groundZ(mx,my)+.025;quad([[a-r.dy*width,b+r.dx*width,z],[c-r.dy*width,d+r.dx*width,z],[c+r.dy*width,d-r.dx*width,z],[a+r.dy*width,b-r.dx*width,z]],line.color);}}
  // Crossings are painted only on existing crossing tiles, using the nearby road direction.
  if(map)for(const q of ground){if(q.t!==T.CROSSWALK||q.d>32)continue;const x=q.x+.5,y=q.y+.5;let closest=Infinity,road:typeof map.streetSegments[number]|undefined;for(const id of worldIndex(sim.world).roads.query(x-3,y-3,x+3,y+3)){const r=map.streetSegments[id];if(!r)continue;const u=Math.max(0,Math.min(r.length,(x-r.x)*r.dx+(y-r.y)*r.dy)),dist=Math.hypot(x-r.x-r.dx*u,y-r.y-r.dy*u);if(dist<closest){closest=dist;road=r;}}if(!road)continue;const dx=road.dx,dy=road.dy,nx=-dy,ny=dx,z=q.z+.035;quad([[x-dx*.43-nx*.19,y-dy*.43-ny*.19,z],[x+dx*.43-nx*.19,y+dy*.43-ny*.19,z],[x+dx*.43+nx*.19,y+dy*.43+ny*.19,z],[x-dx*.43+nx*.19,y-dy*.43+ny*.19,z]],ROAD_PAINT.zebra);}

  const items:{k?:string;depth:number;draw:()=>void}[]=[];let windowBudget=quality===0?0:quality===1?18:36,windowGeometryBudget=quality===0?100:quality===1?260:500;
  // Draw the same street greenery and tree tiles as the overhead view, depth-sorted with traffic.
  const decor=map?null:decorGrid(sim.world);
  for(const tile of ground){
   const kind=tile.t===T.TREE?D.OAK:map&&map.visibility.fixtures?mappedStreetDecor(sim.world,tile.x,tile.y):decor&&tile.x>=0&&tile.y>=0&&tile.x<sim.world.size&&tile.y<sim.world.size?decor[tile.y*sim.world.size+tile.x]:D.NONE;
   if(!kind)continue;const x=tile.x+.5,y=tile.y+.5,p=local(x,y,tile.z);if(p.z<2||p.z>38||Math.abs(p.x)>p.z+3)continue;
   const seed=Math.abs(Math.imul(tile.x,73856093)^Math.imul(tile.y,19349663));
   items.push({k:"decor",depth:p.z,draw:()=>{g.globalAlpha=Math.max(.03,Math.min(1,(37-p.z)/9));const at=screen(p),scale=Math.min(2.5,focal/p.z/26);drawPanel(g,kind,at.x,at.y,scale,time,1-daylight,(seed%1000)/1000);}});
  }
  // Wild greenery and wildlife: same panel engine, bounded by distance, thinned by the frame-time governor.
  setPanelResolution(dpr);
  gatherFlora(sim.world,cx-radius,cx+radius,cy-radius,cy+radius,1,quality,time,1-daylight,focus.x,focus.y,Math.min(34,radius)*Math.max(.6,this.lod),(_depth,ref,wx,wy,lift)=>{
   const p=local(wx,wy,sim.world.groundZ(wx,wy)+lift/26);if(p.z<2||p.z>38||Math.abs(p.x)>p.z+3)return;
   items.push({k:'decor',depth:p.z,draw:()=>{g.globalAlpha=Math.max(.03,Math.min(1,(37-p.z)/9));const at=screen(p),scale=Math.min(2.5,focal/p.z/26);drawPanel(g,Math.floor(ref/1000),at.x,at.y,scale,time,1-daylight,(ref%1000)/1000);}});
  });
  if(map)for(const rail of mappedRails(map,focus.x,focus.y,38)){
   const [start,end]=railSpan(rail,focus.x,focus.y,38);if(end<=start)continue;
   for(let at=Math.floor(start/4)*4;at<end;at+=4){const from=Math.max(at,start),to=Math.min(at+4,end),ax=rail.x+rail.dx*from,ay=rail.y+rail.dy*from,bx=rail.x+rail.dx*to,by=rail.y+rail.dy*to,p=local((ax+bx)/2,(ay+by)/2,0);
    if(p.z<near||p.z>40||Math.abs(p.x)>p.z+4)continue;
    items.push({depth:p.z,draw:()=>{const ground=sim.world.groundZ(ax,ay),band=(z:number,col:string,height:number)=>quad([[ax,ay,ground+z],[bx,by,ground+z],[bx,by,ground+z+height],[ax,ay,ground+z+height]],col);
     if(rail.kind==='jersey_barrier'){band(0,'#97978f',.48);band(.42,'#c1c1b3',.07);return;}
     band(.39,'#abb2a7',.1);band(.28,'#687a78',.1);for(let pos=from;pos<=to;pos+=2){const x=rail.x+rail.dx*pos,y=rail.y+rail.dy*pos;quad([[x-.025*rail.dx,y-.025*rail.dy,ground],[x+.025*rail.dx,y+.025*rail.dy,ground],[x+.025*rail.dx,y+.025*rail.dy,ground+.5],[x-.025*rail.dx,y-.025*rail.dy,ground+.5]],'#747f7b');}
    }});
   }
  }
  const screenHull=(pts:[number,number][],height:number):[number,number][]=>{const out:[number,number][]=[];for(const [x,y] of pts)for(const z of[0,height]){const q=screen(local(x,y,z));out.push([q.x,q.y]);}return convexHull(out);};
  // Sun shadows, the cheap stand-in for ray tracing: every wall edge throws a quad away from the sun (all in one path, so overlaps never
  // double-darken), a tighter darker core hugs the wall, and cars and people get soft ground shadows. Skipped at night and when the view is struggling.
  const hourNow=((sim.hour%24)+24)%24,sunA=Math.PI*(hourNow-6)/12,sunUp=Math.max(0,Math.sin(sunA));
  if(sunUp>.06&&!reduceMotion&&this.lod>.5){
   const sdx=-Math.cos(sunA),sdy=.42+.3*(1-sunUp),sl=Math.hypot(sdx,sdy),shx=sdx/sl,shy=sdy/sl,shadowR=Math.round(64*Math.max(.5,this.lod)),alpha=Math.min(.36,.1+sunUp*.3);
   const shadowQuads:{pts:[number,number][];height:number;wind:number}[]=[];
   for(const id of worldIndex(sim.world).buildings.query(cx-shadowR,cy-shadowR,cx+shadowR,cy+shadowR)){
    const b=sim.world.buildings[id];if(!b)continue;const bx=(b.x0+b.x1+1)/2,by=(b.y0+b.y1+1)/2,forward=(bx-ex)*fx+(by-ey)*fy;if(forward<-12||forward>shadowR)continue;
    const source=map?.byBuilding.get(id),cachedFp=source&&map?this.footprint(source,map):null,fp=cachedFp?.points??[[b.x0,b.y0],[b.x1+1,b.y0],[b.x1+1,b.y1+1],[b.x0,b.y1+1]] as [number,number][];if(fp.length<3)continue;
    const height=Math.max(1,Math.min(60,source&&map?source.height/map.metresPerTile:b.height));let area=0;for(let i=0;i<fp.length;i++){const a=fp[i],z=fp[(i+1)%fp.length];area+=a[0]*z[1]-z[0]*a[1];}
    shadowQuads.push({pts:fp,height,wind:area>=0?1:-1});if(shadowQuads.length>90)break;
   }
   items.push({k:"shadow",depth:1e6,draw:()=>{
    const reach=Math.min(.45,Math.max(.12,Math.tan(.15+(1-sunUp)*1.1)*.5));   // longer shadows when the sun is low
    for(const [scale,a] of [[1,alpha],[.42,alpha*.55]] as const){
     g.beginPath();
     for(const sq of shadowQuads){const len=Math.min(sq.height*reach*2.2,30)*scale,fp=sq.pts;
      for(let i=0;i<fp.length;i++){const p=fp[i],q=fp[(i+1)%fp.length],nx=(q[1]-p[1])*sq.wind,ny=-(q[0]-p[0])*sq.wind;if(nx*shx+ny*shy<=0)continue;
       const c4:[number,number][]=[[p[0],p[1]],[q[0],q[1]],[q[0]+shx*len,q[1]+shy*len],[p[0]+shx*len,p[1]+shy*len]],pr=c4.map(c=>local(c[0],c[1],0));if(pr.some(c=>c.z<=near))continue;
       const sc=pr.map(screen);let ar=0;for(let k=0;k<4;k++){const s1=sc[k],s2=sc[(k+1)%4];ar+=s1.x*s2.y-s2.x*s1.y;}if(ar<0)sc.reverse();
       g.moveTo(sc[0].x,sc[0].y);for(let k=1;k<4;k++)g.lineTo(sc[k].x,sc[k].y);g.closePath();}
     }
     g.fillStyle=`rgba(10,8,18,${a})`;g.fill();
    }
    // soft ground shadows under cars and people
    g.fillStyle=`rgba(10,8,18,${Math.min(.34,.12+sunUp*.22)})`;
    for(const v of sim.vehicles){const dx=v.x-ex,dy=v.y-ey,fwd=dx*fx+dy*fy;if(fwd<1||fwd>70||v.x<0)continue;const gg=vehicleGeometry(v),hl=gg.length*.56,hw=gg.width*.6,co=Math.cos(v.heading),si=Math.sin(v.heading);
     g.beginPath();let ok=true;for(let k=0;k<12;k++){const t=k/12*Math.PI*2,lx=Math.cos(t)*hl,ly=Math.sin(t)*hw,wx=v.x+lx*co-ly*si+shx*.35,wy=v.y+lx*si+ly*co+shy*.35,p=local(wx,wy,0);if(p.z<=near){ok=false;break;}const s=screen(p);if(k)g.lineTo(s.x,s.y);else g.moveTo(s.x,s.y);}if(ok){g.closePath();g.fill();}}
    g.fillStyle=`rgba(10,8,18,${Math.min(.3,.1+sunUp*.2)})`;let shown=0;
    for(const c of sim.chars){if(c.inCar>=0||c.inside>=0)continue;const dx=c.x-ex,dy=c.y-ey,fwd=dx*fx+dy*fy;if(fwd<1||fwd>34)continue;const p=local(c.x+shx*.18,c.y+shy*.18,c.z),s=screen(p),r=Math.max(2,focal/p.z*.42);g.beginPath();g.ellipse(s.x,s.y,r,r*.38,0,0,6.283);g.fill();if(++shown>70)break;}
   }});
  }
  const damageByBuilding=new Map<number|string,import('../sim/MappedFacadeDamage').MappedFacadeRecord[]>();for(const d of sim.mappedDamage.values()){const list=damageByBuilding.get(d.buildingId)??[];list.push(d);damageByBuilding.set(d.buildingId,list);}
  for(const id of worldIndex(sim.world).buildings.query(cx-farRadius,cy-farRadius,cx+farRadius,cy+farRadius)){
   const b=sim.world.buildings[id];if(!b)continue;const bx=(b.x0+b.x1+1)/2,by=(b.y0+b.y1+1)/2,extent=Math.hypot(b.x1-b.x0+1,b.y1-b.y0+1)/2,forward=(bx-ex)*fx+(by-ey)*fy,side=(bx-ex)*rx+(by-ey)*ry;if(forward+extent<near||forward-extent>farRadius||Math.abs(side)>Math.max(0,forward)*1.05+extent*2+8)continue;const source=map?.byBuilding.get(id),cached=source&&map?this.footprint(source,map):null,pts=cached?.points??[[b.x0,b.y0],[b.x1+1,b.y0],[b.x1+1,b.y1+1],[b.x0,b.y1+1]] as [number,number][];
   if(pts.length<3)continue;const depths=pts.map(point=>(point[0]-ex)*fx+(point[1]-ey)*fy),depth=Math.max(near,Math.min(...depths));if(Math.max(...depths)<near||depth>farRadius)continue;
   // Far buildings retain their surveyed footprint and facade rhythm with fewer canvas operations.
   if(depth>45){const height=Math.max(1,Math.min(120,source&&map?source.height/map.metresPerTile:b.height)),arch=source?this.facadeStyle(source):null,wall=arch?.wall??b.color,roof=arch?.roof??b.roof,pixels=Math.max(height,extent)*focal/depth;
    // LOD: under ~1.5 px the building cannot be seen; past 150 tiles (or under 14 px) one hull fill replaces faces, roof and windows.
    if(pixels<1.5)continue;
    if(depth>150||pixels<14){items.push({k:"bHull",depth,draw:()=>{const hull=screenHull(pts,height);if(hull.length<3)return;g.fillStyle=wall;g.beginPath();g.moveTo(hull[0][0],hull[0][1]);for(let i=1;i<hull.length;i++)g.lineTo(hull[i][0],hull[i][1]);g.closePath();g.fill();}});continue;}
    items.push({k:"bFar",depth,draw:()=>{const winding=cached?.winding??1;
     for(let i=0;i<pts.length;i++){const a=pts[i],z=pts[(i+1)%pts.length];if(((z[0]-a[0])*(ey-a[1])-(z[1]-a[1])*(ex-a[0]))*winding>=0)continue;
      const corners:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[[a[0],a[1],0],[z[0],z[1],0],[z[0],z[1],height],[a[0],a[1],height]],projected=corners.map(q=>local(...q));
      if(projected.some(q=>q.z<=near)){quad(corners,wall);continue;}
      const [pa,pb,pc,pd]=projected.map(screen),xs=[pa.x,pb.x,pc.x,pd.x],ys=[pa.y,pb.y,pc.y,pd.y],left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);if(right<0||left>w||bottom<0||top>h)continue;
      g.fillStyle=wall;g.beginPath();g.moveTo(pa.x,pa.y);g.lineTo(pb.x,pb.y);g.lineTo(pc.x,pc.y);g.lineTo(pd.x,pd.y);g.closePath();g.fill();
      // A single path carries all visible windows on this facade, with no offscreen texture allocation.
      if(right-left>=8&&bottom-top>=7){const rows=Math.min(12,Math.max(1,b.floors)),cols=Math.min(12,Math.max(1,Math.floor(Math.hypot(z[0]-a[0],z[1]-a[1])/(arch?.bayWidth?arch.bayWidth/2:1.4)))),layout=this.prepared.windows(rows,cols,arch?.window==='ribbon');
       const point=(u:number,v:number)=>({x:pa.x+(pb.x-pa.x)*u+(pd.x-pa.x)*v,y:pa.y+(pb.y-pa.y)*u+(pd.y-pa.y)*v});g.fillStyle='#4e6a76';g.beginPath();for(let i=0;i<layout.length;i+=4){const u=layout[i],v=layout[i+1],lo=layout[i+2],hi=layout[i+3],q0=point(u,lo),q1=point(v,lo),q2=point(v,hi),q3=point(u,hi);g.moveTo(q0.x,q0.y);g.lineTo(q1.x,q1.y);g.lineTo(q2.x,q2.y);g.lineTo(q3.x,q3.y);g.closePath();}g.fill();}

     }polygon(pts.map(p=>local(p[0],p[1],height)),roof);
    }});continue;
   }
   items.push({depth,draw:()=>{
    const height=Math.max(1,Math.min(120,source&&map?source.height/map.metresPerTile:b.height)),arch=source?this.facadeStyle(source):null,wall=arch?.wall??b.color,roof=arch?.roof??b.roof;
    const pitched=pts.length===4&&(arch?.shape==='gable'||arch?.shape==='gabled'),rise=pitched?Math.min(height*.22,1.2):0,wallTop=height-rise;
    const damage=source?damageByBuilding.get(source.id)??[]:[];
    const projectDamage=(d:typeof damage[number],u:number,z:number,out=0):[number,number]=>{const p=local(d.a[0]+(d.b[0]-d.a[0])*u-d.normal[0]*out*d.units,d.a[1]+(d.b[1]-d.a[1])*u-d.normal[1]*out*d.units,z*1.625*d.units),q=screen({...p,z:Math.max(near,p.z)});return[q.x,q.y];};
    const pointInside=(x:number,y:number)=>{let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],z=pts[j];if((a[1]>y)!==(z[1]>y)&&x<(z[0]-a[0])*(y-a[1])/(z[1]-a[1])+a[0])yes=!yes;}return yes;};
    const obscures=depth<8&&[0,.2,.4,.6,.8,1].some(t=>pointInside(ex+(focus.x-ex)*t,ey+(focus.y-ey)*t));
    const previous=this.buildingFade.get(b.id)??1,target=obscures?.16:1,fade=reduceMotion?target:previous+(target-previous)*(1-Math.exp(-Math.min(.1,Math.max(0,dt))*9));this.buildingFade.set(b.id,fade);if(this.buildingFade.size>1000)this.buildingFade.delete(this.buildingFade.keys().next().value!);g.save();g.globalAlpha=fade;if(damage.some(d=>d.opening)){g.beginPath();g.rect(-w*3,-h*3,w*7,h*7);for(const d of damage)if(d.opening){openingOutline(d).forEach(([u,z],i)=>{const p=projectDamage(d,u,z);if(i)g.lineTo(...p);else g.moveTo(...p);});g.closePath();}g.clip('evenodd');}
    const winding=cached?.winding??1;
    const inside=pointInside(ex,ey);
    const faces=pts.map((a,i)=>{const z=pts[(i+1)%pts.length];return {a,z,dist:((a[0]+z[0])/2-ex)*fx+((a[1]+z[1])/2-ey)*fy,visible:inside||((z[0]-a[0])*(ey-a[1])-(z[1]-a[1])*(ex-a[0]))*winding<0};}).filter(f=>f.visible).sort((a,z)=>z.dist-a.dist);
    for(const {a,z,dist} of faces){const length=Math.hypot(z[0]-a[0],z[1]-a[1]);if(length<.01)continue;const at=(u:number,h:number):[number,number,number]=>[a[0]+(z[0]-a[0])*u,a[1]+(z[1]-a[1])*u,h];quad([at(0,0),at(1,0),at(1,wallTop),at(0,wallTop)],wall,'#353b3b');
     const cols=Math.min(20,Math.max(1,Math.floor(length/(arch?.bayWidth?arch.bayWidth/2:1.4)))),floors=Math.min(18,Math.max(1,b.floors)),floor=wallTop/floors;
     // Keep a modest facade pattern even when detailed-window budget is exhausted.
     if((dist>=Math.max(26,46*this.lod)||windowGeometryBudget<=(dist>20?140:0))&&!/industrial|warehouse|shed|hangar/.test(source?.tags.building??'')){const ps=[at(0,0),at(1,0),at(1,wallTop),at(0,wallTop)].map(q=>local(...q));if(ps.every(q=>q.z>near+1)){const [pa,pb,,pd]=ps.map(screen),rows=Math.min(floors,4),groups=Math.min(cols,5),layout=this.prepared.windows(rows,groups,arch?.window==='ribbon');g.fillStyle='#4e6a76';g.beginPath();for(let i=0;i<layout.length;i+=4){const u=layout[i],v=layout[i+1],lo=layout[i+2],hi=layout[i+3],point=(x:number,y:number)=>({x:pa.x+(pb.x-pa.x)*x+(pd.x-pa.x)*y,y:pa.y+(pb.y-pa.y)*x+(pd.y-pa.y)*y}),a=point(u,lo),b=point(v,lo),c=point(v,hi),d=point(u,hi);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(c.x,c.y);g.lineTo(d.x,d.y);g.closePath();}g.fill();}}
     if(dist<30){for(let f=0;f<floors;f++){const level=f*floor;quad([at(0,level+.08),at(1,level+.08),at(1,level+.14),at(0,level+.14)],arch?.trim??'#929a92');
      for(let c=0;c<cols&&windowGeometryBudget>(dist>20?140:0);c++){windowGeometryBudget--;const inset=arch?.window==='ribbon'?.08:arch?.heritage?.3:.2,u=(c+inset)/cols,v=(c+1-inset)/cols,lo=level+floor*.25,hi=level+floor*.76,seed=Math.abs((b.id*31+f*13+c*7)%9),lit=daylight<.45&&seed<4&&sim.env.power;quad([at(u,lo),at(v,lo),at(v,hi),at(u,hi)],lit?'#dacb95':'#4e6a76',arch?.trim??'#a0aea8');const mid=(u+v)/2;quad([at(mid-.008,lo),at(mid+.008,lo),at(mid+.008,hi),at(mid-.008,hi)],'#a3aca4');
       if(dist<18&&windowBudget>0){const corners=[at(u,lo),at(v,lo),at(v,hi),at(u,hi)].map(q=>local(...q));if(corners.every(q=>q.z>near+1)){const pp=corners.map(screen);const win:Win={A:[pp[0].x,pp[0].y],B:[pp[1].x,pp[1].y],C:[pp[2].x,pp[2].y],D:[pp[3].x,pp[3].y],col:lit?'#dacb95':'#4e6a76',seed:b.id*131+f*31+c*17};if(Math.hypot(win.B[0]-win.A[0],win.B[1]-win.A[1])>=7){windowBudget--;paintWindowStories(g,[win],reduceMotion||!flora.animate?0:time);}}}
       if(dist<15&&seed%3===0){const reflection=lo+(hi-lo)*.75;quad([at(u+.02/cols,reflection),at(v-.02/cols,reflection),at(v-.02/cols,reflection+.025),at(u+.02/cols,reflection+.025)],'#c8dedb77');}}}
      if(/brick|stone|timber|wood/.test(arch?.material??''))for(let z0=.2;z0<height;z0+=.55)quad([at(0,z0),at(1,z0),at(1,z0+.025),at(0,z0+.025)],'#6f706b');
      if(b.kind==='house'){quad([at(.42,.05),at(.58,.05),at(.58,Math.min(1.4,height*.7)),at(.42,Math.min(1.4,height*.7))],'#34484a',arch?.trim);}
      // Commercial frontage takes its identity from the mapped building, not a generic billboard.
      if(source&&b.kind!=='house'&&length>3&&dist<20&&(source.tags.shop||source.tags.amenity||source.name)){
       const top=Math.min(wallTop-.1,1.5),low=Math.max(.05,top-.28);if(top>low){quad([at(.1,low),at(.9,low),at(.9,top),at(.1,top)],'#27413f',arch?.trim);
        const anchors=[at(.1,low),at(.9,low),at(.1,top)].map(q=>local(...q));if(anchors.every(q=>q.z>near+1)){const [pa,pb,pc]=anchors.map(screen),label=(source.name||source.tags.shop||source.tags.amenity||'').slice(0,28);g.save();g.transform(pb.x-pa.x,pb.y-pa.y,pc.x-pa.x,pc.y-pa.y,pa.x,pa.y);g.fillStyle='#e8d7a7';g.font='600 .42px sans-serif';g.textAlign='center';g.fillText(label,.5,.6,.9);g.restore();}
       }
      }
      if(arch?.heritage&&dist<20)for(let col=0;col<=cols;col++){const u=col/cols,w=.025/cols;quad([at(u-w,0),at(u+w,0),at(u+w,wallTop),at(u-w,wallTop)],arch.trim);}
     }
    }
    if(pitched){const [a,b,c,d]=pts,mid=(p:[number,number],q:[number,number]):[number,number]=>[(p[0]+q[0])/2,(p[1]+q[1])/2],r0=mid(a,d),r1=mid(b,c);quad([[a[0],a[1],wallTop],[b[0],b[1],wallTop],[r1[0],r1[1],height],[r0[0],r0[1],height]],roof,'#384647');quad([[d[0],d[1],wallTop],[c[0],c[1],wallTop],[r1[0],r1[1],height],[r0[0],r0[1],height]],roof,'#384647');polygon([[a[0],a[1],wallTop],[d[0],d[1],wallTop],[r0[0],r0[1],height]].map(p=>local(p[0],p[1],p[2])),wall,'#384647');polygon([[b[0],b[1],wallTop],[c[0],c[1],wallTop],[r1[0],r1[1],height]].map(p=>local(p[0],p[1],p[2])),wall,'#384647');}else polygon(pts.map(p=>local(p[0],p[1],height)),roof,'#384647');g.restore();
    if(!obscures)for(const d of damage){const mid=local((d.a[0]+d.b[0])/2,(d.a[1]+d.b[1])/2,0);if(mid.z<near)continue;paintFacadeDamage(g,d,(u,z,out)=>projectDamage(d,u,z,out),Math.max(.2,focal/mid.z/16),time);}
   }});
  }
  const farCar=(v:import("../entities/types").Vehicle)=>{const gm=vehicleGeometry(v),c=Math.cos(v.heading),si=Math.sin(v.heading),ground=sim.world.groundZ(v.x,v.y);
   const box=(l0:number,l1:number,hw:number,z0:number,z1:number,side:string,top:string)=>{const at=(a:number,b:number,z:number):[number,number,number]=>[v.x+a*c-b*si,v.y+a*si+b*c,ground+z],faces:[number,number,number,number][]=[[l1,-hw,l1,hw],[l0,hw,l0,-hw],[l0,-hw,l1,-hw],[l1,hw,l0,hw]];
    for(const [a0,b0,a1,b1] of faces){const mx=(a0+a1)/2,my=(b0+b1)/2,nx=a0===a1?Math.sign(a0):0,ny=a0===a1?0:Math.sign(b0),wx=v.x+mx*c-my*si,wy=v.y+mx*si+my*c;if((ex-wx)*(nx*c-ny*si)+(ey-wy)*(nx*si+ny*c)<=0)continue;quad([at(a0,b0,z0),at(a1,b1,z0),at(a1,b1,z1),at(a0,b0,z1)],side);}
    quad([at(l0,-hw,z1),at(l1,-hw,z1),at(l1,hw,z1),at(l0,hw,z1)],top);};
   const L=gm.length/2,hw=gm.width/2,H=gm.height;box(-L,L,hw,.08,H*.55,v.color,v.color);box(-L*.45,L*.3,hw*.86,H*.55,H,"#2c3a40",v.color);};
  this.cam.viewW=w;this.cam.viewH=h;this.cam.toScreen=(x,y,z,out)=>{const p=local(x,y,z),s=screen({...p,z:Math.max(near,p.z)});out.x=s.x;out.y=s.y;return out;};
  for(const v of sim.vehicles){const p=local(v.x,v.y,0);if(p.z<2.2||p.z>100||Math.abs(p.x)>p.z+3)continue;
   // LOD: past 30 tiles a car is two shaded boxes (body and cabin) instead of the full lofted model.
   if(p.z>Math.max(26,55*this.lod*this.lod)&&v.id!==car?.id){items.push({k:"carLod",depth:p.z,draw:()=>farCar(v)});continue;}items.push({k:"car",depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);this.cam.viewVector=[ex-v.x,ey-v.y,eye];drawCar(g,this.cam,v,alpha,time,1-daylight,false,sim.chars[v.driver]);}});}
  for(const hl of sim.pursuit.helis){if(!hl.on)continue;const p=local(hl.x,hl.y,hl.alt);if(p.z<3||p.z>90||Math.abs(p.x)>p.z+4)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);this.cam.viewVector=[ex-hl.x,ey-hl.y,eye-hl.alt];drawHeli(g,this.cam,hl,time,1-daylight);}});}
  for(const v of sim.vehicles)for(let i=0;i<(v.components?.debris.length??0);i++){const d=v.components!.debris[i],p=local(d.x,d.y,d.z);if(p.z<1||p.z>38||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);drawVehicleFragment(g,this.cam,v,i);}});}
  for(const prop of sim.cityPlay.props){const p=local(prop.x,prop.y,prop.z);if(p.z<1||p.z>46||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{g.globalAlpha=Math.max(.03,Math.min(1,(45-p.z)/10));this.cam.zoom=Math.max(.08,focal/p.z/25);drawStreetProp(g,this.cam,prop,time);}});}
  for(const id of worldIndex(sim.world).pois.query(cx-radius,cy-radius,cx+radius,cy+radius)){
   const prop=sim.world.pois[id];if(!prop||prop.kind==='door')continue;const p=local(prop.x,prop.y,0);if(p.z<1||p.z>46||Math.abs(p.x)>p.z+2)continue;
   items.push({depth:p.z,draw:()=>{g.globalAlpha=Math.max(.03,Math.min(1,(45-p.z)/10));
    if(prop.kind==='busstop'||prop.kind==='bench'||prop.kind==='foodtruck'){
     // Build fixtures in world space so their sides and roof turn with the road and camera.
     const dir=prop.angle??(prop.dir===1?Math.PI/2:0),co=Math.cos(dir),si=Math.sin(dir),point=(x:number,y:number,z:number):[number,number,number]=>[prop.x+x*co-y*si,prop.y+x*si+y*co,z];
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
  for(const c of sim.chars){if(c.inCar>=0||c.inside>=0)continue;const p=local(c.x,c.y,c.z);if(p.z<1||p.z>(c.tier==="background"?Math.max(36,70*this.lod):Math.max(48,80*this.lod))||Math.abs(p.x)>p.z+2)continue;items.push({k:"char",depth:p.z,draw:()=>{const at=screen(p),k=Math.max(.025,focal/p.z/110)*c.look.scale,dir=Math.cos(c.facing-angle)>=0?1:-1;this.picks.push({id:c.id,x:at.x,y:at.y,size:105*k,depth:p.z});if(c!==player&&(c.tier==='background'||p.z>30)&&p.z>(quality===0?14:quality===1?18:22)){const h=105*k;g.save();g.lineCap='round';g.strokeStyle=c.look.color;g.lineWidth=Math.max(1,h*.045);g.beginPath();g.moveTo(at.x,at.y-h*.24);g.lineTo(at.x,at.y-h*.7);g.moveTo(at.x,at.y-h*.24);g.lineTo(at.x-h*.1,at.y);g.moveTo(at.x,at.y-h*.24);g.lineTo(at.x+h*.1,at.y);g.moveTo(at.x,at.y-h*.6);g.lineTo(at.x-h*.12,at.y-h*.38);g.moveTo(at.x,at.y-h*.6);g.lineTo(at.x+h*.12,at.y-h*.38);g.stroke();g.fillStyle=c.look.color;g.beginPath();g.arc(at.x,at.y-h*.82,Math.max(1,h*.09),0,6.283);g.fill();if((c.fireUntil??0)>sim.tick){g.strokeStyle='#ff982e';g.lineWidth=Math.max(2,h*.07);g.beginPath();g.moveTo(at.x,at.y-h*.25);g.lineTo(at.x+Math.sin(time*8)*h*.08,at.y-h);g.stroke();}g.restore();return;}const a=pose(Math.hypot(c.vx,c.vy)>.12?"walk":c.anim.pose,c.style,time,time*5+c.seedPhase,Math.hypot(c.vx,c.vy),c.anim.poseT);applyGait(a,gaitOf(c.id));applyLegVariation(a,c.id,c.anim.pose,time*5+c.seedPhase);if(c.phys===Phys.DOWN){const limbs=impactRagdollPose(c);a.armL+=limbs[0];a.armR+=limbs[1];a.thighL+=limbs[2];a.thighR+=limbs[3];a.foreL+=limbs[4]*.5;a.foreR+=limbs[5]*.5;a.bendL+=limbs[6]*.5;a.bendR+=limbs[7]*.5;a.tilt+=limbs[8]*.35;}solve(a,at.x,at.y,k,dir);drawFigure(g,c,at.x,at.y,k,dir,time,c.anim.flash,1,false);if(c.hand>=0){const toy=sim.toys[c.hand],def=toy&&TOYS[toy.def];if(def)drawToy(g,toy.def,J[14],J[15],k,def.uses.includes("melee")?Math.atan2(J[15]-J[13],J[14]-J[12]):0,toy.color,1,dir);}if((c.fireUntil??0)>sim.tick){g.fillStyle="rgba(255,120,25,.8)";for(let j=0;j<4;j++){const x=J[j*4],y=J[j*4+1],size=Math.max(2,k*6);g.beginPath();g.moveTo(x-size,y);g.quadraticCurveTo(x-size,y-size*2,x+Math.sin(time*8+j)*size,y-size*4);g.quadraticCurveTo(x+size,y-size*2,x+size,y);g.fill();}}}});}
  items.sort((a,b)=>b.depth-a.depth);for(const item of items){g.globalAlpha=1;item.draw();}
  g.save();for(const glow of GLOW)glow(g);g.restore();GLOW.length=0;
  particles.update(dt);particles.draw(g,this.cam,(x,y)=>{const p=local(x,y,0);return p.z>near?Math.min(4,focal/p.z/26):0;});
  if(!map||map.visibility.weather)rain.draw(g,sim.env.rain,w,h,dt,quality===0?60:quality===1?160:260,reduceMotion);
 }
}



