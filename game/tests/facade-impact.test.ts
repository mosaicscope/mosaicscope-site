import {afterEach,describe,it,expect} from 'vitest';
import {small} from './helpers';
import {makeVehicle,seat,updateVehicles,playerInput} from '../src/sim/Traffic';
import {hitFacade,updateCivicDamage} from '../src/sim/CivicDamage';
import {facadeResponse,facadeBreached,materialOf} from '../src/sim/FacadeImpact';
import {MappedFacadeDamage,sweptMappedFacade,type DamageFootprint} from '../src/sim/MappedFacadeDamage';
import {vehicleGeometry} from '../src/sim/VehicleGeometry';
import {T,type Building} from '../src/world/World';
import {drawBuildingTile,GLOW} from '../src/render/Buildings';
import {serialize,restore} from '../src/persistence/SaveSystem';

afterEach(()=>Object.assign(playerInput,{throttle:0,steer:0,brake:false}));
function rig(material='glass'){
  const sim=small(3,{trafficCars:0,midCount:0,backgroundCount:2});sim.vehicles.length=0;
  sim.world.tiles.fill(T.ROAD);sim.world.blocked.fill(0);sim.world.buildingOf.fill(-1);
  const building:Building={id:0,kind:'office',name:'Crash fixture',x0:50,y0:40,x1:52,y1:44,floors:5,height:6,color:'#879c91',roof:'#555d5c',sign:'#eac78b',facadeMaterial:material,door:{x:51,y:45,face:'s'},area:0,billboard:false};
  sim.world.buildings=[building];for(let y=40;y<=44;y++)for(let x=50;x<=52;x++){const i=y*sim.world.size+x;sim.world.tiles[i]=T.BUILDING;sim.world.blocked[i]=1;sim.world.buildingOf[i]=0;}
  for(const c of sim.chars){c.x=c.px=10;c.y=c.py=10;}
  const car=makeVehicle(sim,'sedan',56,42.5,2,'free');seat(sim,sim.player,car);car.speed=8;car.vx=-8;car.vy=0;car.dynT=sim.tick;sim.rebuildHash();
  return {sim,car,building};
}
const footprint=(material='glass',units=1):DamageFootprint=>({id:42,points:[[50*units,40*units],[53*units,40*units],[53*units,45*units],[50*units,45*units]],height:16,kind:'office',tags:{'building:material':material}});

describe('building contact through damage and maintenance',()=>{
  it('records a real driven facade impact, crumples the car, persists it and repairs the site',()=>{
    const {sim,car}=rig();Object.assign(playerInput,{throttle:1,steer:0,brake:false});
    for(let i=0;i<50&&!Object.keys(sim.world.civicDamage).length;i++){sim.tick++;updateVehicles(sim,1/60);}
    const d=Object.values(sim.world.civicDamage)[0];expect(d).toBeDefined();expect(d.material).toBe('glass');expect(d.face).toBe('e');expect(d.tx).toBe(52);
    expect(car.x).toBeGreaterThan(53);expect(car.components?.panels.some(p=>p>0)).toBe(true);expect(car.components?.dents?.length).toBeGreaterThan(0);
    expect(restore(serialize(sim)).world.civicDamage[d.key]).toEqual(d);
    sim.vehicles=[];for(const c of sim.chars)if(c.tier!=='player')c.inCar=999;
    sim.tick=d.at+60*13;updateCivicDamage(sim);expect(d.phase).toBe('travelling');
    sim.tick=d.at+60*51;updateCivicDamage(sim);expect(d.phase).toBe('working');
    sim.tick=d.repairBy;updateCivicDamage(sim);expect(sim.world.civicDamage[d.key]).toBeUndefined();
  });
  it('resolves an exposed corner by the approach side instead of assigning the hidden wall',()=>{
    const {sim,car}=rig();car.x=54;car.y=40.3;hitFacade(sim,car,52.95,40.05,7);
    expect(Object.values(sim.world.civicDamage)[0].face).toBe('e');
  });
  it('concrete resists surface failure and transfers more damage to the car than glazing',()=>{
    const glass=facadeResponse('glass',8,1.3),concrete=facadeResponse('concrete',8,1.3);
    expect(glass.breached).toBe(true);expect(concrete.breached).toBe(false);expect(concrete.severity).toBeLessThan(glass.severity/5);
    expect(concrete.carDamage).toBeGreaterThan(glass.carDamage*3);expect(facadeBreached('concrete',1)).toBe(false);
    expect(materialOf({'building:material':'reinforced_concrete'},'office',30)).toBe('concrete');
  });
  it.each(['glass','concrete','metal'])('preserves %s damage after the animated window emissive pass',material=>{
    const {sim,car,building}=rig(material);hitFacade(sim,car,52.95,42.5,8);
    const composites:string[]=[];let composite='source-over';
    const context=new Proxy({globalAlpha:1,canvas:{width:800,height:600},get globalCompositeOperation(){return composite;},set globalCompositeOperation(v:string){composites.push(v);composite=v;}}, {get:(t,k)=>k in t?Reflect.get(t,k):()=>{},set:(t,k,v)=>Reflect.set(t,k,v)}) as unknown as CanvasRenderingContext2D;
    GLOW.length=0;drawBuildingTile(context,sim.world,building,52,42,400,400,1,30,.8,1,new Map());
    composites.length=0;GLOW[GLOW.length-1](context);
    expect(composites).toContain('destination-out');
  });
});

