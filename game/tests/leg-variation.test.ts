import {expect,it} from 'vitest';
import {pose,applyLegVariation} from '../src/render/StickFigure';
it('creates distinct walking leg variations and a seated floor pose',()=>{
 const values=new Set<string>();for(let i=0;i<400;i++){const a=pose('walk','loose',1,.7,2,0);applyLegVariation(a,i,'walk',.7);values.add([a.thighL,a.bendL].map(n=>n.toFixed(5)).join(','));}
 expect(values.size).toBe(400);const sitting=pose('sitfloor','loose',1,0,0,0);expect(sitting.bob).toBeGreaterThan(20);expect(sitting.thighL).toBeGreaterThan(1);expect(sitting.thighR).toBeLessThan(-1);
});
