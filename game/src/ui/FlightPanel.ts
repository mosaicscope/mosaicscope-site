import {h} from './dom';
import {canvasStage} from './CanvasStage';
import {drawSkyHigh,LIVERIES,SKY_W,SKY_H} from './SkyHighArt';
import {finishFlight,flightMultiplier,flightPreferences,flightRate,recordFlight,FLIGHT_ROUTES,SKY_RATE,type CrashFlight,type FlightPreferences} from '../casino/flight';
import type {CasinoSocial} from '../sim/CityPlay';
import type {Character} from '../entities/types';
interface Host{state():CasinoSocial;people():readonly Character[];chips():number;setChips(n:number):void;render():void;buyChips?(n:number):boolean;round(game:string,net:number):void}
const cash=(n:number)=>'$'+Math.floor(n).toLocaleString('en-NZ');
const short=(n:number)=>n>=1e6?'$'+n/1e6+'M':n>=1e3?'$'+n/1e3+'K':'$'+n;
const STAKES=[25,100,500,1000,10000,100000,1000000],AUTOS=[0,1.5,2,3,5,10];
/** How long a replay runs: the flight itself, then the blink and the parachutes. */
const replayLength=(f:CrashFlight)=>{const end=((f.endedAt??f.start)-f.start)/1000,bust=Math.log(f.bust)/flightRate(f);return Math.min(90,(f.outcome==='landed'?end+Math.max(0,bust-end)/2.2:end)+5);};

