import {latticeFailure} from './CrashLattice';
import {partsEffects} from './VehicleParts';
import type {Vehicle} from '../entities/types';
import type {MeshPoint} from '../render/VehicleMesh';
/** Allocated only after impact or active braking. All quantities are normalized and persist in saves. */
export interface VehicleStructure {
 front:number;rear:number;bend:number;twist:number;intrusion:number[];roof:number;doors:number[];
 radiator:number;sump:number;exhaust:number;gearbox:number;rack:number;axles:number[];
 hydraulics:number[];battery:number;tank:number;aero:number;coolant:number;oil:number;fuel:number;
 temperature:number;brakeHeat:number;brakeWear:number;hop:number;hopVelocity:number;
}
const sat=(n:number)=>Math.max(0,Math.min(1,n));
export function structure(v:Vehicle):VehicleStructure{return v.components!.structure??={front:0,rear:0,bend:0,twist:0,intrusion:[0,0],roof:0,doors:[0,0],radiator:0,sump:0,exhaust:0,gearbox:0,rack:0,axles:[0,0],hydraulics:[0,0],battery:0,tank:0,aero:0,coolant:1,oil:1,fuel:1,temperature:0,brakeHeat:0,brakeWear:0,hop:0,hopVelocity:0};}
/** Crumple rails absorb light impacts; mechanical failures require meaningful crush energy. */
export function crushStructure(v:Vehicle,zone:number,energy:number,x:number,y:number):void{
 if(energy<.035)return;const p=structure(v),e=Math.max(0,energy-.035),front=zone===0,rear=zone===1,side=zone>=2,which=y>=0?1:0,deep=Math.max(0,e-.18);
 if(front)p.front=sat(p.front+e*.65);if(rear)p.rear=sat(p.rear+e*.55);
 p.bend=Math.max(-1,Math.min(1,p.bend+(side?(zone===3?1:-1):y*2)*deep*.35));
 p.twist=Math.max(-1,Math.min(1,p.twist+(x>=0?1:-1)*(y>=0?1:-1)*deep*.22));
 if(side){p.intrusion[which]=sat(p.intrusion[which]+deep*.7);p.doors[which]=sat(p.doors[which]+e*.8);}
 p.roof=sat(p.roof+Math.max(0,deep-.3)*(side?.6:.25));
 if(front){p.radiator=sat(p.radiator+deep*.9);p.sump=sat(p.sump+deep*.55);p.rack=sat(p.rack+deep*.7);p.battery=sat(p.battery+deep*.8);}
 if(rear){p.exhaust=sat(p.exhaust+e*.7);p.tank=sat(p.tank+deep*.6);}
 p.gearbox=sat(p.gearbox+deep*(front?.45:.2));
 const axle=x>=0?0:1;p.axles[axle]=sat(p.axles[axle]+deep*.55);
 p.hydraulics[which]=sat(p.hydraulics[which]+deep*.65);
 p.aero=sat(p.aero+e*.3);p.hopVelocity=Math.min(1.5,p.hopVelocity+deep*.7);
}
/** Fixed-cost fluid, temperature and damped chassis response; no particles or global entity scans. */
export function tickStructure(v:Vehicle,dt:number):void{
 const p=v.components?.structure;if(!p||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.25,dt);
 const running=v.driver>=0&&!v.burnt,load=Math.min(1,Math.abs(v.driveThrottle??0));
 p.coolant=sat(p.coolant-dt*Math.max(0,p.radiator-.2)*.012);
 p.oil=sat(p.oil-dt*Math.max(0,p.sump-.25)*.008);
 p.fuel=sat(p.fuel-dt*Math.max(0,p.tank-.35)*.006);
 const heat=running?(1-p.coolant)*(.025+load*.025)+p.radiator*.008+partsEffects(v).cooling*.012:.0;
 p.temperature=sat(p.temperature+dt*(heat-.008*(p.coolant+.2)));
 if(running&&p.oil<.3)v.engineDamage=sat((v.engineDamage??0)+dt*(.3-p.oil)*.025);
 const decay=Math.exp(-dt*2),w=Math.sqrt(31),a=p.hop,b=(p.hopVelocity+2*a)/w,co=Math.cos(w*dt),si=Math.sin(w*dt);p.hop=decay*(a*co+b*si);p.hopVelocity=decay*((b*w-2*a)*co-(a*w+2*b)*si);
}
export function brakeThermals(v:Vehicle,speed:number,braking:number,dt:number):void{
 // Healthy cars gain thermal state only while braking at meaningful road speed.
 if(!v.components?.structure&&(!braking||Math.abs(speed)<2))return;
 if(!v.components)return;const p=structure(v),work=Math.abs(speed)*Math.max(0,braking);
 p.brakeHeat=sat(p.brakeHeat+dt*(work*.035-.045-Math.abs(speed)*.003));
 p.brakeWear=sat(p.brakeWear+dt*work*.000015);
}
const HEALTHY={power:1,braking:1,steer:1,pull:0,brakePull:0,drag:0,grip:1,shift:0,lights:true};
export function structuralDynamics(v:Vehicle){const p=v.components?.structure;if(!p)return HEALTHY;const frame=latticeFailure(v.components?.lattice);
 return{power:Math.max(.08,(1-p.exhaust*.18)*(1-p.gearbox*.35)*(1-p.temperature*.65)*(p.oil<.15?.3:1)*(p.fuel<.02?.1:1)),
 braking:Math.max(.2,(1-(p.hydraulics[0]+p.hydraulics[1])*.32)*(1-Math.max(0,p.brakeHeat-.6)*.85)*(1-p.brakeWear*.3)),
 steer:(1-p.rack*.45)*(1-frame*.12),pull:p.bend*.06,brakePull:(p.hydraulics[1]-p.hydraulics[0])*.06,
 drag:p.aero*.6+(p.front+p.rear)*.18+(p.axles[0]+p.axles[1])*.3,
 grip:Math.max(.45,1-(p.axles[0]+p.axles[1])*.13-Math.abs(p.twist)*.12-Math.abs(p.hop)*2-frame*.1),shift:p.gearbox*.3,lights:p.battery<.8};}
/** Permanent rail shortening, lateral bend, torsion, cabin intrusion and roof buckling. */
export function deformStructure(p:VehicleStructure,q:MeshPoint,L:number,W:number,H:number):MeshPoint{
 const [x,y,z]=q,u=x/L,t=y/W,roof=Math.max(0,(z/H-.5)*2),end=Math.max(0,(Math.abs(u)-.15)/.35);
 return[x-Math.sign(x)*(x>0?p.front:p.rear)*L*.13*end,y+p.bend*L*.035*u*u-Math.sign(y)*p.intrusion[y>0?1:0]*W*.16*Math.max(0,1-Math.abs(u)*3)*Math.min(1,z/H),Math.max(.035,z+p.twist*t*u*H*.3-p.roof*H*.2*roof)];
}
