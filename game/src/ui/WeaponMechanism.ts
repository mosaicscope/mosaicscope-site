import {canvasStage,sceneText} from './CanvasStage';
import {h} from './dom';
import {drawToy} from '../render/ToyArt';
import {weaponMotion,visibleWeaponMotion,type WeaponAction} from '../render/WeaponMotion';
import {TOYS} from '../content/toys';
export interface LiveWeaponHost{state():{def:string;action:WeaponAction|undefined;tick:number;rounds:number;status:string};fire():void;focus():void}
/** This view observes and fires the equipped world weapon, rather than playing a demonstration. */
export function liveWeaponMechanism(host:LiveWeaponHost):HTMLElement{
 let held=false,detail=1.4;const status=h('p',{'aria-live':'polite'});
 const zoom=h('label',null,['Gun detail zoom ',h('input',{type:'range',min:1,max:2,step:.1,value:detail,'aria-label':'Gun detail zoom',oninput:(e:Event)=>{detail=+(e.target as HTMLInputElement).value;}})]);
 const fire=h('button.btn.acid',{text:'Fire equipped gun','aria-label':'Fire equipped gun',onpointerdown:(e:PointerEvent)=>{e.preventDefault();(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);held=true;host.fire();},onpointerup:()=>{held=false;},onpointercancel:()=>{held=false;},onclick:(e:MouseEvent)=>{if(e.detail===0)host.fire();}});
 const stage=canvasStage(g=>{
  const state=host.state(),spec=TOYS[state.def]?.weapon;
  if(held&&spec?.mode==='auto')host.fire();
  g.fillStyle='#202521';g.fillRect(0,0,720,360);
  if(!spec?.gun){sceneText(g,'Equip a gun from the armory first',360,145,20);fire.setAttribute('disabled','true');status.textContent='No firearm equipped';return;}
  fire.removeAttribute('disabled');const motion=visibleWeaponMotion(state.action,state.tick,performance.now()/1000);
  const centre=state.def==='rifle'||state.def==='shotgun'?.5:state.def==='smg'?.27:.5;
  g.save();g.translate(360-centre*80*detail-motion.cycle*12,170);g.rotate(-motion.cycle*.045);drawToy(g,state.def,0,0,8*detail,0,'#858e82',1,1,motion);g.restore();
  sceneText(g,'EQUIPPED WEAPON · LIVE WORLD ACTION',22,28,14,'#d5c196','left');
  sceneText(g,`${TOYS[state.def].name} · ${state.rounds} rounds · ${state.status}`,22,337,16,'#e5dfcf','left');
  const text=state.status==='Reloading'?'Reloading · wait for the magazine / cylinder to close':`${state.rounds} rounds · ${spec.mode??'semi'} · shots affect the city`;
  if(status.textContent!==text)status.textContent=text;
 },{width:720,height:360,label:'Live equipped gun with slide, bolt, trigger, casing and reload animation'});
 return h('section.weapon-study',null,[stage,zoom,status,h('div.row',null,[fire,h('button.btn',{text:'Close-up in the city',onclick:()=>host.focus()})]),h('p',{text:'F, Space or right mouse fires in the city. Hold for automatic weapons. This button fires the real equipped weapon toward your selected target or facing direction.'})]);
}
/** An enlarged study makes the same moving parts visible without forcing the world camera to zoom. */
export function weaponMechanism(initial='pistol'):HTMLElement{
 let selected=TOYS[initial]?.weapon?.gun?initial:'pistol';
 const choose=h('select',{'aria-label':'Weapon mechanism'},['pistol','revolver','smg','rifle','shotgun','golden_pistol'].map(id=>h('option',{value:id,selected:id===selected,text:TOYS[id].name}))) as HTMLSelectElement;
 choose.addEventListener('change',()=>{selected=choose.value;});
 const stage=canvasStage((g,t,reduced)=>{
  g.fillStyle='#202521';g.fillRect(0,0,720,220);const def=TOYS[selected].weapon!,tick=reduced?0:t%6*60;
  const action={weapon:selected,firedAt:30,reloadFrom:100,reloadUntil:100+(def.reload??1.5)*60,shots:1};
  const motion=weaponMotion(action,tick);
  drawToy(g,selected,300,112,7,0,'#858e82',1,1,motion);
  sceneText(g,'MECHANISM STUDY · VISUAL DEMONSTRATION',22,26,13,'#c8b78e','left');
  sceneText(g,motion.reload?(selected==='shotgun'?'Shell loading':selected==='revolver'?'Cylinder reload':'Magazine reload'):motion.pump?'Pump return':motion.cycle?'Action cycling':'Ready',22,195,15,'#dedbcd','left');
 },{width:720,height:220,label:'Enlarged moving weapon mechanism; visual demonstration only'});
 return h('section.weapon-study',null,[h('label',null,['Inspect moving parts ',choose]),stage]);
}
