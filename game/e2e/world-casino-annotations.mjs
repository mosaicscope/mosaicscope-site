import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const shot=async name=>{await page.waitForTimeout(160);await page.screenshot({path:'e2e/screenshots/annotations-'+name+'.png'});};
const button=name=>page.getByRole('button',{name,exact:true}),tab=name=>page.getByRole('tab',{name,exact:true});
try{
 fs.mkdirSync('e2e/screenshots',{recursive:true});
 await page.route('**/api/weather*',r=>r.fulfill({json:{weather:'clear',isDay:true,temp:14,wind:10,hour:12}}));
 await page.goto(process.argv[2]??'http://127.0.0.1:5199/world/');
 for(const name of['Start new game','Start my story','Skip'])await button(name).click();
 await page.evaluate(()=>{const g=window.__mosaics;g.setSpeed(0);g.sim.player.cash=20000;g.sim.expansion.nextEncounter=1e12;g.casino.show();});
 await page.getByLabel('Change table limits',{exact:true}).click();await tab('Cashier').click();await page.getByRole('button',{name:'Buy $10,000 in chips',exact:true}).click();await page.getByLabel('Change table limits',{exact:true}).click();
 check(await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.chips)===10000,'Chip purchase not persistent');
 await tab('Roulette').click();
 check(await page.locator('.iso-roulette>figure canvas').count()===1,'Integrated isometric table missing');
 await page.locator('.iso-roulette>details>summary').click();
 await shot('roulette-desktop');
 await button('Bank: borrow $500 · repay $525').click();
 check(await page.evaluate(()=>{const s=window.__mosaics.sim;return s.player.cash===10500&&s.cityPlay.casino.debt===525;}),'Credit terms or payment incorrect');
 await button('Repay credit').click();check(await page.evaluate(()=>window.__mosaics.sim.player.cash)===9975,'Repayment incorrect');
 const guest=await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.guests.findIndex(a=>a.id%6!==0));
 await page.getByLabel('Table guest',{exact:true}).selectOption(String(guest));
 await button('Buy them a drink · $12').click();
 check(await page.evaluate(()=>window.__mosaics.sim.player.cash)===9963,'Guest drink was not charged once');
 await button('Famiglia side bet · even · $25').click();
 // Another game must never settle a roulette side wager.
 await tab('Crash flight').click();check(await page.getByLabel('Crash aircraft',{exact:true}).locator('option').count()===60,'Sixty aircraft missing');
 await page.getByLabel('Crash aircraft',{exact:true}).selectOption('42');await page.getByLabel('Flight scenery',{exact:true}).selectOption('1');
 await button('Launch · $25').click();
 await page.evaluate(()=>{const f=window.__mosaics.sim.cityPlay.casino.flight;if(!f.paid)f.bust=100;});
 await page.waitForTimeout(500);await button('Cash out flight').click();
 check(await page.evaluate(()=>!!window.__mosaics.sim.cityPlay.casino.sideBet),'Flight settled roulette side bet');
 const ended=await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.flight.endedAt);await page.waitForTimeout(150);
 check(await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.flight.endedAt)===ended,'Flight result did not freeze');await shot('flight-coast');
 await tab('Roulette').click();if(await page.locator('.iso-roulette>details').evaluate(e=>e.open))await page.locator('.iso-roulette>details>summary').click();const before=await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.chips);
 await button('7 red').click();await page.getByRole('button',{name:/Spin the wheel with/}).click();
 await page.waitForFunction(()=>!window.__mosaics.casino.rSpinning);
 check(await page.evaluate(({before})=>{const g=window.__mosaics,n=g.casino.rLast;return !g.sim.cityPlay.casino.sideBet&&g.casino.chips===before-5+(n===7?180:0)+(n>0&&n%2===0?50:0);},{before}),'Roulette side wager or main payout incorrect');
 check(await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.guests.every(a=>a.line.length>0)),'Guest reactions missing');
 await tab('Poker tables').click();await page.getByLabel('Poker buy-in',{exact:true}).fill('100');await page.getByLabel('Poker buy-in',{exact:true}).dispatchEvent('change');await button('Take a poker seat · cash').click();
 await page.locator('.poker-table-info summary').click();await page.getByLabel('Poker player profile',{exact:true}).selectOption('2');await button('Talk at the table').click();check(await page.locator('.casino-holdem').textContent().then(t=>t.includes('make them pay')),'Opponent table dialogue missing');await page.locator('.poker-table-info summary').click();
 for(let n=0;n<30&&await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.poker.phase==='betting');n++)await page.getByRole('button',{name:/^(Check|Call \$)/}).click();
 check(await page.evaluate(()=>{const t=window.__mosaics.sim.cityPlay.casino.poker;return t.phase!=='betting'&&t.seats.reduce((n,s)=>n+s.stack,0)+t.pot===400;}),'Poker stalled or lost table chips');
 await shot('poker-desktop');await page.setViewportSize({width:390,height:844});await shot('poker-mobile');await button('Cash out poker stack').scrollIntoViewIfNeeded();check((await button('Cash out poker stack').boundingBox()).height>=40,'Mobile poker controls too small');await page.setViewportSize({width:1600,height:1000});await button('Cash out poker stack').click();
 await button('Tournament').click();await button('Take a poker seat · tournament').click();
 for(let n=0;n<30&&await page.evaluate(()=>window.__mosaics.sim.cityPlay.casino.poker.phase==='betting');n++)await page.getByRole('button',{name:/^(Check|Call \$)/}).click();
 await button('Finish / forfeit tournament').click();check(await page.evaluate(()=>!window.__mosaics.sim.cityPlay.casino.poker),'Tournament exit stuck');
 // Fit and touch targets at mobile sizes and the CSS viewport sizes produced by page zoom.
 for(const [width,height]of[[390,844],[844,390],[2048,1152]]){
  await page.setViewportSize({width,height});await tab('Crash flight').click();await shot('flight-'+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Casino page overflow at '+width);
  const launch=button('Launch · $25');await launch.scrollIntoViewIfNeeded();const box=await launch.boundingBox();check(box.width>=40&&box.height>=38,'Flight controls too small');
 }
 await page.setViewportSize({width:1600,height:1000});await page.getByRole('button',{name:'Leave the casino',exact:true}).click();
 await page.evaluate(()=>window.__mosaics.phone.home(['Mum','Dad','Little sis']));await button('Contacts').click();await button('Call Dad').click();
 check(await page.locator('.retro-screen .who').textContent().then(t=>t.includes('Dad')),'Contacts lost authored family dialogue');await shot('phone-call');
 await page.getByLabel('Phone menu',{exact:true}).click();await button('Snake').click();await shot('phone-snake');
 await page.keyboard.press('5');await page.waitForFunction(()=>document.querySelector('.retro-screen').textContent.includes('Paused'));await page.keyboard.press('5');
 await page.setViewportSize({width:390,height:844});await shot('phone-mobile');
 check(await page.evaluate(()=>{const r=document.querySelector('.retro-phone').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.width>=280;}),'Phone clipped or too small on mobile');
 await page.getByLabel('Close phone',{exact:true}).click();
 await page.setViewportSize({width:1600,height:1000});
 // Inspect actual road labels, native riders and separated damaged components in the world renderer.
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,b=s.world.buildings.find(b=>b.kind==='house');const q=s.world.nearestWalkable(b.x1+2,b.y1+2);s.player.x=s.player.px=q.x;s.player.y=s.player.py=q.y;const cam=g.renderer.cam;cam.follow=s.playerId;cam.x=cam.targetX=q.x;cam.y=cam.targetY=q.y;cam.zoom=cam.targetZoom=2.3;
 const base=s.vehicles.find(v=>v.cls==='sedan')??s.vehicles[0],v=structuredClone(base);Object.assign(v,{id:s.vehicles.length,x:q.x+1.5,y:q.y,px:q.x+1.5,py:q.y,heading:0,state:'parked',driver:-1,damage:.7,dmgF:.7,dmgL:.4,dmgS:.2,bumperLost:false,glassDamage:.8,components:{wheels:Array.from({length:4},(_,i)=>({puncture:i===0,rim:i===0?.7:0,alignment:i===0?.3:0,suspension:i===0?.8:0,missing:i===1})),panels:[.7,0,.4,.2],glass:[.85,0,.4,0],hood:.2,bumper:.3,hoodLoose:true,hoodGone:false,bumperLoose:true,debris:[{kind:'wheel',x:q.x+2,y:q.y+1,z:.1,vx:0,vy:0,vz:0,age:0,spin:.5}],lastImpact:0}});s.vehicles.push(v);
 ['motorcycle','bicycle','escooter'].forEach((cls,i)=>{const a=structuredClone(base),c=s.chars.find(c=>c.tier!=='player'&&c.inCar<0&&c.id!==v.driver&&c.phys===0);Object.assign(a,{id:s.vehicles.length,cls,x:q.x-2+i*2,y:q.y+3,px:q.x-2+i*2,py:q.y+3,state:'parked',driver:c.id,heading:0,components:undefined,damage:0});c.inCar=a.id;c.inside=-1;s.vehicles.push(a);});
 s.world.civicDamage['b:'+b.id+':'+b.x1+':'+b.y1]={key:'b:'+b.id+':'+b.x1+':'+b.y1,kind:'building',building:b.id,x:b.x1+.5,y:b.y1+.5,tx:b.x1,ty:b.y1,face:'s',material:'timber',severity:.9,at:s.tick,phase:'reported',repairBy:s.tick+10800};
 });await shot('damaged-car-riders-signs');
 await page.evaluate(()=>{const g=window.__mosaics,s=g.sim,p=s.world.areas.find(a=>a.kind==='plaza'),q=s.world.nearestWalkable(p.x0+5,p.y0+5);let i=0;for(const v of s.vehicles.filter(v=>['motorcycle','bicycle','escooter'].includes(v.cls)&&v.driver>=0).slice(-3)){v.x=v.px=q.x-2+i*2;v.y=v.py=q.y;v.speed=2;i++;}const cam=g.renderer.cam;cam.follow=-1;cam.x=cam.targetX=q.x;cam.y=cam.targetY=q.y;cam.zoom=cam.targetZoom=3;s.player.inCar=-1;s.player.x=s.player.px=q.x;s.player.y=s.player.py=q.y+3;});await shot('rider-controls');
 await page.evaluate(()=>{const g=window.__mosaics;g.renderer.cam.follow=g.sim.playerId;g.setSpeed(1);});const start=await page.evaluate(()=>({x:window.__mosaics.sim.player.x,y:window.__mosaics.sim.player.y}));await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');check(await page.evaluate(({start})=>{const g=window.__mosaics;return Math.hypot(g.sim.player.x-start.x,g.sim.player.y-start.y)>.1&&g.renderer.cam.follow===g.sim.playerId;},{start}),'Phone left movement or follow locked');
 check(!errors.length,errors.join(' | '));console.log('PASS annotations: casino social wagers, drinks and credit; roulette outcome settlement; actual poker and tournament bankroll; 60-aircraft flight and frozen cash-out; desktop/mobile/zoom layout; authored phone contacts and keypad Snake; native world damage/rider rendering; no runtime errors');
}finally{await browser.close();}
