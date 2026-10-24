import {it,expect} from 'vitest';
import {Simulation} from '../src/sim/Simulation';
import {updateVehicles} from '../src/sim/Traffic';
import {nearbyVehiclePairs} from '../src/sim/MappedTraffic';
import {chassisContact} from '../src/sim/VehicleGeometry';
import {sendAmbulance} from '../src/sim/MedicalResponse';
it('keeps a 650-car mapped fleet moving without ambient pile-ups or car damage',()=>{
 const s=new Simulation({cityMap:'christchurch',trafficCars:650,backgroundCount:450,midCount:0});
 expect(s.vehicles.filter(v=>v.state==='drive')).toHaveLength(650);
 expect(s.chars.filter(c=>c.inCar<0).length).toBeGreaterThan(300);
 for(const c of s.chars.slice(1,5))sendAmbulance(s,c);
 expect(s.vehicles.filter(v=>v.rescueTarget!==undefined)).toHaveLength(4);
 const overlaps:unknown[]=[];
 for(let tick=0;tick<600;tick++){s.tick++;updateVehicles(s,1/60);
  if(tick%60===0)for(const [a,b]of nearbyVehiclePairs(s.vehicles)){const x=s.vehicles[a],y=s.vehicles[b];if(x.state==='parked'&&y.state==='parked')continue;if((chassisContact(x,y)?.depth??0)>.05)overlaps.push({tick,depth:chassisContact(x,y)?.depth,a:[x.id,x.cls,x.state,x.x,x.y,x.heading],b:[y.id,y.cls,y.state,y.x,y.y,y.heading]});}
 }
 expect(overlaps).toEqual([]);expect(s.vehicles.filter(v=>v.damage>0||v.state==='crashed').map(v=>({id:v.id,state:v.state,damage:v.damage,siren:v.siren,driver:v.driver,owner:v.owner}))).toEqual([]);
 expect(s.vehicles.filter(v=>v.state==='drive'&&v.speed>.5).length).toBeGreaterThan(100);
},30000);
