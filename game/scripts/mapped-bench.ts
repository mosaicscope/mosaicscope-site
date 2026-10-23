import {Simulation} from '../src/sim/Simulation';
import {chassisContact} from '../src/sim/VehicleGeometry';
const start=performance.now(),sim=new Simulation({cityMap:'christchurch',trafficCars:150,pathsPerTick:2}),boot=performance.now()-start,frames:number[]=[];
let parkedOverlaps=0;for(let i=0;i<sim.vehicles.length;i++)for(let j=i+1;j<sim.vehicles.length;j++)if(sim.vehicles[i].state==='parked'&&sim.vehicles[j].state==='parked'&&chassisContact(sim.vehicles[i],sim.vehicles[j]))parkedOverlaps++;
for(let i=0;i<600;i++){const at=performance.now();sim.step();frames.push(performance.now()-at);}frames.sort((a,b)=>a-b);
console.log(JSON.stringify({bootMs:Math.round(boot),cars:sim.vehicles.length,parkedOverlaps,moving:sim.vehicles.filter(v=>v.state==='drive').length,meanMs:frames.reduce((a,b)=>a+b)/frames.length,medianMs:frames[300],p95Ms:frames[570],maxMs:frames[599]}));
