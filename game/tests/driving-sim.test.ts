import { afterEach, describe, expect, it } from "vitest";
import { small } from "./helpers";
import { makeVehicle, playerInput, seat, updateVehicles } from "../src/sim/Traffic";
import { corneringBudget, handlingProfile, roadSurface, slipGrip } from "../src/sim/VehicleHandling";
import { chassisContact, vehicleGeometry } from "../src/sim/VehicleGeometry";
import { components, repairVehicle } from "../src/sim/VehicleDamage";
import { VEHICLES, type VehicleClass } from "../src/content/vehicles";
import { T } from "../src/world/World";
import { cycleDriveMode, drivingSetup, stepPowertrain, stepDrift } from "../src/sim/DrivingExperience";

function fixture(cls: VehicleClass = "super", tile: T = T.ROAD, rain = 0) {
  const sim = small(4, { trafficCars: 0, midCount: 0, backgroundCount: 0 });
  sim.vehicles.length=0;
  sim.world.tiles.fill(tile);sim.world.blocked.fill(0);sim.env.rain=rain;
  for (const c of sim.chars) { c.x=c.px=2;c.y=c.py=2; }
  sim.rebuildHash();
  const v=makeVehicle(sim,cls,40,42,0,"parked");seat(sim,sim.player,v);v.state="free";
  return {sim,v};
}
function run(f: ReturnType<typeof fixture>, seconds: number, throttle=0, steer=0, brake=false, hz=60) {
  Object.assign(playerInput,{throttle,steer,brake});
  for(let i=0;i<Math.round(seconds*hz);i++) {
    // Keep the test rig away from map boundaries, measuring velocities rather than travel.
    f.v.x=40;f.v.y=42;f.sim.tick++;updateVehicles(f.sim,1/hz);
  }
}
function speed(f: ReturnType<typeof fixture>, n: number) {
  f.v.speed=n;f.v.vx=Math.cos(f.v.heading)*n;f.v.vy=Math.sin(f.v.heading)*n;f.v.dynT=f.sim.tick;
}
afterEach(()=>Object.assign(playerInput,{throttle:0,steer:0,brake:false}));

describe("surface and drivetrain science",()=>{
  it("inherits AWD and offroad capability for authored fleet models",()=>{
    expect(handlingProfile("patrol")).toMatchObject({drive:"awd",offroad:true});
    expect(handlingProfile("gsr").drive).toBe("awd");
    expect(handlingProfile("muscle").drive).toBe("rwd");
    expect(handlingProfile("hatch").drive).toBe("fwd");
  });
  it("wet paint loses more friction than wet asphalt, and 4x4 tyres help on sand",()=>{
    expect(roadSurface(T.CROSSWALK,1,false).grip).toBeLessThan(roadSurface(T.ROAD,1,false).grip);
    expect(roadSurface(T.SAND,0,true).grip).toBeGreaterThan(roadSurface(T.SAND,0,false).grip);
    expect(roadSurface(T.GRASS,1,false).grip).toBeLessThan(roadSurface(T.GRASS,0,false).grip);
  });
  it("combined tyre force never exceeds the available friction circle",()=>{
    for(const force of [0,1,3,5,9]) {
      const lat=corneringBudget(10,force);
      expect(Math.hypot(force,lat)).toBeCloseTo(10,8);
    }
    expect(slipGrip(0.7)).toBeLessThan(slipGrip(0.1));
    expect(slipGrip(0.7)).toBeGreaterThan(0.7);
  });
  it("wet roads increase stopping distance rather than just changing smoke",()=>{
    const dry=fixture(),wet=fixture("super",T.ROAD,1);speed(dry,8);speed(wet,8);
    run(dry,.4,-1);run(wet,.4,-1);
    expect(wet.v.speed).toBeGreaterThan(dry.v.speed+.5);
  });
  it("sand slows an ordinary car more than asphalt",()=>{
    const road=fixture("hatch"),sand=fixture("hatch",T.SAND);
    run(road,1.2,1);run(sand,1.2,1);
    expect(road.v.speed).toBeGreaterThan(sand.v.speed*1.5);
  });
  it("damaged engines lose acceleration and a repair restores it",()=>{
    const good=fixture(),bad=fixture();bad.v.engineDamage=.75;
    run(good,1,1);run(bad,1,1);expect(bad.v.speed).toBeLessThan(good.v.speed*.8);
    repairVehicle(bad.v);speed(bad,0);bad.v.driveThrottle=0;run(bad,1,1);
    expect(bad.v.speed).toBeCloseTo(good.v.speed,3);
  });
  it("missing wheels reduce available braking grip",()=>{
    const good=fixture(),bad=fixture();components(bad.v).wheels[0].missing=true;components(bad.v).wheels[1].missing=true;
    speed(good,7);speed(bad,7);run(good,.3,-1);run(bad,.3,-1);
    expect(bad.v.speed).toBeGreaterThan(good.v.speed);
  });
  it("coasting never creates motion in reverse even with a tiny pedal on sand",()=>{
    const f=fixture("hatch",T.SAND);run(f,1,.01);expect(f.v.speed).toBe(0);
  });
  it("opposite pedal brakes to a stop before reversing",()=>{
    const f=fixture();speed(f,4);run(f,.2,-1);expect(f.v.speed).toBeGreaterThan(0);
    run(f,2,-1);expect(f.v.speed).toBeLessThan(0);
  });
  it("straight line response stays close across integration rates",()=>{
    const a=fixture(),b=fixture();run(a,1,1,0,false,60);run(b,1,1,0,false,120);
    expect(Math.abs(a.v.speed-b.v.speed)).toBeLessThan(.12);
  });
});

