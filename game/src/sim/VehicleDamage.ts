import type { Vehicle } from "../entities/types";
export function damageParts(v: Vehicle): void {
  const f=v.dmgF??0, r=v.dmgR??0, l=v.dmgL??0, s=v.dmgS??0;
  v.engineDamage=Math.max(v.engineDamage??0, f*0.9);
  v.glassDamage=Math.max(v.glassDamage??0, Math.max(f,r)*0.95);
  if (l>0.6) v.flatLeft=true;
  if (s>0.6) v.flatRight=true;
  v.bumperLost=!!v.bumperLost || Math.max(f,r)>0.82;
  v.mirrorLost=!!v.mirrorLost || Math.max(l,s)>0.7;
  v.leak=Math.max(v.leak??0,Math.max(0,f-0.5));
}
/** Heat rises only while badly damaged engines run; stopping prevents escalation. */
export function damageTick(v: Vehicle, dt: number): void {
  if (v.burnt) { v.burntAge = (v.burntAge ?? 0) + dt; return; }
  damageParts(v);
  const running=v.driver>=0 && Math.abs(v.speed)>0.5;
  v.heat=Math.max(0,Math.min(1,(v.heat??0)+(running && (v.engineDamage??0)>0.65 ? dt*0.015 : -dt*0.02)));
  if ((v.heat??0)>=1) v.burning=true;
  if (v.burning) { v.damage=Math.min(1,v.damage+dt*0.025); v.burnTime=(v.burnTime??0)+dt; }
  if ((v.burnTime??0)>12) { v.burnt=true; v.burning=false; v.damage=1; v.speed=0; v.vx=0; v.vy=0; }
}
export function repairVehicle(v: Vehicle): void {
  v.damage=0; v.dmgF=0; v.dmgR=0; v.dmgL=0; v.dmgS=0;
  v.engineDamage=0; v.glassDamage=0; v.flatLeft=false; v.flatRight=false;
  v.bumperLost=false; v.mirrorLost=false; v.leak=0; v.heat=0; v.burning=false; v.burnTime=0; v.burnt=false; v.burntAge=0; v.towAt=undefined;
}
