import {expect,it} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {makeVehicle,seat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {T,type Building} from '../src/world/World';

it('drives through a breached mapped wall and stays inside the building',()=>{
 const sim=new Simulation({cityMap:'christchurch',trafficCars:0,backgroundCount:0,midCount:0}),w=sim.world,m=w.mapped!;
 sim.vehicles=[];w.tiles.fill(T.ROAD);w.blocked.fill(0);w.buildingOf.fill(-1);w.buildings=[];m.damageFootprints=[];m.buildingIds.clear();
 const x=100,y=100,points=[[x,y],[x+12,y],[x+12,y+12],[x,y+12]],b:Building={id:0,kind:'office',name:'Glass test',x0:x,y0:y,x1:x+11,y1:y+11,floors:2,height:5,color:'#889999',roof:'#333333',sign:'#ffffff',facadeMaterial:'glass',door:{x:x+6,y:y+12,face:'s'},area:0,billboard:false};
 w.buildings.push(b);m.buildingIds.set(999,0);m.damageFootprints.push({id:999,points,height:6,kind:'office',tags:{'building:material':'glass'}});
 for(let iy=y;iy<y+12;iy++)for(let ix=x;ix<x+12;ix++){const i=iy*w.size+ix;w.tiles[i]=T.BUILDING;w.blocked[i]=1;w.buildingOf[i]=0;}
 for(const c of sim.chars){c.x=c.px=20;c.y=c.py=20;}
 const v=makeVehicle(sim,'sedan',x-4,y+6,0,'free');seat(sim,sim.player,v);v.heading=0;v.speed=12;v.vx=12;v.vy=0;v.dynT=sim.tick;sim.rebuildHash();Object.assign(playerInput,{throttle:1,steer:0,brake:false});
 try{for(let i=0;i<100&&v.x<x+1;i++){sim.tick++;updateVehicles(sim,1/60);}expect(sim.mappedDamage.snapshot().some(d=>d.opening)).toBe(true);expect(v.x).toBeGreaterThan(x+.3);expect(v.x).toBeLessThan(x+12);expect(v.components?.lattice?.nodes).toHaveLength(200);}
 finally{Object.assign(playerInput,{throttle:0,steer:0,brake:false});}
},30000);
