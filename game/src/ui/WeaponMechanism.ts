import {canvasStage,sceneText} from './CanvasStage';
import {h} from './dom';
import {drawToy} from '../render/ToyArt';
import {weaponMotion} from '../render/WeaponMotion';
import {TOYS} from '../content/toys';
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
