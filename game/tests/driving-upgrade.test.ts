import { afterEach, describe, expect, it } from "vitest";
import { small } from "./helpers";
import { makeVehicle, playerInput, seat, updateVehicles, laneCoord } from "../src/sim/Traffic";
import { followingSpeed, temperatureGrip } from "../src/sim/VehicleHandling";
import { VehicleIndex } from "../src/sim/VehicleIndex";
import { vehicleGeometry, chassisContact, sweptChassisContact } from "../src/sim/VehicleGeometry";
import { runStep, RUN } from "../src/ai/steps";
import { junctionAvailable } from "../src/sim/TrafficControl";
import { impactComponents, components } from "../src/sim/VehicleDamage";
import { VEHICLES, type VehicleClass } from "../src/content/vehicles";
import { T } from "../src/world/World";

function rig(cls: VehicleClass = "super") {
  const sim=small(42,{trafficCars:0,midCount:0,backgroundCount:0});
  sim.vehicles=[]; sim.world.tiles.fill(T.ROAD);sim.world.blocked.fill(0);
  sim.chars.forEach(c=>{c.x=c.px=2;c.y=c.py=2;});sim.rebuildHash();
  const v=makeVehicle(sim,cls,30,42,0,"free");seat(sim,sim.player,v);v.state="free";
  return {sim,v};
}
function velocity(v: ReturnType<typeof makeVehicle>, x:number,y=0) {v.speed=x;v.vx=x;v.vy=y;v.dynT=0;}
afterEach(()=>Object.assign(playerInput,{throttle:0,steer:0,brake:false}));

describe("fleet broad phase",()=>{
  it("finds an extended bus footprint across cell boundaries, without duplicate candidates",()=>{
    const {sim,v}=rig("bus");v.lifeMods=["Limousine chassis"];v.x=8;v.y=8;
    const index=new VehicleIndex();index.rebuild([v]);const out:typeof sim.vehicles=[];
    expect(index.query(v.x+vehicleGeometry(v).length/2-.01,v.y,.05,out)).toContain(v);
    expect(index.query(8,8,15,out)).toEqual([v]);
  });
  it("returns a local subset in a thousand-car fleet",()=>{
    const {sim}=rig();sim.vehicles=[];
    for(let i=0;i<1000;i++)makeVehicle(sim,"hatch",(i%40)*10,Math.floor(i/40)*10,0,"parked");
    const index=new VehicleIndex();index.rebuild(sim.vehicles);
    expect(index.query(100,100,5,[]).length).toBeLessThan(12);
  });
  it("does not retain removed cars or mix independent worlds",()=>{
    const {v}=rig(),a=new VehicleIndex(),b=new VehicleIndex();a.rebuild([v]);b.rebuild([]);
    expect(b.query(v.x,v.y,2,[])).toEqual([]);a.rebuild([]);expect(a.query(v.x,v.y,2,[])).toEqual([]);
  });
});

