import {restoreCityLife,type CityLifeState} from './CityLife';
import {PROP_KINDS} from '../content/streetProps';
import type {PokerTable} from '../casino/holdem';
import type {FlightPreferences,FlightRecord} from '../casino/flight';
export interface CasinoGuest{id:number;style:'patient'|'pressure'|'tricky'|'loose';balance:number;bet:number;pick:number;line:string;affinity:number}
export interface CasinoSocial{chips:number;bought?:number;cashedOut?:number;visits:number;round:number;guests:CasinoGuest[];debt:number;debtAt:number;creditor:'bank'|'famiglia'|null;sideBet?:{stake:number;kind:'mafia'|'bimbo';guest:number};poker?:PokerTable;flight?:{stake:number;start:number;bust:number;paid:boolean;endedAt?:number;returned?:number;model:number;scene:number;rate?:number;autoCash?:number;practice?:boolean;outcome?:'landed'|'crashed';cashMultiplier?:number;logged?:boolean};flightPreferences?:FlightPreferences;flightHistory?:FlightRecord[];lastGame:string;lastNet:number;lastAt:number}
export interface CityPlay{everyday?:CityLifeState;workshop:{spares:number;until:number;pose:string};props:import("./StreetProps").StreetProp[];casino:CasinoSocial;phone:{snakeBest:number;calls:{name:string;at:number;missed:boolean}[]};drama:{next:number;history:{kind:string;at:number;actors:number[];x:number;y:number}[]}}
export const newCityPlay=():CityPlay=>({workshop:{spares:0,until:0,pose:''},props:[],casino:{chips:0,visits:0,round:0,guests:[],debt:0,debtAt:0,creditor:null,lastGame:'',lastNet:0,lastAt:0},phone:{snakeBest:0,calls:[]},drama:{next:7200,history:[]}});
export function casinoCredit(s:CasinoSocial,kind:'bank'|'famiglia',amount:number,tick:number,cash:number):number{if(s.debt||!Number.isFinite(amount)||amount<100||amount>(kind==='bank'?Math.min(5000,Math.max(500,cash*.5)):10000))return 0;const n=Math.floor(amount);s.debt=Math.ceil(n*(kind==='bank'?1.05:1.2));s.debtAt=tick+60*60*24;s.creditor=kind;return n;}
export function repayCredit(s:CasinoSocial,cash:number):number{const n=Math.min(Math.max(0,cash),s.debt);s.debt-=n;if(!s.debt){s.creditor=null;s.debtAt=0;}return n;}
const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function restoreCityPlay(raw:unknown):CityPlay{
 const out=newCityPlay();if(!raw||typeof raw!=='object')return out;const r=raw as Partial<CityPlay>;out.everyday=restoreCityLife(r.everyday);
 if(Array.isArray(r.props))out.props=structuredClone(r.props.filter(p=>p&&PROP_KINDS.includes(p.kind)&&[p.id,p.x,p.y,p.vx,p.vy,p.z,p.vz,p.turn,p.spin,p.health,p.lastHit].every(Number.isFinite)).slice(0,160).map((p,id)=>({...p,id,health:Math.max(0,Math.min(1,p.health)),secured:p.secured===true,stock:finite(p.stock,0,20)?Math.floor(p.stock):20,lastUse:finite(p.lastUse,-1000000)?p.lastUse:-1000,uses:finite(p.uses)?p.uses:0,user:undefined,until:0})));
 if(r.workshop)out.workshop.spares=finite(r.workshop.spares,0,20)?Math.floor(r.workshop.spares):0;
 const c=r.casino;if(c&&finite(c.chips)&&finite(c.debt)){
  out.casino={...out.casino,...structuredClone(c)};const s=out.casino;
  s.guests=Array.isArray(c.guests)?c.guests.filter(g=>g&&finite(g.id)&&finite(g.balance)&&finite(g.bet)&&finite(g.pick,0,36)&&['patient','pressure','tricky','loose'].includes(g.style)&&typeof g.line==='string').slice(0,24).map(g=>({...g})):[];
  if(!finite(s.debtAt))s.debtAt=0;if(!['bank','famiglia'].includes(s.creditor??''))s.creditor=null;
  const t=s.poker,card=(c:unknown)=>!!c&&typeof c==='object'&&finite((c as {rank:number}).rank,2,14)&&['♠','♥','♦','♣'].includes((c as {suit:string}).suit);
  if(t&&(!Array.isArray(t.seats)||t.seats.length<2||t.seats.length>6||!t.seats.every(a=>a&&finite(a.stack)&&finite(a.bet)&&finite(a.paid)&&Array.isArray(a.hand)&&a.hand.length<=2&&a.hand.every(card))||!Array.isArray(t.board)||t.board.length>5||!t.board.every(card)||!Array.isArray(t.deck)||t.deck.length>52||!t.deck.every(card)||!finite(t.pot)||!finite(t.actor,t.phase==='betting'?0:-1,t.seats.length-1)||!['betting','result','finished'].includes(t.phase)))s.poker=undefined;
  const f=s.flight;if(f&&(!finite(f.stake)||!finite(f.start)||!finite(f.bust,1,1000)||!finite(f.model,0,59)||!finite(f.scene,0,8)||f.rate!==undefined&&!finite(f.rate,.04,.2)||f.autoCash!==undefined&&!finite(f.autoCash,0,1000)))s.flight=undefined;
  s.flightHistory=Array.isArray(s.flightHistory)?s.flightHistory.filter(r=>r&&finite(r.start)&&finite(r.multiplier,1,1000)&&finite(r.model,0,59)&&finite(r.scene,0,8)&&finite(r.stake)&&finite(r.returned)&&['landed','crashed'].includes(r.outcome)).slice(-40):[];
  if(s.sideBet&&(!finite(s.sideBet.stake)||!['mafia','bimbo'].includes(s.sideBet.kind)))s.sideBet=undefined;
 }
 if(r.phone){out.phone.snakeBest=Math.min(999,Math.max(0,Number(r.phone.snakeBest)||0));out.phone.calls=Array.isArray(r.phone.calls)?r.phone.calls.filter(c=>c&&typeof c.name==='string'&&!['Mum','Dad','Little sis','Nana'].includes(c.name)&&finite(c.at)).slice(-20):[];}
 if(r.drama&&finite(r.drama.next)){out.drama.next=r.drama.next;out.drama.history=Array.isArray(r.drama.history)?structuredClone(r.drama.history.filter(e=>e&&typeof e.kind==='string'&&finite(e.at)&&Number.isFinite(e.x+e.y)&&Array.isArray(e.actors)).slice(-16)):[];}
 return out;
}
