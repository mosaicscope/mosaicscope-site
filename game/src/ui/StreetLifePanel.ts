import type { Simulation } from '../sim/Simulation';
import type { ModalHost } from './Modals';
import { h } from './dom';
import { CREWS } from '../sim/Turf';
import { resolveStreetIncident, storyPhase } from '../sim/StreetLife';
import { SALT_MILESTONES } from '../content/salt-story/milestones';

export function showStreetLife(modal:ModalHost,sim:Simulation,walk:(x:number,y:number)=>void):void{
  const events=[...sim.streetLife.history].reverse().slice(0,8);
  modal.show('Street life · crews & neighbourhoods',[
    h('p',{text:`Story context: ${SALT_MILESTONES[storyPhase(sim)].title}. Existing street encounters and authored dialogue remain available.`}),
    h('div.street-heat',null,Object.entries(sim.streetLife.heat).map(([id,heat])=>h('label',null,[CREWS[id]?.name??id,h('meter',{min:0,max:1,value:heat,'aria-label':`${CREWS[id]?.name??id} tension`}),`${Math.round(heat*100)}%`]))),
    ...(!events.length?[h('p',{text:'The neighbourhood is settling in. Meetings, disputes and nightlife develop as the city runs.'})]:[]),
    ...events.map(e=>{
      const active=!e.resolved&&e.until>sim.tick,feedback=h('p',{role:'status'});
      const react=(choice:'calm'|'warn'|'medical')=>{feedback.textContent=resolveStreetIncident(sim,e.id,choice);};
      return h('article.street-card',null,[h('h3',{text:e.title}),h('p',{text:`${e.area} · ${active?'Happening now':e.resolved?'Resolved':'Earlier'}`}),h('p',{text:e.line}),
        h('p',{text:e.actors.map(id=>sim.chars[id]?.name).filter(Boolean).join(' · ')}),
        ...(active?[h('div.opts',null,[h('button',{text:'Walk to scene',onclick:()=>{modal.close();walk(e.x,e.y);}}),h('button',{text:'Talk them down',onclick:()=>react('calm')}),h('button',{text:'Warn bystanders',onclick:()=>react('warn')}),h('button',{text:'Call medical help',onclick:()=>react('medical')})])]:[]),feedback]);
    }),
  ]);
}