describe("flow and road conditions",()=>{
  it("matches a moving stream sooner than a stopped obstacle without losing its stopping margin",()=>{
    expect(followingSpeed(4,6,5)).toBeGreaterThan(followingSpeed(4,0,5));
    expect(followingSpeed(0,0,5)).toBe(0);
    expect(followingSpeed(8,0,2)).toBeLessThan(followingSpeed(8,0,6));
  });
  it("shares the box between parallel and opposing straight streams while excluding crossing turns",()=>{
    const {sim}=rig();sim.vehicles=[];
    const a=makeVehicle(sim,"sedan",37,40.5,0,"drive"),b=makeVehicle(sim,"hatch",37,41.5,0,"drive"),c=makeVehicle(sim,"sedan",47,43.5,2,"drive"),d=makeVehicle(sim,"sedan",43.5,37,1,"drive");
    expect(junctionAvailable(sim,a,2,2)).toBe(true);expect(junctionAvailable(sim,b,2,2)).toBe(true);
    expect(junctionAvailable(sim,c,2,2)).toBe(true);expect(junctionAvailable(sim,d,2,2)).toBe(false);
    a.nextDir=1;expect(junctionAvailable(sim,b,2,2)).toBe(false);
  });
  it("releases a cancelled approach reservation after its lease",()=>{
    const {sim}=rig();sim.vehicles=[];
    const a=makeVehicle(sim,"sedan",37,40.5,0,"drive"),b=makeVehicle(sim,"hatch",43.5,37,1,"drive");
    expect(junctionAvailable(sim,a,2,2)).toBe(true);sim.tick+=601;expect(junctionAvailable(sim,b,2,2)).toBe(true);
  });
  it("starts a close queue promptly without overlap or crash cascades",()=>{
    const {sim}=rig();sim.vehicles=[];
    const cars=Array.from({length:5},(_,i)=>makeVehicle(sim,"hatch",35-i*3,laneCoord(0,2),0,"drive"));
    cars.forEach(v=>{v.siren=true;}); // Isolate queue response from red-light waiting.
    const x=cars[4].x;
    for(let i=0;i<180;i++){sim.tick++;updateVehicles(sim,1/60);}
    expect(cars[4].x-x).toBeGreaterThan(1);
    expect(cars.every(v=>v.state==="drive"&&v.damage===0)).toBe(true);
    for(let i=0;i<cars.length-1;i++)expect(chassisContact(cars[i],cars[i+1])).toBeNull();
  });
  it("keeps an appointment active while its pedestrian waits through a long signal cycle",()=>{
    const {sim}=rig(),c=sim.player;
    sim.bookings.push({id:1,client:c.id,photographer:1,shoot:"test",label:"test",price:0,place:"studio",at:0,done:false,shotAt:0});
    const step={kind:"pose" as const,booking:1,x:70,y:70};
    expect(runStep(c,step,{id:"attend",target:-1,plan:[step],stepIdx:0,stepTimer:61,started:0,replans:0},sim,1/60)).toBe(RUN);
  });
  it("routes around a parked road obstruction without damaging the queue",()=>{
    const {sim}=rig();sim.vehicles=[];
    const v=makeVehicle(sim,"hatch",27,laneCoord(0,2),0,"drive"),blocker=makeVehicle(sim,"hatch",34,laneCoord(0,2),0,"parked");
    for(let i=0;i<600;i++){sim.tick++;updateVehicles(sim,1/60);}
    expect(v.x,JSON.stringify({y:v.y,dir:v.dir,next:v.nextDir,size:vehicleGeometry(v),other:vehicleGeometry(blocker)})).toBeGreaterThan(blocker.x+2);
    expect(v.damage).toBe(0);expect(blocker.damage).toBe(0);expect(v.state).toBe("drive");
  });
});

describe("responsive handling",()=>{
  it("preserves the full frame sweep through physics substeps and keeps the driver seated",()=>{
    const {sim,v}=rig();velocity(v,9);const x=v.x;updateVehicles(sim,.1);
    expect(v.px).toBe(x);expect(v.x-x).toBeGreaterThan(.7);
    expect(sim.player.x).toBe(v.x);expect(sim.player.px).toBe(v.px);
  });
  it("bounds hitch catch-up and rejects invalid deltas without corrupting velocity",()=>{
    const {sim,v}=rig();velocity(v,10);updateVehicles(sim,NaN);expect(v.x).toBe(30);
    updateVehicles(sim,5);expect(v.x).toBeLessThan(33);expect(Number.isFinite(v.vx)).toBe(true);
  });
  it("delivers the same turn across 30 and 120 Hz input frames",()=>{
    const a=rig(),b=rig();velocity(a.v,7);velocity(b.v,7);Object.assign(playerInput,{throttle:.3,steer:.5});
    for(let i=0;i<30;i++){a.sim.tick++;updateVehicles(a.sim,1/30);}
    for(let i=0;i<120;i++){b.sim.tick++;updateVehicles(b.sim,1/120);}
    expect(a.v.heading).toBeCloseTo(b.v.heading,6);expect(a.v.x).toBeCloseTo(b.v.x,6);
  });
  it("warms tyres and penalises sustained overheating",()=>{
    expect(temperatureGrip(.4)).toBeGreaterThan(temperatureGrip(0));
    expect(temperatureGrip(1)).toBeLessThan(temperatureGrip(.4));
  });
  it("damaged rolling gear loses speed when coasting",()=>{
    const a=rig(),b=rig();velocity(a.v,8);velocity(b.v,8);components(b.v).wheels[0].puncture=true;
    for(let i=0;i<30;i++){a.sim.tick++;b.sim.tick++;updateVehicles(a.sim,1/60);updateVehicles(b.sim,1/60);}
    expect(b.v.speed).toBeLessThan(a.v.speed);
  });
  it("accepts every current catalogue model with finite steering and velocity",()=>{
    const {sim,v}=rig();Object.assign(playerInput,{throttle:1,steer:.5});
    for(const cls of Object.keys(VEHICLES) as VehicleClass[]){
      v.cls=cls;v.x=30;v.y=42;v.heading=0;v.damage=0;v.components=undefined;velocity(v,4);v.dynT=sim.tick;
      sim.tick++;updateVehicles(sim,1/30);
      expect([v.x,v.y,v.speed,v.heading,v.yaw??0].every(Number.isFinite),cls).toBe(true);
    }
  });
});

