import {h} from './dom';
import {CITY_CHALLENGES,startChallenge,nextChallengeStop,challengeStatus} from '../sim/CityChallenges';
import type {Simulation} from '../sim/Simulation';
export function cityChallengePanel(sim:Simulation,refresh:()=>void,toast:(text:string)=>void,walk?:(x:number,y:number)=>void):HTMLElement{
 const state=sim.worldFun.challenges,stop=nextChallengeStop(sim),box=h('section.city-challenges',null,[h('p',{text:'Ten city challenges · complete each once for game cash and fun. Walking routes advance at each entrance; discovery challenges count different people, models or streets.'}),h('p',{role:'status',text:challengeStatus(sim)||'Choose a challenge to get started.'})]);
 if(stop)box.append(h('p',{text:'Next stop: '+stop.name}),h('button.btn.acid',{text:'Walk to the next stop',disabled:!walk,onclick:()=>walk?.(stop.x,stop.y)}));
 if(state?.active)box.append(h('button.btn',{text:'Stop this challenge',onclick:()=>{state.active=undefined;refresh();}}));
 const grid=h('div.ax-grid');
 for(const d of CITY_CHALLENGES){const completed=state?.completed.includes(d.id),active=state?.active?.id===d.id;
  grid.append(h('article.ax-card',null,[h('h3',{text:d.title+(completed?' · complete':'')}),h('p',{text:d.description}),h('p',{text:'Reward: $'+d.reward+' game cash'}),h('button.btn',{text:completed?'Completed':active?'In progress':state?.active?'Switch to this challenge':'Start challenge',disabled:completed||active,onclick:()=>{toast(startChallenge(sim,d.id));refresh();}})]));
 }
 box.append(grid);return box;
}
