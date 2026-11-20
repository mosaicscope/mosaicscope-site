import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {VEHICLES,type VehicleClass} from '../src/content/vehicles';
import {makeVehicle} from '../src/sim/Traffic';
import {vehicleBodyShape,bonnetSection} from '../src/sim/VehicleBodyShape';
import {vehicleGeometry} from '../src/sim/VehicleGeometry';
import {components} from '../src/sim/VehicleDamage';
import {vehicleDeformer} from '../src/render/VehicleMesh';

describe('catalogue crash geometry',()=>{
 it('keeps engine bays nonzero and combined deformation bounded for all car models',()=>{
  const sim=small(3),v=makeVehicle(sim,'sedan',40,40,0,'free');
  for(const cls of Object.keys(VEHICLES) as VehicleClass[]){v.cls=cls;const g=vehicleGeometry(v),s=vehicleBodyShape(v),[a,b]=bonnetSection(s,g.length);expect(b-a,cls).toBeGreaterThan(0);const p=components(v);p.dents=[{zone:0,x:.45,y:0,z:.5,nx:1,ny:0,depth:.34,radius:.35,energy:1}];const f=vehicleDeformer(v,g.length,g.width,g.height)!;const sample:[number,number,number]=[g.length*.45,0,g.height*.5],q=f(sample);expect(q.every(Number.isFinite),cls).toBe(true);expect(Math.abs(q[0]-sample[0]),cls).toBeLessThanOrEqual(g.length*.40001);}
 });
});
