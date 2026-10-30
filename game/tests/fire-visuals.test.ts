import {expect,it} from 'vitest';
import {fireVisualProfile} from '../src/render/FireVisuals';
it('has 580 distinct and deterministic fire and smoke profiles',()=>{
 const profiles=Array.from({length:580},(_,i)=>fireVisualProfile(i));
 expect(new Set(profiles.map(p=>p.flameShape+':'+p.smokeStyle)).size).toBe(580);
 expect(fireVisualProfile(580)).toEqual(fireVisualProfile(0));
 expect(fireVisualProfile(0,true).core).not.toBe(fireVisualProfile(0).core);
});
