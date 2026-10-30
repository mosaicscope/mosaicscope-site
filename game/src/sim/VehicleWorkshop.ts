import {handlingProfile} from './VehicleHandling';
import {damagedParts,hasPartDamage,repairParts,repairBodyZone} from './VehicleParts';
import {drivingDynamics,resetWheelDynamics} from './VehicleDynamics';
import type {Simulation} from './Simulation';
import type {Vehicle} from '../entities/types';
import {components} from './VehicleDamage';
import {propDef} from '../content/streetProps';
import {VEHICLES} from '../content/vehicles';
import {propPhysics} from '../content/propPhysics';
export const WORKSHOP_ACTIONS=[
 {id:'inspect',label:'Inspect vehicle condition',group:'Inspection',cost:0,detail:'Read actual panel, glazing, wheel and lamp condition.'},
 {id:'lamps',label:'Replace broken lamps',group:'Repairs',cost:35,detail:'Replace damaged headlamp and tail-lamp assemblies.'},
 {id:'tyre',label:'Fit a spare or replacement tyre',group:'Repairs',cost:45,detail:'Fit the selected wheel; recovered spares are used first.'},
 {id:'inflateTyre',label:'Inflate selected tyre',group:'Precision repairs',cost:5,detail:'Restore pressure in a sound tyre without replacing it.'},
 {id:'airDown',label:'Lower selected tyre pressure',group:'Precision repairs',cost:0,detail:'Lower tyre pressure one step for soft terrain; low pressure changes grip and drag.'},
 {id:'alignment',label:'Align wheels and suspension',group:'Repairs',cost:70,detail:'Correct steering pull, bent rims and suspension alignment.'},
 {id:'windscreen',label:'Replace the windscreen',group:'Repairs',cost:90,detail:'Replace front glazing while keeping the other damage.'},
 {id:'glass',label:'Replace side and rear glass',group:'Repairs',cost:65,detail:'Re-glaze the remaining panes and clear their fracture marks.'},
 {id:'bonnet',label:'Secure or replace the bonnet',group:'Repairs',cost:55,detail:'Restore its hinge, latch and attachment to this car.'},
 {id:'bumper',label:'Replace the bumper',group:'Repairs',cost:50,detail:'Refit the detached or hanging bumper.'},
 {id:'panels',label:'Straighten body panels',group:'Repairs',cost:120,detail:'Repair crumpled sheet metal, keeping mechanical damage separate.'},
 {id:'mechanical',label:'Rebuild crash-damaged mechanical systems',group:'Repairs',cost:180,detail:'Repair transmission, cooling, lubrication, brakes, fuel lines, battery, steering and axles.'},
 {id:'engine',label:'Service the damaged engine',group:'Repairs',cost:100,detail:'Repair heat damage, stop the leak and extinguish an engine fire.'},
 {id:'wash',label:'Wash the vehicle',group:'Repairs',cost:8,detail:'Clean road grime while leaving dents and rust visible.'},
 {id:'repaint',label:'Respray the vehicle',group:'Repairs',cost:80,detail:'Apply the selected paint; mechanical and crash damage remain.'},
 {id:'headlights',label:'Switch headlights',group:'Controls',cost:0,detail:'Control the real lamps and night-time road illumination.'},
 {id:'hazards',label:'Switch hazard lights',group:'Controls',cost:0,detail:'Flash the attached indicators on both sides.'},
 {id:'parkbrake',label:'Toggle the parking brake',group:'Controls',cost:0,detail:'Secure a stopped vehicle before getting out.'},
 {id:'horn',label:'Sound the horn or cycle bell',group:'Controls',cost:0,detail:'Sound this vehicle’s horn; cycles get a short bell.'},
 {id:'recoverWheel',label:'Recover a detached wheel',group:'Inspection',cost:0,detail:'Collect a real nearby crash fragment as a spare.'},
 {id:'repairProp',label:'Repair street furniture',group:'Street furniture',cost:20,detail:'Restore the selected damaged object so it can be used again.'},
 {id:'uprightProp',label:'Set the object upright',group:'Street furniture',cost:0,detail:'Stop and straighten a loose cone, trolley, chair or other movable prop.'},
 {id:'paintProp',label:'Repaint street furniture',group:'Street furniture',cost:8,detail:'Apply the selected colour to its actual connected model.'},
 {id:'mirrors',label:'Replace side mirrors',group:'Precision repairs',cost:25,detail:'Refit the mirror assemblies without repairing the doors.'},
 {id:'punctures',label:'Patch punctured tyres',group:'Precision repairs',cost:20,detail:'Patch tyres that are still attached; missing wheels need a replacement.'},
 {id:'panelFront',label:'Repair the front body panel',group:'Precision repairs',cost:35,detail:'Straighten the nose, preserving the other impact zones.'},
 {id:'panelRear',label:'Repair the rear body panel',group:'Precision repairs',cost:35,detail:'Straighten the rear bodywork without resetting the rest.'},
 {id:'panelLeft',label:'Repair the left body panel',group:'Precision repairs',cost:35,detail:'Repair the left-side sheet metal separately.'},
 {id:'panelRight',label:'Repair the right body panel',group:'Precision repairs',cost:35,detail:'Repair the right-side sheet metal separately.'},
 {id:'bumperFront',label:'Refit the front bumper',group:'Precision repairs',cost:28,detail:'Restore the front mounting points and attached bumper.'},
 {id:'bumperRear',label:'Refit the rear bumper',group:'Precision repairs',cost:28,detail:'Restore the rear bumper while leaving front damage alone.'},
 {id:'lampsFront',label:'Replace front lamps',group:'Precision repairs',cost:20,detail:'Replace just the headlamp assemblies.'},
 {id:'lampsRear',label:'Replace rear lamps',group:'Precision repairs',cost:20,detail:'Replace just the tail-lamp assemblies.'},
 {id:'signalLeft',label:'Signal left',group:'Controls',cost:0,detail:'Flash the left indicators; cancels the right signal and hazards.'},
 {id:'signalRight',label:'Signal right',group:'Controls',cost:0,detail:'Flash the right indicators; cancels the left signal and hazards.'},
 {id:'signalOff',label:'Cancel the indicators',group:'Controls',cost:0,detail:'Turn off the directional indicators and hazards.'},
 {id:'glassLeft',label:'Replace left-side glass',group:'Precision repairs',cost:24,detail:'Replace just the left-side pane and its fractures.'},
 {id:'glassRight',label:'Replace right-side glass',group:'Precision repairs',cost:24,detail:'Replace just the right-side pane and its fractures.'},
 {id:'glassRear',label:'Replace rear glass',group:'Precision repairs',cost:30,detail:'Replace the rear window separately from the windscreen.'},
 {id:'inspectProp',label:'Inspect the street object',group:'Street furniture',cost:0,detail:'Read its actual material, damage, anchoring and use count.'},
 {id:'secureProp',label:'Secure the loose object',group:'Street furniture',cost:5,detail:'Anchor a movable object so knocks cannot roll it into the road.'},
 {id:'releaseProp',label:'Release the object anchor',group:'Street furniture',cost:0,detail:'Release a temporary anchor so the object can move again.'},
 {id:'restockProp',label:'Restock the dispenser',group:'Street furniture',cost:12,detail:'Replenish a newspaper, produce or bottled-water dispenser.'},
] as const;
export type WorkshopAction=typeof WORKSHOP_ACTIONS[number]['id'];
const paint=(s:string)=>/^#[0-9a-f]{6}$/i.test(s)?s:'#688d87';
export function inspectVehicle(v:Vehicle):string[]{const p=components(v);return[
 ...(v.dynamics?['Tyres: '+v.dynamics.wheels.map((w,i)=>['FL','FR','RL','RR'][i]+' '+Math.round(w.pressure*100)+'% pressure / '+Math.round(w.wear*100)+'% wear').join(' · '), 'Wet grip: '+Math.round(v.dynamics.aquaplaning*100)+'% water-film effect · brake fade '+Math.round(v.dynamics.brakeFade*100)+'%', 'Brake wear: '+v.dynamics.wheels.map((w,i)=>['FL','FR','RL','RR'][i]+' '+Math.round((w.brakeWear??0)*100)+'%').join(' · ')]:[]),
 ...(damagedParts(v).length?['Damaged parts: '+damagedParts(v).slice(0,12).map(p=>p.name+' '+Math.round(p.damage*100)+'%').join(' · ')]:[]),
 ...(p.structure?[
 'Structure: front rail '+Math.round(p.structure.front*100)+'% · rear rail '+Math.round(p.structure.rear*100)+'% · chassis bend '+Math.round(Math.abs(p.structure.bend)*100)+'% · roof '+Math.round(p.structure.roof*100)+'%',
 'Fluids: coolant '+Math.round(p.structure.coolant*100)+'% · oil '+Math.round(p.structure.oil*100)+'% · fuel '+Math.round(p.structure.fuel*100)+'% · temperature '+Math.round(p.structure.temperature*100)+'%',
 'Mechanical: gearbox '+Math.round(p.structure.gearbox*100)+'% damaged · brake heat '+Math.round(p.structure.brakeHeat*100)+'% · brake wear '+Math.round(p.structure.brakeWear*100)+'% · doors '+p.structure.doors.map(n=>n>.6?'jammed':'openable').join(' / ')]:[]),
 ...(p.impacts??[]).slice(-4).reverse().map(hit=>'Impact: '+['front','rear','left','right'][hit.zone]+' · '+hit.severity+' · change in speed '+(hit.deltaV*7.2).toFixed(0)+' km/h'),
 'Crush: '+(p.dents?.length??0)+' local dents · suspension '+p.wheels.map((w,i)=>['FL','FR','RL','RR'][i]+' '+Math.round(w.suspension*100)+'%').join(' · '),
 'Body: '+p.panels.map((n,i)=>['front','rear','left','right'][i]+' '+Math.round(n*100)+'% damaged').join(' · '),
 'Glass: '+p.glass.map((n,i)=>['windscreen','rear','left','right'][i]+' '+Math.round(n*100)+'%').join(' · '),
 ...p.wheels.map((w,i)=>['Front left','Front right','Rear left','Rear right'][i]+': '+(w.missing?'missing':(w.attachment??1)<.65?'hanging / loose mount':w.puncture?'punctured':'inflated')+' · rim '+Math.round(w.rim*100)+'% · alignment '+Math.round(w.alignment*180/Math.PI)+'°'),
 'Lamps: '+p.lamps!.map((n,i)=>['front left','front right','rear left','rear right'][i]+' '+Math.round(n*100)+'% damaged').join(' · '),
 'Bonnet '+(p.hoodGone?'missing':p.hoodLoose?'loose':'latched')+' · bumper '+(v.bumperLost?'missing':p.bumperLoose?'loose':'attached')+' · engine '+Math.round((v.engineDamage??0)*100)+'% damaged',
 ];}
