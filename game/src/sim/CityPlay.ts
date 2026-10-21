import type {PokerTable} from '../casino/holdem';
export interface CasinoGuest{id:number;style:'patient'|'pressure'|'tricky'|'loose';balance:number;bet:number;pick:number;line:string;affinity:number}
export interface CasinoSocial{chips:number;bought?:number;cashedOut?:number;visits:number;round:number;guests:CasinoGuest[];debt:number;debtAt:number;creditor:'bank'|'famiglia'|null;sideBet?:{stake:number;kind:'mafia'|'bimbo';guest:number};poker?:PokerTable;flight?:{stake:number;start:number;bust:number;paid:boolean;endedAt?:number;returned?:number;model:number;scene:number};lastGame:string;lastNet:number;lastAt:number}
export interface CityPlay{props:import("./StreetProps").StreetProp[];casino:CasinoSocial;phone:{snakeBest:number;calls:{name:string;at:number;missed:boolean}[]};drama:{next:number;history:{kind:string;at:number;actors:number[];x:number;y:number}[]}}
export const newCityPlay=():CityPlay=>({props:[],casino:{chips:0,visits:0,round:0,guests:[],debt:0,debtAt:0,creditor:null,lastGame:'',lastNet:0,lastAt:0},phone:{snakeBest:0,calls:[]},drama:{next:7200,history:[]}});
export function casinoCredit(s:CasinoSocial,kind:'bank'|'famiglia',amount:number,tick:number,cash:number):number{if(s.debt||!Number.isFinite(amount)||amount<100||amount>(kind==='bank'?Math.min(5000,Math.max(500,cash*.5)):10000))return 0;const n=Math.floor(amount);s.debt=Math.ceil(n*(kind==='bank'?1.05:1.2));s.debtAt=tick+60*60*24;s.creditor=kind;return n;}
export function repayCredit(s:CasinoSocial,cash:number):number{const n=Math.min(Math.max(0,cash),s.debt);s.debt-=n;if(!s.debt){s.creditor=null;s.debtAt=0;}return n;}
const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function restoreCityPlay(raw:unknown):CityPlay{
 const out=newCityPlay();if(!raw||typeof raw!=='object')return out;const r=raw as Partial<CityPlay>;
 if(Array.isArray(r.props))out.props=structuredClone(r.props.filter(p=>p&&['cone','crate','barrel','cart','ball'].includes(p.kind)&&[p.id,p.x,p.y,p.vx,p.vy,p.z,p.vz,p.turn,p.spin,p.health,p.lastHit].every(Number.isFinite)).slice(0,60).map((p,id)=>({...p,id})));
 const c=r.casino;if(c&&finite(c.chips)&&finite(c.debt)){
  out.casino={...out.casino,...structuredClone(c)};const s=out.casino;
  s.guests=Array.isArray(c.guests)?c.guests.filter(g=>g&&finite(g.id)&&finite(g.balance)&&finite(g.bet)&&finite(g.pick,0,36)&&['patient','pressure','tricky','loose'].includes(g.style)&&typeof g.line==='string').slice(0,8):[];
  if(!finite(s.debtAt))s.debtAt=0;if(!['bank','famiglia'].includes(s.creditor??''))s.creditor=null;
  const t=s.poker,card=(c:unknown)=>!!c&&typeof c==='object'&&finite((c as {rank:number}).rank,2,14)&&['♠','♥','♦','♣'].includes((c as {suit:string}).suit);
  if(t&&(!Array.isArray(t.seats)||t.seats.length<2||t.seats.length>6||!t.seats.every(a=>a&&finite(a.stack)&&finite(a.bet)&&finite(a.paid)&&Array.isArray(a.hand)&&a.hand.length<=2&&a.hand.every(card))||!Array.isArray(t.board)||t.board.length>5||!t.board.every(card)||!Array.isArray(t.deck)||t.deck.length>52||!t.deck.every(card)||!finite(t.pot)||!finite(t.actor,t.phase==='betting'?0:-1,t.seats.length-1)||!['betting','result','finished'].includes(t.phase)))s.poker=undefined;
  const f=s.flight;if(f&&(!finite(f.stake)||!finite(f.start)||!finite(f.bust,1,1000)||!finite(f.model,0,59)||!finite(f.scene,0,2)))s.flight=undefined;
  if(s.sideBet&&(!finite(s.sideBet.stake)||!['mafia','bimbo'].includes(s.sideBet.kind)))s.sideBet=undefined;
 }
 if(r.phone){out.phone.snakeBest=Math.min(999,Math.max(0,Number(r.phone.snakeBest)||0));out.phone.calls=Array.isArray(r.phone.calls)?r.phone.calls.filter(c=>c&&typeof c.name==='string'&&finite(c.at)).slice(-20):[];}
 if(r.drama&&finite(r.drama.next)){out.drama.next=r.drama.next;out.drama.history=Array.isArray(r.drama.history)?structuredClone(r.drama.history.filter(e=>e&&typeof e.kind==='string'&&finite(e.at)&&Number.isFinite(e.x+e.y)&&Array.isArray(e.actors)).slice(-16)):[];}
 return out;
}
