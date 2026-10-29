import {describe,it,expect} from 'vitest';
import {small} from './helpers';
import {Phys} from '../src/entities/types';
import {updatePhysState} from '../src/physics/combat';

describe('impact recovery',()=>{
 it('does not stand up while sliding or airborne, then recovers when motion settles',()=>{
  const c=small(1).player;c.phys=Phys.DOWN;c.physTimer=.01;c.kx=4;c.ky=0;c.vz=0;updatePhysState(c,.1);expect(c.phys).toBe(Phys.DOWN);
  c.kx=0;c.vz=-4;updatePhysState(c,.2);expect(c.phys).toBe(Phys.DOWN);
  c.vz=0;updatePhysState(c,.2);expect(c.phys).toBe(Phys.RECOVER);
 });
});
