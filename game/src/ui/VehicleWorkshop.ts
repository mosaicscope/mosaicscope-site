import {h} from './dom';
import type {Simulation} from '../sim/Simulation';
import type {ModalHost} from './Modals';
import {WORKSHOP_ACTIONS,workshopAction,inspectVehicle} from '../sim/VehicleWorkshop';
import {VEHICLES} from '../content/vehicles';
import {prepareStreetProps} from '../sim/StreetProps';
import {propDef} from '../content/streetProps';
export function showVehicleWorkshop(modal:ModalHost,sim:Simulation):void{
 prepareStreetProps(sim);const c=sim.player,near=sim.vehicles.filter(v=>Math.hypot(v.x-c.x,v.y-c.y)<3),props=sim.cityPlay.props.filter(p=>Math.hypot(p.x-c.x,p.y-c.y)<2);
 const car=h('select',{'aria-label':'Workshop vehicle'},near.map(v=>h('option',{value:v.id,text:VEHICLES[v.cls].name+' · '+v.plate}))) as HTMLSelectElement;
 const prop=h('select',{'aria-label':'Workshop street object'},props.map(p=>h('option',{value:p.id,text:propDef(p.kind).name}))) as HTMLSelectElement;
 const wheel=h('select',{'aria-label':'Wheel to replace'},['Front left','Front right','Rear left','Rear right'].map((text,i)=>h('option',{text,value:i}))) as HTMLSelectElement;
 const colour=h('input',{type:'color',value:'#688d87','aria-label':'Workshop paint colour'}) as HTMLInputElement;
 const message=h('p',{role:'status',style:'white-space:pre-line'}),list=h('div'),detail=h('details',null,[h('summary',{text:'Vehicle condition'}),h('pre',{style:'white-space:pre-wrap;font-size:12px'})]);
 const render=(group:string)=>{list.replaceChildren(...WORKSHOP_ACTIONS.filter(a=>a.group===group).map(a=>h('article.street-card',null,[h('h3',{text:a.label}),h('p',{text:a.detail}),h('button.btn',{text:a.label+(a.cost?' · $'+a.cost:''),'data-workshop-action':a.id,onclick:()=>{const result=workshopAction(sim,a.id,car.value?+car.value:-1,prop.value?+prop.value:-1,+wheel.value,colour.value);message.textContent=result.text;const v=sim.vehicles[+car.value];if(v)detail.querySelector('pre')!.textContent=inspectVehicle(v).join('\n');}})])));};
 const group=h('select',{'aria-label':'Workshop tools',onchange:(e:Event)=>render((e.target as HTMLSelectElement).value)},[...new Set(WORKSHOP_ACTIONS.map(a=>a.group))].map(text=>h('option',{value:text,text})));
 car.addEventListener('change',()=>{const v=sim.vehicles[+car.value];if(v)detail.querySelector('pre')!.textContent=inspectVehicle(v).join('\n');});if(near[0])detail.querySelector('pre')!.textContent=inspectVehicle(near[0]).join('\n');render('Inspection');
 modal.show('Vehicle & street workshop',[
  h('p',{text:WORKSHOP_ACTIONS.length+' practical tools. Work beside a stopped vehicle or a real street object. All prices use game cash.'}),
  near.length?car:h('p',{text:'Walk up to a vehicle to inspect or work on it.'}),props.length?prop:null,
  h('div.opts',null,[h('label',null,['Tools ',group]),h('label',null,['Wheel ',wheel]),h('label',null,['Paint ',colour])]),detail,message,list,
 ]);
}
