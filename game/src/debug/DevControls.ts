import {VEHICLES,type VehicleClass} from '../content/vehicles';
import {makeVehicle} from '../sim/Traffic';
import {vehicleGeometry} from '../sim/VehicleGeometry';
import {useSubstance,type SubstanceKind} from '../sim/Substances';
import {triggerStreetIncident,STREET_KINDS,type StreetKind} from '../sim/StreetLife';
import type {Simulation} from '../sim/Simulation';
import type {Renderer} from '../render/Renderer';
import {h} from '../ui/dom';
import {TOYS} from '../content/toys';
import {wound} from '../sim/Life';
import {TICKS_PER_HOUR} from '../sim/Environment';
export interface DevControlHost{selected():number;setSpeed(n:number):void;step():void;setQuality(q:string):void;toast(t:string):void}
export function devControls(sim:()=>Simulation,renderer:Renderer,ctl:DevControlHost):HTMLElement{
 let selected=false;const updates:(()=>void)[]=[];
 const target=()=>{const s=sim();return selected?s.chars[ctl.selected()]??s.player:s.player;};
 const button=(text:string,fn:()=>void)=>h('button.btn',{type:'button',text,onclick:fn});
 const group=(title:string,kids:HTMLElement[],open=false)=>h('details.dev-section',{open},[h('summary',{text:title}),h('div.dev-controls',null,kids)]);
 const range=(label:string,min:number,max:number,step:number,read:()=>number,change:(n:number)=>void)=>{const input=h('input',{type:'range',min,max,step,value:read(),'aria-label':label,oninput:(e:Event)=>change(+(e.target as HTMLInputElement).value)}) as HTMLInputElement;updates.push(()=>{if(document.activeElement!==input)input.value=String(read());});return h('label',null,[label,input]);};
 const equip=(id:string)=>{const s=sim(),c=target();if(!TOYS[id])return;if(c.hand>=0)s.dropHeld(c);const t=s.spawnToy(id,c.x,c.y);if(!t)return;s.pickupToy(c,t);const combat=c.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};combat.ammo[id==='golden_pistol'?'pistol':id]=250;combat.load='standard';combat.reloadUntil=0;combat.magUsed={};c.weaponAction=undefined;ctl.toast(`${c.name}: ${TOYS[id].name} equipped`);};
 const heal=()=>{const s=sim(),c=target();c.substances=undefined;c.wounds=[];c.blood=1;c.bleed=0;c.phys=0;c.stunUntil=0;c.emo.composure=1;c.emo.fear=0;c.emo.frustration=0;c.needs.energy=1;s.pendingAmbulance.delete(c.id);ctl.toast(`${c.name}: restored`);};
 const hour=(v:number)=>{const s=sim();s.env.startHour=((Math.max(0,Math.min(23.99,v))-s.tick/TICKS_PER_HOUR)%24+24)%24;};
 const weapon=h('select',{'aria-label':'Developer equipment'},Object.entries(TOYS).filter(([id,d])=>id!=='fists'&&!!d.weapon).map(([id,d])=>h('option',{value:id,text:d.name}))) as HTMLSelectElement;
 const count=h('input',{type:'number',min:1,max:1000,value:50,'aria-label':'NPC spawn count'}) as HTMLInputElement;
 const output=h('output.dev-output',{'aria-live':'polite',text:'Commands: help · pause · resume · speed 2 · spawn 50 · give pistol · heal · cash 1000 · time 18'});
 const command=h('input',{type:'text','aria-label':'Developer command',placeholder:'Enter a command…',autocomplete:'off',spellcheck:'false'}) as HTMLInputElement;
 const run=()=>{const [name,arg]=command.value.trim().toLowerCase().split(/\s+/),n=Number(arg);let result='Command applied';
  if(name==='help')result='pause | resume | speed 0/1/2/4 | spawn 1–1000 | give item_id | effect alcohol/stimulant/cannabis/sedative | scene meetup/dispute/protection/nightlife/intoxication/police/truce/turf | heal | cash amount | time 0–24 | focus';
  else if(name==='effect'&&['alcohol','stimulant','cannabis','sedative'].includes(arg))result=useSubstance(sim(),target(),arg as SubstanceKind)?'Effect started on target':'Target is busy or receiving medical help';
  else if(name==='scene'&&STREET_KINDS.includes(arg as StreetKind)){const e=triggerStreetIncident(sim(),arg as StreetKind);result=e?`${e.title} · ${e.area}`:'No free crew or scene budget available';}
  else if(name==='pause')ctl.setSpeed(0);else if(name==='resume')ctl.setSpeed(1);
  else if(name==='speed'&&[0,1,2,4].includes(n))ctl.setSpeed(n);
  else if(name==='spawn'&&Number.isFinite(n)&&n>=1&&n<=1000){const s=sim();s.spawnNpcAt(s.player.x,s.player.y,n);}
  else if(name==='give'&&TOYS[arg]?.portable)equip(arg);else if(name==='heal')heal();
  else if(name==='cash'&&Number.isFinite(n)&&n>=0&&n<=1e7)target().cash=n;
  else if(name==='time'&&Number.isFinite(n)&&n>=0&&n<24)hour(n);
  else if(name==='focus'){const c=target();renderer.cam.follow=c.id;renderer.cam.lookAt(c.x,c.y,true);}
  else result='Unknown command or value. Type help.';
  output.textContent=`> ${command.value}\n${result}`;command.value='';
 };
 const carSelect=h('select',{'aria-label':'Car model to spawn'}) as HTMLSelectElement;
 const carSearch=h('input',{type:'search','aria-label':'Search car models',placeholder:'Search cars by name or ID'}) as HTMLInputElement;
 const options=Object.entries(VEHICLES).sort((a,b)=>a[1].name.localeCompare(b[1].name));
 const filterCars=()=>{const term=carSearch.value.trim().toLowerCase(),previous=carSelect.value;carSelect.replaceChildren(...options.filter(([id,d])=>(id+' '+d.name).toLowerCase().includes(term)).map(([id,d])=>h('option',{value:id,text:d.name+' · '+id})));if([...carSelect.options].some(o=>o.value===previous))carSelect.value=previous;};
 carSearch.addEventListener('input',filterCars);filterCars();
 const spawnCar=()=>{const s=sim(),id=carSelect.value as VehicleClass,def=VEHICLES[id];if(!def){ctl.toast('Choose a car model first');return;}
  const p=s.player,radius=Math.hypot(def.length,def.width)*.55;
  for(let distance=3;distance<=20;distance+=1)for(let i=0;i<24;i++){const angle=i*Math.PI/12,x=p.x+Math.cos(angle)*distance,y=p.y+Math.sin(angle)*distance;
   if(!s.world.drivable(x,y)||!s.world.drivable(x+radius,y)||!s.world.drivable(x-radius,y)||!s.world.drivable(x,y+radius)||!s.world.drivable(x,y-radius))continue;
   if(s.vehicles.some(v=>Math.hypot(v.x-x,v.y-y)<radius+vehicleGeometry(v).radius+.5)||s.chars.some(c=>c.inCar<0&&c.inside<0&&Math.hypot(c.x-x,c.y-y)<radius+.5))continue;
   makeVehicle(s,id,x,y,0,'parked');ctl.toast(def.name+' spawned nearby');return;
  }ctl.toast('No clear road space nearby; move to an open street');
 };
 const quality=h('select',{'aria-label':'Developer render quality',onchange:(e:Event)=>ctl.setQuality((e.target as HTMLSelectElement).value)},['auto','low','medium','high','ultra'].map(q=>h('option',{value:q,text:q}))) as HTMLSelectElement;
 const panel=h('div.dev-workbench',null,[
  group('Simulation & performance',[h('div.row',null,[button('Pause',()=>ctl.setSpeed(0)),button('1×',()=>ctl.setSpeed(1)),button('2×',()=>ctl.setSpeed(2)),button('4×',()=>ctl.setSpeed(4)),button('Step one tick',()=>ctl.step())]),h('label',null,['Render quality',quality]),range('World zoom',.55,7,.05,()=>renderer.cam.targetZoom,n=>renderer.cam.setZoom(n))],true),
  group('Car spawner',[h('label',null,['Search models',carSearch]),h('label',null,['Vehicle',carSelect]),button('Spawn car nearby',spawnCar),h('p',{text:'Spawns an unoccupied car in clear road space near the player.'})],true),
  group('Crowd stress tools',[h('label',null,['NPC count',count]),button('Spawn across nearby streets',()=>{const s=sim();s.spawnNpcAt(s.player.x,s.player.y,+count.value);ctl.toast(`${s.chars.length} total characters`);}),h('p',{text:'Bulk spawns use a broad street footprint. The world renderer prioritises nearby, selected and active characters.'})]),
  group('Character & equipment',[h('label',null,[h('input',{type:'checkbox',onchange:(e:Event)=>{selected=(e.target as HTMLInputElement).checked;}}),'Control selected NPC (otherwise player)']),button('Focus target',()=>{renderer.cam.follow=target().id;}),button('Restore target',heal),range('Fear',0,1,.05,()=>target().emo.fear,n=>{target().emo.fear=n;}),range('Frustration',0,1,.05,()=>target().emo.frustration,n=>{target().emo.frustration=n;}),range('Mood',-1,1,.05,()=>target().emo.mood,n=>{target().emo.mood=n;}),range('Energy',0,1,.05,()=>target().needs.energy,n=>{target().needs.energy=n;}),button('Test head impact',()=>{const s=sim(),c=target();wound(s,c,'head',1,'bruise',-1,c.x-1,c.y);}),weapon,button('Equip with ammunition',()=>equip(weapon.value)),button('Add armour',()=>{const c=target();c.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};c.combat.vest=c.combat.helmet=100;})]),
  group('World time',[range('Hour of day',0,23.9,.1,()=>sim().hour,hour)]),
  group('Command console',[h('form',{onsubmit:(e:Event)=>{e.preventDefault();run();}},[command,h('button.btn',{type:'submit',text:'Run command'})]),output]),
 ]);panel.addEventListener('dev-sync',()=>updates.forEach(fn=>fn()));return panel;
}
