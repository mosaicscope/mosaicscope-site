import type {Character,Accessory} from '../entities/types';
import {ACCESSORIES,equipAccessory} from '../content/accessories';
import {h} from './dom';
export function accessoryControls(c:Character):HTMLElement{
 const field=h('fieldset.welcome-accessories',null,[h('legend',{text:'Accessories · damage stays visible until repaired'})]);
 const inputs=new Map<Accessory,HTMLInputElement>();
 for(const item of ACCESSORIES){const input=h('input',{type:'checkbox','aria-label':item,checked:c.look.accessories?.includes(item),onchange:()=>{equipAccessory(c,item,input.checked);for(const [id,el]of inputs)el.checked=!!c.look.accessories?.includes(id);}}) as HTMLInputElement;inputs.set(item,input);field.append(h('label',null,[input,item.replace(/-/g,' ')]));}
 field.append(h('button.btn',{type:'button',text:'Repair accessories',onclick:()=>{c.look.accessoryWear={};}}));return field;
}
