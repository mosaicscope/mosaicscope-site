/** Functional cookie selects the saved story; the large world snapshot remains in browser storage. */
const KEY='mosaics_continue';
export function rememberContinue(slot:string):void{try{if(typeof document==='undefined')return;document.cookie=`${KEY}=${encodeURIComponent(slot)}; Path=/world/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;}catch{}}
export function continueSlot():string|null{try{if(typeof document==='undefined')return null;const value=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(KEY+'='))?.slice(KEY.length+1);return value?decodeURIComponent(value):null;}catch{return null;}}
