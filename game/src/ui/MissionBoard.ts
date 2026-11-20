import {h} from './dom';
import type {Simulation} from '../sim/Simulation';
import {CITY_MISSIONS,startMission,abandonMission,missionStatus} from '../sim/CityMissions';
import type {ModalHost} from './Modals';
export function showMissions(s:Simulation,modal:ModalHost,resume:()=>void,toast:(text:string)=>void):void{const state=s.worldFun.missions,active=state?.active,refresh=()=>showMissions(s,modal,resume,toast);modal.show('City missions',[
 h('p',{text:'Choose a job, then play in the city. Pickups and deliveries happen when you stand at the marked entrance for a moment. Driving checkpoints clear as you pass through. No countdowns or reaction clicks.'}),
 ...(active?[h('p',{role:'status',text:missionStatus(s)}),h('button.btn.acid',{text:'Continue mission in the world',onclick:()=>{modal.close();resume();}}),h('button.btn',{text:'Abandon mission',onclick:()=>{abandonMission(s);refresh();}})]:[]),
 ...CITY_MISSIONS.map(d=>h('article.ax-card',null,[h('h3',{text:d.title}),h('p',{text:d.brief}),h('p',{text:'Reward: $'+d.reward+' game cash'}),h('button.btn',{text:state?.completed.includes(d.id)?'Completed':active?.id===d.id?'Active mission':'Accept '+d.title,disabled:!!active||!!state?.completed.includes(d.id),onclick:()=>{const result=startMission(s,d.id);toast(result);if(s.worldFun.missions?.active){modal.close();resume();}else refresh();}})]))
 ],'activities missions');}