describe('mapped native building contact',()=>{
  it.each([1,2])('sweeps actual car movement into a solid footprint at %i coordinate units per vehicle tile',units=>{
    const {car}=rig(),damage=new MappedFacadeDamage();car.px=57;car.py=42.5;car.x=49;car.y=42.5;car.vx=-12;car.vy=0;car.speed=12;
    const hit=damage.contact([footprint('glass',units)],car,10,units);
    expect(hit?.edge).toBe(1);expect(hit?.nx).toBe(-1);expect(hit?.damage?.material).toBe('glass');expect(car.x-vehicleGeometry(car).length/2).toBeGreaterThanOrEqual(53);
    expect(car.vx).toBeGreaterThan(0);expect(car.components?.dents?.length).toBeGreaterThan(0);
    const data=damage.snapshot(),restored=new MappedFacadeDamage();restored.restore(data);expect(restored.snapshot()).toEqual(data);
    damage.update(19);expect([...damage.values()][0].phase).toBe('travelling');
    damage.update(33);expect([...damage.values()][0].phase).toBe('working');expect([...damage.values()][0].repairProgress).toBeGreaterThan(0);
    damage.update(data[0].repairBy);expect([...damage.values()]).toHaveLength(0);
  });
  it('handles reversed polygon winding, lateral drift and the earliest of multiple facades',()=>{
    const {car}=rig();car.heading=0;car.px=51.5;car.py=49;car.x=51.5;car.y=38;car.speed=0;car.vx=0;car.vy=-10;
    const b=footprint();b.points=[...b.points].reverse();const hit=sweptMappedFacade(b,car,1);
    expect(hit?.ny).toBe(-1);expect(hit?.speed).toBe(10);
    const nearest={...footprint(),id:43,points:footprint().points.map(p=>[p[0],p[1]+2])};
    expect(new MappedFacadeDamage().contact([b,nearest],car,1,1)?.building.id).toBe(43);
  });
  it('catches a thin building corner between chassis probes and ignores harmless nearby travel',()=>{
    const {car}=rig();car.heading=Math.PI;car.px=58;car.py=42.5;car.x=49;car.y=42.5;car.vx=-12;car.vy=0;
    const tiny={...footprint(),points:[[53,42.63],[53.08,42.63],[53.08,42.7],[53,42.7]]};
    expect(sweptMappedFacade(tiny,car,1)).not.toBeNull();car.py=car.y=44;expect(sweptMappedFacade(tiny,car,1)).toBeNull();
  });
  it('does not repeatedly destroy a wall while a stopped car remains against it',()=>{
    const {car}=rig(),damage=new MappedFacadeDamage(),b=footprint();
    const contact={x:53,y:42.5,edge:1,u:.5,nx:-1,ny:0,speed:8};
    damage.hit(b,contact,car,10,1);const before=damage.snapshot()[0].severity,body=car.components!.panels.slice();
    damage.hit(b,contact,car,10.1,1);expect(damage.snapshot()[0].severity).toBe(before);expect(car.components!.panels).toEqual(body);
    car.px=car.x;car.py=car.y;expect(damage.contact([b],car,11,1)).toBeNull();
  });
});
