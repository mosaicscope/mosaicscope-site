import type { Simulation } from '../sim/Simulation';
import type { ModalHost } from './Modals';
import { h } from './dom';
import { carried } from '../inventory/Inventory';
import { consume, buy } from '../sim/Society';
import { TOYS } from '../content/toys';
import { impairment, substancePhase } from '../sim/Substances';

export function showInventoryCondition(modal:ModalHost,sim:Simulation,resume:()=>void):void{
  const p=sim.player;
  const message=h('p',{role:'status'});
  const bar=sim.world.buildings.find(b=>['nightclub','hotel'].includes(b.kind)&&Math.hypot(p.x-b.door.x,p.y-b.door.y)<6);
  modal.show('Inventory & condition',[
    h('p',{text:`${substancePhase(p,sim.tick)} · coordination impairment ${Math.round(impairment(p)*100)}%`}),
    h('p',{text:'Substances affect balance, reactions, aim and fatigue. Effects wear off over game time; a serious reaction brings paramedics. No one dies.'}),
    ...(bar?[h('button.btn',{text:'Buy beer at the bar · $9',onclick:()=>{const result=buy(sim,p,'beer',{building:bar.id});if(result.ok)showInventoryCondition(modal,sim,resume);else message.textContent=result.reason??'Cannot buy that now.';}})]:[]),
    h('ul.items',null,carried(p).map(id=>sim.toys[id]).filter(Boolean).map(t=>h('li.item',null,[
      h('div',null,[h('b',{text:TOYS[t.def].name}),h('p',{text:TOYS[t.def].blurb??''})]),
      ...(t.def!=='bandage'&&(TOYS[t.def].food||TOYS[t.def].substance)?[h('button.btn',{text:TOYS[t.def].substance?'Use':'Eat / drink',onclick:()=>{
        if(consume(sim,p,t)){modal.close();resume();}else message.textContent='Wait until the current action or recovery has finished.';
      }})]:[])]))),message,
    h('p',{text:'U uses the held food or substance. B uses a bandage. The same consumption and recovery systems affect NPCs.'}),
  ]);
}