describe("physical model and feedback connections",()=>{
  it("chassis modifications change both contact shape and wheelbase",()=>{
    const {sim,v}=fixture("sedan"),before=vehicleGeometry(v);
    v.lifeMods=["Limousine chassis","Double deck"];
    const after=vehicleGeometry(v);expect(after.length/before.length).toBeCloseTo(1.35);expect(after.height/before.height).toBeCloseTo(1.6);
    expect(after.wheelbase/before.wheelbase).toBeCloseTo(1.35);
    const other=makeVehicle(sim,"sedan",v.x+before.length*1.05,v.y,0,"parked");
    expect(chassisContact(v,other)).not.toBeNull();v.lifeMods=[];expect(chassisContact(v,other)).toBeNull();
  });
  it("parallel cars exchange no collision when their chassis do not overlap",()=>{
    const {sim,v}=fixture(),other=makeVehicle(sim,"super",v.x,v.y+1.2,0,"free");
    expect(chassisContact(v,other)).toBeNull();other.y=v.y+.8;expect(chassisContact(v,other)?.depth).toBeGreaterThan(0);
  });
  it("every authored chassis has valid physical dimensions and a wheelbase inside the body",()=>{
    const {v}=fixture();
    for(const cls of Object.keys(VEHICLES) as VehicleClass[]) {
      v.cls=cls;const g=vehicleGeometry(v);
      expect(g.wheelbase).toBeGreaterThan(0);expect(g.wheelbase).toBeLessThan(g.length);expect(g.width).toBeGreaterThan(0);
    }
  });
  it("wheel travel and body attitude follow movement and acceleration",()=>{
    const f=fixture();run(f,.7,1);expect(f.v.wheelTravel).toBeGreaterThan(.5);expect(f.v.bodyPitch).toBeGreaterThan(0);
    run(f,.2,0,.6);expect(Math.abs(f.v.bodyRoll??0)).toBeGreaterThan(0);expect(f.v.wheelSteer).toBeGreaterThan(0);
  });
  it("hot drifting tyres make smoke at the wheels; wet tyres make spray",()=>{
    const dry=fixture(),wet=fixture("super",T.ROAD,1),dryFx:string[]=[],wetFx:string[]=[];
    dry.sim.bus.on("fx",f=>dryFx.push(f.kind));wet.sim.bus.on("fx",f=>wetFx.push(f.kind));
    speed(dry,9);speed(wet,9);dry.v.tyreHeat=1;wet.v.tyreHeat=1;
    run(dry,.3,0,1,true);run(wet,.3,0,1,true);
    expect(dryFx).toContain("tyre_smoke");expect(dryFx).toContain("skid");expect(wetFx).toContain("spray");expect(wetFx).not.toContain("tyre_smoke");
  });
  it("loose surfaces throw dust without laying rubber marks",()=>{
    const f=fixture("fourby",T.SAND),fx:string[]=[];f.sim.bus.on("fx",e=>fx.push(e.kind));speed(f,6);run(f,.2,1,.4);
    expect(fx).toContain("dust");expect(fx).not.toContain("skid");expect(fx).not.toContain("tyre_smoke");
  });
});

