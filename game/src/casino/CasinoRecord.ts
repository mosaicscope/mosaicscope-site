import type {CasinoSocial} from '../sim/CityPlay';
export interface CasinoGameRecord{played:number;wins:number;losses:number;net:number;best:number}
export interface CasinoRoundRecord{game:string;net:number;at:number}
export interface CasinoRecordState{played:number;wins:number;losses:number;net:number;best:number;worst:number;streak:number;bestStreak:number;games:Record<string,CasinoGameRecord>;recent:CasinoRoundRecord[]}
const num=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(-1e12,Math.min(1e12,v)):fallback;
const count=(v:unknown)=>Math.max(0,Math.floor(num(v)));
export function restoreCasinoRecord(raw:unknown):CasinoRecordState{
 const v=(raw&&typeof raw==='object'?raw:{}) as Partial<CasinoRecordState>,games:Record<string,CasinoGameRecord>=Object.create(null);
 if(v.games&&typeof v.games==='object')for(const [name,x] of Object.entries(v.games).slice(0,24)){if(!x||typeof x!=='object'||!name||['__proto__','constructor','prototype'].includes(name))continue;games[name.slice(0,40)]={played:count(x.played),wins:count(x.wins),losses:count(x.losses),net:num(x.net),best:Math.max(0,num(x.best))};}
 const recent=Array.isArray(v.recent)?v.recent.filter(x=>x&&typeof x.game==='string'&&Number.isFinite(x.net)&&Number.isFinite(x.at)).slice(-40).map(x=>({game:x.game.slice(0,40),net:num(x.net),at:Math.max(0,num(x.at))})):[];
 return{played:count(v.played),wins:count(v.wins),losses:count(v.losses),net:num(v.net),best:Math.max(0,num(v.best)),worst:Math.min(0,num(v.worst)),streak:count(v.streak),bestStreak:count(v.bestStreak),games,recent};
}
/** Called once by the existing game settlement path, never by practice flights. */
export function recordCasinoRound(state:CasinoSocial,game:string,net:number,at=Date.now()):void{
 if(!game||['__proto__','constructor','prototype'].includes(game)||!Number.isFinite(net))return;const s=state.record??=restoreCasinoRecord(undefined),name=game.slice(0,40),g=s.games[name]??={played:0,wins:0,losses:0,net:0,best:0};
 s.played++;g.played++;s.net+=net;g.net+=net;s.best=Math.max(s.best,net);s.worst=Math.min(s.worst,net);g.best=Math.max(g.best,net);
 if(net>0){s.wins++;g.wins++;s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak);}else if(net<0){s.losses++;g.losses++;s.streak=0;}
 s.recent.push({game:name,net,at});if(s.recent.length>40)s.recent.splice(0,s.recent.length-40);
}

