import type {Accessory,Character} from '../entities/types';
export const ACCESSORIES:Accessory[]=['glasses','goggles','safety-glasses','visor','respirator','medical-mask','headphones','nose-ring','lip-ring','brow-ring','mouthguard','chain','scarf','backpack','watch','headband','earrings','eyepatch','bandage','bowtie'];
const groups=[['glasses','goggles','safety-glasses','visor'],['respirator','medical-mask','mouthguard']];
export function equipAccessory(c:Character,item:Accessory,on:boolean):void{
 const exclude=on?groups.find(g=>g.includes(item))??[item]:[item];c.look.accessories=(c.look.accessories??[]).filter(a=>!exclude.includes(a));
 if(on)c.look.accessories.push(item);
}
/** Wear persists with the appearance; cosmetic glasses never act like ballistic armour. */
export function hitAccessories(c:Character,severity:number,kind:string):boolean{
 let cushioned=false;
 for(const item of c.look.accessories??[]){
  if(!['glasses','goggles','safety-glasses','visor','respirator','medical-mask','headphones','nose-ring','lip-ring','brow-ring','mouthguard','earrings','headband','eyepatch'].includes(item))continue;
  const wear=c.look.accessoryWear??={};const prior=wear[item]??0;wear[item]=Math.min(3,prior+(severity>=2?2:1));
  if(prior<3&&kind==='bruise'&&(item==='mouthguard'||item==='visor'))cushioned=true;
 }
 return cushioned;
}
