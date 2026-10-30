import {sampledElevation,type ElevationTile} from '../world/Elevation';
import type {Simulation} from '../sim/Simulation';
import {T} from '../world/World';
import {worldIndex} from '../world/WorldIndex';
import {Camera} from './Camera';
import {DrivingCamera} from './DrivingCamera';
import {mappedRails,railSpan} from '../world/MappedRails';
import {drawCar,drawVehicleFragment} from './Cars';
import {drawStreetProp} from './StreetProps';
import {decorGrid,drawDecor,mappedStreetDecor,D} from './StreetDecor';
import {GLOW} from './Buildings';
import type {Particles} from './Particles';
import type {Rain} from './Lighting';
import {drawToy} from './ToyArt';
import {textureCanvas,type Material} from './Textures';
import {GROUND} from './palette';
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
 private distantFacades=new Map<string,HTMLCanvasElement>();
 private projection?:{ex:number;ey:number;fx:number;fy:number;rx:number;ry:number;eye:number;focal:number;horizon:number;width:number;heading:number;terrain:(x:number,y:number)=>number};
 private picks:{id:number;x:number;y:number;size:number;depth:number}[]=[];
 get heading():number{return this.projection?.heading??0;}
 project(x:number,y:number,z=0):{x:number;y:number}{const a=this.projection;if(!a)return{x:0,y:0};const dx=x-a.ex,dy=y-a.ey,depth=Math.max(.6,dx*a.fx+dy*a.fy);return{x:a.width/2+(dx*a.rx+dy*a.ry)*a.focal/depth,y:a.horizon-(z+a.terrain(x,y)-a.eye)*a.focal/depth};}
 unproject(x:number,y:number,z=0):{x:number;y:number}{const a=this.projection;if(!a)return{x:0,y:0};const delta=y-a.horizon;if(delta<=1)return{x:a.ex+a.fx*5,y:a.ey+a.fy*5};let depth=Math.min(100,Math.max(.6,(a.eye-z)*a.focal/delta)),wx=0,wy=0;for(let i=0;i<4;i++){const side=(x-a.width/2)*depth/a.focal;wx=a.ex+a.fx*depth+a.rx*side;wy=a.ey+a.fy*depth+a.ry*side;depth=Math.min(100,Math.max(.6,(a.eye-z-a.terrain(wx,wy))*a.focal/delta));}return{x:wx,y:wy};}
 pickCharacter(x:number,y:number):number{let best=-1,depth=Infinity;for(const p of this.picks)if(Math.abs(x-p.x)<p.size*.25&&y>=p.y-p.size&&y<=p.y+p.size*.1&&p.depth<depth){best=p.id;depth=p.depth;}return best;}
 draw(g:CanvasRenderingContext2D,sim:Simulation,w:number,h:number,dpr:number,time:number,alpha:number,dt:number,particles:Particles,rain:Rain,quality:number,reduceMotion:boolean):void {
  const player=sim.player,car=sim.vehicles[player.inCar],focus=car??player;
  const chase=car?this.chase.update(car,alpha,dt,reduceMotion):this.chase.updateFoot(player,alpha,dt,reduceMotion),angle=chase.heading,fx=Math.cos(angle),fy=Math.sin(angle),rx=-fy,ry=fx;
  // Resolve each elevation district once per frame; thousands of vertices share the same grid.
  const elevationGrids=new Map<string,ElevationTile|null>(),mapForHeight=sim.world.mapped;
  const terrain=(x:number,y:number)=>{const map=mapForHeight,grids=map?.elevation;if(!map||!grids?.size)return 0;const east=(x-map.offsetX)*map.metresPerTile,north=-(y-map.offsetY)*map.metresPerTile,cx=Math.round(east/400),cy=Math.round(north/400),key=cx+','+cy;let tile=elevationGrids.get(key);if(tile===undefined){tile=grids.get(key)??null;if(!tile){let best=Infinity;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const candidate=grids.get((cx+dx)+','+(cy+dy));if(!candidate)continue;const d=Math.hypot((cx-candidate.cx)*400,(cy-candidate.cy)*400);if(d<best){best=d;tile=candidate;}}if(best>600)tile=null;}elevationGrids.set(key,tile);}return tile?sampledElevation(tile,east,north)/map.metresPerTile:0;};
  const ex=chase.x-fx*chase.distance,ey=chase.y-fy*chase.distance,eye=chase.height+sim.world.groundZ(chase.x,chase.y)+terrain(chase.x,chase.y),near=.6,focal=Math.min(w,h)*chase.focalFactor,horizon=h*.18;
  this.projection={ex,ey,fx,fy,rx,ry,eye,focal,horizon,width:w,heading:angle,terrain};this.picks.length=0;
  type P={x:number;y:number;z:number};
  const local=(x:number,y:number,z:number):P=>({x:(x-ex)*rx+(y-ey)*ry,y:z+terrain(x,y)-eye,z:(x-ex)*fx+(y-ey)*fy});
  const screen=(p:P)=>({x:w/2+p.x*focal/p.z,y:horizon-p.y*focal/p.z});
  const polygon=(points:P[],fill:string,stroke?:string)=>{let clipped:P[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ai=a.z>=near,bi=b.z>=near;if(ai)clipped.push(a);if(ai!==bi){const t=(near-a.z)/(b.z-a.z);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:near});}}if(clipped.length<3)return;g.beginPath();clipped.forEach((p,i)=>{const q=screen(p);if(i)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y);});g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=.6;g.stroke();}};
  const quad=(points:[number,number,number][],fill:string,stroke?:string)=>polygon(points.map(p=>local(...p)),fill,stroke);
  // Project the same cached materials used by the city onto nearby surfaces.
  const texture=(corners:[number,number,number][],material:Material,opacity:number)=>{const ps=corners.map(v=>local(...v));if(ps.some(p=>p.z<near+1))return;const [a,b,c,d]=ps.map(screen),image=textureCanvas(material);g.save();g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(c.x,c.y);g.lineTo(d.x,d.y);g.closePath();g.clip();g.globalAlpha*=opacity;g.transform((b.x-a.x)/image.width,(b.y-a.y)/image.width,(d.x-a.x)/image.height,(d.y-a.y)/image.height,a.x,a.y);g.drawImage(image,0,0);g.restore();};
  g.setTransform(dpr,0,0,dpr,0,0);const daylight=sim.daylight;const sky=g.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,daylight>.3?'#607f93':'#10192a');sky.addColorStop(1,daylight>.3?'#c3c5b7':'#30394a');g.fillStyle=sky;g.fillRect(0,0,w,h);g.fillStyle=daylight>.3?'#51564b':'#20282d';g.fillRect(0,horizon,w,h-horizon);
  // Coarse distance terrain extends the horizon without drawing thousands of full-detail tiles.
  const farRadius=500,farStep=quality===0?40:32,far:{x:number;y:number;d:number;t:number}[]=[];
  const centreX=Math.floor(focus.x/farStep)*farStep,centreY=Math.floor(focus.y/farStep)*farStep;
  for(let y=centreY-farRadius;y<=centreY+farRadius;y+=farStep)for(let x=centreX-farRadius;x<=centreX+farRadius;x+=farStep){const mx=x+farStep*.5,my=y+farStep*.5,d=(mx-ex)*fx+(my-ey)*fy,side=Math.abs((mx-ex)*rx+(my-ey)*ry);if(d<33||d>farRadius||side>d*.9+farStep)continue;far.push({x,y,d,t:sim.world.tile(Math.floor(mx),Math.floor(my))});}
  far.sort((a,b)=>b.d-a.d);for(const q of far){const color=(GROUND[q.t===T.TREE?T.GRASS:q.t]??GROUND[T.PAVE])[0];quad([[q.x,q.y,0],[q.x+farStep,q.y,0],[q.x+farStep,q.y+farStep,0],[q.x,q.y+farStep,0]],color);}
  // Distant surveyed streets remain visible even where a coarse ground sample misses a narrow road.
  const distantMap=sim.world.mapped;if(distantMap)for(const id of worldIndex(sim.world).roads.query(focus.x-farRadius,focus.y-farRadius,focus.x+farRadius,focus.y+farRadius)){const r=distantMap.streetSegments[id];if(!r)continue;const nearest=(focus.x-r.x)*r.dx+(focus.y-r.y)*r.dy,start=Math.max(0,nearest-farRadius),end=Math.min(r.length,nearest+farRadius);for(let at=start;at<end;at+=12){const to=Math.min(end,at+12),x=r.x+r.dx*at,y=r.y+r.dy*at,u=r.x+r.dx*to,v=r.y+r.dy*to,p=local((x+u)/2,(y+v)/2,0);if(p.z<38||p.z>farRadius||Math.abs(p.x)>p.z+10)continue;if(sim.world.tile(Math.floor((x+u)/2),Math.floor((y+v)/2))===T.WATER)continue;quad([[x-r.dy*r.half,y+r.dx*r.half,.01],[u-r.dy*r.half,v+r.dx*r.half,.01],[u+r.dy*r.half,v-r.dx*r.half,.01],[x+r.dy*r.half,y-r.dx*r.half,.01]],GROUND[T.ROAD][0]);}}
  // Ground remains tied to the world's collision tiles, including bridge and water tiles.
  const ground:{x:number;y:number;d:number;t:number;z:number}[]=[];const cx=Math.floor(focus.x),cy=Math.floor(focus.y),radius=36;
  for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){const d=(x+.5-ex)*fx+(y+.5-ey)*fy,side=Math.abs((x+.5-ex)*rx+(y+.5-ey)*ry);if(d<near||d>38||side>d*.9+3)continue;ground.push({x,y,d,t:sim.world.tile(x,y),z:sim.world.groundZ(x+.5,y+.5)});}
  // Elevation can overlap neighbouring tiles in projection; paint distant tiles first.
  ground.sort((a,b)=>b.d-a.d);
  let textureBudget=quality===0?0:120;
  for(const q of ground){
   const hash=Math.abs(Math.imul(q.x,73856093)^Math.imul(q.y,19349663)),variation=hash%5,colors=GROUND[q.t===T.TREE?T.GRASS:q.t]??GROUND[T.PAVE],color=colors[variation<2?0:1];
   quad([[q.x,q.y,q.z],[q.x+1,q.y,q.z],[q.x+1,q.y+1,q.z],[q.x,q.y+1,q.z]],color);
   // Show actual simulated height steps, rather than inventing terrain elevation data.
   if(q.z>0&&q.d<28){const sides:[[number,number],[number,number],number,number][]=[[[q.x,q.y],[q.x+1,q.y],q.x,q.y-1],[[q.x+1,q.y],[q.x+1,q.y+1],q.x+1,q.y],[[q.x+1,q.y+1],[q.x,q.y+1],q.x,q.y+1],[[q.x,q.y+1],[q.x,q.y],q.x-1,q.y]];for(const [a,b,nx,ny] of sides){const low=sim.world.groundZ(nx+.5,ny+.5);if(low<q.z)quad([[a[0],a[1],low],[b[0],b[1],low],[b[0],b[1],q.z],[a[0],a[1],q.z]],'#686860');}}
   // A small kerb lip delineates pavement from traffic lanes; it is visual, not a new road obstacle.
   if(q.t===T.SIDEWALK&&q.d<22){const sides:[[number,number],[number,number],number,number][]=[[[q.x,q.y],[q.x+1,q.y],q.x,q.y-1],[[q.x+1,q.y],[q.x+1,q.y+1],q.x+1,q.y],[[q.x+1,q.y+1],[q.x,q.y+1],q.x,q.y+1],[[q.x,q.y+1],[q.x,q.y],q.x-1,q.y]];for(const [a,b,nx,ny] of sides){const t=sim.world.tile(nx,ny);if(t===T.ROAD||t===T.CROSSWALK)quad([[a[0],a[1],q.z],[b[0],b[1],q.z],[b[0],b[1],q.z+.045],[a[0],a[1],q.z+.045]],'#a6a49a');}}
   if(q.t===T.SIDEWALK&&q.d<15){quad([[q.x,q.y+.49,q.z+.012],[q.x+1,q.y+.49,q.z+.012],[q.x+1,q.y+.505,q.z+.012],[q.x,q.y+.505,q.z+.012]],'#514f4c80');}
   if(q.d<15&&textureBudget>0&&(q.t===T.GRASS||q.t===T.ROAD||q.t===T.SIDEWALK||q.t===T.PAVE)){textureBudget--;texture([[q.x,q.y,q.z+.008],[q.x+1,q.y,q.z+.008],[q.x+1,q.y+1,q.z+.008],[q.x,q.y+1,q.z+.008]],q.t===T.GRASS?'grass':q.t===T.ROAD?'asphalt':q.t===T.SIDEWALK||q.t===T.PAVE?'pavers':'concrete',.7);}
   if(q.d<24){const x=q.x+.15+(hash%37)/70,y=q.y+.15+(hash%29)/60;
    if(q.t===T.WATER){const wave=.06*Math.sin(time*2+q.x*.9+q.y);quad([[x,y,.025],[x+.24,y+.06,.025],[x+.29,y+.09,.025],[x+.04,y+.03,.025]],wave>0?'#7499a080':'#254c5780');}
    else if(q.t===T.GRASS)quad([[x,y,.015],[x+.035,y,.015],[x+.035,y+.14,.015],[x,y+.14,.015]],'#76907088');
    else if(q.t===T.ROAD||q.t===T.SIDEWALK||q.t===T.PAVE)quad([[x,y,.015],[x+.08,y,.015],[x+.08,y+.035,.015],[x,y+.035,.015]],'#a09e8a55');
   }
  }
  // Lane lines follow the actual mapped road segments and disappear beneath bridges/ground only where appropriate.
  const map=sim.world.mapped;
  if(map)for(const id of worldIndex(sim.world).roads.query(cx-radius,cy-radius,cx+radius,cy+radius)){const r=map.streetSegments[id];if(!r)continue;const offsetList=[-r.half+.1,r.half-.1,...(r.oneway===0?[0]:[])];for(const offset of offsetList)for(let at=Math.max(0,Math.floor((((focus.x-r.x)*r.dx+(focus.y-r.y)*r.dy)-48)/3.2)*3.2);at<Math.min(r.length,((focus.x-r.x)*r.dx+(focus.y-r.y)*r.dy)+48);at+=3.2){if(offset===0&&Math.floor(at/3.2)%2)continue;const end=Math.min(r.length,at+2.4),a=r.x+r.dx*at-r.dy*offset,b=r.y+r.dy*at+r.dx*offset,c=r.x+r.dx*end-r.dy*offset,d=r.y+r.dy*end+r.dx*offset;if(Math.hypot(a-focus.x,b-focus.y)>48&&Math.hypot(c-focus.x,d-focus.y)>48)continue;const tile=sim.world.tile(Math.floor((a+c)/2),Math.floor((b+d)/2));if(tile!==T.ROAD&&tile!==T.CROSSWALK)continue;const mx=(a+c)/2,my=(b+d)/2;if(at<3||end>r.length-3)continue;
   let junction=false;for(const otherId of worldIndex(sim.world).roads.query(mx-2,my-2,mx+2,my+2)){const other=map.streetSegments[otherId];if(!other||other.id===r.id||Math.abs(r.dx*other.dx+r.dy*other.dy)>.88)continue;const u=Math.max(0,Math.min(other.length,(mx-other.x)*other.dx+(my-other.y)*other.dy));if(Math.hypot(mx-other.x-other.dx*u,my-other.y-other.dy*u)<other.half+1){junction=true;break;}}if(junction)continue;
   const width=.035;quad([[a-r.dy*width,b+r.dx*width,.012],[c-r.dy*width,d+r.dx*width,.012],[c+r.dy*width,d-r.dx*width,.012],[a+r.dy*width,b-r.dx*width,.012]],offset===0?'#c4a466':'#b0b2a4');}}
  const items:{depth:number;draw:()=>void}[]=[];let windowBudget=quality===0?0:quality===1?18:36,windowGeometryBudget=quality===0?100:quality===1?260:500,distantFacadeBudget=quality===0?20:quality===1?40:60;
  // Draw the same street greenery and tree tiles as the overhead view, depth-sorted with traffic.
  const decor=map?null:decorGrid(sim.world);
  for(const tile of ground){
   const kind=tile.t===T.TREE?D.TREE:map&&map.visibility.fixtures?mappedStreetDecor(sim.world,tile.x,tile.y):decor&&tile.x>=0&&tile.y>=0&&tile.x<sim.world.size&&tile.y<sim.world.size?decor[tile.y*sim.world.size+tile.x]:D.NONE;
   if(!kind)continue;const x=tile.x+.5,y=tile.y+.5,p=local(x,y,tile.z);if(p.z<2||p.z>38||Math.abs(p.x)>p.z+3)continue;
   const seed=Math.abs(Math.imul(tile.x,73856093)^Math.imul(tile.y,19349663));
   items.push({depth:p.z,draw:()=>{const at=screen(p),scale=Math.min(2.5,focal/p.z/26);drawDecor(g,kind,at.x,at.y,scale,time,1-daylight,(seed%1000)/1000);}});
  }
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
  const damageByBuilding=new Map<number|string,import('../sim/MappedFacadeDamage').MappedFacadeRecord[]>();for(const d of sim.mappedDamage.values()){const list=damageByBuilding.get(d.buildingId)??[];list.push(d);damageByBuilding.set(d.buildingId,list);}
  for(const id of worldIndex(sim.world).buildings.query(cx-farRadius,cy-farRadius,cx+farRadius,cy+farRadius)){
   const b=sim.world.buildings[id];if(!b)continue;const bx=(b.x0+b.x1+1)/2,by=(b.y0+b.y1+1)/2,extent=Math.hypot(b.x1-b.x0+1,b.y1-b.y0+1)/2,forward=(bx-ex)*fx+(by-ey)*fy,side=(bx-ex)*rx+(by-ey)*ry;if(forward+extent<near||forward-extent>farRadius||Math.abs(side)>Math.max(0,forward)*1.05+extent*2+8)continue;const source=map?.byBuilding.get(id),pts=source&&map?source.points.map(p=>[p[0]/map.metresPerTile+map.offsetX,p[1]/map.metresPerTile+map.offsetY] as [number,number]):[[b.x0,b.y0],[b.x1+1,b.y0],[b.x1+1,b.y1+1],[b.x0,b.y1+1]] as [number,number][];
   if(pts.length>3&&pts[0][0]===pts[pts.length-1][0]&&pts[0][1]===pts[pts.length-1][1])pts.pop();if(pts.length<3)continue;const depths=pts.map(point=>(point[0]-ex)*fx+(point[1]-ey)*fy),depth=Math.max(near,Math.min(...depths));if(Math.max(...depths)<near||depth>farRadius)continue;
   // Far buildings retain their surveyed footprint and facade rhythm with fewer canvas operations.
   if(depth>45){const height=Math.max(1,Math.min(120,source&&map?source.height/map.metresPerTile:b.height)),arch=source?mappedFacadeStyle(source):null,wall=arch?.wall??b.color,roof=arch?.roof??b.roof;
    items.push({depth,draw:()=>{const area=pts.reduce((sum,a,i)=>{const z=pts[(i+1)%pts.length];return sum+a[0]*z[1]-z[0]*a[1];},0),winding=area>=0?1:-1;
     for(let i=0;i<pts.length;i++){const a=pts[i],z=pts[(i+1)%pts.length];if(((z[0]-a[0])*(ey-a[1])-(z[1]-a[1])*(ex-a[0]))*winding>=0)continue;
      const corners:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[[a[0],a[1],0],[z[0],z[1],0],[z[0],z[1],height],[a[0],a[1],height]],projected=corners.map(q=>local(...q));
      if(projected.some(q=>q.z<=near)){quad(corners,wall);continue;}
      const [pa,pb,pc,pd]=projected.map(screen),xs=[pa.x,pb.x,pc.x,pd.x],ys=[pa.y,pb.y,pc.y,pd.y],left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);if(right<0||left>w||bottom<0||top>h)continue;
      // Windows smaller than a few screen pixels cannot be resolved; keep the correct facade colour.
      if(right-left<8||bottom-top<7){quad(corners,wall);continue;}
      const rows=Math.min(12,Math.max(1,b.floors)),cols=Math.min(12,Math.max(1,Math.floor(Math.hypot(z[0]-a[0],z[1]-a[1])/(arch?.bayWidth?arch.bayWidth/2:1.4)))),trim=arch?.trim??'#a9b4ad',style=arch?.window??'bay',key=[wall,trim,style,rows,cols,daylight<.35?1:0].join('|');
      let image=this.distantFacades.get(key);if(!image){image=document.createElement('canvas');image.width=image.height=64;const face=image.getContext('2d')!;face.fillStyle=wall;face.fillRect(0,0,64,64);const cw=64/cols,ch=64/rows;face.fillStyle=trim;for(let f=0;f<rows;f++)face.fillRect(0,f*ch,64,Math.max(.5,ch*.045));for(let f=0;f<rows;f++)for(let c=0;c<cols;c++){face.fillStyle=daylight<.35&&(b.id+f*7+c*3)%7===0?'#d8c996':'#4e6a76';const inset=style==='ribbon'?.08:.2;face.fillRect((c+inset)*cw,(f+.23)*ch,(1-2*inset)*cw,.52*ch);face.fillStyle='#a3aca488';face.fillRect((c+.5)*cw,(f+.23)*ch,Math.max(.5,cw*.015),.52*ch);}this.distantFacades.set(key,image);if(this.distantFacades.size>512)this.distantFacades.delete(this.distantFacades.keys().next().value!);}
      g.save();g.beginPath();g.moveTo(pa.x,pa.y);g.lineTo(pb.x,pb.y);g.lineTo(pc.x,pc.y);g.lineTo(pd.x,pd.y);g.closePath();g.clip();g.transform((pb.x-pa.x)/64,(pb.y-pa.y)/64,(pd.x-pa.x)/64,(pd.y-pa.y)/64,pa.x,pa.y);g.drawImage(image,0,0);g.restore();

     }polygon(pts.map(p=>local(p[0],p[1],height)),roof);
    }});continue;
   }
   items.push({depth,draw:()=>{
    const height=Math.max(1,Math.min(120,source&&map?source.height/map.metresPerTile:b.height)),arch=source?mappedFacadeStyle(source):null,wall=arch?.wall??b.color,roof=arch?.roof??b.roof;
    const pitched=pts.length===4&&(arch?.shape==='gable'||arch?.shape==='gabled'),rise=pitched?Math.min(height*.22,1.2):0,wallTop=height-rise;
    const damage=source?damageByBuilding.get(source.id)??[]:[];
    const projectDamage=(d:typeof damage[number],u:number,z:number,out=0):[number,number]=>{const p=local(d.a[0]+(d.b[0]-d.a[0])*u-d.normal[0]*out*d.units,d.a[1]+(d.b[1]-d.a[1])*u-d.normal[1]*out*d.units,z*1.625*d.units),q=screen({...p,z:Math.max(near,p.z)});return[q.x,q.y];};
    const pointInside=(x:number,y:number)=>{let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],z=pts[j];if((a[1]>y)!==(z[1]>y)&&x<(z[0]-a[0])*(y-a[1])/(z[1]-a[1])+a[0])yes=!yes;}return yes;};
    const obscures=depth<8&&[0,.2,.4,.6,.8,1].some(t=>pointInside(ex+(focus.x-ex)*t,ey+(focus.y-ey)*t));
    g.save();if(obscures)g.globalAlpha=.16;if(damage.some(d=>d.opening)){g.beginPath();g.rect(-w*3,-h*3,w*7,h*7);for(const d of damage)if(d.opening){openingOutline(d).forEach(([u,z],i)=>{const p=projectDamage(d,u,z);if(i)g.lineTo(...p);else g.moveTo(...p);});g.closePath();}g.clip('evenodd');}
    const area=pts.reduce((sum,a,i)=>{const z=pts[(i+1)%pts.length];return sum+a[0]*z[1]-z[0]*a[1];},0),winding=area>=0?1:-1;
    const inside=pointInside(ex,ey);
    const faces=pts.map((a,i)=>{const z=pts[(i+1)%pts.length];return {a,z,dist:((a[0]+z[0])/2-ex)*fx+((a[1]+z[1])/2-ey)*fy,visible:inside||((z[0]-a[0])*(ey-a[1])-(z[1]-a[1])*(ex-a[0]))*winding<0};}).filter(f=>f.visible).sort((a,z)=>z.dist-a.dist);
    for(const {a,z,dist} of faces){const length=Math.hypot(z[0]-a[0],z[1]-a[1]);if(length<.01)continue;const at=(u:number,h:number):[number,number,number]=>[a[0]+(z[0]-a[0])*u,a[1]+(z[1]-a[1])*u,h];quad([at(0,0),at(1,0),at(1,wallTop),at(0,wallTop)],wall,'#353b3b');if(dist<22&&quality>0){const parts=Math.max(1,Math.min(12,Math.ceil(length/3)));for(let part=0;part<parts;part++){const u=part/parts,v=(part+1)/parts;texture([at(u,0),at(v,0),at(v,wallTop),at(u,wallTop)],arch?.material==='brick'||arch?.material==='stone'?'brick':'concrete',.38);}}
     const cols=Math.min(20,Math.max(1,Math.floor(length/(arch?.bayWidth?arch.bayWidth/2:1.4)))),floors=Math.min(18,Math.max(1,b.floors)),floor=wallTop/floors;
     // Preserve a readable window rhythm on distant mapped facades with a bounded amount of geometry.
     if(dist>=30&&distantFacadeBudget>0){const rows=Math.min(floors,4),groups=Math.min(cols,5);for(let f=0;f<rows&&distantFacadeBudget>0;f++)for(let c=0;c<groups&&distantFacadeBudget>0;c++){distantFacadeBudget--;const lo=(f+.25)*wallTop/rows,hi=(f+.72)*wallTop/rows,u=(c+.18)/groups,v=(c+.82)/groups;quad([at(u,lo),at(v,lo),at(v,hi),at(u,hi)],daylight<.35&&((b.id+f+c)%5===0)?'#c8bc91':'#536d76');}}
     if(dist<30){for(let f=0;f<floors;f++){const level=f*floor;quad([at(0,level+.08),at(1,level+.08),at(1,level+.14),at(0,level+.14)],arch?.trim??'#929a92');
      for(let c=0;c<cols&&windowGeometryBudget>(dist>20?140:0);c++){windowGeometryBudget--;const inset=arch?.window==='ribbon'?.08:arch?.heritage?.3:.2,u=(c+inset)/cols,v=(c+1-inset)/cols,lo=level+floor*.25,hi=level+floor*.76,seed=Math.abs((b.id*31+f*13+c*7)%9),lit=daylight<.45&&seed<4&&sim.env.power;quad([at(u,lo),at(v,lo),at(v,hi),at(u,hi)],lit?'#dacb95':'#4e6a76',arch?.trim??'#a0aea8');const mid=(u+v)/2;quad([at(mid-.008,lo),at(mid+.008,lo),at(mid+.008,hi),at(mid-.008,hi)],'#a3aca4');
       if(dist<18&&windowBudget>0){const corners=[at(u,lo),at(v,lo),at(v,hi),at(u,hi)].map(q=>local(...q));if(corners.every(q=>q.z>near+1)){const pp=corners.map(screen);const win:Win={A:[pp[0].x,pp[0].y],B:[pp[1].x,pp[1].y],C:[pp[2].x,pp[2].y],D:[pp[3].x,pp[3].y],col:lit?'#dacb95':'#4e6a76',seed:b.id*131+f*31+c*17};if(Math.hypot(win.B[0]-win.A[0],win.B[1]-win.A[1])>=7){windowBudget--;paintWindowStories(g,[win],reduceMotion?0:time);}}}
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
  this.cam.viewW=w;this.cam.viewH=h;this.cam.toScreen=(x,y,z,out)=>{const p=local(x,y,z),s=screen({...p,z:Math.max(near,p.z)});out.x=s.x;out.y=s.y;return out;};
  for(const v of sim.vehicles){const p=local(v.x,v.y,0);if(p.z<(v.id===car?.id?2:4)||p.z>64||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);this.cam.viewVector=[ex-v.x,ey-v.y,eye];drawCar(g,this.cam,v,alpha,time,1-daylight,false,sim.chars[v.driver]);}});}
  for(const v of sim.vehicles)for(let i=0;i<(v.components?.debris.length??0);i++){const d=v.components!.debris[i],p=local(d.x,d.y,d.z);if(p.z<1||p.z>38||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);drawVehicleFragment(g,this.cam,v,i);}});}
  for(const prop of sim.cityPlay.props){const p=local(prop.x,prop.y,prop.z);if(p.z<1||p.z>32||Math.abs(p.x)>p.z+3)continue;items.push({depth:p.z,draw:()=>{this.cam.zoom=Math.max(.08,focal/p.z/25);drawStreetProp(g,this.cam,prop,time);}});}
  for(const id of worldIndex(sim.world).pois.query(cx-radius,cy-radius,cx+radius,cy+radius)){
   const prop=sim.world.pois[id];if(!prop||prop.kind==='door')continue;const p=local(prop.x,prop.y,0);if(p.z<1||p.z>32||Math.abs(p.x)>p.z+2)continue;
   items.push({depth:p.z,draw:()=>{
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
  for(const c of sim.chars){if(c.inCar>=0||c.inside>=0)continue;const p=local(c.x,c.y,c.z);if(p.z<1||p.z>48||Math.abs(p.x)>p.z+2)continue;items.push({depth:p.z,draw:()=>{const at=screen(p),k=Math.max(.025,focal/p.z/110)*c.look.scale,dir=Math.cos(c.facing-angle)>=0?1:-1;this.picks.push({id:c.id,x:at.x,y:at.y,size:105*k,depth:p.z});const a=pose(Math.hypot(c.vx,c.vy)>.12?"walk":c.anim.pose,c.style,time,time*5+c.seedPhase,Math.hypot(c.vx,c.vy),c.anim.poseT);applyGait(a,gaitOf(c.id));applyLegVariation(a,c.id,c.anim.pose,time*5+c.seedPhase);if(c.phys===Phys.DOWN){const limbs=impactRagdollPose(c);a.armL+=limbs[0];a.armR+=limbs[1];a.thighL+=limbs[2];a.thighR+=limbs[3];a.foreL+=limbs[4]*.5;a.foreR+=limbs[5]*.5;a.bendL+=limbs[6]*.5;a.bendR+=limbs[7]*.5;a.tilt+=limbs[8]*.35;}solve(a,at.x,at.y,k,dir);drawFigure(g,c,at.x,at.y,k,dir,time,c.anim.flash,1,false);if(c.hand>=0){const toy=sim.toys[c.hand],def=toy&&TOYS[toy.def];if(def)drawToy(g,toy.def,J[14],J[15],k,def.uses.includes("melee")?Math.atan2(J[15]-J[13],J[14]-J[12]):0,toy.color,1,dir);}if((c.fireUntil??0)>sim.tick){g.fillStyle="rgba(255,120,25,.8)";for(let j=0;j<4;j++){const x=J[j*4],y=J[j*4+1],size=Math.max(2,k*6);g.beginPath();g.moveTo(x-size,y);g.quadraticCurveTo(x-size,y-size*2,x+Math.sin(time*8+j)*size,y-size*4);g.quadraticCurveTo(x+size,y-size*2,x+size,y);g.fill();}}}});}
  items.sort((a,b)=>b.depth-a.depth);for(const item of items)item.draw();
  g.save();for(const glow of GLOW)glow(g);g.restore();GLOW.length=0;
  particles.update(dt);particles.draw(g,this.cam,(x,y)=>{const p=local(x,y,0);return p.z>near?Math.min(4,focal/p.z/26):0;});
  if(!map||map.visibility.weather)rain.draw(g,sim.env.rain,w,h,dt,quality===0?60:quality===1?160:260,reduceMotion);
 }
}


