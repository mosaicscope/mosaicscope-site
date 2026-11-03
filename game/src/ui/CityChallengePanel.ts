import {h} from './dom';
import {CITY_CHALLENGES,startChallenge,nextChallengeStop,challengeStatus} from '../sim/CityChallenges';
import type {Simulation} from '../sim/Simulation';
export function cityChallengePanel(sim:Simulation,refresh:()=>void,toast:(text:string)=>void,walk?:(x:number,y:number)=>void):HTMLElement{
 const state=sim.worldFun.challenges,stop=nextChallengeStop(sim),completed=state?.completed.length??0;
 const box=h('section.city-challenges',null,[h('p',{text:CITY_CHALLENGES.length+' city challenges · '+completed+' completed. Earn game cash by exploring, meeting people, and taking part in street life.'}),h('p',{role:'status',text:challengeStatus(sim)||'Choose a challenge to get started.'})]);
 if(stop)box.append(h('p',{text:'Next stop: '+stop.name}),h('button.btn.acid',{text:'Walk to the next stop',disabled:!walk,onclick:()=>walk?.(stop.x,stop.y)}));
 if(state?.active)box.append(h('button.btn',{text:'Stop this challenge',onclick:()=>{state.active=undefined;refresh();}}));
 let query='',filter='available',limit=12;
 const grid=h('div.ax-grid'),count=h('p',{'aria-live':'polite'}),more=h('button.btn',{text:'Show more challenges',onclick:()=>{limit+=12;draw();}});
 const draw=()=>{grid.replaceChildren();const matches=CITY_CHALLENGES.filter(d=>{const done=state?.completed.includes(d.id)??false,active=state?.active?.id===d.id;return(filter==='all'||filter==='completed'&&done||filter==='available'&&!done||filter==='active'&&active)&&(!query||(d.title+' '+d.description).toLowerCase().includes(query));});
 count.textContent=matches.length+' challenges · showing '+Math.min(limit,matches.length);more.hidden=matches.length<=limit;
 for(const d of matches.slice(0,limit)){const done=state?.completed.includes(d.id),active=state?.active?.id===d.id;grid.append(h('article.ax-card',null,[h('h3',{text:d.title+(done?' · complete':'')}),h('p',{text:d.description}),h('p',{text:'Reward: $'+d.reward+' game cash'}),h('button.btn',{text:done?'Completed':active?'In progress':state?.active?'Switch to this challenge':'Start challenge',disabled:done||active,onclick:()=>{toast(startChallenge(sim,d.id));refresh();}})]));}};
 const search=h('input',{type:'search','aria-label':'Search city challenges',placeholder:'Search challenges',oninput:(e:Event)=>{query=(e.target as HTMLInputElement).value.trim().toLowerCase();limit=12;draw();}}),select=h('select',{'aria-label':'Filter city challenges',onchange:(e:Event)=>{filter=(e.target as HTMLSelectElement).value;limit=12;draw();}},[['available','Available'],['active','In progress'],['completed','Completed'],['all','All challenges']].map(([value,text])=>h('option',{value,text})));
 box.append(h('div.city-challenge-filters',null,[search,select]),count,grid,more);draw();return box;
}

