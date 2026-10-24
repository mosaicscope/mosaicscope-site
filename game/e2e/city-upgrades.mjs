import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));
const check=(ok,message)=>{if(!ok)throw Error(message);};
const now=new Date().toISOString(),live={code:'CHC',centre:{lat:-43.5309,lon:172.6366,name:'Christchurch'},fetchedAt:now,weather:{temperature:15,wind:2,cloud:20,rain:0,symbol:'clearsky_day',forecastAt:now,source:'MET Norway',sourceUrl:'https://api.met.no/'},traffic:{available:true,notices:[],provider:{coverage:'Fixture highway coverage'},status:'Available'},sources:{fetchedAt:now,cameras:{available:true,source:'NZTA',sourceUrl:'https://www.journeys.nzta.govt.nz/traffic-cameras',note:'Public road-camera stills; image capture time is not supplied.',items:[{id:'596',name:'SH73 Sockburn',description:'North along Curletts Road',direction:'Northbound',lat:-43.5358,lon:172.5678,imageUrl:'https://www.trafficnz.info/camera/596.jpg',viewUrl:'https://www.trafficnz.info/camera/view/596',offline:false}]},airQuality:{pm25:3,pm10:4,aqi:20,at:now},earthquakes:{items:[]}}};
try{
 await page.route('**/api/live-city?*',r=>r.fulfill({json:live}));
 await page.route('https://www.trafficnz.info/camera/*',r=>r.abort());
 await page.goto(process.argv[2]||'http://127.0.0.1:4173/world/');
 for(const name of ['Start new game','Start my story'])await page.getByRole('button',{name,exact:true}).click();
 const skip=page.getByRole('button',{name:'Skip',exact:true});if(await skip.isVisible().catch(()=>false))await skip.click();
 await page.waitForFunction(()=>window.__mosaics?.sim?.vehicles.length>700);
 await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.sim.expansion.nextEncounter=1e12;});
 const counts=await page.evaluate(()=>{const s=window.__mosaics.sim;return {cars:s.vehicles.length,driving:s.vehicles.filter(v=>v.state==='drive').length,people:s.chars.filter(c=>c.inCar<0).length};});
 check(counts.driving>=640,'Expected the busy 650-car fleet: '+JSON.stringify(counts));check(counts.people>300,'Not enough people left walking');
 for(const [width,height]of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  check(await page.evaluate(()=>{const r=document.querySelector('.tc-zone').getBoundingClientRect();return r.width>0&&r.height>0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),'Joystick is outside the viewport');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
 }
 await page.setViewportSize({width:390,height:844});
 fs.mkdirSync('e2e/screenshots',{recursive:true});await page.screenshot({path:'e2e/screenshots/city-upgrades-mobile.png'});
 await page.evaluate(()=>window.__mosaics.openLiveCity());
 await page.getByRole('heading',{name:'Public road cameras',exact:true}).waitFor();
 await page.getByLabel('City tool',{exact:true}).selectOption('rush');await page.getByRole('button',{name:'Use city tool',exact:true}).click();
 check(await page.evaluate(()=>window.__mosaics.sim.world.mapped.trafficMode==='rush'),'Traffic mode did not apply');
 await page.evaluate(()=>window.__mosaics.openLiveCity());await page.getByText('SH73 Sockburn',{exact:true}).click();
 await page.getByText(/Camera image unavailable here/).waitFor();await page.screenshot({path:'e2e/screenshots/city-upgrades-sources.png'});
 await page.getByLabel('Close',{exact:true}).click();
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 await page.getByRole('button',{name:'Street play · games, walks & discoveries',exact:true}).click();
 await page.getByRole('button',{name:'10 city challenges',exact:true}).click();
 check(await page.locator('.city-challenges article').count()===10,'Missing city challenges');
 await page.getByRole('button',{name:'Start challenge',exact:true}).first().click();
 await page.getByRole('button',{name:'Walk to the next stop',exact:true}).waitFor();
 await page.screenshot({path:'e2e/screenshots/city-upgrades-challenges.png'});
 check(errors.length===0,errors.join('\n'));console.log('PASS',counts,'portrait/landscape controls, live source panel and camera fallback, rush mode, ten city challenges; no runtime errors');
}finally{await browser.close();}
