import type {Simulation} from '../sim/Simulation';
import {generateWorld} from '../world/WorldGenerator';
import {vehicleGeometry} from '../sim/VehicleGeometry';
/** One-time placement migration. IDs, inventory, relationships, cash and damaged assemblies survive. */
export function migrateMappedPositions(sim:Simulation):void{
 const map=sim.world.mapped;if(!map)return;const old=generateWorld({size:164,seed:sim.cfg.seed}),world=sim.world;
 const remap=(x:number,y:number,road=false)=>{let best=Infinity,anchor=old.buildings[0];for(const b of old.buildings){const d=Math.hypot(b.door.x-x,b.door.y-y);if(d<best){best=d;anchor=b;}}const to=world.buildings[anchor.id];let p={x:to.door.x+.5+Math.max(-6,Math.min(6,x-anchor.door.x)),y:to.door.y+.5+Math.max(-6,Math.min(6,y-anchor.door.y))};
  if(road){let nearest=Infinity;const target={...p};for(const s of map.streetSegments){const at=Math.max(2,Math.min(s.length-2,(target.x-s.x)*s.dx+(target.y-s.y)*s.dy)),x=s.x+s.dx*at+s.dy*.8,y=s.y+s.dy*at-s.dx*.8,d=Math.hypot(x-target.x,y-target.y);if(world.drivable(x,y)&&d<nearest){nearest=d;p={x,y};}}return p;}
  return world.nearestFoot(p.x,p.y,12);
 };
 for(const c of sim.chars){const p=remap(c.x,c.y);c.x=c.px=p.x;c.y=c.py=p.y;c.vx=c.vy=0;c.path=null;c.goal=null;}
 for(const v of sim.vehicles){const was={x:v.x,y:v.y},p=remap(v.x,v.y,v.state!=='parked');v.x=v.px=p.x;v.y=v.py=p.y;v.speed=0;v.vx=v.vy=v.yaw=0;if(v.state==='drive')v.state='drive';for(const d of v.components?.debris??[]){d.x+=p.x-was.x;d.y+=p.y-was.y;}if(v.driver>=0){const c=sim.chars[v.driver];if(c){c.x=c.px=p.x;c.y=c.py=p.y;}}}
 for(const t of sim.toys){if(t.state==='held')continue;const p=remap(t.x,t.y);t.x=t.px=p.x;t.y=t.py=p.y;}
 for(const prop of sim.cityPlay.props){const p=remap(prop.x,prop.y);prop.x=p.x;prop.y=p.y;prop.vx=prop.vy=0;}
 for(const marker of sim.life.markers)Object.assign(marker,remap(marker.x,marker.y));
 for(const p of sim.litter.pieces)Object.assign(p,remap(p.x,p.y));
 for(const order of sim.commerce.purchases)if(order.bay)Object.assign(order.bay,remap(order.bay.x,order.bay.y));
 // Existing damage records retain their stable building association on the corresponding real facade.
 const scars=[];for(const d of Object.values(world.civicDamage)){if(d.kind!=='building'||d.building===undefined)continue;const footprint=map.byBuilding.get(d.building);if(!footprint)continue;const points=footprint.points.map(p=>[p[0]/2+map.offsetX,p[1]/2+map.offsetY]),b=world.buildings[d.building];let edge=0,dist=Infinity;for(let i=0;i<points.length-1;i++){const a=points[i],z=points[i+1],dd=Math.hypot((a[0]+z[0])/2-b.door.x,(a[1]+z[1])/2-b.door.y);if(dd<dist){dist=dd;edge=i;}}const a=points[edge] as [number,number],z=points[(edge+1)%points.length] as [number,number],len=Math.hypot(z[0]-a[0],z[1]-a[1])||1,normal:[number,number]=[-(z[1]-a[1])/len,(z[0]-a[0])/len];scars.push({...d,key:'mapped:migrated:'+d.key,buildingId:footprint.id,edge,a,b:z,normal,units:1,x:(a[0]+z[0])/2,y:(a[1]+z[1])/2,impactU:.5});}sim.mappedDamage.restore(scars);
 // Avoid a dense legacy parking cluster after migration without changing owned or damaged cars.
 const occupied=new Set<string>();for(const v of sim.vehicles){const k=Math.floor(v.x/3)+','+Math.floor(v.y/3);if(occupied.has(k)&&v.owner<0&&!v.components&&!v.damage){const g=vehicleGeometry(v),p=world.nearestFoot(v.x+g.length+1,v.y,12);v.x=v.px=p.x;v.y=v.py=p.y;}occupied.add(k);}
 sim.world.civicDamage={};sim.world.graffiti=[];
 sim.focus={x:sim.player.x,y:sim.player.y};
}
