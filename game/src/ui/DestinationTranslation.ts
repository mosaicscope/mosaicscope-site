import {PHRASES,LANGUAGES} from '../../../data/destination-dialogue.mjs';
type Phrase=keyof typeof PHRASES;
interface Translation{english:string;text:string;language:string;source:string;translated:boolean}
const cache=new Map<string,Translation>();
/** Public curated phrases only. Direct CORS fallback avoids shared edge-IP translation quotas. */
export async function destinationTranslation(phrase:Phrase,language:string):Promise<Translation>{
 const english=PHRASES[phrase];if(!Object.prototype.hasOwnProperty.call(PHRASES,phrase)||!Object.prototype.hasOwnProperty.call(LANGUAGES,language))throw Error('Unsupported phrase or language');
 if(language==='en')return {english,text:english,language,source:'Authored game dialogue',translated:false};
 const key='mosaics:translation:v1:'+language+':'+phrase,saved=cache.get(key);if(saved)return saved;
 try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored?.english===english&&stored.language===language&&typeof stored.text==='string'&&stored.text.length<=1000&&stored.translated===true){cache.set(key,stored);return stored;}}catch{}
 let result:Translation|undefined;
 try{const r=await fetch('/api/destination-speech?phrase='+phrase+'&language='+language,{signal:AbortSignal.timeout(3500)}),d=await r.json();if(r.ok&&d.translated&&typeof d.text==='string'&&d.text.length<=1000&&d.language===language)result=d;}catch{}
 if(!result){const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',english);url.searchParams.set('langpair','en|'+language);const r=await fetch(url,{signal:AbortSignal.timeout(6500)}),d=await r.json(),text=d.responseData?.translatedText;if(!r.ok||d.responseStatus!==200||d.quotaFinished||typeof text!=='string'||!text.trim()||text.length>1000)throw Error('Translation unavailable');result={english,text,language,source:'MyMemory / Translated',translated:true};}
 cache.set(key,result);try{localStorage.setItem(key,JSON.stringify(result));}catch{}return result;
}