export function workshopAction(sim:Simulation,id:WorkshopAction,vehicleId=-1,propId=-1,wheel=0,colour='#688d87'):{ok:boolean;text:string}{
 const action=WORKSHOP_ACTIONS.find(a=>a.id===id);if(!action)return{ok:false,text:'Unknown workshop action.'};const c=sim.player,v=sim.vehicles[vehicleId],prop=sim.cityPlay.props.find(p=>p.id===propId),street=action.group==='Street furniture';
 if(c.phys!==0||c.inside>=0)return{ok:false,text:'You need to be outside and able to work.'};
 if(c.inCar>=0&&(street||action.group==='Repairs'||action.group==='Precision repairs'))return{ok:false,text:'Step out of the vehicle before doing repairs.'};
 if(street){if(!prop||Math.hypot(c.x-prop.x,c.y-prop.y)>2)return{ok:false,text:'Walk closer to the selected object.'};}
 else if(id!=='recoverWheel'&&(!v||Math.hypot(c.x-v.x,c.y-v.y)>3))return{ok:false,text:'Walk up to a vehicle first.'};
 if(v&&!street&&id!=='horn'&&id!=='recoverWheel'&&Math.abs(v.speed)>.3)return{ok:false,text:'Stop the vehicle before using this tool.'};
 let cost:number=action.cost;if(id==='tyre'&&sim.cityPlay.workshop.spares>0)cost=0;
 if(c.cash<cost)return{ok:false,text:'You need $'+cost+' in game cash.'};
 const p=v?components(v):undefined;let pose='repair',text=action.label+'.';
 const unchanged=()=>({ok:false,text:'That part is already in good condition. No charge.'});
 switch(id){
 case 'mirrors':if(!p!.mirrors!.some(n=>n>0)&&!v!.mirrorLost)return unchanged();p!.mirrors!.fill(0);v!.mirrorLost=false;break;
 case 'inflateTyre':case 'airDown':{const n=Math.floor(wheel);if(!Number.isFinite(n)||n<0||n>3||handlingProfile(v!.cls).twoWheeler&&n%2===1)return{ok:false,text:'Choose an existing wheel.'};const w=p!.wheels[n];if(w.missing||w.puncture)return{ok:false,text:'Repair or replace that tyre first.'};const pressure=v!.dynamics?.wheels[n]?.pressure??1;if(id==='inflateTyre'&&pressure>=.99||id==='airDown'&&pressure<=.6)return unchanged();const d=drivingDynamics(v!);d.wheels[n].pressure=id==='inflateTyre'?1:Math.max(.6,Math.round((pressure-.1)*10)/10);text='Selected tyre pressure is '+Math.round(d.wheels[n].pressure*100)+'%.';break;}
 case 'punctures':if(!p!.wheels.some(w=>w.puncture&&!w.missing))return unchanged();for(let i=0;i<p!.wheels.length;i++){const w=p!.wheels[i];if(!w.missing&&w.puncture){w.puncture=false;resetWheelDynamics(v!,i,false);}};v!.flatLeft=p!.wheels[0].puncture||p!.wheels[2].puncture;v!.flatRight=p!.wheels[1].puncture||p!.wheels[3].puncture;break;
 case 'panelFront':case 'panelRear':case 'panelLeft':case 'panelRight':{const n=['panelFront','panelRear','panelLeft','panelRight'].indexOf(id),key=(['dmgF','dmgR','dmgL','dmgS'] as const)[n];if(!p!.panels[n]&&!v![key])return unchanged();p!.panels[n]=0;repairBodyZone(v!,n);p!.dents=p!.dents?.filter(d=>d.zone!==n);v![key]=0;v!.damage=Math.min(v!.damage,Math.max(...p!.panels,v!.engineDamage??0));break;}
 case 'bumperFront':case 'bumperRear':{const n=id==='bumperFront'?0:1;if(p!.bumpers![n]>=1)return unchanged();p!.bumpers![n]=1;p!.bumper=Math.min(...p!.bumpers!);p!.bumperLoose=p!.bumper<.6;v!.bumperLost=p!.bumper===0;break;}
 case 'lampsFront':case 'lampsRear':{const n=id==='lampsFront'?0:2;if(!p!.lamps!.slice(n,n+2).some(n=>n>0))return unchanged();p!.lamps!.fill(0,n,n+2);break;}
 case 'glassLeft':case 'glassRight':case 'glassRear':{const n=id==='glassLeft'?2:id==='glassRight'?3:1;if(!p!.glass[n])return unchanged();p!.glass[n]=0;v!.glassDamage=Math.max(...p!.glass);break;}
 case 'signalLeft':case 'signalRight':v!.indicator=id==='signalLeft'?'left':'right';v!.hazards=false;pose='press';break;
 case 'signalOff':v!.indicator=undefined;v!.hazards=false;pose='press';break;
 case 'inspectProp':return{ok:true,text:propDef(prop!.kind).name+' · '+propPhysics(propDef(prop!.kind).model).material+' · '+Math.round(prop!.health*100)+'% condition · '+(propDef(prop!.kind).fixed?'permanently fixed':prop!.secured?'temporarily secured':'movable')+' · '+(prop!.uses??0)+' uses · stock '+(prop!.stock??20)};
 case 'secureProp':if(propDef(prop!.kind).fixed)return{ok:false,text:'This object already has permanent foundations.'};if(prop!.secured)return unchanged();prop!.secured=true;prop!.vx=prop!.vy=prop!.vz=prop!.spin=prop!.z=0;break;
 case 'releaseProp':if(!prop!.secured)return{ok:false,text:'There is no temporary anchor to release.'};prop!.secured=false;break;
 case 'restockProp':if(!['newspaper_box','market_stall','water_cooler'].includes(prop!.kind))return{ok:false,text:'This object has no consumable stock.'};if((prop!.stock??20)>=20)return unchanged();prop!.stock=20;pose='give';break;
 case 'inspect':return{ok:true,text:inspectVehicle(v!).join('\n')};
 case 'lamps':if(!p!.lamps!.some(n=>n>0))return unchanged();p!.lamps!.fill(0);text='New lamp assemblies are fixed into the body mounts.';break;
 case 'tyre':{const n=Math.floor(wheel);if(n<0||n>3)return{ok:false,text:'Choose a wheel.'};const w=p!.wheels[n];if(!w.missing&&!w.puncture&&(w.attachment??1)>=.99&&w.rim===0&&(v!.dynamics?.wheels[n]?.pressure??1)>.99&&(v!.dynamics?.wheels[n]?.wear??0)<.01)return unchanged();if(sim.cityPlay.workshop.spares>0)sim.cityPlay.workshop.spares--;Object.assign(w,{missing:false,puncture:false,rim:0,alignment:0,suspension:0,attachment:1});resetWheelDynamics(v!,n,true);v!.flatLeft=p!.wheels[0].puncture||p!.wheels[2].puncture;v!.flatRight=p!.wheels[1].puncture||p!.wheels[3].puncture;text='The selected wheel is securely fitted and inflated.';break;}
 case 'alignment':if(!p!.wheels.some(w=>w.alignment||w.rim||w.suspension||!w.missing&&(w.attachment??1)<1))return unchanged();for(const w of p!.wheels){w.alignment=0;w.rim=0;w.suspension=0;if(!w.missing)w.attachment=1;}v!.steerAngle=0;break;
 case 'windscreen':if(!p!.glass[0])return unchanged();p!.glass[0]=0;v!.glassDamage=Math.max(...p!.glass);break;
 case 'glass':if(!p!.glass.slice(1).some(n=>n>0))return unchanged();p!.glass.fill(0,1);v!.glassDamage=p!.glass[0];break;
 case 'bonnet':if(!p!.hoodLoose&&!p!.hoodGone&&p!.hood===1)return unchanged();p!.hood=1;p!.hoodLoose=false;p!.hoodGone=false;break;
 case 'bumper':if(!v!.bumperLost&&!p!.bumperLoose&&p!.bumper===1)return unchanged();v!.bumperLost=false;p!.bumper=1;p!.bumpers!.fill(1);p!.bumperLoose=false;break;
 case 'panels':if(!p!.panels.some(n=>n>0)&&!v!.damage&&!p!.doorGone?.some(Boolean)&&!p!.doorHinges?.some(n=>n<1)&&(p!.boot??1)>=1&&!p!.bootGone&&!hasPartDamage(v!,['body']))return unchanged();p!.panels.fill(0);p!.doorHinges=undefined;p!.doorGone=undefined;p!.boot=undefined;p!.bootGone=undefined;repairParts(v!,'body');p!.dents=[];if(p!.structure)Object.assign(p!.structure,{front:0,rear:0,bend:0,twist:0,intrusion:[0,0],roof:0,doors:[0,0],aero:0});p!.mirrors!.fill(0);v!.mirrorLost=false;v!.dmgF=v!.dmgR=v!.dmgL=v!.dmgS=0;v!.damage=Math.max(v!.engineDamage??0,...p!.wheels.map(w=>w.missing?.4:w.puncture?.12:0))*.5;break;
 case 'mechanical':{const s=p!.structure,brakes=v!.dynamics?.wheels;if(!p!.underbody&&!hasPartDamage(v!,['mechanical','wheel'])&&!brakes?.some(w=>(w.brakeWear??0)>.001||w.brakeHeat>.05)&&(!s||![s.radiator,s.sump,s.exhaust,s.gearbox,s.rack,...s.axles,...s.hydraulics,s.battery,s.tank,1-s.coolant,1-s.oil,1-s.fuel,s.temperature,s.brakeHeat,s.brakeWear].some(n=>n>0)))return unchanged();repairParts(v!,'mechanical');repairParts(v!,'wheel');p!.underbody=undefined;if(brakes)for(const w of brakes){w.brakeWear=0;w.brakeHeat=0;}if(s)Object.assign(s,{radiator:0,sump:0,exhaust:0,gearbox:0,rack:0,axles:[0,0],hydraulics:[0,0],battery:0,tank:0,coolant:1,oil:1,fuel:1,temperature:0,brakeHeat:0,brakeWear:0,hop:0,hopVelocity:0});break;}
 case 'engine':if(!v!.engineDamage&&!v!.burning&&!v!.burnt&&!v!.leak)return unchanged();v!.engineDamage=0;v!.engineRepaired=true;v!.burning=false;v!.burnt=false;v!.burnTime=0;v!.heat=0;v!.leak=0;break;
 case 'wash':if(v!.cleaned&&!p!.blood?.length)return unchanged();p!.blood=[];v!.cleaned=true;pose='clean';text='Road grime washed off. Physical damage still needs repairs.';break;
 case 'repaint':v!.color=paint(colour);v!.resprayed=true;pose='clean';break;
 case 'headlights':v!.lights=!(v!.lights??sim.isDark);pose='press';text='Headlights '+(v!.lights?'on.':'off.');break;
 case 'hazards':v!.hazards=!v!.hazards;pose='press';text='Hazard lights '+(v!.hazards?'on.':'off.');break;
 case 'parkbrake':v!.parkingBrake=!v!.parkingBrake;pose='press';text='Parking brake '+(v!.parkingBrake?'engaged.':'released.');break;
 case 'horn':{if(sim.tick-v!.honkAt<0)return{ok:false,text:'Give the horn a moment.'};const body=VEHICLES[v!.cls].design?.base??v!.cls,cycle=['bicycle','ebike','escooter'].includes(body);sim.bus.emit('sound',{kind:cycle?'coin':'horn',x:v!.x,y:v!.y,vol:cycle?.35:.6});v!.honkAt=sim.tick+60;pose='press';text=cycle?'Ring-ring.':'A short horn sounds from this vehicle.';break;}
 case 'recoverWheel':{if(sim.cityPlay.workshop.spares>=20)return{ok:false,text:'Your spare storage is full.'};let found=false;for(const car of sim.vehicles){const i=car.components?.debris.findIndex(d=>d.kind==='wheel'&&Math.hypot(d.x-c.x,d.y-c.y)<2)??-1;if(i<0)continue;car.components!.debris.splice(i,1);sim.cityPlay.workshop.spares++;found=true;break;}if(!found)return{ok:false,text:'There is no detached wheel within reach.'};pose='give';text='Recovered a wheel. It is stored as a spare.';break;}
 case 'repairProp':if(prop!.health>=1)return unchanged();prop!.health=1;prop!.vx=prop!.vy=prop!.vz=prop!.spin=0;prop!.z=0;break;
 case 'uprightProp':if(propDef(prop!.kind).fixed)return{ok:false,text:'This object is fixed to the ground.'};prop!.turn=0;prop!.z=0;prop!.vx=prop!.vy=prop!.vz=prop!.spin=0;pose='shove';break;
 case 'paintProp':prop!.colour=paint(colour);pose='clean';break;
 }
 c.cash-=cost;c.anim.pose=pose;c.anim.poseT=0;sim.cityPlay.workshop.until=sim.tick+150;sim.cityPlay.workshop.pose=pose;
 return{ok:true,text:text+(cost?' −$'+cost:'')};
}
export function updateWorkshopMotion(sim:Simulation):void{const w=sim.cityPlay.workshop,c=sim.player;if(!w.pose)return;if(sim.tick<w.until&&Math.hypot(c.vx,c.vy)<.2&&c.inCar<0&&c.phys===0)c.anim.pose=w.pose;else{if(c.anim.pose===w.pose)c.anim.pose='auto';w.pose='';w.until=0;}}
