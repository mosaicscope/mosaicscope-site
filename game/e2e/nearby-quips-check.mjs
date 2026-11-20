import {chromium} from 'playwright-core';
import {createServer} from 'vite';
const server=await createServer({configLoader:'runner',cacheDir:'../.vite-cache-quips',server:{host:'127.0.0.1',port:5194,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline test'}}));await page.goto('http://127.0.0.1:5194/world/');
 for(const name of ['Start new game','Start my story','Skip']){const b=page.getByRole('button',{name,exact:true});if(await b.isVisible())await b.click();}await page.waitForFunction(()=>window.__mosaics?.sim?.tick>2);
 const bankLoaded=page.waitForResponse(r=>r.url().includes('/quips/kiwi-')&&r.status()===200,{timeout:15000});await page.evaluate(async()=>{const g=window.__mosaics,s=g.sim,p=s.player;g.setSpeed(0);window.__quipApi=await import('/world/src/sim/NearbyQuips.ts');for(const c of s.chars){c.bubble=null;if(c.id!==p.id){c.inside=0;c.inCar=-1;}}const c=s.chars.find(c=>c.id!==p.id);Object.assign(c,{inside:-1,inCar:-1,x:p.x+1,y:p.y,phys:0,stunUntil:0,talkWith:-1,bubble:null});s.tick=60;s.rebuildHash();window.__quipSpeaker=c;window.__quipApi.updateNearbyQuips(s);});
 await bankLoaded;await page.waitForTimeout(250);
 const line=await page.evaluate(()=>{const s=window.__mosaics.sim;s.tick=240;s.rebuildHash();window.__quipApi.updateNearbyQuips(s);return window.__quipSpeaker.bubble;});if(!line||!line.text||line.until-240<300)throw Error('Nearby line did not display long enough: '+JSON.stringify(line));
 const duplicate=await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player,c=s.chars.find(c=>c.id!==p.id&&c.id!==window.__quipSpeaker.id);Object.assign(c,{x:p.x+1,y:p.y,inside:-1,inCar:-1});s.say(c,'Important conversation','say',3);return window.__quipSpeaker.bubble;});if(duplicate!==null)throw Error('Ambient line did not yield to dialogue');
 await page.getByRole('button',{name:'Toggle driving camera'}).click();await page.waitForTimeout(300);if(errors.length)throw Error(errors.join('\n'));
 console.log('NEARBY_QUIP_CHECK',JSON.stringify({length:line.text.length,duration:line.until-240,dialoguePriority:duplicate===null,errors}));
}finally{await browser.close();await server.close();}

