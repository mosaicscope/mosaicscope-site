import {PHRASES,LANGUAGES} from '../../data/destination-dialogue.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':status===200?'public,max-age=2592000':'public,max-age=60'}});
export async function translatePhrase(phrase,language){
 if(!Object.hasOwn(PHRASES,phrase)||!Object.hasOwn(LANGUAGES,language))return null;
 const english=PHRASES[phrase];if(language==='en')return {english,text:english,language,source:'Authored game dialogue',translated:false};
 const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',english);url.searchParams.set('langpair','en|'+language);
 const r=await fetch(url,{signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('Translation unavailable');const data=await r.json(),text=data.responseData?.translatedText;
 if(data.responseStatus!==200||data.quotaFinished||typeof text!=='string'||!text.trim()||text.length>1000)throw Error('Translation unavailable');
 return {english,text,language,source:'MyMemory / Translated',translated:true};
}
export async function onRequestGet({request,waitUntil}){
 const url=new URL(request.url),phrase=url.searchParams.get('phrase')??'',language=url.searchParams.get('language')??'';
 if(!Object.hasOwn(PHRASES,phrase)||!Object.hasOwn(LANGUAGES,language))return json({error:'Unknown dialogue or language'},400);
 const key=new Request(url.origin+'/api/destination-speech?phrase='+phrase+'&language='+language),cache=caches.default,hit=await cache.match(key);if(hit)return hit;
 try{const response=json(await translatePhrase(phrase,language));waitUntil(cache.put(key,response.clone()));return response;}catch{return json({english:PHRASES[phrase],text:PHRASES[phrase],language:'en',source:'English fallback · translation temporarily unavailable',translated:false},503);}
}
