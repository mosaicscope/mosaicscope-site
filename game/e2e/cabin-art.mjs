import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(value,message)=>{if(!value)throw Error(message);};
try{
 await page.route('**/api/weather*',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
 await page.goto(process.argv[2]??'http://127.0.0.1:4173/world/');
 for(const name of ['Start new game','Start my story','Skip'])await page.getByRole('button',{name,exact:true}).click();
 await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.sim.player.cash=5000;g.travel.show();g.travel.go('flight');});
 fs.mkdirSync('e2e/screenshots',{recursive:true});
 for(const [width,height,first,seat]of [[1600,1000,false,'aisle'],[1600,1000,false,'window'],[1600,1000,true,'aisle'],[1600,1000,true,'window'],[390,844,false,'aisle'],[390,844,true,'window'],[844,390,true,'aisle']]){
  await page.setViewportSize({width,height});
  await page.evaluate(({first,seat})=>{const tr=window.__mosaics.travel;tr.cabin={first,seat,meal:first?2:0,snack:'Fruit',headphones:true,headphonePairs:2,blanket:true,tablet:first,service:'Cabin crew: Your meal is ready.'};tr.stageStart=performance.now()-(first?40000:25000);tr.render();},{first,seat});
  await page.waitForTimeout(200);
  check(await page.evaluate(()=>{const c=document.querySelector('.travel .tv-canvas'),r=c.getBoundingClientRect(),a=document.querySelector('.travel .tv-actions').getBoundingClientRect();return Math.abs(c.width-r.width*Math.min(devicePixelRatio,2))<2&&Math.abs(c.height-r.height*Math.min(devicePixelRatio,2))<2&&r.height>=120&&a.bottom<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1;}),'Cabin or controls clipped at '+width+'x'+height);
  const name='cabin-'+(first?'first':'economy')+'-'+seat+'-'+width;
  if(width>1000)await page.locator('.travel .tv-canvas').screenshot({path:'e2e/screenshots/'+name+'.png'});else await page.screenshot({path:'e2e/screenshots/'+name+'.png'});
 }
 check(await page.evaluate(()=>window.__mosaics.sim.player.cash===5000),'Rendering changed player cash');
 check(!errors.length,errors.join(' | '));
 console.log('PASS cabin artwork: seven desktop/mobile/class/view combinations, retina backing, viewport fit, unchanged player state and no runtime errors');
}finally{await browser.close();}
