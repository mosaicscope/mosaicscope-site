import {propDef} from '../content/streetProps';
import {prepareStreetProps,useStreetProp} from '../sim/StreetProps';
import type { Simulation } from '../sim/Simulation';
import type { ModalHost } from './Modals';
import { h } from './dom';
import { CREWS } from '../sim/Turf';
import { resolveStreetIncident, storyPhase } from '../sim/StreetLife';
import { SALT_MILESTONES } from '../content/salt-story/milestones';

export function showStreetLife(modal:ModalHost,sim:Simulation,walk:(x:number,y:number)=>void):void{
  prepareStreetProps(sim);
  const events=[...sim.streetLife.history].reverse().slice(0,8);
  modal.show('Street life · crews & neighbourhoods',[
    h('p',{text:`Story context: ${SALT_MILESTONES[storyPhase(sim)].title}. Existing street encounters and authored dialogue remain available.`}),
    h('details',null,[h('summary',{text:'Street furniture · '+sim.cityPlay.props.length+' usable objects'}),...sim.cityPlay.props.slice().sort((a,b)=>Math.hypot(a.x-sim.player.x,a.y-sim.player.y)-Math.hypot(b.x-sim.player.x,b.y-sim.player.y)).map(p=>{const d=propDef(p.kind),near=Math.hypot(p.x-sim.player.x,p.y-sim.player.y)<1.35;return h('div.opts',null,[h('span',{text:d.name}),h('button',{text:near?d.action:'Walk here',onclick:()=>{modal.close();if(near)useStreetProp(sim,sim.player,p);else walk(p.x,p.y);}})]);})]),
    h('div.street-heat' ,null,Object.entries(sim.streetLife.heat).map(([id,heat])=>h('label',null,[CREWS[id]?.name??id,h('meter',{min:0,max:1,value:heat,'aria-label':`${CREWS[id]?.name??id} tension`}),`${Math.round(heat*100)}%`]))),
    ...(!events.length?[h('p',{text:'The neighbourhood is settling in. Meetings, disputes and nightlife develop as the city runs.'})]:[]),
    ...sim.cityPlay.drama.history.slice(-4).reverse().map(e=>{
      const people=e.actors.map(id=>sim.chars[id]).filter(Boolean),feedback=h('p',{role:'status'});
      return h('article.street-card',null,[h('h3',{text:'Neighbourhood · '+e.kind}),h('p',{text:people.map(c=>c.name).join(' · ')}),h('p',{text:sim.tick-e.at<3600?'Recent incident nearby':'Earlier in the neighbourhood'}),h('div.opts',null,[
        h('button',{text:'Walk to incident',onclick:()=>{modal.close();walk(e.x,e.y);}}),
        h('button',{text:'Check on people',onclick:()=>{if(Math.hypot(sim.player.x-e.x,sim.player.y-e.y)>8){feedback.textContent='Walk closer first.';return;}for(const c of people){c.emo.frustration=Math.max(0,c.emo.frustration-.15);c.emo.fear=Math.max(0,c.emo.fear-.1);sim.relate(c,sim.playerId).trust=Math.min(1,sim.relate(c,sim.playerId).trust+.03);}feedback.textContent='You check on the people involved and give them space.';}}),
        h('button',{text:'Request medical help',onclick:()=>{const c=people.find(c=>c.wounds.length||c.substances?.crisis||c.blood<.6);if(c){sim.callAmbulance(c);feedback.textContent='Paramedics have been requested.';}else feedback.textContent='Nobody here needs an ambulance at present.';}})
      ]),feedback]);
    }),
    ...events.map(e=>{
      const active=!e.resolved&&e.until>sim.tick,feedback=h('p',{role:'status'});
      const react=(choice:'calm'|'warn'|'medical')=>{feedback.textContent=resolveStreetIncident(sim,e.id,choice);};
      return h('article.street-card',null,[h('h3',{text:e.title}),h('p',{text:`${e.area} · ${active?'Happening now':e.resolved?'Resolved':'Earlier'}`}),h('p',{text:e.line}),
        h('p',{text:e.actors.map(id=>sim.chars[id]?.name).filter(Boolean).join(' · ')}),
        ...(active?[h('div.opts',null,[h('button',{text:'Walk to scene',onclick:()=>{modal.close();walk(e.x,e.y);}}),h('button',{text:'Talk them down',onclick:()=>react('calm')}),h('button',{text:'Warn bystanders',onclick:()=>react('warn')}),h('button',{text:'Call medical help',onclick:()=>react('medical')})])]:[]),feedback]);
    }),
  ]);
}
