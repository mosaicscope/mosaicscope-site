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
 const heal=()=>{const s=sim(),c=target();c.wounds=[];c.blood=1;c.bleed=0;c.phys=0;c.stunUntil=0;c.emo.composure=1;c.emo.fear=0;c.emo.frustration=0;c.needs.energy=1;s.pendingAmbulance.delete(c.id);ctl.toast(`${c.name}: restored`);};
 const hour=(v:number)=>{const s=sim();s.env.startHour=((Math.max(0,Math.min(23.99,v))-s.tick/TICKS_PER_HOUR)%24+24)%24;};
 const weapon=h('select',{'aria-label':'Developer equipment'},Object.entries(TOYS).filter(([id,d])=>id!=='fists'&&!!d.weapon).map(([id,d])=>h('option',{value:id,text:d.name}))) as HTMLSelectElement;
 const count=h('input',{type:'number',min:1,max:1000,value:50,'aria-label':'NPC spawn count'}) as HTMLInputElement;
 const output=h('output.dev-output',{'aria-live':'polite',text:'Commands: help · pause · resume · speed 2 · spawn 50 · give pistol · heal · cash 1000 · time 18'});
 const command=h('input',{type:'text','aria-label':'Developer command',placeholder:'Enter a command…',autocomplete:'off',spellcheck:'false'}) as HTMLInputElement;
 const run=()=>{const [name,arg]=command.value.trim().toLowerCase().split(/\s+/),n=Number(arg);let result='Command applied';
  if(name==='help')result='pause | resume | speed 0/1/2/4 | spawn 1–1000 | give weapon_id | heal | cash amount | time 0–24 | focus';
  else if(name==='pause')ctl.setSpeed(0);else if(name==='resume')ctl.setSpeed(1);
  else if(name==='speed'&&[0,1,2,4].includes(n))ctl.setSpeed(n);
  else if(name==='spawn'&&Number.isFinite(n)&&n>=1&&n<=1000){const s=sim();s.spawnNpcAt(s.player.x,s.player.y,n);}
  else if(name==='give'&&TOYS[arg]?.weapon)equip(arg);else if(name==='heal')heal();
  else if(name==='cash'&&Number.isFinite(n)&&n>=0&&n<=1e7)target().cash=n;
  else if(name==='time'&&Number.isFinite(n)&&n>=0&&n<24)hour(n);
  else if(name==='focus'){const c=target();renderer.cam.follow=c.id;renderer.cam.lookAt(c.x,c.y,true);}
  else result='Unknown command or value. Type help.';
  output.textContent=`> ${command.value}\n${result}`;command.value='';
 };
 const quality=h('select',{'aria-label':'Developer render quality',onchange:(e:Event)=>ctl.setQuality((e.target as HTMLSelectElement).value)},['auto','low','medium','high','ultra'].map(q=>h('option',{value:q,text:q}))) as HTMLSelectElement;
 const panel=h('div.dev-workbench',null,[
  group('Simulation & performance',[h('div.row',null,[button('Pause',()=>ctl.setSpeed(0)),button('1×',()=>ctl.setSpeed(1)),button('2×',()=>ctl.setSpeed(2)),button('4×',()=>ctl.setSpeed(4)),button('Step one tick',()=>ctl.step())]),h('label',null,['Render quality',quality]),range('World zoom',.55,7,.05,()=>renderer.cam.targetZoom,n=>renderer.cam.setZoom(n))],true),
  group('Crowd stress tools',[h('label',null,['NPC count',count]),button('Spawn across nearby streets',()=>{const s=sim();s.spawnNpcAt(s.player.x,s.player.y,+count.value);ctl.toast(`${s.chars.length} total characters`);}),h('p',{text:'Bulk spawns use a broad street footprint. The world renderer prioritises nearby, selected and active characters.'})]),
  group('Character & equipment',[h('label',null,[h('input',{type:'checkbox',onchange:(e:Event)=>{selected=(e.target as HTMLInputElement).checked;}}),'Control selected NPC (otherwise player)']),button('Focus target',()=>{renderer.cam.follow=target().id;}),button('Restore target',heal),range('Fear',0,1,.05,()=>target().emo.fear,n=>{target().emo.fear=n;}),range('Frustration',0,1,.05,()=>target().emo.frustration,n=>{target().emo.frustration=n;}),range('Mood',-1,1,.05,()=>target().emo.mood,n=>{target().emo.mood=n;}),range('Energy',0,1,.05,()=>target().needs.energy,n=>{target().needs.energy=n;}),button('Test head impact',()=>{const s=sim(),c=target();wound(s,c,'head',1,'bruise',-1,c.x-1,c.y);}),weapon,button('Equip with ammunition',()=>equip(weapon.value)),button('Add armour',()=>{const c=target();c.combat??={style:'jab',xp:0,ammo:{},vest:0,helmet:0};c.combat.vest=c.combat.helmet=100;})]),
  group('World time',[range('Hour of day',0,23.9,.1,()=>sim().hour,hour)]),
  group('Command console',[h('form',{onsubmit:(e:Event)=>{e.preventDefault();run();}},[command,h('button.btn',{type:'submit',text:'Run command'})]),output]),
 ]);panel.addEventListener('dev-sync',()=>updates.forEach(fn=>fn()));return panel;
}
