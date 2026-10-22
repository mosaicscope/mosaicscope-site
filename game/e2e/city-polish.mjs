import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(v,m)=>{if(!v)throw Error(m);},btn=name=>page.getByRole('button',{name,exact:true});
fs.mkdirSync('e2e/screenshots',{recursive:true});
const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:'e2e/screenshots/city-polish-'+name+'.png'});};
try{
 await page.route('**/api/weather*',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
 await page.goto(process.argv[2]??'http://127.0.0.1:5199/world/');for(const n of['Start new game','Start my story','Skip'])await btn(n).click();
 await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.sim.expansion.nextEncounter=1e12;g.sim.player.cash=10000;g.casino.show();});
 await page.getByRole('tab',{name:'Roulette',exact:true}).click();await btn('Buy $100 chips').click();await btn('Bet close-up').click();
 await page.waitForTimeout(150);await page.locator('.iso-wager-hit[aria-label="7 red"]').click();
 check(await page.evaluate(()=>{const c=window.__mosaics.casino;return c.rBets.some(b=>b.numbers.length===1&&b.numbers[0]===7)&&c.rZoom===2.7;}),'Zoomed cloth click selected the wrong number');await shot('roulette-close');
 await page.getByRole('button',{name:/Spin the wheel with/}).click();await btn('Full room').click();
 check(await page.evaluate(()=>window.__mosaics.casino.rSpinning&&window.__mosaics.casino.rZoom===1),'Cannot zoom out during the spin');
 await btn('Watch wheel').click();check(await page.getByLabel('Roulette zoom',{exact:true}).inputValue()==='2.7','Wheel camera control failed');await shot('wheel-spin');
 await page.waitForFunction(()=>!window.__mosaics.casino.rSpinning);await btn('Full room').click();
 for(const [width,height]of[[390,844],[844,390],[1600,1000]]){await page.setViewportSize({width,height});await page.waitForTimeout(120);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+width);await btn('Bet close-up').click();check(await page.getByLabel('Roulette zoom').isVisible(),'Zoom control missing at '+width);await shot('roulette-'+width);await btn('Full room').click();}
 await btn('Leave the casino').click();await page.evaluate(()=>window.__mosaics.phone.home());await btn('Contacts').click();
 check(await page.getByRole('button',{name:/Call (Dad|Mum|Nana|Little sis)/}).count()===0,'Family calls remain');
 const links=await page.locator('.retro-screen a').evaluateAll(a=>a.map(a=>a.href));check(links.length===3&&links.some(x=>x.includes('instagram.com')),'Phone city links missing');
 await page.getByLabel('Phone menu',{exact:true}).click();await btn('Snake').click();await page.keyboard.press('5');await page.waitForFunction(()=>document.querySelector('.retro-screen')?.textContent.includes('Paused'));
 check(await page.evaluate(()=>{const r=document.querySelector('.retro-phone').getBoundingClientRect();return r.width>=220&&r.width<=240&&r.bottom<=innerHeight+1;}),'Phone not compact');await shot('compact-phone');await page.getByLabel('Close phone',{exact:true}).click();
 const props=await page.evaluate(()=>window.__mosaics.sim.cityPlay.props.map(p=>p.kind));check(new Set(props).size>=35,'New physical props not present in a real game');
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player;for(const id of[p.hand,...p.bag]){if(s.toys[id]){s.toys[id].state='broken';s.toys[id].holder=-1;}}p.hand=-1;p.bag=[];for(const def of['pistol','knife','camera','phone','cannabis','sedative','stimulant_powder']){const t=s.spawnToy(def,p.x,p.y);t.holder=p.id;t.state='held';p.bag.push(t.id);}g.travel.show();g.travel.go('security');});
 await page.waitForTimeout(2900);check((await page.getByLabel('Scan results').textContent()).includes('cannabis · FLAGGED'),'Carried drugs are not scanned');check((await page.getByLabel('Scan results').textContent()).includes('camera · ok'),'Ordinary inventory falsely flagged');await shot('scanner-items');
 await page.evaluate(()=>{const g=window.__mosaics;g.travel.go('gate');});await shot('airport-people');await page.evaluate(()=>window.__mosaics.travel.close());
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.player,v=s.vehicles.find(v=>v.state==='parked'&&!v.forSale);p.x=p.px=v.x+1;p.y=p.py=v.y+1;v.cls='supra';v.color='#b46e5f';v.heading=.1;v.damage=.65;v.dmgF=.62;v.dmgL=.55;v.dmgS=.25;v.glassDamage=.7;v.components={wheels:[{puncture:true,rim:.35,alignment:.12,suspension:.3,missing:false},...Array.from({length:3},()=>({puncture:false,rim:0,alignment:0,suspension:0,missing:false}))],panels:[.62,0,.55,.25],glass:[.7,.2,.55,.3],hood:.6,bumper:.45,hoodLoose:false,hoodGone:false,bumperLoose:true,debris:[],lastImpact:s.tick};g.renderer.cam.follow=-1;g.renderer.cam.lookAt(v.x,v.y,true);g.renderer.cam.zoom=g.renderer.cam.targetZoom=4;});await shot('attached-glass-damage');
 await page.evaluate(()=>{const g=window.__mosaics;g.renderer.cam.zoom=g.renderer.cam.targetZoom=.7;g.sim.hour=22;});await shot('inhabited-city');
 check(!errors.length,errors.join(' | '));console.log('PASS roulette camera and exact zoomed wagers, zoom while spinning, responsive views; compact phone, no family calls, links and Snake; actual new props; inventory-specific scanner including drugs; airport activity, attached car damage and city-scale windows; no runtime errors');
}finally{await browser.close();}