describe("crash energy and feedback",()=>{
  it("detects two narrow cars passing completely through each other between endpoints",()=>{
    const {sim,v}=rig("bicycle"),b=makeVehicle(sim,"bicycle",30,42,1,"parked");
    v.px=20;v.py=v.y=42;v.x=40;
    expect(chassisContact(v,b)).toBeNull();const hit=sweptChassisContact(v,b);
    expect(hit?.t).toBeGreaterThan(0);expect(hit?.t).toBeLessThan(1);expect(hit?.nx).toBe(1);
  });
  it("keeps a centred contact on the centre line and an offset hit near the struck corner",()=>{
    const {sim,v}=rig("sedan"),g=vehicleGeometry(v),b=makeVehicle(sim,"sedan",v.x+g.length*.9,v.y,0,"free");b.plate=v.plate;
    expect(chassisContact(v,b)?.y).toBeCloseTo(v.y,6);b.y+=g.width*.7;
    expect(chassisContact(v,b)!.y).toBeGreaterThan(v.y+g.width*.2);
  });
  it("transfers momentum and damages a parked target instead of treating it as an immovable wall",()=>{
    const {sim,v}=rig("muscle"),b=makeVehicle(sim,"sedan",32,42,0,"parked");velocity(v,14);
    for(let i=0;i<12;i++){sim.tick++;updateVehicles(sim,1/60);}
    expect(v.damage).toBeGreaterThan(0);expect(b.components!.panels.some(n=>n>0)).toBe(true);
    expect(b.state).toBe("crashed");expect(b.x).toBeGreaterThan(32.1);expect(Math.abs(v.vx!)).toBeLessThan(14);
  });
  it("makes a glancing side hit spin and keeps velocities finite",()=>{
    const {sim,v}=rig("muscle"),b=makeVehicle(sim,"hatch",32,42.5,1,"free");velocity(v,12);
    for(let i=0;i<15;i++){sim.tick++;updateVehicles(sim,1/60);}
    expect(Math.abs(v.yaw??0)+Math.abs(b.yaw??0)).toBeGreaterThan(.05);
    expect([v.vx,v.vy,b.vx,b.vy].every(Number.isFinite)).toBe(true);
  });
  it("scales impact feedback with severity and preserves solved momentum",()=>{
    const {sim,v}=rig(),b=makeVehicle(sim,"hatch",34,42,0,"free"),bursts:number[]=[];
    sim.bus.on("fx",e=>{if(e.kind==="break")bursts.push(e.n??0);});velocity(v,8);sim.onCarCrash(v,b,3);
    expect(v.speed).toBe(8);const mild=v.crashedUntil;v.state="free";b.state="free";sim.onCarCrash(v,b,12);
    expect(v.crashedUntil).toBeGreaterThan(mild);expect(bursts[1]).toBeGreaterThan(bursts[0]);
  });
  it("emits glass from the hit location with inherited motion, without endlessly refilling broken glass",()=>{
    const {v}=rig();velocity(v,10);const at={x:31,y:42.3};impactComponents(v,1,0,10,1,1,at);
    const p=components(v),glass=p.debris.find(d=>d.kind==="glass")!;
    expect(glass.x).toBe(at.x);expect(glass.y).toBe(at.y);expect(glass.vx).toBeGreaterThan(4);
    p.debris=[];impactComponents(v,1,0,1,1,2,at);expect(p.debris.filter(d=>d.kind==="glass")).toEqual([]);
  });
});
