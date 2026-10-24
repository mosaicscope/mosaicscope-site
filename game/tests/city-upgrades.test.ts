import {it,expect} from 'vitest';
import {STREET_FLEET} from '../src/content/streetFleet';
import {VEHICLES,FOR_SALE} from '../src/content/vehicles';
import {fleetBody} from '../src/content/vehicleBodies';
import {CITY_CHALLENGES,startChallenge,challengeAction,updateChallenges,nextChallengeStop} from '../src/sim/CityChallenges';
import {restoreWorldFun,streetEffect} from '../src/sim/WorldFun';
import {small,byName} from './helpers';
import {makeVehicle} from '../src/sim/Traffic';
import {driveMappedVehicle} from '../src/sim/MappedTraffic';
import {chassisContact} from '../src/sim/VehicleGeometry';
import {Rng} from '../src/core/rng';
import type {Simulation} from '../src/sim/Simulation';
it('adds 700 purchasable chassis with rendered geometry, dimensions and handling',()=>{
 const rows=Object.entries(STREET_FLEET);expect(rows).toHaveLength(700);expect(new Set(rows.map(([,m])=>m.name)).size).toBe(700);
 expect(new Set(rows.map(([,m])=>[m.length,m.width,m.height,m.speed,m.wb].join(','))).size).toBe(700);
 for(const [id,m]of rows){expect(VEHICLES[id as keyof typeof VEHICLES].design).toBe(m);expect(FOR_SALE).toContain(id);expect(fleetBody(id)?.shape).toBe(m.body!.shape);expect(m.mass).toBeGreaterThan(0);}
});
it('counts unique discoveries, saves progress, and pays a challenge only once',()=>{
 const s=small(),before=s.player.cash;startChallenge(s,'spotter');for(let i=0;i<6;i++){challengeAction(s,'carspot','model'+i);challengeAction(s,'carspot','model'+i);}
 expect(s.player.cash).toBe(before+55);expect(s.worldFun.challenges?.completed).toEqual(['spotter']);expect(startChallenge(s,'spotter')).toContain('already');
 startChallenge(s,'frames');challengeAction(s,'photowalk','Colombo Street');const saved=restoreWorldFun(s.worldFun);expect(saved.challenges?.active?.seen).toEqual(['Colombo Street']);
});
it('requires real arrivals on foot for walking checkpoints',()=>{
 const s=small();expect(CITY_CHALLENGES).toHaveLength(10);startChallenge(s,'architecture');const next=nextChallengeStop(s)!;
 s.tick=30;updateChallenges(s);expect(s.worldFun.challenges?.active?.seen).toHaveLength(0);
 s.player.x=next.x;s.player.y=next.y;s.player.inCar=0;updateChallenges(s);expect(s.worldFun.challenges?.active?.seen).toHaveLength(0);
 s.player.inCar=-1;updateChallenges(s);expect(s.worldFun.challenges?.active?.seen).toHaveLength(1);
});
it('refuses missing neighbours without spending cash and records real nearby car discoveries',()=>{
 const s=small(),before=s.player.cash;expect(streetEffect(s,'sharedmeal')).toContain('Meet Aroha');expect(s.player.cash).toBe(before);
 const p=s.world.nearestFoot(50,50);s.player.x=p.x;s.player.y=p.y;makeVehicle(s,'supra',p.x+1,p.y,0,'parked');
 startChallenge(s,'spotter');expect(streetEffect(s,'carspot')).toContain('Spot a parked');expect(s.worldFun.challenges?.active?.seen).toEqual(['supra']);
 const c=byName(s,'Tiles');c.x=p.x+1;c.y=p.y;c.inside=-1;c.inCar=-1;expect(streetEffect(s,'freestyle')).toContain('Trade bars');expect(c.bubble?.text).toBeTruthy();
});
function road(){return {rng:new Rng(17),vehicles:[],tick:0,focus:{x:20,y:20},chars:[],charHash:{query:()=>0},world:{mapped:{streetSegments:[{id:1,name:'Fixture',kind:'residential',x:0,y:20,dx:1,dy:0,length:100,half:2,oneway:1,speed:8}],closedRoads:new Set()},walkable:()=>true,drivable:()=>true}} as unknown as Simulation;}
it('brakes behind a stopped chassis without overlap, including repeated ticks',()=>{
 const s=road(),follower=makeVehicle(s,'supra',15,19.05,0,'drive'),leader=makeVehicle(s,'sedan',21,19.05,0,'parked');follower.speed=8;
 for(let i=0;i<600;i++){s.tick++;follower.px=follower.x;follower.py=follower.y;driveMappedVehicle(s,follower,1/60);expect(chassisContact(follower,leader)).toBeNull();}
 expect(follower.x).toBeGreaterThan(15);expect(follower.x).toBeLessThan(20);expect(follower.speed).toBeLessThan(.1);
});
