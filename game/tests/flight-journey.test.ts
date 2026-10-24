import {describe,it,expect} from 'vitest';
import {finishFlight,flightPreferences,flightInstruments,recordFlight,FLIGHT_ROUTES,type CrashFlight} from '../src/casino/flight';
import {restoreCityPlay,newCityPlay} from '../src/sim/CityPlay';
const flight=():CrashFlight=>({stake:100,start:1000,bust:4,paid:false,model:3,scene:8,rate:.085,autoCash:2});
describe('Crash Flight journey and settlement controls',()=>{
 it('settles a preselected auto cash-out exactly once, including after a hidden tab',()=>{const f=flight();expect(finishFlight(f,false,1000000)).toBe(200);expect(f.endedAt).toBeCloseTo(1000+Math.log(2)/.085*1000);expect(f.outcome).toBe('landed');expect(finishFlight(f,true,1000001)).toBeNull();});
 it('loses when a random endpoint occurs before or at the auto target',()=>{for(const bust of[1,1.4,2]){const f={...flight(),bust};expect(finishFlight(f,false,1000000)).toBe(0);expect(f.outcome).toBe('crashed');expect(f.cashMultiplier).toBe(bust);}});
 it('allows a manual cash-out before the auto target and freezes that actual multiplier',()=>{const f=flight(),at=3000;expect(finishFlight(f,true,at)).toBe(Math.floor(100*Math.exp(.17)));expect(f.endedAt).toBe(at);});
 it('keeps free practice visibly successful without creating chips',()=>{const f={...flight(),stake:0,practice:true};expect(finishFlight(f,false,100000)).toBe(0);expect(f.outcome).toBe('landed');expect(recordFlight(f).practice).toBe(true);});
 it('preserves all nine route options, new timing and bounded journal after restoring a save',()=>{const raw=newCityPlay();raw.casino.flight=flight();raw.casino.flightHistory=Array.from({length:60},()=>({...recordFlight(flight()),multiplier:2,outcome:'landed'}));const restored=restoreCityPlay(raw);expect(restored.casino.flight?.scene).toBe(8);expect(restored.casino.flight?.rate).toBe(.085);expect(restored.casino.flightHistory).toHaveLength(40);expect(FLIGHT_ROUTES).toHaveLength(9);});
 it('normalizes invalid preferences and keeps the cosmetic journey continuous',()=>{expect(flightPreferences({autoCash:Infinity,favouriteScene:100})).toMatchObject({autoCash:1000,favouriteScene:8});const a=flightInstruments(5),b=flightInstruments(15),c=flightInstruments(60);expect(b.distance).toBeGreaterThan(a.distance);expect(b.altitude).toBeGreaterThan(a.altitude);expect(c.speed).toBeLessThanOrEqual(790);expect(c.phase).toBe('CRUISE');});
});