describe("driving experience",()=>{
  it("offers Trail mode only on vehicles with offroad running gear",()=>{
    const car=fixture("hatch"),truck=fixture("patrol");
    expect([cycleDriveMode(car.v),cycleDriveMode(car.v),cycleDriveMode(car.v)]).toEqual(["sport","drift","road"]);
    expect([cycleDriveMode(truck.v),cycleDriveMode(truck.v),cycleDriveMode(truck.v)]).toEqual(["sport","drift","trail"]);
    expect(drivingSetup(truck.v).range).toBeLessThan(1);
  });
  it("changes shift points and steering balance across modes",()=>{
    const {v}=fixture();const road=drivingSetup(v);v.driveMode="drift";const drift=drivingSetup(v);
    expect(drift.shiftAt).toBeGreaterThan(road.shiftAt);expect(drift.steer).toBeGreaterThan(road.steer);
    expect(drift.tractionControl).toBe(false);expect(road.tractionControl).toBe(true);
  });
  it("blends torque during an upshift and uses hysteresis to prevent hunting",()=>{
    const {v}=fixture();const torque=stepPowertrain(v,5,17,1,1/60);
    expect(v.powertrain!.gear).toBe(2);expect(v.powertrain!.shift).toBeGreaterThan(0);expect(torque).toBeLessThan(stepPowertrain(v,5,17,1,.2));
    for(let i=0;i<120;i++)stepPowertrain(v,5,17,1,1/60);
    expect(v.powertrain!.gear).toBe(2);expect(v.powertrain!.shift).toBe(0);expect(v.powertrain!.rpm).toBeGreaterThan(2000);
  });
  it("EVs use a single forward ratio while combustion cars have reverse",()=>{
    const ev=fixture("ev"),car=fixture();
    for(let i=0;i<60;i++)stepPowertrain(ev.v,10,12,1,1/60);
    expect(ev.v.powertrain!.gear).toBe(1);
    stepPowertrain(car.v,-2,17,-1,1/60);expect(car.v.powertrain!.gear).toBe(-1);
  });
  it("banks a sustained drift and increases its multiplier",()=>{
    const {v}=fixture();v.speed=8;v.slip=3;
    for(let i=0;i<180;i++)stepDrift(v,8/60,1/60);
    expect(v.drift!.chain).toBeGreaterThan(2);expect(v.drift!.points).toBeGreaterThan(500);
    v.slip=0;for(let i=0;i<70;i++)stepDrift(v,.1,1/60);
    expect(v.drift!.best).toBeGreaterThan(500);expect(v.drift!.points).toBe(0);
  });
  it("stationary burnouts and uncontrolled spins cannot farm drift points",()=>{
    const {v}=fixture();v.speed=8;v.slip=3;
    for(let i=0;i<120;i++)stepDrift(v,0,1/60);expect(v.drift!.points).toBe(0);
    v.slip=30;for(let i=0;i<120;i++)stepDrift(v,.15,1/60);expect(v.drift!.points).toBe(0);
  });
  it("Road mode controls wheelspin while Sport mode lets the tyres spin",()=>{
    const road=fixture("muscle"),sport=fixture("muscle");sport.v.driveMode="sport";
    run(road,.4,1);run(sport,.4,1);
    expect(sport.v.wheelspin).toBeGreaterThan(road.v.wheelspin??0);
    expect(sport.v.wheelSpinTravel).toBeGreaterThan(road.v.wheelSpinTravel??0);
  });
});
