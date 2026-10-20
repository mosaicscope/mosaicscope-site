import {hitFacade} from './CivicDamage';
import type {Simulation} from './Simulation';
export function launchRocket(sim:Simulation,id:number,x:number,y:number):string {
 const order=sim.commerce.purchases.find(o=>o.id===id&&o.sku==='defense:launcher');
 if(!order||!sim.world.buildings[order.building])return 'No launcher at this address.';
 if(!Number.isFinite(x+y)||x<1||y<1||x>=sim.world.size-1||y>=sim.world.size-1)return 'Choose a target inside the game map.';
 if(order.flight)return 'Launcher is already firing.';
 if(sim.player.cash<1000)return 'A game rocket costs $1,000.';
 sim.player.cash-=1000;order.target={x,y};order.flight={at:sim.tick,until:sim.tick+240,x,y};
 sim.bus.emit('sound',{kind:'cannon',x:sim.world.buildings[order.building].door.x,y:sim.world.buildings[order.building].door.y,vol:.7});
 return 'Game rocket launched. Bystanders will react to the impact; medical and repair systems remain active.';
}
export function updateRockets(sim:Simulation):void {
 for(const order of sim.commerce.purchases){const f=order.flight;if(!f||sim.tick<f.until)continue;order.flight=undefined;hitFacade(sim,{cls:"tank",driver:sim.playerId,damage:0},f.x,f.y,4);
  const shell=sim.spawnToy('cannonball',f.x,f.y);if(shell){shell.state='flying';shell.z=.45;shell.vx=shell.vy=0;shell.vz=-2;shell.thrower=sim.playerId;shell.owner=sim.playerId;}
 }
}