/** The Crash tab: Sky High. A rocket full of Mosaics climbs while the multiplier rises; cash out before it blinks. */
export class FlightPanel{
 private model=-1;private scenery=-1;private stake=25;private message='';private replay=false;private replayAt=0;private replaySpeed=1;private alertFor=0;private settingsOpen=false;private journalOpen=false;private timer?:number;private timerFlight=0;private replayStart=0;
 constructor(private host:Host){}
 private prefs():FlightPreferences{const s=this.host.state();s.flightPreferences=flightPreferences(s.flightPreferences);return s.flightPreferences;}
 /** Settles on time even if the tab is hidden: the end point is fixed at launch, so the timer only reveals it. */
 private schedule():void{const f=this.host.state().flight;if(!f||f.paid){if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;this.timerFlight=0;return;}if(this.timer!==undefined&&this.timerFlight===f.start)return;const target=f.autoCash&&f.autoCash>1?Math.min(f.autoCash,f.bust):f.bust,deadline=f.start+Math.log(target)/flightRate(f)*1000;this.timerFlight=f.start;this.timer=window.setTimeout(()=>{this.timer=undefined;this.timerFlight=0;if(this.settle(false))this.host.render();},Math.max(0,deadline-Date.now()+30));}
 private settle(manual:boolean):boolean{const s=this.host.state(),f=s.flight;if(!f)return false;const amount=finishFlight(f,manual);if(amount===null)return false;if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;this.timerFlight=0;if(!f.practice){this.host.setChips(this.host.chips()+amount);this.host.round('Flight',amount-f.stake);}if(!f.logged){f.logged=true;s.flightHistory=[...(s.flightHistory??[]),recordFlight(f)].slice(-40);}this.message=f.outcome==='landed'?(f.practice?'Practice landed safely at ×'+(f.cashMultiplier??1).toFixed(2)+'.':'Cashed out '+cash(amount)+' at ×'+(f.cashMultiplier??1).toFixed(2)+'.'):'The rocket blinked at ×'+f.bust.toFixed(2)+'.';return true;}
 private launch():void{const s=this.host.state(),p=this.prefs();if(s.flight&&!s.flight.paid)return;const stake=p.practice?0:this.stake;if(this.host.chips()<stake){this.message='Buy chips or try a free practice flight.';return;}if(stake)this.host.setChips(this.host.chips()-stake);s.flight={stake,start:Date.now(),bust:Math.min(1000,Math.max(1,.97/(1-Math.random()))),paid:false,model:this.model,scene:this.scenery,rate:SKY_RATE,autoCash:p.autoCash,practice:p.practice};this.replay=false;this.alertFor=0;this.message=p.practice?'Free practice. No chips are at risk.':'Away! Cash out before it blinks.';this.schedule();}
 /** The Mosaics who ride the rocket and the crew who cash out beside you. Both are the casino's regular guests. */
 private cast():{riders:Character[];crew:Character[]}{const people=this.host.people(),you=people.find(c=>c.tier==='player')??people[0];let crew=(this.host.state().guests??[]).map(a=>people.find(c=>c.id===a.id)).filter((c):c is Character=>!!c&&c!==you).slice(0,5);if(!crew.length)crew=people.filter(c=>c!==you).slice(0,5);return{riders:[you,...crew.slice(0,2)].filter((c):c is Character=>!!c),crew};}
 render():HTMLElement{
  const s=this.host.state(),p=this.prefs();if(this.model<0)this.model=p.favouriteModel%LIVERIES.length;if(this.scenery<0)this.scenery=p.favouriteScene;
  const active=!!s.flight&&!s.flight.paid,{riders,crew}=this.cast();this.schedule();
  const button=(text:string,fn:()=>void,disabled=false,cls='btn')=>h('button.'+cls,{type:'button',text,disabled,onclick:()=>{fn();this.host.render();}});
  const select=(name:string,values:readonly (string|number)[],value:string|number,change:(value:string)=>void,disabled=false)=>h('label',null,[name,h('select',{'aria-label':name,disabled,onchange:(e:Event)=>{change((e.target as HTMLSelectElement).value);this.host.render();}},values.map((v,i)=>h('option',{value:typeof value==='number'?i:v,selected:typeof value==='number'?i===value:v===value,text:String(v)})))]);
  const chip=(label:string,pressed:boolean,fn:()=>void,disabled:boolean,aria:string)=>h('button.sky-chip',{type:'button','aria-pressed':String(pressed),'aria-label':aria,disabled,text:label,onclick:()=>{fn();this.host.render();}});
  const live=h('p.sky-status',{role:'status','aria-live':'polite',text:this.message||(p.practice?'Free practice is on. Launch when ready.':'Pick a stake, then launch.')});

  /* the one big button: Launch before take-off, Cash out in flight, always in the same place */
  const affordable=p.practice||this.host.chips()>=this.stake;
  const go=h('button.sky-go',{type:'button',disabled:!active&&!affordable,onclick:()=>{if(active)this.settle(true);else this.launch();this.host.render();}},[h('b'),h('small')]);
  const goTitle=go.querySelector('b')!,goHint=go.querySelector('small')!;
  const paintGo=()=>{const f=s.flight,flying=!!f&&!f.paid,title=flying?(f!.practice?'Land · ×'+flightMultiplier(f!).toFixed(2):'Cash out '+cash(f!.stake*flightMultiplier(f!))):p.practice?'Launch practice':'Launch · '+cash(this.stake);go.classList.toggle('is-live',flying);go.setAttribute('aria-label',flying?'Cash out flight':title);if(goTitle.textContent!==title)goTitle.textContent=title;const hint=flying?'Space or tap the sky':affordable?'The rocket blinks at a random point':'Buy chips or play free';if(goHint.textContent!==hint)goHint.textContent=hint;};
  paintGo();

  let sceneCanvas:HTMLCanvasElement|null=null;
  const stage=canvasStage((g,time,reduced,size)=>{
   if(!this.replay&&this.settle(false)){this.host.render();return;}
   const f=s.flight;if(f&&!f.paid&&flightMultiplier(f)>=p.alert&&this.alertFor!==f.start){this.alertFor=f.start;live.textContent='Multiplier alert ×'+p.alert+'. The endpoint remains random.';}
   paintGo();
   const replaySeconds=this.replay&&f?Math.min(replayLength(f),this.replayAt+(performance.now()-this.replayStart)/1000*this.replaySpeed):undefined;
   drawSkyHigh(g,{f,livery:this.model,scene:this.scenery,riders,crew,history:s.flightHistory??[],prefs:p,replaySeconds},time,reduced,size.width,size.height);
  },{width:SKY_W,height:SKY_H,layout:()=>{const r=sceneCanvas?.getBoundingClientRect(),width=(r?.width??window.innerWidth)<=700?600:SKY_W;return{width,height:r?.width?width*r.height/r.width:window.innerWidth<=700?560:SKY_H};},fps:30,
   label:'Sky High: a rocket carrying Mosaics climbs through the sky while the multiplier rises',
   key:()=>{if(this.replay)return;if(s.flight&&!s.flight.paid)this.settle(true);else this.launch();this.host.render();},
   pointer:pt=>{if(pt.type!=='up'||this.replay)return;if(s.flight&&!s.flight.paid){this.settle(true);this.host.render();}}});
  sceneCanvas=stage.querySelector('canvas');

  /* bet: stake and auto cash-out */
  const stakeGroup=h('div.sky-group.sky-stake',null,[h('span.sky-label',{text:'Stake'}),h('div.sky-chips',{role:'group','aria-label':'Flight stake'},STAKES.map(n=>chip(short(n),!p.practice&&this.stake===n,()=>{this.stake=n;},active||p.practice,'Stake '+cash(n))))]);
  const autoGroup=h('div.sky-group.sky-auto',null,[h('span.sky-label',{text:'Auto cash-out'}),h('div.sky-chips',{role:'group','aria-label':'Auto cash-out presets'},[...AUTOS.map(a=>chip(a?'×'+a:'Off',p.autoCash===a,()=>{p.autoCash=a;},active,a?'Auto cash-out at ×'+a:'Auto cash-out off')),h('input.sky-custom',{type:'number','aria-label':'Auto cash-out multiplier · 0 = off',placeholder:'Custom ×',min:0,max:1000,step:.1,value:AUTOS.includes(p.autoCash)?'':p.autoCash,disabled:active,onchange:(e:Event)=>{const n=Number((e.target as HTMLInputElement).value)||0;p.autoCash=n>1?Math.min(1000,n):0;this.host.render();}})])]);

  /* quick actions */
  const history=s.flightHistory??[],paid=history.filter(r=>!r.practice),net=paid.reduce((n,r)=>n+r.returned-r.stake,0);
  const replayControls=this.replay&&s.flight?.paid?h('div.sky-replay',null,[h('label',null,['Replay position',h('input',{type:'range','aria-label':'Replay position',min:0,max:replayLength(s.flight),step:.1,value:this.replayAt,oninput:(e:Event)=>{this.replayAt=Number((e.target as HTMLInputElement).value);this.replayStart=performance.now();}})]),select('Replay speed',['Paused','0.5×','1×','2×'],[0,.5,1,2].indexOf(this.replaySpeed),v=>{this.replayAt+=(performance.now()-this.replayStart)/1000*this.replaySpeed;this.replaySpeed=[0,.5,1,2][Number(v)];this.replayStart=performance.now();})]):null;

  /* the rest lives behind two quiet disclosures */
  const number=(label:string,value:number,min:number,max:number,change:(n:number)=>void)=>h('label',null,[label,h('input',{type:'number','aria-label':label,min,max,step:.1,value,onchange:(e:Event)=>change(Math.max(min,Math.min(max,Number((e.target as HTMLInputElement).value)||0)))})]);
  const settings=h('details.flight-settings',{open:this.settingsOpen,ontoggle:(e:Event)=>{this.settingsOpen=(e.target as HTMLDetailsElement).open;}},[h('summary',{text:'Rocket & display'}),h('div.sky-options',null,[select('Rocket livery',LIVERIES.map(l=>l.name),this.model,v=>{this.model=Number(v);},active),select('Flight scenery',FLIGHT_ROUTES,this.scenery,v=>{this.scenery=Number(v);},active),select('Light',['day','sunset','night'],p.day,v=>{p.day=v as FlightPreferences['day'];}),select('Flight weather',['clear','rain','snow'],p.weather,v=>{p.weather=v as FlightPreferences['weather'];}),number('Multiplier alert',p.alert,1.1,1000,n=>{p.alert=n;}),button(p.effects?'Calm effects':'Full effects',()=>{p.effects=!p.effects;}),button('Save favourite rocket & site',()=>{p.favouriteModel=this.model;p.favouriteScene=this.scenery;this.message='Favourite rocket and launch site saved.';})]),h('p',{text:'Auto cash-out is fixed before launch and settles at its target even if this tab is hidden. It wins only if that target is below the random endpoint. Rocket, scenery and crew are decoration and never affect the endpoint.'})]);
  const journal=h('details.flight-journal',{open:this.journalOpen,ontoggle:(e:Event)=>{this.journalOpen=(e.target as HTMLDetailsElement).open;}},[h('summary',{text:'Journal · '+history.length}),h('p',{text:paid.length+' chip flights · '+paid.filter(r=>r.outcome==='landed').length+' cash-outs · net '+cash(net)+' · best cash-out ×'+Math.max(1,...paid.filter(r=>r.outcome==='landed').map(r=>r.multiplier)).toFixed(2)}),h('ol',null,history.slice(-10).reverse().map(r=>h('li',{text:FLIGHT_ROUTES[r.scene]+' · '+(LIVERIES[r.model%LIVERIES.length]?.name??'Rocket')+' · '+r.duration.toFixed(1)+' s · ×'+r.multiplier.toFixed(2)+' · '+r.outcome+(r.bust&&r.outcome==='landed'?' (blinked at ×'+r.bust.toFixed(2)+')':'')+(r.practice?' · practice':' · '+cash(r.returned-r.stake))})))]);
  const tools=h('div.sky-tools',null,[h('button.sky-toggle',{type:'button','aria-pressed':String(p.practice),disabled:active,text:'Free practice',onclick:()=>{p.practice=!p.practice;this.host.render();}}),button('Buy $100 chips',()=>{this.message=this.host.buyChips?.(100)?'Bought $100 in chips.':'Not enough cash for $100 in chips.';},active,'btn.sky-small'),...(s.flight?.paid?[button(this.replay?'Exit replay':'Replay last flight',()=>{this.replay=!this.replay;this.replayAt=0;this.replayStart=performance.now();},active,'btn.sky-small')]:[]),settings,journal,h('span.flight-balance',{text:p.practice?'FREE PRACTICE':cash(this.host.chips())+' chips'})]);
  return h('section.casino-flight.iso-game.mosaic-flight.sky-high',null,[stage,live,h('div.sky-deck',null,[stakeGroup,autoGroup,go,tools,replayControls]),h('p.flight-disclaimer',{text:'Fictional chips only. Every flight ends at a random point; the rocket, the crew and the sky do not predict it. The crew’s bets are for show.'})]);
 }
}
