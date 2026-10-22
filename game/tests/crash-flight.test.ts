import {describe,it,expect} from 'vitest';
import {finishFlight,flightMultiplier,type CrashFlight} from '../src/casino/flight';
const flight=():CrashFlight=>({stake:100,start:1000,bust:2,paid:false,model:0,scene:0});
describe('live crash flight settlement',()=>{
 it('pays a cash-out once and freezes the multiplier at the actual decision',()=>{const f=flight(),amount=finishFlight(f,true,3000);expect(amount).toBe(137);expect(flightMultiplier(f,900000)).toBeCloseTo(Math.exp(.32));expect(finishFlight(f,true,4000)).toBeNull();expect(finishFlight(f,false,100000)).toBeNull();});
 it('does not settle an active flight before its crash point',()=>{const f=flight();expect(finishFlight(f,false,2000)).toBeNull();expect(f.paid).toBe(false);});
 it('rejects a late cash-out and records the crash time, including while a tab was hidden',()=>{const f=flight();expect(finishFlight(f,true,20000)).toBe(0);expect(f.endedAt).toBeCloseTo(1000+Math.log(2)/.16*1000);expect(flightMultiplier(f,900000)).toBeCloseTo(2);});
 it('settles an immediate crash without paying or changing the stake',()=>{const f=flight();f.bust=1;expect(finishFlight(f,false,1000)).toBe(0);expect(f.returned).toBe(0);expect(f.stake).toBe(100);});
 it('does not grow the result when restored after a successful cash-out',()=>{const f=flight();finishFlight(f,true,2500);const restored=structuredClone(f);expect(finishFlight(restored,true,100000)).toBeNull();expect(flightMultiplier(restored,100000)).toBeCloseTo(flightMultiplier(f,2500));});
});
