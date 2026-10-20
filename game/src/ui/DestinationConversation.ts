import {PHRASES,LANGUAGES,languageFor} from '../../../data/destination-dialogue.mjs';
import {h} from './dom';
type Phrase=keyof typeof PHRASES;
/** Local context is authored from map tags; translation changes language, never the underlying facts. */
export class DestinationConversation{
 readonly el=h('section.destination-conversation',{'aria-label':'Neighbourhood conversation'});private revision=0;private disposed=false;
 constructor(private country:string,private context:()=>{place:string;kind:string;local:string;nearby:string[]},private status:(text:string)=>void){this.el.hidden=true;}
 dispose():void{this.disposed=true;this.revision++;if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}
 talk():void{
  this.el.hidden=false;const c=this.context(),text=h('p.local-speech',{text:PHRASES.hello,lang:'en',dir:'auto'}),sub=h('p.local-subtitle',{text:c.local+' · '+c.place}),source=h('small',{text:'Authored game dialogue'}),select=h('select',{'aria-label':'Conversation language'},Object.entries(LANGUAGES).map(([value,label])=>h('option',{value,text:label}))) as HTMLSelectElement;
  select.value=languageFor(this.country);let current:Phrase='hello';
  const say=async(phrase:Phrase)=>{current=phrase;const revision=++this.revision,english=PHRASES[phrase];text.textContent=english;text.lang='en';source.textContent='Authored game dialogue';sub.textContent=c.local+' · '+c.place+(phrase==='directions'&&c.nearby.length?' · Nearby: '+c.nearby.join(' · '):'');if(select.value==='en')return;
   source.textContent='Translating…';try{const r=await fetch('/api/destination-speech?phrase='+phrase+'&language='+select.value,{signal:AbortSignal.timeout(8000)}),d=await r.json();if(this.disposed||revision!==this.revision)return;text.textContent=d.text||english;text.lang=d.language||'en';source.textContent=d.source||'English fallback';sub.textContent=english+' · '+c.local+' · '+c.place+(phrase==='directions'&&c.nearby.length?' · Nearby: '+c.nearby.join(' · '):'');}catch{if(!this.disposed&&revision===this.revision)source.textContent='English fallback · translation unavailable';}
  };
  select.onchange=()=>void say(current);
  const topic:Phrase=c.kind==='water'?'water':c.kind==='green'?'park':c.kind==='hospital'?'hospital':c.kind==='police'?'police':['cafe','restaurant','fast_food','bakery'].includes(c.kind)?'food':'shop';
  this.el.replaceChildren(h('div.local-conversation-head',null,[h('b',{text:c.local}),select,h('button.btn',{'aria-label':'Close conversation',text:'×',onclick:()=>{this.revision++;this.el.hidden=true;if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}})]),text,sub,source,h('div.local-choices',null,[
   h('button.btn',{text:'Ask for directions',onclick:()=>void say('directions')}),h('button.btn',{text:topic==='food'?'Ask about food':topic==='water'?'Ask about the waterfront':topic==='park'?'Ask about the park':'Ask about this place',onclick:()=>void say(topic)}),
   h('button.btn',{text:'Listen',onclick:()=>{if(typeof speechSynthesis==='undefined'){this.status('Speech playback is unavailable in this browser.');return;}const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.split('-')[0]===text.lang);if(!voice){this.status('No installed voice for this language. The translated text is available above.');return;}speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text.textContent||'');speech.lang=voice.lang;speech.voice=voice;speech.rate=.95;speechSynthesis.speak(speech);}}),h('button.btn',{text:'Say goodbye',onclick:()=>void say('goodbye')})]));void say('hello');
 }
}
