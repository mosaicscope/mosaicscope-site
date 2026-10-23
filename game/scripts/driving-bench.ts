import { Simulation } from "../src/sim/Simulation";
import { makeVehicle, updateVehicles, laneCoord } from "../src/sim/Traffic";
import type { VehicleClass } from "../src/content/vehicles";

// Isolate the driving engine; rendering, pedestrian AI and world generation are outside the timer.
// Same seed, spacing, fleet and duration can be run against a baseline checkout.
const classes:VehicleClass[]=["hatch","sedan","wagon","bus","muscle","fourby"];
const frames=Number(process.argv[2])||240;
for(const count of [200,600,1200]){
  const sim=new Simulation({seed:4242,worldSize:330,trafficCars:0,midCount:0,backgroundCount:0});
  sim.vehicles=[];sim.chars.forEach(c=>{c.inside=0;});sim.rebuildHash();
  for(let i=0;i<count;i++){
    const x=8+(i%40)*8,line=1+Math.floor(i/40)%16,lane=Math.floor(i/640);
    const v=makeVehicle(sim,classes[i%classes.length],x,laneCoord(0,line,lane),0,i%3===0?"parked":"drive");
    v.nextDir=0;
  }
  const times:number[]=[];let distance=0;
  for(let i=0;i<frames+60;i++){
    sim.tick++;const t=performance.now();updateVehicles(sim,1/60);const ms=performance.now()-t;
    if(i>=60){times.push(ms);for(const v of sim.vehicles)distance+=Math.hypot(v.x-v.px,v.y-v.py);}
  }
  times.sort((a,b)=>a-b);
  console.log(JSON.stringify({count,frames,meanMs:+(times.reduce((a,b)=>a+b,0)/frames).toFixed(3),p95Ms:+times[Math.floor(frames*.95)].toFixed(3),distance:+distance.toFixed(1),crashes:sim.vehicles.filter(v=>v.damage>0).length}));
}
