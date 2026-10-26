import {it,expect} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {updateVehicles} from '../src/sim/Traffic';
import {nearbyVehiclePairs} from '../src/sim/MappedTraffic';
import {chassisContact} from '../src/sim/VehicleGeometry';
import {sendAmbulance} from '../src/sim/MedicalResponse';
it('keeps a 750-car mapped fleet moving without ambient pile-ups or car damage',()=>{
 const s=new Simulation({cityMap:'christchurch',trafficCars:750,backgroundCount:450,midCount:0});
 expect(s.vehicles.filter(v=>v.state==='drive')).toHaveLength(750);
 expect(s.chars.filter(c=>c.inCar<0).length).toBeGreaterThan(300);
 for(const c of s.chars.slice(1,5))sendAmbulance(s,c);
 expect(s.vehicles.filter(v=>v.rescueTarget!==undefined)).toHaveLength(4);
 const overlaps:unknown[]=[];
 for(let tick=0;tick<1800;tick++){s.tick++;updateVehicles(s,1/60);
  if(tick%60===0)for(const [a,b]of nearbyVehiclePairs(s.vehicles)){const x=s.vehicles[a],y=s.vehicles[b];if(x.state==='parked'&&y.state==='parked')continue;if((chassisContact(x,y)?.depth??0)>.05)overlaps.push({tick,depth:chassisContact(x,y)?.depth,a:[x.id,x.cls,x.state,x.x,x.y,x.heading],b:[y.id,y.cls,y.state,y.x,y.y,y.heading]});}
 }
 expect(overlaps).toEqual([]);expect(s.vehicles.filter(v=>v.damage>0||v.state==='crashed').map(v=>({id:v.id,state:v.state,damage:v.damage,siren:v.siren,driver:v.driver,owner:v.owner}))).toEqual([]);
 const active=s.vehicles.filter(v=>v.state==='drive'&&Math.hypot(v.x-s.focus.x,v.y-s.focus.y)<80);
 expect(s.vehicles.filter(v=>v.state==='drive'&&v.rescueTarget===undefined)).toHaveLength(750);
 expect(active.filter(v=>v.speed>.5).length).toBeGreaterThan(10);
 const far=s.vehicles.find(v=>v.state==='drive'&&Math.hypot(v.x-s.focus.x,v.y-s.focus.y)>120)!;
 const before={x:far.x,y:far.y};s.tick++;updateVehicles(s,1/60);expect({x:far.x,y:far.y}).toEqual(before);
 s.focus={x:far.x,y:far.y};for(let i=0;i<60;i++){s.tick++;updateVehicles(s,1/60);}expect(s.vehicles.some(v=>v.state==='drive'&&Math.hypot(v.x-s.focus.x,v.y-s.focus.y)<80&&v.speed>.5)).toBe(true);
},60000);
