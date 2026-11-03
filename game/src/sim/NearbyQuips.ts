import type {Simulation} from './Simulation';
import type {Character} from '../entities/types';

/** Ambient speech is deliberately separate from authored conversations and urgent reactions. */
type Recent={normal:string;words:Set<string>};
type State={next:number;lastSpeaker:number;recent:Recent[];used:Set<string>;active?:{speaker:Character;text:string;until:number}};
const states=new WeakMap<Simulation,State>();
const banks:string[][]=Array.from({length:6},()=>[]);
let loading=false,nextBank=0,retryAfter=0;
const HEARING=2.35,HEARING_TALK=4.2,RECENT=100;
const stop=new Set(['a','an','and','are','as','at','be','but','by','for','from','i','in','is','it','its','me','my','of','on','or','so','that','the','their','them','they','this','to','was','with','you','your']);
export function quipSignature(text:string):Recent{
 const normal=text.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
 return{normal,words:new Set(normal.split(' ').filter(w=>w.length>2&&!stop.has(w)))};
}
/** Similar templates are avoided within the recent window; this is a heuristic, not semantic understanding. */
export function quipsSimilar(a:Recent,b:Recent):boolean{
 if(a.normal===b.normal)return true;
 if(!a.words.size||!b.words.size)return false;
 let shared=0;for(const word of a.words)if(b.words.has(word))shared++;
 return shared>=3&&shared/(a.words.size+b.words.size-shared)>=.65;
}
export function chooseQuip(pool:readonly string[],recent:readonly Recent[],random:()=>number,attempts=24,used?:ReadonlySet<string>):{text:string;signature:Recent}|null{
 if(!pool.length)return null;
 for(let i=0;i<attempts;i++){const text=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];if(!text||used?.has(text))continue;const signature=quipSignature(text);if(!recent.some(r=>quipsSimilar(signature,r)))return{text,signature};}
 return null;
}
/** Fetch one compact bank at a time; files live with the game and require no external service. */
function loadBank():void{
 if(typeof window==='undefined'||typeof fetch!=='function'||loading||Date.now()<retryAfter)return;
 const missing=banks.findIndex((b,i)=>i>=nextBank&&!b.length),index=missing>=0?missing:banks.findIndex(b=>!b.length);
 if(index<0)return;loading=true;nextBank=(index+1)%banks.length;
 fetch(import.meta.env.BASE_URL+'quips/kiwi-'+(index+1)+'.json').then(r=>{if(!r.ok)throw Error('Quip bank unavailable');return r.json();}).then((rows:unknown)=>{if(!Array.isArray(rows))throw Error('Invalid quip bank');banks[index]=rows.filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<=220);}).catch(()=>{retryAfter=Date.now()+30000;}).finally(()=>{loading=false;});
}
function state(sim:Simulation):State{let s=states.get(sim);if(!s){const history=sim.worldFun.recentQuips??[];s={next:sim.tick+180,lastSpeaker:-1,recent:history.map(quipSignature),used:new Set(history)};states.set(sim,s);}return s;}
function heard(sim:Simulation,c:Character,x:number,y:number):boolean{
 const b=c.bubble;if(!b||b.until<=sim.tick||c.inside>=0||c.inCar>=0)return false;
 const range=(c.talkWith>=0?HEARING_TALK:HEARING)+(b.kind==='shout'?3:0);
 return c.id===sim.playerId||Math.hypot(c.x-x,c.y-y)<range;
}
/** Give live dialogue and urgent reactions priority if they begin while an ambient quip is displayed. */
export function interruptNearbyQuip(sim:Simulation,speaker:Character):void{
 const s=states.get(sim),a=s?.active;if(!s||!a||a.until<=sim.tick)return;
 const p=sim.player,vehicle=p.inCar>=0?sim.vehicles[p.inCar]:undefined,x=vehicle?.x??p.x,y=vehicle?.y??p.y;
 if(speaker.id!==a.speaker.id&&Math.hypot(speaker.x-x,speaker.y-y)>HEARING_TALK+3)return;
 if(a.speaker.bubble?.text===a.text)a.speaker.bubble=null;
 s.active=undefined;s.next=sim.tick+180;
}
export function updateNearbyQuips(sim:Simulation):void{
 if(sim.tick%60!==0)return;const s=state(sim);loadBank();
 const p=sim.player;if(p.inside>=0||sim.tick<s.next)return;
 if(s.active&&s.active.until>sim.tick)return;s.active=undefined;
 const vehicle=p.inCar>=0?sim.vehicles[p.inCar]:undefined,x=vehicle?.x??p.x,y=vehicle?.y??p.y,ids:number[]=[];
 sim.charHash.query(x,y,HEARING_TALK+3,ids);
 const candidates:Character[]=[];
 for(const id of ids){const c=sim.chars[id];if(!c)continue;if(heard(sim,c,x,y)){s.next=sim.tick+60;return;}
  if(c.id!==p.id&&c.phys===0&&c.inside<0&&c.inCar<0&&c.talkWith<0&&sim.tick>=c.stunUntil&&Math.hypot(c.x-x,c.y-y)<HEARING-.15)candidates.push(c);
 }
 if(heard(sim,p,x,y)||!candidates.length){s.next=sim.tick+60;return;}
 const usable=banks.filter(b=>b.length);if(!usable.length){s.next=sim.tick+60;return;}
 const speakers=candidates.length>1?candidates.filter(c=>c.id!==s.lastSpeaker):candidates,speaker=sim.rng.pick(speakers.length?speakers:candidates),bank=sim.rng.pick(usable),choice=chooseQuip(bank,s.recent,()=>sim.rng.next(),24,s.used);
 if(!choice){s.next=sim.tick+60;return;}
 const words=choice.text.trim().split(/\s+/).length,seconds=Math.min(16,Math.max(5,1.8+words/2.5));
 sim.say(speaker,choice.text,'say',seconds);s.active={speaker,text:choice.text,until:sim.tick+Math.round(seconds*60)};s.lastSpeaker=speaker.id;s.used.add(choice.text);s.recent.push(choice.signature);if(s.recent.length>RECENT)s.recent.shift();const history=sim.worldFun.recentQuips??=[];history.push(choice.text);if(history.length>RECENT)history.shift();s.next=s.active.until+sim.rng.int(120,300);
}

